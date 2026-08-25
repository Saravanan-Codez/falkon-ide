import { Emitter, Event } from "../../../../base/common/event.js";
import { Queue } from "../../../../base/common/async.js";
import { removeTrailingPathSeparator } from "../../../../base/common/resources.js";
import { Workspace, WorkspaceFolder, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { getWorkspaceIdentifier } from "../../../../platform/workspaces/common/workspaceIdentifier.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
class SessionsWorkspaceContextService extends Disposable {
  constructor(workspaceIdentifier, uriIdentityService) {
    super();
    this.uriIdentityService = uriIdentityService;
    this.onDidChangeWorkbenchState = Event.None;
    this.onDidChangeWorkspaceName = Event.None;
    this.onDidEnterWorkspace = Event.None;
    this._onWillChangeWorkspaceFolders = new Emitter();
    this.onWillChangeWorkspaceFolders = this._onWillChangeWorkspaceFolders.event;
    this._onDidChangeWorkspaceFolders = this._register(new Emitter());
    this.onDidChangeWorkspaceFolders = this._onDidChangeWorkspaceFolders.event;
    this._updateFoldersQueue = this._register(new Queue());
    this.workspace = new Workspace(workspaceIdentifier.id, [], false, workspaceIdentifier.configPath, (uri) => uriIdentityService.extUri.ignorePathCasing(uri), localize("agentsWindow", "Agents Window"));
  }
  getCompleteWorkspace() {
    return Promise.resolve(this.workspace);
  }
  getWorkspace() {
    return this.workspace;
  }
  getWorkbenchState() {
    return WorkbenchState.WORKSPACE;
  }
  hasWorkspaceData() {
    return true;
  }
  getWorkspaceFolder(resource) {
    return this.workspace.getFolder(resource);
  }
  isInsideWorkspace(resource) {
    return !!this.getWorkspaceFolder(resource);
  }
  isCurrentWorkspace(workspaceIdOrFolder) {
    return false;
  }
  addFolders(foldersToAdd) {
    return this.doUpdateFolders(foldersToAdd, []);
  }
  removeFolders(foldersToRemove) {
    return this.doUpdateFolders([], foldersToRemove);
  }
  async updateFolders(index, deleteCount, foldersToAddCandidates) {
    const folders = this.workspace.folders;
    let foldersToDelete = [];
    if (typeof deleteCount === "number") {
      foldersToDelete = folders.slice(index, index + deleteCount).map((folder) => folder.uri);
    }
    let foldersToAdd = [];
    if (Array.isArray(foldersToAddCandidates)) {
      foldersToAdd = foldersToAddCandidates.map((folderToAdd) => ({ uri: removeTrailingPathSeparator(folderToAdd.uri), name: folderToAdd.name }));
    }
    return this.doUpdateFolders(foldersToAdd, foldersToDelete, index);
  }
  async enterWorkspace(_path) {
  }
  async createAndEnterWorkspace(_folders, _path) {
  }
  async saveAndEnterWorkspace(_path) {
  }
  async copyWorkspaceSettings(_toWorkspace) {
  }
  async pickNewWorkspacePath() {
    return void 0;
  }
  doUpdateFolders(foldersToAdd, foldersToRemove, index) {
    return this._updateFoldersQueue.queue(() => this._doUpdateFolders(foldersToAdd, foldersToRemove, index));
  }
  async _doUpdateFolders(foldersToAdd, foldersToRemove, index) {
    if (foldersToAdd.length === 0 && foldersToRemove.length === 0) {
      return;
    }
    const currentFolders = this.workspace.folders;
    let newFolders = currentFolders.filter(
      (folder) => !foldersToRemove.some((toRemove) => this.uriIdentityService.extUri.isEqual(folder.uri, toRemove))
    );
    const foldersToAddWorkspaceFolders = foldersToAdd.filter((folderToAdd) => !newFolders.some((existing) => this.uriIdentityService.extUri.isEqual(existing.uri, folderToAdd.uri))).map((folderToAdd) => new WorkspaceFolder(
      { uri: folderToAdd.uri, name: folderToAdd.name || this.uriIdentityService.extUri.basenameOrAuthority(folderToAdd.uri), index: 0 },
      { uri: folderToAdd.uri.toString() }
    ));
    if (foldersToAddWorkspaceFolders.length > 0) {
      if (typeof index === "number" && index >= 0 && index < newFolders.length) {
        newFolders = [...newFolders.slice(0, index), ...foldersToAddWorkspaceFolders, ...newFolders.slice(index)];
      } else {
        newFolders = [...newFolders, ...foldersToAddWorkspaceFolders];
      }
    }
    newFolders = newFolders.map((f, i) => new WorkspaceFolder({ uri: f.uri, name: f.name, index: i }, f.raw));
    const added = newFolders.filter((folder) => !currentFolders.some((existing) => this.uriIdentityService.extUri.isEqual(existing.uri, folder.uri)));
    const removed = currentFolders.filter((folder) => !newFolders.some((existing) => this.uriIdentityService.extUri.isEqual(existing.uri, folder.uri)));
    const changed = [];
    const changes = { added, removed, changed };
    if (added.length === 0 && removed.length === 0) {
      return;
    }
    const joinPromises = [];
    this._onWillChangeWorkspaceFolders.fire({
      changes,
      fromCache: false,
      join(promise) {
        joinPromises.push(promise);
      }
    });
    await Promise.allSettled(joinPromises);
    const workspaceIdentifier = getWorkspaceIdentifier(this.workspace.configuration);
    const workspace = new Workspace(workspaceIdentifier.id, newFolders, false, workspaceIdentifier.configPath, (uri) => this.uriIdentityService.extUri.ignorePathCasing(uri), this.workspace.name);
    this.workspace.update(workspace);
    this._onDidChangeWorkspaceFolders.fire(changes);
  }
}
export {
  SessionsWorkspaceContextService
};
