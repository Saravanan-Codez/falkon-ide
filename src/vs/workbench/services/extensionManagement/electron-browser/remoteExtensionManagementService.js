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
import { IExtensionGalleryService, InstallOperation, ExtensionManagementError, ExtensionManagementErrorCode, EXTENSION_INSTALL_CLIENT_TARGET_PLATFORM_CONTEXT, IAllowedExtensionsService, VerifyExtensionSignatureConfigKey } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { localize } from "../../../../nls.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Promises } from "../../../../base/common/async.js";
import { IExtensionManifestPropertiesService } from "../../extensions/common/extensionManifestPropertiesService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { RemoteExtensionManagementService } from "../common/remoteExtensionManagementService.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { IRemoteUserDataProfilesService } from "../../userDataProfile/common/remoteUserDataProfiles.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isBoolean, isUndefined } from "../../../../base/common/types.js";
let NativeRemoteExtensionManagementService = class extends RemoteExtensionManagementService {
  constructor(channel, localExtensionManagementServer, productService, userDataProfileService, userDataProfilesService, remoteUserDataProfilesService, uriIdentityService, logService, galleryService, configurationService, allowedExtensionsService, fileService, extensionManifestPropertiesService) {
    super(channel, productService, allowedExtensionsService, userDataProfileService, userDataProfilesService, remoteUserDataProfilesService, uriIdentityService);
    this.localExtensionManagementServer = localExtensionManagementServer;
    this.logService = logService;
    this.galleryService = galleryService;
    this.configurationService = configurationService;
    this.fileService = fileService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
  }
  async install(vsix, options) {
    const local = await super.install(vsix, options);
    await this.installUIDependenciesAndPackedExtensions(local);
    return local;
  }
  async installFromGallery(extension, installOptions = {}) {
    if (isUndefined(installOptions.donotVerifySignature)) {
      const value = this.configurationService.getValue(VerifyExtensionSignatureConfigKey);
      installOptions.donotVerifySignature = isBoolean(value) ? !value : void 0;
    }
    const local = await this.doInstallFromGallery(extension, installOptions);
    await this.installUIDependenciesAndPackedExtensions(local);
    return local;
  }
  async doInstallFromGallery(extension, installOptions) {
    if (installOptions.downloadExtensionsLocally || this.configurationService.getValue("remote.downloadExtensionsLocally")) {
      return this.downloadAndInstall(extension, installOptions);
    }
    try {
      const clientTargetPlatform = await this.localExtensionManagementServer.extensionManagementService.getTargetPlatform();
      return await super.installFromGallery(extension, { ...installOptions, context: { ...installOptions?.context, [EXTENSION_INSTALL_CLIENT_TARGET_PLATFORM_CONTEXT]: clientTargetPlatform } });
    } catch (error) {
      switch (error.name) {
        case ExtensionManagementErrorCode.Download:
        case ExtensionManagementErrorCode.DownloadSignature:
        case ExtensionManagementErrorCode.Gallery:
        case ExtensionManagementErrorCode.Internal:
        case ExtensionManagementErrorCode.Unknown:
          try {
            this.logService.error(`Error while installing '${extension.identifier.id}' extension in the remote server.`, toErrorMessage(error));
            return await this.downloadAndInstall(extension, installOptions);
          } catch (e) {
            this.logService.error(e);
            throw e;
          }
        default:
          this.logService.debug("Remote Install Error Name", error.name);
          throw error;
      }
    }
  }
  async downloadAndInstall(extension, installOptions) {
    this.logService.info(`Downloading the '${extension.identifier.id}' extension locally and install`);
    const compatible = await this.checkAndGetCompatible(extension, !!installOptions.installPreReleaseVersion);
    installOptions = { ...installOptions, donotIncludePackAndDependencies: true };
    const installed = await this.getInstalled(ExtensionType.User, void 0, installOptions.productVersion);
    const workspaceExtensions = await this.getAllWorkspaceDependenciesAndPackedExtensions(compatible, CancellationToken.None);
    if (workspaceExtensions.length) {
      this.logService.info(`Downloading the workspace dependencies and packed extensions of '${compatible.identifier.id}' locally and install`);
      for (const workspaceExtension of workspaceExtensions) {
        await this.downloadCompatibleAndInstall(workspaceExtension, installed, installOptions);
      }
    }
    return await this.downloadCompatibleAndInstall(compatible, installed, installOptions);
  }
  async downloadCompatibleAndInstall(extension, installed, installOptions) {
    const compatible = await this.checkAndGetCompatible(extension, !!installOptions.installPreReleaseVersion);
    this.logService.trace("Downloading extension:", compatible.identifier.id);
    const location = await this.localExtensionManagementServer.extensionManagementService.download(compatible, installed.filter((i) => areSameExtensions(i.identifier, compatible.identifier))[0] ? InstallOperation.Update : InstallOperation.Install, !!installOptions.donotVerifySignature);
    this.logService.info("Downloaded extension:", compatible.identifier.id, location.path);
    try {
      const local = await super.install(location, { ...installOptions, keepExisting: true });
      this.logService.info(`Successfully installed '${compatible.identifier.id}' extension`);
      return local;
    } finally {
      try {
        await this.fileService.del(location);
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
  async checkAndGetCompatible(extension, includePreRelease) {
    const targetPlatform = await this.getTargetPlatform();
    let compatibleExtension = null;
    if (extension.hasPreReleaseVersion && extension.properties.isPreReleaseVersion !== includePreRelease) {
      compatibleExtension = (await this.galleryService.getExtensions([{ ...extension.identifier, preRelease: includePreRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0] || null;
    }
    if (!compatibleExtension && await this.galleryService.isExtensionCompatible(extension, includePreRelease, targetPlatform)) {
      compatibleExtension = extension;
    }
    if (!compatibleExtension) {
      compatibleExtension = await this.galleryService.getCompatibleExtension(extension, includePreRelease, targetPlatform);
    }
    if (!compatibleExtension) {
      if (!includePreRelease && extension.properties.isPreReleaseVersion && (await this.galleryService.getExtensions([extension.identifier], CancellationToken.None))[0]) {
        throw new ExtensionManagementError(localize("notFoundReleaseExtension", "Can't install release version of '{0}' extension because it has no release version.", extension.identifier.id), ExtensionManagementErrorCode.ReleaseVersionNotFound);
      }
      throw new ExtensionManagementError(localize("notFoundCompatibleDependency", "Can't install '{0}' extension because it is not compatible with the current version of {1} (version {2}).", extension.identifier.id, this.productService.nameLong, this.productService.version), ExtensionManagementErrorCode.Incompatible);
    }
    return compatibleExtension;
  }
  async installUIDependenciesAndPackedExtensions(local) {
    const uiExtensions = await this.getAllUIDependenciesAndPackedExtensions(local.manifest, CancellationToken.None);
    const installed = await this.localExtensionManagementServer.extensionManagementService.getInstalled();
    const toInstall = uiExtensions.filter((e) => installed.every((i) => !areSameExtensions(i.identifier, e.identifier)));
    if (toInstall.length) {
      this.logService.info(`Installing UI dependencies and packed extensions of '${local.identifier.id}' locally`);
      await Promises.settled(toInstall.map((d) => this.localExtensionManagementServer.extensionManagementService.installFromGallery(d)));
    }
  }
  async getAllUIDependenciesAndPackedExtensions(manifest, token) {
    const result = /* @__PURE__ */ new Map();
    const extensions = [...manifest.extensionPack || [], ...manifest.extensionDependencies || []];
    await this.getDependenciesAndPackedExtensionsRecursively(extensions, result, true, token);
    return [...result.values()];
  }
  async getAllWorkspaceDependenciesAndPackedExtensions(extension, token) {
    const result = /* @__PURE__ */ new Map();
    result.set(extension.identifier.id.toLowerCase(), extension);
    const manifest = await this.galleryService.getManifest(extension, token);
    if (manifest) {
      const extensions = [...manifest.extensionPack || [], ...manifest.extensionDependencies || []];
      await this.getDependenciesAndPackedExtensionsRecursively(extensions, result, false, token);
    }
    result.delete(extension.identifier.id);
    return [...result.values()];
  }
  async getDependenciesAndPackedExtensionsRecursively(toGet, result, uiExtension, token) {
    if (toGet.length === 0) {
      return Promise.resolve();
    }
    const extensions = await this.galleryService.getExtensions(toGet.map((id) => ({ id })), token);
    const manifests = await Promise.all(extensions.map((e) => this.galleryService.getManifest(e, token)));
    const extensionsManifests = [];
    for (let idx = 0; idx < extensions.length; idx++) {
      const extension = extensions[idx];
      const manifest = manifests[idx];
      if (manifest && this.extensionManifestPropertiesService.prefersExecuteOnUI(manifest) === uiExtension) {
        result.set(extension.identifier.id.toLowerCase(), extension);
        extensionsManifests.push(manifest);
      }
    }
    toGet = [];
    for (const extensionManifest of extensionsManifests) {
      if (isNonEmptyArray(extensionManifest.extensionDependencies)) {
        for (const id of extensionManifest.extensionDependencies) {
          if (!result.has(id.toLowerCase())) {
            toGet.push(id);
          }
        }
      }
      if (isNonEmptyArray(extensionManifest.extensionPack)) {
        for (const id of extensionManifest.extensionPack) {
          if (!result.has(id.toLowerCase())) {
            toGet.push(id);
          }
        }
      }
    }
    return this.getDependenciesAndPackedExtensionsRecursively(toGet, result, uiExtension, token);
  }
};
NativeRemoteExtensionManagementService = __decorateClass([
  __decorateParam(2, IProductService),
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IRemoteUserDataProfilesService),
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IExtensionGalleryService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IAllowedExtensionsService),
  __decorateParam(11, IFileService),
  __decorateParam(12, IExtensionManifestPropertiesService)
], NativeRemoteExtensionManagementService);
export {
  NativeRemoteExtensionManagementService
};
