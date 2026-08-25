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
import { IWorkingCopyBackupService } from "../common/workingCopyBackup.js";
import { IFilesConfigurationService, AutoSaveMode } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyService } from "../common/workingCopyService.js";
import { WorkingCopyCapabilities } from "../common/workingCopy.js";
import { ILifecycleService, ShutdownReason } from "../../lifecycle/common/lifecycle.js";
import { ConfirmResult, IFileDialogService, IDialogService, getFileNamesMessage } from "../../../../platform/dialogs/common/dialogs.js";
import { WorkbenchState, IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { HotExitConfiguration } from "../../../../platform/files/common/files.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { WorkingCopyBackupTracker } from "../common/workingCopyBackupTracker.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { SaveReason } from "../../../common/editor.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { Promises, raceCancellation } from "../../../../base/common/async.js";
import { IWorkingCopyEditorService } from "../common/workingCopyEditorService.js";
let NativeWorkingCopyBackupTracker = class extends WorkingCopyBackupTracker {
  constructor(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, fileDialogService, dialogService, contextService, nativeHostService, logService, environmentService, progressService, workingCopyEditorService, editorService) {
    super(workingCopyBackupService, workingCopyService, logService, lifecycleService, filesConfigurationService, workingCopyEditorService, editorService);
    this.fileDialogService = fileDialogService;
    this.dialogService = dialogService;
    this.contextService = contextService;
    this.nativeHostService = nativeHostService;
    this.environmentService = environmentService;
    this.progressService = progressService;
  }
  static {
    this.ID = "workbench.contrib.nativeWorkingCopyBackupTracker";
  }
  async onFinalBeforeShutdown(reason) {
    this.cancelBackupOperations();
    const { resume } = this.suspendBackupOperations();
    try {
      const modifiedWorkingCopies = this.workingCopyService.modifiedWorkingCopies;
      if (modifiedWorkingCopies.length) {
        return await this.onBeforeShutdownWithModified(reason, modifiedWorkingCopies);
      } else {
        return await this.onBeforeShutdownWithoutModified();
      }
    } finally {
      resume();
    }
  }
  async onBeforeShutdownWithModified(reason, modifiedWorkingCopies) {
    const workingCopiesToAutoSave = modifiedWorkingCopies.filter((wc) => !(wc.capabilities & WorkingCopyCapabilities.Untitled) && this.filesConfigurationService.getAutoSaveMode(wc.resource).mode !== AutoSaveMode.OFF);
    if (workingCopiesToAutoSave.length > 0) {
      try {
        await this.doSaveAllBeforeShutdown(workingCopiesToAutoSave, SaveReason.AUTO);
      } catch (error) {
        this.logService.error(`[backup tracker] error saving modified working copies: ${error}`);
      }
      const remainingModifiedWorkingCopies = this.workingCopyService.modifiedWorkingCopies;
      if (remainingModifiedWorkingCopies.length) {
        return this.handleModifiedBeforeShutdown(remainingModifiedWorkingCopies, reason);
      }
      return this.noVeto([...modifiedWorkingCopies]);
    }
    return this.handleModifiedBeforeShutdown(modifiedWorkingCopies, reason);
  }
  async handleModifiedBeforeShutdown(modifiedWorkingCopies, reason) {
    let backups = [];
    let backupError = void 0;
    const modifiedWorkingCopiesToBackup = await this.shouldBackupBeforeShutdown(reason, modifiedWorkingCopies);
    if (modifiedWorkingCopiesToBackup.length > 0) {
      try {
        const backupResult = await this.backupBeforeShutdown(modifiedWorkingCopiesToBackup);
        backups = backupResult.backups;
        backupError = backupResult.error;
        if (backups.length === modifiedWorkingCopies.length) {
          return false;
        }
      } catch (error) {
        backupError = error;
      }
    }
    const remainingModifiedWorkingCopies = modifiedWorkingCopies.filter((workingCopy) => !backups.includes(workingCopy));
    if (backupError) {
      if (this.environmentService.isExtensionDevelopment) {
        this.logService.error(`[backup tracker] error creating backups: ${backupError}`);
        return false;
      }
      return this.showErrorDialog(localize("backupTrackerBackupFailed", "The following editors with unsaved changes could not be saved to the backup location."), remainingModifiedWorkingCopies, backupError, reason);
    }
    try {
      return await this.confirmBeforeShutdown(remainingModifiedWorkingCopies);
    } catch (error) {
      if (this.environmentService.isExtensionDevelopment) {
        this.logService.error(`[backup tracker] error saving or reverting modified working copies: ${error}`);
        return false;
      }
      return this.showErrorDialog(localize("backupTrackerConfirmFailed", "The following editors with unsaved changes could not be saved or reverted."), remainingModifiedWorkingCopies, error, reason);
    }
  }
  async shouldBackupBeforeShutdown(reason, modifiedWorkingCopies) {
    if (!this.filesConfigurationService.isHotExitEnabled) {
      return [];
    }
    if (this.environmentService.isExtensionDevelopment) {
      return modifiedWorkingCopies;
    }
    switch (reason) {
      // Window Close
      case ShutdownReason.CLOSE:
        if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY && this.filesConfigurationService.hotExitConfiguration === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE) {
          return modifiedWorkingCopies;
        }
        if (isMacintosh || await this.nativeHostService.getWindowCount() > 1) {
          if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY) {
            return modifiedWorkingCopies.filter((modifiedWorkingCopy) => modifiedWorkingCopy.capabilities & WorkingCopyCapabilities.Scratchpad);
          }
          return [];
        }
        return modifiedWorkingCopies;
      // backup if last window is closed on win/linux where the application quits right after
      // Application Quit
      case ShutdownReason.QUIT:
        return modifiedWorkingCopies;
      // backup because next start we restore all backups
      // Window Reload
      case ShutdownReason.RELOAD:
        return modifiedWorkingCopies;
      // backup because after window reload, backups restore
      // Workspace Change
      case ShutdownReason.LOAD:
        if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY) {
          if (this.filesConfigurationService.hotExitConfiguration === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE) {
            return modifiedWorkingCopies;
          }
          return modifiedWorkingCopies.filter((modifiedWorkingCopy) => modifiedWorkingCopy.capabilities & WorkingCopyCapabilities.Scratchpad);
        }
        return [];
    }
  }
  async showErrorDialog(message, workingCopies, error, reason) {
    this.logService.error(`[backup tracker] ${message}: ${error}`);
    const modifiedWorkingCopies = workingCopies.filter((workingCopy) => workingCopy.isModified());
    const advice = localize("backupErrorDetails", "Try saving or reverting the editors with unsaved changes first and then try again.");
    const detail = modifiedWorkingCopies.length ? `${getFileNamesMessage(modifiedWorkingCopies.map((x) => x.name))}
${advice}` : advice;
    const { result } = await this.dialogService.prompt({
      type: "error",
      message,
      detail,
      buttons: [
        {
          label: localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
          run: () => true
          // veto
        },
        {
          label: this.toForceShutdownLabel(reason),
          run: () => false
          // no veto
        }
      ]
    });
    return result ?? true;
  }
  toForceShutdownLabel(reason) {
    switch (reason) {
      case ShutdownReason.CLOSE:
      case ShutdownReason.LOAD:
        return localize("shutdownForceClose", "Close Anyway");
      case ShutdownReason.QUIT:
        return localize("shutdownForceQuit", "Quit Anyway");
      case ShutdownReason.RELOAD:
        return localize("shutdownForceReload", "Reload Anyway");
    }
  }
  async backupBeforeShutdown(modifiedWorkingCopies) {
    const backups = [];
    let error = void 0;
    await this.withProgressAndCancellation(
      async (token) => {
        try {
          await Promises.settled(modifiedWorkingCopies.map(async (workingCopy) => {
            const contentVersion = this.getContentVersion(workingCopy);
            if (this.workingCopyBackupService.hasBackupSync(workingCopy, contentVersion)) {
              backups.push(workingCopy);
            } else {
              const backup = await workingCopy.backup(token);
              if (token.isCancellationRequested) {
                return;
              }
              await this.workingCopyBackupService.backup(workingCopy, backup.content, contentVersion, backup.meta, token);
              if (token.isCancellationRequested) {
                return;
              }
              backups.push(workingCopy);
            }
          }));
        } catch (backupError) {
          error = backupError;
        }
      },
      localize("backupBeforeShutdownMessage", "Backing up editors with unsaved changes is taking a bit longer..."),
      localize("backupBeforeShutdownDetail", "Click 'Cancel' to stop waiting and to save or revert editors with unsaved changes.")
    );
    return { backups, error };
  }
  async confirmBeforeShutdown(modifiedWorkingCopies) {
    const confirm = await this.fileDialogService.showSaveConfirm(modifiedWorkingCopies.map((workingCopy) => workingCopy.name));
    if (confirm === ConfirmResult.SAVE) {
      const modifiedCountBeforeSave = this.workingCopyService.modifiedCount;
      try {
        await this.doSaveAllBeforeShutdown(modifiedWorkingCopies, SaveReason.EXPLICIT);
      } catch (error) {
        this.logService.error(`[backup tracker] error saving modified working copies: ${error}`);
      }
      const savedWorkingCopies = modifiedCountBeforeSave - this.workingCopyService.modifiedCount;
      if (savedWorkingCopies < modifiedWorkingCopies.length) {
        return true;
      }
      return this.noVeto(modifiedWorkingCopies);
    } else if (confirm === ConfirmResult.DONT_SAVE) {
      try {
        await this.doRevertAllBeforeShutdown(modifiedWorkingCopies);
      } catch (error) {
        this.logService.error(`[backup tracker] error reverting modified working copies: ${error}`);
      }
      return this.noVeto(modifiedWorkingCopies);
    }
    return true;
  }
  doSaveAllBeforeShutdown(workingCopies, reason) {
    return this.withProgressAndCancellation(
      async () => {
        const saveOptions = { skipSaveParticipants: true, reason };
        let result = void 0;
        if (workingCopies.length === this.workingCopyService.modifiedCount) {
          result = (await this.editorService.saveAll({
            includeUntitled: { includeScratchpad: true },
            ...saveOptions
          })).success;
        }
        if (result !== false) {
          await Promises.settled(workingCopies.map((workingCopy) => workingCopy.isModified() ? workingCopy.save(saveOptions) : Promise.resolve(true)));
        }
      },
      localize("saveBeforeShutdown", "Saving editors with unsaved changes is taking a bit longer..."),
      void 0,
      // Do not pick `Dialog` as location for reporting progress if it is likely
      // that the save operation will itself open a dialog for asking for the
      // location to save to for untitled or scratchpad working copies.
      // https://github.com/microsoft/vscode-internalbacklog/issues/4943
      workingCopies.some((workingCopy) => workingCopy.capabilities & WorkingCopyCapabilities.Untitled || workingCopy.capabilities & WorkingCopyCapabilities.Scratchpad) ? ProgressLocation.Window : ProgressLocation.Dialog
    );
  }
  doRevertAllBeforeShutdown(modifiedWorkingCopies) {
    return this.withProgressAndCancellation(async () => {
      const revertOptions = { soft: true };
      if (modifiedWorkingCopies.length === this.workingCopyService.modifiedCount) {
        await this.editorService.revertAll(revertOptions);
      }
      await Promises.settled(modifiedWorkingCopies.map((workingCopy) => workingCopy.isModified() ? workingCopy.revert(revertOptions) : Promise.resolve()));
    }, localize("revertBeforeShutdown", "Reverting editors with unsaved changes is taking a bit longer..."));
  }
  onBeforeShutdownWithoutModified() {
    return this.noVeto({ except: this.contextService.getWorkbenchState() === WorkbenchState.EMPTY ? [] : Array.from(this.unrestoredBackups) });
  }
  async noVeto(arg1) {
    await this.discardBackupsBeforeShutdown(arg1);
    return false;
  }
  async discardBackupsBeforeShutdown(arg1) {
    if (!this.isReady) {
      return;
    }
    await this.withProgressAndCancellation(async () => {
      try {
        if (Array.isArray(arg1)) {
          await Promises.settled(arg1.map((workingCopy) => this.workingCopyBackupService.discardBackup(workingCopy)));
        } else {
          await this.workingCopyBackupService.discardBackups(arg1);
        }
      } catch (error) {
        this.logService.error(`[backup tracker] error discarding backups: ${error}`);
      }
    }, localize("discardBackupsBeforeShutdown", "Discarding backups is taking a bit longer..."));
  }
  withProgressAndCancellation(promiseFactory, title, detail, location = ProgressLocation.Dialog) {
    const cts = new CancellationTokenSource();
    return this.progressService.withProgress({
      location,
      // by default use a dialog to prevent the user from making any more changes now (https://github.com/microsoft/vscode/issues/122774)
      cancellable: true,
      // allow to cancel (https://github.com/microsoft/vscode/issues/112278)
      delay: 800,
      // delay so that it only appears when operation takes a long time
      title,
      detail
    }, () => raceCancellation(promiseFactory(cts.token), cts.token), () => cts.dispose(true));
  }
};
NativeWorkingCopyBackupTracker = __decorateClass([
  __decorateParam(0, IWorkingCopyBackupService),
  __decorateParam(1, IFilesConfigurationService),
  __decorateParam(2, IWorkingCopyService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, INativeHostService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IEnvironmentService),
  __decorateParam(10, IProgressService),
  __decorateParam(11, IWorkingCopyEditorService),
  __decorateParam(12, IEditorService)
], NativeWorkingCopyBackupTracker);
export {
  NativeWorkingCopyBackupTracker
};
