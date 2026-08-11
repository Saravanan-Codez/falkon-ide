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
import { VSBuffer } from "../../../base/common/buffer.js";
import { SequencerByKey } from "../../../base/common/async.js";
import { URI } from "../../../base/common/uri.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { CustomizationLoadStatus } from "../common/state/sessionState.js";
import { toAgentClientUri } from "../common/agentClientUri.js";
const DEFAULT_MAX_PLUGINS = 20;
let AgentPluginManager = class {
  constructor(userDataPath, _fileService, _logService, maxPlugins = DEFAULT_MAX_PLUGINS) {
    this._fileService = _fileService;
    this._logService = _logService;
    /** Serializes concurrent sync operations per plugin URI. */
    this._sequencer = new SequencerByKey();
    /**
     * LRU of synced plugins, most recently used at the end. Each entry records
     * the plugin's original customization URI and the nonce materialized on
     * disk under `{key}/{nonce}`.
     */
    this._lru = [];
    /** Whether the on-disk cache has been loaded. */
    this._cacheLoaded = false;
    this._basePath = URI.joinPath(userDataPath, "agentPlugins");
    this._cachePath = URI.joinPath(this._basePath, "cache.json");
    this._maxPlugins = maxPlugins;
  }
  get basePath() {
    return this._basePath;
  }
  async syncCustomizations(clientId, customizations, progress) {
    await this._ensureCacheLoaded();
    const results = await Promise.all(customizations.map(
      (ref) => this._sequencer.queue(ref.uri, async () => {
        try {
          const pluginDir = await this._syncPlugin(clientId, ref);
          const customization = { ...ref, load: { kind: CustomizationLoadStatus.Loaded } };
          progress?.(customization);
          return { customization, pluginDir };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this._logService.error(`[AgentPluginManager] Failed to sync plugin ${ref.uri}: ${message}`);
          const customization = { ...ref, load: { kind: CustomizationLoadStatus.Error, message } };
          progress?.(customization);
          return { customization };
        }
      })
    ));
    return results;
  }
  // ---- plugin storage logic -----------------------------------------------
  /**
   * Syncs a single plugin to local storage. Each nonce is materialized in its
   * own `{key}/{nonce}` subdirectory; when the same nonce is already present
   * the copy is skipped. After a fresh copy, older nonces of the same plugin
   * are evicted on a best-effort basis (retained in the LRU if still locked).
   * Returns the local directory URI.
   */
  async _syncPlugin(clientId, ref) {
    const pluginUri = toAgentClientUri(URI.parse(ref.uri), clientId);
    const destDir = this._dirFor(ref.uri, ref.nonce);
    if (ref.nonce && this._findEntry(ref.uri, ref.nonce) && await this._fileService.exists(destDir)) {
      this._touchLru(ref.uri, ref.nonce);
      this._logService.trace(`[AgentPluginManager] Nonce match for ${ref.uri}, skipping copy`);
      return destDir;
    }
    this._logService.info(`[AgentPluginManager] Syncing plugin: ${ref.uri} \u2192 ${destDir.toString()}`);
    await this._fileService.copy(pluginUri, destDir, true);
    this._removeEntry(ref.uri, ref.nonce);
    this._lru.push({ uri: ref.uri, nonce: ref.nonce ?? "" });
    await this._cleanupStaleNoncesFor(ref.uri);
    await this._evictIfNeeded();
    await this._persistCache();
    return destDir;
  }
  _keyForUri(uri) {
    return this._sanitize(uri);
  }
  _keyForNonce(nonce) {
    return nonce && this._sanitize(nonce) || "default";
  }
  _sanitize(value) {
    return value.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").substring(0, 128);
  }
  /** Directory in which a specific `(uri, nonce)` revision is materialized. */
  _dirFor(uri, nonce) {
    return URI.joinPath(this._basePath, this._keyForUri(uri), this._keyForNonce(nonce));
  }
  /** Parent directory holding all materialized nonces of a plugin. */
  _pluginRootFor(uri) {
    return URI.joinPath(this._basePath, this._keyForUri(uri));
  }
  _findEntry(uri, nonce) {
    const n = nonce ?? "";
    return this._lru.find((entry) => entry.uri === uri && entry.nonce === n);
  }
  _removeEntry(uri, nonce) {
    const entry = this._findEntry(uri, nonce);
    if (entry) {
      this._removeEntryRef(entry);
    }
  }
  _removeEntryRef(entry) {
    const idx = this._lru.indexOf(entry);
    if (idx !== -1) {
      this._lru.splice(idx, 1);
    }
  }
  _touchLru(uri, nonce) {
    const entry = this._findEntry(uri, nonce);
    if (entry) {
      this._removeEntryRef(entry);
      this._lru.push(entry);
    }
  }
  /** Best-effort recursive delete; returns `true` only when the dir is gone. */
  async _tryDeleteDir(dir) {
    try {
      await this._fileService.del(dir, { recursive: true });
      return true;
    } catch (err) {
      this._logService.warn(`[AgentPluginManager] Failed to remove plugin dir ${dir.toString()}`, err);
      return false;
    }
  }
  /** Attempts to evict older nonces of every tracked plugin. */
  async _cleanupStaleNonces() {
    for (const uri of new Set(this._lru.map((entry) => entry.uri))) {
      await this._cleanupStaleNoncesFor(uri);
    }
  }
  /**
   * Attempts to evict every nonce of {@link uri} except the most recently used
   * one. Entries whose directory cannot be removed are left in the LRU so they
   * can be retried later, once whatever was holding them has released them.
   */
  async _cleanupStaleNoncesFor(uri) {
    const entries = this._lru.filter((entry) => entry.uri === uri);
    const stale = entries.slice(0, -1);
    for (const entry of stale) {
      this._logService.info(`[AgentPluginManager] Evicting stale nonce for plugin: ${uri}`);
      if (await this._tryDeleteDir(this._dirFor(entry.uri, entry.nonce))) {
        this._removeEntryRef(entry);
      }
    }
  }
  async _evictIfNeeded() {
    let i = 0;
    while (this._lru.length > this._maxPlugins && i < this._lru.length) {
      const candidate = this._lru[i];
      this._logService.info(`[AgentPluginManager] Evicting plugin: ${candidate.uri}`);
      if (await this._tryDeleteDir(this._dirFor(candidate.uri, candidate.nonce))) {
        this._lru.splice(i, 1);
        if (!this._lru.some((entry) => entry.uri === candidate.uri)) {
          await this._tryDeleteDir(this._pluginRootFor(candidate.uri));
        }
      } else {
        i++;
      }
    }
  }
  // ---- cache persistence --------------------------------------------------
  async _ensureCacheLoaded() {
    if (this._cacheLoaded) {
      return;
    }
    this._cacheLoaded = true;
    try {
      if (!await this._fileService.exists(this._cachePath)) {
        return;
      }
      const content = await this._fileService.readFile(this._cachePath);
      const entries = JSON.parse(content.value.toString());
      if (!Array.isArray(entries)) {
        return;
      }
      for (const entry of entries) {
        if (typeof entry.uri === "string" && typeof entry.nonce === "string") {
          this._lru.push({ uri: entry.uri, nonce: entry.nonce });
        }
      }
      this._logService.trace(`[AgentPluginManager] Loaded ${entries.length} cache entries from disk`);
    } catch (err) {
      this._logService.warn("[AgentPluginManager] Failed to load cache from disk", err);
    }
    await this._cleanupStaleNonces();
    await this._persistCache();
  }
  async _persistCache() {
    try {
      const entries = this._lru.map((entry) => ({ uri: entry.uri, nonce: entry.nonce }));
      await this._fileService.createFolder(this._basePath);
      await this._fileService.writeFile(this._cachePath, VSBuffer.fromString(JSON.stringify(entries)));
    } catch (err) {
      this._logService.warn("[AgentPluginManager] Failed to persist cache to disk", err);
    }
  }
};
AgentPluginManager = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], AgentPluginManager);
export {
  AgentPluginManager
};
