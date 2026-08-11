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
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { AbstractExtensionsInitializer } from "../../../../platform/userDataSync/common/extensionsSync.js";
import { GlobalStateInitializer, UserDataSyncStoreTypeSynchronizer } from "../../../../platform/userDataSync/common/globalStateSync.js";
import { KeybindingsInitializer } from "../../../../platform/userDataSync/common/keybindingsSync.js";
import { SettingsInitializer } from "../../../../platform/userDataSync/common/settingsSync.js";
import { SnippetsInitializer } from "../../../../platform/userDataSync/common/snippetsSync.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { UserDataSyncStoreClient } from "../../../../platform/userDataSync/common/userDataSyncStoreService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { IUserDataSyncLogService, IUserDataSyncStoreManagementService, SyncResource } from "../../../../platform/userDataSync/common/userDataSync.js";
import { getCurrentAuthenticationSessionInfo } from "../../authentication/browser/authenticationService.js";
import { getSyncAreaLabel } from "../common/userDataSync.js";
import { isWeb } from "../../../../base/common/platform.js";
import { Barrier, Promises } from "../../../../base/common/async.js";
import { EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT, IExtensionGalleryService, IExtensionManagementService, IGlobalExtensionEnablementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IExtensionService, toExtensionDescription } from "../../extensions/common/extensions.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IIgnoredExtensionsManagementService } from "../../../../platform/userDataSync/common/ignoredExtensions.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IExtensionStorageService } from "../../../../platform/extensionManagement/common/extensionStorage.js";
import { TasksInitializer } from "../../../../platform/userDataSync/common/tasksSync.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
let UserDataSyncInitializer = class {
  constructor(environmentService, secretStorageService, userDataSyncStoreManagementService, fileService, userDataProfilesService, storageService, productService, requestService, logService, uriIdentityService) {
    this.environmentService = environmentService;
    this.secretStorageService = secretStorageService;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.fileService = fileService;
    this.userDataProfilesService = userDataProfilesService;
    this.storageService = storageService;
    this.productService = productService;
    this.requestService = requestService;
    this.logService = logService;
    this.uriIdentityService = uriIdentityService;
    this.initialized = [];
    this.initializationFinished = new Barrier();
    this.globalStateUserData = null;
    this.createUserDataSyncStoreClient().then((userDataSyncStoreClient) => {
      if (!userDataSyncStoreClient) {
        this.initializationFinished.open();
      }
    });
  }
  createUserDataSyncStoreClient() {
    if (!this._userDataSyncStoreClientPromise) {
      this._userDataSyncStoreClientPromise = (async () => {
        try {
          if (!isWeb) {
            this.logService.trace(`Skipping initializing user data in desktop`);
            return;
          }
          if (!this.storageService.isNew(StorageScope.APPLICATION)) {
            this.logService.trace(`Skipping initializing user data as application was opened before`);
            return;
          }
          if (!this.storageService.isNew(StorageScope.WORKSPACE)) {
            this.logService.trace(`Skipping initializing user data as workspace was opened before`);
            return;
          }
          if (this.environmentService.options?.settingsSyncOptions?.authenticationProvider && !this.environmentService.options.settingsSyncOptions.enabled) {
            this.logService.trace(`Skipping initializing user data as settings sync is disabled`);
            return;
          }
          let authenticationSession;
          try {
            authenticationSession = await getCurrentAuthenticationSessionInfo(this.secretStorageService, this.productService);
          } catch (error) {
            this.logService.error(error);
          }
          if (!authenticationSession) {
            this.logService.trace(`Skipping initializing user data as authentication session is not set`);
            return;
          }
          await this.initializeUserDataSyncStore(authenticationSession);
          const userDataSyncStore = this.userDataSyncStoreManagementService.userDataSyncStore;
          if (!userDataSyncStore) {
            this.logService.trace(`Skipping initializing user data as sync service is not provided`);
            return;
          }
          const userDataSyncStoreClient = new UserDataSyncStoreClient(userDataSyncStore.url, this.productService, this.requestService, this.logService, this.environmentService, this.fileService, this.storageService);
          userDataSyncStoreClient.setAuthToken(authenticationSession.accessToken, authenticationSession.providerId);
          const manifest = await userDataSyncStoreClient.manifest(null);
          if (manifest === null) {
            userDataSyncStoreClient.dispose();
            this.logService.trace(`Skipping initializing user data as there is no data`);
            return;
          }
          this.logService.info(`Using settings sync service ${userDataSyncStore.url.toString()} for initialization`);
          return userDataSyncStoreClient;
        } catch (error) {
          this.logService.error(error);
          return;
        }
      })();
    }
    return this._userDataSyncStoreClientPromise;
  }
  async initializeUserDataSyncStore(authenticationSession) {
    const userDataSyncStore = this.userDataSyncStoreManagementService.userDataSyncStore;
    if (!userDataSyncStore?.canSwitch) {
      return;
    }
    const disposables = new DisposableStore();
    try {
      const userDataSyncStoreClient = disposables.add(new UserDataSyncStoreClient(userDataSyncStore.url, this.productService, this.requestService, this.logService, this.environmentService, this.fileService, this.storageService));
      userDataSyncStoreClient.setAuthToken(authenticationSession.accessToken, authenticationSession.providerId);
      this.globalStateUserData = await userDataSyncStoreClient.readResource(SyncResource.GlobalState, null);
      if (this.globalStateUserData) {
        const userDataSyncStoreType = new UserDataSyncStoreTypeSynchronizer(userDataSyncStoreClient, this.storageService, this.environmentService, this.fileService, this.logService).getSyncStoreType(this.globalStateUserData);
        if (userDataSyncStoreType) {
          await this.userDataSyncStoreManagementService.switch(userDataSyncStoreType);
          if (!isEqual(userDataSyncStore.url, this.userDataSyncStoreManagementService.userDataSyncStore?.url)) {
            this.logService.info("Switched settings sync store");
            this.globalStateUserData = null;
          }
        }
      }
    } finally {
      disposables.dispose();
    }
  }
  async whenInitializationFinished() {
    await this.initializationFinished.wait();
  }
  async requiresInitialization() {
    this.logService.trace(`UserDataInitializationService#requiresInitialization`);
    const userDataSyncStoreClient = await this.createUserDataSyncStoreClient();
    return !!userDataSyncStoreClient;
  }
  async initializeRequiredResources() {
    this.logService.trace(`UserDataInitializationService#initializeRequiredResources`);
    return this.initialize([SyncResource.Settings, SyncResource.GlobalState]);
  }
  async initializeOtherResources(instantiationService) {
    try {
      this.logService.trace(`UserDataInitializationService#initializeOtherResources`);
      await Promise.allSettled([this.initialize([SyncResource.Keybindings, SyncResource.Snippets, SyncResource.Tasks]), this.initializeExtensions(instantiationService)]);
    } finally {
      this.initializationFinished.open();
    }
  }
  async initializeExtensions(instantiationService) {
    try {
      await Promise.all([this.initializeInstalledExtensions(instantiationService), this.initializeNewExtensions(instantiationService)]);
    } finally {
      this.initialized.push(SyncResource.Extensions);
    }
  }
  async initializeInstalledExtensions(instantiationService) {
    if (!this.initializeInstalledExtensionsPromise) {
      this.initializeInstalledExtensionsPromise = (async () => {
        this.logService.trace(`UserDataInitializationService#initializeInstalledExtensions`);
        const extensionsPreviewInitializer = await this.getExtensionsPreviewInitializer(instantiationService);
        if (extensionsPreviewInitializer) {
          await instantiationService.createInstance(InstalledExtensionsInitializer, extensionsPreviewInitializer).initialize();
        }
      })();
    }
    return this.initializeInstalledExtensionsPromise;
  }
  async initializeNewExtensions(instantiationService) {
    if (!this.initializeNewExtensionsPromise) {
      this.initializeNewExtensionsPromise = (async () => {
        this.logService.trace(`UserDataInitializationService#initializeNewExtensions`);
        const extensionsPreviewInitializer = await this.getExtensionsPreviewInitializer(instantiationService);
        if (extensionsPreviewInitializer) {
          await instantiationService.createInstance(NewExtensionsInitializer, extensionsPreviewInitializer).initialize();
        }
      })();
    }
    return this.initializeNewExtensionsPromise;
  }
  getExtensionsPreviewInitializer(instantiationService) {
    if (!this.extensionsPreviewInitializerPromise) {
      this.extensionsPreviewInitializerPromise = (async () => {
        const userDataSyncStoreClient = await this.createUserDataSyncStoreClient();
        if (!userDataSyncStoreClient) {
          return null;
        }
        const userData = await userDataSyncStoreClient.readResource(SyncResource.Extensions, null);
        return instantiationService.createInstance(ExtensionsPreviewInitializer, userData);
      })();
    }
    return this.extensionsPreviewInitializerPromise;
  }
  async initialize(syncResources) {
    const userDataSyncStoreClient = await this.createUserDataSyncStoreClient();
    if (!userDataSyncStoreClient) {
      return;
    }
    await Promises.settled(syncResources.map(async (syncResource) => {
      try {
        if (this.initialized.includes(syncResource)) {
          this.logService.info(`${getSyncAreaLabel(syncResource)} initialized already.`);
          return;
        }
        this.initialized.push(syncResource);
        this.logService.trace(`Initializing ${getSyncAreaLabel(syncResource)}`);
        const initializer = this.createSyncResourceInitializer(syncResource);
        const userData = await userDataSyncStoreClient.readResource(syncResource, syncResource === SyncResource.GlobalState ? this.globalStateUserData : null);
        await initializer.initialize(userData);
        this.logService.info(`Initialized ${getSyncAreaLabel(syncResource)}`);
      } catch (error) {
        this.logService.info(`Error while initializing ${getSyncAreaLabel(syncResource)}`);
        this.logService.error(error);
      }
    }));
  }
  createSyncResourceInitializer(syncResource) {
    switch (syncResource) {
      case SyncResource.Settings:
        return new SettingsInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.Keybindings:
        return new KeybindingsInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.Tasks:
        return new TasksInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.Snippets:
        return new SnippetsInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.GlobalState:
        return new GlobalStateInitializer(this.storageService, this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.uriIdentityService);
    }
    throw new Error(`Cannot create initializer for ${syncResource}`);
  }
};
UserDataSyncInitializer = __decorateClass([
  __decorateParam(0, IBrowserWorkbenchEnvironmentService),
  __decorateParam(1, ISecretStorageService),
  __decorateParam(2, IUserDataSyncStoreManagementService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IRequestService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IUriIdentityService)
], UserDataSyncInitializer);
let ExtensionsPreviewInitializer = class extends AbstractExtensionsInitializer {
  constructor(extensionsData, extensionManagementService, ignoredExtensionsManagementService, fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService) {
    super(extensionManagementService, ignoredExtensionsManagementService, fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService);
    this.extensionsData = extensionsData;
    this.preview = null;
  }
  getPreview() {
    if (!this.previewPromise) {
      this.previewPromise = super.initialize(this.extensionsData).then(() => this.preview);
    }
    return this.previewPromise;
  }
  initialize() {
    throw new Error("should not be called directly");
  }
  async doInitialize(remoteUserData) {
    const remoteExtensions = await this.parseExtensions(remoteUserData);
    if (!remoteExtensions) {
      this.logService.info("Skipping initializing extensions because remote extensions does not exist.");
      return;
    }
    const installedExtensions = await this.extensionManagementService.getInstalled();
    this.preview = this.generatePreview(remoteExtensions, installedExtensions);
  }
};
ExtensionsPreviewInitializer = __decorateClass([
  __decorateParam(1, IExtensionManagementService),
  __decorateParam(2, IIgnoredExtensionsManagementService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IEnvironmentService),
  __decorateParam(6, IUserDataSyncLogService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IUriIdentityService)
], ExtensionsPreviewInitializer);
let InstalledExtensionsInitializer = class {
  constructor(extensionsPreviewInitializer, extensionEnablementService, extensionStorageService, logService) {
    this.extensionsPreviewInitializer = extensionsPreviewInitializer;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionStorageService = extensionStorageService;
    this.logService = logService;
  }
  async initialize() {
    const preview = await this.extensionsPreviewInitializer.getPreview();
    if (!preview) {
      return;
    }
    for (const installedExtension of preview.installedExtensions) {
      const syncExtension = preview.remoteExtensions.find(({ identifier }) => areSameExtensions(identifier, installedExtension.identifier));
      if (syncExtension?.state) {
        const extensionState = this.extensionStorageService.getExtensionState(installedExtension, true) || {};
        Object.keys(syncExtension.state).forEach((key) => extensionState[key] = syncExtension.state[key]);
        this.extensionStorageService.setExtensionState(installedExtension, extensionState, true);
      }
    }
    if (preview.disabledExtensions.length) {
      for (const identifier of preview.disabledExtensions) {
        this.logService.trace(`Disabling extension...`, identifier.id);
        await this.extensionEnablementService.disableExtension(identifier);
        this.logService.info(`Disabling extension`, identifier.id);
      }
    }
  }
};
InstalledExtensionsInitializer = __decorateClass([
  __decorateParam(1, IGlobalExtensionEnablementService),
  __decorateParam(2, IExtensionStorageService),
  __decorateParam(3, IUserDataSyncLogService)
], InstalledExtensionsInitializer);
let NewExtensionsInitializer = class {
  constructor(extensionsPreviewInitializer, extensionService, extensionStorageService, galleryService, extensionManagementService, logService) {
    this.extensionsPreviewInitializer = extensionsPreviewInitializer;
    this.extensionService = extensionService;
    this.extensionStorageService = extensionStorageService;
    this.galleryService = galleryService;
    this.extensionManagementService = extensionManagementService;
    this.logService = logService;
  }
  async initialize() {
    const preview = await this.extensionsPreviewInitializer.getPreview();
    if (!preview) {
      return;
    }
    const newlyEnabledExtensions = [];
    const targetPlatform = await this.extensionManagementService.getTargetPlatform();
    const galleryExtensions = await this.galleryService.getExtensions(preview.newExtensions, { targetPlatform, compatible: true }, CancellationToken.None);
    for (const galleryExtension of galleryExtensions) {
      try {
        const extensionToSync = preview.remoteExtensions.find(({ identifier }) => areSameExtensions(identifier, galleryExtension.identifier));
        if (!extensionToSync) {
          continue;
        }
        if (extensionToSync.state) {
          this.extensionStorageService.setExtensionState(galleryExtension, extensionToSync.state, true);
        }
        this.logService.trace(`Installing extension...`, galleryExtension.identifier.id);
        const local = await this.extensionManagementService.installFromGallery(galleryExtension, {
          isMachineScoped: false,
          /* set isMachineScoped to prevent install and sync dialog in web */
          donotIncludePackAndDependencies: true,
          installGivenVersion: !!extensionToSync.version,
          installPreReleaseVersion: extensionToSync.preRelease,
          context: { [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true }
        });
        if (!preview.disabledExtensions.some((identifier) => areSameExtensions(identifier, galleryExtension.identifier))) {
          newlyEnabledExtensions.push(local);
        }
        this.logService.info(`Installed extension.`, galleryExtension.identifier.id);
      } catch (error) {
        this.logService.error(error);
      }
    }
    const canEnabledExtensions = newlyEnabledExtensions.filter((e) => this.extensionService.canAddExtension(toExtensionDescription(e)));
    if (!await this.areExtensionsRunning(canEnabledExtensions)) {
      await new Promise((c, e) => {
        const disposable = this.extensionService.onDidChangeExtensions(async () => {
          try {
            if (await this.areExtensionsRunning(canEnabledExtensions)) {
              disposable.dispose();
              c();
            }
          } catch (error) {
            e(error);
          }
        });
      });
    }
  }
  async areExtensionsRunning(extensions) {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const runningExtensions = this.extensionService.extensions;
    return extensions.every((e) => runningExtensions.some((r) => areSameExtensions({ id: r.identifier.value }, e.identifier)));
  }
};
NewExtensionsInitializer = __decorateClass([
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IExtensionStorageService),
  __decorateParam(3, IExtensionGalleryService),
  __decorateParam(4, IExtensionManagementService),
  __decorateParam(5, IUserDataSyncLogService)
], NewExtensionsInitializer);
export {
  UserDataSyncInitializer
};
