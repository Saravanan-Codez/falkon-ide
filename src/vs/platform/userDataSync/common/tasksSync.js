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
import { VSBuffer } from "../../../base/common/buffer.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { AbstractJsonSynchronizer } from "./abstractJsonSynchronizer.js";
import { AbstractInitializer } from "./abstractSynchronizer.js";
import { IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncStoreService, SyncResource } from "./userDataSync.js";
function getTasksContentFromSyncContent(syncContent, logService) {
  try {
    const parsed = JSON.parse(syncContent);
    return parsed.tasks ?? null;
  } catch (e) {
    logService.error(e);
    return null;
  }
}
let TasksSynchroniser = class extends AbstractJsonSynchronizer {
  constructor(profile, collection, userDataSyncStoreService, userDataSyncLocalStoreService, logService, configurationService, userDataSyncEnablementService, fileService, environmentService, storageService, telemetryService, uriIdentityService) {
    super(profile.tasksResource, { syncResource: SyncResource.Tasks, profile }, collection, "tasks.json", fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService);
  }
  getContentFromSyncContent(syncContent) {
    return getTasksContentFromSyncContent(syncContent, this.logService);
  }
  toSyncContent(tasks) {
    return tasks ? { tasks } : {};
  }
};
TasksSynchroniser = __decorateClass([
  __decorateParam(2, IUserDataSyncStoreService),
  __decorateParam(3, IUserDataSyncLocalStoreService),
  __decorateParam(4, IUserDataSyncLogService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IUserDataSyncEnablementService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IEnvironmentService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, IUriIdentityService)
], TasksSynchroniser);
let TasksInitializer = class extends AbstractInitializer {
  constructor(fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService) {
    super(SyncResource.Tasks, userDataProfilesService, environmentService, logService, fileService, storageService, uriIdentityService);
    this.tasksResource = this.userDataProfilesService.defaultProfile.tasksResource;
  }
  async doInitialize(remoteUserData) {
    const tasksContent = remoteUserData.syncData ? getTasksContentFromSyncContent(remoteUserData.syncData.content, this.logService) : null;
    if (!tasksContent) {
      this.logService.info("Skipping initializing tasks because remote tasks does not exist.");
      return;
    }
    const isEmpty = await this.isEmpty();
    if (!isEmpty) {
      this.logService.info("Skipping initializing tasks because local tasks exist.");
      return;
    }
    await this.fileService.writeFile(this.tasksResource, VSBuffer.fromString(tasksContent));
    await this.updateLastSyncUserData(remoteUserData);
  }
  async isEmpty() {
    return this.fileService.exists(this.tasksResource);
  }
};
TasksInitializer = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, IUserDataSyncLogService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IUriIdentityService)
], TasksInitializer);
export {
  TasksInitializer,
  TasksSynchroniser,
  getTasksContentFromSyncContent
};
