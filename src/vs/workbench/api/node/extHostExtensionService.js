import * as performance from "../../../base/common/performance.js";
import { createApiFactoryAndRegisterActors } from "../common/extHost.api.impl.js";
import { RequireInterceptor } from "../common/extHostRequireInterceptor.js";
import { connectProxyResolver } from "./proxyResolver.js";
import { AbstractExtHostExtensionService } from "../common/extHostExtensionService.js";
import { ExtHostDownloadService } from "./extHostDownloadService.js";
import { URI } from "../../../base/common/uri.js";
import { Schemas } from "../../../base/common/network.js";
import { ExtensionRuntime } from "../common/extHostTypes.js";
import { CLIServer } from "./extHostCLIServer.js";
import { realpathSync } from "../../../base/node/pfs.js";
import { ExtHostConsoleForwarder } from "./extHostConsoleForwarder.js";
import { ExtHostDiskFileSystemProvider } from "./extHostDiskFileSystemProvider.js";
import nodeModule from "node:module";
import { assertType } from "../../../base/common/types.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { BidirectionalMap } from "../../../base/common/map.js";
import { DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
const require2 = nodeModule.createRequire(import.meta.url);
class NodeModuleRequireInterceptor extends RequireInterceptor {
  constructor() {
    super(...arguments);
    this._store = new DisposableStore();
  }
  static _createDataUri(scriptContent) {
    return `data:text/javascript;base64,${Buffer.from(scriptContent).toString("base64")}`;
  }
  static {
    this._vscodeImportFnName = `_VSCODE_IMPORT_VSCODE_API`;
  }
  dispose() {
    this._store.dispose();
  }
  _installInterceptor() {
    const that = this;
    const node_module = require2("module");
    const originalLoad = node_module._load;
    node_module._load = function load(request, parent, isMain) {
      request = applyAlternatives(request);
      if (!that._factories.has(request)) {
        return originalLoad.apply(this, arguments);
      }
      return that._factories.get(request).load(
        request,
        URI.file(realpathSync(parent.filename)),
        (request2) => originalLoad.apply(this, [request2, parent, isMain])
      );
    };
    const originalLookup = node_module._resolveLookupPaths;
    node_module._resolveLookupPaths = (request, parent) => {
      return originalLookup.call(this, applyAlternatives(request), parent);
    };
    const originalResolveFilename = node_module._resolveFilename;
    node_module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
      if (request === "vsda" && Array.isArray(options?.paths) && options.paths.length === 0) {
        options.paths = node_module._nodeModulePaths(import.meta.dirname);
      }
      return originalResolveFilename.call(this, request, parent, isMain, options);
    };
    const applyAlternatives = (request) => {
      for (const alternativeModuleName of that._alternatives) {
        const alternative = alternativeModuleName(request);
        if (alternative) {
          request = alternative;
          break;
        }
      }
      return request;
    };
    const apiInstances = new BidirectionalMap();
    const apiImportDataUrl = /* @__PURE__ */ new Map();
    Object.defineProperty(globalThis, NodeModuleRequireInterceptor._vscodeImportFnName, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: (key) => {
        return apiInstances.getKey(key);
      }
    });
    let apiModuleFactory;
    const lookup = (url) => {
      if (!apiModuleFactory) {
        apiModuleFactory = this._factories.get("vscode");
        assertType(apiModuleFactory);
      }
      const uri = URI.parse(url);
      const apiInstance = apiModuleFactory.load("_not_used", uri, () => {
        throw new Error("CANNOT LOAD MODULE from here.");
      });
      let key = apiInstances.get(apiInstance);
      if (!key) {
        key = generateUuid();
        apiInstances.set(apiInstance, key);
      }
      let scriptDataUrlSrc = apiImportDataUrl.get(key);
      if (!scriptDataUrlSrc) {
        const jsCode = `const _vscodeInstance = globalThis.${NodeModuleRequireInterceptor._vscodeImportFnName}('${key}');

${Object.keys(apiInstance).map(((name) => `export const ${name} = _vscodeInstance['${name}'];`)).join("\n")}`;
        scriptDataUrlSrc = NodeModuleRequireInterceptor._createDataUri(jsCode);
        apiImportDataUrl.set(key, scriptDataUrlSrc);
      }
      return scriptDataUrlSrc;
    };
    const hooks = nodeModule.registerHooks({
      resolve: (specifier, context, nextResolve) => {
        if (specifier !== "vscode" || !context.parentURL) {
          return nextResolve(specifier, context);
        }
        const otherUrl = lookup(context.parentURL);
        return {
          url: otherUrl,
          shortCircuit: true
        };
      }
    });
    this._store.add(toDisposable(() => hooks.deregister()));
  }
}
class ExtHostExtensionService extends AbstractExtHostExtensionService {
  constructor() {
    super(...arguments);
    this.extensionRuntime = ExtensionRuntime.Node;
  }
  async _beforeAlmostReadyToRunExtensions() {
    this._instaService.createInstance(ExtHostConsoleForwarder);
    const extensionApiFactory = this._instaService.invokeFunction(createApiFactoryAndRegisterActors);
    this._instaService.createInstance(ExtHostDownloadService);
    if (this._initData.remote.isRemote && this._initData.remote.authority) {
      const cliServer = this._instaService.createInstance(CLIServer);
      process.env["VSCODE_IPC_HOOK_CLI"] = cliServer.ipcHandlePath;
    }
    this._instaService.createInstance(ExtHostDiskFileSystemProvider);
    await this._store.add(this._instaService.createInstance(NodeModuleRequireInterceptor, extensionApiFactory, { mine: this._myRegistry, all: this._globalRegistry })).install();
    performance.mark("code/extHost/didInitAPI");
    const configProvider = await this._extHostConfiguration.getConfigProvider();
    await connectProxyResolver(this._extHostWorkspace, configProvider, this, this._logService, this._mainThreadTelemetryProxy, this._initData, this._store);
    performance.mark("code/extHost/didInitProxyResolver");
  }
  _getEntryPoint(extensionDescription) {
    return extensionDescription.main;
  }
  async _doLoadModule(extension, module, activationTimesBuilder, mode) {
    if (module.scheme !== Schemas.file) {
      throw new Error(`Cannot load URI: '${module}', must be of file-scheme`);
    }
    let r = null;
    activationTimesBuilder.codeLoadingStart();
    this._logService.trace(`ExtensionService#loadModule [${mode}] -> ${module.toString(true)}`);
    this._logService.flush();
    const extensionId = extension?.identifier.value;
    if (extension) {
      await this._extHostLocalizationService.initializeLocalizedMessages(extension);
    }
    try {
      if (extensionId) {
        performance.mark(`code/extHost/willLoadExtensionCode/${extensionId}`);
      }
      if (mode === "esm") {
        r = await import(module.toString(true));
      } else {
        r = require2(module.fsPath);
      }
    } finally {
      if (extensionId) {
        performance.mark(`code/extHost/didLoadExtensionCode/${extensionId}`);
      }
      activationTimesBuilder.codeLoadingStop();
    }
    return r;
  }
  async _loadCommonJSModule(extension, module, activationTimesBuilder) {
    return this._doLoadModule(extension, module, activationTimesBuilder, "cjs");
  }
  async _loadESMModule(extension, module, activationTimesBuilder) {
    return this._doLoadModule(extension, module, activationTimesBuilder, "esm");
  }
  async $setRemoteEnvironment(env) {
    if (!this._initData.remote.isRemote) {
      return;
    }
    for (const key in env) {
      const value = env[key];
      if (value === null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
export {
  ExtHostExtensionService
};
