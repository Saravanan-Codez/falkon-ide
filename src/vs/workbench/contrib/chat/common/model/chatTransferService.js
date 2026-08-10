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
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IWorkspaceTrustManagementService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { areWorkspaceFoldersEmpty } from "../../../../services/workspaces/common/workspaceUtils.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const IChatTransferService = createDecorator("chatTransferService");
const transferredWorkspacesKey = "chat.transferedWorkspaces";
let ChatTransferService = class {
  constructor(workspaceService, storageService, fileService, workspaceTrustManagementService) {
    this.workspaceService = workspaceService;
    this.storageService = storageService;
    this.fileService = fileService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
  }
  deleteWorkspaceFromTransferredList(workspace) {
    const transferredWorkspaces = this.storageService.getObject(transferredWorkspacesKey, StorageScope.PROFILE, []);
    const updatedWorkspaces = transferredWorkspaces.filter((uri) => uri !== workspace.toString());
    this.storageService.store(transferredWorkspacesKey, updatedWorkspaces, StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  addWorkspaceToTransferred(workspace) {
    const transferredWorkspaces = this.storageService.getObject(transferredWorkspacesKey, StorageScope.PROFILE, []);
    transferredWorkspaces.push(workspace.toString());
    this.storageService.store(transferredWorkspacesKey, transferredWorkspaces, StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  async checkAndSetTransferredWorkspaceTrust() {
    const workspace = this.workspaceService.getWorkspace();
    const currentWorkspaceUri = workspace.folders[0]?.uri;
    if (!currentWorkspaceUri) {
      return;
    }
    if (this.isChatTransferredWorkspace(currentWorkspaceUri, this.storageService) && await areWorkspaceFoldersEmpty(workspace, this.fileService)) {
      await this.workspaceTrustManagementService.setWorkspaceTrust(true);
      this.deleteWorkspaceFromTransferredList(currentWorkspaceUri);
    }
  }
  isChatTransferredWorkspace(workspace, storageService) {
    if (!workspace) {
      return false;
    }
    const chatWorkspaceTransfer = storageService.getObject(transferredWorkspacesKey, StorageScope.PROFILE, []);
    return chatWorkspaceTransfer.some((item) => item.toString() === workspace.toString());
  }
};
ChatTransferService = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IWorkspaceTrustManagementService)
], ChatTransferService);
export {
  ChatTransferService,
  IChatTransferService
};
