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
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ISharedProcessService } from "../../../../platform/ipc/electron-browser/services.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { IMcpGalleryManifestService } from "../../../../platform/mcp/common/mcpGalleryManifest.js";
import { WorkbenchMcpGalleryManifestService } from "../browser/mcpGalleryManifestService.js";
let McpGalleryManifestService = class extends WorkbenchMcpGalleryManifestService {
  constructor(productService, remoteAgentService, requestService, logService, sharedProcessService, configurationService) {
    super(productService, remoteAgentService, requestService, logService, configurationService);
    const channel = sharedProcessService.getChannel("mcpGalleryManifest");
    this.getMcpGalleryManifest().then((manifest) => {
      channel.call("setMcpGalleryManifest", [manifest]);
      this._register(this.onDidChangeMcpGalleryManifest((manifest2) => channel.call("setMcpGalleryManifest", [manifest2])));
    });
  }
};
McpGalleryManifestService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IRequestService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ISharedProcessService),
  __decorateParam(5, IConfigurationService)
], McpGalleryManifestService);
registerSingleton(IMcpGalleryManifestService, McpGalleryManifestService, InstantiationType.Eager);
export {
  McpGalleryManifestService
};
