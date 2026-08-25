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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { IWorkspaceContextService, WorkspaceFolder } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceEditingService } from "../../../../workbench/services/workspaces/common/workspaceEditing.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { autorun } from "../../../../base/common/observable.js";
import { Queue } from "../../../../base/common/async.js";
import { IWorkspaceFolderLabelService } from "../../../../workbench/services/workspaces/common/workspaceFolderLabelService.js";
let WorkspaceFolderManagementContribution = class extends Disposable {
  constructor(sessionsService, uriIdentityService, workspaceContextService, workspaceEditingService, workspaceTrustManagementService, workspaceFolderLabelService) {
    super();
    this.sessionsService = sessionsService;
    this.uriIdentityService = uriIdentityService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceEditingService = workspaceEditingService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.workspaceFolderLabelService = workspaceFolderLabelService;
    this.queue = this._register(new Queue());
    this._register(autorun((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      activeSession?.workspace.read(reader);
      this.queue.queue(() => this.updateWorkspaceFoldersForSession(activeSession));
    }));
  }
  static {
    this.ID = "workbench.contrib.workspaceFolderManagement";
  }
  async updateWorkspaceFoldersForSession(session) {
    await this.manageTrustWorkspaceForSession(session);
    const activeSessionFolderData = this.getActiveSessionFolderData(session);
    const currentRepo = this.workspaceContextService.getWorkspace().folders[0]?.uri;
    if (!activeSessionFolderData) {
      if (currentRepo) {
        await this.workspaceEditingService.removeFolders([currentRepo], true);
      }
      return;
    }
    if (!currentRepo) {
      await this.workspaceEditingService.addFolders([activeSessionFolderData], true);
      return;
    }
    if (this.uriIdentityService.extUri.isEqual(currentRepo, activeSessionFolderData.uri)) {
      return;
    }
    await this.workspaceEditingService.updateFolders(0, 1, [activeSessionFolderData], true);
  }
  getActiveSessionFolderData(session) {
    if (!session) {
      return void 0;
    }
    const workspace = session.workspace.get();
    const folder = workspace?.folders[0];
    if (!folder) {
      return void 0;
    }
    return {
      uri: folder.workingDirectory,
      name: this.workspaceFolderLabelService.getWorkspaceFolderLabel(
        new WorkspaceFolder({ uri: folder.workingDirectory, name: workspace.label, index: 0 }),
        true
      ) ?? workspace.label
    };
  }
  async manageTrustWorkspaceForSession(session) {
    const workspace = session?.workspace.get();
    if (!workspace?.requiresWorkspaceTrust) {
      return;
    }
    const folder = workspace?.folders[0];
    if (!folder) {
      return;
    }
    if (!this.isUriTrusted(folder.workingDirectory)) {
      await this.workspaceTrustManagementService.setUrisTrust([folder.workingDirectory], true);
    }
  }
  isUriTrusted(uri) {
    return this.workspaceTrustManagementService.getTrustedUris().some((trustedUri) => this.uriIdentityService.extUri.isEqual(trustedUri, uri));
  }
};
WorkspaceFolderManagementContribution = __decorateClass([
  __decorateParam(0, ISessionsService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IWorkspaceEditingService),
  __decorateParam(4, IWorkspaceTrustManagementService),
  __decorateParam(5, IWorkspaceFolderLabelService)
], WorkspaceFolderManagementContribution);
export {
  WorkspaceFolderManagementContribution
};
