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
import { Event } from "../../../../../../base/common/event.js";
import { LRUCache } from "../../../../../../base/common/map.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../../../../../platform/storage/common/storage.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
const IChatOutputPartStateCache = createDecorator("IChatOutputPartStateCache");
const CACHE_STORAGE_KEY = "chat/outputPartStateCache";
const LEGACY_CACHE_STORAGE_KEY = "chat/toolOutputStateCache";
const CACHE_LIMIT = 100;
let ChatOutputPartStateCache = class {
  constructor(storageService) {
    this._cache = new LRUCache(CACHE_LIMIT, 0.75);
    const raw = storageService.get(CACHE_STORAGE_KEY, StorageScope.WORKSPACE, storageService.get(LEGACY_CACHE_STORAGE_KEY, StorageScope.WORKSPACE, "{}"));
    this._deserialize(raw);
    const onWillSaveStateBecauseOfShutdown = Event.filter(storageService.onWillSaveState, (e) => e.reason === WillSaveStateReason.SHUTDOWN);
    Event.once(onWillSaveStateBecauseOfShutdown)(() => {
      storageService.store(CACHE_STORAGE_KEY, this._serialize(), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    });
  }
  get(key) {
    return this._cache.get(key);
  }
  set(key, state) {
    this._cache.set(key, state);
  }
  _serialize() {
    const data = /* @__PURE__ */ Object.create(null);
    for (const [key, value] of this._cache) {
      data[key] = value;
    }
    return JSON.stringify(data);
  }
  _deserialize(raw) {
    try {
      const data = JSON.parse(raw);
      for (const key in data) {
        const state = data[key];
        if (typeof state.height === "number") {
          this._cache.set(key, { height: state.height, webviewState: typeof state.webviewState === "string" ? state.webviewState : void 0 });
        }
      }
    } catch {
    }
  }
};
ChatOutputPartStateCache = __decorateClass([
  __decorateParam(0, IStorageService)
], ChatOutputPartStateCache);
registerSingleton(IChatOutputPartStateCache, ChatOutputPartStateCache, InstantiationType.Delayed);
export {
  ChatOutputPartStateCache,
  IChatOutputPartStateCache
};
