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
import { URI } from "../../../base/common/uri.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { IExtensionsProfileScannerService } from "../common/extensionsProfileScannerService.js";
import { NativeExtensionsScannerService } from "../common/extensionsScannerService.js";
import { IFileService } from "../../files/common/files.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
let ExtensionsScannerService = class extends NativeExtensionsScannerService {
  constructor(userDataProfilesService, extensionsProfileScannerService, fileService, logService, environmentService, productService, uriIdentityService, instantiationService) {
    super(
      URI.file(environmentService.builtinExtensionsPath),
      URI.file(environmentService.extensionsPath),
      environmentService.userHome,
      userDataProfilesService.defaultProfile,
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
  __decorateParam(0, IUserDataProfilesService),
  __decorateParam(1, IExtensionsProfileScannerService),
  __decorateParam(2, IFileService),
  __decorateParam(3, ILogService),
  __decorateParam(4, INativeEnvironmentService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, IInstantiationService)
], ExtensionsScannerService);
export {
  ExtensionsScannerService
};
