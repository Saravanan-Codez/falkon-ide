import * as fs from "fs";
import { top } from "../../../base/common/arrays.js";
import { DeferredPromise } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { join } from "../../../base/common/path.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { URI } from "../../../base/common/uri.js";
import { Promises } from "../../../base/node/pfs.js";
import { InMemoryStorageDatabase, Storage, StorageHint, StorageState, MigratingStorage } from "../../../base/parts/storage/common/storage.js";
import { SQLiteStorageDatabase } from "../../../base/parts/storage/node/storage.js";
import { LogLevel } from "../../log/common/log.js";
import { IS_NEW_KEY } from "../common/storage.js";
import { currentSessionDateStorageKey, firstSessionDateStorageKey, lastSessionDateStorageKey } from "../../telemetry/common/telemetry.js";
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from "../../workspace/common/workspace.js";
import { Schemas } from "../../../base/common/network.js";
class BaseStorageMain extends Disposable {
  constructor(logService, fileService) {
    super();
    this.logService = logService;
    this.fileService = fileService;
    this._onDidChangeStorage = this._register(new Emitter());
    this.onDidChangeStorage = this._onDidChangeStorage.event;
    this._onDidCloseStorage = this._register(new Emitter());
    this.onDidCloseStorage = this._onDidCloseStorage.event;
    this._storage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY }));
    this.initializePromise = void 0;
    this.whenInitPromise = new DeferredPromise();
    this.whenInit = this.whenInitPromise.p;
    this.state = StorageState.None;
  }
  static {
    this.LOG_SLOW_CLOSE_THRESHOLD = 2e3;
  }
  // storage is in-memory until initialized
  get storage() {
    return this._storage;
  }
  isInMemory() {
    return this._storage.isInMemory();
  }
  init() {
    if (!this.initializePromise) {
      this.initializePromise = (async () => {
        if (this.state !== StorageState.None) {
          return;
        }
        try {
          const storage = this._register(await this.doCreate());
          this._storage.dispose();
          this._storage = storage;
          this._register(storage.onDidChangeStorage((e) => this._onDidChangeStorage.fire(e)));
          await this.doInit(storage);
          const isNewStorage = storage.getBoolean(IS_NEW_KEY);
          if (isNewStorage === void 0) {
            storage.set(IS_NEW_KEY, true);
          } else if (isNewStorage) {
            storage.set(IS_NEW_KEY, false);
          }
        } catch (error) {
          this.logService.error(`[storage main] initialize(): Unable to init storage due to ${error}`);
        } finally {
          this.state = StorageState.Initialized;
          this.whenInitPromise.complete();
        }
      })();
    }
    return this.initializePromise;
  }
  createLoggingOptions() {
    return {
      logTrace: this.logService.getLevel() === LogLevel.Trace ? (msg) => this.logService.trace(msg) : void 0,
      logError: (error) => this.logService.error(error)
    };
  }
  doInit(storage) {
    return storage.init();
  }
  get items() {
    return this._storage.items;
  }
  get(key, fallbackValue) {
    return this._storage.get(key, fallbackValue);
  }
  set(key, value) {
    return this._storage.set(key, value);
  }
  delete(key) {
    return this._storage.delete(key);
  }
  optimize() {
    return this._storage.optimize();
  }
  async close() {
    const watch = new StopWatch(false);
    await this.doClose();
    watch.stop();
    if (watch.elapsed() > BaseStorageMain.LOG_SLOW_CLOSE_THRESHOLD) {
      await this.logSlowClose(watch);
    }
    this._onDidCloseStorage.fire();
  }
  async logSlowClose(watch) {
    if (!this.path) {
      return;
    }
    try {
      const largestEntries = top(Array.from(this._storage.items.entries()).map(([key, value]) => ({ key, length: value.length })), (entryA, entryB) => entryB.length - entryA.length, 5).map((entry) => `${entry.key}:${entry.length}`).join(", ");
      const dbSize = (await this.fileService.stat(URI.file(this.path))).size;
      this.logService.warn(`[storage main] detected slow close() operation: Time: ${watch.elapsed()}ms, DB size: ${dbSize}b, Large Keys: ${largestEntries}`);
    } catch (error) {
      this.logService.error("[storage main] figuring out stats for slow DB on close() resulted in an error", error);
    }
  }
  async doClose() {
    if (this.initializePromise) {
      await this.initializePromise;
    }
    this.state = StorageState.Closed;
    await this._storage.close();
  }
}
class BaseProfileAwareStorageMain extends BaseStorageMain {
  constructor(profile, options, logService, fileService) {
    super(logService, fileService);
    this.profile = profile;
    this.options = options;
  }
  static {
    this.STORAGE_NAME = "state.vscdb";
  }
  get path() {
    if (!this.options.useInMemoryStorage) {
      return join(this.profile.globalStorageHome.with({ scheme: Schemas.file }).fsPath, BaseProfileAwareStorageMain.STORAGE_NAME);
    }
    return void 0;
  }
  async doCreate() {
    return new Storage(new SQLiteStorageDatabase(this.path ?? SQLiteStorageDatabase.IN_MEMORY_PATH, {
      logging: this.createLoggingOptions()
    }), !this.path ? { hint: StorageHint.STORAGE_IN_MEMORY } : void 0);
  }
}
class ProfileStorageMain extends BaseProfileAwareStorageMain {
}
class ApplicationStorageMain extends BaseProfileAwareStorageMain {
  constructor(options, userDataProfileService, logService, fileService) {
    super(userDataProfileService.defaultProfile, options, logService, fileService);
  }
  async doInit(storage) {
    await super.doInit(storage);
    this.updateTelemetryState(storage);
  }
  updateTelemetryState(storage) {
    const firstSessionDate = storage.get(firstSessionDateStorageKey, void 0);
    if (firstSessionDate === void 0) {
      storage.set(firstSessionDateStorageKey, (/* @__PURE__ */ new Date()).toUTCString());
    }
    const lastSessionDate = storage.get(currentSessionDateStorageKey, void 0);
    const currentSessionDate = (/* @__PURE__ */ new Date()).toUTCString();
    storage.set(lastSessionDateStorageKey, typeof lastSessionDate === "undefined" ? null : lastSessionDate);
    storage.set(currentSessionDateStorageKey, currentSessionDate);
  }
}
class ApplicationSharedStorageMain extends BaseStorageMain {
  constructor(options, storageFolderPath, applicationStorage, logService, fileService) {
    super(logService, fileService);
    this.options = options;
    this.storageFolderPath = storageFolderPath;
    this.applicationStorage = applicationStorage;
  }
  static {
    this.STORAGE_NAME = "state.vscdb";
  }
  get path() {
    if (!this.options.useInMemoryStorage) {
      return join(this.storageFolderPath, ApplicationSharedStorageMain.STORAGE_NAME);
    }
    return void 0;
  }
  async doCreate() {
    const { storageFilePath, wasCreated } = await this.prepareStorageFolder();
    this.logService.info(`[shared storage] Creating shared storage database at '${storageFilePath}' (wasCreated: ${wasCreated})`);
    const database = new SQLiteStorageDatabase(storageFilePath, {
      logging: this.createLoggingOptions()
    });
    this.logService.info(`[shared storage] Initializing fallback application storage (path: ${this.applicationStorage.path ?? "in-memory"})`);
    await this.applicationStorage.init();
    this.logService.info(`[shared storage] Fallback application storage initialized with ${this.applicationStorage.items.size} items`);
    const migratingStorage = this._register(new MigratingStorage(database, { hint: wasCreated ? StorageHint.STORAGE_DOES_NOT_EXIST : void 0 }));
    migratingStorage.setFallbackStorage(this.applicationStorage.storage, false);
    return migratingStorage;
  }
  get applicationStorageItems() {
    return this.applicationStorage.items;
  }
  async prepareStorageFolder() {
    if (this.options.useInMemoryStorage) {
      return { storageFilePath: SQLiteStorageDatabase.IN_MEMORY_PATH, wasCreated: true };
    }
    const storageDatabasePath = join(this.storageFolderPath, ApplicationSharedStorageMain.STORAGE_NAME);
    const storageExists = await Promises.exists(this.storageFolderPath);
    if (storageExists) {
      return { storageFilePath: storageDatabasePath, wasCreated: false };
    }
    await fs.promises.mkdir(this.storageFolderPath, { recursive: true });
    return { storageFilePath: storageDatabasePath, wasCreated: true };
  }
}
class WorkspaceStorageMain extends BaseStorageMain {
  constructor(workspace, options, logService, environmentService, fileService) {
    super(logService, fileService);
    this.workspace = workspace;
    this.options = options;
    this.environmentService = environmentService;
  }
  static {
    this.WORKSPACE_STORAGE_NAME = "state.vscdb";
  }
  static {
    this.WORKSPACE_META_NAME = "workspace.json";
  }
  get path() {
    if (!this.options.useInMemoryStorage) {
      return join(this.environmentService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath, this.workspace.id, WorkspaceStorageMain.WORKSPACE_STORAGE_NAME);
    }
    return void 0;
  }
  async doCreate() {
    const { storageFilePath, wasCreated } = await this.prepareWorkspaceStorageFolder();
    return new Storage(new SQLiteStorageDatabase(storageFilePath, {
      logging: this.createLoggingOptions()
    }), { hint: this.options.useInMemoryStorage ? StorageHint.STORAGE_IN_MEMORY : wasCreated ? StorageHint.STORAGE_DOES_NOT_EXIST : void 0 });
  }
  async prepareWorkspaceStorageFolder() {
    if (this.options.useInMemoryStorage) {
      return { storageFilePath: SQLiteStorageDatabase.IN_MEMORY_PATH, wasCreated: true };
    }
    const workspaceStorageFolderPath = join(this.environmentService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath, this.workspace.id);
    const workspaceStorageDatabasePath = join(workspaceStorageFolderPath, WorkspaceStorageMain.WORKSPACE_STORAGE_NAME);
    const storageExists = await Promises.exists(workspaceStorageFolderPath);
    if (storageExists) {
      return { storageFilePath: workspaceStorageDatabasePath, wasCreated: false };
    }
    await fs.promises.mkdir(workspaceStorageFolderPath, { recursive: true });
    this.ensureWorkspaceStorageFolderMeta(workspaceStorageFolderPath);
    return { storageFilePath: workspaceStorageDatabasePath, wasCreated: true };
  }
  async ensureWorkspaceStorageFolderMeta(workspaceStorageFolderPath) {
    let meta = void 0;
    if (isSingleFolderWorkspaceIdentifier(this.workspace)) {
      meta = { folder: this.workspace.uri.toString() };
    } else if (isWorkspaceIdentifier(this.workspace)) {
      meta = { workspace: this.workspace.configPath.toString() };
    }
    if (meta) {
      try {
        const workspaceStorageMetaPath = join(workspaceStorageFolderPath, WorkspaceStorageMain.WORKSPACE_META_NAME);
        const storageExists = await Promises.exists(workspaceStorageMetaPath);
        if (!storageExists) {
          await Promises.writeFile(workspaceStorageMetaPath, JSON.stringify(meta, void 0, 2));
        }
      } catch (error) {
        this.logService.error(`[storage main] ensureWorkspaceStorageFolderMeta(): Unable to create workspace storage metadata due to ${error}`);
      }
    }
  }
}
class InMemoryStorageMain extends BaseStorageMain {
  get path() {
    return void 0;
  }
  async doCreate() {
    return new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY });
  }
}
export {
  ApplicationSharedStorageMain,
  ApplicationStorageMain,
  InMemoryStorageMain,
  ProfileStorageMain,
  WorkspaceStorageMain
};
