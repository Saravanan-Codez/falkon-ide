import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IUserDataSyncEnablementService, SyncResource } from "../../../../platform/userDataSync/common/userDataSync.js";
import { UserDataSyncEnablementService } from "./userDataSyncEnablementService.js";
class WebUserDataSyncEnablementService extends UserDataSyncEnablementService {
  constructor() {
    super(...arguments);
    this.enabled = void 0;
  }
  canToggleEnablement() {
    return this.isTrusted() && super.canToggleEnablement();
  }
  isEnabled() {
    if (!this.isTrusted()) {
      return false;
    }
    if (this.enabled === void 0) {
      this.enabled = this.workbenchEnvironmentService.options?.settingsSyncOptions?.enabled;
    }
    if (this.enabled === void 0) {
      this.enabled = super.isEnabled();
    }
    return this.enabled;
  }
  setEnablement(enabled) {
    if (enabled && !this.canToggleEnablement()) {
      return;
    }
    if (this.enabled !== enabled) {
      this.enabled = enabled;
      super.setEnablement(enabled);
    }
  }
  getResourceSyncStateVersion(resource) {
    return resource === SyncResource.Extensions ? this.workbenchEnvironmentService.options?.settingsSyncOptions?.extensionsSyncStateVersion : void 0;
  }
  isTrusted() {
    return !!this.workbenchEnvironmentService.options?.workspaceProvider?.trusted;
  }
}
registerSingleton(IUserDataSyncEnablementService, WebUserDataSyncEnablementService, InstantiationType.Delayed);
export {
  WebUserDataSyncEnablementService
};
