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
import { IWorkingCopyBackupService } from "../common/workingCopyBackup.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyService } from "../common/workingCopyService.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { WorkingCopyBackupTracker } from "../common/workingCopyBackupTracker.js";
import { IWorkingCopyEditorService } from "../common/workingCopyEditorService.js";
import { IEditorService } from "../../editor/common/editorService.js";
let BrowserWorkingCopyBackupTracker = class extends WorkingCopyBackupTracker {
  static {
    this.ID = "workbench.contrib.browserWorkingCopyBackupTracker";
  }
  constructor(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, logService, workingCopyEditorService, editorService) {
    super(workingCopyBackupService, workingCopyService, logService, lifecycleService, filesConfigurationService, workingCopyEditorService, editorService);
  }
  onFinalBeforeShutdown(reason) {
    const modifiedWorkingCopies = this.workingCopyService.modifiedWorkingCopies;
    if (!modifiedWorkingCopies.length) {
      return false;
    }
    if (!this.filesConfigurationService.isHotExitEnabled) {
      return true;
    }
    for (const modifiedWorkingCopy of modifiedWorkingCopies) {
      if (!this.workingCopyBackupService.hasBackupSync(modifiedWorkingCopy, this.getContentVersion(modifiedWorkingCopy))) {
        this.logService.warn("Unload veto: pending backups");
        return true;
      }
    }
    return false;
  }
};
BrowserWorkingCopyBackupTracker = __decorateClass([
  __decorateParam(0, IWorkingCopyBackupService),
  __decorateParam(1, IFilesConfigurationService),
  __decorateParam(2, IWorkingCopyService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IWorkingCopyEditorService),
  __decorateParam(6, IEditorService)
], BrowserWorkingCopyBackupTracker);
export {
  BrowserWorkingCopyBackupTracker
};
