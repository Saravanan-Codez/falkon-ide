import { RunOnceScheduler } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { StorageScope, StorageTarget } from "../../storage/common/storage.js";
import {
  BrowserHistoryStore
} from "../common/browserHistory.js";
import { BrowserViewStorageScope } from "../common/browserView.js";
const FLUSH_INTERVAL_MS = 2e3;
class BrowserSessionHistory extends Disposable {
  constructor(session) {
    super();
    this._historyStore = this._register(new BrowserHistoryStore());
    this._persistable = false;
    this._entriesFlush = this._register(new RunOnceScheduler(() => this._flushEntries(), FLUSH_INTERVAL_MS));
    this._faviconsFlush = this._register(new RunOnceScheduler(() => this._flushFavicons(), FLUSH_INTERVAL_MS));
    this.storageKeys = session.storageScope === BrowserViewStorageScope.Ephemeral ? {} : {
      history: `browser.history.entries.${session.id}`,
      favicons: `browser.history.favicons.${session.id}`
    };
    this._register(this._historyStore.entries.onDidChange(() => {
      if (this._persistable && !this._entriesFlush.isScheduled()) {
        this._entriesFlush.schedule();
      }
    }));
    this._register(this._historyStore.favicons.onDidChange(() => {
      if (this._persistable && !this._faviconsFlush.isScheduled()) {
        this._faviconsFlush.schedule();
      }
    }));
  }
  connectStorage(storage) {
    if (this._storage || !this.storageKeys.history) {
      return;
    }
    this._storage = storage;
    this._load();
    this._persistable = true;
  }
  add(url, title, favicon, userInitiated) {
    return this._historyStore.add(url, title, favicon, userInitiated);
  }
  delete(entryIds) {
    if (entryIds === void 0) {
      this._historyStore.clear();
    } else {
      for (const id of entryIds) {
        this._historyStore.entries.delete(id);
      }
    }
    this.flushNow();
  }
  setMaxEntries(max) {
    this._historyStore.setMaxEntries(max);
  }
  flushNow() {
    if (this._entriesFlush.isScheduled()) {
      this._entriesFlush.cancel();
      this._flushEntries();
    }
    if (this._faviconsFlush.isScheduled()) {
      this._faviconsFlush.cancel();
      this._flushFavicons();
    }
  }
  _load() {
    const storage = this._storage;
    const { history: historyKey, favicons: faviconsKey } = this.storageKeys;
    if (!storage || !historyKey || !faviconsKey) {
      return;
    }
    const entries = parseSnapshot(storage.get(historyKey, StorageScope.APPLICATION));
    const favicons = parseSnapshot(storage.get(faviconsKey, StorageScope.APPLICATION));
    this._persistable = false;
    try {
      this._historyStore.entries.hydrate(entries);
      this._historyStore.favicons.hydrate(favicons);
    } finally {
      this._persistable = true;
    }
  }
  _flushEntries() {
    const storage = this._storage;
    const key = this.storageKeys.history;
    if (!storage || !key) {
      return;
    }
    const snapshot = this._historyStore.entries.serialize();
    writeSnapshot(storage, key, snapshot, snapshot.items.length === 0);
  }
  _flushFavicons() {
    const storage = this._storage;
    const key = this.storageKeys.favicons;
    if (!storage || !key) {
      return;
    }
    const snapshot = this._historyStore.favicons.serialize();
    writeSnapshot(storage, key, snapshot, Object.keys(snapshot.map).length === 0);
  }
}
function writeSnapshot(storage, key, snapshot, isEmpty) {
  if (isEmpty) {
    storage.remove(key, StorageScope.APPLICATION);
  } else {
    storage.store(key, JSON.stringify(snapshot), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
}
function parseSnapshot(raw) {
  if (!raw) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return void 0;
    }
    return parsed;
  } catch {
    return void 0;
  }
}
export {
  BrowserSessionHistory
};
