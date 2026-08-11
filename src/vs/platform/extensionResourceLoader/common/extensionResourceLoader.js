import { isWeb } from "../../../base/common/platform.js";
import { format2 } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { getServiceMachineId } from "../../externalServices/common/serviceMachineId.js";
import { TelemetryLevel } from "../../telemetry/common/telemetry.js";
import { getTelemetryLevel, supportsTelemetry } from "../../telemetry/common/telemetryUtils.js";
import { RemoteAuthorities } from "../../../base/common/network.js";
import { TargetPlatform } from "../../extensions/common/extensions.js";
import { ExtensionGalleryResourceType, getExtensionGalleryManifestResourceUri } from "../../extensionManagement/common/extensionGalleryManifest.js";
import { Disposable } from "../../../base/common/lifecycle.js";
const WEB_EXTENSION_RESOURCE_END_POINT_SEGMENT = "/web-extension-resource/";
const IExtensionResourceLoaderService = createDecorator("extensionResourceLoaderService");
function migratePlatformSpecificExtensionGalleryResourceURL(resource, targetPlatform) {
  if (resource.query !== `target=${targetPlatform}`) {
    return void 0;
  }
  const paths = resource.path.split("/");
  if (!paths[3]) {
    return void 0;
  }
  paths[3] = `${paths[3]}+${targetPlatform}`;
  return resource.with({ query: null, path: paths.join("/") });
}
class AbstractExtensionResourceLoaderService extends Disposable {
  constructor(_fileService, _storageService, _productService, _environmentService, _configurationService, _extensionGalleryManifestService, _logService) {
    super();
    this._fileService = _fileService;
    this._storageService = _storageService;
    this._productService = _productService;
    this._environmentService = _environmentService;
    this._configurationService = _configurationService;
    this._extensionGalleryManifestService = _extensionGalleryManifestService;
    this._logService = _logService;
    this._initPromise = this._init();
  }
  async _init() {
    try {
      const manifest = await this._extensionGalleryManifestService.getExtensionGalleryManifest();
      this.resolve(manifest);
      this._register(this._extensionGalleryManifestService.onDidChangeExtensionGalleryManifest(() => this.resolve(manifest)));
    } catch (error) {
      this._logService.error(error);
    }
  }
  resolve(manifest) {
    this._extensionGalleryResourceUrlTemplate = manifest ? getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ExtensionResourceUri) : void 0;
    this._extensionGalleryAuthority = this._extensionGalleryResourceUrlTemplate ? this._getExtensionGalleryAuthority(URI.parse(this._extensionGalleryResourceUrlTemplate)) : void 0;
  }
  async supportsExtensionGalleryResources() {
    await this._initPromise;
    return this._extensionGalleryResourceUrlTemplate !== void 0;
  }
  async getExtensionGalleryResourceURL({ publisher, name, version, targetPlatform }, path) {
    await this._initPromise;
    if (this._extensionGalleryResourceUrlTemplate) {
      const uri = URI.parse(format2(this._extensionGalleryResourceUrlTemplate, {
        publisher,
        name,
        version: targetPlatform !== void 0 && targetPlatform !== TargetPlatform.UNDEFINED && targetPlatform !== TargetPlatform.UNKNOWN && targetPlatform !== TargetPlatform.UNIVERSAL ? `${version}+${targetPlatform}` : version,
        path: "extension"
      }));
      return this._isWebExtensionResourceEndPoint(uri) ? uri.with({ scheme: RemoteAuthorities.getPreferredWebSchema() }) : uri;
    }
    return void 0;
  }
  async isExtensionGalleryResource(uri) {
    await this._initPromise;
    return !!this._extensionGalleryAuthority && this._extensionGalleryAuthority === this._getExtensionGalleryAuthority(uri);
  }
  async getExtensionGalleryRequestHeaders() {
    const headers = {
      "X-Client-Name": `${this._productService.applicationName}${isWeb ? "-web" : ""}`,
      "X-Client-Version": this._productService.version
    };
    if (supportsTelemetry(this._productService, this._environmentService) && getTelemetryLevel(this._configurationService) === TelemetryLevel.USAGE) {
      headers["X-Machine-Id"] = await this._getServiceMachineId();
    }
    if (this._productService.commit) {
      headers["X-Client-Commit"] = this._productService.commit;
    }
    return headers;
  }
  _getServiceMachineId() {
    if (!this._serviceMachineIdPromise) {
      this._serviceMachineIdPromise = getServiceMachineId(this._environmentService, this._fileService, this._storageService);
    }
    return this._serviceMachineIdPromise;
  }
  _getExtensionGalleryAuthority(uri) {
    if (this._isWebExtensionResourceEndPoint(uri)) {
      return uri.authority;
    }
    const index = uri.authority.indexOf(".");
    return index !== -1 ? uri.authority.substring(index + 1) : void 0;
  }
  _isWebExtensionResourceEndPoint(uri) {
    const uriPath = uri.path, serverRootPath = RemoteAuthorities.getServerRootPath();
    return uriPath.startsWith(serverRootPath) && uriPath.startsWith(WEB_EXTENSION_RESOURCE_END_POINT_SEGMENT, serverRootPath.length);
  }
}
export {
  AbstractExtensionResourceLoaderService,
  IExtensionResourceLoaderService,
  migratePlatformSpecificExtensionGalleryResourceURL
};
