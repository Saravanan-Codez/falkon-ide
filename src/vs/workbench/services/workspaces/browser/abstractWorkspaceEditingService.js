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
import { localize } from "../../../../nls.js";
import { hasWorkspaceFileExtension, isSavedWorkspace, isUntitledWorkspace, isWorkspaceIdentifier, IWorkspaceContextService, toWorkspaceIdentifier, WorkbenchState, WORKSPACE_EXTENSION, WORKSPACE_FILTER } from "../../../../platform/workspace/common/workspace.js";
import { IJSONEditingService, JSONEditingErrorCode } from "../../configuration/common/jsonEditing.js";
import { IWorkspacesService, rewriteWorkspaceFileForNewLocation } from "../../../../platform/workspaces/common/workspaces.js";
import { ConfigurationScope, Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { distinct } from "../../../../base/common/arrays.js";
import { basename, isEqual, isEqualAuthority, joinPath, removeTrailingPathSeparator } from "../../../../base/common/resources.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IFileDialogService, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { IHostService } from "../../host/browser/host.js";
import { Schemas } from "../../../../base/common/network.js";
import { SaveReason } from "../../../common/editor.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchConfigurationService } from "../../configuration/common/configuration.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Promises } from "../../../../base/common/async.js";
class DidEnterWorkspaceEvent {
  constructor(oldWorkspace, newWorkspace) {
    this.oldWorkspace = oldWorkspace;
    this.newWorkspace = newWorkspace;
    this.promises = [];
  }
  join(promise) {
    this.promises.push(promise);
  }
  async wait() {
    await Promises.settled(this.promises);
  }
}
let AbstractWorkspaceEditingService = class extends Disposable {
  constructor(jsonEditingService, contextService, configurationService, notificationService, commandService, fileService, textFileService, workspacesService, environmentService, fileDialogService, dialogService, hostService, uriIdentityService, workspaceTrustManagementService, userDataProfilesService, userDataProfileService, logService) {
    super();
    this.jsonEditingService = jsonEditingService;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.commandService = commandService;
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.workspacesService = workspacesService;
    this.environmentService = environmentService;
    this.fileDialogService = fileDialogService;
    this.dialogService = dialogService;
    this.hostService = hostService;
    this.uriIdentityService = uriIdentityService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileService = userDataProfileService;
    this.logService = logService;
    this._onDidEnterWorkspace = this._register(new Emitter());
    this.onDidEnterWorkspace = this._onDidEnterWorkspace.event;
  }
  async pickNewWorkspacePath() {
    const availableFileSystems = [Schemas.file];
    if (this.environmentService.remoteAuthority) {
      availableFileSystems.unshift(Schemas.vscodeRemote);
    }
    let workspacePath = await this.fileDialogService.showSaveDialog({
      saveLabel: localize("save", "Save"),
      title: localize("saveWorkspace", "Save Workspace"),
      filters: WORKSPACE_FILTER,
      defaultUri: joinPath(await this.fileDialogService.defaultWorkspacePath(), this.getNewWorkspaceName()),
      availableFileSystems
    });
    if (!workspacePath) {
      return;
    }
    if (!hasWorkspaceFileExtension(workspacePath)) {
      workspacePath = workspacePath.with({ path: `${workspacePath.path}.${WORKSPACE_EXTENSION}` });
    }
    return workspacePath;
  }
  getNewWorkspaceName() {
    const configPathURI = this.getCurrentWorkspaceIdentifier()?.configPath;
    if (configPathURI && isSavedWorkspace(configPathURI, this.environmentService)) {
      return basename(configPathURI);
    }
    const folder = this.contextService.getWorkspace().folders.at(0);
    if (folder) {
      return `${basename(folder.uri)}.${WORKSPACE_EXTENSION}`;
    }
    return `workspace.${WORKSPACE_EXTENSION}`;
  }
  async updateFolders(index, deleteCount, foldersToAddCandidates, donotNotifyError) {
    const folders = this.contextService.getWorkspace().folders;
    let foldersToDelete = [];
    if (typeof deleteCount === "number") {
      foldersToDelete = folders.slice(index, index + deleteCount).map((folder) => folder.uri);
    }
    let foldersToAdd = [];
    if (Array.isArray(foldersToAddCandidates)) {
      foldersToAdd = foldersToAddCandidates.map((folderToAdd) => ({ uri: removeTrailingPathSeparator(folderToAdd.uri), name: folderToAdd.name }));
    }
    const wantsToDelete = foldersToDelete.length > 0;
    const wantsToAdd = foldersToAdd.length > 0;
    if (!wantsToAdd && !wantsToDelete) {
      return;
    }
    if (wantsToAdd && !wantsToDelete) {
      return this.doAddFolders(foldersToAdd, index, donotNotifyError);
    }
    if (wantsToDelete && !wantsToAdd) {
      return this.removeFolders(foldersToDelete);
    } else {
      if (this.includesSingleFolderWorkspace(foldersToDelete)) {
        return this.createAndEnterWorkspace(foldersToAdd);
      }
      if (this.contextService.getWorkbenchState() !== WorkbenchState.WORKSPACE) {
        return this.doAddFolders(foldersToAdd, index, donotNotifyError);
      }
      return this.doUpdateFolders(foldersToAdd, foldersToDelete, index, donotNotifyError);
    }
  }
  async doUpdateFolders(foldersToAdd, foldersToDelete, index, donotNotifyError = false) {
    try {
      await this.contextService.updateFolders(foldersToAdd, foldersToDelete, index);
    } catch (error) {
      if (donotNotifyError) {
        throw error;
      }
      this.handleWorkspaceConfigurationEditingError(error);
    }
  }
  addFolders(foldersToAddCandidates, donotNotifyError = false) {
    const foldersToAdd = foldersToAddCandidates.map((folderToAdd) => ({ uri: removeTrailingPathSeparator(folderToAdd.uri), name: folderToAdd.name }));
    return this.doAddFolders(foldersToAdd, void 0, donotNotifyError);
  }
  async doAddFolders(foldersToAdd, index, donotNotifyError = false) {
    const state = this.contextService.getWorkbenchState();
    const remoteAuthority = this.environmentService.remoteAuthority;
    if (remoteAuthority) {
      foldersToAdd = foldersToAdd.filter((folder) => folder.uri.scheme !== Schemas.file && (folder.uri.scheme !== Schemas.vscodeRemote || isEqualAuthority(folder.uri.authority, remoteAuthority)));
    }
    if (state !== WorkbenchState.WORKSPACE) {
      let newWorkspaceFolders = this.contextService.getWorkspace().folders.map((folder) => ({ uri: folder.uri }));
      newWorkspaceFolders.splice(typeof index === "number" ? index : newWorkspaceFolders.length, 0, ...foldersToAdd);
      newWorkspaceFolders = distinct(newWorkspaceFolders, (folder) => this.uriIdentityService.extUri.getComparisonKey(folder.uri));
      if (state === WorkbenchState.EMPTY && newWorkspaceFolders.length === 0 || state === WorkbenchState.FOLDER && newWorkspaceFolders.length === 1) {
        return;
      }
      return this.createAndEnterWorkspace(newWorkspaceFolders);
    }
    try {
      await this.contextService.addFolders(foldersToAdd, index);
    } catch (error) {
      if (donotNotifyError) {
        throw error;
      }
      this.handleWorkspaceConfigurationEditingError(error);
    }
  }
  async removeFolders(foldersToRemove, donotNotifyError = false) {
    if (this.includesSingleFolderWorkspace(foldersToRemove)) {
      return this.createAndEnterWorkspace([]);
    }
    try {
      await this.contextService.removeFolders(foldersToRemove);
    } catch (error) {
      if (donotNotifyError) {
        throw error;
      }
      this.handleWorkspaceConfigurationEditingError(error);
    }
  }
  includesSingleFolderWorkspace(folders) {
    if (this.contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      const workspaceFolder = this.contextService.getWorkspace().folders[0];
      return folders.some((folder) => this.uriIdentityService.extUri.isEqual(folder, workspaceFolder.uri));
    }
    return false;
  }
  async createAndEnterWorkspace(folders, path) {
    if (path && !await this.isValidTargetWorkspacePath(path)) {
      return;
    }
    const remoteAuthority = this.environmentService.remoteAuthority;
    const untitledWorkspace = await this.workspacesService.createUntitledWorkspace(folders, remoteAuthority);
    if (path) {
      try {
        await this.saveWorkspaceAs(untitledWorkspace, path);
      } finally {
        await this.workspacesService.deleteUntitledWorkspace(untitledWorkspace);
      }
    } else {
      path = untitledWorkspace.configPath;
      if (!this.userDataProfileService.currentProfile.isDefault) {
        await this.userDataProfilesService.setProfileForWorkspace(untitledWorkspace, this.userDataProfileService.currentProfile);
      }
    }
    return this.enterWorkspace(path);
  }
  async saveAndEnterWorkspace(workspaceUri) {
    const workspaceIdentifier = this.getCurrentWorkspaceIdentifier();
    if (!workspaceIdentifier) {
      return;
    }
    if (isEqual(workspaceIdentifier.configPath, workspaceUri)) {
      return this.saveWorkspace(workspaceIdentifier);
    }
    if (!await this.isValidTargetWorkspacePath(workspaceUri)) {
      return;
    }
    await this.saveWorkspaceAs(workspaceIdentifier, workspaceUri);
    return this.enterWorkspace(workspaceUri);
  }
  async isValidTargetWorkspacePath(workspaceUri) {
    return true;
  }
  async saveWorkspaceAs(workspace, targetConfigPathURI) {
    const configPathURI = workspace.configPath;
    const isNotUntitledWorkspace = !isUntitledWorkspace(targetConfigPathURI, this.environmentService);
    if (isNotUntitledWorkspace && !this.userDataProfileService.currentProfile.isDefault) {
      const newWorkspace = await this.workspacesService.getWorkspaceIdentifier(targetConfigPathURI);
      await this.userDataProfilesService.setProfileForWorkspace(newWorkspace, this.userDataProfileService.currentProfile);
    }
    if (this.uriIdentityService.extUri.isEqual(configPathURI, targetConfigPathURI)) {
      return;
    }
    const isFromUntitledWorkspace = isUntitledWorkspace(configPathURI, this.environmentService);
    const raw = await this.fileService.readFile(configPathURI);
    const newRawWorkspaceContents = rewriteWorkspaceFileForNewLocation(raw.value.toString(), configPathURI, isFromUntitledWorkspace, targetConfigPathURI, this.uriIdentityService.extUri);
    await this.textFileService.create([{ resource: targetConfigPathURI, value: newRawWorkspaceContents, options: { overwrite: true } }]);
    await this.trustWorkspaceConfiguration(targetConfigPathURI);
  }
  async saveWorkspace(workspace) {
    const configPathURI = workspace.configPath;
    const existingModel = this.textFileService.files.get(configPathURI);
    if (existingModel) {
      await existingModel.save({ force: true, reason: SaveReason.EXPLICIT });
      return;
    }
    const workspaceFileExists = await this.fileService.exists(configPathURI);
    if (workspaceFileExists) {
      return;
    }
    const newWorkspace = { folders: [] };
    const newRawWorkspaceContents = rewriteWorkspaceFileForNewLocation(JSON.stringify(newWorkspace, null, "	"), configPathURI, false, configPathURI, this.uriIdentityService.extUri);
    await this.textFileService.create([{ resource: configPathURI, value: newRawWorkspaceContents }]);
  }
  handleWorkspaceConfigurationEditingError(error) {
    switch (error.code) {
      case JSONEditingErrorCode.ERROR_INVALID_FILE:
        this.onInvalidWorkspaceConfigurationFileError();
        break;
      default:
        this.notificationService.error(error.message);
    }
  }
  onInvalidWorkspaceConfigurationFileError() {
    const message = localize("errorInvalidTaskConfiguration", "Unable to write into workspace configuration file. Please open the file to correct errors/warnings in it and try again.");
    this.askToOpenWorkspaceConfigurationFile(message);
  }
  askToOpenWorkspaceConfigurationFile(message) {
    this.notificationService.prompt(
      Severity.Error,
      message,
      [{
        label: localize("openWorkspaceConfigurationFile", "Open Workspace Configuration"),
        run: () => this.commandService.executeCommand("workbench.action.openWorkspaceConfigFile")
      }]
    );
  }
  async fireDidEnterWorkspace(oldWorkspace, newWorkspace) {
    const event = new DidEnterWorkspaceEvent(oldWorkspace, newWorkspace);
    this._onDidEnterWorkspace.fire(event);
    try {
      await event.wait();
    } catch (error) {
      this.logService.error("Error while waiting for participants of onDidEnterWorkspace to join:", error);
    }
  }
  async doEnterWorkspace(workspaceUri) {
    if (this.environmentService.extensionTestsLocationURI) {
      throw new Error("Entering a new workspace is not possible in tests.");
    }
    const workspace = await this.workspacesService.getWorkspaceIdentifier(workspaceUri);
    if (this.contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      await this.migrateWorkspaceSettings(workspace);
    }
    await this.configurationService.initialize(workspace);
    return this.workspacesService.enterWorkspace(workspaceUri);
  }
  migrateWorkspaceSettings(toWorkspace) {
    return this.doCopyWorkspaceSettings(toWorkspace, (setting) => setting.scope === ConfigurationScope.WINDOW);
  }
  copyWorkspaceSettings(toWorkspace) {
    return this.doCopyWorkspaceSettings(toWorkspace);
  }
  doCopyWorkspaceSettings(toWorkspace, filter) {
    const configurationProperties = Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
    const targetWorkspaceConfiguration = {};
    for (const key of this.configurationService.keys().workspace) {
      if (configurationProperties[key]) {
        if (filter && !filter(configurationProperties[key])) {
          continue;
        }
        targetWorkspaceConfiguration[key] = this.configurationService.inspect(key).workspaceValue;
      }
    }
    return this.jsonEditingService.write(toWorkspace.configPath, [{ path: ["settings"], value: targetWorkspaceConfiguration }], true);
  }
  async trustWorkspaceConfiguration(configPathURI) {
    if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY && this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      await this.workspaceTrustManagementService.setUrisTrust([configPathURI], true);
    }
  }
  getCurrentWorkspaceIdentifier() {
    const identifier = toWorkspaceIdentifier(this.contextService.getWorkspace());
    if (isWorkspaceIdentifier(identifier)) {
      return identifier;
    }
    return void 0;
  }
};
AbstractWorkspaceEditingService = __decorateClass([
  __decorateParam(0, IJSONEditingService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IWorkbenchConfigurationService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IWorkspacesService),
  __decorateParam(8, IWorkbenchEnvironmentService),
  __decorateParam(9, IFileDialogService),
  __decorateParam(10, IDialogService),
  __decorateParam(11, IHostService),
  __decorateParam(12, IUriIdentityService),
  __decorateParam(13, IWorkspaceTrustManagementService),
  __decorateParam(14, IUserDataProfilesService),
  __decorateParam(15, IUserDataProfileService),
  __decorateParam(16, ILogService)
], AbstractWorkspaceEditingService);
export {
  AbstractWorkspaceEditingService,
  DidEnterWorkspaceEvent
};
