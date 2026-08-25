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
import { joinPath } from "../../base/common/resources.js";
import { URI } from "../../base/common/uri.js";
import { INativeEnvironmentService } from "../../platform/environment/common/environment.js";
import { IExtensionsProfileScannerService } from "../../platform/extensionManagement/common/extensionsProfileScannerService.js";
import { AbstractExtensionsScannerService } from "../../platform/extensionManagement/common/extensionsScannerService.js";
import { IFileService } from "../../platform/files/common/files.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../platform/log/common/log.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { IUriIdentityService } from "../../platform/uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../platform/userDataProfile/common/userDataProfile.js";
import { getNLSConfiguration } from "./remoteLanguagePacks.js";
let ExtensionsScannerService = class extends AbstractExtensionsScannerService {
  constructor(userDataProfilesService, extensionsProfileScannerService, fileService, logService, nativeEnvironmentService, productService, uriIdentityService, instantiationService) {
    super(
      URI.file(nativeEnvironmentService.builtinExtensionsPath),
      URI.file(nativeEnvironmentService.extensionsPath),
      joinPath(nativeEnvironmentService.userHome, ".vscode-oss-dev", "extensions", "control.json"),
      userDataProfilesService.defaultProfile,
      userDataProfilesService,
      extensionsProfileScannerService,
      fileService,
      logService,
      nativeEnvironmentService,
      productService,
      uriIdentityService,
      instantiationService
    );
    this.nativeEnvironmentService = nativeEnvironmentService;
  }
  async getTranslations(language) {
    const config = await getNLSConfiguration(language, this.nativeEnvironmentService.userDataPath);
    if (config.languagePack) {
      try {
        const content = await this.fileService.readFile(URI.file(config.languagePack.translationsConfigFile));
        return JSON.parse(content.value.toString());
      } catch (err) {
      }
    }
    return /* @__PURE__ */ Object.create(null);
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
