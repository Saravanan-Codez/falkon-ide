import { Promises } from "../../../base/common/async.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { joinPath } from "../../../base/common/resources.js";
import { Storage } from "../../../base/parts/storage/common/storage.js";
import { AbstractStorageService, isProfileUsingDefaultStorage, StorageScope, WillSaveStateReason } from "./storage.js";
import { ApplicationStorageDatabaseClient, ApplicationSharedStorageDatabaseClient, ProfileStorageDatabaseClient, WorkspaceStorageDatabaseClient } from "./storageIpc.js";
import { isUserDataProfile } from "../../userDataProfile/common/userDataProfile.js";
class RemoteStorageService extends AbstractStorageService {
  constructor(initialWorkspace, initialProfiles, remoteService, environmentService) {
    super();
    this.remoteService = remoteService;
    this.environmentService = environmentService;
    this.profileStorageDisposables = this._register(new DisposableStore());
    this.workspaceStorageDisposables = this._register(new DisposableStore());
    this.applicationStorageProfile = initialProfiles.defaultProfile;
    this.applicationStorage = this.createApplicationStorage();
    this.applicationSharedStorage = this.createApplicationSharedStorage();
    this.profileStorageProfile = initialProfiles.currentProfile;
    this.profileStorage = this.createProfileStorage(this.profileStorageProfile);
    this.workspaceStorageId = initialWorkspace?.id;
    this.workspaceStorage = this.createWorkspaceStorage(initialWorkspace);
  }
  createApplicationStorage() {
    const storageDataBaseClient = this._register(new ApplicationStorageDatabaseClient(this.remoteService.getChannel("storage")));
    const applicationStorage = this._register(new Storage(storageDataBaseClient));
    this._register(applicationStorage.onDidChangeStorage((e) => this.emitDidChangeValue(StorageScope.APPLICATION, e)));
    return applicationStorage;
  }
  createApplicationSharedStorage() {
    const storageDataBaseClient = this._register(new ApplicationSharedStorageDatabaseClient(this.remoteService.getChannel("storage")));
    const applicationSharedStorage = this._register(new Storage(storageDataBaseClient));
    this._register(applicationSharedStorage.onDidChangeStorage((e) => this.emitDidChangeValue(StorageScope.APPLICATION_SHARED, e)));
    return applicationSharedStorage;
  }
  createProfileStorage(profile) {
    this.profileStorageDisposables.clear();
    this.profileStorageProfile = profile;
    let profileStorage;
    if (isProfileUsingDefaultStorage(profile)) {
      profileStorage = this.applicationStorage;
    } else {
      const storageDataBaseClient = this.profileStorageDisposables.add(new ProfileStorageDatabaseClient(this.remoteService.getChannel("storage"), profile));
      profileStorage = this.profileStorageDisposables.add(new Storage(storageDataBaseClient));
    }
    this.profileStorageDisposables.add(profileStorage.onDidChangeStorage((e) => this.emitDidChangeValue(StorageScope.PROFILE, e)));
    return profileStorage;
  }
  createWorkspaceStorage(workspace) {
    this.workspaceStorageDisposables.clear();
    this.workspaceStorageId = workspace?.id;
    let workspaceStorage = void 0;
    if (workspace) {
      const storageDataBaseClient = this.workspaceStorageDisposables.add(new WorkspaceStorageDatabaseClient(this.remoteService.getChannel("storage"), workspace));
      workspaceStorage = this.workspaceStorageDisposables.add(new Storage(storageDataBaseClient));
      this.workspaceStorageDisposables.add(workspaceStorage.onDidChangeStorage((e) => this.emitDidChangeValue(StorageScope.WORKSPACE, e)));
    }
    return workspaceStorage;
  }
  async doInitialize() {
    await Promises.settled([
      this.applicationStorage.init(),
      this.applicationSharedStorage.init(),
      this.profileStorage.init(),
      this.workspaceStorage?.init() ?? Promise.resolve()
    ]);
  }
  getStorage(scope) {
    switch (scope) {
      case StorageScope.APPLICATION_SHARED:
        return this.applicationSharedStorage;
      case StorageScope.APPLICATION:
        return this.applicationStorage;
      case StorageScope.PROFILE:
        return this.profileStorage;
      default:
        return this.workspaceStorage;
    }
  }
  getLogDetails(scope) {
    switch (scope) {
      case StorageScope.APPLICATION_SHARED:
        return joinPath(this.environmentService.appSharedDataHome, "sharedStorage").with({ scheme: Schemas.file }).fsPath;
      case StorageScope.APPLICATION:
        return this.applicationStorageProfile.globalStorageHome.with({ scheme: Schemas.file }).fsPath;
      case StorageScope.PROFILE:
        return this.profileStorageProfile?.globalStorageHome.with({ scheme: Schemas.file }).fsPath;
      default:
        return this.workspaceStorageId ? `${joinPath(this.environmentService.workspaceStorageHome, this.workspaceStorageId, "state.vscdb").with({ scheme: Schemas.file }).fsPath}` : void 0;
    }
  }
  async close() {
    this.stopFlushWhenIdle();
    this.emitWillSaveState(WillSaveStateReason.SHUTDOWN);
    await Promises.settled([
      this.applicationStorage.close(),
      this.applicationSharedStorage.close(),
      this.profileStorage.close(),
      this.workspaceStorage?.close() ?? Promise.resolve()
    ]);
  }
  async switchToProfile(toProfile) {
    if (!this.canSwitchProfile(this.profileStorageProfile, toProfile)) {
      return;
    }
    const oldProfileStorage = this.profileStorage;
    const oldItems = oldProfileStorage.items;
    if (oldProfileStorage !== this.applicationStorage) {
      await oldProfileStorage.close();
    }
    this.profileStorage = this.createProfileStorage(toProfile);
    await this.profileStorage.init();
    this.switchData(oldItems, this.profileStorage, StorageScope.PROFILE);
  }
  async switchToWorkspace(toWorkspace, preserveData) {
    const oldWorkspaceStorage = this.workspaceStorage;
    const oldItems = oldWorkspaceStorage?.items ?? /* @__PURE__ */ new Map();
    await oldWorkspaceStorage?.close();
    this.workspaceStorage = this.createWorkspaceStorage(toWorkspace);
    await this.workspaceStorage.init();
    this.switchData(oldItems, this.workspaceStorage, StorageScope.WORKSPACE);
  }
  hasScope(scope) {
    if (isUserDataProfile(scope)) {
      return this.profileStorageProfile.id === scope.id;
    }
    return this.workspaceStorageId === scope.id;
  }
}
export {
  RemoteStorageService
};
