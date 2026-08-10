import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IUserDataSyncEnablementService, SyncResource } from "../../../../platform/userDataSync/common/userDataSync.js";
import { UserDataSyncEnablementService as BaseUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSyncEnablementService.js";
class UserDataSyncEnablementService extends BaseUserDataSyncEnablementService {
  get workbenchEnvironmentService() {
    return this.environmentService;
  }
  getResourceSyncStateVersion(resource) {
    return resource === SyncResource.Extensions ? this.workbenchEnvironmentService.options?.settingsSyncOptions?.extensionsSyncStateVersion : void 0;
  }
}
registerSingleton(IUserDataSyncEnablementService, UserDataSyncEnablementService, InstantiationType.Delayed);
export {
  UserDataSyncEnablementService
};
