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
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { WorkingCopyBackupService } from "../common/workingCopyBackupService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkingCopyBackupService } from "../common/workingCopyBackup.js";
import { joinPath } from "../../../../base/common/resources.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { BrowserWorkingCopyBackupTracker } from "./workingCopyBackupTracker.js";
let BrowserWorkingCopyBackupService = class extends WorkingCopyBackupService {
  constructor(contextService, environmentService, fileService, logService) {
    super(joinPath(environmentService.userRoamingDataHome, "Backups", contextService.getWorkspace().id), fileService, logService);
  }
};
BrowserWorkingCopyBackupService = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IFileService),
  __decorateParam(3, ILogService)
], BrowserWorkingCopyBackupService);
registerSingleton(IWorkingCopyBackupService, BrowserWorkingCopyBackupService, InstantiationType.Eager);
registerWorkbenchContribution2(BrowserWorkingCopyBackupTracker.ID, BrowserWorkingCopyBackupTracker, WorkbenchPhase.BlockStartup);
export {
  BrowserWorkingCopyBackupService
};
