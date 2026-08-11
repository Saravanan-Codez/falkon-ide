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
import { generateUuid } from "../../../../base/common/uuid.js";
import { IExtensionGalleryService, IAllowedExtensionsService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionManagementService as BaseExtensionManagementService } from "../common/extensionManagementService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IExtensionManagementServerService, IWorkbenchExtensionManagementService } from "../common/extensionManagement.js";
import { Schemas } from "../../../../base/common/network.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDownloadService } from "../../../../platform/download/common/download.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { joinPath } from "../../../../base/common/resources.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IExtensionManifestPropertiesService } from "../../extensions/common/extensionManifestPropertiesService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { IExtensionsScannerService } from "../../../../platform/extensionManagement/common/extensionsScannerService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let ExtensionManagementService = class extends BaseExtensionManagementService {
  constructor(environmentService, extensionManagementServerService, extensionGalleryService, userDataProfileService, userDataProfilesService, configurationService, productService, downloadService, userDataSyncEnablementService, dialogService, workspaceTrustRequestService, extensionManifestPropertiesService, fileService, logService, instantiationService, extensionsScannerService, allowedExtensionsService, storageService, telemetryService) {
    super(
      extensionManagementServerService,
      extensionGalleryService,
      userDataProfileService,
      userDataProfilesService,
      configurationService,
      productService,
      downloadService,
      userDataSyncEnablementService,
      dialogService,
      workspaceTrustRequestService,
      extensionManifestPropertiesService,
      fileService,
      logService,
      instantiationService,
      extensionsScannerService,
      allowedExtensionsService,
      storageService,
      telemetryService
    );
    this.environmentService = environmentService;
  }
  async installVSIXInServer(vsix, server, options) {
    if (vsix.scheme === Schemas.vscodeRemote && server === this.extensionManagementServerService.localExtensionManagementServer) {
      const downloadedLocation = joinPath(this.environmentService.tmpDir, generateUuid());
      await this.downloadService.download(vsix, downloadedLocation, "extensionManagement.downloadRemoteVsix");
      vsix = downloadedLocation;
    }
    return super.installVSIXInServer(vsix, server, options);
  }
};
ExtensionManagementService = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, IExtensionGalleryService),
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IDownloadService),
  __decorateParam(8, IUserDataSyncEnablementService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, IWorkspaceTrustRequestService),
  __decorateParam(11, IExtensionManifestPropertiesService),
  __decorateParam(12, IFileService),
  __decorateParam(13, ILogService),
  __decorateParam(14, IInstantiationService),
  __decorateParam(15, IExtensionsScannerService),
  __decorateParam(16, IAllowedExtensionsService),
  __decorateParam(17, IStorageService),
  __decorateParam(18, ITelemetryService)
], ExtensionManagementService);
registerSingleton(IWorkbenchExtensionManagementService, ExtensionManagementService, InstantiationType.Delayed);
export {
  ExtensionManagementService
};
