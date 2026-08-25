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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IExtensionGalleryService, IGlobalExtensionEnablementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionStorageService, IExtensionStorageService } from "../../../../platform/extensionManagement/common/extensionStorage.js";
import { migrateUnsupportedExtensions } from "../../../../platform/extensionManagement/common/unsupportedExtensionsMigration.js";
import { INativeServerExtensionManagementService } from "../../../../platform/extensionManagement/node/extensionManagementService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
let ExtensionsContributions = class extends Disposable {
  constructor(extensionManagementService, extensionGalleryService, extensionStorageService, extensionEnablementService, userDataProfilesService, storageService, logService) {
    super();
    this.extensionManagementService = extensionManagementService;
    this.extensionGalleryService = extensionGalleryService;
    this.extensionStorageService = extensionStorageService;
    this.extensionEnablementService = extensionEnablementService;
    this.userDataProfilesService = userDataProfilesService;
    this.logService = logService;
    extensionManagementService.cleanUp().catch((error) => logService.error("Error while cleaning up extensions", error));
    this.migrateUnsupportedExtensions().catch((error) => logService.error("Error while migrating unsupported extensions", error));
    ExtensionStorageService.removeOutdatedExtensionVersions(extensionManagementService, storageService);
  }
  async migrateUnsupportedExtensions() {
    for (const profile of this.userDataProfilesService.profiles) {
      await migrateUnsupportedExtensions(profile, this.extensionManagementService, this.extensionGalleryService, this.extensionStorageService, this.extensionEnablementService, this.logService);
    }
  }
};
ExtensionsContributions = __decorateClass([
  __decorateParam(0, INativeServerExtensionManagementService),
  __decorateParam(1, IExtensionGalleryService),
  __decorateParam(2, IExtensionStorageService),
  __decorateParam(3, IGlobalExtensionEnablementService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ILogService)
], ExtensionsContributions);
export {
  ExtensionsContributions
};
