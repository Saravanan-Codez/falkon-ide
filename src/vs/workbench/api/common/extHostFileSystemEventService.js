import { Emitter, AsyncEmitter } from "../../../base/common/event.js";
import { GLOBSTAR, GLOB_SPLIT, parse } from "../../../base/common/glob.js";
import { URI } from "../../../base/common/uri.js";
import { MainContext } from "./extHost.protocol.js";
import * as typeConverter from "./extHostTypeConverters.js";
import { Disposable, WorkspaceEdit } from "./extHostTypes.js";
import { FileChangeFilter, FileOperation, FileSystemProviderCapabilities } from "../../../platform/files/common/files.js";
import { Lazy } from "../../../base/common/lazy.js";
import { rtrim } from "../../../base/common/strings.js";
import { normalizeWatcherPattern } from "../../../platform/files/common/watcher.js";
import { Schemas } from "../../../base/common/network.js";
class FileSystemWatcher {
  constructor(mainContext, configuration, fileSystemInfo, workspace, extension, dispatcher, globPattern, options) {
    this.session = Math.random();
    this._onDidCreate = new Emitter();
    this._onDidChange = new Emitter();
    this._onDidDelete = new Emitter();
    this._config = 0;
    if (options.ignoreCreateEvents) {
      this._config += 1;
    }
    if (options.ignoreChangeEvents) {
      this._config += 2;
    }
    if (options.ignoreDeleteEvents) {
      this._config += 4;
    }
    const ignoreCase = typeof globPattern === "string" ? !((fileSystemInfo.getCapabilities(Schemas.file) ?? 0) & FileSystemProviderCapabilities.PathCaseSensitive) : fileSystemInfo.extUri.ignorePathCasing(URI.revive(globPattern.baseUri));
    let matchGlob = globPattern;
    if (ignoreCase) {
      matchGlob = typeof globPattern === "string" ? globPattern.toLowerCase() : { base: globPattern.base.toLowerCase(), pattern: globPattern.pattern.toLowerCase() };
    }
    const parsedPattern = parse(matchGlob, {
      ignoreCase: false
      /* speeds up matching, but requires us to lowercase paths and patterns */
    });
    const excludeOutOfWorkspaceEvents = typeof globPattern === "string";
    const excludeUncorrelatedEvents = false;
    const subscription = dispatcher((events) => {
      if (typeof events.session === "number" && events.session !== this.session) {
        return;
      }
      if (excludeUncorrelatedEvents && typeof events.session === "undefined") {
        return;
      }
      if (!options.ignoreCreateEvents) {
        for (const { uri, lowerCaseFsPath } of events.created) {
          if (parsedPattern(ignoreCase ? lowerCaseFsPath : uri.fsPath) && (!excludeOutOfWorkspaceEvents || workspace.getWorkspaceFolder(uri))) {
            this._onDidCreate.fire(uri);
          }
        }
      }
      if (!options.ignoreChangeEvents) {
        for (const { uri, lowerCaseFsPath } of events.changed) {
          if (parsedPattern(ignoreCase ? lowerCaseFsPath : uri.fsPath) && (!excludeOutOfWorkspaceEvents || workspace.getWorkspaceFolder(uri))) {
            this._onDidChange.fire(uri);
          }
        }
      }
      if (!options.ignoreDeleteEvents) {
        for (const { uri, lowerCaseFsPath } of events.deleted) {
          if (parsedPattern(ignoreCase ? lowerCaseFsPath : uri.fsPath) && (!excludeOutOfWorkspaceEvents || workspace.getWorkspaceFolder(uri))) {
            this._onDidDelete.fire(uri);
          }
        }
      }
    });
    this._disposable = Disposable.from(this.ensureWatching(mainContext, workspace, configuration, extension, globPattern, options, false), this._onDidCreate, this._onDidChange, this._onDidDelete, subscription);
  }
  get ignoreCreateEvents() {
    return Boolean(this._config & 1);
  }
  get ignoreChangeEvents() {
    return Boolean(this._config & 2);
  }
  get ignoreDeleteEvents() {
    return Boolean(this._config & 4);
  }
  ensureWatching(mainContext, workspace, configuration, extension, globPattern, options, correlate) {
    const disposable = Disposable.from();
    if (typeof globPattern === "string") {
      return disposable;
    }
    if (options.ignoreChangeEvents && options.ignoreCreateEvents && options.ignoreDeleteEvents) {
      return disposable;
    }
    const proxy = mainContext.getProxy(MainContext.MainThreadFileSystemEventService);
    let recursive = false;
    if (globPattern.pattern.includes(GLOBSTAR) || globPattern.pattern.includes(GLOB_SPLIT)) {
      recursive = true;
    }
    const excludes = [];
    let includes = void 0;
    let filter;
    if (correlate) {
      if (options.ignoreChangeEvents || options.ignoreCreateEvents || options.ignoreDeleteEvents) {
        filter = FileChangeFilter.UPDATED | FileChangeFilter.ADDED | FileChangeFilter.DELETED;
        if (options.ignoreChangeEvents) {
          filter &= ~FileChangeFilter.UPDATED;
        }
        if (options.ignoreCreateEvents) {
          filter &= ~FileChangeFilter.ADDED;
        }
        if (options.ignoreDeleteEvents) {
          filter &= ~FileChangeFilter.DELETED;
        }
      }
    } else {
      if (recursive && excludes.length === 0) {
        const workspaceFolder = workspace.getWorkspaceFolder(URI.revive(globPattern.baseUri));
        const watcherExcludes = configuration.getConfiguration("files", workspaceFolder).get("watcherExclude");
        if (watcherExcludes) {
          for (const key in watcherExcludes) {
            if (key && watcherExcludes[key] === true) {
              excludes.push(key);
            }
          }
        }
      } else if (!recursive) {
        const workspaceFolder = workspace.getWorkspaceFolder(URI.revive(globPattern.baseUri));
        if (workspaceFolder) {
          const watcherExcludes = configuration.getConfiguration("files", workspaceFolder).get("watcherExclude");
          if (watcherExcludes) {
            for (const key in watcherExcludes) {
              if (key && watcherExcludes[key] === true) {
                const includePattern = `${rtrim(key, "/")}/${GLOBSTAR}`;
                if (!includes) {
                  includes = [];
                }
                includes.push(normalizeWatcherPattern(workspaceFolder.uri.fsPath, includePattern));
              }
            }
          }
          if (!includes || includes.length === 0) {
            return disposable;
          }
        }
      }
    }
    proxy.$watch(extension.identifier.value, this.session, globPattern.baseUri, { recursive, excludes, includes, filter }, Boolean(correlate));
    return Disposable.from({ dispose: () => proxy.$unwatch(this.session) });
  }
  dispose() {
    this._disposable.dispose();
  }
  get onDidCreate() {
    return this._onDidCreate.event;
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  get onDidDelete() {
    return this._onDidDelete.event;
  }
}
class LazyRevivedFileSystemEvents {
  constructor(_events) {
    this._events = _events;
    this._created = new Lazy(() => this._events.created.map(LazyRevivedFileSystemEvents._revive));
    this._changed = new Lazy(() => this._events.changed.map(LazyRevivedFileSystemEvents._revive));
    this._deleted = new Lazy(() => this._events.deleted.map(LazyRevivedFileSystemEvents._revive));
    this.session = this._events.session;
  }
  get created() {
    return this._created.value;
  }
  get changed() {
    return this._changed.value;
  }
  get deleted() {
    return this._deleted.value;
  }
  static _revive(uriComponents) {
    const uri = URI.revive(uriComponents);
    return { uri, lowerCaseFsPath: uri.fsPath.toLowerCase() };
  }
}
class ExtHostFileSystemEventService {
  constructor(_mainContext, _logService, _extHostDocumentsAndEditors) {
    this._mainContext = _mainContext;
    this._logService = _logService;
    this._extHostDocumentsAndEditors = _extHostDocumentsAndEditors;
    this._onFileSystemEvent = new Emitter();
    this._onDidRenameFile = new Emitter();
    this._onDidCreateFile = new Emitter();
    this._onDidDeleteFile = new Emitter();
    this._onWillRenameFile = new AsyncEmitter();
    this._onWillCreateFile = new AsyncEmitter();
    this._onWillDeleteFile = new AsyncEmitter();
    this.onDidRenameFile = this._onDidRenameFile.event;
    this.onDidCreateFile = this._onDidCreateFile.event;
    this.onDidDeleteFile = this._onDidDeleteFile.event;
  }
  //--- file events
  createFileSystemWatcher(workspace, configProvider, fileSystemInfo, extension, globPattern, options) {
    return new FileSystemWatcher(this._mainContext, configProvider, fileSystemInfo, workspace, extension, this._onFileSystemEvent.event, typeConverter.GlobPattern.from(globPattern), options);
  }
  $onFileEvent(events) {
    this._onFileSystemEvent.fire(new LazyRevivedFileSystemEvents(events));
  }
  //--- file operations
  $onDidRunFileOperation(operation, files) {
    switch (operation) {
      case FileOperation.MOVE:
        this._onDidRenameFile.fire(Object.freeze({ files: files.map((f) => ({ oldUri: URI.revive(f.source), newUri: URI.revive(f.target) })) }));
        break;
      case FileOperation.DELETE:
        this._onDidDeleteFile.fire(Object.freeze({ files: files.map((f) => URI.revive(f.target)) }));
        break;
      case FileOperation.CREATE:
      case FileOperation.COPY:
        this._onDidCreateFile.fire(Object.freeze({ files: files.map((f) => URI.revive(f.target)) }));
        break;
      default:
    }
  }
  getOnWillRenameFileEvent(extension) {
    return this._createWillExecuteEvent(extension, this._onWillRenameFile);
  }
  getOnWillCreateFileEvent(extension) {
    return this._createWillExecuteEvent(extension, this._onWillCreateFile);
  }
  getOnWillDeleteFileEvent(extension) {
    return this._createWillExecuteEvent(extension, this._onWillDeleteFile);
  }
  _createWillExecuteEvent(extension, emitter) {
    return (listener, thisArg, disposables) => {
      const wrappedListener = function wrapped(e) {
        listener.call(thisArg, e);
      };
      wrappedListener.extension = extension;
      return emitter.event(wrappedListener, void 0, disposables);
    };
  }
  async $onWillRunFileOperation(operation, files, timeout, token) {
    switch (operation) {
      case FileOperation.MOVE:
        return await this._fireWillEvent(this._onWillRenameFile, { files: files.map((f) => ({ oldUri: URI.revive(f.source), newUri: URI.revive(f.target) })) }, timeout, token);
      case FileOperation.DELETE:
        return await this._fireWillEvent(this._onWillDeleteFile, { files: files.map((f) => URI.revive(f.target)) }, timeout, token);
      case FileOperation.CREATE:
      case FileOperation.COPY:
        return await this._fireWillEvent(this._onWillCreateFile, { files: files.map((f) => URI.revive(f.target)) }, timeout, token);
    }
    return void 0;
  }
  async _fireWillEvent(emitter, data, timeout, token) {
    const extensionNames = /* @__PURE__ */ new Set();
    const edits = [];
    await emitter.fireAsync(data, token, async (thenable, listener) => {
      const now = Date.now();
      const result = await Promise.resolve(thenable);
      if (result instanceof WorkspaceEdit) {
        edits.push([listener.extension, result]);
        extensionNames.add(listener.extension.displayName ?? listener.extension.identifier.value);
      }
      if (Date.now() - now > timeout) {
        this._logService.warn("SLOW file-participant", listener.extension.identifier);
      }
    });
    if (token.isCancellationRequested) {
      return void 0;
    }
    if (edits.length === 0) {
      return void 0;
    }
    const dto = { edits: [] };
    for (const [, edit] of edits) {
      const { edits: edits2 } = typeConverter.WorkspaceEdit.from(edit, {
        getTextDocumentVersion: (uri) => this._extHostDocumentsAndEditors.getDocument(uri)?.version,
        getNotebookDocumentVersion: () => void 0
      });
      dto.edits = dto.edits.concat(edits2);
    }
    return { edit: dto, extensionNames: Array.from(extensionNames) };
  }
}
export {
  ExtHostFileSystemEventService
};
