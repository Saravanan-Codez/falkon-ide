import parcelWatcher from "@parcel/watcher";
import { promises } from "fs";
import { tmpdir, homedir } from "os";
import { URI } from "../../../../../base/common/uri.js";
import { DeferredPromise, RunOnceScheduler, RunOnceWorker, ThrottledWorker } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { randomPath, isEqual, isEqualOrParent } from "../../../../../base/common/extpath.js";
import { GLOBSTAR, patternsEquals } from "../../../../../base/common/glob.js";
import { BaseWatcher } from "../baseWatcher.js";
import { TernarySearchTree } from "../../../../../base/common/ternarySearchTree.js";
import { normalizeNFC } from "../../../../../base/common/normalization.js";
import { normalize, join } from "../../../../../base/common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../../../../base/common/platform.js";
import { Promises, realcase } from "../../../../../base/node/pfs.js";
import { FileChangeType } from "../../../common/files.js";
import { coalesceEvents, parseWatcherPatterns, isFiltered } from "../../../common/watcher.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
class ParcelWatcherInstance extends Disposable {
  constructor(ready, request, restarts, token, worker, stopFn) {
    super();
    this.ready = ready;
    this.request = request;
    this.restarts = restarts;
    this.token = token;
    this.worker = worker;
    this.stopFn = stopFn;
    this._onDidStop = this._register(new Emitter());
    this.onDidStop = this._onDidStop.event;
    this._onDidFail = this._register(new Emitter());
    this.onDidFail = this._onDidFail.event;
    this.didFail = false;
    this.didStop = false;
    this.subscriptions = /* @__PURE__ */ new Map();
    const ignoreCase = !isLinux;
    this.includes = this.request.includes ? parseWatcherPatterns(this.request.path, this.request.includes, ignoreCase) : void 0;
    this.excludes = this.request.excludes ? parseWatcherPatterns(this.request.path, this.request.excludes, ignoreCase) : void 0;
    this._register(toDisposable(() => this.subscriptions.clear()));
  }
  get failed() {
    return this.didFail;
  }
  get stopped() {
    return this.didStop;
  }
  subscribe(path, callback) {
    path = URI.file(path).fsPath;
    let subscriptions = this.subscriptions.get(path);
    if (!subscriptions) {
      subscriptions = /* @__PURE__ */ new Set();
      this.subscriptions.set(path, subscriptions);
    }
    subscriptions.add(callback);
    return toDisposable(() => {
      const subscriptions2 = this.subscriptions.get(path);
      if (subscriptions2) {
        subscriptions2.delete(callback);
        if (subscriptions2.size === 0) {
          this.subscriptions.delete(path);
        }
      }
    });
  }
  get subscriptionsCount() {
    return this.subscriptions.size;
  }
  notifyFileChange(path, change) {
    const subscriptions = this.subscriptions.get(path);
    if (subscriptions) {
      for (const subscription of subscriptions) {
        subscription(change);
      }
    }
  }
  notifyWatchFailed() {
    this.didFail = true;
    this._onDidFail.fire();
  }
  include(path) {
    if (!this.includes || this.includes.length === 0) {
      return true;
    }
    return this.includes.some((include) => include(path));
  }
  exclude(path) {
    return Boolean(this.excludes?.some((exclude) => exclude(path)));
  }
  async stop(joinRestart) {
    this.didStop = true;
    try {
      await this.stopFn();
    } finally {
      this._onDidStop.fire({ joinRestart });
      this.dispose();
    }
  }
}
class ParcelWatcher extends BaseWatcher {
  constructor() {
    super();
    this._onDidError = this._register(new Emitter());
    this.onDidError = this._onDidError.event;
    this._watchers = /* @__PURE__ */ new Map();
    // Reduce likelyhood of spam from file events via throttling.
    // (https://github.com/microsoft/vscode/issues/124723)
    this.throttledFileChangesEmitter = this._register(new ThrottledWorker(
      {
        maxWorkChunkSize: 500,
        // only process up to 500 changes at once before...
        throttleDelay: 200,
        // ...resting for 200ms until we process events again...
        maxBufferedWork: 3e4
        // ...but never buffering more than 30000 events in memory
      },
      (events) => this._onDidChangeFile.fire(events)
    ));
    this.enospcErrorLogged = false;
    this.registerListeners();
  }
  static {
    this.MAP_PARCEL_WATCHER_ACTION_TO_FILE_CHANGE = /* @__PURE__ */ new Map(
      [
        ["create", FileChangeType.ADDED],
        ["update", FileChangeType.UPDATED],
        ["delete", FileChangeType.DELETED]
      ]
    );
  }
  static {
    this.PREDEFINED_EXCLUDES = {
      "win32": [],
      "darwin": [
        join(homedir(), "Library", "Containers")
        // Triggers access dialog from macOS 14 (https://github.com/microsoft/vscode/issues/208105)
      ],
      "linux": []
    };
  }
  static {
    this.PARCEL_WATCHER_BACKEND = isWindows ? "windows" : isLinux ? "inotify" : "fs-events";
  }
  get watchers() {
    return this._watchers.values();
  }
  static {
    // A delay for collecting file changes from Parcel
    // before collecting them for coalescing and emitting.
    // Parcel internally uses 50ms as delay, so we use 75ms,
    // to schedule sufficiently after Parcel.
    //
    // Note: since Parcel 2.0.7, the very first event is
    // emitted without delay if no events occurred over a
    // duration of 500ms. But we always want to aggregate
    // events to apply our coleasing logic.
    //
    this.FILE_CHANGES_HANDLER_DELAY = 75;
  }
  registerListeners() {
    const onUncaughtException = (error) => this.onUnexpectedError(error);
    const onUnhandledRejection = (error) => this.onUnexpectedError(error);
    process.on("uncaughtException", onUncaughtException);
    process.on("unhandledRejection", onUnhandledRejection);
    this._register(toDisposable(() => {
      process.off("uncaughtException", onUncaughtException);
      process.off("unhandledRejection", onUnhandledRejection);
    }));
  }
  async doWatch(requests) {
    requests = await this.removeDuplicateRequests(requests);
    const requestsToStart = [];
    const watchersToStop = new Set(Array.from(this.watchers));
    for (const request of requests) {
      const watcher = this._watchers.get(this.requestToWatcherKey(request));
      if (watcher && patternsEquals(watcher.request.excludes, request.excludes) && patternsEquals(watcher.request.includes, request.includes) && watcher.request.pollingInterval === request.pollingInterval) {
        watchersToStop.delete(watcher);
      } else {
        requestsToStart.push(request);
      }
    }
    if (requestsToStart.length) {
      this.trace(`Request to start watching: ${requestsToStart.map((request) => this.requestToString(request)).join(",")}`);
    }
    if (watchersToStop.size) {
      this.trace(`Request to stop watching: ${Array.from(watchersToStop).map((watcher) => this.requestToString(watcher.request)).join(",")}`);
    }
    for (const watcher of watchersToStop) {
      await this.stopWatching(watcher);
    }
    for (const request of requestsToStart) {
      if (request.pollingInterval) {
        await this.startPolling(request, request.pollingInterval);
      } else {
        await this.startWatching(request);
      }
    }
  }
  requestToWatcherKey(request) {
    return typeof request.correlationId === "number" ? request.correlationId : this.pathToWatcherKey(request.path);
  }
  pathToWatcherKey(path) {
    return isLinux ? path : path.toLowerCase();
  }
  async startPolling(request, pollingInterval, restarts = 0) {
    const cts = new CancellationTokenSource();
    const instance = new DeferredPromise();
    const snapshotFile = randomPath(tmpdir(), "vscode-watcher-snapshot");
    const watcher = new ParcelWatcherInstance(
      instance.p,
      request,
      restarts,
      cts.token,
      new RunOnceWorker((events) => this.handleParcelEvents(events, watcher), ParcelWatcher.FILE_CHANGES_HANDLER_DELAY),
      async () => {
        cts.dispose(true);
        watcher.worker.flush();
        watcher.worker.dispose();
        pollingWatcher.dispose();
        await promises.unlink(snapshotFile);
      }
    );
    this._watchers.set(this.requestToWatcherKey(request), watcher);
    const { realPath, realPathDiffers, realPathLength } = await this.normalizePath(request);
    this.trace(`Started watching: '${realPath}' with polling interval '${pollingInterval}'`);
    let counter = 0;
    const pollingWatcher = new RunOnceScheduler(async () => {
      counter++;
      if (cts.token.isCancellationRequested) {
        return;
      }
      const parcelWatcherLib = parcelWatcher;
      try {
        if (counter > 1) {
          const parcelEvents = await parcelWatcherLib.getEventsSince(realPath, snapshotFile, { ignore: this.addPredefinedExcludes(request.excludes), backend: ParcelWatcher.PARCEL_WATCHER_BACKEND });
          if (cts.token.isCancellationRequested) {
            return;
          }
          this.onParcelEvents(parcelEvents, watcher, realPathDiffers, realPathLength);
        }
        await parcelWatcherLib.writeSnapshot(realPath, snapshotFile, { ignore: this.addPredefinedExcludes(request.excludes), backend: ParcelWatcher.PARCEL_WATCHER_BACKEND });
      } catch (error) {
        this.onUnexpectedError(error, request);
      }
      if (counter === 1) {
        instance.complete();
      }
      if (cts.token.isCancellationRequested) {
        return;
      }
      pollingWatcher.schedule();
    }, pollingInterval);
    pollingWatcher.schedule(0);
  }
  async startWatching(request, restarts = 0) {
    const cts = new CancellationTokenSource();
    const instance = new DeferredPromise();
    const watcher = new ParcelWatcherInstance(
      instance.p,
      request,
      restarts,
      cts.token,
      new RunOnceWorker((events) => this.handleParcelEvents(events, watcher), ParcelWatcher.FILE_CHANGES_HANDLER_DELAY),
      async () => {
        cts.dispose(true);
        watcher.worker.flush();
        watcher.worker.dispose();
        const watcherInstance = await instance.p;
        await watcherInstance?.unsubscribe();
      }
    );
    this._watchers.set(this.requestToWatcherKey(request), watcher);
    const { realPath, realPathDiffers, realPathLength } = await this.normalizePath(request);
    try {
      const parcelWatcherLib = parcelWatcher;
      const parcelWatcherInstance = await parcelWatcherLib.subscribe(realPath, (error, parcelEvents) => {
        if (watcher.token.isCancellationRequested) {
          return;
        }
        if (error) {
          this.onUnexpectedError(error, request);
        }
        this.onParcelEvents(parcelEvents, watcher, realPathDiffers, realPathLength);
      }, {
        backend: ParcelWatcher.PARCEL_WATCHER_BACKEND,
        ignore: this.addPredefinedExcludes(watcher.request.excludes)
      });
      this.trace(`Started watching: '${realPath}' with backend '${ParcelWatcher.PARCEL_WATCHER_BACKEND}'`);
      instance.complete(parcelWatcherInstance);
    } catch (error) {
      this.onUnexpectedError(error, request);
      instance.complete(void 0);
      watcher.notifyWatchFailed();
      this._onDidWatchFail.fire(request);
    }
  }
  addPredefinedExcludes(initialExcludes) {
    const excludes = [...initialExcludes];
    const predefinedExcludes = ParcelWatcher.PREDEFINED_EXCLUDES[process.platform];
    if (Array.isArray(predefinedExcludes)) {
      for (const exclude of predefinedExcludes) {
        if (!excludes.includes(exclude)) {
          excludes.push(exclude);
        }
      }
    }
    return excludes;
  }
  onParcelEvents(parcelEvents, watcher, realPathDiffers, realPathLength) {
    if (parcelEvents.length === 0) {
      return;
    }
    this.normalizeEvents(parcelEvents, watcher.request, realPathDiffers, realPathLength);
    const includedEvents = this.handleIncludes(watcher, parcelEvents);
    for (const includedEvent of includedEvents) {
      watcher.worker.work(includedEvent);
    }
  }
  handleIncludes(watcher, parcelEvents) {
    const events = [];
    for (const { path, type: parcelEventType } of parcelEvents) {
      const type = ParcelWatcher.MAP_PARCEL_WATCHER_ACTION_TO_FILE_CHANGE.get(parcelEventType);
      if (this.verboseLogging) {
        this.traceWithCorrelation(`${type === FileChangeType.ADDED ? "[ADDED]" : type === FileChangeType.DELETED ? "[DELETED]" : "[CHANGED]"} ${path}`, watcher.request);
      }
      if (!watcher.include(path)) {
        if (this.verboseLogging) {
          this.traceWithCorrelation(` >> ignored (not included) ${path}`, watcher.request);
        }
      } else {
        events.push({ type, resource: URI.file(path), cId: watcher.request.correlationId });
      }
    }
    return events;
  }
  handleParcelEvents(parcelEvents, watcher) {
    const coalescedEvents = coalesceEvents(parcelEvents);
    const { events: filteredEvents, rootDeleted } = this.filterEvents(coalescedEvents, watcher);
    this.emitEvents(filteredEvents, watcher);
    if (rootDeleted) {
      this.onWatchedPathDeleted(watcher);
    }
  }
  emitEvents(events, watcher) {
    if (events.length === 0) {
      return;
    }
    const worked = this.throttledFileChangesEmitter.work(events);
    if (!worked) {
      this.warn(`started ignoring events due to too many file change events at once (incoming: ${events.length}, most recent change: ${events[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`);
    } else {
      if (this.throttledFileChangesEmitter.pending > 0) {
        this.trace(`started throttling events due to large amount of file change events at once (pending: ${this.throttledFileChangesEmitter.pending}, most recent change: ${events[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`, watcher);
      }
    }
  }
  async normalizePath(request) {
    let realPath = request.path;
    let realPathDiffers = false;
    let realPathLength = request.path.length;
    try {
      realPath = await Promises.realpath(request.path);
      if (request.path === realPath) {
        realPath = await realcase(request.path) ?? request.path;
      }
      if (request.path !== realPath) {
        realPathLength = realPath.length;
        realPathDiffers = true;
        this.trace(`correcting a path to watch that seems to be a symbolic link or wrong casing (original: ${request.path}, real: ${realPath})`);
      }
    } catch (error) {
    }
    return { realPath, realPathDiffers, realPathLength };
  }
  normalizeEvents(events, request, realPathDiffers, realPathLength) {
    for (const event of events) {
      if (isMacintosh) {
        event.path = normalizeNFC(event.path);
      }
      if (isWindows) {
        if (request.path.length <= 3) {
          event.path = normalize(event.path);
        }
      }
      if (realPathDiffers) {
        event.path = request.path + event.path.substr(realPathLength);
      }
    }
  }
  filterEvents(events, watcher) {
    const filteredEvents = [];
    let rootDeleted = false;
    const filter = this.isCorrelated(watcher.request) ? watcher.request.filter : void 0;
    for (const event of events) {
      if (watcher.subscriptionsCount > 0) {
        watcher.notifyFileChange(event.resource.fsPath, event);
      }
      rootDeleted = event.type === FileChangeType.DELETED && isEqual(event.resource.fsPath, watcher.request.path, !isLinux);
      if (isFiltered(event, filter)) {
        if (this.verboseLogging) {
          this.traceWithCorrelation(` >> ignored (filtered) ${event.resource.fsPath}`, watcher.request);
        }
        continue;
      }
      this.traceEvent(event, watcher.request);
      filteredEvents.push(event);
    }
    return { events: filteredEvents, rootDeleted };
  }
  onWatchedPathDeleted(watcher) {
    this.warn("Watcher shutdown because watched path got deleted", watcher);
    watcher.notifyWatchFailed();
    this._onDidWatchFail.fire(watcher.request);
  }
  onUnexpectedError(error, request) {
    const msg = toErrorMessage(error);
    if (msg.indexOf("No space left on device") !== -1) {
      if (!this.enospcErrorLogged) {
        this.error("Inotify limit reached (ENOSPC)", request);
        this.enospcErrorLogged = true;
      }
    } else if (msg.indexOf("File system must be re-scanned") !== -1) {
      this.error(msg, request);
    } else {
      this.error(`Unexpected error: ${msg} (EUNKNOWN)`, request);
      this._onDidError.fire({ request, error: msg });
    }
  }
  async stop() {
    await super.stop();
    for (const watcher of this.watchers) {
      await this.stopWatching(watcher);
    }
  }
  restartWatching(watcher, delay = 800) {
    const scheduler = new RunOnceScheduler(async () => {
      if (watcher.token.isCancellationRequested) {
        return;
      }
      const restartPromise = new DeferredPromise();
      try {
        await this.stopWatching(watcher, restartPromise.p);
        if (watcher.request.pollingInterval) {
          await this.startPolling(watcher.request, watcher.request.pollingInterval, watcher.restarts + 1);
        } else {
          await this.startWatching(watcher.request, watcher.restarts + 1);
        }
      } finally {
        restartPromise.complete();
      }
    }, delay);
    scheduler.schedule();
    watcher.token.onCancellationRequested(() => scheduler.dispose());
  }
  async stopWatching(watcher, joinRestart) {
    this.trace(`stopping file watcher`, watcher);
    this._watchers.delete(this.requestToWatcherKey(watcher.request));
    try {
      await watcher.stop(joinRestart);
    } catch (error) {
      this.error(`Unexpected error stopping watcher: ${toErrorMessage(error)}`, watcher.request);
    }
  }
  async removeDuplicateRequests(requests, validatePaths = true) {
    requests.sort((requestA, requestB) => requestA.path.length - requestB.path.length);
    const mapCorrelationtoRequests = /* @__PURE__ */ new Map();
    for (const request of requests) {
      if (request.excludes.includes(GLOBSTAR)) {
        continue;
      }
      let requestsForCorrelation = mapCorrelationtoRequests.get(request.correlationId);
      if (!requestsForCorrelation) {
        requestsForCorrelation = /* @__PURE__ */ new Map();
        mapCorrelationtoRequests.set(request.correlationId, requestsForCorrelation);
      }
      const path = this.pathToWatcherKey(request.path);
      if (requestsForCorrelation.has(path)) {
        this.trace(`ignoring a request for watching who's path is already watched: ${this.requestToString(request)}`);
      }
      requestsForCorrelation.set(path, request);
    }
    const normalizedRequests = [];
    for (const requestsForCorrelation of mapCorrelationtoRequests.values()) {
      const requestTrie = TernarySearchTree.forPaths(!isLinux);
      for (const request of requestsForCorrelation.values()) {
        if (requestTrie.findSubstr(request.path)) {
          if (requestTrie.has(request.path)) {
            this.trace(`ignoring a request for watching who's path is already watched: ${this.requestToString(request)}`);
          } else {
            try {
              if (!(await promises.lstat(request.path)).isSymbolicLink()) {
                this.trace(`ignoring a request for watching who's parent is already watched: ${this.requestToString(request)}`);
                continue;
              }
            } catch (error) {
              this.trace(`ignoring a request for watching who's lstat failed to resolve: ${this.requestToString(request)} (error: ${error})`);
              this._onDidWatchFail.fire(request);
              continue;
            }
          }
        }
        if (validatePaths && !await this.isPathValid(request.path)) {
          this._onDidWatchFail.fire(request);
          continue;
        }
        requestTrie.set(request.path, request);
      }
      normalizedRequests.push(...Array.from(requestTrie).map(([, request]) => request));
    }
    return normalizedRequests;
  }
  async isPathValid(path) {
    try {
      const stat = await promises.stat(path);
      if (!stat.isDirectory()) {
        this.trace(`ignoring a path for watching that is a file and not a folder: ${path}`);
        return false;
      }
    } catch (error) {
      this.trace(`ignoring a path for watching who's stat info failed to resolve: ${path} (error: ${error})`);
      return false;
    }
    return true;
  }
  subscribe(path, callback) {
    for (const watcher of this.watchers) {
      if (watcher.failed) {
        continue;
      }
      if (!isEqualOrParent(path, watcher.request.path, !isLinux)) {
        continue;
      }
      if (watcher.exclude(path) || !watcher.include(path)) {
        continue;
      }
      const disposables = new DisposableStore();
      disposables.add(Event.once(watcher.onDidStop)(async (e) => {
        await e.joinRestart;
        if (disposables.isDisposed) {
          return;
        }
        callback(
          true
          /* error */
        );
      }));
      disposables.add(Event.once(watcher.onDidFail)(() => callback(
        true
        /* error */
      )));
      disposables.add(watcher.subscribe(path, (change) => callback(null, change)));
      return disposables;
    }
    return void 0;
  }
  trace(message, watcher) {
    if (this.verboseLogging) {
      this._onDidLogMessage.fire({ type: "trace", message: this.toMessage(message, watcher?.request) });
    }
  }
  warn(message, watcher) {
    this._onDidLogMessage.fire({ type: "warn", message: this.toMessage(message, watcher?.request) });
  }
  error(message, request) {
    this._onDidLogMessage.fire({ type: "error", message: this.toMessage(message, request) });
  }
  toMessage(message, request) {
    return request ? `[File Watcher ('parcel')] ${message} (path: ${request.path})` : `[File Watcher ('parcel')] ${message}`;
  }
  get recursiveWatcher() {
    return this;
  }
}
export {
  ParcelWatcher,
  ParcelWatcherInstance
};
