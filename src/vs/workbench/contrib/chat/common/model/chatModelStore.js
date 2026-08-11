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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, ReferenceCollection } from "../../../../../base/common/lifecycle.js";
import { ObservableMap } from "../../../../../base/common/observable.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ModifiedFileEntryState } from "../editing/chatEditingService.js";
let ChatModelStore = class extends Disposable {
  constructor(delegate, logService) {
    super();
    this.delegate = delegate;
    this.logService = logService;
    this._models = new ObservableMap();
    this._modelsToDispose = /* @__PURE__ */ new Set();
    this._pendingDisposals = /* @__PURE__ */ new Set();
    this._modelCreateOwners = /* @__PURE__ */ new Map();
    this._referenceOwners = /* @__PURE__ */ new Map();
    this._referenceOwnerIds = 0;
    this._onDidDisposeModel = this._register(new Emitter());
    this.onDidDisposeModel = this._onDidDisposeModel.event;
    this._onDidCreateModel = this._register(new Emitter());
    this.onDidCreateModel = this._onDidCreateModel.event;
    const self = this;
    this._refCollection = new class extends ReferenceCollection {
      createReferencedObject(key, props, debugOwner) {
        return self.createReferencedObject(key, props, debugOwner);
      }
      destroyReferencedObject(key, object) {
        return self.destroyReferencedObject(key, object);
      }
    }();
  }
  get observable() {
    return this._models.observable;
  }
  values() {
    return this._models.values();
  }
  /**
   * Get a ChatModel directly without acquiring a reference.
   */
  get(uri) {
    return this._models.get(this.toKey(uri));
  }
  has(uri) {
    return this._models.has(this.toKey(uri));
  }
  acquireExisting(uri, debugOwner) {
    const key = this.toKey(uri);
    if (!this._models.has(key)) {
      return void 0;
    }
    return this.wrapReference(key, this._refCollection.acquire(key, void 0, debugOwner), debugOwner);
  }
  acquireOrCreate(props, debugOwner) {
    const key = this.toKey(props.sessionResource);
    return this.wrapReference(key, this._refCollection.acquire(key, props, debugOwner), debugOwner);
  }
  getReferenceDebugSnapshot() {
    const models = Array.from(this._models.values()).map((model) => {
      const key = this.toKey(model.sessionResource);
      const owners = this._referenceOwners.get(key) ?? /* @__PURE__ */ new Map();
      const countsByOwner = /* @__PURE__ */ new Map();
      for (const owner of owners.values()) {
        countsByOwner.set(owner, (countsByOwner.get(owner) ?? 0) + 1);
      }
      const holders = Array.from(countsByOwner.entries()).map(([holder, count]) => ({ holder, count })).sort((a, b) => b.count - a.count || a.holder.localeCompare(b.holder));
      return {
        sessionResource: model.sessionResource,
        title: model.title,
        createdBy: this._modelCreateOwners.get(key) ?? "unknown",
        initialLocation: model.initialLocation,
        isImported: !!model.isImported,
        willKeepAlive: model.willKeepAlive,
        hasPendingEdits: !!model.editingSession?.entries.get().some((entry) => entry.state.get() === ModifiedFileEntryState.Modified),
        pendingDisposal: this._modelsToDispose.has(key),
        referenceCount: owners.size,
        holders
      };
    }).sort((a, b) => b.referenceCount - a.referenceCount || Number(b.hasPendingEdits) - Number(a.hasPendingEdits) || a.sessionResource.toString().localeCompare(b.sessionResource.toString()));
    return {
      totalModels: models.length,
      totalReferences: models.reduce((total, model) => total + model.referenceCount, 0),
      models
    };
  }
  createReferencedObject(key, props, debugOwner) {
    this._modelsToDispose.delete(key);
    const existingModel = this._models.get(key);
    if (existingModel) {
      return existingModel;
    }
    if (!props) {
      throw new Error(`No start session props provided for chat session ${key}`);
    }
    this.logService.trace(`Creating chat session ${key}`);
    const model = this.delegate.createModel(props);
    this._modelCreateOwners.set(key, debugOwner ?? "unspecified");
    if (model.sessionResource.toString() !== key) {
      throw new Error(`Chat session key mismatch for ${key}`);
    }
    this._models.set(key, model);
    this._onDidCreateModel.fire(model);
    return model;
  }
  destroyReferencedObject(key, object) {
    this._modelsToDispose.add(key);
    const promise = this.doDestroyReferencedObject(key, object);
    this._pendingDisposals.add(promise);
    promise.finally(() => {
      this._pendingDisposals.delete(promise);
    });
  }
  async doDestroyReferencedObject(key, object) {
    try {
      await this.delegate.willDisposeModel(object);
    } catch (error) {
      this.logService.error(error);
    } finally {
      if (this._modelsToDispose.has(key)) {
        this.logService.trace(`Disposing chat session ${key}`);
        this._models.delete(key);
        this._modelCreateOwners.delete(key);
        this._referenceOwners.delete(key);
        this._onDidDisposeModel.fire(object);
        object.dispose();
      }
      this._modelsToDispose.delete(key);
    }
  }
  wrapReference(key, reference, debugOwner) {
    const ownerId = ++this._referenceOwnerIds;
    let ownerEntries = this._referenceOwners.get(key);
    if (!ownerEntries) {
      ownerEntries = /* @__PURE__ */ new Map();
      this._referenceOwners.set(key, ownerEntries);
    }
    ownerEntries.set(ownerId, debugOwner ?? "unspecified");
    let isDisposed = false;
    const wrapped = {
      object: reference.object,
      dispose: () => {
        if (isDisposed) {
          return;
        }
        isDisposed = true;
        const owners = this._referenceOwners.get(key);
        owners?.delete(ownerId);
        if (owners?.size === 0) {
          this._referenceOwners.delete(key);
        }
        reference.dispose();
        wrapped.object = null;
      }
    };
    return wrapped;
  }
  /**
   * For test use only
   */
  async waitForModelDisposals() {
    await Promise.all(this._pendingDisposals);
  }
  toKey(uri) {
    return uri.toString();
  }
  dispose() {
    super.dispose();
    this._models.forEach((model) => model.dispose());
  }
};
ChatModelStore = __decorateClass([
  __decorateParam(1, ILogService)
], ChatModelStore);
export {
  ChatModelStore
};
