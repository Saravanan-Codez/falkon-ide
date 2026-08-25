import { Storage, MigratingStorage } from "../../../../base/parts/storage/common/storage.js";
import { RemoteStorageService } from "../../../../platform/storage/common/storageService.js";
import { FallbackApplicationStorageDatabaseClient, ApplicationSharedStorageDatabaseClient } from "../../../../platform/storage/common/storageIpc.js";
import { StorageScope } from "../../../../platform/storage/common/storage.js";
class NativeWorkbenchStorageService extends RemoteStorageService {
  constructor(workspace, userDataProfileService, userDataProfilesService, mainProcessService, workbenchEnvironmentService) {
    super(workspace, { currentProfile: userDataProfileService.currentProfile, defaultProfile: userDataProfilesService.defaultProfile }, mainProcessService, workbenchEnvironmentService);
    this.userDataProfileService = userDataProfileService;
    this.workbenchEnvironmentService = workbenchEnvironmentService;
    this.registerListeners();
  }
  createApplicationSharedStorage() {
    const channel = this.remoteService.getChannel("storage");
    const storageDataBaseClient = this._register(new ApplicationSharedStorageDatabaseClient(channel));
    const applicationSharedStorage = this._register(new MigratingStorage(storageDataBaseClient));
    this._register(applicationSharedStorage.onDidChangeStorage((e) => this.emitDidChangeValue(StorageScope.APPLICATION_SHARED, e)));
    return applicationSharedStorage;
  }
  async doInitialize() {
    await super.doInitialize();
    const applicationSharedStorage = this.getStorage(StorageScope.APPLICATION_SHARED);
    if (applicationSharedStorage instanceof MigratingStorage) {
      let applicationSharedFallbackStorage;
      if (this.workbenchEnvironmentService.isSessionsWindow) {
        const channel = this.remoteService.getChannel("storage");
        applicationSharedFallbackStorage = this._register(new Storage(this._register(new FallbackApplicationStorageDatabaseClient(channel))));
        await applicationSharedFallbackStorage.init();
      } else {
        applicationSharedFallbackStorage = this.getStorage(StorageScope.APPLICATION);
      }
      if (applicationSharedFallbackStorage) {
        applicationSharedStorage.setFallbackStorage(applicationSharedFallbackStorage, this.workbenchEnvironmentService.isSessionsWindow);
      }
    }
  }
  registerListeners() {
    this._register(this.userDataProfileService.onDidChangeCurrentProfile((e) => e.join(this.switchToProfile(e.profile))));
  }
}
export {
  NativeWorkbenchStorageService
};
