import { Emitter } from "../../../base/common/event.js";
import { DiskFileSystemProvider } from "./diskFileSystemProvider.js";
import { Disposable, dispose, toDisposable } from "../../../base/common/lifecycle.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { listenStream } from "../../../base/common/stream.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
class AbstractDiskFileSystemProviderChannel extends Disposable {
  constructor(provider, logService) {
    super();
    this.provider = provider;
    this.logService = logService;
    //#endregion
    //#region File Watching
    this.sessionToWatcher = /* @__PURE__ */ new Map();
    this.watchRequests = /* @__PURE__ */ new Map();
  }
  call(ctx, command, args) {
    const uriTransformer = this.getUriTransformer(ctx);
    switch (command) {
      case "stat":
        return this.stat(uriTransformer, args[0]);
      case "realpath":
        return this.realpath(uriTransformer, args[0]);
      case "readdir":
        return this.readdir(uriTransformer, args[0]);
      case "open":
        return this.open(uriTransformer, args[0], args[1]);
      case "close":
        return this.close(args[0]);
      case "read":
        return this.read(args[0], args[1], args[2]);
      case "readFile":
        return this.readFile(uriTransformer, args[0], args[1]);
      case "write":
        return this.write(args[0], args[1], args[2], args[3], args[4]);
      case "writeFile":
        return this.writeFile(uriTransformer, args[0], args[1], args[2]);
      case "rename":
        return this.rename(uriTransformer, args[0], args[1], args[2]);
      case "copy":
        return this.copy(uriTransformer, args[0], args[1], args[2]);
      case "cloneFile":
        return this.cloneFile(uriTransformer, args[0], args[1]);
      case "mkdir":
        return this.mkdir(uriTransformer, args[0]);
      case "delete":
        return this.delete(uriTransformer, args[0], args[1]);
      case "watch":
        return this.watch(uriTransformer, args[0], args[1], args[2], args[3]);
      case "unwatch":
        return this.unwatch(args[0], args[1]);
    }
    throw new Error(`IPC Command ${command} not found`);
  }
  listen(ctx, event, args) {
    const uriTransformer = this.getUriTransformer(ctx);
    switch (event) {
      case "fileChange":
        return this.onFileChange(uriTransformer, args[0]);
      case "readFileStream":
        return this.onReadFileStream(uriTransformer, args[0], args[1]);
    }
    throw new Error(`Unknown event ${event}`);
  }
  //#region File Metadata Resolving
  stat(uriTransformer, _resource) {
    const resource = this.transformIncoming(uriTransformer, _resource, true);
    return this.provider.stat(resource);
  }
  realpath(uriTransformer, _resource) {
    const resource = this.transformIncoming(uriTransformer, _resource, true);
    return this.provider.realpath(resource);
  }
  readdir(uriTransformer, _resource) {
    const resource = this.transformIncoming(uriTransformer, _resource);
    return this.provider.readdir(resource);
  }
  //#endregion
  //#region File Reading/Writing
  async readFile(uriTransformer, _resource, opts) {
    const resource = this.transformIncoming(uriTransformer, _resource, true);
    const buffer = await this.provider.readFile(resource, opts);
    return VSBuffer.wrap(buffer);
  }
  onReadFileStream(uriTransformer, _resource, opts) {
    const resource = this.transformIncoming(uriTransformer, _resource, true);
    const cts = new CancellationTokenSource();
    const emitter = new Emitter({
      onDidRemoveLastListener: () => {
        cts.cancel();
      }
    });
    const fileStream = this.provider.readFileStream(resource, opts, cts.token);
    listenStream(fileStream, {
      onData: (chunk) => emitter.fire(VSBuffer.wrap(chunk)),
      onError: (error) => emitter.fire(error),
      onEnd: () => {
        emitter.fire("end");
        emitter.dispose();
        cts.dispose();
      }
    });
    return emitter.event;
  }
  writeFile(uriTransformer, _resource, content, opts) {
    const resource = this.transformIncoming(uriTransformer, _resource);
    return this.provider.writeFile(resource, content.buffer, opts);
  }
  open(uriTransformer, _resource, opts) {
    const resource = this.transformIncoming(uriTransformer, _resource, true);
    return this.provider.open(resource, opts);
  }
  close(fd) {
    return this.provider.close(fd);
  }
  async read(fd, pos, length) {
    const buffer = VSBuffer.alloc(length);
    const bufferOffset = 0;
    const bytesRead = await this.provider.read(fd, pos, buffer.buffer, bufferOffset, length);
    return [buffer, bytesRead];
  }
  write(fd, pos, data, offset, length) {
    return this.provider.write(fd, pos, data.buffer, offset, length);
  }
  //#endregion
  //#region Move/Copy/Delete/Create Folder
  mkdir(uriTransformer, _resource) {
    const resource = this.transformIncoming(uriTransformer, _resource);
    return this.provider.mkdir(resource);
  }
  delete(uriTransformer, _resource, opts) {
    const resource = this.transformIncoming(uriTransformer, _resource);
    return this.provider.delete(resource, opts);
  }
  rename(uriTransformer, _source, _target, opts) {
    const source = this.transformIncoming(uriTransformer, _source);
    const target = this.transformIncoming(uriTransformer, _target);
    return this.provider.rename(source, target, opts);
  }
  copy(uriTransformer, _source, _target, opts) {
    const source = this.transformIncoming(uriTransformer, _source);
    const target = this.transformIncoming(uriTransformer, _target);
    return this.provider.copy(source, target, opts);
  }
  //#endregion
  //#region Clone File
  cloneFile(uriTransformer, _source, _target) {
    const source = this.transformIncoming(uriTransformer, _source);
    const target = this.transformIncoming(uriTransformer, _target);
    return this.provider.cloneFile(source, target);
  }
  onFileChange(uriTransformer, sessionId) {
    const emitter = new Emitter({
      onWillAddFirstListener: () => {
        this.sessionToWatcher.set(sessionId, this.createSessionFileWatcher(uriTransformer, emitter));
      },
      onDidRemoveLastListener: () => {
        dispose(this.sessionToWatcher.get(sessionId));
        this.sessionToWatcher.delete(sessionId);
      }
    });
    return emitter.event;
  }
  async watch(uriTransformer, sessionId, req, _resource, opts) {
    const watcher = this.sessionToWatcher.get(sessionId);
    if (watcher) {
      const resource = this.transformIncoming(uriTransformer, _resource);
      const disposable = watcher.watch(req, resource, opts);
      this.watchRequests.set(sessionId + req, disposable);
    }
  }
  async unwatch(sessionId, req) {
    const id = sessionId + req;
    const disposable = this.watchRequests.get(id);
    if (disposable) {
      dispose(disposable);
      this.watchRequests.delete(id);
    }
  }
  //#endregion
  dispose() {
    super.dispose();
    for (const [, disposable] of this.watchRequests) {
      disposable.dispose();
    }
    this.watchRequests.clear();
    for (const [, disposable] of this.sessionToWatcher) {
      disposable.dispose();
    }
    this.sessionToWatcher.clear();
  }
}
class AbstractSessionFileWatcher extends Disposable {
  constructor(uriTransformer, sessionEmitter, logService, environmentService) {
    super();
    this.uriTransformer = uriTransformer;
    this.environmentService = environmentService;
    this.watcherRequests = /* @__PURE__ */ new Map();
    this.fileWatcher = this._register(new DiskFileSystemProvider(logService));
    this.registerListeners(sessionEmitter);
  }
  registerListeners(sessionEmitter) {
    const localChangeEmitter = this._register(new Emitter());
    this._register(localChangeEmitter.event((events) => {
      sessionEmitter.fire(
        events.map((e) => ({
          resource: this.uriTransformer.transformOutgoingURI(e.resource),
          type: e.type,
          cId: e.cId
        }))
      );
    }));
    this._register(this.fileWatcher.onDidChangeFile((events) => localChangeEmitter.fire(events)));
    this._register(this.fileWatcher.onDidWatchError((error) => sessionEmitter.fire(error)));
  }
  getRecursiveWatcherOptions(environmentService) {
    return void 0;
  }
  getExtraExcludes(environmentService) {
    return void 0;
  }
  watch(req, resource, opts) {
    const extraExcludes = this.getExtraExcludes(this.environmentService);
    if (Array.isArray(extraExcludes)) {
      opts.excludes = [...opts.excludes, ...extraExcludes];
    }
    this.watcherRequests.set(req, this.fileWatcher.watch(resource, opts));
    return toDisposable(() => {
      dispose(this.watcherRequests.get(req));
      this.watcherRequests.delete(req);
    });
  }
  dispose() {
    for (const [, disposable] of this.watcherRequests) {
      disposable.dispose();
    }
    this.watcherRequests.clear();
    super.dispose();
  }
}
export {
  AbstractDiskFileSystemProviderChannel,
  AbstractSessionFileWatcher
};
