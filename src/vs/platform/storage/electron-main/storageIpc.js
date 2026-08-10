import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { revive } from "../../../base/common/marshalling.js";
import { ApplicationSharedStorageMain } from "./storageMain.js";
import { reviveIdentifier } from "../../workspace/common/workspace.js";
class StorageDatabaseChannel extends Disposable {
  constructor(logService, storageMainService) {
    super();
    this.logService = logService;
    this.storageMainService = storageMainService;
    this.onDidChangeApplicationStorageEmitter = this._register(new Emitter());
    this.onDidChangeApplicationSharedStorageEmitter = this._register(new Emitter());
    this.mapProfileToOnDidChangeProfileStorageEmitter = /* @__PURE__ */ new Map();
    this.registerStorageChangeListeners(storageMainService.applicationStorage, this.onDidChangeApplicationStorageEmitter);
    this.registerStorageChangeListeners(storageMainService.applicationSharedStorage, this.onDidChangeApplicationSharedStorageEmitter);
  }
  static {
    this.STORAGE_CHANGE_DEBOUNCE_TIME = 100;
  }
  //#region Storage Change Events
  registerStorageChangeListeners(storage, emitter) {
    this._register(Event.debounce(storage.onDidChangeStorage, (prev, cur) => {
      if (!prev) {
        prev = [cur];
      } else {
        prev.push(cur);
      }
      return prev;
    }, StorageDatabaseChannel.STORAGE_CHANGE_DEBOUNCE_TIME)((events) => {
      if (events.length) {
        emitter.fire(this.serializeStorageChangeEvents(events, storage));
      }
    }));
  }
  serializeStorageChangeEvents(events, storage) {
    const changed = /* @__PURE__ */ new Map();
    const deleted = /* @__PURE__ */ new Set();
    events.forEach((event) => {
      const existing = storage.get(event.key);
      if (typeof existing === "string") {
        changed.set(event.key, existing);
      } else {
        deleted.add(event.key);
      }
    });
    return {
      changed: Array.from(changed.entries()),
      deleted: Array.from(deleted.values())
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listen(_, event, arg) {
    switch (event) {
      case "onDidChangeStorage": {
        const profile = arg.profile ? revive(arg.profile) : void 0;
        if (!profile) {
          if (arg.applicationShared) {
            return this.onDidChangeApplicationSharedStorageEmitter.event;
          }
          return this.onDidChangeApplicationStorageEmitter.event;
        }
        let profileStorageChangeEmitter = this.mapProfileToOnDidChangeProfileStorageEmitter.get(profile.id);
        if (!profileStorageChangeEmitter) {
          profileStorageChangeEmitter = this._register(new Emitter());
          this.registerStorageChangeListeners(this.storageMainService.profileStorage(profile), profileStorageChangeEmitter);
          this.mapProfileToOnDidChangeProfileStorageEmitter.set(profile.id, profileStorageChangeEmitter);
        }
        return profileStorageChangeEmitter.event;
      }
    }
    throw new Error(`Event not found: ${event}`);
  }
  //#endregion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async call(_, command, arg) {
    const profile = arg.profile ? revive(arg.profile) : void 0;
    const workspace = reviveIdentifier(arg.workspace);
    const applicationShared = arg.applicationShared;
    const storage = await this.withStorageInitialized(profile, workspace, applicationShared);
    switch (command) {
      case "getItems": {
        const items = new Map(storage.items);
        return Array.from(items.entries());
      }
      case "getValue": {
        const request = arg;
        return storage.get(request.key);
      }
      case "getFallbackApplicationStorageItems": {
        if (storage instanceof ApplicationSharedStorageMain) {
          return Array.from(storage.applicationStorageItems.entries());
        }
        return [];
      }
      case "updateItems": {
        const items = arg;
        if (items.insert) {
          for (const [key, value] of items.insert) {
            storage.set(key, value);
          }
        }
        items.delete?.forEach((key) => storage.delete(key));
        break;
      }
      case "compareAndSwap": {
        const request = arg;
        const currentValue = storage.get(request.key);
        if (currentValue !== request.expectedValue) {
          const result2 = { swapped: false, currentValue };
          return result2;
        }
        storage.set(request.key, request.newValue);
        const result = { swapped: true, currentValue: request.newValue };
        return result;
      }
      case "optimize": {
        return storage.optimize();
      }
      case "isUsed": {
        const path = arg.payload;
        if (typeof path === "string") {
          return this.storageMainService.isUsed(path);
        }
        return false;
      }
      default:
        throw new Error(`Call not found: ${command}`);
    }
  }
  async withStorageInitialized(profile, workspace, applicationShared) {
    let storage;
    if (workspace) {
      storage = this.storageMainService.workspaceStorage(workspace);
    } else if (profile) {
      storage = this.storageMainService.profileStorage(profile);
    } else if (applicationShared) {
      storage = this.storageMainService.applicationSharedStorage;
    } else {
      storage = this.storageMainService.applicationStorage;
    }
    try {
      await storage.init();
    } catch (error) {
      this.logService.error(`StorageIPC#init: Unable to init ${workspace ? "workspace" : profile ? "profile" : applicationShared ? "application-shared" : "application"} storage due to ${error}`);
    }
    return storage;
  }
}
export {
  StorageDatabaseChannel
};
