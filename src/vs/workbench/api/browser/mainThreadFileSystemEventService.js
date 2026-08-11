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
import { DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { FileOperation, IFileService } from "../../../platform/files/common/files.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { localize } from "../../../nls.js";
import { IWorkingCopyFileService } from "../../services/workingCopy/common/workingCopyFileService.js";
import { IBulkEditService } from "../../../editor/browser/services/bulkEditService.js";
import { IProgressService, ProgressLocation } from "../../../platform/progress/common/progress.js";
import { raceCancellation } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import Severity from "../../../base/common/severity.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { Action2, registerAction2 } from "../../../platform/actions/common/actions.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { reviveWorkspaceEditDto } from "./mainThreadBulkEdits.js";
import { URI } from "../../../base/common/uri.js";
let MainThreadFileSystemEventService = class {
  constructor(extHostContext, _fileService, workingCopyFileService, bulkEditService, progressService, dialogService, storageService, logService, envService, uriIdentService, _logService) {
    this._fileService = _fileService;
    this._logService = _logService;
    this._listener = new DisposableStore();
    this._watches = new DisposableMap();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostFileSystemEventService);
    this._listener.add(_fileService.onDidFilesChange((event) => {
      this._proxy.$onFileEvent({
        created: event.rawAdded,
        changed: event.rawUpdated,
        deleted: event.rawDeleted
      });
    }));
    const that = this;
    const fileOperationParticipant = new class {
      async participate(files, operation, undoInfo, timeout, token) {
        if (undoInfo?.isUndoing) {
          return;
        }
        const cts = new CancellationTokenSource(token);
        const timer = setTimeout(() => cts.cancel(), timeout);
        const data = await progressService.withProgress({
          location: ProgressLocation.Notification,
          title: this._progressLabel(operation),
          cancellable: true,
          delay: Math.min(timeout / 2, 3e3)
        }, () => {
          const onWillEvent = that._proxy.$onWillRunFileOperation(operation, files, timeout, cts.token);
          return raceCancellation(onWillEvent, cts.token);
        }, () => {
          cts.cancel();
        }).finally(() => {
          cts.dispose();
          clearTimeout(timer);
        });
        if (!data || data.edit.edits.length === 0) {
          return;
        }
        const needsConfirmation = data.edit.edits.some((edit) => edit.metadata?.needsConfirmation);
        let showPreview = storageService.getBoolean(MainThreadFileSystemEventService.MementoKeyAdditionalEdits, StorageScope.PROFILE);
        if (envService.extensionTestsLocationURI) {
          showPreview = false;
        }
        if (showPreview === void 0) {
          let message;
          if (data.extensionNames.length === 1) {
            if (operation === FileOperation.CREATE) {
              message = localize("ask.1.create", "Extension '{0}' wants to make refactoring changes with this file creation", data.extensionNames[0]);
            } else if (operation === FileOperation.COPY) {
              message = localize("ask.1.copy", "Extension '{0}' wants to make refactoring changes with this file copy", data.extensionNames[0]);
            } else if (operation === FileOperation.MOVE) {
              message = localize("ask.1.move", "Extension '{0}' wants to make refactoring changes with this file move", data.extensionNames[0]);
            } else {
              message = localize("ask.1.delete", "Extension '{0}' wants to make refactoring changes with this file deletion", data.extensionNames[0]);
            }
          } else {
            if (operation === FileOperation.CREATE) {
              message = localize({ key: "ask.N.create", comment: ['{0} is a number, e.g "3 extensions want..."'] }, "{0} extensions want to make refactoring changes with this file creation", data.extensionNames.length);
            } else if (operation === FileOperation.COPY) {
              message = localize({ key: "ask.N.copy", comment: ['{0} is a number, e.g "3 extensions want..."'] }, "{0} extensions want to make refactoring changes with this file copy", data.extensionNames.length);
            } else if (operation === FileOperation.MOVE) {
              message = localize({ key: "ask.N.move", comment: ['{0} is a number, e.g "3 extensions want..."'] }, "{0} extensions want to make refactoring changes with this file move", data.extensionNames.length);
            } else {
              message = localize({ key: "ask.N.delete", comment: ['{0} is a number, e.g "3 extensions want..."'] }, "{0} extensions want to make refactoring changes with this file deletion", data.extensionNames.length);
            }
          }
          if (needsConfirmation) {
            const { confirmed } = await dialogService.confirm({
              type: Severity.Info,
              message,
              primaryButton: localize("preview", "Show &&Preview"),
              cancelButton: localize("cancel", "Skip Changes")
            });
            showPreview = true;
            if (!confirmed) {
              return;
            }
          } else {
            let Choice;
            ((Choice2) => {
              Choice2[Choice2["OK"] = 0] = "OK";
              Choice2[Choice2["Preview"] = 1] = "Preview";
              Choice2[Choice2["Cancel"] = 2] = "Cancel";
            })(Choice || (Choice = {}));
            const { result, checkboxChecked } = await dialogService.prompt({
              type: Severity.Info,
              message,
              buttons: [
                {
                  label: localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
                  run: () => 0 /* OK */
                },
                {
                  label: localize({ key: "preview", comment: ["&& denotes a mnemonic"] }, "Show &&Preview"),
                  run: () => 1 /* Preview */
                }
              ],
              cancelButton: {
                label: localize("cancel", "Skip Changes"),
                run: () => 2 /* Cancel */
              },
              checkbox: { label: localize("again", "Do not ask me again") }
            });
            if (result === 2 /* Cancel */) {
              return;
            }
            showPreview = result === 1 /* Preview */;
            if (checkboxChecked) {
              storageService.store(MainThreadFileSystemEventService.MementoKeyAdditionalEdits, showPreview, StorageScope.PROFILE, StorageTarget.USER);
            }
          }
        }
        logService.info("[onWill-handler] applying additional workspace edit from extensions", data.extensionNames);
        await bulkEditService.apply(
          reviveWorkspaceEditDto(data.edit, uriIdentService),
          { undoRedoGroupId: undoInfo?.undoRedoGroupId, showPreview }
        );
      }
      _progressLabel(operation) {
        switch (operation) {
          case FileOperation.CREATE:
            return localize("msg-create", "Running 'File Create' participants...");
          case FileOperation.MOVE:
            return localize("msg-rename", "Running 'File Rename' participants...");
          case FileOperation.COPY:
            return localize("msg-copy", "Running 'File Copy' participants...");
          case FileOperation.DELETE:
            return localize("msg-delete", "Running 'File Delete' participants...");
          case FileOperation.WRITE:
            return localize("msg-write", "Running 'File Write' participants...");
        }
      }
    }();
    this._listener.add(workingCopyFileService.addFileOperationParticipant(fileOperationParticipant));
    this._listener.add(workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => this._proxy.$onDidRunFileOperation(e.operation, e.files)));
  }
  async $watch(extensionId, session, resource, unvalidatedOpts, correlate) {
    const uri = URI.revive(resource);
    const canHandleWatcher = await this._fileService.canHandleResource(uri);
    if (!canHandleWatcher) {
      this._logService.warn(`MainThreadFileSystemEventService#$watch(): cannot watch resource as its scheme is not handled by the file service (extension: ${extensionId}, path: ${uri.toString(true)})`);
    }
    const opts = {
      ...unvalidatedOpts
    };
    if (opts.recursive) {
      try {
        const stat = await this._fileService.stat(uri);
        if (!stat.isDirectory) {
          opts.recursive = false;
        }
      } catch (error) {
      }
    }
    if (correlate && !opts.recursive) {
      this._logService.trace(`MainThreadFileSystemEventService#$watch(): request to start watching correlated (extension: ${extensionId}, path: ${uri.toString(true)}, recursive: ${opts.recursive}, session: ${session}, excludes: ${JSON.stringify(opts.excludes)}, includes: ${JSON.stringify(opts.includes)})`);
      const watcherDisposables = new DisposableStore();
      const subscription = watcherDisposables.add(this._fileService.createWatcher(uri, { ...opts, recursive: false }));
      watcherDisposables.add(subscription.onDidChange((event) => {
        this._proxy.$onFileEvent({
          session,
          created: event.rawAdded,
          changed: event.rawUpdated,
          deleted: event.rawDeleted
        });
      }));
      this._watches.set(session, watcherDisposables);
    } else {
      this._logService.trace(`MainThreadFileSystemEventService#$watch(): request to start watching uncorrelated (extension: ${extensionId}, path: ${uri.toString(true)}, recursive: ${opts.recursive}, session: ${session}, excludes: ${JSON.stringify(opts.excludes)}, includes: ${JSON.stringify(opts.includes)})`);
      const subscription = this._fileService.watch(uri, opts);
      this._watches.set(session, subscription);
    }
  }
  $unwatch(session) {
    if (this._watches.has(session)) {
      this._logService.trace(`MainThreadFileSystemEventService#$unwatch(): request to stop watching (session: ${session})`);
      this._watches.deleteAndDispose(session);
    }
  }
  dispose() {
    this._listener.dispose();
    this._watches.dispose();
  }
};
MainThreadFileSystemEventService.MementoKeyAdditionalEdits = `file.particpants.additionalEdits`;
MainThreadFileSystemEventService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadFileSystemEventService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IWorkingCopyFileService),
  __decorateParam(3, IBulkEditService),
  __decorateParam(4, IProgressService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IEnvironmentService),
  __decorateParam(9, IUriIdentityService),
  __decorateParam(10, ILogService)
], MainThreadFileSystemEventService);
registerAction2(class ResetMemento extends Action2 {
  constructor() {
    super({
      id: "files.participants.resetChoice",
      title: {
        value: localize("label", "Reset choice for 'File operation needs preview'"),
        original: `Reset choice for 'File operation needs preview'`
      },
      f1: true
    });
  }
  run(accessor) {
    accessor.get(IStorageService).remove(MainThreadFileSystemEventService.MementoKeyAdditionalEdits, StorageScope.PROFILE);
  }
});
export {
  MainThreadFileSystemEventService
};
