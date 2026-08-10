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
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { adoptToGalleryExtensionId, areSameExtensions, getExtensionId } from "./extensionManagementUtil.js";
import { IProductService } from "../../product/common/productService.js";
import { distinct } from "../../../base/common/arrays.js";
import { ILogService } from "../../log/common/log.js";
import { isString } from "../../../base/common/types.js";
const IExtensionStorageService = createDecorator("IExtensionStorageService");
const EXTENSION_KEYS_ID_VERSION_REGEX = /^extensionKeys\/([^.]+\..+)@(\d+\.\d+\.\d+(-.*)?)$/;
let ExtensionStorageService = class extends Disposable {
  constructor(storageService, productService, logService) {
    super();
    this.storageService = storageService;
    this.productService = productService;
    this.logService = logService;
    this._onDidChangeExtensionStorageToSync = this._register(new Emitter());
    this.onDidChangeExtensionStorageToSync = this._onDidChangeExtensionStorageToSync.event;
    this.extensionsWithKeysForSync = ExtensionStorageService.readAllExtensionsWithKeysForSync(storageService);
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, void 0, this._store)((e) => this.onDidChangeStorageValue(e)));
  }
  static {
    this.LARGE_STATE_WARNING_THRESHOLD = 512 * 1024;
  }
  static toKey(extension) {
    return `extensionKeys/${adoptToGalleryExtensionId(extension.id)}@${extension.version}`;
  }
  static fromKey(key) {
    const matches = EXTENSION_KEYS_ID_VERSION_REGEX.exec(key);
    if (matches && matches[1]) {
      return { id: matches[1], version: matches[2] };
    }
    return void 0;
  }
  /* TODO @sandy081: This has to be done across all profiles */
  static async removeOutdatedExtensionVersions(extensionManagementService, storageService) {
    const extensions = await extensionManagementService.getInstalled();
    const extensionVersionsToRemove = [];
    for (const [id, versions] of ExtensionStorageService.readAllExtensionsWithKeysForSync(storageService)) {
      const extensionVersion = extensions.find((e) => areSameExtensions(e.identifier, { id }))?.manifest.version;
      for (const version of versions) {
        if (extensionVersion !== version) {
          extensionVersionsToRemove.push(ExtensionStorageService.toKey({ id, version }));
        }
      }
    }
    for (const key of extensionVersionsToRemove) {
      storageService.remove(key, StorageScope.PROFILE);
    }
  }
  static readAllExtensionsWithKeysForSync(storageService) {
    const extensionsWithKeysForSync = /* @__PURE__ */ new Map();
    const keys = storageService.keys(StorageScope.PROFILE, StorageTarget.MACHINE);
    for (const key of keys) {
      const extensionIdWithVersion = ExtensionStorageService.fromKey(key);
      if (extensionIdWithVersion) {
        let versions = extensionsWithKeysForSync.get(extensionIdWithVersion.id.toLowerCase());
        if (!versions) {
          extensionsWithKeysForSync.set(extensionIdWithVersion.id.toLowerCase(), versions = []);
        }
        versions.push(extensionIdWithVersion.version);
      }
    }
    return extensionsWithKeysForSync;
  }
  onDidChangeStorageValue(e) {
    if (this.extensionsWithKeysForSync.has(e.key.toLowerCase())) {
      this._onDidChangeExtensionStorageToSync.fire();
      return;
    }
    const extensionIdWithVersion = ExtensionStorageService.fromKey(e.key);
    if (extensionIdWithVersion) {
      if (this.storageService.get(e.key, StorageScope.PROFILE) === void 0) {
        this.extensionsWithKeysForSync.delete(extensionIdWithVersion.id.toLowerCase());
      } else {
        let versions = this.extensionsWithKeysForSync.get(extensionIdWithVersion.id.toLowerCase());
        if (!versions) {
          this.extensionsWithKeysForSync.set(extensionIdWithVersion.id.toLowerCase(), versions = []);
        }
        versions.push(extensionIdWithVersion.version);
        this._onDidChangeExtensionStorageToSync.fire();
      }
      return;
    }
  }
  getExtensionId(extension) {
    if (isString(extension)) {
      return extension;
    }
    const publisher = extension.manifest ? extension.manifest.publisher : extension.publisher;
    const name = extension.manifest ? extension.manifest.name : extension.name;
    return getExtensionId(publisher, name);
  }
  getExtensionState(extension, global) {
    const extensionId = this.getExtensionId(extension);
    const jsonValue = this.getExtensionStateRaw(extension, global);
    if (jsonValue) {
      try {
        return JSON.parse(jsonValue);
      } catch (error) {
        this.logService.error(`[mainThreadStorage] unexpected error parsing storage contents (extensionId: ${extensionId}, global: ${global}): ${error}`);
      }
    }
    return void 0;
  }
  getExtensionStateRaw(extension, global) {
    const extensionId = this.getExtensionId(extension);
    const rawState = this.storageService.get(extensionId, global ? StorageScope.PROFILE : StorageScope.WORKSPACE);
    if (rawState && rawState?.length > ExtensionStorageService.LARGE_STATE_WARNING_THRESHOLD) {
      this.logService.warn(`[mainThreadStorage] large extension state detected (extensionId: ${extensionId}, global: ${global}): ${rawState.length / 1024}kb. Consider to use 'storageUri' or 'globalStorageUri' to store this data on disk instead.`);
    }
    return rawState;
  }
  setExtensionState(extension, state, global) {
    const extensionId = this.getExtensionId(extension);
    if (state === void 0) {
      this.storageService.remove(extensionId, global ? StorageScope.PROFILE : StorageScope.WORKSPACE);
    } else {
      this.storageService.store(
        extensionId,
        JSON.stringify(state),
        global ? StorageScope.PROFILE : StorageScope.WORKSPACE,
        StorageTarget.MACHINE
        /* Extension state is synced separately through extensions */
      );
    }
  }
  setKeysForSync(extensionIdWithVersion, keys) {
    this.storageService.store(ExtensionStorageService.toKey(extensionIdWithVersion), JSON.stringify(keys), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  getKeysForSync(extensionIdWithVersion) {
    const extensionKeysForSyncFromProduct = this.productService.extensionSyncedKeys?.[extensionIdWithVersion.id.toLowerCase()];
    const extensionKeysForSyncFromStorageValue = this.storageService.get(ExtensionStorageService.toKey(extensionIdWithVersion), StorageScope.PROFILE);
    const extensionKeysForSyncFromStorage = extensionKeysForSyncFromStorageValue ? JSON.parse(extensionKeysForSyncFromStorageValue) : void 0;
    return extensionKeysForSyncFromStorage && extensionKeysForSyncFromProduct ? distinct([...extensionKeysForSyncFromStorage, ...extensionKeysForSyncFromProduct]) : extensionKeysForSyncFromStorage || extensionKeysForSyncFromProduct;
  }
  addToMigrationList(from, to) {
    if (from !== to) {
      const migrationList = this.migrationList.filter((entry) => !entry.includes(from) && !entry.includes(to));
      migrationList.push([from, to]);
      this.migrationList = migrationList;
    }
  }
  getSourceExtensionToMigrate(toExtensionId) {
    const entry = this.migrationList.find(([, to]) => toExtensionId === to);
    return entry ? entry[0] : void 0;
  }
  get migrationList() {
    const value = this.storageService.get("extensionStorage.migrationList", StorageScope.APPLICATION, "[]");
    try {
      const migrationList = JSON.parse(value);
      if (Array.isArray(migrationList)) {
        return migrationList;
      }
    } catch (error) {
    }
    return [];
  }
  set migrationList(migrationList) {
    if (migrationList.length) {
      this.storageService.store("extensionStorage.migrationList", JSON.stringify(migrationList), StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove("extensionStorage.migrationList", StorageScope.APPLICATION);
    }
  }
};
ExtensionStorageService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IProductService),
  __decorateParam(2, ILogService)
], ExtensionStorageService);
export {
  ExtensionStorageService,
  IExtensionStorageService
};
