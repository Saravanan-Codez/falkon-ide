import { decodeBase64, VSBuffer } from "../../../base/common/buffer.js";
import { disposableTimeout } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { createFileSystemProviderError, FileChangeType, FilePermission, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType } from "../../files/common/files.js";
import { fromAgentHostUri, toAgentHostUri } from "./agentHostUri.js";
import { ContentEncoding } from "./state/protocol/commands.js";
import { AhpErrorCodes } from "./state/protocol/errors.js";
import { ProtocolError } from "./state/sessionProtocol.js";
import { ActionType } from "./state/sessionActions.js";
import { ROOT_STATE_URI } from "./state/sessionState.js";
async function createRemoteWatchHandle(primitives, params) {
  const { channel } = await primitives.createResourceWatch(params);
  const channelUri = URI.parse(channel);
  await primitives.subscribe(channelUri);
  const onDidChangeEmitter = new Emitter();
  const listener = primitives.onDidAction((envelope) => {
    if (envelope.channel !== channel || envelope.action.type !== ActionType.ResourceWatchChanged) {
      return;
    }
    const items = envelope.action.changes?.items ?? [];
    if (items.length === 0) {
      return;
    }
    onDidChangeEmitter.fire(items.map((item) => ({
      resource: URI.parse(item.uri),
      type: item.type === "added" ? FileChangeType.ADDED : item.type === "deleted" ? FileChangeType.DELETED : FileChangeType.UPDATED
    })));
  });
  let disposed = false;
  return {
    onDidChange: onDidChangeEmitter.event,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      listener.dispose();
      onDidChangeEmitter.dispose();
      try {
        primitives.unsubscribe(channelUri);
      } catch {
      }
    }
  };
}
function agentHostUri(authority, path) {
  return toAgentHostUri(URI.file(path), authority);
}
function agentHostRemotePath(uri) {
  return fromAgentHostUri(uri).path;
}
class AHPFileSystemProvider extends Disposable {
  constructor(_connectionGraceMs = AHPFileSystemProvider._DEFAULT_CONNECTION_GRACE_MS) {
    super();
    this._connectionGraceMs = _connectionGraceMs;
    this.capabilities = FileSystemProviderCapabilities.PathCaseSensitive | FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.FileFolderCopy | FileSystemProviderCapabilities.FileRealpath;
    this._onDidChangeCapabilities = this._register(new Emitter());
    this.onDidChangeCapabilities = this._onDidChangeCapabilities.event;
    this._onDidChangeFile = this._register(new Emitter());
    this.onDidChangeFile = this._onDidChangeFile.event;
    this._onDidWatchError = this._register(new Emitter());
    this.onDidWatchError = this._onDidWatchError.event;
    /**
     * Per-authority registration slot. We keep the slot alive for a brief
     * grace period after the last registration is disposed, so an
     * operation issued during a reconnection window can wait for the
     * replacement registration instead of failing immediately.
     */
    this._authorities = /* @__PURE__ */ new Map();
    /**
     * Fires the authority whose active connection has changed: added,
     * replaced, fallen back to an older registration, entered the grace
     * window (no active connection), or evicted. Long-lived consumers
     * (e.g. {@link watch}) subscribe here so they continue to receive
     * notifications across full entry eviction + later re-creation —
     * something a per-entry emitter cannot offer.
     */
    this._onDidChangeConnection = this._register(new Emitter());
  }
  static {
    /**
     * Grace period during which {@link _getConnection} will await a new
     * registration after the previous one is disposed. Covers the window
     * where a transport is briefly torn down and re-registered (e.g. an
     * agent-host client reconnect that races a plugin sync). 5s matches
     * the typical reconnect timeout. Consumers should still implement
     * logical retries for longer reconnection latencies, but this is a
     * low level, best-effort mechanism.
     *
     * Tests can override this via the constructor parameter.
     */
    this._DEFAULT_CONNECTION_GRACE_MS = 5e3;
  }
  /**
   * Register a mapping from a URI authority to a connection.
   * Returns a disposable that unregisters the mapping. Multiple
   * concurrent registrations for the same authority are supported;
   * the most recent registration wins, and disposing it falls back to
   * the previous one (if any). After the *last* registration is
   * disposed the entry is held open for {@link _connectionGraceMs} so
   * that a reconnect can replace it without orphaning in-flight
   * operations.
   */
  registerAuthority(authority, connection) {
    let entry = this._authorities.get(authority);
    if (!entry) {
      entry = {
        connections: [connection],
        expiry: new MutableDisposable()
      };
      this._authorities.set(authority, entry);
    } else {
      entry.expiry.clear();
      entry.connections.push(connection);
    }
    const adopted = entry;
    this._onDidChangeConnection.fire(authority);
    return toDisposable(() => {
      const idx = adopted.connections.indexOf(connection);
      if (idx === -1) {
        return;
      }
      const wasActive = idx === adopted.connections.length - 1;
      adopted.connections.splice(idx, 1);
      if (adopted.connections.length === 0) {
        adopted.expiry.value = disposableTimeout(
          () => this._expireAuthority(authority, adopted),
          this._connectionGraceMs,
          this._store
        );
      }
      if (wasActive) {
        this._onDidChangeConnection.fire(authority);
      }
    });
  }
  _expireAuthority(authority, entry) {
    if (this._authorities.get(authority) !== entry || entry.connections.length > 0) {
      return;
    }
    this._authorities.delete(authority);
    entry.expiry.dispose();
    this._onDidChangeConnection.fire(authority);
  }
  dispose() {
    for (const entry of this._authorities.values()) {
      entry.expiry.dispose();
      entry.connections.length = 0;
    }
    this._authorities.clear();
    super.dispose();
  }
  watch(resource, opts) {
    const store = new DisposableStore();
    const handleHolder = store.add(new MutableDisposable());
    const authority = resource.authority;
    const params = {
      channel: ROOT_STATE_URI,
      uri: this._decodeUri(resource).toString(),
      recursive: opts.recursive,
      ...opts.excludes.length > 0 ? { excludes: { items: [...opts.excludes] } } : {},
      ...opts.includes && opts.includes.length > 0 ? { includes: { items: opts.includes.map((p) => typeof p === "string" ? p : p.pattern) } } : {}
    };
    let attached;
    let attaching = false;
    let pendingReattach = false;
    const reattach = async () => {
      if (store.isDisposed) {
        return;
      }
      if (attaching) {
        pendingReattach = true;
        return;
      }
      const entry = this._authorities.get(authority);
      const next = entry?.connections.at(-1);
      if (next === attached) {
        return;
      }
      handleHolder.clear();
      attached = void 0;
      const watchResource = next?.watchResource;
      if (!next || !watchResource) {
        return;
      }
      attaching = true;
      const target = next;
      try {
        const handle = await watchResource.call(target, params);
        if (store.isDisposed) {
          handle.dispose();
          return;
        }
        const current = this._authorities.get(authority);
        if (!current || current.connections.at(-1) !== target) {
          handle.dispose();
          return;
        }
        const sub = handle.onDidChange((changes) => this._onDidChangeFile.fire(changes.map((c) => ({
          resource: this._encodeUri(c.resource, resource.authority),
          type: c.type
        }))));
        handleHolder.value = toDisposable(() => {
          sub.dispose();
          handle.dispose();
        });
        attached = target;
      } catch (err) {
        this._onDidWatchError.fire(err instanceof Error ? err.message : String(err));
      } finally {
        attaching = false;
        if (pendingReattach) {
          pendingReattach = false;
          void reattach();
        }
      }
    };
    store.add(this._onDidChangeConnection.event((a) => {
      if (a === authority) {
        void reattach();
      }
    }));
    void reattach();
    return store;
  }
  async stat(resource) {
    const path = resource.path;
    if (path === "/" || path === "") {
      return { type: FileType.Directory, mtime: 0, ctime: 0, size: 0, permissions: FilePermission.Readonly };
    }
    const decoded = this._decodeUri(resource);
    if (decoded.scheme === "session-db" || decoded.scheme === "git-blob") {
      return { type: FileType.File, mtime: 0, ctime: 0, size: 0, permissions: FilePermission.Readonly };
    }
    if (decoded.path === "/" || decoded.path === "") {
      return { type: FileType.Directory, mtime: 0, ctime: 0, size: 0, permissions: FilePermission.Readonly };
    }
    const connection = await this._getConnection(resource.authority);
    try {
      const resolved = await this._resolve(connection, decoded);
      return {
        type: resolved.type === "directory" ? FileType.Directory : resolved.type === "symlink" ? FileType.SymbolicLink : FileType.File,
        mtime: resolved.mtime ? Date.parse(resolved.mtime) : 0,
        ctime: resolved.ctime ? Date.parse(resolved.ctime) : 0,
        size: resolved.size ?? 0
      };
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.FileNotFound);
    }
  }
  async realpath(resource) {
    const path = resource.path;
    if (path === "/" || path === "") {
      return path;
    }
    const decoded = this._decodeUri(resource);
    if (decoded.scheme === "session-db" || decoded.scheme === "git-blob" || decoded.path === "/" || decoded.path === "") {
      return path;
    }
    const connection = await this._getConnection(resource.authority);
    try {
      const resolved = await this._resolve(connection, decoded);
      return this._encodeUri(URI.parse(resolved.uri), resource.authority).path;
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.FileNotFound);
    }
  }
  async readdir(resource) {
    const entries = await this._listDirectory(resource.authority, resource);
    return entries.map((e) => [e.name, e.type === "directory" ? FileType.Directory : FileType.File]);
  }
  async readFile(resource) {
    const connection = await this._getConnection(resource.authority);
    try {
      const originalUri = this._decodeUri(resource);
      const result = await connection.resourceRead(originalUri);
      if (result.encoding === ContentEncoding.Base64) {
        return decodeBase64(result.data).buffer;
      }
      return VSBuffer.fromString(result.data).buffer;
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.FileNotFound);
    }
  }
  async writeFile(resource, content, _opts) {
    const connection = await this._getConnection(resource.authority);
    try {
      const originalUri = this._decodeUri(resource);
      await connection.resourceWrite({
        channel: ROOT_STATE_URI,
        uri: originalUri.toString(),
        data: VSBuffer.wrap(content).toString(),
        encoding: ContentEncoding.Utf8
      });
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  async mkdir(resource) {
    const connection = await this._getConnection(resource.authority);
    try {
      const originalUri = this._decodeUri(resource);
      await connection.resourceMkdir({ channel: ROOT_STATE_URI, uri: originalUri.toString() });
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  async delete(resource, opts) {
    const connection = await this._getConnection(resource.authority);
    try {
      const originalUri = this._decodeUri(resource);
      await connection.resourceDelete({ channel: ROOT_STATE_URI, uri: originalUri.toString(), recursive: opts.recursive });
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  async rename(from, to, opts) {
    const connection = await this._getConnection(from.authority);
    try {
      const originalFrom = this._decodeUri(from);
      const originalTo = this._decodeUri(to);
      await connection.resourceMove({ channel: ROOT_STATE_URI, source: originalFrom.toString(), destination: originalTo.toString(), failIfExists: !opts.overwrite });
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  async copy(from, to, opts) {
    const connection = await this._getConnection(from.authority);
    try {
      const originalFrom = this._decodeUri(from);
      const originalTo = this._decodeUri(to);
      await connection.resourceCopy({ channel: ROOT_STATE_URI, source: originalFrom.toString(), destination: originalTo.toString(), failIfExists: !opts.overwrite });
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  /**
   * Negotiate access to {@link resource} with the receiver, asking for the
   * granted modes in {@link opts}. Used after a `NoPermissions` failure to
   * prompt the receiver to grant access; the caller can then retry.
   *
   * Resolves on success. Rejects if the receiver denies, the connection
   * is missing, or the connection doesn't implement `resourceRequest`.
   */
  async requestResourceAccess(resource, opts) {
    const connection = await this._getConnection(resource.authority);
    if (!connection.resourceRequest) {
      throw createFileSystemProviderError(
        `Connection for ${resource.authority} does not support resourceRequest`,
        FileSystemProviderErrorCode.Unavailable
      );
    }
    const originalUri = this._decodeUri(resource);
    try {
      await connection.resourceRequest({
        channel: ROOT_STATE_URI,
        uri: originalUri.toString(),
        read: opts.read,
        write: opts.write
      });
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.NoPermissions);
    }
  }
  // ---- Internals ----------------------------------------------------------
  _getConnection(authority) {
    const entry = this._authorities.get(authority);
    if (!entry) {
      return Promise.reject(createFileSystemProviderError(
        `No connection for authority: ${authority}`,
        FileSystemProviderErrorCode.Unavailable
      ));
    }
    const active = entry.connections.at(-1);
    if (active) {
      return Promise.resolve(active);
    }
    return new Promise((resolve, reject) => {
      const settle = () => {
        const current = this._authorities.get(authority);
        if (!current) {
          sub.dispose();
          reject(createFileSystemProviderError(
            `No connection for authority: ${authority}`,
            FileSystemProviderErrorCode.Unavailable
          ));
          return;
        }
        const c = current.connections.at(-1);
        if (c) {
          sub.dispose();
          resolve(c);
        }
      };
      const sub = this._onDidChangeConnection.event((a) => {
        if (a === authority) {
          settle();
        }
      });
      settle();
    });
  }
  /**
   * Translate a thrown error from a {@link IRemoteFilesystemConnection}
   * into a {@link FileSystemProviderError}. Preserves `PermissionDenied`
   * (-32009) as `NoPermissions` so callers can distinguish a
   * permission failure from `NotFound` and decide whether to negotiate
   * via {@link requestResourceAccess}.
   */
  _mapError(err, defaultCode) {
    if (err instanceof ProtocolError && err.code === AhpErrorCodes.PermissionDenied) {
      return createFileSystemProviderError(err.message, FileSystemProviderErrorCode.NoPermissions);
    }
    return createFileSystemProviderError(
      err instanceof Error ? err.message : String(err),
      defaultCode
    );
  }
  /**
   * Resolve a decoded resource over {@link connection}. Shared by
   * {@link stat} and {@link realpath}.
   */
  _resolve(connection, decoded) {
    return connection.resourceResolve({ channel: ROOT_STATE_URI, uri: decoded.toString() });
  }
  async _listDirectory(authority, resource) {
    const connection = await this._getConnection(authority);
    try {
      const originalUri = this._decodeUri(resource);
      const result = await connection.resourceList(originalUri);
      return result.entries;
    } catch (err) {
      throw this._mapError(err, FileSystemProviderErrorCode.Unavailable);
    }
  }
}
class AgentHostFileSystemProvider extends AHPFileSystemProvider {
  _decodeUri(resource) {
    return fromAgentHostUri(resource);
  }
  _encodeUri(resource, authority) {
    return toAgentHostUri(resource, authority);
  }
}
export {
  AHPFileSystemProvider,
  AgentHostFileSystemProvider,
  agentHostRemotePath,
  agentHostUri,
  createRemoteWatchHandle
};
