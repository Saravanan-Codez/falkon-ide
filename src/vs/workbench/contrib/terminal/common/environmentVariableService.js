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
import { Emitter } from "../../../../base/common/event.js";
import { debounce, throttle } from "../../../../base/common/decorators.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { MergedEnvironmentVariableCollection } from "../../../../platform/terminal/common/environmentVariableCollection.js";
import { deserializeEnvironmentDescriptionMap, deserializeEnvironmentVariableCollection, serializeEnvironmentDescriptionMap, serializeEnvironmentVariableCollection } from "../../../../platform/terminal/common/environmentVariableShared.js";
import { TerminalStorageKeys } from "./terminalStorageKeys.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
let EnvironmentVariableService = class extends Disposable {
  constructor(_extensionService, _storageService) {
    super();
    this._extensionService = _extensionService;
    this._storageService = _storageService;
    this.collections = /* @__PURE__ */ new Map();
    this._onDidChangeCollections = this._register(new Emitter());
    this._storageService.remove(TerminalStorageKeys.DeprecatedEnvironmentVariableCollections, StorageScope.WORKSPACE);
    const serializedPersistedCollections = this._storageService.get(TerminalStorageKeys.EnvironmentVariableCollections, StorageScope.WORKSPACE);
    if (serializedPersistedCollections) {
      const collectionsJson = JSON.parse(serializedPersistedCollections);
      collectionsJson.forEach((c) => this.collections.set(c.extensionIdentifier, {
        persistent: true,
        map: deserializeEnvironmentVariableCollection(c.collection),
        descriptionMap: deserializeEnvironmentDescriptionMap(c.description)
      }));
      this._invalidateExtensionCollections();
    }
    this.mergedCollection = this._resolveMergedCollection();
    this._register(this._extensionService.onDidChangeExtensions(() => this._invalidateExtensionCollections()));
  }
  get onDidChangeCollections() {
    return this._onDidChangeCollections.event;
  }
  set(extensionIdentifier, collection) {
    this.collections.set(extensionIdentifier, collection);
    this._updateCollections();
  }
  delete(extensionIdentifier) {
    this.collections.delete(extensionIdentifier);
    this._updateCollections();
  }
  _updateCollections() {
    this._persistCollectionsEventually();
    this.mergedCollection = this._resolveMergedCollection();
    this._notifyCollectionUpdatesEventually();
  }
  _persistCollectionsEventually() {
    this._persistCollections();
  }
  _persistCollections() {
    const collectionsJson = [];
    this.collections.forEach((collection, extensionIdentifier) => {
      if (collection.persistent) {
        collectionsJson.push({
          extensionIdentifier,
          collection: serializeEnvironmentVariableCollection(this.collections.get(extensionIdentifier).map),
          description: serializeEnvironmentDescriptionMap(collection.descriptionMap)
        });
      }
    });
    const stringifiedJson = JSON.stringify(collectionsJson);
    this._storageService.store(TerminalStorageKeys.EnvironmentVariableCollections, stringifiedJson, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  _notifyCollectionUpdatesEventually() {
    this._notifyCollectionUpdates();
  }
  _notifyCollectionUpdates() {
    this._onDidChangeCollections.fire(this.mergedCollection);
  }
  _resolveMergedCollection() {
    return new MergedEnvironmentVariableCollection(this.collections);
  }
  async _invalidateExtensionCollections() {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const registeredExtensions = this._extensionService.extensions;
    let changes = false;
    this.collections.forEach((_, extensionIdentifier) => {
      const isExtensionRegistered = registeredExtensions.some((r) => r.identifier.value === extensionIdentifier);
      if (!isExtensionRegistered) {
        this.collections.delete(extensionIdentifier);
        changes = true;
      }
    });
    if (changes) {
      this._updateCollections();
    }
  }
};
__decorateClass([
  throttle(1e3)
], EnvironmentVariableService.prototype, "_persistCollectionsEventually", 1);
__decorateClass([
  debounce(1e3)
], EnvironmentVariableService.prototype, "_notifyCollectionUpdatesEventually", 1);
EnvironmentVariableService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IStorageService)
], EnvironmentVariableService);
export {
  EnvironmentVariableService
};
