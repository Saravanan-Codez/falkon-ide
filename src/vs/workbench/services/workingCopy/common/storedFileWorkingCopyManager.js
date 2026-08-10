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
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { StoredFileWorkingCopy, StoredFileWorkingCopyState } from "./storedFileWorkingCopy.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { Promises, ResourceQueue } from "../../../../base/common/async.js";
import { FileChangeType, FileOperation, IFileService } from "../../../../platform/files/common/files.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { joinPath } from "../../../../base/common/resources.js";
import { IWorkingCopyFileService } from "./workingCopyFileService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
import { BaseFileWorkingCopyManager } from "./abstractFileWorkingCopyManager.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyEditorService } from "./workingCopyEditorService.js";
import { IWorkingCopyService } from "./workingCopyService.js";
import { isWeb } from "../../../../base/common/platform.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { SnapshotContext } from "./fileWorkingCopy.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
let StoredFileWorkingCopyManager = class extends BaseFileWorkingCopyManager {
  constructor(workingCopyTypeId, modelFactory, fileService, lifecycleService, labelService, logService, workingCopyFileService, workingCopyBackupService, uriIdentityService, filesConfigurationService, workingCopyService, notificationService, workingCopyEditorService, editorService, elevatedFileService, progressService) {
    super(fileService, logService, workingCopyBackupService);
    this.workingCopyTypeId = workingCopyTypeId;
    this.modelFactory = modelFactory;
    this.lifecycleService = lifecycleService;
    this.labelService = labelService;
    this.workingCopyFileService = workingCopyFileService;
    this.uriIdentityService = uriIdentityService;
    this.filesConfigurationService = filesConfigurationService;
    this.workingCopyService = workingCopyService;
    this.notificationService = notificationService;
    this.workingCopyEditorService = workingCopyEditorService;
    this.editorService = editorService;
    this.elevatedFileService = elevatedFileService;
    this.progressService = progressService;
    //#region Events
    this._onDidResolve = this._register(new Emitter());
    this.onDidResolve = this._onDidResolve.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    this._onDidChangeOrphaned = this._register(new Emitter());
    this.onDidChangeOrphaned = this._onDidChangeOrphaned.event;
    this._onDidSaveError = this._register(new Emitter());
    this.onDidSaveError = this._onDidSaveError.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidRevert = this._register(new Emitter());
    this.onDidRevert = this._onDidRevert.event;
    this._onDidRemove = this._register(new Emitter());
    this.onDidRemove = this._onDidRemove.event;
    //#endregion
    this.mapResourceToWorkingCopyListeners = new ResourceMap();
    this.mapResourceToPendingWorkingCopyResolve = new ResourceMap();
    this.workingCopyResolveQueue = this._register(new ResourceQueue());
    //#endregion
    //#region Working Copy File Events
    this.mapCorrelationIdToWorkingCopiesToRestore = /* @__PURE__ */ new Map();
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderCapabilities((e) => this.onDidChangeFileSystemProviderCapabilities(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderRegistrations((e) => this.onDidChangeFileSystemProviderRegistrations(e)));
    this._register(this.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => this.onWillRunWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidFailWorkingCopyFileOperation((e) => this.onDidFailWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => this.onDidRunWorkingCopyFileOperation(e)));
    if (isWeb) {
      this._register(this.lifecycleService.onBeforeShutdown((event) => event.veto(this.onBeforeShutdownWeb(), "veto.fileWorkingCopyManager")));
    } else {
      this._register(this.lifecycleService.onWillShutdown((event) => event.join(this.onWillShutdownDesktop(), { id: "join.fileWorkingCopyManager", label: localize("join.fileWorkingCopyManager", "Saving working copies") })));
    }
  }
  onBeforeShutdownWeb() {
    if (this.workingCopies.some((workingCopy) => workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE))) {
      return true;
    }
    return false;
  }
  async onWillShutdownDesktop() {
    let pendingSavedWorkingCopies;
    while ((pendingSavedWorkingCopies = this.workingCopies.filter((workingCopy) => workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE))).length > 0) {
      await Promises.settled(pendingSavedWorkingCopies.map((workingCopy) => workingCopy.joinState(StoredFileWorkingCopyState.PENDING_SAVE)));
    }
  }
  //#region Resolve from file or file provider changes
  onDidChangeFileSystemProviderCapabilities(e) {
    this.queueWorkingCopyReloads(e.scheme);
  }
  onDidChangeFileSystemProviderRegistrations(e) {
    if (!e.added) {
      return;
    }
    this.queueWorkingCopyReloads(e.scheme);
  }
  onDidFilesChange(e) {
    this.queueWorkingCopyReloads(e);
  }
  queueWorkingCopyReloads(schemeOrEvent) {
    for (const workingCopy of this.workingCopies) {
      if (workingCopy.isDirty()) {
        continue;
      }
      let resolveWorkingCopy = false;
      if (typeof schemeOrEvent === "string") {
        resolveWorkingCopy = schemeOrEvent === workingCopy.resource.scheme;
      } else {
        resolveWorkingCopy = schemeOrEvent.contains(workingCopy.resource, FileChangeType.UPDATED, FileChangeType.ADDED);
      }
      if (resolveWorkingCopy) {
        this.queueWorkingCopyReload(workingCopy);
      }
    }
  }
  queueWorkingCopyReload(workingCopy) {
    const queueSize = this.workingCopyResolveQueue.queueSize(workingCopy.resource);
    if (queueSize <= 1) {
      this.workingCopyResolveQueue.queueFor(workingCopy.resource, async () => {
        try {
          await this.reload(workingCopy);
        } catch (error) {
          this.logService.error(error);
        }
      });
    }
  }
  onWillRunWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      e.waitUntil((async () => {
        const workingCopiesToRestore = [];
        for (const { source, target } of e.files) {
          if (source) {
            if (this.uriIdentityService.extUri.isEqual(source, target)) {
              continue;
            }
            const sourceWorkingCopies = [];
            for (const workingCopy of this.workingCopies) {
              if (this.uriIdentityService.extUri.isEqualOrParent(workingCopy.resource, source)) {
                sourceWorkingCopies.push(workingCopy);
              }
            }
            for (const sourceWorkingCopy of sourceWorkingCopies) {
              const sourceResource = sourceWorkingCopy.resource;
              let targetResource;
              if (this.uriIdentityService.extUri.isEqual(sourceResource, source)) {
                targetResource = target;
              } else {
                targetResource = joinPath(target, sourceResource.path.substr(source.path.length + 1));
              }
              workingCopiesToRestore.push({
                source: sourceResource,
                target: targetResource,
                snapshot: sourceWorkingCopy.isDirty() ? await sourceWorkingCopy.model?.snapshot(SnapshotContext.Save, CancellationToken.None) : void 0
              });
            }
          }
        }
        this.mapCorrelationIdToWorkingCopiesToRestore.set(e.correlationId, workingCopiesToRestore);
      })());
    }
  }
  onDidFailWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      const workingCopiesToRestore = this.mapCorrelationIdToWorkingCopiesToRestore.get(e.correlationId);
      if (workingCopiesToRestore) {
        this.mapCorrelationIdToWorkingCopiesToRestore.delete(e.correlationId);
        for (const workingCopy of workingCopiesToRestore) {
          if (workingCopy.snapshot) {
            this.get(workingCopy.source)?.markModified();
          }
        }
      }
    }
  }
  onDidRunWorkingCopyFileOperation(e) {
    switch (e.operation) {
      // Create: Revert existing working copies
      case FileOperation.CREATE:
        e.waitUntil((async () => {
          for (const { target } of e.files) {
            const workingCopy = this.get(target);
            if (workingCopy && !workingCopy.isDisposed()) {
              await workingCopy.revert();
            }
          }
        })());
        break;
      // Move/Copy: restore working copies that were loaded before the operation took place
      case FileOperation.MOVE:
      case FileOperation.COPY:
        e.waitUntil((async () => {
          const workingCopiesToRestore = this.mapCorrelationIdToWorkingCopiesToRestore.get(e.correlationId);
          if (workingCopiesToRestore) {
            this.mapCorrelationIdToWorkingCopiesToRestore.delete(e.correlationId);
            await Promises.settled(workingCopiesToRestore.map(async (workingCopyToRestore) => {
              const target = this.uriIdentityService.asCanonicalUri(workingCopyToRestore.target);
              await this.resolve(target, {
                reload: { async: false },
                // enforce a reload
                contents: workingCopyToRestore.snapshot
              });
            }));
          }
        })());
        break;
    }
  }
  //#endregion
  //#region Reload & Resolve
  async reload(workingCopy) {
    await this.joinPendingResolves(workingCopy.resource);
    if (workingCopy.isDirty() || workingCopy.isDisposed() || !this.has(workingCopy.resource)) {
      return;
    }
    await this.doResolve(workingCopy, { reload: { async: false } });
  }
  async resolve(resource, options) {
    const pendingResolve = this.joinPendingResolves(resource);
    if (pendingResolve) {
      await pendingResolve;
    }
    return this.doResolve(resource, options);
  }
  async doResolve(resourceOrWorkingCopy, options) {
    let workingCopy;
    let resource;
    if (URI.isUri(resourceOrWorkingCopy)) {
      resource = resourceOrWorkingCopy;
      workingCopy = this.get(resource);
    } else {
      resource = resourceOrWorkingCopy.resource;
      workingCopy = resourceOrWorkingCopy;
    }
    let workingCopyResolve;
    let didCreateWorkingCopy = false;
    const resolveOptions = {
      contents: options?.contents,
      forceReadFromFile: options?.reload?.force,
      limits: options?.limits
    };
    if (workingCopy) {
      if (options?.contents) {
        workingCopyResolve = workingCopy.resolve(resolveOptions);
      } else if (options?.reload) {
        if (options.reload.async) {
          workingCopyResolve = Promise.resolve();
          (async () => {
            try {
              await workingCopy.resolve(resolveOptions);
            } catch (error) {
              if (!workingCopy.isDisposed()) {
                onUnexpectedError(error);
              }
            }
          })();
        } else {
          workingCopyResolve = workingCopy.resolve(resolveOptions);
        }
      } else {
        workingCopyResolve = Promise.resolve();
      }
    } else {
      didCreateWorkingCopy = true;
      workingCopy = new StoredFileWorkingCopy(
        this.workingCopyTypeId,
        resource,
        this.labelService.getUriBasenameLabel(resource),
        this.modelFactory,
        async (options2) => {
          await this.resolve(resource, { ...options2, reload: { async: false } });
        },
        this.fileService,
        this.logService,
        this.workingCopyFileService,
        this.filesConfigurationService,
        this.workingCopyBackupService,
        this.workingCopyService,
        this.notificationService,
        this.workingCopyEditorService,
        this.editorService,
        this.elevatedFileService,
        this.progressService
      );
      workingCopyResolve = workingCopy.resolve(resolveOptions);
      this.registerWorkingCopy(workingCopy);
    }
    this.mapResourceToPendingWorkingCopyResolve.set(resource, workingCopyResolve);
    this.add(resource, workingCopy);
    if (didCreateWorkingCopy) {
      if (workingCopy.isDirty()) {
        this._onDidChangeDirty.fire(workingCopy);
      }
    }
    try {
      await workingCopyResolve;
    } catch (error) {
      if (didCreateWorkingCopy) {
        workingCopy.dispose();
      }
      throw error;
    } finally {
      this.mapResourceToPendingWorkingCopyResolve.delete(resource);
    }
    if (didCreateWorkingCopy && workingCopy.isDirty()) {
      this._onDidChangeDirty.fire(workingCopy);
    }
    return workingCopy;
  }
  joinPendingResolves(resource) {
    const pendingWorkingCopyResolve = this.mapResourceToPendingWorkingCopyResolve.get(resource);
    if (!pendingWorkingCopyResolve) {
      return;
    }
    return this.doJoinPendingResolves(resource);
  }
  async doJoinPendingResolves(resource) {
    let currentWorkingCopyResolve;
    while (this.mapResourceToPendingWorkingCopyResolve.has(resource)) {
      const nextPendingWorkingCopyResolve = this.mapResourceToPendingWorkingCopyResolve.get(resource);
      if (nextPendingWorkingCopyResolve === currentWorkingCopyResolve) {
        return;
      }
      currentWorkingCopyResolve = nextPendingWorkingCopyResolve;
      try {
        await nextPendingWorkingCopyResolve;
      } catch (error) {
      }
    }
  }
  registerWorkingCopy(workingCopy) {
    const workingCopyListeners = new DisposableStore();
    workingCopyListeners.add(workingCopy.onDidResolve(() => this._onDidResolve.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidChangeDirty(() => this._onDidChangeDirty.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidChangeReadonly(() => this._onDidChangeReadonly.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidChangeOrphaned(() => this._onDidChangeOrphaned.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidSaveError(() => this._onDidSaveError.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidSave((e) => this._onDidSave.fire({ workingCopy, ...e })));
    workingCopyListeners.add(workingCopy.onDidRevert(() => this._onDidRevert.fire(workingCopy)));
    this.mapResourceToWorkingCopyListeners.set(workingCopy.resource, workingCopyListeners);
  }
  remove(resource) {
    const removed = super.remove(resource);
    const workingCopyListener = this.mapResourceToWorkingCopyListeners.get(resource);
    if (workingCopyListener) {
      dispose(workingCopyListener);
      this.mapResourceToWorkingCopyListeners.delete(resource);
    }
    if (removed) {
      this._onDidRemove.fire(resource);
    }
    return removed;
  }
  //#endregion
  //#region Lifecycle
  canDispose(workingCopy) {
    if (workingCopy.isDisposed() || !this.mapResourceToPendingWorkingCopyResolve.has(workingCopy.resource) && !workingCopy.isDirty()) {
      return true;
    }
    return this.doCanDispose(workingCopy);
  }
  async doCanDispose(workingCopy) {
    const pendingResolve = this.joinPendingResolves(workingCopy.resource);
    if (pendingResolve) {
      await pendingResolve;
      return this.canDispose(workingCopy);
    }
    if (workingCopy.isDirty()) {
      await Event.toPromise(workingCopy.onDidChangeDirty);
      return this.canDispose(workingCopy);
    }
    return true;
  }
  dispose() {
    super.dispose();
    this.mapResourceToPendingWorkingCopyResolve.clear();
    dispose(this.mapResourceToWorkingCopyListeners.values());
    this.mapResourceToWorkingCopyListeners.clear();
  }
  //#endregion
};
StoredFileWorkingCopyManager = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IWorkingCopyFileService),
  __decorateParam(7, IWorkingCopyBackupService),
  __decorateParam(8, IUriIdentityService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, IWorkingCopyService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, IWorkingCopyEditorService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IElevatedFileService),
  __decorateParam(15, IProgressService)
], StoredFileWorkingCopyManager);
export {
  StoredFileWorkingCopyManager
};
