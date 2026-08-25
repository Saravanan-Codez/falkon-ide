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
import { Emitter, Event, EventMultiplexer } from "../../../../base/common/event.js";
import {
  IExtensionGalleryService,
  ExtensionManagementError,
  ExtensionManagementErrorCode,
  InstallOperation,
  EXTENSION_INSTALL_SOURCE_CONTEXT,
  ExtensionInstallSource,
  IAllowedExtensionsService,
  EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT
} from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IExtensionManagementServerService } from "./extensionManagement.js";
import { ExtensionType, isLanguagePackExtension, getWorkspaceSupportTypeMessage } from "../../../../platform/extensions/common/extensions.js";
import { URI } from "../../../../base/common/uri.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { areSameExtensions, computeTargetPlatform } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { localize } from "../../../../nls.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Schemas } from "../../../../base/common/network.js";
import { IDownloadService } from "../../../../platform/download/common/download.js";
import { coalesce, distinct, isNonEmptyArray } from "../../../../base/common/arrays.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import Severity from "../../../../base/common/severity.js";
import { IUserDataSyncEnablementService, SyncResource } from "../../../../platform/userDataSync/common/userDataSync.js";
import { Promises } from "../../../../base/common/async.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IExtensionManifestPropertiesService } from "../../extensions/common/extensionManifestPropertiesService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { isString, isUndefined } from "../../../../base/common/types.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CancellationError, getErrorMessage } from "../../../../base/common/errors.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IExtensionsScannerService } from "../../../../platform/extensionManagement/common/extensionsScannerService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { createCommandUri, MarkdownString } from "../../../../base/common/htmlContent.js";
import { verifiedPublisherIcon } from "./extensionsIcons.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { CommontExtensionManagementService } from "../../../../platform/extensionManagement/common/abstractExtensionManagementService.js";
const TrustedPublishersStorageKey = "extensions.trustedPublishers";
function isGalleryExtension(extension) {
  return extension.type === "gallery";
}
let ExtensionManagementService = class extends CommontExtensionManagementService {
  constructor(extensionManagementServerService, extensionGalleryService, userDataProfileService, userDataProfilesService, configurationService, productService, downloadService, userDataSyncEnablementService, dialogService, workspaceTrustRequestService, extensionManifestPropertiesService, fileService, logService, instantiationService, extensionsScannerService, allowedExtensionsService, storageService, telemetryService) {
    super(productService, allowedExtensionsService);
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionGalleryService = extensionGalleryService;
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.configurationService = configurationService;
    this.downloadService = downloadService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.dialogService = dialogService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.fileService = fileService;
    this.logService = logService;
    this.instantiationService = instantiationService;
    this.extensionsScannerService = extensionsScannerService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this._onInstallExtension = this._register(new Emitter());
    this._onDidInstallExtensions = this._register(new Emitter());
    this._onUninstallExtension = this._register(new Emitter());
    this._onDidUninstallExtension = this._register(new Emitter());
    this._onDidProfileAwareInstallExtensions = this._register(new Emitter());
    this._onDidProfileAwareUninstallExtension = this._register(new Emitter());
    this.servers = [];
    this.defaultTrustedPublishers = productService.trustedExtensionPublishers ?? [];
    this.workspaceExtensionManagementService = this._register(this.instantiationService.createInstance(WorkspaceExtensionsManagementService));
    this.onDidEnableExtensions = this.workspaceExtensionManagementService.onDidChangeInvalidExtensions;
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      this.servers.push(this.extensionManagementServerService.localExtensionManagementServer);
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      this.servers.push(this.extensionManagementServerService.remoteExtensionManagementServer);
    }
    if (this.extensionManagementServerService.webExtensionManagementServer) {
      this.servers.push(this.extensionManagementServerService.webExtensionManagementServer);
    }
    const onInstallExtensionEventMultiplexer = this._register(new EventMultiplexer());
    this._register(onInstallExtensionEventMultiplexer.add(this._onInstallExtension.event));
    this.onInstallExtension = onInstallExtensionEventMultiplexer.event;
    const onDidInstallExtensionsEventMultiplexer = this._register(new EventMultiplexer());
    this._register(onDidInstallExtensionsEventMultiplexer.add(this._onDidInstallExtensions.event));
    this.onDidInstallExtensions = onDidInstallExtensionsEventMultiplexer.event;
    const onDidProfileAwareInstallExtensionsEventMultiplexer = this._register(new EventMultiplexer());
    this._register(onDidProfileAwareInstallExtensionsEventMultiplexer.add(this._onDidProfileAwareInstallExtensions.event));
    this.onProfileAwareDidInstallExtensions = onDidProfileAwareInstallExtensionsEventMultiplexer.event;
    const onUninstallExtensionEventMultiplexer = this._register(new EventMultiplexer());
    this._register(onUninstallExtensionEventMultiplexer.add(this._onUninstallExtension.event));
    this.onUninstallExtension = onUninstallExtensionEventMultiplexer.event;
    const onDidUninstallExtensionEventMultiplexer = this._register(new EventMultiplexer());
    this._register(onDidUninstallExtensionEventMultiplexer.add(this._onDidUninstallExtension.event));
    this.onDidUninstallExtension = onDidUninstallExtensionEventMultiplexer.event;
    const onDidProfileAwareUninstallExtensionEventMultiplexer = this._register(new EventMultiplexer());
    this._register(onDidProfileAwareUninstallExtensionEventMultiplexer.add(this._onDidProfileAwareUninstallExtension.event));
    this.onProfileAwareDidUninstallExtension = onDidProfileAwareUninstallExtensionEventMultiplexer.event;
    const onDidUpdateExtensionMetadaEventMultiplexer = this._register(new EventMultiplexer());
    this.onDidUpdateExtensionMetadata = onDidUpdateExtensionMetadaEventMultiplexer.event;
    const onDidProfileAwareUpdateExtensionMetadaEventMultiplexer = this._register(new EventMultiplexer());
    this.onProfileAwareDidUpdateExtensionMetadata = onDidProfileAwareUpdateExtensionMetadaEventMultiplexer.event;
    const onDidChangeProfileEventMultiplexer = this._register(new EventMultiplexer());
    this.onDidChangeProfile = onDidChangeProfileEventMultiplexer.event;
    for (const server of this.servers) {
      this._register(onInstallExtensionEventMultiplexer.add(Event.map(server.extensionManagementService.onInstallExtension, (e) => ({ ...e, server }))));
      this._register(onDidInstallExtensionsEventMultiplexer.add(server.extensionManagementService.onDidInstallExtensions));
      this._register(onDidProfileAwareInstallExtensionsEventMultiplexer.add(server.extensionManagementService.onProfileAwareDidInstallExtensions));
      this._register(onUninstallExtensionEventMultiplexer.add(Event.map(server.extensionManagementService.onUninstallExtension, (e) => ({ ...e, server }))));
      this._register(onDidUninstallExtensionEventMultiplexer.add(Event.map(server.extensionManagementService.onDidUninstallExtension, (e) => ({ ...e, server }))));
      this._register(onDidProfileAwareUninstallExtensionEventMultiplexer.add(Event.map(server.extensionManagementService.onProfileAwareDidUninstallExtension, (e) => ({ ...e, server }))));
      this._register(onDidUpdateExtensionMetadaEventMultiplexer.add(server.extensionManagementService.onDidUpdateExtensionMetadata));
      this._register(onDidProfileAwareUpdateExtensionMetadaEventMultiplexer.add(server.extensionManagementService.onProfileAwareDidUpdateExtensionMetadata));
      this._register(onDidChangeProfileEventMultiplexer.add(Event.map(server.extensionManagementService.onDidChangeProfile, (e) => ({ ...e, server }))));
    }
    this._register(this.onProfileAwareDidInstallExtensions((results) => {
      const untrustedPublishers = /* @__PURE__ */ new Map();
      for (const result of results) {
        if (result.local && result.source && !URI.isUri(result.source) && !this.isPublisherTrusted(result.source)) {
          untrustedPublishers.set(result.source.publisher, { publisher: result.source.publisher, publisherDisplayName: result.source.publisherDisplayName });
        }
      }
      if (untrustedPublishers.size) {
        this.trustPublishers(...untrustedPublishers.values());
      }
    }));
  }
  async getInstalled(type, profileLocation, productVersion) {
    const result = [];
    await Promise.all(this.servers.map(async (server) => {
      const installed = await server.extensionManagementService.getInstalled(type, profileLocation, productVersion);
      if (server === this.getWorkspaceExtensionsServer()) {
        const workspaceExtensions = await this.getInstalledWorkspaceExtensions(true);
        installed.push(...workspaceExtensions);
      }
      result.push(...installed);
    }));
    return result;
  }
  uninstall(extension, options) {
    return this.uninstallExtensions([{ extension, options }]);
  }
  async uninstallExtensions(extensions) {
    const workspaceExtensions = [];
    const groupedExtensions = /* @__PURE__ */ new Map();
    const addExtensionToServer = (server, extension, options) => {
      let extensions2 = groupedExtensions.get(server);
      if (!extensions2) {
        groupedExtensions.set(server, extensions2 = []);
      }
      extensions2.push({ extension, options });
    };
    for (const { extension, options } of extensions) {
      if (extension.isWorkspaceScoped) {
        workspaceExtensions.push(extension);
        continue;
      }
      const server = this.getServer(extension);
      if (!server) {
        throw new Error(`Invalid location ${extension.location.toString()}`);
      }
      addExtensionToServer(server, extension, options);
      if (this.servers.length > 1 && isLanguagePackExtension(extension.manifest)) {
        const otherServers = this.servers.filter((s) => s !== server);
        for (const otherServer of otherServers) {
          const installed = await otherServer.extensionManagementService.getInstalled();
          const extensionInOtherServer = installed.find((i) => !i.isBuiltin && areSameExtensions(i.identifier, extension.identifier));
          if (extensionInOtherServer) {
            addExtensionToServer(otherServer, extensionInOtherServer, options);
          }
        }
      }
    }
    const promises = [];
    for (const workspaceExtension of workspaceExtensions) {
      promises.push(this.uninstallExtensionFromWorkspace(workspaceExtension));
    }
    for (const [server, extensions2] of groupedExtensions.entries()) {
      promises.push(this.uninstallInServer(server, extensions2));
    }
    const result = await Promise.allSettled(promises);
    const errors = result.filter((r) => r.status === "rejected").map((r) => r.reason);
    if (errors.length) {
      throw new Error(errors.map((e) => e.message).join("\n"));
    }
  }
  async uninstallInServer(server, extensions) {
    if (server === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
      for (const { extension } of extensions) {
        const installedExtensions = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getInstalled(ExtensionType.User);
        const dependentNonUIExtensions = installedExtensions.filter((i) => !this.extensionManifestPropertiesService.prefersExecuteOnUI(i.manifest) && i.manifest.extensionDependencies && i.manifest.extensionDependencies.some((id) => areSameExtensions({ id }, extension.identifier)));
        if (dependentNonUIExtensions.length) {
          throw new Error(this.getDependentsErrorMessage(extension, dependentNonUIExtensions));
        }
      }
    }
    return server.extensionManagementService.uninstallExtensions(extensions);
  }
  getDependentsErrorMessage(extension, dependents) {
    if (dependents.length === 1) {
      return localize(
        "singleDependentError",
        "Cannot uninstall extension '{0}'. Extension '{1}' depends on this.",
        extension.manifest.displayName || extension.manifest.name,
        dependents[0].manifest.displayName || dependents[0].manifest.name
      );
    }
    if (dependents.length === 2) {
      return localize(
        "twoDependentsError",
        "Cannot uninstall extension '{0}'. Extensions '{1}' and '{2}' depend on this.",
        extension.manifest.displayName || extension.manifest.name,
        dependents[0].manifest.displayName || dependents[0].manifest.name,
        dependents[1].manifest.displayName || dependents[1].manifest.name
      );
    }
    return localize(
      "multipleDependentsError",
      "Cannot uninstall extension '{0}'. Extensions '{1}', '{2}' and others depend on this.",
      extension.manifest.displayName || extension.manifest.name,
      dependents[0].manifest.displayName || dependents[0].manifest.name,
      dependents[1].manifest.displayName || dependents[1].manifest.name
    );
  }
  updateMetadata(extension, metadata) {
    const server = this.getServer(extension);
    if (server) {
      const profile = extension.isApplicationScoped ? this.userDataProfilesService.defaultProfile : this.userDataProfileService.currentProfile;
      return server.extensionManagementService.updateMetadata(extension, metadata, profile.extensionsResource);
    }
    return Promise.reject(`Invalid location ${extension.location.toString()}`);
  }
  async resetPinnedStateForAllUserExtensions(pinned) {
    await Promise.allSettled(this.servers.map((server) => server.extensionManagementService.resetPinnedStateForAllUserExtensions(pinned)));
  }
  zip(extension) {
    const server = this.getServer(extension);
    if (server) {
      return server.extensionManagementService.zip(extension);
    }
    return Promise.reject(`Invalid location ${extension.location.toString()}`);
  }
  download(extension, operation, donotVerifySignature) {
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      return this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.download(extension, operation, donotVerifySignature);
    }
    throw new Error("Cannot download extension");
  }
  async install(vsix, options) {
    const manifest = await this.getManifest(vsix);
    return this.installVSIX(vsix, manifest, options);
  }
  async installVSIX(vsix, manifest, options) {
    const serversToInstall = this.getServersToInstall(manifest);
    if (serversToInstall?.length) {
      await this.checkForWorkspaceTrust(manifest, false);
      const [local] = await Promises.settled(serversToInstall.map((server) => this.installVSIXInServer(vsix, server, options)));
      return local;
    }
    return Promise.reject("No Servers to Install");
  }
  getServersToInstall(manifest) {
    if (this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
      if (isLanguagePackExtension(manifest)) {
        return [this.extensionManagementServerService.localExtensionManagementServer, this.extensionManagementServerService.remoteExtensionManagementServer];
      }
      if (this.extensionManifestPropertiesService.prefersExecuteOnUI(manifest)) {
        return [this.extensionManagementServerService.localExtensionManagementServer];
      }
      return [this.extensionManagementServerService.remoteExtensionManagementServer];
    }
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      return [this.extensionManagementServerService.localExtensionManagementServer];
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      return [this.extensionManagementServerService.remoteExtensionManagementServer];
    }
    return void 0;
  }
  async installFromLocation(location) {
    if (location.scheme === Schemas.file) {
      if (this.extensionManagementServerService.localExtensionManagementServer) {
        return this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.installFromLocation(location, this.userDataProfileService.currentProfile.extensionsResource);
      }
      throw new Error("Local extension management server is not found");
    }
    if (location.scheme === Schemas.vscodeRemote) {
      if (this.extensionManagementServerService.remoteExtensionManagementServer) {
        return this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.installFromLocation(location, this.userDataProfileService.currentProfile.extensionsResource);
      }
      throw new Error("Remote extension management server is not found");
    }
    if (!this.extensionManagementServerService.webExtensionManagementServer) {
      throw new Error("Web extension management server is not found");
    }
    return this.extensionManagementServerService.webExtensionManagementServer.extensionManagementService.installFromLocation(location, this.userDataProfileService.currentProfile.extensionsResource);
  }
  installVSIXInServer(vsix, server, options) {
    return server.extensionManagementService.install(vsix, options);
  }
  getManifest(vsix) {
    if (vsix.scheme === Schemas.file && this.extensionManagementServerService.localExtensionManagementServer) {
      return this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.getManifest(vsix);
    }
    if (vsix.scheme === Schemas.file && this.extensionManagementServerService.remoteExtensionManagementServer) {
      return this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getManifest(vsix);
    }
    if (vsix.scheme === Schemas.vscodeRemote && this.extensionManagementServerService.remoteExtensionManagementServer) {
      return this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getManifest(vsix);
    }
    return Promise.reject("No Servers");
  }
  async canInstall(extension) {
    if (isGalleryExtension(extension)) {
      return this.canInstallGalleryExtension(extension);
    }
    return this.canInstallResourceExtension(extension);
  }
  async canInstallGalleryExtension(gallery) {
    if (this.extensionManagementServerService.localExtensionManagementServer && await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.canInstall(gallery) === true) {
      return true;
    }
    const manifest = await this.extensionGalleryService.getManifest(gallery, CancellationToken.None);
    if (!manifest) {
      return new MarkdownString().appendText(localize("manifest is not found", "Manifest is not found"));
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer && await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.canInstall(gallery) === true && this.extensionManifestPropertiesService.canExecuteOnWorkspace(manifest)) {
      return true;
    }
    if (this.extensionManagementServerService.webExtensionManagementServer && await this.extensionManagementServerService.webExtensionManagementServer.extensionManagementService.canInstall(gallery) === true && this.extensionManifestPropertiesService.canExecuteOnWeb(manifest)) {
      return true;
    }
    return new MarkdownString().appendText(localize("cannot be installed", "Cannot install the '{0}' extension because it is not available in this setup.", gallery.displayName || gallery.name));
  }
  async canInstallResourceExtension(extension) {
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      return true;
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnWorkspace(extension.manifest)) {
      return true;
    }
    if (this.extensionManagementServerService.webExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnWeb(extension.manifest)) {
      return true;
    }
    return new MarkdownString().appendText(localize("cannot be installed", "Cannot install the '{0}' extension because it is not available in this setup.", extension.manifest.displayName ?? extension.identifier.id));
  }
  async updateFromGallery(gallery, extension, installOptions) {
    const server = this.getServer(extension);
    if (!server) {
      return Promise.reject(`Invalid location ${extension.location.toString()}`);
    }
    const servers = [];
    if (isLanguagePackExtension(extension.manifest)) {
      servers.push(...this.servers.filter((server2) => server2 !== this.extensionManagementServerService.webExtensionManagementServer));
    } else {
      servers.push(server);
    }
    installOptions = { ...installOptions || {}, isApplicationScoped: extension.isApplicationScoped };
    return Promises.settled(servers.map((server2) => server2.extensionManagementService.installFromGallery(gallery, installOptions))).then(([local]) => local);
  }
  async installGalleryExtensions(extensions) {
    const results = /* @__PURE__ */ new Map();
    const extensionsByServer = /* @__PURE__ */ new Map();
    const manifests = await Promise.all(extensions.map(async ({ extension }) => {
      const manifest = await this.extensionGalleryService.getManifest(extension, CancellationToken.None);
      if (!manifest) {
        throw new Error(localize("Manifest is not found", "Installing Extension {0} failed: Manifest is not found.", extension.displayName || extension.name));
      }
      return manifest;
    }));
    if (extensions.some((e) => e.options?.context?.[EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT] !== true)) {
      await this.checkForTrustedPublishers(extensions.map((e, index) => ({ extension: e.extension, manifest: manifests[index], checkForPackAndDependencies: !e.options?.donotIncludePackAndDependencies })));
    }
    await Promise.all(extensions.map(async ({ extension, options }) => {
      try {
        const manifest = await this.extensionGalleryService.getManifest(extension, CancellationToken.None);
        if (!manifest) {
          throw new Error(localize("Manifest is not found", "Installing Extension {0} failed: Manifest is not found.", extension.displayName || extension.name));
        }
        if (options?.context?.[EXTENSION_INSTALL_SOURCE_CONTEXT] !== ExtensionInstallSource.SETTINGS_SYNC) {
          await this.checkForWorkspaceTrust(manifest, false);
          if (!options?.donotIncludePackAndDependencies) {
            await this.checkInstallingExtensionOnWeb(extension, manifest);
          }
        }
        const servers = await this.getExtensionManagementServersToInstall(extension, manifest);
        if (!options.isMachineScoped && this.isExtensionsSyncEnabled()) {
          if (this.extensionManagementServerService.localExtensionManagementServer && !servers.includes(this.extensionManagementServerService.localExtensionManagementServer) && await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.canInstall(extension) === true) {
            servers.push(this.extensionManagementServerService.localExtensionManagementServer);
          }
        }
        for (const server of servers) {
          let exensions = extensionsByServer.get(server);
          if (!exensions) {
            extensionsByServer.set(server, exensions = []);
          }
          exensions.push({ extension, options });
        }
      } catch (error) {
        results.set(extension.identifier.id.toLowerCase(), {
          identifier: extension.identifier,
          source: extension,
          error,
          operation: InstallOperation.Install,
          profileLocation: options.profileLocation ?? this.userDataProfileService.currentProfile.extensionsResource
        });
      }
    }));
    await Promise.all([...extensionsByServer.entries()].map(async ([server, extensions2]) => {
      const serverResults = await server.extensionManagementService.installGalleryExtensions(extensions2);
      for (const result of serverResults) {
        results.set(result.identifier.id.toLowerCase(), result);
      }
    }));
    return [...results.values()];
  }
  async installFromGallery(gallery, installOptions, servers) {
    const manifest = await this.extensionGalleryService.getManifest(gallery, CancellationToken.None);
    if (!manifest) {
      throw new Error(localize("Manifest is not found", "Installing Extension {0} failed: Manifest is not found.", gallery.displayName || gallery.name));
    }
    if (installOptions?.context?.[EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT] !== true) {
      await this.checkForTrustedPublishers([{ extension: gallery, manifest, checkForPackAndDependencies: !installOptions?.donotIncludePackAndDependencies }]);
    }
    if (installOptions?.context?.[EXTENSION_INSTALL_SOURCE_CONTEXT] !== ExtensionInstallSource.SETTINGS_SYNC) {
      await this.checkForWorkspaceTrust(manifest, false);
      if (!installOptions?.donotIncludePackAndDependencies) {
        await this.checkInstallingExtensionOnWeb(gallery, manifest);
      }
    }
    servers = servers?.length ? this.validServers(gallery, manifest, servers) : await this.getExtensionManagementServersToInstall(gallery, manifest);
    if (!installOptions || isUndefined(installOptions.isMachineScoped)) {
      const isMachineScoped = await this.hasToFlagExtensionsMachineScoped([gallery]);
      installOptions = { ...installOptions || {}, isMachineScoped };
    }
    if (!installOptions.isMachineScoped && this.isExtensionsSyncEnabled()) {
      if (this.extensionManagementServerService.localExtensionManagementServer && !servers.includes(this.extensionManagementServerService.localExtensionManagementServer) && await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.canInstall(gallery) === true) {
        servers.push(this.extensionManagementServerService.localExtensionManagementServer);
      }
    }
    return Promises.settled(servers.map((server) => server.extensionManagementService.installFromGallery(gallery, installOptions))).then(([local]) => local);
  }
  async getExtensions(locations) {
    const scannedExtensions = await this.extensionsScannerService.scanMultipleExtensions(locations, ExtensionType.User, { includeInvalid: true });
    const result = [];
    await Promise.all(scannedExtensions.map(async (scannedExtension) => {
      const workspaceExtension = await this.workspaceExtensionManagementService.toLocalWorkspaceExtension(scannedExtension);
      if (workspaceExtension) {
        result.push({
          type: "resource",
          identifier: workspaceExtension.identifier,
          location: workspaceExtension.location,
          manifest: workspaceExtension.manifest,
          changelogUri: workspaceExtension.changelogUrl,
          readmeUri: workspaceExtension.readmeUrl
        });
      }
    }));
    return result;
  }
  getInstalledWorkspaceExtensionLocations() {
    return this.workspaceExtensionManagementService.getInstalledWorkspaceExtensionsLocations();
  }
  async getInstalledWorkspaceExtensions(includeInvalid) {
    return this.workspaceExtensionManagementService.getInstalled(includeInvalid);
  }
  async installResourceExtension(extension, installOptions) {
    if (!this.canInstallResourceExtension(extension)) {
      throw new Error("This extension cannot be installed in the current workspace.");
    }
    if (!installOptions.isWorkspaceScoped) {
      return this.installFromLocation(extension.location);
    }
    this.logService.info(`Installing the extension ${extension.identifier.id} from ${extension.location.toString()} in workspace`);
    const server = this.getWorkspaceExtensionsServer();
    this._onInstallExtension.fire({
      identifier: extension.identifier,
      source: extension.location,
      server,
      applicationScoped: false,
      profileLocation: this.userDataProfileService.currentProfile.extensionsResource,
      workspaceScoped: true
    });
    try {
      await this.checkForWorkspaceTrust(extension.manifest, true);
      const workspaceExtension = await this.workspaceExtensionManagementService.install(extension);
      this.logService.info(`Successfully installed the extension ${workspaceExtension.identifier.id} from ${extension.location.toString()} in the workspace`);
      this._onDidInstallExtensions.fire([{
        identifier: workspaceExtension.identifier,
        source: extension.location,
        operation: InstallOperation.Install,
        applicationScoped: false,
        profileLocation: this.userDataProfileService.currentProfile.extensionsResource,
        local: workspaceExtension,
        workspaceScoped: true
      }]);
      return workspaceExtension;
    } catch (error) {
      this.logService.error(`Failed to install the extension ${extension.identifier.id} from ${extension.location.toString()} in the workspace`, getErrorMessage(error));
      this._onDidInstallExtensions.fire([{
        identifier: extension.identifier,
        source: extension.location,
        operation: InstallOperation.Install,
        applicationScoped: false,
        profileLocation: this.userDataProfileService.currentProfile.extensionsResource,
        error,
        workspaceScoped: true
      }]);
      throw error;
    }
  }
  async getInstallableServers(gallery) {
    const manifest = await this.extensionGalleryService.getManifest(gallery, CancellationToken.None);
    if (!manifest) {
      return Promise.reject(localize("Manifest is not found", "Installing Extension {0} failed: Manifest is not found.", gallery.displayName || gallery.name));
    }
    return this.getInstallableExtensionManagementServers(manifest);
  }
  async uninstallExtensionFromWorkspace(extension) {
    if (!extension.isWorkspaceScoped) {
      throw new Error("The extension is not a workspace extension");
    }
    this.logService.info(`Uninstalling the workspace extension ${extension.identifier.id} from ${extension.location.toString()}`);
    const server = this.getWorkspaceExtensionsServer();
    this._onUninstallExtension.fire({
      identifier: extension.identifier,
      server,
      applicationScoped: false,
      workspaceScoped: true,
      profileLocation: this.userDataProfileService.currentProfile.extensionsResource
    });
    try {
      await this.workspaceExtensionManagementService.uninstall(extension);
      this.logService.info(`Successfully uninstalled the workspace extension ${extension.identifier.id} from ${extension.location.toString()}`);
      this.telemetryService.publicLog2("workspaceextension:uninstall");
      this._onDidUninstallExtension.fire({
        identifier: extension.identifier,
        server,
        applicationScoped: false,
        workspaceScoped: true,
        profileLocation: this.userDataProfileService.currentProfile.extensionsResource
      });
    } catch (error) {
      this.logService.error(`Failed to uninstall the workspace extension ${extension.identifier.id} from ${extension.location.toString()}`, getErrorMessage(error));
      this._onDidUninstallExtension.fire({
        identifier: extension.identifier,
        server,
        error,
        applicationScoped: false,
        workspaceScoped: true,
        profileLocation: this.userDataProfileService.currentProfile.extensionsResource
      });
      throw error;
    }
  }
  validServers(gallery, manifest, servers) {
    const installableServers = this.getInstallableExtensionManagementServers(manifest);
    for (const server of servers) {
      if (!installableServers.includes(server)) {
        const error = new Error(localize("cannot be installed in server", "Cannot install the '{0}' extension because it is not available in the '{1}' setup.", gallery.displayName || gallery.name, server.label));
        error.name = ExtensionManagementErrorCode.Unsupported;
        throw error;
      }
    }
    return servers;
  }
  async getExtensionManagementServersToInstall(gallery, manifest) {
    const servers = [];
    if (isLanguagePackExtension(manifest)) {
      servers.push(...this.servers.filter((server) => server !== this.extensionManagementServerService.webExtensionManagementServer));
    } else {
      const [server] = this.getInstallableExtensionManagementServers(manifest);
      if (server) {
        servers.push(server);
      }
    }
    if (!servers.length) {
      const error = new Error(localize("cannot be installed", "Cannot install the '{0}' extension because it is not available in this setup.", gallery.displayName || gallery.name));
      error.name = ExtensionManagementErrorCode.Unsupported;
      throw error;
    }
    return servers;
  }
  getInstallableExtensionManagementServers(manifest) {
    if (this.servers.length === 1 && this.extensionManagementServerService.localExtensionManagementServer) {
      return [this.extensionManagementServerService.localExtensionManagementServer];
    }
    const servers = [];
    const extensionKind = this.extensionManifestPropertiesService.getExtensionKind(manifest);
    for (const kind of extensionKind) {
      if (kind === "ui" && this.extensionManagementServerService.localExtensionManagementServer) {
        servers.push(this.extensionManagementServerService.localExtensionManagementServer);
      }
      if (kind === "workspace" && this.extensionManagementServerService.remoteExtensionManagementServer) {
        servers.push(this.extensionManagementServerService.remoteExtensionManagementServer);
      }
      if (kind === "web" && this.extensionManagementServerService.webExtensionManagementServer) {
        servers.push(this.extensionManagementServerService.webExtensionManagementServer);
      }
    }
    if (this.extensionManagementServerService.localExtensionManagementServer && !servers.includes(this.extensionManagementServerService.localExtensionManagementServer)) {
      servers.push(this.extensionManagementServerService.localExtensionManagementServer);
    }
    return servers;
  }
  isExtensionsSyncEnabled() {
    return this.userDataSyncEnablementService.isEnabled() && this.userDataSyncEnablementService.isResourceEnabled(SyncResource.Extensions);
  }
  async hasToFlagExtensionsMachineScoped(extensions) {
    if (this.isExtensionsSyncEnabled()) {
      const { result } = await this.dialogService.prompt({
        type: Severity.Info,
        message: extensions.length === 1 ? localize("install extension", "Install Extension") : localize("install extensions", "Install Extensions"),
        detail: extensions.length === 1 ? localize("install single extension", "Would you like to install and synchronize '{0}' extension across your devices?", extensions[0].displayName) : localize("install multiple extensions", "Would you like to install and synchronize extensions across your devices?"),
        buttons: [
          {
            label: localize({ key: "install", comment: ["&& denotes a mnemonic"] }, "&&Install"),
            run: () => false
          },
          {
            label: localize({ key: "install and do no sync", comment: ["&& denotes a mnemonic"] }, "Install (Do &&not sync)"),
            run: () => true
          }
        ],
        cancelButton: {
          run: () => {
            throw new CancellationError();
          }
        }
      });
      return result;
    }
    return false;
  }
  getExtensionsControlManifest() {
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      return this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.getExtensionsControlManifest();
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      return this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getExtensionsControlManifest();
    }
    if (this.extensionManagementServerService.webExtensionManagementServer) {
      return this.extensionManagementServerService.webExtensionManagementServer.extensionManagementService.getExtensionsControlManifest();
    }
    return this.extensionGalleryService.getExtensionsControlManifest();
  }
  getServer(extension) {
    if (extension.isWorkspaceScoped) {
      return this.getWorkspaceExtensionsServer();
    }
    return this.extensionManagementServerService.getExtensionManagementServer(extension);
  }
  getWorkspaceExtensionsServer() {
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      return this.extensionManagementServerService.remoteExtensionManagementServer;
    }
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      return this.extensionManagementServerService.localExtensionManagementServer;
    }
    if (this.extensionManagementServerService.webExtensionManagementServer) {
      return this.extensionManagementServerService.webExtensionManagementServer;
    }
    throw new Error("No extension server found");
  }
  async requestPublisherTrust(extensions) {
    const manifests = await Promise.all(extensions.map(async ({ extension }) => {
      const manifest = await this.extensionGalleryService.getManifest(extension, CancellationToken.None);
      if (!manifest) {
        throw new Error(localize("Manifest is not found", "Installing Extension {0} failed: Manifest is not found.", extension.displayName || extension.name));
      }
      return manifest;
    }));
    await this.checkForTrustedPublishers(extensions.map((e, index) => ({ extension: e.extension, manifest: manifests[index], checkForPackAndDependencies: !e.options?.donotIncludePackAndDependencies })));
  }
  async checkForTrustedPublishers(extensions) {
    const untrustedExtensions = [];
    const untrustedExtensionManifests = [];
    const manifestsToGetOtherUntrustedPublishers = [];
    for (const { extension, manifest, checkForPackAndDependencies } of extensions) {
      if (!extension.private && !this.isPublisherTrusted(extension)) {
        untrustedExtensions.push(extension);
        untrustedExtensionManifests.push(manifest);
        if (checkForPackAndDependencies) {
          manifestsToGetOtherUntrustedPublishers.push(manifest);
        }
      }
    }
    if (!untrustedExtensions.length) {
      return;
    }
    const otherUntrustedPublishers = manifestsToGetOtherUntrustedPublishers.length ? await this.getOtherUntrustedPublishers(manifestsToGetOtherUntrustedPublishers) : [];
    const allPublishers = [...distinct(untrustedExtensions, (e) => e.publisher), ...otherUntrustedPublishers];
    const unverfiiedPublishers = allPublishers.filter((p) => !p.publisherDomain?.verified);
    const verifiedPublishers = allPublishers.filter((p) => p.publisherDomain?.verified);
    const installButton = {
      label: allPublishers.length > 1 ? localize({ key: "trust publishers and install", comment: ["&& denotes a mnemonic"] }, "Trust Publishers & &&Install") : localize({ key: "trust and install", comment: ["&& denotes a mnemonic"] }, "Trust Publisher & &&Install"),
      run: () => {
        this.telemetryService.publicLog2("extensions:trustPublisher", { action: "trust", extensionId: untrustedExtensions.map((e) => e.identifier.id).join(",") });
        this.trustPublishers(...allPublishers.map((p) => ({ publisher: p.publisher, publisherDisplayName: p.publisherDisplayName })));
      }
    };
    const learnMoreButton = {
      label: localize({ key: "learnMore", comment: ["&& denotes a mnemonic"] }, "&&Learn More"),
      run: () => {
        this.telemetryService.publicLog2("extensions:trustPublisher", { action: "learn", extensionId: untrustedExtensions.map((e) => e.identifier.id).join(",") });
        this.instantiationService.invokeFunction((accessor) => accessor.get(ICommandService).executeCommand("vscode.open", URI.parse("https://aka.ms/vscode-extension-security")));
        throw new CancellationError();
      }
    };
    const getPublisherLink = ({ publisherDisplayName, publisherLink }) => {
      return publisherLink ? `[${publisherDisplayName}](${publisherLink})` : publisherDisplayName;
    };
    const unverifiedLink = "https://aka.ms/vscode-verify-publisher";
    const title = allPublishers.length === 1 ? localize("checkTrustedPublisherTitle", 'Do you trust the publisher "{0}"?', allPublishers[0].publisherDisplayName) : allPublishers.length === 2 ? localize("checkTwoTrustedPublishersTitle", 'Do you trust publishers "{0}" and "{1}"?', allPublishers[0].publisherDisplayName, allPublishers[1].publisherDisplayName) : localize("checkAllTrustedPublishersTitle", 'Do you trust the publisher "{0}" and {1} others?', allPublishers[0].publisherDisplayName, allPublishers.length - 1);
    const customMessage = new MarkdownString("", { supportThemeIcons: true, isTrusted: true });
    if (untrustedExtensions.length === 1) {
      const extension = untrustedExtensions[0];
      const manifest = untrustedExtensionManifests[0];
      if (otherUntrustedPublishers.length) {
        customMessage.appendMarkdown(localize("extension published by message", "The extension {0} is published by {1}.", `[${extension.displayName}](${extension.detailsLink})`, getPublisherLink(extension)));
        customMessage.appendMarkdown("&nbsp;");
        const commandUri = createCommandUri("extension.open", extension.identifier.id, manifest.extensionPack?.length ? "extensionPack" : "dependencies").toString();
        if (otherUntrustedPublishers.length === 1) {
          customMessage.appendMarkdown(localize("singleUntrustedPublisher", "Installing this extension will also install [extensions]({0}) published by {1}.", commandUri, getPublisherLink(otherUntrustedPublishers[0])));
        } else {
          customMessage.appendMarkdown(localize("message3", "Installing this extension will also install [extensions]({0}) published by {1} and {2}.", commandUri, otherUntrustedPublishers.slice(0, otherUntrustedPublishers.length - 1).map((p) => getPublisherLink(p)).join(", "), getPublisherLink(otherUntrustedPublishers[otherUntrustedPublishers.length - 1])));
        }
        customMessage.appendMarkdown("&nbsp;");
        customMessage.appendMarkdown(localize("firstTimeInstallingMessage", "This is the first time you're installing extensions from these publishers."));
      } else {
        customMessage.appendMarkdown(localize("message1", "The extension {0} is published by {1}. This is the first extension you're installing from this publisher.", `[${extension.displayName}](${extension.detailsLink})`, getPublisherLink(extension)));
      }
    } else {
      customMessage.appendMarkdown(localize("multiInstallMessage", "This is the first time you're installing extensions from publishers {0} and {1}.", getPublisherLink(allPublishers[0]), getPublisherLink(allPublishers[allPublishers.length - 1])));
    }
    if (verifiedPublishers.length || unverfiiedPublishers.length === 1) {
      for (const publisher of verifiedPublishers) {
        customMessage.appendText("\n");
        const publisherVerifiedMessage = localize("verifiedPublisherWithName", "{0} has verified ownership of {1}.", getPublisherLink(publisher), `[$(link-external) ${URI.parse(publisher.publisherDomain.link).authority}](${publisher.publisherDomain.link})`);
        customMessage.appendMarkdown(`$(${verifiedPublisherIcon.id})&nbsp;${publisherVerifiedMessage}`);
      }
      if (unverfiiedPublishers.length) {
        customMessage.appendText("\n");
        if (unverfiiedPublishers.length === 1) {
          customMessage.appendMarkdown(`$(${Codicon.unverified.id})&nbsp;${localize("unverifiedPublisherWithName", "{0} is [**not** verified]({1}).", getPublisherLink(unverfiiedPublishers[0]), unverifiedLink)}`);
        } else {
          customMessage.appendMarkdown(`$(${Codicon.unverified.id})&nbsp;${localize("unverifiedPublishers", "{0} and {1} are [**not** verified]({2}).", unverfiiedPublishers.slice(0, unverfiiedPublishers.length - 1).map((p) => getPublisherLink(p)).join(", "), getPublisherLink(unverfiiedPublishers[unverfiiedPublishers.length - 1]), unverifiedLink)}`);
        }
      }
    } else {
      customMessage.appendText("\n");
      customMessage.appendMarkdown(`$(${Codicon.unverified.id})&nbsp;${localize("allUnverifed", "All publishers are [**not** verified]({0}).", unverifiedLink)}`);
    }
    customMessage.appendText("\n");
    if (allPublishers.length > 1) {
      customMessage.appendMarkdown(localize("message4", "{0} has no control over the behavior of third-party extensions, including how they manage your personal data. Proceed only if you trust the publishers.", this.productService.nameLong));
    } else {
      customMessage.appendMarkdown(localize("message2", "{0} has no control over the behavior of third-party extensions, including how they manage your personal data. Proceed only if you trust the publisher.", this.productService.nameLong));
    }
    await this.dialogService.prompt({
      message: title,
      type: Severity.Warning,
      buttons: [installButton, learnMoreButton],
      cancelButton: {
        run: () => {
          this.telemetryService.publicLog2("extensions:trustPublisher", { action: "cancel", extensionId: untrustedExtensions.map((e) => e.identifier.id).join(",") });
          throw new CancellationError();
        }
      },
      custom: {
        markdownDetails: [{ markdown: customMessage, classes: ["extensions-management-publisher-trust-dialog"] }]
      }
    });
  }
  async getOtherUntrustedPublishers(manifests) {
    const extensionIds = /* @__PURE__ */ new Set();
    for (const manifest of manifests) {
      for (const id of [...manifest.extensionPack ?? [], ...manifest.extensionDependencies ?? []]) {
        const [publisherId] = id.split(".");
        if (publisherId.toLowerCase() === manifest.publisher.toLowerCase()) {
          continue;
        }
        if (this.isPublisherUserTrusted(publisherId.toLowerCase())) {
          continue;
        }
        extensionIds.add(id.toLowerCase());
      }
    }
    if (!extensionIds.size) {
      return [];
    }
    const extensions = /* @__PURE__ */ new Map();
    await this.getDependenciesAndPackedExtensionsRecursively([...extensionIds], extensions, CancellationToken.None);
    const publishers = /* @__PURE__ */ new Map();
    for (const [, extension] of extensions) {
      if (extension.private || this.isPublisherTrusted(extension)) {
        continue;
      }
      publishers.set(extension.publisherDisplayName, extension);
    }
    return [...publishers.values()];
  }
  async getDependenciesAndPackedExtensionsRecursively(toGet, result, token) {
    if (toGet.length === 0) {
      return;
    }
    const extensions = await this.extensionGalleryService.getExtensions(toGet.map((id) => ({ id })), token);
    for (let idx = 0; idx < extensions.length; idx++) {
      const extension = extensions[idx];
      result.set(extension.identifier.id.toLowerCase(), extension);
    }
    toGet = [];
    for (const extension of extensions) {
      if (isNonEmptyArray(extension.properties.dependencies)) {
        for (const id of extension.properties.dependencies) {
          if (!result.has(id.toLowerCase())) {
            toGet.push(id);
          }
        }
      }
      if (isNonEmptyArray(extension.properties.extensionPack)) {
        for (const id of extension.properties.extensionPack) {
          if (!result.has(id.toLowerCase())) {
            toGet.push(id);
          }
        }
      }
    }
    return this.getDependenciesAndPackedExtensionsRecursively(toGet, result, token);
  }
  async checkForWorkspaceTrust(manifest, requireTrust) {
    if (requireTrust || this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(manifest) === false) {
      const buttons = [];
      buttons.push({ label: localize("extensionInstallWorkspaceTrustButton", "Trust Workspace & Install"), type: "ContinueWithTrust" });
      if (!requireTrust) {
        buttons.push({ label: localize("extensionInstallWorkspaceTrustContinueButton", "Install"), type: "ContinueWithoutTrust" });
      }
      buttons.push({ label: localize("extensionInstallWorkspaceTrustManageButton", "Learn More"), type: "Manage" });
      const trustState = await this.workspaceTrustRequestService.requestWorkspaceTrust({
        message: localize("extensionInstallWorkspaceTrustMessage", "Enabling this extension requires a trusted workspace."),
        buttons
      });
      if (trustState === void 0) {
        throw new CancellationError();
      }
    }
  }
  async checkInstallingExtensionOnWeb(extension, manifest) {
    if (this.servers.length !== 1 || this.servers[0] !== this.extensionManagementServerService.webExtensionManagementServer) {
      return;
    }
    const nonWebExtensions = [];
    if (manifest.extensionPack?.length) {
      const extensions = await this.extensionGalleryService.getExtensions(manifest.extensionPack.map((id) => ({ id })), CancellationToken.None);
      for (const extension2 of extensions) {
        if (await this.servers[0].extensionManagementService.canInstall(extension2) !== true) {
          nonWebExtensions.push(extension2);
        }
      }
      if (nonWebExtensions.length && nonWebExtensions.length === extensions.length) {
        throw new ExtensionManagementError("Not supported in Web", ExtensionManagementErrorCode.Unsupported);
      }
    }
    const productName = localize("VS Code for Web", "{0} for the Web", this.productService.nameLong);
    const virtualWorkspaceSupport = this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(manifest);
    const virtualWorkspaceSupportReason = getWorkspaceSupportTypeMessage(manifest.capabilities?.virtualWorkspaces);
    const hasLimitedSupport = virtualWorkspaceSupport === "limited" || !!virtualWorkspaceSupportReason;
    if (!nonWebExtensions.length && !hasLimitedSupport) {
      return;
    }
    const limitedSupportMessage = localize("limited support", "'{0}' has limited functionality in {1}.", extension.displayName || extension.identifier.id, productName);
    let message;
    let buttons = [];
    let detail;
    const installAnywayButton = {
      label: localize({ key: "install anyways", comment: ["&& denotes a mnemonic"] }, "&&Install Anyway"),
      run: () => {
      }
    };
    const showExtensionsButton = {
      label: localize({ key: "showExtensions", comment: ["&& denotes a mnemonic"] }, "&&Show Extensions"),
      run: () => this.instantiationService.invokeFunction((accessor) => accessor.get(ICommandService).executeCommand("extension.open", extension.identifier.id, "extensionPack"))
    };
    if (nonWebExtensions.length && hasLimitedSupport) {
      message = limitedSupportMessage;
      detail = `${virtualWorkspaceSupportReason ? `${virtualWorkspaceSupportReason}
` : ""}${localize("non web extensions detail", "Contains extensions which are not supported.")}`;
      buttons = [
        installAnywayButton,
        showExtensionsButton
      ];
    } else if (hasLimitedSupport) {
      message = limitedSupportMessage;
      detail = virtualWorkspaceSupportReason || void 0;
      buttons = [installAnywayButton];
    } else {
      message = localize("non web extensions", "'{0}' contains extensions which are not supported in {1}.", extension.displayName || extension.identifier.id, productName);
      buttons = [
        installAnywayButton,
        showExtensionsButton
      ];
    }
    await this.dialogService.prompt({
      type: Severity.Info,
      message,
      detail,
      buttons,
      cancelButton: {
        run: () => {
          throw new CancellationError();
        }
      }
    });
  }
  getTargetPlatform() {
    if (!this._targetPlatformPromise) {
      this._targetPlatformPromise = computeTargetPlatform(this.fileService, this.logService);
    }
    return this._targetPlatformPromise;
  }
  async cleanUp() {
    await Promise.allSettled(this.servers.map((server) => server.extensionManagementService.cleanUp()));
  }
  toggleApplicationScope(extension, fromProfileLocation) {
    const server = this.getServer(extension);
    if (server) {
      return server.extensionManagementService.toggleApplicationScope(extension, fromProfileLocation);
    }
    throw new Error("Not Supported");
  }
  copyExtensions(from, to) {
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      throw new Error("Not Supported");
    }
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      return this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.copyExtensions(from, to);
    }
    if (this.extensionManagementServerService.webExtensionManagementServer) {
      return this.extensionManagementServerService.webExtensionManagementServer.extensionManagementService.copyExtensions(from, to);
    }
    return Promise.resolve();
  }
  registerParticipant() {
    throw new Error("Not Supported");
  }
  installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
    throw new Error("Not Supported");
  }
  isPublisherTrusted(extension) {
    const publisher = extension.publisher.toLowerCase();
    if (this.defaultTrustedPublishers.includes(publisher) || this.defaultTrustedPublishers.includes(extension.publisherDisplayName.toLowerCase())) {
      return true;
    }
    if (this.allowedExtensionsService.allowedExtensionsConfigValue && this.allowedExtensionsService.isAllowed(extension)) {
      return true;
    }
    return this.isPublisherUserTrusted(publisher);
  }
  isPublisherUserTrusted(publisher) {
    const trustedPublishers = this.getTrustedPublishersFromStorage();
    return !!trustedPublishers[publisher];
  }
  getTrustedPublishers() {
    const trustedPublishers = this.getTrustedPublishersFromStorage();
    return Object.keys(trustedPublishers).map((publisher) => trustedPublishers[publisher]);
  }
  trustPublishers(...publishers) {
    const trustedPublishers = this.getTrustedPublishersFromStorage();
    for (const publisher of publishers) {
      trustedPublishers[publisher.publisher.toLowerCase()] = publisher;
    }
    this.storageService.store(TrustedPublishersStorageKey, JSON.stringify(trustedPublishers), StorageScope.APPLICATION, StorageTarget.USER);
  }
  untrustPublishers(...publishers) {
    const trustedPublishers = this.getTrustedPublishersFromStorage();
    for (const publisher of publishers) {
      delete trustedPublishers[publisher.toLowerCase()];
    }
    this.storageService.store(TrustedPublishersStorageKey, JSON.stringify(trustedPublishers), StorageScope.APPLICATION, StorageTarget.USER);
  }
  getTrustedPublishersFromStorage() {
    const trustedPublishers = this.storageService.getObject(TrustedPublishersStorageKey, StorageScope.APPLICATION, {});
    if (Array.isArray(trustedPublishers)) {
      this.storageService.remove(TrustedPublishersStorageKey, StorageScope.APPLICATION);
      return /* @__PURE__ */ Object.create(null);
    }
    return Object.keys(trustedPublishers).reduce((result, publisher) => {
      result[publisher.toLowerCase()] = trustedPublishers[publisher];
      return result;
    }, /* @__PURE__ */ Object.create(null));
  }
};
ExtensionManagementService = __decorateClass([
  __decorateParam(0, IExtensionManagementServerService),
  __decorateParam(1, IExtensionGalleryService),
  __decorateParam(2, IUserDataProfileService),
  __decorateParam(3, IUserDataProfilesService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IDownloadService),
  __decorateParam(7, IUserDataSyncEnablementService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IWorkspaceTrustRequestService),
  __decorateParam(10, IExtensionManifestPropertiesService),
  __decorateParam(11, IFileService),
  __decorateParam(12, ILogService),
  __decorateParam(13, IInstantiationService),
  __decorateParam(14, IExtensionsScannerService),
  __decorateParam(15, IAllowedExtensionsService),
  __decorateParam(16, IStorageService),
  __decorateParam(17, ITelemetryService)
], ExtensionManagementService);
let WorkspaceExtensionsManagementService = class extends Disposable {
  constructor(fileService, logService, workspaceService, extensionsScannerService, storageService, uriIdentityService, telemetryService) {
    super();
    this.fileService = fileService;
    this.logService = logService;
    this.workspaceService = workspaceService;
    this.extensionsScannerService = extensionsScannerService;
    this.storageService = storageService;
    this.uriIdentityService = uriIdentityService;
    this.telemetryService = telemetryService;
    this._onDidChangeInvalidExtensions = this._register(new Emitter());
    this.onDidChangeInvalidExtensions = this._onDidChangeInvalidExtensions.event;
    this.extensions = [];
    this.invalidExtensionWatchers = this._register(new DisposableStore());
    this._register(Event.throttle(this.fileService.onDidFilesChange, (last, e) => {
      (last = last ?? []).push(e);
      return last;
    }, 1e3, false)((events) => {
      const changedInvalidExtensions = this.extensions.filter((extension) => !extension.isValid && events.some((e) => e.affects(extension.location)));
      if (changedInvalidExtensions.length) {
        this.checkExtensionsValidity(changedInvalidExtensions);
      }
    }));
    this.initializePromise = this.initialize();
  }
  static {
    this.WORKSPACE_EXTENSIONS_KEY = "workspaceExtensions.locations";
  }
  async initialize() {
    const existingLocations = this.getInstalledWorkspaceExtensionsLocations();
    if (!existingLocations.length) {
      return;
    }
    await Promise.allSettled(existingLocations.map(async (location) => {
      if (!this.workspaceService.isInsideWorkspace(location)) {
        this.logService.info(`Removing the workspace extension ${location.toString()} as it is not inside the workspace`);
        return;
      }
      if (!await this.fileService.exists(location)) {
        this.logService.info(`Removing the workspace extension ${location.toString()} as it does not exist`);
        return;
      }
      try {
        const extension = await this.scanWorkspaceExtension(location);
        if (extension) {
          this.extensions.push(extension);
        } else {
          this.logService.info(`Skipping workspace extension ${location.toString()} as it does not exist`);
        }
      } catch (error) {
        this.logService.error("Skipping the workspace extension", location.toString(), error);
      }
    }));
    this.saveWorkspaceExtensions();
  }
  watchInvalidExtensions() {
    this.invalidExtensionWatchers.clear();
    for (const extension of this.extensions) {
      if (!extension.isValid) {
        this.invalidExtensionWatchers.add(this.fileService.watch(extension.location));
      }
    }
  }
  async checkExtensionsValidity(extensions) {
    const validExtensions = [];
    await Promise.all(extensions.map(async (extension) => {
      const newExtension = await this.scanWorkspaceExtension(extension.location);
      if (newExtension?.isValid) {
        validExtensions.push(newExtension);
      }
    }));
    let changed = false;
    for (const extension of validExtensions) {
      const index = this.extensions.findIndex((e) => this.uriIdentityService.extUri.isEqual(e.location, extension.location));
      if (index !== -1) {
        changed = true;
        this.extensions.splice(index, 1, extension);
      }
    }
    if (changed) {
      this.saveWorkspaceExtensions();
      this._onDidChangeInvalidExtensions.fire(validExtensions);
    }
  }
  async getInstalled(includeInvalid) {
    await this.initializePromise;
    return this.extensions.filter((e) => includeInvalid || e.isValid);
  }
  async install(extension) {
    await this.initializePromise;
    const workspaceExtension = await this.scanWorkspaceExtension(extension.location);
    if (!workspaceExtension) {
      throw new Error("Cannot install the extension as it does not exist.");
    }
    const existingExtensionIndex = this.extensions.findIndex((e) => areSameExtensions(e.identifier, extension.identifier));
    if (existingExtensionIndex === -1) {
      this.extensions.push(workspaceExtension);
    } else {
      this.extensions.splice(existingExtensionIndex, 1, workspaceExtension);
    }
    this.saveWorkspaceExtensions();
    this.telemetryService.publicLog2("workspaceextension:install");
    return workspaceExtension;
  }
  async uninstall(extension) {
    await this.initializePromise;
    const existingExtensionIndex = this.extensions.findIndex((e) => areSameExtensions(e.identifier, extension.identifier));
    if (existingExtensionIndex !== -1) {
      this.extensions.splice(existingExtensionIndex, 1);
      this.saveWorkspaceExtensions();
    }
    this.telemetryService.publicLog2("workspaceextension:uninstall");
  }
  getInstalledWorkspaceExtensionsLocations() {
    const locations = [];
    try {
      const parsed = JSON.parse(this.storageService.get(WorkspaceExtensionsManagementService.WORKSPACE_EXTENSIONS_KEY, StorageScope.WORKSPACE, "[]"));
      if (Array.isArray(locations)) {
        for (const location of parsed) {
          if (isString(location)) {
            if (this.workspaceService.getWorkbenchState() === WorkbenchState.FOLDER) {
              locations.push(this.workspaceService.getWorkspace().folders[0].toResource(location));
            } else {
              this.logService.warn(`Invalid value for 'extensions' in workspace storage: ${location}`);
            }
          } else {
            locations.push(URI.revive(location));
          }
        }
      } else {
        this.logService.warn(`Invalid value for 'extensions' in workspace storage: ${locations}`);
      }
    } catch (error) {
      this.logService.warn(`Error parsing workspace extensions locations: ${getErrorMessage(error)}`);
    }
    return locations;
  }
  saveWorkspaceExtensions() {
    const locations = this.extensions.map((extension) => extension.location);
    if (this.workspaceService.getWorkbenchState() === WorkbenchState.FOLDER) {
      this.storageService.store(
        WorkspaceExtensionsManagementService.WORKSPACE_EXTENSIONS_KEY,
        JSON.stringify(coalesce(locations.map((location) => this.uriIdentityService.extUri.relativePath(this.workspaceService.getWorkspace().folders[0].uri, location)))),
        StorageScope.WORKSPACE,
        StorageTarget.MACHINE
      );
    } else {
      this.storageService.store(WorkspaceExtensionsManagementService.WORKSPACE_EXTENSIONS_KEY, JSON.stringify(locations), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    this.watchInvalidExtensions();
  }
  async scanWorkspaceExtension(location) {
    const scannedExtension = await this.extensionsScannerService.scanExistingExtension(location, ExtensionType.User, { includeInvalid: true });
    return scannedExtension ? this.toLocalWorkspaceExtension(scannedExtension) : null;
  }
  async toLocalWorkspaceExtension(extension) {
    const stat = await this.fileService.resolve(extension.location);
    let readmeUrl;
    let changelogUrl;
    if (stat.children) {
      readmeUrl = stat.children.find(({ name }) => /^readme(\.txt|\.md|)$/i.test(name))?.resource;
      changelogUrl = stat.children.find(({ name }) => /^changelog(\.txt|\.md|)$/i.test(name))?.resource;
    }
    const validations = [...extension.validations];
    let isValid = extension.isValid;
    if (extension.manifest.main) {
      if (!await this.fileService.exists(this.uriIdentityService.extUri.joinPath(extension.location, extension.manifest.main))) {
        isValid = false;
        validations.push([Severity.Error, localize("main.notFound", "Cannot activate because {0} not found", extension.manifest.main)]);
      }
    }
    return {
      identifier: extension.identifier,
      type: extension.type,
      isBuiltin: extension.isBuiltin || !!extension.metadata?.isBuiltin,
      location: extension.location,
      manifest: extension.manifest,
      targetPlatform: extension.targetPlatform,
      validations,
      isValid,
      readmeUrl,
      changelogUrl,
      publisherDisplayName: extension.metadata?.publisherDisplayName,
      publisherId: extension.metadata?.publisherId || null,
      isApplicationScoped: !!extension.metadata?.isApplicationScoped,
      isMachineScoped: !!extension.metadata?.isMachineScoped,
      isPreReleaseVersion: !!extension.metadata?.isPreReleaseVersion,
      hasPreReleaseVersion: !!extension.metadata?.hasPreReleaseVersion,
      preRelease: !!extension.metadata?.preRelease,
      installedTimestamp: extension.metadata?.installedTimestamp,
      updated: !!extension.metadata?.updated,
      pinned: !!extension.metadata?.pinned,
      forceAutoUpdate: false,
      isWorkspaceScoped: true,
      private: false,
      source: "resource",
      size: extension.metadata?.size ?? 0
    };
  }
};
WorkspaceExtensionsManagementService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IExtensionsScannerService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, ITelemetryService)
], WorkspaceExtensionsManagementService);
export {
  ExtensionManagementService
};
