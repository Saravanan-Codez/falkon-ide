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
import { isCancellationError, onUnexpectedError } from "../../../../base/common/errors.js";
import { Schemas } from "../../../../base/common/network.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
async function pruneRecentRemoteFolderIfMissing(contextService, fileService, workspacesService) {
  if (contextService.getWorkbenchState() !== WorkbenchState.FOLDER) {
    return;
  }
  const folderUri = contextService.getWorkspace().folders[0]?.uri;
  if (!folderUri || folderUri.scheme !== Schemas.vscodeRemote) {
    return;
  }
  try {
    await fileService.stat(folderUri);
  } catch (error) {
    if (toFileOperationResult(error) === FileOperationResult.FILE_NOT_FOUND) {
      await workspacesService.removeRecentlyOpened([folderUri]);
    }
  }
}
let RecentRemoteFolderPrunerContribution = class {
  static {
    this.ID = "workbench.contrib.recentRemoteFolderPruner";
  }
  constructor(contextService, fileService, workspacesService) {
    pruneRecentRemoteFolderIfMissing(contextService, fileService, workspacesService).catch((error) => {
      if (!isCancellationError(error)) {
        onUnexpectedError(error);
      }
    });
  }
};
RecentRemoteFolderPrunerContribution = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IWorkspacesService)
], RecentRemoteFolderPrunerContribution);
registerWorkbenchContribution2(RecentRemoteFolderPrunerContribution.ID, RecentRemoteFolderPrunerContribution, WorkbenchPhase.Eventually);
export {
  pruneRecentRemoteFolderIfMissing
};
