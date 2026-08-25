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
import { IExtensionGalleryService, IGlobalExtensionEnablementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IExtensionStorageService } from "../../../../platform/extensionManagement/common/extensionStorage.js";
import { migrateUnsupportedExtensions } from "../../../../platform/extensionManagement/common/unsupportedExtensionsMigration.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IExtensionManagementServerService } from "../../../services/extensionManagement/common/extensionManagement.js";
let UnsupportedExtensionsMigrationContrib = class {
  constructor(extensionManagementServerService, extensionGalleryService, extensionStorageService, extensionEnablementService, logService) {
    if (extensionManagementServerService.remoteExtensionManagementServer) {
      migrateUnsupportedExtensions(void 0, extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService, extensionGalleryService, extensionStorageService, extensionEnablementService, logService);
    }
    if (extensionManagementServerService.webExtensionManagementServer) {
      migrateUnsupportedExtensions(void 0, extensionManagementServerService.webExtensionManagementServer.extensionManagementService, extensionGalleryService, extensionStorageService, extensionEnablementService, logService);
    }
  }
};
UnsupportedExtensionsMigrationContrib = __decorateClass([
  __decorateParam(0, IExtensionManagementServerService),
  __decorateParam(1, IExtensionGalleryService),
  __decorateParam(2, IExtensionStorageService),
  __decorateParam(3, IGlobalExtensionEnablementService),
  __decorateParam(4, ILogService)
], UnsupportedExtensionsMigrationContrib);
export {
  UnsupportedExtensionsMigrationContrib
};
