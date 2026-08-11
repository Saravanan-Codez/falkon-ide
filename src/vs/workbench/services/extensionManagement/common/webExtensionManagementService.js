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
import { ExtensionIdentifier, ExtensionType, TargetPlatform } from "../../../../platform/extensions/common/extensions.js";
import { InstallOperation, IExtensionGalleryService, IAllowedExtensionsService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { URI } from "../../../../base/common/uri.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { areSameExtensions, getGalleryExtensionId } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IWebExtensionsScannerService } from "./extensionManagement.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractExtensionManagementService, AbstractExtensionTask, toExtensionManagementError } from "../../../../platform/extensionManagement/common/abstractExtensionManagementService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IExtensionManifestPropertiesService } from "../../extensions/common/extensionManifestPropertiesService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { isBoolean, isUndefined } from "../../../../base/common/types.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { delta } from "../../../../base/common/arrays.js";
import { compare } from "../../../../base/common/strings.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
let WebExtensionManagementService = class extends AbstractExtensionManagementService {
  constructor(extensionGalleryService, telemetryService, logService, webExtensionsScannerService, extensionManifestPropertiesService, userDataProfileService, productService, allowedExtensionsService, userDataProfilesService, uriIdentityService) {
    super(extensionGalleryService, telemetryService, uriIdentityService, logService, productService, allowedExtensionsService, userDataProfilesService);
    this.webExtensionsScannerService = webExtensionsScannerService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.userDataProfileService = userDataProfileService;
    this.disposables = this._register(new DisposableStore());
    this._onDidChangeProfile = this._register(new Emitter());
    this.onDidChangeProfile = this._onDidChangeProfile.event;
    this._register(userDataProfileService.onDidChangeCurrentProfile((e) => {
      if (!this.uriIdentityService.extUri.isEqual(e.previous.extensionsResource, e.profile.extensionsResource)) {
        e.join(this.whenProfileChanged(e));
      }
    }));
  }
  get onProfileAwareInstallExtension() {
    return super.onInstallExtension;
  }
  get onInstallExtension() {
    return Event.filter(this.onProfileAwareInstallExtension, (e) => this.filterEvent(e), this.disposables);
  }
  get onProfileAwareDidInstallExtensions() {
    return super.onDidInstallExtensions;
  }
  get onDidInstallExtensions() {
    return Event.filter(
      Event.map(this.onProfileAwareDidInstallExtensions, (results) => results.filter((e) => this.filterEvent(e)), this.disposables),
      (results) => results.length > 0,
      this.disposables
    );
  }
  get onProfileAwareUninstallExtension() {
    return super.onUninstallExtension;
  }
  get onUninstallExtension() {
    return Event.filter(this.onProfileAwareUninstallExtension, (e) => this.filterEvent(e), this.disposables);
  }
  get onProfileAwareDidUninstallExtension() {
    return super.onDidUninstallExtension;
  }
  get onDidUninstallExtension() {
    return Event.filter(this.onProfileAwareDidUninstallExtension, (e) => this.filterEvent(e), this.disposables);
  }
  get onProfileAwareDidUpdateExtensionMetadata() {
    return super.onDidUpdateExtensionMetadata;
  }
  filterEvent({ profileLocation, applicationScoped }) {
    profileLocation = profileLocation ?? this.userDataProfileService.currentProfile.extensionsResource;
    return applicationScoped || this.uriIdentityService.extUri.isEqual(this.userDataProfileService.currentProfile.extensionsResource, profileLocation);
  }
  async getTargetPlatform() {
    return TargetPlatform.WEB;
  }
  async isExtensionPlatformCompatible(extension) {
    if (this.isConfiguredToExecuteOnWeb(extension)) {
      return true;
    }
    return super.isExtensionPlatformCompatible(extension);
  }
  async getInstalled(type, profileLocation) {
    const extensions = [];
    if (type === void 0 || type === ExtensionType.System) {
      const systemExtensions = await this.webExtensionsScannerService.scanSystemExtensions();
      extensions.push(...systemExtensions);
    }
    if (type === void 0 || type === ExtensionType.User) {
      const userExtensions = await this.webExtensionsScannerService.scanUserExtensions(profileLocation ?? this.userDataProfileService.currentProfile.extensionsResource);
      extensions.push(...userExtensions);
    }
    return extensions.map((e) => toLocalExtension(e));
  }
  async install(location, options = {}) {
    this.logService.trace("ExtensionManagementService#install", location.toString());
    const manifest = await this.webExtensionsScannerService.scanExtensionManifest(location);
    if (!manifest || !manifest.name || !manifest.version) {
      throw new Error(`Cannot find a valid extension from the location ${location.toString()}`);
    }
    const result = await this.installExtensions([{ manifest, extension: location, options }]);
    if (result[0]?.local) {
      return result[0]?.local;
    }
    if (result[0]?.error) {
      throw result[0].error;
    }
    throw toExtensionManagementError(new Error(`Unknown error while installing extension ${getGalleryExtensionId(manifest.publisher, manifest.name)}`));
  }
  installFromLocation(location, profileLocation) {
    return this.install(location, { profileLocation });
  }
  async deleteExtension(extension) {
  }
  async copyExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
    const target = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, toProfileLocation);
    const source = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, fromProfileLocation);
    metadata = { ...source?.metadata, ...metadata };
    let scanned;
    if (target) {
      scanned = await this.webExtensionsScannerService.updateMetadata(extension, { ...target.metadata, ...metadata }, toProfileLocation);
    } else {
      scanned = await this.webExtensionsScannerService.addExtension(extension.location, metadata, toProfileLocation);
    }
    return toLocalExtension(scanned);
  }
  async moveExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
    const target = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, toProfileLocation);
    const source = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, fromProfileLocation);
    metadata = { ...source?.metadata, ...metadata };
    let scanned;
    if (target) {
      scanned = await this.webExtensionsScannerService.updateMetadata(extension, { ...target.metadata, ...metadata }, toProfileLocation);
    } else {
      scanned = await this.webExtensionsScannerService.addExtension(extension.location, metadata, toProfileLocation);
      if (source) {
        await this.webExtensionsScannerService.removeExtension(source, fromProfileLocation);
      }
    }
    return toLocalExtension(scanned);
  }
  async removeExtension(extension, fromProfileLocation) {
    const source = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, fromProfileLocation);
    if (source) {
      await this.webExtensionsScannerService.removeExtension(source, fromProfileLocation);
    }
  }
  async installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
    const result = [];
    const extensionsToInstall = (await this.webExtensionsScannerService.scanUserExtensions(fromProfileLocation)).filter((e) => extensions.some((id) => areSameExtensions(id, e.identifier)));
    if (extensionsToInstall.length) {
      await Promise.allSettled(extensionsToInstall.map(async (e) => {
        let local = await this.installFromLocation(e.location, toProfileLocation);
        if (e.metadata) {
          local = await this.updateMetadata(local, e.metadata, fromProfileLocation);
        }
        result.push(local);
      }));
    }
    return result;
  }
  async updateMetadata(local, metadata, profileLocation) {
    if (metadata.isMachineScoped === false) {
      metadata.isMachineScoped = void 0;
    }
    if (metadata.isBuiltin === false) {
      metadata.isBuiltin = void 0;
    }
    if (metadata.pinned === false) {
      metadata.pinned = void 0;
    }
    const updatedExtension = await this.webExtensionsScannerService.updateMetadata(local, metadata, profileLocation);
    const updatedLocalExtension = toLocalExtension(updatedExtension);
    this._onDidUpdateExtensionMetadata.fire({ local: updatedLocalExtension, profileLocation });
    return updatedLocalExtension;
  }
  async copyExtensions(fromProfileLocation, toProfileLocation) {
    await this.webExtensionsScannerService.copyExtensions(fromProfileLocation, toProfileLocation, (e) => !e.metadata?.isApplicationScoped);
  }
  async getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion) {
    const compatibleExtension = await super.getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion);
    if (compatibleExtension) {
      return compatibleExtension;
    }
    if (this.isConfiguredToExecuteOnWeb(extension)) {
      return extension;
    }
    return null;
  }
  isConfiguredToExecuteOnWeb(gallery) {
    const configuredExtensionKind = this.extensionManifestPropertiesService.getUserConfiguredExtensionKind(gallery.identifier);
    return !!configuredExtensionKind && configuredExtensionKind.includes("web");
  }
  getCurrentExtensionsManifestLocation() {
    return this.userDataProfileService.currentProfile.extensionsResource;
  }
  createInstallExtensionTask(manifest, extension, options) {
    return new InstallExtensionTask(manifest, extension, options, this.webExtensionsScannerService, this.userDataProfilesService);
  }
  createUninstallExtensionTask(extension, options) {
    return new UninstallExtensionTask(extension, options, this.webExtensionsScannerService);
  }
  zip(extension) {
    throw new Error("unsupported");
  }
  getManifest(vsix) {
    throw new Error("unsupported");
  }
  download() {
    throw new Error("unsupported");
  }
  async cleanUp() {
  }
  async whenProfileChanged(e) {
    const previousProfileLocation = e.previous.extensionsResource;
    const currentProfileLocation = e.profile.extensionsResource;
    if (!previousProfileLocation || !currentProfileLocation) {
      throw new Error("This should not happen");
    }
    const oldExtensions = await this.webExtensionsScannerService.scanUserExtensions(previousProfileLocation);
    const newExtensions = await this.webExtensionsScannerService.scanUserExtensions(currentProfileLocation);
    const { added, removed } = delta(oldExtensions, newExtensions, (a, b) => compare(`${ExtensionIdentifier.toKey(a.identifier.id)}@${a.manifest.version}`, `${ExtensionIdentifier.toKey(b.identifier.id)}@${b.manifest.version}`));
    this._onDidChangeProfile.fire({ added: added.map((e2) => toLocalExtension(e2)), removed: removed.map((e2) => toLocalExtension(e2)) });
  }
};
WebExtensionManagementService = __decorateClass([
  __decorateParam(0, IExtensionGalleryService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IWebExtensionsScannerService),
  __decorateParam(4, IExtensionManifestPropertiesService),
  __decorateParam(5, IUserDataProfileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IAllowedExtensionsService),
  __decorateParam(8, IUserDataProfilesService),
  __decorateParam(9, IUriIdentityService)
], WebExtensionManagementService);
function toLocalExtension(extension) {
  const metadata = getMetadata(void 0, extension);
  return {
    ...extension,
    identifier: { id: extension.identifier.id, uuid: metadata.id ?? extension.identifier.uuid },
    isMachineScoped: !!metadata.isMachineScoped,
    isApplicationScoped: !!metadata.isApplicationScoped,
    publisherId: metadata.publisherId || null,
    publisherDisplayName: metadata.publisherDisplayName,
    installedTimestamp: metadata.installedTimestamp,
    isPreReleaseVersion: !!metadata.isPreReleaseVersion,
    hasPreReleaseVersion: !!metadata.hasPreReleaseVersion,
    preRelease: extension.preRelease,
    targetPlatform: TargetPlatform.WEB,
    updated: !!metadata.updated,
    pinned: !!metadata?.pinned,
    forceAutoUpdate: false,
    private: !!metadata.private,
    isWorkspaceScoped: false,
    source: metadata?.source ?? (extension.identifier.uuid ? "gallery" : "resource"),
    size: metadata.size ?? 0
  };
}
function getMetadata(options, existingExtension) {
  const metadata = { ...existingExtension?.metadata || {} };
  metadata.isMachineScoped = options?.isMachineScoped || metadata.isMachineScoped;
  return metadata;
}
class InstallExtensionTask extends AbstractExtensionTask {
  constructor(manifest, extension, options, webExtensionsScannerService, userDataProfilesService) {
    super();
    this.manifest = manifest;
    this.extension = extension;
    this.options = options;
    this.webExtensionsScannerService = webExtensionsScannerService;
    this.userDataProfilesService = userDataProfilesService;
    this._operation = InstallOperation.Install;
    this._profileLocation = options.profileLocation;
    this.identifier = URI.isUri(extension) ? { id: getGalleryExtensionId(manifest.publisher, manifest.name) } : extension.identifier;
    this.source = extension;
  }
  get profileLocation() {
    return this._profileLocation;
  }
  get operation() {
    return isUndefined(this.options.operation) ? this._operation : this.options.operation;
  }
  async doRun(token) {
    const userExtensions = await this.webExtensionsScannerService.scanUserExtensions(this.options.profileLocation);
    const existingExtension = userExtensions.find((e) => areSameExtensions(e.identifier, this.identifier));
    if (existingExtension) {
      this._operation = InstallOperation.Update;
    }
    const metadata = getMetadata(this.options, existingExtension);
    if (!URI.isUri(this.extension)) {
      metadata.id = this.extension.identifier.uuid;
      metadata.publisherDisplayName = this.extension.publisherDisplayName;
      metadata.publisherId = this.extension.publisherId;
      metadata.installedTimestamp = Date.now();
      metadata.isPreReleaseVersion = this.extension.properties.isPreReleaseVersion;
      metadata.hasPreReleaseVersion = metadata.hasPreReleaseVersion || this.extension.properties.isPreReleaseVersion;
      metadata.isBuiltin = this.options.isBuiltin || existingExtension?.isBuiltin;
      metadata.isSystem = existingExtension?.type === ExtensionType.System ? true : void 0;
      metadata.updated = !!existingExtension;
      metadata.isApplicationScoped = this.options.isApplicationScoped || metadata.isApplicationScoped;
      metadata.private = this.extension.private;
      metadata.preRelease = isBoolean(this.options.preRelease) ? this.options.preRelease : this.options.installPreReleaseVersion || this.extension.properties.isPreReleaseVersion || metadata.preRelease;
      metadata.source = URI.isUri(this.extension) ? "resource" : "gallery";
    }
    metadata.pinned = this.options.installGivenVersion ? true : this.options.pinned ?? metadata.pinned;
    this._profileLocation = metadata.isApplicationScoped ? this.userDataProfilesService.defaultProfile.extensionsResource : this.options.profileLocation;
    const scannedExtension = URI.isUri(this.extension) ? await this.webExtensionsScannerService.addExtension(this.extension, metadata, this.profileLocation) : await this.webExtensionsScannerService.addExtensionFromGallery(this.extension, metadata, this.profileLocation);
    return toLocalExtension(scannedExtension);
  }
}
class UninstallExtensionTask extends AbstractExtensionTask {
  constructor(extension, options, webExtensionsScannerService) {
    super();
    this.extension = extension;
    this.options = options;
    this.webExtensionsScannerService = webExtensionsScannerService;
  }
  doRun(token) {
    return this.webExtensionsScannerService.removeExtension(this.extension, this.options.profileLocation);
  }
}
export {
  WebExtensionManagementService
};
