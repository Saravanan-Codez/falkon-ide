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
import { BrowserWindow } from "electron";
import { Limiter } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
import { IAgentNetworkFilterService } from "../../networkFilter/common/networkFilterService.js";
import { isURLDomainTrusted } from "../../url/common/trustedDomains.js";
import { WebContentCache } from "./webContentCache.js";
import { WebPageLoader } from "./webPageLoader.js";
let NativeWebContentExtractorService = class extends Disposable {
  constructor(_logger, _agentNetworkFilterService) {
    super();
    this._logger = _logger;
    this._agentNetworkFilterService = _agentNetworkFilterService;
    // Only allow 3 windows to be opened at a time
    // to avoid overwhelming the system with too many processes.
    this._limiter = new Limiter(3);
    this._webContentsCache = new WebContentCache();
    this._register(this._agentNetworkFilterService.onDidChange(() => this._webContentsCache.clear()));
  }
  extract(uris, options) {
    if (uris.length === 0) {
      this._logger.info("No URIs provided for extraction");
      return Promise.resolve([]);
    }
    this._logger.info(`Extracting content from ${uris.length} URIs`);
    return Promise.all(uris.map((uri) => this._limiter.queue(() => this.doExtract(uri, options))));
  }
  async doExtract(uri, options) {
    const cached = this._webContentsCache.tryGet(uri, options);
    if (cached !== void 0) {
      this._logger.info(`Found cached content for ${uri.toString()}`);
      return cached;
    }
    const loader = new WebPageLoader(
      (options2) => new BrowserWindow(options2),
      this._logger,
      uri,
      options,
      (uri2) => isURLDomainTrusted(uri2, options?.trustedDomains || []),
      this._agentNetworkFilterService
    );
    try {
      const result = await loader.load();
      this._webContentsCache.add(uri, options, result);
      return result;
    } finally {
      loader.dispose();
    }
  }
};
NativeWebContentExtractorService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IAgentNetworkFilterService)
], NativeWebContentExtractorService);
export {
  NativeWebContentExtractorService
};
