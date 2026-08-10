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
import { ExtensionRecommendations } from "./extensionRecommendations.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ExtensionRecommendationReason } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { localize } from "../../../../nls.js";
import { IExtensionManagementServerService } from "../../../services/extensionManagement/common/extensionManagement.js";
let WebRecommendations = class extends ExtensionRecommendations {
  constructor(productService, extensionManagementServerService) {
    super();
    this.productService = productService;
    this.extensionManagementServerService = extensionManagementServerService;
    this._recommendations = [];
  }
  get recommendations() {
    return this._recommendations;
  }
  async doActivate() {
    const isOnlyWeb = this.extensionManagementServerService.webExtensionManagementServer && !this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer;
    if (isOnlyWeb && Array.isArray(this.productService.webExtensionTips)) {
      this._recommendations = this.productService.webExtensionTips.map((extensionId) => ({
        extension: extensionId.toLowerCase(),
        reason: {
          reasonId: ExtensionRecommendationReason.Application,
          reasonText: localize("reason", "This extension is recommended for {0} for the Web", this.productService.nameLong)
        }
      }));
    }
  }
};
WebRecommendations = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IExtensionManagementServerService)
], WebRecommendations);
export {
  WebRecommendations
};
