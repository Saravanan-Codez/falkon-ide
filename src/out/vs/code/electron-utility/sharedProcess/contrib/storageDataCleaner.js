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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { join } from "../../../../base/common/path.js";
import { Promises } from "../../../../base/node/pfs.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { StorageClient } from "../../../../platform/storage/common/storageIpc.js";
import { EXTENSION_DEVELOPMENT_EMPTY_WINDOW_WORKSPACE } from "../../../../platform/workspace/common/workspace.js";
import { getWorkspaceIdentifier } from "../../../../platform/workspaces/common/workspaceIdentifier.js";
import { NON_EMPTY_WORKSPACE_ID_LENGTH } from "../../../../platform/workspaces/node/workspaces.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { Schemas } from "../../../../base/common/network.js";
let UnusedWorkspaceStorageDataCleaner = class extends Disposable {
  constructor(environmentService, logService, nativeHostService, mainProcessService) {
    super();
    this.environmentService = environmentService;
    this.logService = logService;
    this.nativeHostService = nativeHostService;
    this.mainProcessService = mainProcessService;
    const scheduler = this._register(new RunOnceScheduler(
      () => {
        this.cleanUpStorage();
      },
      30 * 1e3
      /* after 30s */
    ));
    scheduler.schedule();
  }
  /**
   * Public for testing.
   */
  async cleanUpStorage() {
    this.logService.trace("[storage cleanup]: Starting to clean up workspace storage folders for unused empty workspaces.");
    try {
      const workspaceStorageHome = this.environmentService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath;
      const workspaceStorageFolders = await Promises.readdir(workspaceStorageHome);
      const storageClient = new StorageClient(this.mainProcessService.getChannel("storage"));
      await Promise.all(workspaceStorageFolders.map(async (workspaceStorageFolder) => {
        const workspaceStoragePath = join(workspaceStorageHome, workspaceStorageFolder);
        if (workspaceStorageFolder.length === NON_EMPTY_WORKSPACE_ID_LENGTH) {
          return;
        }
        if (workspaceStorageFolder === EXTENSION_DEVELOPMENT_EMPTY_WINDOW_WORKSPACE.id) {
          return;
        }
        if (workspaceStorageFolder === getWorkspaceIdentifier(this.environmentService.agentSessionsWorkspace).id) {
          return;
        }
        const windows = await this.nativeHostService.getWindows({ includeAuxiliaryWindows: false });
        if (windows.some((window) => window.workspace?.id === workspaceStorageFolder)) {
          return;
        }
        const isStorageUsed = await storageClient.isUsed(workspaceStoragePath);
        if (isStorageUsed) {
          return;
        }
        this.logService.trace(`[storage cleanup]: Deleting workspace storage folder ${workspaceStorageFolder} as it seems to be an unused empty workspace.`);
        await Promises.rm(workspaceStoragePath);
      }));
    } catch (error) {
      onUnexpectedError(error);
    }
  }
};
UnusedWorkspaceStorageDataCleaner = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, ILogService),
  __decorateParam(2, INativeHostService),
  __decorateParam(3, IMainProcessService)
], UnusedWorkspaceStorageDataCleaner);
export {
  UnusedWorkspaceStorageDataCleaner
};
