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
import { IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
import { ExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifestService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
let WebExtensionGalleryManifestService = class extends ExtensionGalleryManifestService {
  constructor(productService, remoteAgentService) {
    super(productService);
    const remoteConnection = remoteAgentService.getConnection();
    if (remoteConnection) {
      const channel = remoteConnection.getChannel("extensionGalleryManifest");
      this.getExtensionGalleryManifest().then((manifest) => {
        channel.call("setExtensionGalleryManifest", [manifest]);
        this._register(this.onDidChangeExtensionGalleryManifest((manifest2) => channel.call("setExtensionGalleryManifest", [manifest2])));
      });
    }
  }
};
WebExtensionGalleryManifestService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IRemoteAgentService)
], WebExtensionGalleryManifestService);
registerSingleton(IExtensionGalleryManifestService, WebExtensionGalleryManifestService, InstantiationType.Delayed);
