import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
const SYNC_STORAGE_KEY_PREFIX = "customizationSync.disabled.";
class AgentCustomizationSyncProvider extends Disposable {
  constructor(harnessId, _storageService) {
    super();
    this._storageService = _storageService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._storageKey = SYNC_STORAGE_KEY_PREFIX + harnessId;
    this._disabled = this._load();
  }
  isDisabled(uri) {
    return this._disabled.has(uri.toString());
  }
  setDisabled(uri, disabled) {
    const key = uri.toString();
    const had = this._disabled.has(key);
    if (disabled && !had) {
      this._disabled.add(key);
    } else if (!disabled && had) {
      this._disabled.delete(key);
    } else {
      return;
    }
    this._persist();
    this._onDidChange.fire();
  }
  _load() {
    const stored = this._storageService.get(this._storageKey, StorageScope.PROFILE);
    if (!stored) {
      return /* @__PURE__ */ new Set();
    }
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((v) => typeof v === "string"));
      }
    } catch {
    }
    return /* @__PURE__ */ new Set();
  }
  _persist() {
    this._storageService.store(
      this._storageKey,
      JSON.stringify([...this._disabled]),
      StorageScope.PROFILE,
      StorageTarget.MACHINE
    );
  }
}
export {
  AgentCustomizationSyncProvider
};
