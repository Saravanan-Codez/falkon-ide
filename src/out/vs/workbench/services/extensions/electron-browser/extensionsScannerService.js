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
import { URI } from "../../../../base/common/uri.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IExtensionsProfileScannerService } from "../../../../platform/extensionManagement/common/extensionsProfileScannerService.js";
import { IExtensionsScannerService, NativeExtensionsScannerService } from "../../../../platform/extensionManagement/common/extensionsScannerService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
let ExtensionsScannerService = class extends NativeExtensionsScannerService {
  constructor(userDataProfileService, userDataProfilesService, extensionsProfileScannerService, fileService, logService, environmentService, productService, uriIdentityService, instantiationService) {
    super(
      URI.file(environmentService.builtinExtensionsPath),
      URI.file(environmentService.extensionsPath),
      environmentService.userHome,
      userDataProfileService.currentProfile,
      userDataProfilesService,
      extensionsProfileScannerService,
      fileService,
      logService,
      environmentService,
      productService,
      uriIdentityService,
      instantiationService
    );
  }
};
ExtensionsScannerService = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IExtensionsProfileScannerService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService),
  __decorateParam(5, INativeEnvironmentService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IUriIdentityService),
  __decorateParam(8, IInstantiationService)
], ExtensionsScannerService);
registerSingleton(IExtensionsScannerService, ExtensionsScannerService, InstantiationType.Delayed);
export {
  ExtensionsScannerService
};
