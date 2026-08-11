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
import { Event, Emitter } from "../../../../base/common/event.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { ETAG_DISABLED, FileOperationResult, IFileService, NotModifiedSinceFileOperationError } from "../../../../platform/files/common/files.js";
import { SaveReason } from "../../../common/editor.js";
import { IWorkingCopyService } from "./workingCopyService.js";
import { WorkingCopyCapabilities } from "./workingCopy.js";
import { raceCancellation, TaskSequentializer, timeout } from "../../../../base/common/async.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { IWorkingCopyFileService } from "./workingCopyFileService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { hash } from "../../../../base/common/hash.js";
import { isErrorWithActions, toErrorMessage } from "../../../../base/common/errorMessage.js";
import { toAction } from "../../../../base/common/actions.js";
import { isWindows } from "../../../../base/common/platform.js";
import { IWorkingCopyEditorService } from "./workingCopyEditorService.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { ResourceWorkingCopy } from "./resourceWorkingCopy.js";
import { SnapshotContext } from "./fileWorkingCopy.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { isCancellationError } from "../../../../base/common/errors.js";
var StoredFileWorkingCopyState = /* @__PURE__ */ ((StoredFileWorkingCopyState2) => {
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["SAVED"] = 0] = "SAVED";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["DIRTY"] = 1] = "DIRTY";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["PENDING_SAVE"] = 2] = "PENDING_SAVE";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["CONFLICT"] = 3] = "CONFLICT";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["ORPHAN"] = 4] = "ORPHAN";
  StoredFileWorkingCopyState2[StoredFileWorkingCopyState2["ERROR"] = 5] = "ERROR";
  return StoredFileWorkingCopyState2;
})(StoredFileWorkingCopyState || {});
function isStoredFileWorkingCopySaveEvent(e) {
  const candidate = e;
  return !!candidate.stat;
}
let StoredFileWorkingCopy = class extends ResourceWorkingCopy {
  //#endregion
  constructor(typeId, resource, name, modelFactory, externalResolver, fileService, logService, workingCopyFileService, filesConfigurationService, workingCopyBackupService, workingCopyService, notificationService, workingCopyEditorService, editorService, elevatedFileService, progressService) {
    super(resource, fileService);
    this.typeId = typeId;
    this.name = name;
    this.modelFactory = modelFactory;
    this.externalResolver = externalResolver;
    this.logService = logService;
    this.workingCopyFileService = workingCopyFileService;
    this.filesConfigurationService = filesConfigurationService;
    this.workingCopyBackupService = workingCopyBackupService;
    this.notificationService = notificationService;
    this.workingCopyEditorService = workingCopyEditorService;
    this.editorService = editorService;
    this.elevatedFileService = elevatedFileService;
    this.progressService = progressService;
    this.capabilities = WorkingCopyCapabilities.None;
    this._model = void 0;
    //#region events
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidResolve = this._register(new Emitter());
    this.onDidResolve = this._onDidResolve.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidSaveError = this._register(new Emitter());
    this.onDidSaveError = this._onDidSaveError.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidRevert = this._register(new Emitter());
    this.onDidRevert = this._onDidRevert.event;
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    //#region Dirty
    this.dirty = false;
    this.ignoreDirtyOnModelContentChange = false;
    //#endregion
    //#region Save
    this.versionId = 0;
    this.lastContentChangeFromUndoRedo = void 0;
    this.saveSequentializer = new TaskSequentializer();
    this.ignoreSaveFromSaveParticipants = false;
    //#endregion
    //#region State
    this.inConflictMode = false;
    this.inErrorMode = false;
    this._register(workingCopyService.registerWorkingCopy(this));
    this.registerListeners();
  }
  get model() {
    return this._model;
  }
  registerListeners() {
    this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeReadonly.fire()));
  }
  isDirty() {
    return this.dirty;
  }
  markModified() {
    this.setDirty(true);
  }
  setDirty(dirty) {
    if (!this.isResolved()) {
      return;
    }
    const wasDirty = this.dirty;
    this.doSetDirty(dirty);
    if (dirty !== wasDirty) {
      this._onDidChangeDirty.fire();
    }
  }
  doSetDirty(dirty) {
    const wasDirty = this.dirty;
    const wasInConflictMode = this.inConflictMode;
    const wasInErrorMode = this.inErrorMode;
    const oldSavedVersionId = this.savedVersionId;
    if (!dirty) {
      this.dirty = false;
      this.inConflictMode = false;
      this.inErrorMode = false;
      if (this.isResolved()) {
        this.savedVersionId = this.model.versionId;
      }
    } else {
      this.dirty = true;
    }
    return () => {
      this.dirty = wasDirty;
      this.inConflictMode = wasInConflictMode;
      this.inErrorMode = wasInErrorMode;
      this.savedVersionId = oldSavedVersionId;
    };
  }
  // !!! DO NOT MARK PRIVATE! USED IN TESTS !!!
  isResolved() {
    return !!this.model;
  }
  async resolve(options) {
    this.trace("resolve() - enter");
    if (this.isDisposed()) {
      this.trace("resolve() - exit - without resolving because file working copy is disposed");
      return;
    }
    if (!options?.contents && (this.dirty || this.saveSequentializer.isRunning())) {
      this.trace("resolve() - exit - without resolving because file working copy is dirty or being saved");
      return;
    }
    return this.doResolve(options);
  }
  async doResolve(options) {
    if (options?.contents) {
      return this.resolveFromBuffer(options.contents);
    }
    const isNew = !this.isResolved();
    if (isNew) {
      const resolvedFromBackup = await this.resolveFromBackup();
      if (resolvedFromBackup) {
        return;
      }
    }
    return this.resolveFromFile(options);
  }
  async resolveFromBuffer(buffer) {
    this.trace("resolveFromBuffer()");
    let mtime;
    let ctime;
    let size;
    let etag;
    try {
      const metadata = await this.fileService.stat(this.resource);
      mtime = metadata.mtime;
      ctime = metadata.ctime;
      size = metadata.size;
      etag = metadata.etag;
      this.setOrphaned(false);
    } catch (error) {
      mtime = Date.now();
      ctime = Date.now();
      size = 0;
      etag = ETAG_DISABLED;
      this.setOrphaned(error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND);
    }
    return this.resolveFromContent(
      {
        resource: this.resource,
        name: this.name,
        mtime,
        ctime,
        size,
        etag,
        value: buffer,
        readonly: false,
        locked: false,
        executable: false
      },
      true
      /* dirty (resolved from buffer) */
    );
  }
  async resolveFromBackup() {
    const backup = await this.workingCopyBackupService.resolve(this);
    const isNew = !this.isResolved();
    if (!isNew) {
      this.trace("resolveFromBackup() - exit - withoutresolving because previously new file working copy got created meanwhile");
      return true;
    }
    if (backup) {
      await this.doResolveFromBackup(backup);
      return true;
    }
    return false;
  }
  async doResolveFromBackup(backup) {
    this.trace("doResolveFromBackup()");
    await this.resolveFromContent(
      {
        resource: this.resource,
        name: this.name,
        mtime: backup.meta ? backup.meta.mtime : Date.now(),
        ctime: backup.meta ? backup.meta.ctime : Date.now(),
        size: backup.meta ? backup.meta.size : 0,
        etag: backup.meta ? backup.meta.etag : ETAG_DISABLED,
        // etag disabled if unknown!
        value: backup.value,
        readonly: false,
        locked: false,
        executable: false
      },
      true
      /* dirty (resolved from backup) */
    );
    if (backup.meta?.orphaned) {
      this.setOrphaned(true);
    }
  }
  async resolveFromFile(options) {
    this.trace("resolveFromFile()");
    const forceReadFromFile = options?.forceReadFromFile;
    let etag;
    if (forceReadFromFile) {
      etag = ETAG_DISABLED;
    } else if (this.lastResolvedFileStat) {
      etag = this.lastResolvedFileStat.etag;
    }
    const currentVersionId = this.versionId;
    try {
      const content = await this.fileService.readFileStream(this.resource, {
        etag,
        limits: options?.limits
      });
      this.setOrphaned(false);
      if (currentVersionId !== this.versionId) {
        this.trace("resolveFromFile() - exit - without resolving because file working copy content changed");
        return;
      }
      await this.resolveFromContent(
        content,
        false
        /* not dirty (resolved from file) */
      );
    } catch (error) {
      const result = error.fileOperationResult;
      this.setOrphaned(result === FileOperationResult.FILE_NOT_FOUND);
      if (this.isResolved() && result === FileOperationResult.FILE_NOT_MODIFIED_SINCE) {
        if (error instanceof NotModifiedSinceFileOperationError) {
          this.updateLastResolvedFileStat(error.stat);
        }
        return;
      }
      if (this.isResolved() && result === FileOperationResult.FILE_NOT_FOUND && !forceReadFromFile) {
        return;
      }
      throw error;
    }
  }
  async resolveFromContent(content, dirty) {
    this.trace("resolveFromContent() - enter");
    if (this.isDisposed()) {
      this.trace("resolveFromContent() - exit - because working copy is disposed");
      return;
    }
    this.updateLastResolvedFileStat({
      resource: this.resource,
      name: content.name,
      mtime: content.mtime,
      ctime: content.ctime,
      size: content.size,
      etag: content.etag,
      readonly: content.readonly,
      locked: content.locked,
      executable: false,
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      children: void 0
    });
    if (this.isResolved()) {
      await this.doUpdateModel(content.value);
    } else {
      await this.doCreateModel(content.value);
    }
    this.setDirty(!!dirty);
    this._onDidResolve.fire();
  }
  async doCreateModel(contents) {
    this.trace("doCreateModel()");
    this._model = this._register(await this.modelFactory.createModel(this.resource, contents, CancellationToken.None));
    this.installModelListeners(this._model);
  }
  async doUpdateModel(contents) {
    this.trace("doUpdateModel()");
    this.ignoreDirtyOnModelContentChange = true;
    try {
      await this.model?.update(contents, CancellationToken.None);
    } finally {
      this.ignoreDirtyOnModelContentChange = false;
    }
  }
  installModelListeners(model) {
    this._register(model.onDidChangeContent((e) => this.onModelContentChanged(model, e.isUndoing || e.isRedoing)));
    this._register(model.onWillDispose(() => this.dispose()));
  }
  onModelContentChanged(model, isUndoingOrRedoing) {
    this.trace(`onModelContentChanged() - enter`);
    this.versionId++;
    this.trace(`onModelContentChanged() - new versionId ${this.versionId}`);
    if (isUndoingOrRedoing) {
      this.lastContentChangeFromUndoRedo = Date.now();
    }
    if (!this.ignoreDirtyOnModelContentChange && !this.isReadonly()) {
      if (model.versionId === this.savedVersionId) {
        this.trace("onModelContentChanged() - model content changed back to last saved version");
        const wasDirty = this.dirty;
        this.setDirty(false);
        if (wasDirty) {
          this._onDidRevert.fire();
        }
      } else {
        this.trace("onModelContentChanged() - model content changed and marked as dirty");
        this.setDirty(true);
      }
    }
    this._onDidChangeContent.fire();
  }
  async forceResolveFromFile() {
    if (this.isDisposed()) {
      return;
    }
    await this.externalResolver({
      forceReadFromFile: true
    });
  }
  //#endregion
  //#region Backup
  get backupDelay() {
    return this.model?.configuration?.backupDelay;
  }
  async backup(token) {
    let meta = void 0;
    if (this.lastResolvedFileStat) {
      meta = {
        mtime: this.lastResolvedFileStat.mtime,
        ctime: this.lastResolvedFileStat.ctime,
        size: this.lastResolvedFileStat.size,
        etag: this.lastResolvedFileStat.etag,
        orphaned: this.isOrphaned()
      };
    }
    let content = void 0;
    if (this.isResolved()) {
      content = await raceCancellation(this.model.snapshot(SnapshotContext.Backup, token), token);
    }
    return { meta, content };
  }
  static {
    this.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD = 500;
  }
  async save(options = /* @__PURE__ */ Object.create(null)) {
    if (!this.isResolved()) {
      return false;
    }
    if (this.isReadonly()) {
      this.trace("save() - ignoring request for readonly resource");
      return false;
    }
    if ((this.hasState(3 /* CONFLICT */) || this.hasState(5 /* ERROR */)) && (options.reason === SaveReason.AUTO || options.reason === SaveReason.FOCUS_CHANGE || options.reason === SaveReason.WINDOW_CHANGE)) {
      this.trace("save() - ignoring auto save request for file working copy that is in conflict or error");
      return false;
    }
    this.trace("save() - enter");
    await this.doSave(options);
    this.trace("save() - exit");
    return this.hasState(0 /* SAVED */);
  }
  async doSave(options) {
    if (typeof options.reason !== "number") {
      options.reason = SaveReason.EXPLICIT;
    }
    const versionId = this.versionId;
    this.trace(`doSave(${versionId}) - enter with versionId ${versionId}`);
    if (this.ignoreSaveFromSaveParticipants) {
      this.trace(`doSave(${versionId}) - exit - refusing to save() recursively from save participant`);
      return;
    }
    if (this.saveSequentializer.isRunning(versionId)) {
      this.trace(`doSave(${versionId}) - exit - found a running save for versionId ${versionId}`);
      return this.saveSequentializer.running;
    }
    if (!options.force && !this.dirty) {
      this.trace(`doSave(${versionId}) - exit - because not dirty and/or versionId is different (this.isDirty: ${this.dirty}, this.versionId: ${this.versionId})`);
      return;
    }
    if (this.saveSequentializer.isRunning()) {
      this.trace(`doSave(${versionId}) - exit - because busy saving`);
      this.saveSequentializer.cancelRunning();
      return this.saveSequentializer.queue(() => this.doSave(options));
    }
    if (this.isResolved()) {
      this.model.pushStackElement();
    }
    const saveCancellation = new CancellationTokenSource();
    return this.progressService.withProgress({
      title: localize("saveParticipants", "Saving '{0}'", this.name),
      location: ProgressLocation.Window,
      cancellable: true,
      delay: this.isDirty() ? 3e3 : 5e3
    }, (progress) => {
      return this.doSaveSequential(versionId, options, progress, saveCancellation);
    }, () => {
      saveCancellation.cancel();
    }).finally(() => {
      saveCancellation.dispose();
    });
  }
  doSaveSequential(versionId, options, progress, saveCancellation) {
    return this.saveSequentializer.run(versionId, (async () => {
      if (this.isResolved() && !options.skipSaveParticipants && this.workingCopyFileService.hasSaveParticipants) {
        try {
          if (options.reason === SaveReason.AUTO && typeof this.lastContentChangeFromUndoRedo === "number") {
            const timeFromUndoRedoToSave = Date.now() - this.lastContentChangeFromUndoRedo;
            if (timeFromUndoRedoToSave < StoredFileWorkingCopy.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD) {
              await timeout(StoredFileWorkingCopy.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD - timeFromUndoRedoToSave);
            }
          }
          if (!saveCancellation.token.isCancellationRequested) {
            this.ignoreSaveFromSaveParticipants = true;
            try {
              await this.workingCopyFileService.runSaveParticipants(this, { reason: options.reason ?? SaveReason.EXPLICIT, savedFrom: options.from }, progress, saveCancellation.token);
            } catch (err) {
              if (isCancellationError(err) && !saveCancellation.token.isCancellationRequested) {
                saveCancellation.cancel();
              }
            } finally {
              this.ignoreSaveFromSaveParticipants = false;
            }
          }
        } catch (error) {
          this.logService.error(`[stored file working copy] runSaveParticipants(${versionId}) - resulted in an error: ${error.toString()}`, this.resource.toString(), this.typeId);
        }
      }
      if (saveCancellation.token.isCancellationRequested) {
        return;
      }
      if (this.isDisposed()) {
        return;
      }
      if (!this.isResolved()) {
        return;
      }
      versionId = this.versionId;
      this.inErrorMode = false;
      progress.report({ message: localize("saveTextFile", "Writing into file...") });
      this.trace(`doSave(${versionId}) - before write()`);
      const lastResolvedFileStat = assertReturnsDefined(this.lastResolvedFileStat);
      const resolvedFileWorkingCopy = this;
      return this.saveSequentializer.run(versionId, (async () => {
        try {
          const writeFileOptions = {
            mtime: lastResolvedFileStat.mtime,
            etag: options.ignoreModifiedSince || !this.filesConfigurationService.preventSaveConflicts(lastResolvedFileStat.resource) ? ETAG_DISABLED : lastResolvedFileStat.etag,
            unlock: options.writeUnlock
          };
          let stat;
          if (typeof resolvedFileWorkingCopy.model.save === "function") {
            try {
              stat = await resolvedFileWorkingCopy.model.save(writeFileOptions, saveCancellation.token);
            } catch (error) {
              if (saveCancellation.token.isCancellationRequested) {
                return void 0;
              }
              throw error;
            }
          } else {
            const snapshot = await raceCancellation(resolvedFileWorkingCopy.model.snapshot(SnapshotContext.Save, saveCancellation.token), saveCancellation.token);
            if (saveCancellation.token.isCancellationRequested) {
              return;
            } else {
              saveCancellation.dispose();
            }
            if (options?.writeElevated && this.elevatedFileService.isSupported(lastResolvedFileStat.resource)) {
              stat = await this.elevatedFileService.writeFileElevated(lastResolvedFileStat.resource, assertReturnsDefined(snapshot), writeFileOptions);
            } else {
              stat = await this.fileService.writeFile(lastResolvedFileStat.resource, assertReturnsDefined(snapshot), writeFileOptions);
            }
          }
          this.handleSaveSuccess(stat, versionId, options);
        } catch (error) {
          this.handleSaveError(error, versionId, options);
        }
      })(), () => saveCancellation.cancel());
    })(), () => saveCancellation.cancel());
  }
  handleSaveSuccess(stat, versionId, options) {
    this.updateLastResolvedFileStat(stat);
    if (versionId === this.versionId) {
      this.trace(`handleSaveSuccess(${versionId}) - setting dirty to false because versionId did not change`);
      this.setDirty(false);
    } else {
      this.trace(`handleSaveSuccess(${versionId}) - not setting dirty to false because versionId did change meanwhile`);
    }
    this.setOrphaned(false);
    this._onDidSave.fire({ reason: options.reason, stat, source: options.source });
  }
  handleSaveError(error, versionId, options) {
    (options.ignoreErrorHandler ? this.logService.trace : this.logService.error).apply(this.logService, [`[stored file working copy] handleSaveError(${versionId}) - exit - resulted in a save error: ${error.toString()}`, this.resource.toString(), this.typeId]);
    if (options.ignoreErrorHandler) {
      throw error;
    }
    this.setDirty(true);
    this.inErrorMode = true;
    if (error.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
      this.inConflictMode = true;
    }
    this.doHandleSaveError(error, options);
    this._onDidSaveError.fire();
  }
  doHandleSaveError(error, options) {
    const fileOperationError = error;
    const primaryActions = [];
    let message;
    if (fileOperationError.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
      message = localize("staleSaveError", "Failed to save '{0}': The content of the file is newer. Do you want to overwrite the file with your changes?", this.name);
      primaryActions.push(toAction({ id: "fileWorkingCopy.overwrite", label: localize("overwrite", "Overwrite"), run: () => this.save({ ...options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT }) }));
      primaryActions.push(toAction({ id: "fileWorkingCopy.revert", label: localize("revert", "Revert"), run: () => this.revert() }));
    } else {
      const isWriteLocked = fileOperationError.fileOperationResult === FileOperationResult.FILE_WRITE_LOCKED;
      const triedToUnlock = isWriteLocked && fileOperationError.options?.unlock;
      const isPermissionDenied = fileOperationError.fileOperationResult === FileOperationResult.FILE_PERMISSION_DENIED;
      const canSaveElevated = this.elevatedFileService.isSupported(this.resource);
      if (isErrorWithActions(error)) {
        primaryActions.push(...error.actions);
      }
      if (canSaveElevated && (isPermissionDenied || triedToUnlock)) {
        primaryActions.push(toAction({
          id: "fileWorkingCopy.saveElevated",
          label: triedToUnlock ? isWindows ? localize("overwriteElevated", "Overwrite as Admin...") : localize("overwriteElevatedSudo", "Overwrite as Sudo...") : isWindows ? localize("saveElevated", "Retry as Admin...") : localize("saveElevatedSudo", "Retry as Sudo..."),
          run: () => {
            this.save({ ...options, writeElevated: true, writeUnlock: triedToUnlock, reason: SaveReason.EXPLICIT });
          }
        }));
      } else if (isWriteLocked) {
        primaryActions.push(toAction({ id: "fileWorkingCopy.unlock", label: localize("overwrite", "Overwrite"), run: () => this.save({ ...options, writeUnlock: true, reason: SaveReason.EXPLICIT }) }));
      } else {
        primaryActions.push(toAction({ id: "fileWorkingCopy.retry", label: localize("retry", "Retry"), run: () => this.save({ ...options, reason: SaveReason.EXPLICIT }) }));
      }
      primaryActions.push(toAction({
        id: "fileWorkingCopy.saveAs",
        label: localize("saveAs", "Save As..."),
        run: async () => {
          const editor = this.workingCopyEditorService.findEditor(this);
          if (editor) {
            const result = await this.editorService.save(editor, { saveAs: true, reason: SaveReason.EXPLICIT });
            if (!result.success) {
              this.doHandleSaveError(error, options);
            }
          }
        }
      }));
      primaryActions.push(toAction({ id: "fileWorkingCopy.revert", label: localize("revert", "Revert"), run: () => this.revert() }));
      if (isWriteLocked) {
        if (triedToUnlock && canSaveElevated) {
          message = isWindows ? localize("readonlySaveErrorAdmin", "Failed to save '{0}': File is read-only. Select 'Overwrite as Admin' to retry as administrator.", this.name) : localize("readonlySaveErrorSudo", "Failed to save '{0}': File is read-only. Select 'Overwrite as Sudo' to retry as superuser.", this.name);
        } else {
          message = localize("readonlySaveError", "Failed to save '{0}': File is read-only. Select 'Overwrite' to attempt to make it writeable.", this.name);
        }
      } else if (canSaveElevated && isPermissionDenied) {
        message = isWindows ? localize("permissionDeniedSaveError", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Admin' to retry as administrator.", this.name) : localize("permissionDeniedSaveErrorSudo", "Failed to save '{0}': Insufficient permissions. Select 'Retry as Sudo' to retry as superuser.", this.name);
      } else {
        message = localize({ key: "genericSaveError", comment: ["{0} is the resource that failed to save and {1} the error message"] }, "Failed to save '{0}': {1}", this.name, toErrorMessage(error, false));
      }
    }
    const handle = this.notificationService.notify({ id: `${hash(this.resource.toString())}`, severity: Severity.Error, message, actions: { primary: primaryActions } });
    const listener = this._register(Event.once(Event.any(this.onDidSave, this.onDidRevert))(() => handle.close()));
    this._register(Event.once(handle.onDidClose)(() => listener.dispose()));
  }
  updateLastResolvedFileStat(newFileStat) {
    const oldReadonly = this.isReadonly();
    if (!this.lastResolvedFileStat) {
      this.lastResolvedFileStat = newFileStat;
    } else if (this.lastResolvedFileStat.mtime <= newFileStat.mtime) {
      this.lastResolvedFileStat = newFileStat;
    } else {
      this.lastResolvedFileStat = { ...this.lastResolvedFileStat, readonly: newFileStat.readonly, locked: newFileStat.locked };
    }
    if (this.isReadonly() !== oldReadonly) {
      this._onDidChangeReadonly.fire();
    }
  }
  //#endregion
  //#region Revert
  async revert(options) {
    if (!this.isResolved() || !this.dirty && !options?.force) {
      return;
    }
    this.trace("revert()");
    const wasDirty = this.dirty;
    const undoSetDirty = this.doSetDirty(false);
    const softUndo = options?.soft;
    if (!softUndo) {
      try {
        await this.forceResolveFromFile();
      } catch (error) {
        if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
          undoSetDirty();
          throw error;
        }
      }
    }
    this._onDidRevert.fire();
    if (wasDirty) {
      this._onDidChangeDirty.fire();
    }
  }
  hasState(state) {
    switch (state) {
      case 3 /* CONFLICT */:
        return this.inConflictMode;
      case 1 /* DIRTY */:
        return this.dirty;
      case 5 /* ERROR */:
        return this.inErrorMode;
      case 4 /* ORPHAN */:
        return this.isOrphaned();
      case 2 /* PENDING_SAVE */:
        return this.saveSequentializer.isRunning();
      case 0 /* SAVED */:
        return !this.dirty;
    }
  }
  async joinState(state) {
    return this.saveSequentializer.running;
  }
  //#endregion
  //#region Utilities
  isReadonly() {
    return this.filesConfigurationService.isReadonly(this.resource, this.lastResolvedFileStat);
  }
  trace(msg) {
    this.logService.trace(`[stored file working copy] ${msg}`, this.resource.toString(), this.typeId);
  }
  //#endregion
  //#region Dispose
  dispose() {
    this.trace("dispose()");
    this.inConflictMode = false;
    this.inErrorMode = false;
    this._model = void 0;
    super.dispose();
  }
  //#endregion
};
StoredFileWorkingCopy = __decorateClass([
  __decorateParam(5, IFileService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IWorkingCopyFileService),
  __decorateParam(8, IFilesConfigurationService),
  __decorateParam(9, IWorkingCopyBackupService),
  __decorateParam(10, IWorkingCopyService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, IWorkingCopyEditorService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IElevatedFileService),
  __decorateParam(15, IProgressService)
], StoredFileWorkingCopy);
export {
  StoredFileWorkingCopy,
  StoredFileWorkingCopyState,
  isStoredFileWorkingCopySaveEvent
};
