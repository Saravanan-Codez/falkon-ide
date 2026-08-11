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
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { TextFileEditorModel } from "./textFileEditorModel.js";
import { dispose, Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IFileService, FileOperation, FileChangeType } from "../../../../platform/files/common/files.js";
import { Promises, ResourceQueue } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { TextFileSaveParticipant } from "./textFileSaveParticipant.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IWorkingCopyFileService } from "../../workingCopy/common/workingCopyFileService.js";
import { extname, joinPath } from "../../../../base/common/resources.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../editor/common/model/textModel.js";
import { PLAINTEXT_EXTENSION, PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
let TextFileEditorModelManager = class extends Disposable {
  constructor(instantiationService, fileService, notificationService, workingCopyFileService, uriIdentityService) {
    super();
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.notificationService = notificationService;
    this.workingCopyFileService = workingCopyFileService;
    this.uriIdentityService = uriIdentityService;
    this._onDidCreate = this._register(new Emitter({
      leakWarningThreshold: 500,
      leakWarningName: "TextFileEditorModelManager._onDidCreate"
      /* increased for users with hundreds of inputs opened */
    }));
    this.onDidCreate = this._onDidCreate.event;
    this._onDidResolve = this._register(new Emitter());
    this.onDidResolve = this._onDidResolve.event;
    this._onDidRemove = this._register(new Emitter());
    this.onDidRemove = this._onDidRemove.event;
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
    this._onDidChangeEncoding = this._register(new Emitter());
    this.onDidChangeEncoding = this._onDidChangeEncoding.event;
    this.mapResourceToModel = new ResourceMap();
    this.mapResourceToModelListeners = new ResourceMap();
    this.mapResourceToDisposeListener = new ResourceMap();
    this.mapResourceToPendingModelResolvers = new ResourceMap();
    this.modelResolveQueue = this._register(new ResourceQueue());
    this.saveErrorHandler = (() => {
      const notificationService = this.notificationService;
      return {
        onSaveError(error, model) {
          notificationService.error(localize({ key: "genericSaveError", comment: ["{0} is the resource that failed to save and {1} the error message"] }, "Failed to save '{0}': {1}", model.name, toErrorMessage(error, false)));
        }
      };
    })();
    this.mapCorrelationIdToModelsToRestore = /* @__PURE__ */ new Map();
    this.saveParticipants = this._register(this.instantiationService.createInstance(TextFileSaveParticipant));
    this.registerListeners();
  }
  get models() {
    return [...this.mapResourceToModel.values()];
  }
  registerListeners() {
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderCapabilities((e) => this.onDidChangeFileSystemProviderCapabilities(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderRegistrations((e) => this.onDidChangeFileSystemProviderRegistrations(e)));
    this._register(this.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => this.onWillRunWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidFailWorkingCopyFileOperation((e) => this.onDidFailWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => this.onDidRunWorkingCopyFileOperation(e)));
  }
  onDidFilesChange(e) {
    for (const model of this.models) {
      if (model.isDirty()) {
        continue;
      }
      if (e.contains(model.resource, FileChangeType.UPDATED, FileChangeType.ADDED)) {
        this.queueModelReload(model);
      }
    }
  }
  onDidChangeFileSystemProviderCapabilities(e) {
    this.queueModelReloads(e.scheme);
  }
  onDidChangeFileSystemProviderRegistrations(e) {
    if (!e.added) {
      return;
    }
    this.queueModelReloads(e.scheme);
  }
  queueModelReloads(scheme) {
    for (const model of this.models) {
      if (model.isDirty()) {
        continue;
      }
      if (scheme === model.resource.scheme) {
        this.queueModelReload(model);
      }
    }
  }
  queueModelReload(model) {
    const queueSize = this.modelResolveQueue.queueSize(model.resource);
    if (queueSize <= 1) {
      this.modelResolveQueue.queueFor(model.resource, async () => {
        try {
          await this.reload(model);
        } catch (error) {
          onUnexpectedError(error);
        }
      });
    }
  }
  onWillRunWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      const modelsToRestore = [];
      for (const { source, target } of e.files) {
        if (source) {
          if (this.uriIdentityService.extUri.isEqual(source, target)) {
            continue;
          }
          const sourceModels = [];
          for (const model of this.models) {
            if (this.uriIdentityService.extUri.isEqualOrParent(model.resource, source)) {
              sourceModels.push(model);
            }
          }
          for (const sourceModel of sourceModels) {
            const sourceModelResource = sourceModel.resource;
            let targetModelResource;
            if (this.uriIdentityService.extUri.isEqual(sourceModelResource, source)) {
              targetModelResource = target;
            } else {
              targetModelResource = joinPath(target, sourceModelResource.path.substr(source.path.length + 1));
            }
            const languageId = sourceModel.getLanguageId();
            modelsToRestore.push({
              source: sourceModelResource,
              target: targetModelResource,
              language: languageId ? {
                id: languageId,
                explicit: sourceModel.languageChangeSource === "user"
              } : void 0,
              encoding: sourceModel.getEncoding(),
              snapshot: sourceModel.isDirty() ? sourceModel.createSnapshot() : void 0
            });
          }
        }
      }
      this.mapCorrelationIdToModelsToRestore.set(e.correlationId, modelsToRestore);
    }
  }
  onDidFailWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      const modelsToRestore = this.mapCorrelationIdToModelsToRestore.get(e.correlationId);
      if (modelsToRestore) {
        this.mapCorrelationIdToModelsToRestore.delete(e.correlationId);
        modelsToRestore.forEach((model) => {
          if (model.snapshot) {
            this.get(model.source)?.setDirty(true);
          }
        });
      }
    }
  }
  onDidRunWorkingCopyFileOperation(e) {
    switch (e.operation) {
      // Create: Revert existing models
      case FileOperation.CREATE:
        e.waitUntil((async () => {
          for (const { target } of e.files) {
            const model = this.get(target);
            if (model && !model.isDisposed()) {
              await model.revert();
            }
          }
        })());
        break;
      // Move/Copy: restore models that were resolved before the operation took place
      case FileOperation.MOVE:
      case FileOperation.COPY:
        e.waitUntil((async () => {
          const modelsToRestore = this.mapCorrelationIdToModelsToRestore.get(e.correlationId);
          if (modelsToRestore) {
            this.mapCorrelationIdToModelsToRestore.delete(e.correlationId);
            await Promises.settled(modelsToRestore.map(async (modelToRestore) => {
              const target = this.uriIdentityService.asCanonicalUri(modelToRestore.target);
              const restoredModel = await this.resolve(target, {
                reload: { async: false },
                // enforce a reload
                contents: modelToRestore.snapshot ? createTextBufferFactoryFromSnapshot(modelToRestore.snapshot) : void 0,
                encoding: modelToRestore.encoding
              });
              if (modelToRestore.language?.id && modelToRestore.language.id !== PLAINTEXT_LANGUAGE_ID) {
                if (modelToRestore.language.explicit) {
                  restoredModel.setLanguageId(modelToRestore.language.id);
                } else if (restoredModel.getLanguageId() === PLAINTEXT_LANGUAGE_ID && extname(target) !== PLAINTEXT_EXTENSION) {
                  restoredModel.updateTextEditorModel(void 0, modelToRestore.language.id);
                }
              }
            }));
          }
        })());
        break;
    }
  }
  get(resource) {
    return this.mapResourceToModel.get(resource);
  }
  has(resource) {
    return this.mapResourceToModel.has(resource);
  }
  async reload(model) {
    await this.joinPendingResolves(model.resource);
    if (model.isDirty() || model.isDisposed() || !this.has(model.resource)) {
      return;
    }
    await this.doResolve(model, { reload: { async: false } });
  }
  async resolve(resource, options) {
    const pendingResolve = this.joinPendingResolves(resource);
    if (pendingResolve) {
      await pendingResolve;
    }
    return this.doResolve(resource, options);
  }
  async doResolve(resourceOrModel, options) {
    let model;
    let resource;
    if (URI.isUri(resourceOrModel)) {
      resource = resourceOrModel;
      model = this.get(resource);
    } else {
      resource = resourceOrModel.resource;
      model = resourceOrModel;
    }
    let modelResolve;
    let didCreateModel = false;
    if (model) {
      if (options?.contents) {
        modelResolve = model.resolve(options);
      } else if (options?.reload) {
        if (options.reload.async) {
          modelResolve = Promise.resolve();
          (async () => {
            try {
              await model.resolve(options);
            } catch (error) {
              if (!model.isDisposed()) {
                onUnexpectedError(error);
              }
            }
          })();
        } else {
          modelResolve = model.resolve(options);
        }
      } else {
        modelResolve = Promise.resolve();
      }
    } else {
      didCreateModel = true;
      const newModel = model = this.instantiationService.createInstance(TextFileEditorModel, resource, options ? options.encoding : void 0, options ? options.languageId : void 0);
      modelResolve = model.resolve(options);
      this.registerModel(newModel);
    }
    this.mapResourceToPendingModelResolvers.set(resource, modelResolve);
    this.add(resource, model);
    if (didCreateModel) {
      this._onDidCreate.fire(model);
      if (model.isDirty()) {
        this._onDidChangeDirty.fire(model);
      }
    }
    try {
      await modelResolve;
    } catch (error) {
      if (didCreateModel) {
        model.dispose();
      }
      throw error;
    } finally {
      this.mapResourceToPendingModelResolvers.delete(resource);
    }
    if (options?.languageId) {
      model.setLanguageId(options.languageId);
    }
    if (didCreateModel && model.isDirty()) {
      this._onDidChangeDirty.fire(model);
    }
    return model;
  }
  joinPendingResolves(resource) {
    const pendingModelResolve = this.mapResourceToPendingModelResolvers.get(resource);
    if (!pendingModelResolve) {
      return;
    }
    return this.doJoinPendingResolves(resource);
  }
  async doJoinPendingResolves(resource) {
    let currentModelCopyResolve;
    while (this.mapResourceToPendingModelResolvers.has(resource)) {
      const nextPendingModelResolve = this.mapResourceToPendingModelResolvers.get(resource);
      if (nextPendingModelResolve === currentModelCopyResolve) {
        return;
      }
      currentModelCopyResolve = nextPendingModelResolve;
      try {
        await nextPendingModelResolve;
      } catch (error) {
      }
    }
  }
  registerModel(model) {
    const modelListeners = new DisposableStore();
    modelListeners.add(model.onDidResolve((reason) => this._onDidResolve.fire({ model, reason })));
    modelListeners.add(model.onDidChangeDirty(() => this._onDidChangeDirty.fire(model)));
    modelListeners.add(model.onDidChangeReadonly(() => this._onDidChangeReadonly.fire(model)));
    modelListeners.add(model.onDidChangeOrphaned(() => this._onDidChangeOrphaned.fire(model)));
    modelListeners.add(model.onDidSaveError(() => this._onDidSaveError.fire(model)));
    modelListeners.add(model.onDidSave((e) => this._onDidSave.fire({ model, ...e })));
    modelListeners.add(model.onDidRevert(() => this._onDidRevert.fire(model)));
    modelListeners.add(model.onDidChangeEncoding(() => this._onDidChangeEncoding.fire(model)));
    this.mapResourceToModelListeners.set(model.resource, modelListeners);
  }
  add(resource, model) {
    const knownModel = this.mapResourceToModel.get(resource);
    if (knownModel === model) {
      return;
    }
    const disposeListener = this.mapResourceToDisposeListener.get(resource);
    disposeListener?.dispose();
    this.mapResourceToModel.set(resource, model);
    this.mapResourceToDisposeListener.set(resource, model.onWillDispose(() => this.remove(resource)));
  }
  remove(resource) {
    const removed = this.mapResourceToModel.delete(resource);
    const disposeListener = this.mapResourceToDisposeListener.get(resource);
    if (disposeListener) {
      dispose(disposeListener);
      this.mapResourceToDisposeListener.delete(resource);
    }
    const modelListener = this.mapResourceToModelListeners.get(resource);
    if (modelListener) {
      dispose(modelListener);
      this.mapResourceToModelListeners.delete(resource);
    }
    if (removed) {
      this._onDidRemove.fire(resource);
    }
  }
  addSaveParticipant(participant) {
    return this.saveParticipants.addSaveParticipant(participant);
  }
  runSaveParticipants(model, context, progress, token) {
    return this.saveParticipants.participate(model, context, progress, token);
  }
  //#endregion
  canDispose(model) {
    if (model.isDisposed() || !this.mapResourceToPendingModelResolvers.has(model.resource) && !model.isDirty()) {
      return true;
    }
    return this.doCanDispose(model);
  }
  async doCanDispose(model) {
    const pendingResolve = this.joinPendingResolves(model.resource);
    if (pendingResolve) {
      await pendingResolve;
      return this.canDispose(model);
    }
    if (model.isDirty()) {
      await Event.toPromise(model.onDidChangeDirty);
      return this.canDispose(model);
    }
    return true;
  }
  dispose() {
    super.dispose();
    this.mapResourceToModel.clear();
    this.mapResourceToPendingModelResolvers.clear();
    dispose(this.mapResourceToDisposeListener.values());
    this.mapResourceToDisposeListener.clear();
    dispose(this.mapResourceToModelListeners.values());
    this.mapResourceToModelListeners.clear();
  }
};
TextFileEditorModelManager = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IWorkingCopyFileService),
  __decorateParam(4, IUriIdentityService)
], TextFileEditorModelManager);
export {
  TextFileEditorModelManager
};
