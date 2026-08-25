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
import { ILabelService } from "../../../../platform/label/common/label.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceFolderLabelService } from "../../../../workbench/services/workspaces/common/workspaceFolderLabelService.js";
import { ISessionsService } from "../../sessions/browser/sessionsService.js";
import { ISessionsManagementService } from "../../sessions/common/sessionsManagement.js";
let SessionsWorkspaceFolderLabelService = class {
  constructor(sessionsService, sessionsManagementService, uriIdentityService, labelService) {
    this.sessionsService = sessionsService;
    this.sessionsManagementService = sessionsManagementService;
    this.uriIdentityService = uriIdentityService;
    this.labelService = labelService;
  }
  getWorkspaceFolderLabel(workspaceFolder, verbose) {
    const workspace = this.sessionsService.activeSession.get()?.workspace.get();
    const folder = workspace?.folders.find((folder2) => this.isWorkspaceFolder(folder2, workspaceFolder)) ?? this.sessionsManagementService.getSessions().flatMap((session) => session.workspace.get()?.folders ?? []).find((folder2) => this.isWorkspaceFolder(folder2, workspaceFolder));
    if (folder) {
      const repositoryName = folder.name;
      if (verbose && !this.uriIdentityService.extUri.isEqual(folder.root, folder.workingDirectory)) {
        const branchName = folder.gitRepository?.branchName ?? this.labelService.getUriBasenameLabel(folder.workingDirectory);
        return `${repositoryName} (${branchName})`;
      }
      return repositoryName;
    }
    return this.labelService.getUriBasenameLabel(workspaceFolder.uri);
  }
  isWorkspaceFolder(folder, workspaceFolder) {
    return this.uriIdentityService.extUri.isEqual(folder.workingDirectory, workspaceFolder.uri);
  }
};
SessionsWorkspaceFolderLabelService = __decorateClass([
  __decorateParam(0, ISessionsService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, ILabelService)
], SessionsWorkspaceFolderLabelService);
registerSingleton(IWorkspaceFolderLabelService, SessionsWorkspaceFolderLabelService, InstantiationType.Delayed);
export {
  SessionsWorkspaceFolderLabelService
};
