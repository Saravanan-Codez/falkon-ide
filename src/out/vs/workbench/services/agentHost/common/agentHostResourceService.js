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
import { DeferredPromise } from "../../../../base/common/async.js";
import { VSBuffer, decodeBase64 } from "../../../../base/common/buffer.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { derived, observableValue } from "../../../../base/common/observable.js";
import { extUri } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import {
  AgentHostAccessMode,
  AgentHostLocalFilePermissionsSettingId,
  AgentHostPermissionMode,
  AgentHostResourcePermissionError,
  IAgentHostResourceService,
  LOCAL_AGENT_HOST_RESOURCE_IDENTITY
} from "../../../../platform/agentHost/common/agentHostResourceService.js";
import { normalizeRemoteAgentHostAddress } from "../../../../platform/agentHost/common/agentHostUri.js";
import {
  ContentEncoding,
  ResourceType
} from "../../../../platform/agentHost/common/state/protocol/commands.js";
import { ROOT_STATE_URI } from "../../../../platform/agentHost/common/state/sessionState.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
function normalizeResourceIdentity(identity) {
  return identity === LOCAL_AGENT_HOST_RESOURCE_IDENTITY ? identity : normalizeRemoteAgentHostAddress(identity);
}
let AgentHostResourceService = class extends Disposable {
  constructor(_configurationService, _fileService, _textModelService, _logService) {
    super();
    this._configurationService = _configurationService;
    this._fileService = _fileService;
    this._textModelService = _textModelService;
    this._logService = _logService;
    this._inMemoryGrants = /* @__PURE__ */ new Map();
    this._pending = observableValue("agentHostResources.pending", []);
    this.allPending = this._pending;
  }
  // ---- Gated FS operations ------------------------------------------------
  async list(identity, uri) {
    await this._gate(identity, uri, AgentHostPermissionMode.Read, { channel: ROOT_STATE_URI, uri: uri.toString(), read: true });
    const stat = await this._fileService.resolve(uri);
    if (!stat.isDirectory) {
      throw new Error(`Resource is not a directory: ${uri.toString()}`);
    }
    return {
      entries: (stat.children ?? []).map((c) => ({
        name: c.name,
        type: c.isDirectory ? "directory" : "file"
      }))
    };
  }
  async read(identity, uri) {
    await this._gate(identity, uri, AgentHostPermissionMode.Read, { channel: ROOT_STATE_URI, uri: uri.toString(), read: true });
    try {
      const content = await this._fileService.readFile(uri);
      return { bytes: content.value };
    } catch (err) {
      const virtual = await this._readVirtual(uri);
      if (virtual) {
        return { bytes: virtual };
      }
      throw err;
    }
  }
  async write(identity, params) {
    const uri = URI.parse(params.uri);
    await this._gate(identity, uri, AgentHostPermissionMode.Write, { channel: ROOT_STATE_URI, uri: uri.toString(), write: true });
    const buf = params.encoding === ContentEncoding.Base64 ? decodeBase64(params.data) : VSBuffer.fromString(params.data);
    try {
      if (params.createOnly) {
        await this._fileService.createFile(uri, buf, { overwrite: false });
      } else {
        await this._fileService.writeFile(uri, buf);
      }
    } catch (err) {
      if (await this._writeVirtual(uri, buf)) {
        return;
      }
      throw err;
    }
  }
  async del(identity, params) {
    const uri = URI.parse(params.uri);
    await this._gate(identity, uri, AgentHostPermissionMode.Write, { channel: ROOT_STATE_URI, uri: uri.toString(), write: true });
    await this._fileService.del(uri, { recursive: !!params.recursive });
  }
  async move(identity, params) {
    const source = URI.parse(params.source);
    const destination = URI.parse(params.destination);
    await this._gate(identity, source, AgentHostPermissionMode.Write, { channel: ROOT_STATE_URI, uri: source.toString(), write: true });
    await this._gate(identity, destination, AgentHostPermissionMode.Write, { channel: ROOT_STATE_URI, uri: destination.toString(), write: true });
    await this._fileService.move(source, destination, !params.failIfExists);
  }
  async copy(identity, params) {
    const source = URI.parse(params.source);
    const destination = URI.parse(params.destination);
    await this._gate(identity, source, AgentHostPermissionMode.Read, { channel: ROOT_STATE_URI, uri: source.toString(), read: true });
    await this._gate(identity, destination, AgentHostPermissionMode.Write, { channel: ROOT_STATE_URI, uri: destination.toString(), write: true });
    await this._fileService.copy(source, destination, !params.failIfExists);
  }
  async resolve(identity, params) {
    const uri = URI.parse(params.uri);
    await this._gate(identity, uri, AgentHostPermissionMode.Read, { channel: ROOT_STATE_URI, uri: uri.toString(), read: true });
    let stat;
    try {
      stat = await this._fileService.stat(uri);
    } catch (err) {
      const virtual = await this._statVirtual(uri);
      if (virtual) {
        return virtual;
      }
      throw err;
    }
    let type;
    if (stat.isSymbolicLink && params.followSymlinks === false) {
      type = ResourceType.Symlink;
    } else if (stat.isDirectory) {
      type = ResourceType.Directory;
    } else {
      type = ResourceType.File;
    }
    return {
      uri: uri.toString(),
      type,
      ...stat.size !== void 0 ? { size: stat.size } : {},
      ...stat.mtime !== void 0 ? { mtime: new Date(stat.mtime).toISOString() } : {},
      ...stat.ctime !== void 0 ? { ctime: new Date(stat.ctime).toISOString() } : {},
      ...stat.etag ? { etag: stat.etag } : {}
    };
  }
  async mkdir(identity, params) {
    const uri = URI.parse(params.uri);
    await this._gate(identity, uri, AgentHostPermissionMode.Write, { channel: ROOT_STATE_URI, uri: uri.toString(), write: true });
    const existing = await this._fileService.stat(uri).catch(() => void 0);
    if (existing && !existing.isDirectory) {
      throw new Error(`Path exists and is not a directory: ${uri.toString()}`);
    }
    await this._fileService.createFolder(uri);
  }
  // ---- Permission requests / observables ---------------------------------
  async check(identity, uri, mode) {
    const normalized = normalizeResourceIdentity(identity);
    const canonical = await this._canonicalize(uri);
    return this._isCovered(normalized, canonical, mode);
  }
  async request(identity, params) {
    const normalized = normalizeResourceIdentity(identity);
    const canonical = await this._canonicalize(URI.parse(params.uri));
    if (normalized === LOCAL_AGENT_HOST_RESOURCE_IDENTITY) {
      return;
    }
    const wantsWrite = params.write === true;
    const wantsRead = params.read === true || !wantsWrite;
    if (wantsRead && !await this._isCovered(normalized, canonical, AgentHostPermissionMode.Read)) {
      await this._enqueue(normalized, canonical, AgentHostPermissionMode.Read);
    }
    if (wantsWrite && !await this._isCovered(normalized, canonical, AgentHostPermissionMode.Write)) {
      await this._enqueue(normalized, canonical, AgentHostPermissionMode.Write);
    }
  }
  pendingFor(address) {
    const normalized = normalizeRemoteAgentHostAddress(address);
    return derived((reader) => this._pending.read(reader).filter((r) => r.address === normalized));
  }
  findPending(id) {
    return this._pending.get().find((r) => r.id === id);
  }
  grantImplicitRead(identity, uri) {
    const handle = generateUuid();
    const lexical = extUri.normalizePath(uri);
    const realpath = this._fileService.realpath(lexical).then(
      (real) => real ?? lexical,
      () => lexical
    );
    this._inMemoryGrants.set(handle, {
      identity: normalizeResourceIdentity(identity),
      realpath,
      mode: AgentHostAccessMode.Read
    });
    return toDisposable(() => this._inMemoryGrants.delete(handle));
  }
  connectionClosed(identity) {
    const normalized = normalizeResourceIdentity(identity);
    for (const [handle, grant] of this._inMemoryGrants) {
      if (grant.identity === normalized) {
        this._inMemoryGrants.delete(handle);
      }
    }
    if (normalized === LOCAL_AGENT_HOST_RESOURCE_IDENTITY) {
      return;
    }
    const cancel = new CancellationError();
    const remaining = [];
    for (const request of this._pending.get()) {
      if (request.address === normalized) {
        request.deferred.error(cancel);
      } else {
        remaining.push(request);
      }
    }
    if (remaining.length !== this._pending.get().length) {
      this._pending.set(remaining, void 0);
    }
  }
  // ---- internals ---------------------------------------------------------
  async _gate(identity, uri, mode, deniedRequest) {
    if (!await this.check(identity, uri, mode)) {
      throw new AgentHostResourcePermissionError(deniedRequest);
    }
  }
  async _readVirtual(uri) {
    try {
      const ref = await this._textModelService.createModelReference(uri);
      try {
        return VSBuffer.fromString(ref.object.textEditorModel.getValue());
      } finally {
        ref.dispose();
      }
    } catch {
      return void 0;
    }
  }
  /**
   * Write {@link bytes} as text into the resolved text model for {@link uri},
   * if one can be resolved and is writable. Returns `true` when the model was
   * updated, `false` otherwise (no provider, readonly, decode failure).
   */
  async _writeVirtual(uri, bytes) {
    try {
      const ref = await this._textModelService.createModelReference(uri);
      try {
        if (ref.object.isReadonly()) {
          return false;
        }
        ref.object.textEditorModel.setValue(bytes.toString());
        return true;
      } finally {
        ref.dispose();
      }
    } catch {
      return false;
    }
  }
  /**
   * Resolve {@link uri} via {@link ITextModelService} and synthesize a
   * {@link ResourceResolveResult} so virtual resources stat as `File` with
   * a size matching their text content. Returns `undefined` if no model
   * can be resolved.
   */
  async _statVirtual(uri) {
    try {
      const ref = await this._textModelService.createModelReference(uri);
      try {
        const size = VSBuffer.fromString(ref.object.textEditorModel.getValue()).byteLength;
        return {
          uri: uri.toString(),
          type: ResourceType.File,
          size
        };
      } finally {
        ref.dispose();
      }
    } catch {
      return void 0;
    }
  }
  /**
   * Resolve {@link uri} against the local filesystem, collapsing `..`
   * segments and following symlinks so the policy check sees the same
   * path the OS will actually open. For URIs that don't exist (e.g. a
   * `resourceWrite` for a new file), realpath the deepest existing
   * ancestor and re-append the leaf.
   */
  async _canonicalize(uri) {
    const normalized = extUri.normalizePath(uri);
    const real = await this._fileService.realpath(normalized).catch(() => void 0);
    if (real) {
      return real;
    }
    const parent = extUri.dirname(normalized);
    if (extUri.isEqual(parent, normalized)) {
      return normalized;
    }
    const realParent = await this._fileService.realpath(parent).catch(() => void 0);
    return realParent ? extUri.joinPath(realParent, extUri.basename(normalized)) : normalized;
  }
  async _isCovered(identity, canonicalUri, mode) {
    if (identity === LOCAL_AGENT_HOST_RESOURCE_IDENTITY) {
      return true;
    }
    const requireWrite = mode === AgentHostPermissionMode.Write;
    for (const grant of this._readPersistedGrants(identity)) {
      if (requireWrite && grant.mode !== AgentHostAccessMode.ReadWrite) {
        continue;
      }
      if (extUri.isEqualOrParent(canonicalUri, grant.uri)) {
        return true;
      }
    }
    const candidates = [];
    for (const grant of this._inMemoryGrants.values()) {
      if (grant.identity !== identity) {
        continue;
      }
      if (requireWrite && grant.mode !== AgentHostAccessMode.ReadWrite) {
        continue;
      }
      candidates.push(grant.realpath);
    }
    const realpaths = await Promise.all(candidates);
    return realpaths.some((uri) => extUri.isEqualOrParent(canonicalUri, uri));
  }
  _enqueue(address, canonicalUri, mode) {
    const existing = this._pending.get().find((r) => r.address === address && r.mode === mode && extUri.isEqual(r.uri, canonicalUri));
    if (existing) {
      return existing.deferred.p;
    }
    const deferred = new DeferredPromise();
    const request = {
      id: generateUuid(),
      address,
      uri: canonicalUri,
      mode,
      deferred,
      allow: () => this._resolve(request, "memory"),
      allowAlways: () => this._resolve(request, "persist"),
      deny: () => {
        this._dropPending(request);
        deferred.error(new CancellationError());
      }
    };
    this._pending.set([...this._pending.get(), request], void 0);
    return deferred.p;
  }
  _resolve(request, scope) {
    const accessMode = request.mode === AgentHostPermissionMode.Write ? AgentHostAccessMode.ReadWrite : AgentHostAccessMode.Read;
    this._inMemoryGrants.set(generateUuid(), {
      identity: request.address,
      realpath: Promise.resolve(request.uri),
      mode: accessMode
    });
    if (scope === "persist") {
      void this._persistGrant(request.address, request.uri, request.mode).catch((err) => {
        this._logService.warn("[AgentHostResourceService] Failed to persist grant", err);
      });
    }
    this._dropPending(request);
    request.deferred.complete();
  }
  _dropPending(request) {
    const next = this._pending.get().filter((r) => r !== request);
    if (next.length !== this._pending.get().length) {
      this._pending.set(next, void 0);
    }
  }
  *_readPersistedGrants(address) {
    const forAddress = this._configurationService.getValue(AgentHostLocalFilePermissionsSettingId)?.[address];
    if (!forAddress) {
      return;
    }
    for (const [uriStr, mode] of Object.entries(forAddress)) {
      if (mode !== AgentHostAccessMode.Read && mode !== AgentHostAccessMode.ReadWrite) {
        continue;
      }
      try {
        yield { uri: URI.parse(uriStr), mode };
      } catch {
      }
    }
  }
  async _persistGrant(address, uri, mode) {
    const requested = mode === AgentHostPermissionMode.Write ? AgentHostAccessMode.ReadWrite : AgentHostAccessMode.Read;
    for (const grant of this._readPersistedGrants(address)) {
      const covers = grant.mode === AgentHostAccessMode.ReadWrite || requested === AgentHostAccessMode.Read;
      if (covers && extUri.isEqualOrParent(uri, grant.uri)) {
        return;
      }
    }
    const { target, value } = this._inspectScopedSetting();
    const forAddress = { ...value[address] ?? {} };
    const uriKey = uri.toString();
    if (forAddress[uriKey] === AgentHostAccessMode.ReadWrite) {
      return;
    }
    forAddress[uriKey] = requested;
    await this._configurationService.updateValue(
      AgentHostLocalFilePermissionsSettingId,
      { ...value, [address]: forAddress },
      target
    );
  }
  _inspectScopedSetting() {
    const inspected = this._configurationService.inspect(AgentHostLocalFilePermissionsSettingId);
    if (inspected.applicationValue !== void 0) {
      return { target: ConfigurationTarget.APPLICATION, value: inspected.applicationValue };
    }
    if (inspected.userLocalValue !== void 0) {
      return { target: ConfigurationTarget.USER_LOCAL, value: inspected.userLocalValue };
    }
    if (inspected.userRemoteValue !== void 0) {
      return { target: ConfigurationTarget.USER_REMOTE, value: inspected.userRemoteValue };
    }
    if (inspected.userValue !== void 0) {
      return { target: ConfigurationTarget.USER, value: inspected.userValue };
    }
    return { target: ConfigurationTarget.APPLICATION, value: {} };
  }
};
AgentHostResourceService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ILogService)
], AgentHostResourceService);
registerSingleton(IAgentHostResourceService, AgentHostResourceService, InstantiationType.Delayed);
export {
  AgentHostResourceService
};
