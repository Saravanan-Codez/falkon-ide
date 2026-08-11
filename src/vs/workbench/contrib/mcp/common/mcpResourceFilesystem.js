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
import { sumBy } from "../../../../base/common/arrays.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { decodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenPool, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { autorun } from "../../../../base/common/observable.js";
import { newWriteableStream } from "../../../../base/common/stream.js";
import { equalsIgnoreCase } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { createFileSystemProviderError, FileChangeType, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IWebContentExtractorService } from "../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { McpServer } from "./mcpServer.js";
import { IMcpService, McpCapability, McpResourceURI } from "./mcpTypes.js";
import { canLoadMcpNetworkResourceDirectly } from "./mcpTypesUtils.js";
const MOMENTARY_CACHE_DURATION = 3e3;
let McpResourceFilesystem = class extends Disposable {
  constructor(_instantiationService, _fileService, _webContentExtractorService) {
    super();
    this._instantiationService = _instantiationService;
    this._fileService = _fileService;
    this._webContentExtractorService = _webContentExtractorService;
    /** Defer getting the MCP service since this is a BlockRestore and no need to make it unnecessarily. */
    this._mcpServiceLazy = new Lazy(() => this._instantiationService.invokeFunction((a) => a.get(IMcpService)));
    /**
     * For many file operations we re-read the resources quickly (e.g. stat
     * before reading the file) and would prefer to avoid spamming the MCP
     * with multiple reads. This is a very short-duration cache
     * to solve that.
     */
    this._momentaryCache = new ResourceMap();
    this.onDidChangeCapabilities = Event.None;
    this._onDidChangeFile = this._register(new Emitter());
    this.onDidChangeFile = this._onDidChangeFile.event;
    this.capabilities = FileSystemProviderCapabilities.None | FileSystemProviderCapabilities.Readonly | FileSystemProviderCapabilities.PathCaseSensitive | FileSystemProviderCapabilities.FileReadStream | FileSystemProviderCapabilities.FileAtomicRead | FileSystemProviderCapabilities.FileReadWrite;
    this._register(this._fileService.registerProvider(McpResourceURI.scheme, this));
  }
  get _mcpService() {
    return this._mcpServiceLazy.value;
  }
  //#region Filesystem API
  async readFile(resource) {
    return this._readFile(resource);
  }
  readFileStream(resource, opts, token) {
    const stream = newWriteableStream((data) => VSBuffer.concat(data.map((data2) => VSBuffer.wrap(data2))).buffer);
    this._readFile(resource, token).then(
      (data) => {
        if (opts.position) {
          data = data.slice(opts.position);
        }
        if (opts.length) {
          data = data.slice(0, opts.length);
        }
        stream.end(data);
      },
      (err) => stream.error(err)
    );
    return stream;
  }
  watch(uri, _opts) {
    const { resourceURI, server } = this._decodeURI(uri);
    const cap = server.capabilities.get();
    if (cap !== void 0 && !(cap & McpCapability.ResourcesSubscribe)) {
      return Disposable.None;
    }
    server.start();
    const store = new DisposableStore();
    let watchedOnHandler;
    const watchListener = store.add(new MutableDisposable());
    const callCts = store.add(new MutableDisposable());
    store.add(autorun((reader) => {
      const connection = server.connection.read(reader);
      if (!connection) {
        return;
      }
      const handler = connection.handler.read(reader);
      if (!handler || watchedOnHandler === handler) {
        return;
      }
      callCts.value?.dispose(true);
      callCts.value = new CancellationTokenSource();
      watchedOnHandler = handler;
      const token = callCts.value.token;
      handler.subscribe({ uri: resourceURI.toString() }, token).then(
        () => {
          if (!token.isCancellationRequested) {
            watchListener.value = handler.onDidUpdateResource((e) => {
              if (equalsUrlPath(e.params.uri, resourceURI)) {
                this._onDidChangeFile.fire([{ resource: uri, type: FileChangeType.UPDATED }]);
              }
            });
          }
        },
        (err) => {
          handler.logger.warn(`Failed to subscribe to resource changes for ${resourceURI}: ${err}`);
          watchedOnHandler = void 0;
        }
      );
    }));
    return store;
  }
  async stat(resource) {
    const { forSameURI, contents } = await this._readURI(resource);
    if (!contents.length) {
      throw createFileSystemProviderError(`File not found`, FileSystemProviderErrorCode.FileNotFound);
    }
    return {
      ctime: 0,
      mtime: 0,
      size: sumBy(contents, (c) => contentToBuffer(c).byteLength),
      type: forSameURI.length ? FileType.File : FileType.Directory
    };
  }
  async readdir(resource) {
    const { forSameURI, contents, resourceURI } = await this._readURI(resource);
    if (forSameURI.length > 0) {
      throw createFileSystemProviderError(`File is not a directory`, FileSystemProviderErrorCode.FileNotADirectory);
    }
    const resourcePathParts = resourceURI.pathname.split("/");
    const output = /* @__PURE__ */ new Map();
    for (const content of contents) {
      const contentURI = URI.parse(content.uri);
      const contentPathParts = contentURI.path.split("/");
      if (contentPathParts.length <= resourcePathParts.length || !resourcePathParts.every((part, index) => equalsIgnoreCase(part, contentPathParts[index]))) {
        continue;
      } else if (contentPathParts.length > resourcePathParts.length + 1) {
        output.set(contentPathParts[resourcePathParts.length], FileType.Directory);
      } else {
        const name = contentPathParts[contentPathParts.length - 1];
        output.set(name, contentToBuffer(content).byteLength > 0 ? FileType.File : FileType.Directory);
      }
    }
    return [...output];
  }
  mkdir(resource) {
    throw createFileSystemProviderError("write is not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  writeFile(resource, content, opts) {
    throw createFileSystemProviderError("write is not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  delete(resource, opts) {
    throw createFileSystemProviderError("delete is not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  rename(from, to, opts) {
    throw createFileSystemProviderError("rename is not supported", FileSystemProviderErrorCode.NoPermissions);
  }
  //#endregion
  async _readFile(resource, token) {
    const { forSameURI, contents } = await this._readURI(resource);
    if (!forSameURI.length) {
      if (!contents.length) {
        throw createFileSystemProviderError(`File not found`, FileSystemProviderErrorCode.FileNotFound);
      } else {
        throw createFileSystemProviderError(`File is a directory`, FileSystemProviderErrorCode.FileIsADirectory);
      }
    }
    return contentToBuffer(forSameURI[0]);
  }
  _decodeURI(uri) {
    let definitionId;
    let resourceURL;
    try {
      ({ definitionId, resourceURL } = McpResourceURI.toServer(uri));
    } catch (e) {
      throw createFileSystemProviderError(String(e), FileSystemProviderErrorCode.FileNotFound);
    }
    if (resourceURL.pathname.endsWith("/")) {
      resourceURL.pathname = resourceURL.pathname.slice(0, -1);
    }
    const server = this._mcpService.servers.get().find((s) => s.definition.id === definitionId);
    if (!server) {
      throw createFileSystemProviderError(`MCP server ${definitionId} not found`, FileSystemProviderErrorCode.FileNotFound);
    }
    const cap = server.capabilities.get();
    if (cap !== void 0 && !(cap & McpCapability.Resources)) {
      throw createFileSystemProviderError(`MCP server ${definitionId} does not support resources`, FileSystemProviderErrorCode.FileNotFound);
    }
    return { definitionId, resourceURI: resourceURL, server };
  }
  async _readURI(uri, token) {
    const cached = this._momentaryCache.get(uri);
    if (cached) {
      cached.pool.add(token || CancellationToken.None);
      return cached.promise;
    }
    const pool = this._store.add(new CancellationTokenPool());
    pool.add(token || CancellationToken.None);
    const promise = this._readURIInner(uri, pool.token);
    this._momentaryCache.set(uri, { pool, promise });
    const disposable = this._store.add(disposableTimeout(() => {
      this._momentaryCache.delete(uri);
      this._store.delete(disposable);
      this._store.delete(pool);
    }, MOMENTARY_CACHE_DURATION));
    return promise;
  }
  async _readURIInner(uri, token) {
    const { resourceURI, server } = this._decodeURI(uri);
    const matchedServer = this._mcpService.servers.get().find((s) => s.definition.id === server.definition.id);
    if (canLoadMcpNetworkResourceDirectly(resourceURI, matchedServer)) {
      const extractURI = URI.parse(resourceURI.toString());
      const result = (await this._webContentExtractorService.extract([extractURI], { followRedirects: false })).at(0);
      if (result?.status === "ok") {
        return {
          contents: [{ uri: resourceURI.toString(), text: result.result }],
          resourceURI,
          forSameURI: [{ uri: resourceURI.toString(), text: result.result }]
        };
      }
    }
    const res = await McpServer.callOn(server, (r) => r.readResource({ uri: resourceURI.toString() }, token), token);
    return {
      contents: res.contents,
      resourceURI,
      forSameURI: res.contents.filter((c) => equalsUrlPath(c.uri, resourceURI))
    };
  }
};
McpResourceFilesystem = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IWebContentExtractorService)
], McpResourceFilesystem);
function equalsUrlPath(a, b) {
  return equalsIgnoreCase(new URL(a).pathname, b.pathname);
}
function contentToBuffer(content) {
  if ("text" in content) {
    return VSBuffer.fromString(content.text).buffer;
  } else if ("blob" in content) {
    return decodeBase64(content.blob).buffer;
  } else {
    throw createFileSystemProviderError("Unknown content type", FileSystemProviderErrorCode.Unknown);
  }
}
export {
  McpResourceFilesystem
};
