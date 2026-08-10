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
import { getDelayedChannel, ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { arch, platform } from "../../../../base/common/process.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ILocalTranscriptionService, localTranscriptionChannelName } from "../../../../platform/localTranscription/common/localTranscription.js";
import { IUtilityProcessWorkerWorkbenchService } from "../../utilityProcess/electron-browser/utilityProcessWorkerWorkbenchService.js";
const SUPPORTED_TARGETS = /* @__PURE__ */ new Set([
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
  "win32-arm64"
]);
function isOnDeviceTranscriptionSupported() {
  return !!platform && !!arch && SUPPORTED_TARGETS.has(`${platform}-${arch}`);
}
let LocalTranscriptionService = class {
  constructor(utilityProcessWorkerWorkbenchService, configurationService, productService) {
    this.utilityProcessWorkerWorkbenchService = utilityProcessWorkerWorkbenchService;
    this.configurationService = configurationService;
    this.productService = productService;
    this.isSupported = isOnDeviceTranscriptionSupported();
  }
  _getChannel() {
    if (!this._channel) {
      this._channel = getDelayedChannel((async () => {
        const { client } = await this.utilityProcessWorkerWorkbenchService.createWorker({
          moduleId: "vs/platform/localTranscription/node/localTranscriptionMain",
          type: "localTranscription",
          name: "local-transcription",
          // The on-device dictation runtime is downloaded from our CDN and its
          // native addon (foundry_local_napi.node) is signed by a third party,
          // so on macOS it must load in the plugin helper (library validation
          // disabled) to avoid a Team ID mismatch dlopen failure.
          allowLoadingUnsignedLibraries: true
        });
        return client.getChannel(localTranscriptionChannelName);
      })());
    }
    return this._channel;
  }
  _getProxy() {
    if (!this._proxy) {
      this._proxy = ProxyChannel.toService(this._getChannel(), { disableMarshalling: true });
    }
    return this._proxy;
  }
  get onDidChangeModelStatus() {
    return this._getProxy().onDidChangeModelStatus;
  }
  get onDidTranscribe() {
    return this._getProxy().onDidTranscribe;
  }
  getModelStatus() {
    return this._getProxy().getModelStatus();
  }
  importModel(options) {
    return this._getProxy().importModel(options);
  }
  start(options) {
    const { proxyUrl, noProxy, proxyStrictSSL, proxyAuthorization } = this._resolveProxyConfig();
    const runtime = this.productService.dictationRuntime;
    return this._getProxy().start({
      cacheDir: options.cacheDir,
      model: options.model,
      language: options.language,
      proxyUrl,
      noProxy,
      proxyStrictSSL,
      proxyAuthorization,
      runtimeUrlTemplate: runtime?.urlTemplate,
      runtimeVersion: runtime?.version
    });
  }
  pushAudio(chunk) {
    return this._getProxy().pushAudio(chunk);
  }
  stop() {
    return this._getProxy().stop();
  }
  cancel() {
    return this._getProxy().cancel();
  }
  /**
   * Read VS Code's `http.proxy`/`http.noProxy`/`http.proxyStrictSSL`/
   * `http.proxyAuthorization` settings so the utility process can honor a proxy
   * configured only in VS Code (not in the OS environment). Returns empty values
   * when unset, in which case the process's inherited environment proxy still
   * applies and TLS verification stays on.
   */
  _resolveProxyConfig() {
    const proxyUrl = this.configurationService.getValue("http.proxy")?.trim() || void 0;
    const noProxyList = this.configurationService.getValue("http.noProxy");
    const noProxy = Array.isArray(noProxyList) && noProxyList.length ? noProxyList.join(",") : void 0;
    const strictSSL = this.configurationService.getValue("http.proxyStrictSSL");
    const proxyStrictSSL = strictSSL === false ? false : void 0;
    const proxyAuthorization = this.configurationService.getValue("http.proxyAuthorization")?.trim() || void 0;
    return { proxyUrl, noProxy, proxyStrictSSL, proxyAuthorization };
  }
};
LocalTranscriptionService = __decorateClass([
  __decorateParam(0, IUtilityProcessWorkerWorkbenchService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IProductService)
], LocalTranscriptionService);
registerSingleton(ILocalTranscriptionService, LocalTranscriptionService, InstantiationType.Delayed);
export {
  LocalTranscriptionService
};
