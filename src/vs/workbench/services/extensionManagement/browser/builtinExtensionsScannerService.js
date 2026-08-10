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
import { IBuiltinExtensionsScannerService, ExtensionType, TargetPlatform } from "../../../../platform/extensions/common/extensions.js";
import { isWeb, Language } from "../../../../base/common/platform.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { getGalleryExtensionId } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { builtinExtensionsPath, FileAccess } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { localizeManifest } from "../../../../platform/extensionManagement/common/extensionNls.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { mainWindow } from "../../../../base/browser/window.js";
let BuiltinExtensionsScannerService = class {
  constructor(environmentService, uriIdentityService, extensionResourceLoaderService, productService, logService) {
    this.extensionResourceLoaderService = extensionResourceLoaderService;
    this.logService = logService;
    this.builtinExtensionsPromises = [];
    if (isWeb) {
      const nlsBaseUrl = productService.extensionsGallery?.nlsBaseUrl;
      if (nlsBaseUrl && productService.commit && !Language.isDefaultVariant()) {
        this.nlsUrl = URI.joinPath(URI.parse(nlsBaseUrl), productService.commit, productService.version, Language.value());
      }
      const builtinExtensionsServiceUrl = FileAccess.asBrowserUri(builtinExtensionsPath);
      if (builtinExtensionsServiceUrl) {
        let bundledExtensions = [];
        if (environmentService.isBuilt) {
          bundledExtensions = [
            /*BUILD->INSERT_BUILTIN_EXTENSIONS*/
          ];
        } else {
          const builtinExtensionsElement = mainWindow.document.getElementById("vscode-workbench-builtin-extensions");
          const builtinExtensionsElementAttribute = builtinExtensionsElement ? builtinExtensionsElement.getAttribute("data-settings") : void 0;
          if (builtinExtensionsElementAttribute) {
            try {
              bundledExtensions = JSON.parse(builtinExtensionsElementAttribute);
            } catch (error) {
            }
          }
        }
        this.builtinExtensionsPromises = bundledExtensions.map(async (e) => {
          const id = getGalleryExtensionId(e.packageJSON.publisher, e.packageJSON.name);
          return {
            identifier: { id },
            location: uriIdentityService.extUri.joinPath(builtinExtensionsServiceUrl, e.extensionPath),
            type: ExtensionType.System,
            isBuiltin: true,
            manifest: e.packageNLS ? await this.localizeManifest(id, e.packageJSON, e.packageNLS) : e.packageJSON,
            readmeUrl: e.readmePath ? uriIdentityService.extUri.joinPath(builtinExtensionsServiceUrl, e.readmePath) : void 0,
            changelogUrl: e.changelogPath ? uriIdentityService.extUri.joinPath(builtinExtensionsServiceUrl, e.changelogPath) : void 0,
            targetPlatform: TargetPlatform.WEB,
            validations: [],
            isValid: true,
            preRelease: false
          };
        });
      }
    }
  }
  async scanBuiltinExtensions() {
    return [...await Promise.all(this.builtinExtensionsPromises)];
  }
  async localizeManifest(extensionId, manifest, fallbackTranslations) {
    if (!this.nlsUrl) {
      return localizeManifest(this.logService, manifest, fallbackTranslations);
    }
    const uri = URI.joinPath(this.nlsUrl, extensionId, "package");
    try {
      const res = await this.extensionResourceLoaderService.readExtensionResource(uri);
      const json = JSON.parse(res.toString());
      return localizeManifest(this.logService, manifest, json, fallbackTranslations);
    } catch (e) {
      this.logService.error(e);
      return localizeManifest(this.logService, manifest, fallbackTranslations);
    }
  }
};
BuiltinExtensionsScannerService = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IExtensionResourceLoaderService),
  __decorateParam(3, IProductService),
  __decorateParam(4, ILogService)
], BuiltinExtensionsScannerService);
registerSingleton(IBuiltinExtensionsScannerService, BuiltinExtensionsScannerService, InstantiationType.Delayed);
export {
  BuiltinExtensionsScannerService
};
