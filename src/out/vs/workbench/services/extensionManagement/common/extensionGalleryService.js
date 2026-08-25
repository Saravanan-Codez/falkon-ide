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
import { IAllowedExtensionsService, IExtensionGalleryService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { AbstractExtensionGalleryService } from "../../../../platform/extensionManagement/common/extensionGalleryService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
let WorkbenchExtensionGalleryService = class extends AbstractExtensionGalleryService {
  constructor(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
    super(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService);
  }
};
WorkbenchExtensionGalleryService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAllowedExtensionsService),
  __decorateParam(9, IExtensionGalleryManifestService)
], WorkbenchExtensionGalleryService);
registerSingleton(IExtensionGalleryService, WorkbenchExtensionGalleryService, InstantiationType.Delayed);
export {
  WorkbenchExtensionGalleryService
};
