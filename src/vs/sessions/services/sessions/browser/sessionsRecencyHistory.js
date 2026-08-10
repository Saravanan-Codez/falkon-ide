import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
function entryKey(sessionResource, chatResource) {
  return `${sessionResource.toString()}::${chatResource?.toString() ?? ""}`;
}
class SessionsRecencyHistory extends Disposable {
  constructor(_storageService, _logService) {
    super();
    this._storageService = _storageService;
    this._logService = _logService;
    this._entries = [];
    this._version = observableValue(this, 0);
    this._entries = this._load();
  }
  static {
    this.STORAGE_KEY = "agentSessions.recencyHistory";
  }
  static {
    this.MAX_RECENCY_ENTRIES = 50;
  }
  /** Bumped whenever {@link entries} changes, so observers can react. */
  get version() {
    return this._version;
  }
  /** The recency entries in MRU order (index 0 is the most recently opened). */
  get entries() {
    return this._entries;
  }
  /**
   * Record that the given session (optionally a specific chat within it) was
   * explicitly opened, promoting it to the front of the MRU list.
   */
  markOpened(sessionResource, chatResource) {
    const key = entryKey(sessionResource, chatResource);
    const existingIndex = this._entries.findIndex((e) => entryKey(e.sessionResource, e.chatResource) === key);
    if (existingIndex === 0) {
      return;
    }
    if (existingIndex > 0) {
      this._entries.splice(existingIndex, 1);
    }
    this._entries.unshift({ sessionResource, chatResource });
    if (this._entries.length > SessionsRecencyHistory.MAX_RECENCY_ENTRIES) {
      this._entries.length = SessionsRecencyHistory.MAX_RECENCY_ENTRIES;
    }
    this._save();
    this._bumpVersion();
  }
  /** Remove every entry matching the given predicate. */
  remove(predicate) {
    const next = this._entries.filter((e) => !predicate(e));
    if (next.length === this._entries.length) {
      return;
    }
    this._entries = next;
    this._save();
    this._bumpVersion();
  }
  _bumpVersion() {
    this._version.set(this._version.get() + 1, void 0);
  }
  _load() {
    const raw = this._storageService.get(SessionsRecencyHistory.STORAGE_KEY, StorageScope.WORKSPACE);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((e) => e && typeof e.session === "string").map((e) => ({
        sessionResource: URI.parse(e.session),
        chatResource: e.chat ? URI.parse(e.chat) : void 0
      }));
    } catch (error) {
      this._logService.warn("[SessionsRecencyHistory] failed to parse persisted recency history", error);
      return [];
    }
  }
  _save() {
    if (this._entries.length === 0) {
      this._storageService.remove(SessionsRecencyHistory.STORAGE_KEY, StorageScope.WORKSPACE);
      return;
    }
    const serialized = this._entries.map((e) => ({
      session: e.sessionResource.toString(),
      chat: e.chatResource?.toString()
    }));
    this._storageService.store(SessionsRecencyHistory.STORAGE_KEY, JSON.stringify(serialized), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
}
export {
  SessionsRecencyHistory
};
