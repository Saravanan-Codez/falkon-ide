var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { randomPort } from "../../../../base/common/ports.js";
import * as nls from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { IExtensionHostDebugService } from "../../../../platform/debug/common/extensionHostDebug.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ActiveEditorContext } from "../../../common/contextkeys.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { ExtensionHostKind } from "../../../services/extensions/common/extensionHostKind.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IDebugService } from "../../debug/common/debug.js";
import { RuntimeExtensionsEditor } from "./runtimeExtensionsEditor.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
async function getExtensionHostPort(extensionService, nativeHostService, dialogService, productService) {
  const inspectPorts = await extensionService.getInspectPorts(ExtensionHostKind.LocalProcess, false);
  if (inspectPorts.length === 0) {
    const res = await dialogService.confirm({
      message: nls.localize("restart1", "Debug Extensions"),
      detail: nls.localize("restart2", "In order to debug extensions a restart is required. Do you want to restart '{0}' now?", productService.nameLong),
      primaryButton: nls.localize({ key: "restart3", comment: ["&& denotes a mnemonic"] }, "&&Restart")
    });
    if (res.confirmed) {
      await nativeHostService.relaunch({ addArgs: [`--inspect-extensions=${randomPort()}`] });
    }
    return void 0;
  }
  if (inspectPorts.length > 1) {
    console.warn(`There are multiple extension hosts available for debugging. Picking the first one...`);
  }
  return inspectPorts[0].port;
}
async function getRendererDebugPort(extensionHostDebugService, windowId) {
  const result = await extensionHostDebugService.attachToCurrentWindowRenderer(windowId);
  return result.success ? result.port : void 0;
}
class DebugExtensionHostInDevToolsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.extensions.action.devtoolsExtensionHost",
      title: nls.localize2("openDevToolsForExtensionHost", "Debug Extension Host In Dev Tools"),
      category: Categories.Developer,
      f1: true,
      icon: Codicon.debugStart
    });
  }
  async run(accessor) {
    const extensionService = accessor.get(IExtensionService);
    const nativeHostService = accessor.get(INativeHostService);
    const quickInputService = accessor.get(IQuickInputService);
    const inspectPorts = await extensionService.getInspectPorts(ExtensionHostKind.LocalProcess, true);
    if (inspectPorts.length === 0) {
      console.log("[devtoolsExtensionHost] No extension host inspect ports found.");
      return;
    }
    const items = inspectPorts.filter((portInfo) => portInfo.devtoolsUrl).map((portInfo) => ({
      label: portInfo.devtoolsLabel ?? `${portInfo.host}:${portInfo.port}`,
      detail: `${portInfo.host}:${portInfo.port}`,
      portInfo
    }));
    if (items.length === 1) {
      const portInfo = items[0].portInfo;
      nativeHostService.openDevToolsWindow(portInfo.devtoolsUrl);
      return;
    }
    const selected = await quickInputService.pick(items, {
      placeHolder: nls.localize("selectExtensionHost", "Pick extension host"),
      matchOnDetail: true
    });
    if (selected) {
      const portInfo = selected.portInfo;
      nativeHostService.openDevToolsWindow(portInfo.devtoolsUrl);
    }
  }
}
class DebugExtensionHostInNewWindowAction extends Action2 {
  constructor() {
    super({
      id: "workbench.extensions.action.debugExtensionHost",
      title: nls.localize2("debugExtensionHost", "Debug Extension Host In New Window"),
      category: Categories.Developer,
      f1: true,
      icon: Codicon.debugStart,
      menu: {
        id: MenuId.EditorTitle,
        when: ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID),
        group: "navigation"
      }
    });
  }
  async run(accessor) {
    const extensionService = accessor.get(IExtensionService);
    const nativeHostService = accessor.get(INativeHostService);
    const dialogService = accessor.get(IDialogService);
    const productService = accessor.get(IProductService);
    const instantiationService = accessor.get(IInstantiationService);
    const hostService = accessor.get(IHostService);
    const port = await getExtensionHostPort(extensionService, nativeHostService, dialogService, productService);
    if (port === void 0) {
      return;
    }
    const storage = instantiationService.createInstance(Storage);
    storage.storeDebugOnNewWindow(port);
    hostService.openWindow();
  }
}
class DebugRendererInNewWindowAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.debugRenderer",
      title: nls.localize2("debugRenderer", "Debug Renderer In New Window"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const extensionHostDebugService = accessor.get(IExtensionHostDebugService);
    const environmentService = accessor.get(INativeWorkbenchEnvironmentService);
    const instantiationService = accessor.get(IInstantiationService);
    const hostService = accessor.get(IHostService);
    const port = await getRendererDebugPort(extensionHostDebugService, environmentService.window.id);
    if (port === void 0) {
      return;
    }
    const storage = instantiationService.createInstance(Storage);
    storage.storeRendererDebugOnNewWindow(port);
    hostService.openWindow({ remoteAuthority: null });
  }
}
class DebugExtensionHostAndRendererAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.debugExtensionHostAndRenderer",
      title: nls.localize2("debugExtensionHostAndRenderer", "Debug Extension Host and Renderer In New Window"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const extensionService = accessor.get(IExtensionService);
    const nativeHostService = accessor.get(INativeHostService);
    const dialogService = accessor.get(IDialogService);
    const productService = accessor.get(IProductService);
    const extensionHostDebugService = accessor.get(IExtensionHostDebugService);
    const environmentService = accessor.get(INativeWorkbenchEnvironmentService);
    const instantiationService = accessor.get(IInstantiationService);
    const hostService = accessor.get(IHostService);
    const [extHostPort, rendererPort] = await Promise.all([
      getExtensionHostPort(extensionService, nativeHostService, dialogService, productService),
      getRendererDebugPort(extensionHostDebugService, environmentService.window.id)
    ]);
    if (extHostPort === void 0 || rendererPort === void 0) {
      return;
    }
    const storage = instantiationService.createInstance(Storage);
    storage.storeDebugOnNewWindow(extHostPort);
    storage.storeRendererDebugOnNewWindow(rendererPort);
    hostService.openWindow({ remoteAuthority: null });
  }
}
let Storage = class {
  constructor(_storageService) {
    this._storageService = _storageService;
  }
  storeDebugOnNewWindow(targetPort) {
    this._storageService.store("debugExtensionHost.debugPort", targetPort, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  getAndDeleteDebugPortIfSet() {
    const port = this._storageService.getNumber("debugExtensionHost.debugPort", StorageScope.APPLICATION);
    if (port !== void 0) {
      this._storageService.remove("debugExtensionHost.debugPort", StorageScope.APPLICATION);
    }
    return port;
  }
  storeRendererDebugOnNewWindow(targetPort) {
    this._storageService.store("debugRenderer.debugPort", targetPort, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  getAndDeleteRendererDebugPortIfSet() {
    const port = this._storageService.getNumber("debugRenderer.debugPort", StorageScope.APPLICATION);
    if (port !== void 0) {
      this._storageService.remove("debugRenderer.debugPort", StorageScope.APPLICATION);
    }
    return port;
  }
};
Storage = __decorateClass([
  __decorateParam(0, IStorageService)
], Storage);
const defaultDebugConfig = {
  trace: true,
  resolveSourceMapLocations: null,
  eagerSources: true,
  timeouts: {
    sourceMapMinPause: 3e4,
    sourceMapCumulativePause: 3e5
  }
};
let DebugExtensionsContribution = class extends Disposable {
  constructor(_debugService, _instantiationService, _progressService) {
    super();
    this._debugService = _debugService;
    this._instantiationService = _instantiationService;
    const storage = this._instantiationService.createInstance(Storage);
    const extHostPort = storage.getAndDeleteDebugPortIfSet();
    const rendererPort = storage.getAndDeleteRendererDebugPortIfSet();
    const debugPromises = [];
    if (extHostPort !== void 0) {
      debugPromises.push(_progressService.withProgress({
        location: ProgressLocation.Notification,
        title: nls.localize("debugExtensionHost.progress", "Attaching Debugger To Extension Host")
      }, async () => {
        await this._debugService.startDebugging(void 0, {
          type: "node",
          name: nls.localize("debugExtensionHost.launch.name", "Attach Extension Host"),
          request: "attach",
          port: extHostPort,
          ...defaultDebugConfig
        });
      }));
    }
    if (rendererPort !== void 0) {
      debugPromises.push(_progressService.withProgress({
        location: ProgressLocation.Notification,
        title: nls.localize("debugRenderer.progress", "Attaching Debugger To Renderer")
      }, async () => {
        await this._debugService.startDebugging(void 0, {
          type: "chrome",
          name: nls.localize("debugRenderer.launch.name", "Attach Renderer"),
          request: "attach",
          port: rendererPort,
          ...defaultDebugConfig
        });
      }));
    }
    Promise.all(debugPromises);
  }
};
DebugExtensionsContribution = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IProgressService)
], DebugExtensionsContribution);
export {
  DebugExtensionHostAndRendererAction,
  DebugExtensionHostInDevToolsAction,
  DebugExtensionHostInNewWindowAction,
  DebugExtensionsContribution,
  DebugRendererInNewWindowAction
};
