import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { WorkingCopyCapabilities } from "./workingCopy.js";
import { LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Promises } from "../../../../base/common/async.js";
import { EditorsOrder } from "../../../common/editor.js";
class WorkingCopyBackupTracker extends Disposable {
  constructor(workingCopyBackupService, workingCopyService, logService, lifecycleService, filesConfigurationService, workingCopyEditorService, editorService) {
    super();
    this.workingCopyBackupService = workingCopyBackupService;
    this.workingCopyService = workingCopyService;
    this.logService = logService;
    this.lifecycleService = lifecycleService;
    this.filesConfigurationService = filesConfigurationService;
    this.workingCopyEditorService = workingCopyEditorService;
    this.editorService = editorService;
    // A map from working copy to a version ID we compute on each content
    // change. This version ID allows to e.g. ask if a backup for a specific
    // content has been made before closing.
    this.mapWorkingCopyToContentVersion = /* @__PURE__ */ new Map();
    // A map of scheduled pending backup operations for working copies
    // Given https://github.com/microsoft/vscode/issues/158038, we explicitly
    // do not store `IWorkingCopy` but the identifier in the map, since it
    // looks like GC is not running for the working copy otherwise.
    this.pendingBackupOperations = /* @__PURE__ */ new Map();
    this.suspended = false;
    //#endregion
    //#region Backup Restorer
    this.unrestoredBackups = /* @__PURE__ */ new Set();
    this._isReady = false;
    this.whenReady = this.resolveBackupsToRestore();
    for (const workingCopy of this.workingCopyService.modifiedWorkingCopies) {
      this.onDidRegister(workingCopy);
    }
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.workingCopyService.onDidRegister((workingCopy) => this.onDidRegister(workingCopy)));
    this._register(this.workingCopyService.onDidUnregister((workingCopy) => this.onDidUnregister(workingCopy)));
    this._register(this.workingCopyService.onDidChangeDirty((workingCopy) => this.onDidChangeDirty(workingCopy)));
    this._register(this.workingCopyService.onDidChangeContent((workingCopy) => this.onDidChangeContent(workingCopy)));
    this._register(this.lifecycleService.onBeforeShutdown((event) => event.finalVeto(() => this.onFinalBeforeShutdown(event.reason), "veto.backups")));
    this._register(this.lifecycleService.onWillShutdown(() => this.onWillShutdown()));
    this._register(this.workingCopyEditorService.onDidRegisterHandler((handler) => this.restoreBackups(handler)));
  }
  onWillShutdown() {
    this.cancelBackupOperations();
    this.suspendBackupOperations();
  }
  static {
    //#region Backup Creator
    // Delay creation of backups when content changes to avoid too much
    // load on the backup service when the user is typing into the editor
    // Since we always schedule a backup, even when auto save is on, we
    // have different scheduling delays based on auto save configuration.
    // With 'delayed' we avoid a (not critical but also not really wanted)
    // race between saving (after 1s per default) and making a backup of
    // the working copy.
    this.DEFAULT_BACKUP_SCHEDULE_DELAYS = {
      ["default"]: 1e3,
      ["delayed"]: 2e3
    };
  }
  onDidRegister(workingCopy) {
    if (this.suspended) {
      this.logService.warn(`[backup tracker] suspended, ignoring register event`, workingCopy.resource.toString(), workingCopy.typeId);
      return;
    }
    if (workingCopy.isModified()) {
      this.scheduleBackup(workingCopy);
    }
  }
  onDidUnregister(workingCopy) {
    this.mapWorkingCopyToContentVersion.delete(workingCopy);
    if (this.suspended) {
      this.logService.warn(`[backup tracker] suspended, ignoring unregister event`, workingCopy.resource.toString(), workingCopy.typeId);
      return;
    }
    this.discardBackup(workingCopy);
  }
  onDidChangeDirty(workingCopy) {
    if (this.suspended) {
      this.logService.warn(`[backup tracker] suspended, ignoring dirty change event`, workingCopy.resource.toString(), workingCopy.typeId);
      return;
    }
    if (workingCopy.isDirty()) {
      this.scheduleBackup(workingCopy);
    } else {
      this.discardBackup(workingCopy);
    }
  }
  onDidChangeContent(workingCopy) {
    const contentVersionId = this.getContentVersion(workingCopy);
    this.mapWorkingCopyToContentVersion.set(workingCopy, contentVersionId + 1);
    if (this.suspended) {
      this.logService.warn(`[backup tracker] suspended, ignoring content change event`, workingCopy.resource.toString(), workingCopy.typeId);
      return;
    }
    if (workingCopy.isModified()) {
      this.scheduleBackup(workingCopy);
    }
  }
  scheduleBackup(workingCopy) {
    this.cancelBackupOperation(workingCopy);
    this.logService.trace(`[backup tracker] scheduling backup`, workingCopy.resource.toString(), workingCopy.typeId);
    const workingCopyIdentifier = { resource: workingCopy.resource, typeId: workingCopy.typeId };
    const cts = new CancellationTokenSource();
    const handle = setTimeout(async () => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      if (workingCopy.isModified()) {
        this.logService.trace(`[backup tracker] creating backup`, workingCopy.resource.toString(), workingCopy.typeId);
        try {
          const backup = await workingCopy.backup(cts.token);
          if (cts.token.isCancellationRequested) {
            return;
          }
          if (workingCopy.isModified()) {
            this.logService.trace(`[backup tracker] storing backup`, workingCopy.resource.toString(), workingCopy.typeId);
            await this.workingCopyBackupService.backup(workingCopy, backup.content, this.getContentVersion(workingCopy), backup.meta, cts.token);
          }
        } catch (error) {
          this.logService.error(error);
        }
      }
      if (!cts.token.isCancellationRequested) {
        this.doClearPendingBackupOperation(workingCopyIdentifier);
      }
    }, this.getBackupScheduleDelay(workingCopy));
    this.pendingBackupOperations.set(workingCopyIdentifier, {
      cancel: () => {
        this.logService.trace(`[backup tracker] clearing pending backup creation`, workingCopy.resource.toString(), workingCopy.typeId);
        cts.cancel();
      },
      disposable: toDisposable(() => {
        cts.dispose();
        clearTimeout(handle);
      })
    });
  }
  getBackupScheduleDelay(workingCopy) {
    if (typeof workingCopy.backupDelay === "number") {
      return workingCopy.backupDelay;
    }
    let backupScheduleDelay;
    if (workingCopy.capabilities & WorkingCopyCapabilities.Untitled) {
      backupScheduleDelay = "default";
    } else {
      backupScheduleDelay = this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource) ? "delayed" : "default";
    }
    return WorkingCopyBackupTracker.DEFAULT_BACKUP_SCHEDULE_DELAYS[backupScheduleDelay];
  }
  getContentVersion(workingCopy) {
    return this.mapWorkingCopyToContentVersion.get(workingCopy) || 0;
  }
  discardBackup(workingCopy) {
    this.cancelBackupOperation(workingCopy);
    const workingCopyIdentifier = { resource: workingCopy.resource, typeId: workingCopy.typeId };
    const cts = new CancellationTokenSource();
    this.doDiscardBackup(workingCopyIdentifier, cts);
    this.pendingBackupOperations.set(workingCopyIdentifier, {
      cancel: () => {
        this.logService.trace(`[backup tracker] clearing pending backup discard`, workingCopy.resource.toString(), workingCopy.typeId);
        cts.cancel();
      },
      disposable: cts
    });
  }
  async doDiscardBackup(workingCopyIdentifier, cts) {
    this.logService.trace(`[backup tracker] discarding backup`, workingCopyIdentifier.resource.toString(), workingCopyIdentifier.typeId);
    try {
      await this.workingCopyBackupService.discardBackup(workingCopyIdentifier, cts.token);
    } catch (error) {
      this.logService.error(error);
    }
    if (!cts.token.isCancellationRequested) {
      this.doClearPendingBackupOperation(workingCopyIdentifier);
    }
  }
  cancelBackupOperation(workingCopy) {
    let workingCopyIdentifier = void 0;
    for (const [identifier] of this.pendingBackupOperations) {
      if (identifier.resource.toString() === workingCopy.resource.toString() && identifier.typeId === workingCopy.typeId) {
        workingCopyIdentifier = identifier;
        break;
      }
    }
    if (workingCopyIdentifier) {
      this.doClearPendingBackupOperation(workingCopyIdentifier, { cancel: true });
    }
  }
  doClearPendingBackupOperation(workingCopyIdentifier, options) {
    const pendingBackupOperation = this.pendingBackupOperations.get(workingCopyIdentifier);
    if (!pendingBackupOperation) {
      return;
    }
    if (options?.cancel) {
      pendingBackupOperation.cancel();
    }
    pendingBackupOperation.disposable.dispose();
    this.pendingBackupOperations.delete(workingCopyIdentifier);
  }
  cancelBackupOperations() {
    for (const [, operation] of this.pendingBackupOperations) {
      operation.cancel();
      operation.disposable.dispose();
    }
    this.pendingBackupOperations.clear();
  }
  suspendBackupOperations() {
    this.suspended = true;
    return { resume: () => this.suspended = false };
  }
  get isReady() {
    return this._isReady;
  }
  async resolveBackupsToRestore() {
    await this.lifecycleService.when(LifecyclePhase.Restored);
    for (const backup of await this.workingCopyBackupService.getBackups()) {
      this.unrestoredBackups.add(backup);
    }
    this._isReady = true;
  }
  async restoreBackups(handler) {
    await this.whenReady;
    const openedEditorsForBackups = /* @__PURE__ */ new Set();
    const nonOpenedEditorsForBackups = /* @__PURE__ */ new Set();
    const restoredBackups = /* @__PURE__ */ new Set();
    for (const unrestoredBackup of this.unrestoredBackups) {
      const canHandleUnrestoredBackup = await handler.handles(unrestoredBackup);
      if (!canHandleUnrestoredBackup) {
        continue;
      }
      let hasOpenedEditorForBackup = false;
      for (const { editor } of this.editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
        const isUnrestoredBackupOpened = handler.isOpen(unrestoredBackup, editor);
        if (isUnrestoredBackupOpened) {
          openedEditorsForBackups.add(editor);
          hasOpenedEditorForBackup = true;
        }
      }
      if (!hasOpenedEditorForBackup) {
        nonOpenedEditorsForBackups.add(await handler.createEditor(unrestoredBackup));
      }
      restoredBackups.add(unrestoredBackup);
    }
    if (nonOpenedEditorsForBackups.size > 0) {
      await this.editorService.openEditors([...nonOpenedEditorsForBackups].map((nonOpenedEditorForBackup) => ({
        editor: nonOpenedEditorForBackup,
        options: {
          pinned: true,
          preserveFocus: true,
          inactive: true
        }
      })));
      for (const nonOpenedEditorForBackup of nonOpenedEditorsForBackups) {
        openedEditorsForBackups.add(nonOpenedEditorForBackup);
      }
    }
    await Promises.settled([...openedEditorsForBackups].map(async (openedEditorForBackup) => {
      if (this.editorService.isVisible(openedEditorForBackup)) {
        return;
      }
      return openedEditorForBackup.resolve();
    }));
    for (const restoredBackup of restoredBackups) {
      this.unrestoredBackups.delete(restoredBackup);
    }
  }
  //#endregion
}
export {
  WorkingCopyBackupTracker
};
