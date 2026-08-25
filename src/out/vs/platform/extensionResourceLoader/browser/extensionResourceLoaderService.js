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
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { IFileService } from "../../files/common/files.js";
import { FileAccess, Schemas } from "../../../base/common/network.js";
import { IProductService } from "../../product/common/productService.js";
import { IStorageService } from "../../storage/common/storage.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { ILogService } from "../../log/common/log.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { AbstractExtensionResourceLoaderService, IExtensionResourceLoaderService } from "../common/extensionResourceLoader.js";
import { IExtensionGalleryManifestService } from "../../extensionManagement/common/extensionGalleryManifest.js";
let ExtensionResourceLoaderService = class extends AbstractExtensionResourceLoaderService {
  constructor(fileService, storageService, productService, environmentService, configurationService, extensionGalleryManifestService, logService) {
    super(fileService, storageService, productService, environmentService, configurationService, extensionGalleryManifestService, logService);
  }
  async readExtensionResource(uri) {
    uri = FileAccess.uriToBrowserUri(uri);
    if (uri.scheme !== Schemas.http && uri.scheme !== Schemas.https && uri.scheme !== Schemas.data) {
      const result = await this._fileService.readFile(uri);
      return result.value.toString();
    }
    const requestInit = {};
    if (await this.isExtensionGalleryResource(uri)) {
      requestInit.headers = await this.getExtensionGalleryRequestHeaders();
      requestInit.mode = "cors";
    }
    const response = await fetch(uri.toString(true), requestInit);
    if (response.status !== 200) {
      this._logService.info(`Request to '${uri.toString(true)}' failed with status code ${response.status}`);
      throw new Error(response.statusText);
    }
    return response.text();
  }
};
ExtensionResourceLoaderService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IExtensionGalleryManifestService),
  __decorateParam(6, ILogService)
], ExtensionResourceLoaderService);
registerSingleton(IExtensionResourceLoaderService, ExtensionResourceLoaderService, InstantiationType.Delayed);
