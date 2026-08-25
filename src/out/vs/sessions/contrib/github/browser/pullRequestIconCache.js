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
import { ThemeIcon } from "../../../../base/common/themables.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const IPullRequestIconCache = createDecorator("pullRequestIconCache");
const MAX_CACHED_ICONS = 50;
const STORAGE_KEY = "sessions.github.pullRequestIconCache";
let PullRequestIconCache = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    /**
     * Cached icons keyed by PR link. A `Map` preserves insertion order, which we
     * treat as recency: the most recently updated entry is last, so eviction
     * removes the first (oldest) key.
     */
    this._icons = /* @__PURE__ */ new Map();
    this._load();
  }
  get(prLink) {
    return this._icons.get(prLink);
  }
  set(prLink, icon) {
    const existing = this._icons.get(prLink);
    if (existing && ThemeIcon.isEqual(existing, icon)) {
      return;
    }
    this._icons.delete(prLink);
    this._icons.set(prLink, icon);
    while (this._icons.size > MAX_CACHED_ICONS) {
      const oldest = this._icons.keys().next().value;
      if (oldest === void 0) {
        break;
      }
      this._icons.delete(oldest);
    }
    this._save();
  }
  _load() {
    const raw = this._storageService.get(STORAGE_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return;
    }
    let entries;
    try {
      entries = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(entries)) {
      return;
    }
    for (const entry of entries) {
      if (entry && typeof entry.link === "string" && ThemeIcon.isThemeIcon(entry.icon)) {
        this._icons.set(entry.link, entry.icon);
      }
    }
  }
  _save() {
    const entries = [];
    for (const [link, icon] of this._icons) {
      entries.push({ link, icon });
    }
    this._storageService.store(STORAGE_KEY, JSON.stringify(entries), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
};
PullRequestIconCache = __decorateClass([
  __decorateParam(0, IStorageService)
], PullRequestIconCache);
export {
  IPullRequestIconCache,
  PullRequestIconCache
};
