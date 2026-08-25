import { ThrottledDelayer } from "../../../common/async.js";
import { Event, PauseableEmitter } from "../../../common/event.js";
import { Disposable } from "../../../common/lifecycle.js";
import { parse, stringify } from "../../../common/marshalling.js";
import { isObject, isUndefined, isUndefinedOrNull } from "../../../common/types.js";
var StorageHint = /* @__PURE__ */ ((StorageHint2) => {
  StorageHint2[StorageHint2["STORAGE_DOES_NOT_EXIST"] = 0] = "STORAGE_DOES_NOT_EXIST";
  StorageHint2[StorageHint2["STORAGE_IN_MEMORY"] = 1] = "STORAGE_IN_MEMORY";
  return StorageHint2;
})(StorageHint || {});
function isStorageItemsChangeEvent(thing) {
  const candidate = thing;
  return candidate?.changed instanceof Map || candidate?.deleted instanceof Set;
}
var StorageState = /* @__PURE__ */ ((StorageState2) => {
  StorageState2[StorageState2["None"] = 0] = "None";
  StorageState2[StorageState2["Initialized"] = 1] = "Initialized";
  StorageState2[StorageState2["Closed"] = 2] = "Closed";
  return StorageState2;
})(StorageState || {});
class Storage extends Disposable {
  constructor(database, options = /* @__PURE__ */ Object.create(null)) {
    super();
    this.database = database;
    this.options = options;
    this._onDidChangeStorage = this._register(new PauseableEmitter());
    this.onDidChangeStorage = this._onDidChangeStorage.event;
    this.state = 0 /* None */;
    this.cache = /* @__PURE__ */ new Map();
    this.flushDelayer = this._register(new ThrottledDelayer(Storage.DEFAULT_FLUSH_DELAY));
    this.pendingDeletes = /* @__PURE__ */ new Set();
    this.pendingInserts = /* @__PURE__ */ new Map();
    this.pendingClose = void 0;
    this.whenFlushedCallbacks = [];
    this.registerListeners();
  }
  static {
    this.DEFAULT_FLUSH_DELAY = 100;
  }
  registerListeners() {
    this._register(this.database.onDidChangeItemsExternal((e) => this.onDidChangeItemsExternal(e)));
  }
  onDidChangeItemsExternal(e) {
    this._onDidChangeStorage.pause();
    try {
      e.changed?.forEach((value, key) => this.acceptExternal(key, value));
      e.deleted?.forEach((key) => this.acceptExternal(key, void 0));
    } finally {
      this._onDidChangeStorage.resume();
    }
  }
  acceptExternal(key, value) {
    if (this.state === 2 /* Closed */) {
      return;
    }
    let changed = false;
    if (isUndefinedOrNull(value)) {
      changed = this.cache.delete(key);
    } else {
      const currentValue = this.cache.get(key);
      if (currentValue !== value) {
        this.cache.set(key, value);
        changed = true;
      }
    }
    if (changed) {
      this._onDidChangeStorage.fire({ key, external: true });
    }
  }
  get items() {
    return this.cache;
  }
  get size() {
    return this.cache.size;
  }
  async init() {
    if (this.state !== 0 /* None */) {
      return;
    }
    this.state = 1 /* Initialized */;
    if (this.options.hint === 0 /* STORAGE_DOES_NOT_EXIST */) {
      return;
    }
    this.cache = await this.database.getItems();
  }
  get(key, fallbackValue) {
    const value = this.cache.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    return value;
  }
  getBoolean(key, fallbackValue) {
    const value = this.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    return value === "true";
  }
  getNumber(key, fallbackValue) {
    const value = this.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    return parseInt(value, 10);
  }
  getObject(key, fallbackValue) {
    const value = this.get(key);
    if (isUndefinedOrNull(value)) {
      return fallbackValue;
    }
    return parse(value);
  }
  async set(key, value, external = false) {
    if (this.state === 2 /* Closed */) {
      return;
    }
    if (isUndefinedOrNull(value)) {
      return this.delete(key, external);
    }
    const valueStr = isObject(value) || Array.isArray(value) ? stringify(value) : String(value);
    const currentValue = this.cache.get(key);
    if (currentValue === valueStr) {
      return;
    }
    this.cache.set(key, valueStr);
    this.pendingInserts.set(key, valueStr);
    this.pendingDeletes.delete(key);
    this._onDidChangeStorage.fire({ key, external });
    return this.doFlush();
  }
  async delete(key, external = false) {
    if (this.state === 2 /* Closed */) {
      return;
    }
    const wasDeleted = this.cache.delete(key);
    if (!wasDeleted) {
      return;
    }
    if (!this.pendingDeletes.has(key)) {
      this.pendingDeletes.add(key);
    }
    this.pendingInserts.delete(key);
    this._onDidChangeStorage.fire({ key, external });
    return this.doFlush();
  }
  async optimize() {
    if (this.state === 2 /* Closed */) {
      return;
    }
    await this.flush(0);
    return this.database.optimize();
  }
  async close() {
    if (!this.pendingClose) {
      this.pendingClose = this.doClose();
    }
    return this.pendingClose;
  }
  async doClose() {
    this.state = 2 /* Closed */;
    try {
      await this.doFlush(
        0
        /* as soon as possible */
      );
    } catch {
    }
    await this.database.close(() => this.cache);
  }
  get hasPending() {
    return this.pendingInserts.size > 0 || this.pendingDeletes.size > 0;
  }
  async flushPending() {
    if (!this.hasPending) {
      return;
    }
    const updateRequest = { insert: this.pendingInserts, delete: this.pendingDeletes };
    this.pendingDeletes = /* @__PURE__ */ new Set();
    this.pendingInserts = /* @__PURE__ */ new Map();
    return this.database.updateItems(updateRequest).finally(() => {
      if (!this.hasPending) {
        while (this.whenFlushedCallbacks.length) {
          this.whenFlushedCallbacks.pop()?.();
        }
      }
    });
  }
  async flush(delay) {
    if (this.state === 2 /* Closed */ || // Return early if we are already closed
    this.pendingClose) {
      return;
    }
    return this.doFlush(delay);
  }
  async doFlush(delay) {
    if (this.options.hint === 1 /* STORAGE_IN_MEMORY */) {
      return this.flushPending();
    }
    return this.flushDelayer.trigger(() => this.flushPending(), delay);
  }
  async whenFlushed() {
    if (!this.hasPending) {
      return;
    }
    return new Promise((resolve) => this.whenFlushedCallbacks.push(resolve));
  }
  isInMemory() {
    return this.options.hint === 1 /* STORAGE_IN_MEMORY */;
  }
}
class InMemoryStorageDatabase {
  constructor() {
    this.onDidChangeItemsExternal = Event.None;
    this.items = /* @__PURE__ */ new Map();
  }
  async getItems() {
    return this.items;
  }
  async updateItems(request) {
    request.insert?.forEach((value, key) => this.items.set(key, value));
    request.delete?.forEach((key) => this.items.delete(key));
  }
  async optimize() {
  }
  async close() {
  }
}
const MIGRATED_KEY = "__$__migratedStorageMarker";
class MigratingStorage extends Storage {
  constructor() {
    super(...arguments);
    this.migratedKeys = /* @__PURE__ */ new Set();
    this.fallbackStorage = void 0;
    this.isFallbackStorageReadonly = false;
  }
  async init() {
    await super.init();
    this.migratedKeys = this.loadMigratedKeys();
  }
  setFallbackStorage(storage, isReadonly) {
    this.fallbackStorage = storage;
    this.isFallbackStorageReadonly = isReadonly;
  }
  static {
    this.INTERNAL_KEY_PREFIX = "__$__";
  }
  get(key, fallbackValue) {
    if (!key.startsWith(MigratingStorage.INTERNAL_KEY_PREFIX) && !this.migratedKeys.has(key) && isUndefined(super.get(key))) {
      this.migratedKeys.add(key);
      const value = this.fallbackStorage?.items.get(key);
      if (!isUndefined(value)) {
        this.set(key, value);
        if (!this.isFallbackStorageReadonly) {
          this.fallbackStorage?.delete(key);
        }
        this.persistMigratedKeys();
      }
    }
    return super.get(key, fallbackValue);
  }
  loadMigratedKeys() {
    const raw = super.get(MIGRATED_KEY);
    if (raw) {
      try {
        return new Set(JSON.parse(raw));
      } catch {
      }
    }
    return /* @__PURE__ */ new Set();
  }
  persistMigratedKeys() {
    this.set(MIGRATED_KEY, JSON.stringify([...this.migratedKeys]));
  }
}
export {
  InMemoryStorageDatabase,
  MIGRATED_KEY,
  MigratingStorage,
  Storage,
  StorageHint,
  StorageState,
  isStorageItemsChangeEvent
};
