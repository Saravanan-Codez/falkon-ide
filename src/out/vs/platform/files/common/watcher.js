import { GLOBSTAR, parse } from "../../../base/common/glob.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { isAbsolute } from "../../../base/common/path.js";
import { isLinux } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { FileChangeFilter, FileChangeType, isParent } from "./files.js";
function isWatchRequestWithCorrelation(request) {
  return typeof request.correlationId === "number";
}
function isRecursiveWatchRequest(request) {
  return request.recursive === true;
}
class AbstractWatcherClient extends Disposable {
  constructor(onFileChanges, onLogMessage, verboseLogging, options) {
    super();
    this.onFileChanges = onFileChanges;
    this.onLogMessage = onLogMessage;
    this.verboseLogging = verboseLogging;
    this.options = options;
    this.watcherDisposables = this._register(new MutableDisposable());
    this.requests = void 0;
    this.restartCounter = 0;
  }
  static {
    this.MAX_RESTARTS = 5;
  }
  init() {
    const disposables = new DisposableStore();
    this.watcherDisposables.value = disposables;
    this.watcher = this.createWatcher(disposables);
    this.watcher.setVerboseLogging(this.verboseLogging);
    disposables.add(this.watcher.onDidChangeFile((changes) => this.onFileChanges(changes)));
    disposables.add(this.watcher.onDidLogMessage((msg) => this.onLogMessage(msg)));
    disposables.add(this.watcher.onDidError((e) => this.onError(e.error, e.request)));
  }
  onError(error, failedRequest) {
    if (this.canRestart(error, failedRequest)) {
      if (this.restartCounter < AbstractWatcherClient.MAX_RESTARTS && this.requests) {
        this.error(`restarting watcher after unexpected error: ${error}`);
        this.restart(this.requests);
      } else {
        this.error(`gave up attempting to restart watcher after unexpected error: ${error}`);
      }
    } else {
      this.error(error);
    }
  }
  canRestart(error, failedRequest) {
    if (!this.options.restartOnError) {
      return false;
    }
    if (failedRequest) {
      return false;
    }
    if (error.indexOf("No space left on device") !== -1 || error.indexOf("EMFILE") !== -1) {
      return false;
    }
    return true;
  }
  restart(requests) {
    this.restartCounter++;
    this.init();
    this.watch(requests);
  }
  async watch(requests) {
    this.requests = requests;
    await this.watcher?.watch(requests);
  }
  async setVerboseLogging(verboseLogging) {
    this.verboseLogging = verboseLogging;
    await this.watcher?.setVerboseLogging(verboseLogging);
  }
  error(message) {
    this.onLogMessage({ type: "error", message: `[File Watcher (${this.options.type})] ${message}` });
  }
  trace(message) {
    this.onLogMessage({ type: "trace", message: `[File Watcher (${this.options.type})] ${message}` });
  }
  dispose() {
    this.watcher = void 0;
    return super.dispose();
  }
}
class AbstractNonRecursiveWatcherClient extends AbstractWatcherClient {
  constructor(onFileChanges, onLogMessage, verboseLogging) {
    super(onFileChanges, onLogMessage, verboseLogging, { type: "node.js", restartOnError: false });
  }
}
class AbstractUniversalWatcherClient extends AbstractWatcherClient {
  constructor(onFileChanges, onLogMessage, verboseLogging) {
    super(onFileChanges, onLogMessage, verboseLogging, { type: "universal", restartOnError: true });
  }
}
function reviveFileChanges(changes) {
  return changes.map((change) => ({
    type: change.type,
    resource: URI.revive(change.resource),
    cId: change.cId
  }));
}
function coalesceEvents(changes) {
  const coalescer = new EventCoalescer();
  for (const event of changes) {
    coalescer.processEvent(event);
  }
  return coalescer.coalesce();
}
function normalizeWatcherPattern(path, pattern) {
  if (typeof pattern === "string" && !pattern.startsWith(GLOBSTAR) && !isAbsolute(pattern)) {
    return { base: path, pattern };
  }
  return pattern;
}
function parseWatcherPatterns(path, patterns, ignoreCase) {
  const parsedPatterns = [];
  for (const pattern of patterns) {
    parsedPatterns.push(parse(normalizeWatcherPattern(path, pattern), { ignoreCase }));
  }
  return parsedPatterns;
}
class EventCoalescer {
  constructor() {
    this.coalesced = /* @__PURE__ */ new Set();
    this.mapPathToChange = /* @__PURE__ */ new Map();
  }
  toKey(event) {
    if (isLinux) {
      return event.resource.fsPath;
    }
    return event.resource.fsPath.toLowerCase();
  }
  processEvent(event) {
    const existingEvent = this.mapPathToChange.get(this.toKey(event));
    let keepEvent = false;
    if (existingEvent) {
      const currentChangeType = existingEvent.type;
      const newChangeType = event.type;
      if (existingEvent.resource.fsPath !== event.resource.fsPath && (event.type === FileChangeType.DELETED || event.type === FileChangeType.ADDED)) {
        keepEvent = true;
      } else if (currentChangeType === FileChangeType.ADDED && newChangeType === FileChangeType.DELETED) {
        this.mapPathToChange.delete(this.toKey(event));
        this.coalesced.delete(existingEvent);
      } else if (currentChangeType === FileChangeType.DELETED && newChangeType === FileChangeType.ADDED) {
        existingEvent.type = FileChangeType.UPDATED;
      } else if (currentChangeType === FileChangeType.ADDED && newChangeType === FileChangeType.UPDATED) {
      } else {
        existingEvent.type = newChangeType;
      }
    } else {
      keepEvent = true;
    }
    if (keepEvent) {
      this.coalesced.add(event);
      this.mapPathToChange.set(this.toKey(event), event);
    }
  }
  coalesce() {
    const addOrChangeEvents = [];
    const deletedPaths = [];
    return Array.from(this.coalesced).filter((e) => {
      if (e.type !== FileChangeType.DELETED) {
        addOrChangeEvents.push(e);
        return false;
      }
      return true;
    }).sort((e1, e2) => {
      return e1.resource.fsPath.length - e2.resource.fsPath.length;
    }).filter((e) => {
      if (deletedPaths.some((deletedPath) => isParent(
        e.resource.fsPath,
        deletedPath,
        !isLinux
        /* ignorecase */
      ))) {
        return false;
      }
      deletedPaths.push(e.resource.fsPath);
      return true;
    }).concat(addOrChangeEvents);
  }
}
function isFiltered(event, filter) {
  if (typeof filter === "number") {
    switch (event.type) {
      case FileChangeType.ADDED:
        return (filter & FileChangeFilter.ADDED) === 0;
      case FileChangeType.DELETED:
        return (filter & FileChangeFilter.DELETED) === 0;
      case FileChangeType.UPDATED:
        return (filter & FileChangeFilter.UPDATED) === 0;
    }
  }
  return false;
}
function requestFilterToString(filter) {
  if (typeof filter === "number") {
    const filters = [];
    if (filter & FileChangeFilter.ADDED) {
      filters.push("Added");
    }
    if (filter & FileChangeFilter.DELETED) {
      filters.push("Deleted");
    }
    if (filter & FileChangeFilter.UPDATED) {
      filters.push("Updated");
    }
    if (filters.length === 0) {
      return "<all>";
    }
    return `[${filters.join(", ")}]`;
  }
  return "<none>";
}
export {
  AbstractNonRecursiveWatcherClient,
  AbstractUniversalWatcherClient,
  AbstractWatcherClient,
  coalesceEvents,
  isFiltered,
  isRecursiveWatchRequest,
  isWatchRequestWithCorrelation,
  normalizeWatcherPattern,
  parseWatcherPatterns,
  requestFilterToString,
  reviveFileChanges
};
