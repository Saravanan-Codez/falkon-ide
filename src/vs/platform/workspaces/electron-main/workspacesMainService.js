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
import { IBackupMainService } from "../../backup/electron-main/backup.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
import { IWorkspacesHistoryMainService } from "./workspacesHistoryMainService.js";
import { IWorkspacesManagementMainService } from "./workspacesManagementMainService.js";
let WorkspacesMainService = class {
  constructor(workspacesManagementMainService, windowsMainService, workspacesHistoryMainService, backupMainService) {
    this.workspacesManagementMainService = workspacesManagementMainService;
    this.windowsMainService = windowsMainService;
    this.workspacesHistoryMainService = workspacesHistoryMainService;
    this.backupMainService = backupMainService;
    this.onDidChangeRecentlyOpened = this.workspacesHistoryMainService.onDidChangeRecentlyOpened;
  }
  //#region Workspace Management
  async enterWorkspace(windowId, path) {
    const window = this.windowsMainService.getWindowById(windowId);
    if (window) {
      return this.workspacesManagementMainService.enterWorkspace(window, this.windowsMainService.getWindows(), path);
    }
    return void 0;
  }
  createUntitledWorkspace(windowId, folders, remoteAuthority) {
    return this.workspacesManagementMainService.createUntitledWorkspace(folders, remoteAuthority);
  }
  deleteUntitledWorkspace(windowId, workspace) {
    return this.workspacesManagementMainService.deleteUntitledWorkspace(workspace);
  }
  getWorkspaceIdentifier(windowId, workspacePath) {
    return this.workspacesManagementMainService.getWorkspaceIdentifier(workspacePath);
  }
  getRecentlyOpened(windowId) {
    return this.workspacesHistoryMainService.getRecentlyOpened();
  }
  addRecentlyOpened(windowId, recents) {
    return this.workspacesHistoryMainService.addRecentlyOpened(recents);
  }
  removeRecentlyOpened(windowId, paths) {
    return this.workspacesHistoryMainService.removeRecentlyOpened(paths);
  }
  clearRecentlyOpened(windowId) {
    return this.workspacesHistoryMainService.clearRecentlyOpened();
  }
  //#endregion
  //#region Dirty Workspaces
  async getDirtyWorkspaces() {
    return this.backupMainService.getDirtyWorkspaces();
  }
  //#endregion
};
WorkspacesMainService = __decorateClass([
  __decorateParam(0, IWorkspacesManagementMainService),
  __decorateParam(1, IWindowsMainService),
  __decorateParam(2, IWorkspacesHistoryMainService),
  __decorateParam(3, IBackupMainService)
], WorkspacesMainService);
export {
  WorkspacesMainService
};
