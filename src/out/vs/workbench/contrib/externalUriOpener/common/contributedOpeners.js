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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Memento } from "../../../common/memento.js";
import { updateContributedOpeners } from "./configuration.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
let ContributedExternalUriOpenersStore = class extends Disposable {
  constructor(storageService, _extensionService) {
    super();
    this._extensionService = _extensionService;
    this._openers = /* @__PURE__ */ new Map();
    this._memento = new Memento(ContributedExternalUriOpenersStore.STORAGE_ID, storageService);
    this._mementoObject = this._memento.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    for (const [id, value] of Object.entries(this._mementoObject || {})) {
      if (value) {
        this.add(id, value.extensionId, { isCurrentlyRegistered: false });
      }
    }
    this.invalidateOpenersOnExtensionsChanged();
    this._register(this._extensionService.onDidChangeExtensions(() => this.invalidateOpenersOnExtensionsChanged()));
    this._register(this._extensionService.onDidChangeExtensionsStatus(() => this.invalidateOpenersOnExtensionsChanged()));
  }
  static {
    this.STORAGE_ID = "externalUriOpeners";
  }
  didRegisterOpener(id, extensionId) {
    this.add(id, extensionId, {
      isCurrentlyRegistered: true
    });
  }
  add(id, extensionId, options) {
    const existing = this._openers.get(id);
    if (existing) {
      existing.isCurrentlyRegistered = existing.isCurrentlyRegistered || options.isCurrentlyRegistered;
      return;
    }
    const entry = {
      extensionId,
      isCurrentlyRegistered: options.isCurrentlyRegistered
    };
    this._openers.set(id, entry);
    this._mementoObject[id] = entry;
    this._memento.saveMemento();
    this.updateSchema();
  }
  delete(id) {
    this._openers.delete(id);
    delete this._mementoObject[id];
    this._memento.saveMemento();
    this.updateSchema();
  }
  async invalidateOpenersOnExtensionsChanged() {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const registeredExtensions = this._extensionService.extensions;
    for (const [id, entry] of this._openers) {
      const extension = registeredExtensions.find((r) => r.identifier.value === entry.extensionId);
      if (extension) {
        if (!this._extensionService.canRemoveExtension(extension)) {
          if (!entry.isCurrentlyRegistered) {
            this.delete(id);
          }
        }
      } else {
        this.delete(id);
      }
    }
  }
  updateSchema() {
    const ids = [];
    const descriptions = [];
    for (const [id, entry] of this._openers) {
      ids.push(id);
      descriptions.push(entry.extensionId);
    }
    updateContributedOpeners(ids, descriptions);
  }
};
ContributedExternalUriOpenersStore = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IExtensionService)
], ContributedExternalUriOpenersStore);
export {
  ContributedExternalUriOpenersStore
};
