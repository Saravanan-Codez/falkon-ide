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
import * as fs from "fs";
import electron from "electron";
import { Emitter } from "../../../base/common/event.js";
import { parse } from "../../../base/common/json.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { dirname, join } from "../../../base/common/path.js";
import { basename, extUriBiasedIgnorePathCase, joinPath, originalFSPath } from "../../../base/common/resources.js";
import { Promises } from "../../../base/node/pfs.js";
import { localize } from "../../../nls.js";
import { IBackupMainService } from "../../backup/electron-main/backup.js";
import { IDialogMainService } from "../../dialogs/electron-main/dialogMainService.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IUserDataProfilesMainService } from "../../userDataProfile/electron-main/userDataProfile.js";
import { findWindowOnWorkspaceOrFolder } from "../../windows/electron-main/windowsFinder.js";
import { isWorkspaceIdentifier, hasWorkspaceFileExtension, UNTITLED_WORKSPACE_NAME, isUntitledWorkspace } from "../../workspace/common/workspace.js";
import { getStoredWorkspaceFolder, isStoredWorkspaceFolder, toWorkspaceFolders } from "../common/workspaces.js";
import { getWorkspaceIdentifier } from "../node/workspaces.js";
const IWorkspacesManagementMainService = createDecorator("workspacesManagementMainService");
let WorkspacesManagementMainService = class extends Disposable {
  constructor(environmentMainService, logService, userDataProfilesMainService, backupMainService, dialogMainService) {
    super();
    this.environmentMainService = environmentMainService;
    this.logService = logService;
    this.userDataProfilesMainService = userDataProfilesMainService;
    this.backupMainService = backupMainService;
    this.dialogMainService = dialogMainService;
    this._onDidDeleteUntitledWorkspace = this._register(new Emitter());
    this.onDidDeleteUntitledWorkspace = this._onDidDeleteUntitledWorkspace.event;
    this._onDidEnterWorkspace = this._register(new Emitter());
    this.onDidEnterWorkspace = this._onDidEnterWorkspace.event;
    // local URI that contains all untitled workspaces
    this.untitledWorkspaces = [];
    this.untitledWorkspacesHome = this.environmentMainService.untitledWorkspacesHome;
  }
  async initialize() {
    this.untitledWorkspaces = [];
    try {
      const untitledWorkspacePaths = (await Promises.readdir(this.untitledWorkspacesHome.with({ scheme: Schemas.file }).fsPath)).map((folder) => joinPath(this.untitledWorkspacesHome, folder, UNTITLED_WORKSPACE_NAME));
      for (const untitledWorkspacePath of untitledWorkspacePaths) {
        const workspace = getWorkspaceIdentifier(untitledWorkspacePath);
        const resolvedWorkspace = await this.resolveLocalWorkspace(untitledWorkspacePath);
        if (!resolvedWorkspace) {
          await this.deleteUntitledWorkspace(workspace);
        } else {
          this.untitledWorkspaces.push({ workspace, remoteAuthority: resolvedWorkspace.remoteAuthority });
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        this.logService.warn(`Unable to read folders in ${this.untitledWorkspacesHome} (${error}).`);
      }
    }
  }
  resolveLocalWorkspace(uri) {
    return this.doResolveLocalWorkspace(uri, (path) => fs.promises.readFile(path, "utf8"));
  }
  doResolveLocalWorkspace(uri, contentsFn) {
    if (!this.isWorkspacePath(uri)) {
      return void 0;
    }
    if (uri.scheme !== Schemas.file) {
      return void 0;
    }
    try {
      const contents = contentsFn(uri.fsPath);
      if (contents instanceof Promise) {
        return contents.then(
          (value) => this.doResolveWorkspace(uri, value),
          (error) => void 0
          /* invalid workspace */
        );
      } else {
        return this.doResolveWorkspace(uri, contents);
      }
    } catch {
      return void 0;
    }
  }
  isWorkspacePath(uri) {
    return isUntitledWorkspace(uri, this.environmentMainService) || hasWorkspaceFileExtension(uri);
  }
  doResolveWorkspace(path, contents) {
    try {
      const workspace = this.doParseStoredWorkspace(path, contents);
      const workspaceIdentifier = getWorkspaceIdentifier(path);
      return {
        id: workspaceIdentifier.id,
        configPath: workspaceIdentifier.configPath,
        folders: toWorkspaceFolders(workspace.folders, workspaceIdentifier.configPath, extUriBiasedIgnorePathCase),
        remoteAuthority: workspace.remoteAuthority,
        transient: workspace.transient
      };
    } catch (error) {
      this.logService.warn(error.toString());
    }
    return void 0;
  }
  doParseStoredWorkspace(path, contents) {
    const storedWorkspace = parse(contents);
    if (storedWorkspace && Array.isArray(storedWorkspace.folders)) {
      storedWorkspace.folders = storedWorkspace.folders.filter((folder) => isStoredWorkspaceFolder(folder));
    } else {
      throw new Error(`${path.toString(true)} looks like an invalid workspace file.`);
    }
    return storedWorkspace;
  }
  async createUntitledWorkspace(folders, remoteAuthority) {
    const { workspace, storedWorkspace } = this.newUntitledWorkspace(folders, remoteAuthority);
    const configPath = workspace.configPath.fsPath;
    await fs.promises.mkdir(dirname(configPath), { recursive: true });
    await Promises.writeFile(configPath, JSON.stringify(storedWorkspace, null, "	"));
    this.untitledWorkspaces.push({ workspace, remoteAuthority });
    return workspace;
  }
  newUntitledWorkspace(folders = [], remoteAuthority) {
    const randomId = (Date.now() + Math.round(Math.random() * 1e3)).toString();
    const untitledWorkspaceConfigFolder = joinPath(this.untitledWorkspacesHome, randomId);
    const untitledWorkspaceConfigPath = joinPath(untitledWorkspaceConfigFolder, UNTITLED_WORKSPACE_NAME);
    const storedWorkspaceFolder = [];
    for (const folder of folders) {
      storedWorkspaceFolder.push(getStoredWorkspaceFolder(folder.uri, true, folder.name, untitledWorkspaceConfigFolder, extUriBiasedIgnorePathCase));
    }
    return {
      workspace: getWorkspaceIdentifier(untitledWorkspaceConfigPath),
      storedWorkspace: { folders: storedWorkspaceFolder, remoteAuthority }
    };
  }
  async getWorkspaceIdentifier(configPath) {
    return getWorkspaceIdentifier(configPath);
  }
  isUntitledWorkspace(workspace) {
    return isUntitledWorkspace(workspace.configPath, this.environmentMainService);
  }
  async deleteUntitledWorkspace(workspace) {
    if (!this.isUntitledWorkspace(workspace)) {
      return;
    }
    await this.doDeleteUntitledWorkspace(workspace);
    this.userDataProfilesMainService.unsetWorkspace(workspace);
    this._onDidDeleteUntitledWorkspace.fire(workspace);
  }
  async doDeleteUntitledWorkspace(workspace) {
    const configPath = originalFSPath(workspace.configPath);
    try {
      await Promises.rm(dirname(configPath));
      const workspaceStoragePath = join(this.environmentMainService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath, workspace.id);
      if (await Promises.exists(workspaceStoragePath)) {
        await Promises.writeFile(join(workspaceStoragePath, "obsolete"), "");
      }
      this.untitledWorkspaces = this.untitledWorkspaces.filter((untitledWorkspace) => untitledWorkspace.workspace.id !== workspace.id);
    } catch (error) {
      this.logService.warn(`Unable to delete untitled workspace ${configPath} (${error}).`);
    }
  }
  getUntitledWorkspaces() {
    return this.untitledWorkspaces;
  }
  async enterWorkspace(window, windows, path) {
    if (!window?.win || !window.isReady) {
      return void 0;
    }
    const isValid = await this.isValidTargetWorkspacePath(window, windows, path);
    if (!isValid) {
      return void 0;
    }
    const result = await this.doEnterWorkspace(window, getWorkspaceIdentifier(path));
    if (!result) {
      return void 0;
    }
    this._onDidEnterWorkspace.fire({ window, workspace: result.workspace });
    return result;
  }
  async isValidTargetWorkspacePath(window, windows, workspacePath) {
    if (!workspacePath) {
      return true;
    }
    if (isWorkspaceIdentifier(window.openedWorkspace) && extUriBiasedIgnorePathCase.isEqual(window.openedWorkspace.configPath, workspacePath)) {
      return false;
    }
    if (findWindowOnWorkspaceOrFolder(windows, workspacePath)) {
      await this.dialogMainService.showMessageBox({
        type: "info",
        buttons: [localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK")],
        message: localize("workspaceOpenedMessage", "Unable to save workspace '{0}'", basename(workspacePath)),
        detail: localize("workspaceOpenedDetail", "The workspace is already opened in another window. Please close that window first and then try again.")
      }, electron.BrowserWindow.getFocusedWindow() ?? void 0);
      return false;
    }
    return true;
  }
  async doEnterWorkspace(window, workspace) {
    if (!window.config) {
      return void 0;
    }
    window.focus();
    let backupPath;
    if (!window.config.extensionDevelopmentPath) {
      if (window.config.backupPath) {
        backupPath = await this.backupMainService.registerWorkspaceBackup({ workspace, remoteAuthority: window.remoteAuthority }, window.config.backupPath);
      } else {
        backupPath = this.backupMainService.registerWorkspaceBackup({ workspace, remoteAuthority: window.remoteAuthority });
      }
    }
    if (isWorkspaceIdentifier(window.openedWorkspace) && this.isUntitledWorkspace(window.openedWorkspace)) {
      await this.deleteUntitledWorkspace(window.openedWorkspace);
    }
    window.config.workspace = workspace;
    window.config.backupPath = backupPath;
    return { workspace, backupPath };
  }
};
WorkspacesManagementMainService = __decorateClass([
  __decorateParam(0, IEnvironmentMainService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IUserDataProfilesMainService),
  __decorateParam(3, IBackupMainService),
  __decorateParam(4, IDialogMainService)
], WorkspacesManagementMainService);
export {
  IWorkspacesManagementMainService,
  WorkspacesManagementMainService
};
