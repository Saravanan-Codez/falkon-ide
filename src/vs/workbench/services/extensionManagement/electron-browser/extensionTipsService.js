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
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ISharedProcessService } from "../../../../platform/ipc/electron-browser/services.js";
import { IExtensionTipsService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionTipsService } from "../../../../platform/extensionManagement/common/extensionTipsService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Schemas } from "../../../../base/common/network.js";
let NativeExtensionTipsService = class extends ExtensionTipsService {
  constructor(fileService, productService, sharedProcessService) {
    super(fileService, productService);
    this.channel = sharedProcessService.getChannel("extensionTipsService");
  }
  getConfigBasedTips(folder) {
    if (folder.scheme === Schemas.file) {
      return this.channel.call("getConfigBasedTips", [folder]);
    }
    return super.getConfigBasedTips(folder);
  }
  getImportantExecutableBasedTips() {
    return this.channel.call("getImportantExecutableBasedTips");
  }
  getOtherExecutableBasedTips() {
    return this.channel.call("getOtherExecutableBasedTips");
  }
};
NativeExtensionTipsService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IProductService),
  __decorateParam(2, ISharedProcessService)
], NativeExtensionTipsService);
registerSingleton(IExtensionTipsService, NativeExtensionTipsService, InstantiationType.Delayed);
