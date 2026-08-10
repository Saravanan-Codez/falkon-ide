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
import { runWhenGlobalIdle } from "../../../../../base/common/async.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { parse as parseJSONC } from "../../../../../base/common/json.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { revive } from "../../../../../base/common/marshalling.js";
import { autorun, derived, observableFromEvent, observableValue } from "../../../../../base/common/observable.js";
import { isEqual, isEqualOrParent, joinPath, normalizePath, relativePath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { observableMemento } from "../../../../../platform/observable/common/observableMemento.js";
import { asJson, IRequestService } from "../../../../../platform/request/common/request.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { AutoUpdateConfigurationKey, IExtensionsWorkbenchService } from "../../../extensions/common/extensions.js";
import { ChatConfiguration } from "../constants.js";
import { IAgentPluginRepositoryService } from "./agentPluginRepositoryService.js";
import { FileBackedInstalledPluginsStore } from "./fileBackedInstalledPluginsStore.js";
import { IWorkspacePluginSettingsService } from "./workspacePluginSettingsService.js";
import { IWorkspaceTrustManagementService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { readAgentPluginManifest } from "../../../../../platform/agentPlugins/common/agentPluginParser.js";
import { deduplicateMarketplaceReferences, MarketplaceReferenceKind, parseMarketplaceObjectEntry, parseMarketplaceReference, parseMarketplaceReferences, readConfiguredMarketplaces } from "./marketplaceReference.js";
import { getStrictKnownMarketplaces, isMarketplaceReferenceAllowed } from "./strictKnownMarketplaces.js";
import { deduplicateMarketplaceReferences as deduplicateMarketplaceReferences2, extraKnownMarketplacesToConfigDict, MarketplaceReferenceKind as MarketplaceReferenceKind2, parseMarketplaceReference as parseMarketplaceReference2, parseMarketplaceReferences as parseMarketplaceReferences2, readConfiguredMarketplaces as readConfiguredMarketplaces2 } from "./marketplaceReference.js";
var MarketplaceType = /* @__PURE__ */ ((MarketplaceType2) => {
  MarketplaceType2["Copilot"] = "copilot";
  MarketplaceType2["Claude"] = "claude";
  MarketplaceType2["OpenPlugin"] = "openPlugin";
  return MarketplaceType2;
})(MarketplaceType || {});
var PluginSourceKind = /* @__PURE__ */ ((PluginSourceKind2) => {
  PluginSourceKind2["RelativePath"] = "relativePath";
  PluginSourceKind2["GitHub"] = "github";
  PluginSourceKind2["GitUrl"] = "url";
  PluginSourceKind2["Npm"] = "npm";
  PluginSourceKind2["Pip"] = "pip";
  return PluginSourceKind2;
})(PluginSourceKind || {});
const IPluginMarketplaceService = createDecorator("pluginMarketplaceService");
const MARKETPLACE_DEFINITIONS = [
  { type: "openPlugin" /* OpenPlugin */, path: "marketplace.json" },
  { type: "openPlugin" /* OpenPlugin */, path: ".plugin/marketplace.json" },
  { type: "copilot" /* Copilot */, path: ".github/plugin/marketplace.json" },
  { type: "claude" /* Claude */, path: ".claude-plugin/marketplace.json" }
];
const SINGLE_PLUGIN_MANIFEST_DEFINITIONS = [
  { type: "openPlugin" /* OpenPlugin */, path: ".plugin/plugin.json" },
  { type: "claude" /* Claude */, path: ".claude-plugin/plugin.json" },
  { type: "copilot" /* Copilot */, path: "plugin.json" }
];
const GITHUB_MARKETPLACE_CACHE_TTL_MS = 8 * 60 * 60 * 1e3;
const GITHUB_MARKETPLACE_CACHE_STORAGE_KEY = "chat.plugins.marketplaces.githubCache.v1";
const PLUGIN_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1e3;
const PLUGIN_UPDATE_LAST_CHECK_STORAGE_KEY = "chat.plugins.lastUpdateCheck.v1";
function ensureSourceDescriptor(plugin) {
  if (plugin.sourceDescriptor) {
    return plugin;
  }
  return {
    ...plugin,
    sourceDescriptor: { kind: "relativePath" /* RelativePath */, path: plugin.source }
  };
}
const trustedMarketplacesMemento = observableMemento({
  defaultValue: [],
  key: "chat.plugins.trustedMarketplaces.v1",
  toStorage: (value) => JSON.stringify(value),
  fromStorage: (value) => {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  }
});
const lastFetchedPluginsMemento = observableMemento({
  defaultValue: { plugins: [], fetchedAt: 0 },
  key: "chat.plugins.lastFetchedPlugins.v2",
  toStorage: (value) => JSON.stringify(value),
  fromStorage: (value) => {
    const parsed = JSON.parse(value);
    if (parsed && Array.isArray(parsed.plugins)) {
      return parsed;
    }
    return { plugins: [], fetchedAt: 0 };
  }
});
let PluginMarketplaceService = class extends Disposable {
  constructor(_configurationService, _requestService, environmentService, _fileService, _pluginRepositoryService, _logService, _storageService, _workspacePluginSettingsService, _workspaceTrustService, _extensionsWorkbenchService) {
    super();
    this._configurationService = _configurationService;
    this._requestService = _requestService;
    this._fileService = _fileService;
    this._pluginRepositoryService = _pluginRepositoryService;
    this._logService = _logService;
    this._storageService = _storageService;
    this._workspacePluginSettingsService = _workspacePluginSettingsService;
    this._workspaceTrustService = _workspaceTrustService;
    this._extensionsWorkbenchService = _extensionsWorkbenchService;
    this._gitHubMarketplaceCache = new Lazy(() => this._loadPersistedGitHubMarketplaceCache());
    this._pluginMetadata = /* @__PURE__ */ new Map();
    this._marketplacesWithUpdates = observableValue("marketplacesWithUpdates", /* @__PURE__ */ new Set());
    this.marketplacesWithUpdates = this._marketplacesWithUpdates;
    const oldCacheRoot = joinPath(environmentService.cacheHome, "agentPlugins");
    this._installedPluginsStore = this._register(
      new FileBackedInstalledPluginsStore(
        _pluginRepositoryService.agentPluginsHome,
        oldCacheRoot,
        _fileService,
        _logService,
        _storageService
      )
    );
    this._trustedMarketplacesStore = this._register(
      trustedMarketplacesMemento(StorageScope.APPLICATION, StorageTarget.MACHINE, _storageService)
    );
    this._lastFetchedPluginsStore = this._register(
      lastFetchedPluginsMemento(StorageScope.APPLICATION, StorageTarget.MACHINE, _storageService)
    );
    this.lastFetchedPlugins = this._lastFetchedPluginsStore.map((s) => {
      const revived = revive(s);
      return revived.plugins.map(ensureSourceDescriptor);
    });
    this.installedPlugins = this._installedPluginsStore.value.map((entries) => {
      const result = [];
      for (const e of entries) {
        const plugin = this._pluginMetadata.get(e.pluginUri.toString());
        if (plugin) {
          result.push({ pluginUri: e.pluginUri, plugin });
        }
      }
      return result;
    });
    const workspaceTrusted = observableFromEvent(this, this._workspaceTrustService.onDidChangeTrust, () => this._workspaceTrustService.isWorkspaceTrusted());
    this.recommendedPlugins = derived((reader) => {
      if (!workspaceTrusted.read(reader)) {
        return /* @__PURE__ */ new Set();
      }
      const enabledMap = this._workspacePluginSettingsService.enabledPlugins.read(reader);
      const keys = /* @__PURE__ */ new Set();
      for (const [key, value] of enabledMap) {
        if (value) {
          keys.add(key);
        }
      }
      return keys;
    });
    this.onDidChangeMarketplaces = Event.any(
      Event.filter(
        _configurationService.onDidChangeConfiguration,
        (e) => e.affectsConfiguration(ChatConfiguration.PluginsEnabled) || e.affectsConfiguration(ChatConfiguration.PluginMarketplaces) || e.affectsConfiguration(ChatConfiguration.ExtraMarketplaces)
      ),
      Event.fromObservableLight(this._workspacePluginSettingsService.extraMarketplaces),
      Event.map(this._workspaceTrustService.onDidChangeTrust, () => {
      })
    );
    this._register(runWhenGlobalIdle(() => {
      this._scheduleUpdateCheck();
      this._register(Event.filter(
        _configurationService.onDidChangeConfiguration,
        (e) => e.affectsConfiguration(AutoUpdateConfigurationKey) || e.affectsConfiguration(ChatConfiguration.ExtraMarketplaces) || e.affectsConfiguration(ChatConfiguration.StrictMarketplaces)
      )(() => {
        this.clearUpdatesAvailable();
        this._scheduleUpdateCheck();
      }));
    }));
    this._register(autorun((reader) => {
      const entries = this._installedPluginsStore.value.read(reader);
      const unhydrated = entries.filter((e) => !this._pluginMetadata.has(e.pluginUri.toString()));
      if (unhydrated.length > 0) {
        this._hydratePluginMetadata(unhydrated);
      }
    }));
  }
  dispose() {
    if (this._updateCheckTimer !== void 0) {
      clearTimeout(this._updateCheckTimer);
      this._updateCheckTimer = void 0;
    }
    super.dispose();
  }
  clearUpdatesAvailable(marketplaceIds) {
    if (!marketplaceIds) {
      this._marketplacesWithUpdates.set(/* @__PURE__ */ new Set(), void 0);
      return;
    }
    const remaining = new Set([...this._marketplacesWithUpdates.get()].filter((id) => !marketplaceIds.has(id)));
    this._marketplacesWithUpdates.set(remaining, void 0);
  }
  async fetchMarketplacePlugins(token, marketplaceIds, options) {
    if (!this._configurationService.getValue(ChatConfiguration.PluginsEnabled)) {
      return [];
    }
    const { effectiveValues } = readConfiguredMarketplaces(this._configurationService);
    const configRefs = parseMarketplaceReferences(effectiveValues);
    let allRefs;
    if (this._workspaceTrustService.isWorkspaceTrusted()) {
      const workspaceEntries = this._workspacePluginSettingsService.extraMarketplaces.get();
      allRefs = deduplicateMarketplaceReferences(workspaceEntries.map((e) => e.reference), configRefs);
    } else {
      allRefs = configRefs;
    }
    for (const value of effectiveValues) {
      const parsed = typeof value === "string" ? parseMarketplaceReference(value) : value && typeof value === "object" ? parseMarketplaceObjectEntry(value) : void 0;
      if (!parsed) {
        this._logService.debug(`[PluginMarketplaceService] Ignoring invalid marketplace entry: ${String(value)}`);
      }
    }
    const refsToFetch = allRefs.filter(
      (ref) => (!marketplaceIds || marketplaceIds.has(ref.canonicalId)) && this._isMarketplaceAllowedByStrictPolicy(ref)
    );
    const results = await Promise.all(
      refsToFetch.map((ref) => {
        if (ref.kind === MarketplaceReferenceKind.GitHubShorthand && ref.githubRepo) {
          return this._fetchFromGitHubRepo(ref, ref.githubRepo, token, options);
        }
        return this._fetchFromClonedRepo(ref, token, options);
      })
    );
    const plugins = results.flat();
    if (token.isCancellationRequested) {
      return plugins;
    }
    const storedPlugins = marketplaceIds ? [...this.lastFetchedPlugins.get().filter((plugin) => !marketplaceIds.has(plugin.marketplaceReference.canonicalId)), ...plugins] : plugins;
    this._lastFetchedPluginsStore.set({ plugins: storedPlugins, fetchedAt: Date.now() }, void 0);
    return plugins;
  }
  async _fetchFromGitHubRepo(reference, repo, token, options) {
    const cache = this._gitHubMarketplaceCache.value;
    const cached = options?.refresh ? void 0 : this._getCachedGitHubMarketplacePlugins(cache, reference.canonicalId);
    if (cached) {
      return cached.map((c) => ({
        ...c,
        marketplace: reference.displayLabel,
        marketplaceReference: reference
      }));
    }
    let repoMayBePrivate = true;
    const plugins = await this._readPluginsFromDefinitions(reference, async (defPath) => {
      if (token.isCancellationRequested) {
        return void 0;
      }
      const ref = encodeURIComponent(reference.ref ?? "main");
      const url = `https://raw.githubusercontent.com/${repo}/${ref}/${defPath}`;
      try {
        const context = await this._requestService.request({ type: "GET", url, callSite: "pluginMarketplaceService.fetchPluginList" }, token);
        const statusCode = context.res.statusCode;
        if (statusCode !== 200) {
          repoMayBePrivate &&= statusCode !== void 0 && statusCode >= 400 && statusCode < 500;
          this._logService.debug(`[PluginMarketplaceService] ${url} returned status ${statusCode}, skipping`);
          return void 0;
        }
        return await asJson(context) ?? void 0;
      } catch (err) {
        this._logService.debug(`[PluginMarketplaceService] Failed to fetch marketplace.json from ${url}:`, err);
        return void 0;
      }
    });
    if (plugins.length > 0) {
      cache.set(reference.canonicalId, {
        plugins,
        expiresAt: Date.now() + GITHUB_MARKETPLACE_CACHE_TTL_MS,
        referenceRawValue: reference.rawValue
      });
      this._savePersistedGitHubMarketplaceCache(cache);
      return plugins;
    }
    if (repoMayBePrivate) {
      this._logService.debug(`[PluginMarketplaceService] ${repo} may be private, attempting clone-based marketplace discovery`);
      if (cache.delete(reference.canonicalId)) {
        this._savePersistedGitHubMarketplaceCache(cache);
      }
      return this._fetchFromClonedRepo(reference, token, options);
    }
    this._logService.debug(`[PluginMarketplaceService] No marketplace.json found in ${repo}`);
    return [];
  }
  _getCachedGitHubMarketplacePlugins(cache, cacheKey) {
    const cached = cache.get(cacheKey);
    if (!cached) {
      return void 0;
    }
    if (cached.expiresAt <= Date.now()) {
      cache.delete(cacheKey);
      this._savePersistedGitHubMarketplaceCache(cache);
      return void 0;
    }
    return [...cached.plugins];
  }
  _loadPersistedGitHubMarketplaceCache() {
    const cache = /* @__PURE__ */ new Map();
    const now = Date.now();
    const stored = this._storageService.getObject(GITHUB_MARKETPLACE_CACHE_STORAGE_KEY, StorageScope.APPLICATION);
    if (!stored) {
      return cache;
    }
    const revived = revive(stored);
    for (const [cacheKey, entry] of Object.entries(revived)) {
      if (!entry || !Array.isArray(entry.plugins) || typeof entry.expiresAt !== "number" || entry.expiresAt <= now || typeof entry.referenceRawValue !== "string") {
        continue;
      }
      const reference = parseMarketplaceReference(entry.referenceRawValue);
      if (!reference) {
        continue;
      }
      const plugins = entry.plugins.map((plugin) => ensureSourceDescriptor({
        ...plugin,
        marketplace: reference.displayLabel,
        marketplaceReference: reference
      }));
      cache.set(cacheKey, {
        plugins,
        expiresAt: entry.expiresAt,
        referenceRawValue: entry.referenceRawValue
      });
    }
    return cache;
  }
  _savePersistedGitHubMarketplaceCache(cache) {
    const serialized = {};
    for (const [cacheKey, entry] of cache) {
      if (!entry.plugins.length || entry.expiresAt <= Date.now()) {
        continue;
      }
      serialized[cacheKey] = {
        expiresAt: entry.expiresAt,
        referenceRawValue: entry.referenceRawValue,
        plugins: entry.plugins
      };
    }
    if (Object.keys(serialized).length === 0) {
      this._storageService.remove(GITHUB_MARKETPLACE_CACHE_STORAGE_KEY, StorageScope.APPLICATION);
      return;
    }
    this._storageService.store(
      GITHUB_MARKETPLACE_CACHE_STORAGE_KEY,
      JSON.stringify(serialized),
      StorageScope.APPLICATION,
      StorageTarget.MACHINE
    );
  }
  getMarketplacePluginMetadata(pluginUri) {
    return this._pluginMetadata.get(pluginUri.toString()) ?? [...this._pluginMetadata.entries()].find(([key]) => isEqualOrParent(pluginUri, URI.parse(key)))?.[1];
  }
  addInstalledPlugin(pluginUri, plugin) {
    this._pluginMetadata.set(pluginUri.toString(), plugin);
    const entry = {
      pluginUri,
      marketplace: plugin.marketplaceReference.rawValue,
      name: plugin.name
    };
    const current = this._installedPluginsStore.get();
    const existing = current.find((e) => isEqual(e.pluginUri, pluginUri));
    if (existing) {
      this._installedPluginsStore.set(current.map((c) => c === existing ? entry : c), void 0);
    } else {
      this._installedPluginsStore.set([...current, entry], void 0);
    }
  }
  removeInstalledPlugin(pluginUri) {
    this._pluginMetadata.delete(pluginUri.toString());
    const current = this._installedPluginsStore.get();
    this._installedPluginsStore.set(current.filter((e) => !isEqual(e.pluginUri, pluginUri)), void 0);
  }
  isMarketplaceTrusted(ref) {
    const allowlist = getStrictKnownMarketplaces(this._configurationService.getValue(ChatConfiguration.StrictMarketplaces));
    if (allowlist !== void 0) {
      return isMarketplaceReferenceAllowed(allowlist, ref);
    }
    return this._trustedMarketplacesStore.get().includes(ref.canonicalId);
  }
  isStrictMarketplacePolicyActive() {
    return getStrictKnownMarketplaces(this._configurationService.getValue(ChatConfiguration.StrictMarketplaces)) !== void 0;
  }
  isMarketplaceAutoUpdateEnabled(ref) {
    const { extraValues } = readConfiguredMarketplaces(this._configurationService);
    const managedRef = parseMarketplaceReferences(extraValues).find((candidate) => candidate.canonicalId === ref.canonicalId);
    return managedRef?.autoUpdate ?? this._extensionsWorkbenchService.getAutoUpdateValue() !== "off";
  }
  _isMarketplaceAllowedByStrictPolicy(ref) {
    return !this.isStrictMarketplacePolicyActive() || this.isMarketplaceTrusted(ref);
  }
  // --- Plugin metadata hydration -----------------------------------------------
  /**
   * Hydrates installed entries from marketplace metadata. Entries written
   * by current builds include the marketplace plugin name, which is enough
   * to re-read the full plugin descriptor from the marketplace source. Old
   * entries without a name fall back to matching by install URI.
   *
   * After hydration completes the installed-plugins store is "touched" so
   * that the derived {@link installedPlugins} observable re-evaluates with
   * the newly available metadata.
   */
  async _hydratePluginMetadata(entries) {
    let hydrated = 0;
    for (const entry of entries) {
      const key = entry.pluginUri.toString();
      if (this._pluginMetadata.has(key)) {
        continue;
      }
      const reference = parseMarketplaceReference(entry.marketplace);
      if (!reference) {
        this._logService.debug(`[PluginMarketplaceService] Cannot parse marketplace reference '${entry.marketplace}' for ${key}`);
        continue;
      }
      try {
        const plugins = await this._readPluginsForInstalledEntry(reference, CancellationToken.None);
        const match = plugins.find((p) => entry.name ? p.name === entry.name : isEqual(this._pluginRepositoryService.getPluginInstallUri(p), entry.pluginUri));
        if (match) {
          this._pluginMetadata.set(key, match);
          hydrated++;
        }
      } catch (err) {
        this._logService.debug(`[PluginMarketplaceService] Failed to hydrate metadata for ${key}:`, err);
      }
    }
    if (hydrated > 0) {
      const current = this._installedPluginsStore.get();
      this._installedPluginsStore.set([...current], void 0);
    }
  }
  async _readPluginsForInstalledEntry(reference, token) {
    if (reference.kind === MarketplaceReferenceKind.GitHubShorthand && reference.githubRepo) {
      return this._fetchFromGitHubRepo(reference, reference.githubRepo, token);
    }
    const repoDir = this._pluginRepositoryService.getRepositoryUri(reference);
    let plugins = await this._readPluginsFromDirectory(repoDir, reference, token);
    if (plugins.length === 0) {
      const single = await this.readSinglePluginManifest(repoDir, reference);
      if (single) {
        plugins = [single];
      }
    }
    return plugins;
  }
  /**
   * Shared logic to parse a marketplace.json into {@link IMarketplacePlugin}
   * objects. Used by both fetch and hydration paths.
   */
  _parseMarketplacePlugins(json, reference, marketplaceType, repoDir) {
    if (!json.plugins || !Array.isArray(json.plugins)) {
      return [];
    }
    return json.plugins.filter(
      (p) => typeof p.name === "string" && !!p.name
    ).flatMap((p) => {
      const sourceDescriptor = parsePluginSource(p.source, json.metadata?.pluginRoot, {
        pluginName: p.name,
        logService: this._logService,
        logPrefix: "[PluginMarketplaceService]"
      });
      if (!sourceDescriptor) {
        return [];
      }
      const source = sourceDescriptor.kind === "relativePath" /* RelativePath */ ? sourceDescriptor.path : "";
      return [{
        name: p.name,
        description: p.description ?? "",
        version: p.version ?? "",
        source,
        sourceDescriptor,
        marketplace: reference.displayLabel,
        marketplaceReference: reference,
        marketplaceType,
        readmeUri: repoDir ? getMarketplaceReadmeFileUri(repoDir, source) : getMarketplaceReadmeUri(reference.githubRepo ?? "", source)
      }];
    });
  }
  trustMarketplace(ref) {
    const current = this._trustedMarketplacesStore.get();
    if (!current.includes(ref.canonicalId)) {
      this._trustedMarketplacesStore.set([...current, ref.canonicalId], void 0);
    }
  }
  // --- Periodic update check ------------------------------------------------
  _hasAutoUpdateEnabledMarketplace() {
    if (this._extensionsWorkbenchService.getAutoUpdateValue() !== "off") {
      return true;
    }
    const { extraValues } = readConfiguredMarketplaces(this._configurationService);
    return parseMarketplaceReferences(extraValues).some((ref) => ref.autoUpdate === true);
  }
  /**
   * (Re-)schedules the next periodic update check. Called on
   * construction and whenever the auto-update config changes.
   */
  _scheduleUpdateCheck() {
    if (this._updateCheckTimer !== void 0) {
      clearTimeout(this._updateCheckTimer);
      this._updateCheckTimer = void 0;
    }
    if (!this._hasAutoUpdateEnabledMarketplace()) {
      return;
    }
    const lastCheck = this._storageService.getNumber(
      PLUGIN_UPDATE_LAST_CHECK_STORAGE_KEY,
      StorageScope.APPLICATION,
      0
    );
    const elapsed = Date.now() - lastCheck;
    const delay = Math.max(0, PLUGIN_UPDATE_CHECK_INTERVAL_MS - elapsed);
    this._updateCheckTimer = setTimeout(() => this._runUpdateCheck(), delay);
  }
  async _runUpdateCheck() {
    this._updateCheckTimer = void 0;
    try {
      const installed = this.installedPlugins.get();
      if (installed.length === 0) {
        return;
      }
      const seenMarketplaces = /* @__PURE__ */ new Set();
      const marketplacesWithUpdates = /* @__PURE__ */ new Set();
      for (const entry of installed) {
        const ref = entry.plugin.marketplaceReference;
        if (seenMarketplaces.has(ref.canonicalId) || !this.isMarketplaceAutoUpdateEnabled(ref) || !this._isMarketplaceAllowedByStrictPolicy(ref)) {
          continue;
        }
        seenMarketplaces.add(ref.canonicalId);
        try {
          const behind = await this._pluginRepositoryService.fetchRepository(ref);
          if (behind) {
            marketplacesWithUpdates.add(ref.canonicalId);
          }
        } catch (err) {
          this._logService.debug(`[PluginMarketplaceService] Update check failed for ${ref.displayLabel}:`, err);
        }
      }
      this._marketplacesWithUpdates.set(marketplacesWithUpdates, void 0);
      this._storageService.store(
        PLUGIN_UPDATE_LAST_CHECK_STORAGE_KEY,
        Date.now(),
        StorageScope.APPLICATION,
        StorageTarget.MACHINE
      );
    } catch (err) {
      this._logService.debug("[PluginMarketplaceService] Periodic update check failed:", err);
    } finally {
      if (this._hasAutoUpdateEnabledMarketplace()) {
        this._updateCheckTimer = setTimeout(() => this._runUpdateCheck(), PLUGIN_UPDATE_CHECK_INTERVAL_MS);
      }
    }
  }
  async _fetchFromClonedRepo(reference, token, options) {
    let repoDir;
    try {
      repoDir = await this._pluginRepositoryService.ensureRepository(reference, {
        refreshIfOlderThanMs: options?.refresh ? 0 : GITHUB_MARKETPLACE_CACHE_TTL_MS,
        token
      });
    } catch (err) {
      this._logService.debug(`[PluginMarketplaceService] Failed to prepare marketplace repository ${reference.rawValue}:`, err);
      options?.onMarketplaceError?.(reference, err);
      return [];
    }
    return this._readPluginsFromDirectory(repoDir, reference, token);
  }
  async readPluginsFromDirectory(repoDir, reference) {
    return this._readPluginsFromDirectory(repoDir, reference);
  }
  async readSinglePluginManifest(repoDir, reference) {
    if (reference.kind !== MarketplaceReferenceKind.GitHubShorthand && reference.kind !== MarketplaceReferenceKind.GitUri) {
      return void 0;
    }
    const sourceDescriptor = reference.kind === MarketplaceReferenceKind.GitHubShorthand ? { kind: "github" /* GitHub */, repo: reference.githubRepo } : { kind: "url" /* GitUrl */, url: reference.cloneUrl };
    const agentManifest = await readAgentPluginManifest(repoDir, this._fileService);
    if (agentManifest) {
      return {
        name: agentManifest.name ?? reference.displayLabel,
        description: agentManifest.description ?? "",
        version: agentManifest.version ?? "",
        source: "",
        sourceDescriptor,
        marketplace: reference.displayLabel,
        marketplaceReference: reference,
        marketplaceType: "openPlugin" /* OpenPlugin */
      };
    }
    for (const def of SINGLE_PLUGIN_MANIFEST_DEFINITIONS) {
      const manifestUri = joinPath(repoDir, def.path);
      let manifest;
      try {
        const contents = await this._fileService.readFile(manifestUri);
        const parsed = parseJSONC(contents.value.toString());
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          manifest = parsed;
        }
      } catch {
        continue;
      }
      if (!manifest) {
        continue;
      }
      const manifestName = typeof manifest["name"] === "string" && manifest["name"] ? manifest["name"] : reference.displayLabel;
      const manifestDescription = typeof manifest["description"] === "string" ? manifest["description"] : "";
      const manifestVersion = typeof manifest["version"] === "string" ? manifest["version"] : "";
      return {
        name: manifestName,
        description: manifestDescription,
        version: manifestVersion,
        source: "",
        sourceDescriptor,
        marketplace: reference.displayLabel,
        marketplaceReference: reference,
        marketplaceType: def.type
      };
    }
    this._logService.debug(`[PluginMarketplaceService] No single-plugin manifest found in ${reference.rawValue}`);
    return void 0;
  }
  async isPluginDirectory(repoDir) {
    if (await readAgentPluginManifest(repoDir, this._fileService)) {
      return true;
    }
    for (const def of SINGLE_PLUGIN_MANIFEST_DEFINITIONS) {
      if (await this._fileService.exists(joinPath(repoDir, def.path))) {
        return true;
      }
    }
    return false;
  }
  async _readPluginsFromDirectory(repoDir, reference, token) {
    return this._readPluginsFromDefinitions(reference, async (defPath) => {
      if (token?.isCancellationRequested) {
        return void 0;
      }
      const definitionUri = joinPath(repoDir, defPath);
      try {
        const contents = await this._fileService.readFile(definitionUri);
        return parseJSONC(contents.value.toString());
      } catch {
        return void 0;
      }
    }, repoDir);
  }
  /**
   * Iterates over {@link MARKETPLACE_DEFINITIONS} paths, calling
   * {@link readJson} for each to obtain the parsed JSON. Returns the
   * plugins from the first definition that yields a valid result.
   */
  async _readPluginsFromDefinitions(reference, readJson, repoDir) {
    for (const def of MARKETPLACE_DEFINITIONS) {
      const json = await readJson(def.path);
      if (!json?.plugins || !Array.isArray(json.plugins)) {
        continue;
      }
      return this._parseMarketplacePlugins(json, reference, def.type, repoDir);
    }
    this._logService.debug(`[PluginMarketplaceService] No marketplace.json found in ${reference.rawValue}`);
    return [];
  }
};
PluginMarketplaceService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IAgentPluginRepositoryService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IWorkspacePluginSettingsService),
  __decorateParam(8, IWorkspaceTrustManagementService),
  __decorateParam(9, IExtensionsWorkbenchService)
], PluginMarketplaceService);
function normalizeMarketplacePath(value) {
  let normalized = value.trim().replace(/\\/g, "/");
  normalized = normalized.replace(/^\.?\/+/, "").replace(/\/+$/g, "");
  return normalized;
}
function resolvePluginSource(pluginRoot, source) {
  const normalizedRoot = pluginRoot ? normalizeMarketplacePath(pluginRoot) : "";
  const normalizedSource = normalizeMarketplacePath(source);
  const repoRoot = URI.file("/");
  const pluginRootUri = normalizedRoot ? normalizePath(joinPath(repoRoot, normalizedRoot)) : repoRoot;
  if (normalizedRoot && (normalizedSource === normalizedRoot || normalizedSource.startsWith(`${normalizedRoot}/`))) {
    return normalizedSource;
  }
  const resolvedUri = normalizePath(joinPath(pluginRootUri, normalizedSource));
  return relativePath(repoRoot, resolvedUri) ?? void 0;
}
function parsePluginSource(rawSource, pluginRoot, logContext) {
  if (rawSource === void 0 || rawSource === null) {
    const resolved = resolvePluginSource(pluginRoot, "");
    if (resolved === void 0) {
      return void 0;
    }
    return { kind: "relativePath" /* RelativePath */, path: resolved };
  }
  if (typeof rawSource === "string") {
    const resolved = resolvePluginSource(pluginRoot, rawSource);
    if (resolved === void 0) {
      return void 0;
    }
    return { kind: "relativePath" /* RelativePath */, path: resolved };
  }
  if (typeof rawSource !== "object" || typeof rawSource.source !== "string") {
    logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': source object is missing a 'source' discriminant`);
    return void 0;
  }
  switch (rawSource.source) {
    case "github": {
      if (typeof rawSource.repo !== "string" || !rawSource.repo) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': github source is missing required 'repo' field`);
        return void 0;
      }
      if (!isValidGitHubRepo(rawSource.repo)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': github source repo must be in 'owner/repo' format`);
        return void 0;
      }
      if (!isOptionalString(rawSource.ref)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': github source 'ref' must be a string when provided`);
        return void 0;
      }
      if (!isOptionalGitSha(rawSource.sha)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': github source 'sha' must be a full 40-character commit hash when provided`);
        return void 0;
      }
      if (!isOptionalString(rawSource.path)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': github source 'path' must be a string when provided`);
        return void 0;
      }
      return {
        kind: "github" /* GitHub */,
        repo: rawSource.repo,
        ref: rawSource.ref,
        sha: rawSource.sha,
        path: rawSource.path
      };
    }
    case "url":
    case "git-subdir": {
      if (typeof rawSource.url !== "string" || !rawSource.url) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': ${rawSource.source} source is missing required 'url' field`);
        return void 0;
      }
      if (rawSource.source === "url" && !rawSource.url.toLowerCase().endsWith(".git")) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': url source must end with '.git'`);
        return void 0;
      }
      if (!isOptionalString(rawSource.ref)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': ${rawSource.source} source 'ref' must be a string when provided`);
        return void 0;
      }
      if (!isOptionalGitSha(rawSource.sha)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': ${rawSource.source} source 'sha' must be a full 40-character commit hash when provided`);
        return void 0;
      }
      if (rawSource.source === "git-subdir") {
        if (typeof rawSource.path !== "string" || !rawSource.path) {
          logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': git-subdir source is missing required 'path' field`);
          return void 0;
        }
      } else if (!isOptionalString(rawSource.path)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': url source 'path' must be a string when provided`);
        return void 0;
      }
      return {
        kind: "url" /* GitUrl */,
        url: rawSource.url,
        ref: rawSource.ref,
        sha: rawSource.sha,
        path: rawSource.path
      };
    }
    case "npm": {
      if (typeof rawSource.package !== "string" || !rawSource.package) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': npm source is missing required 'package' field`);
        return void 0;
      }
      if (!isOptionalString(rawSource.version) || !isOptionalString(rawSource.registry)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': npm source 'version' and 'registry' must be strings when provided`);
        return void 0;
      }
      return {
        kind: "npm" /* Npm */,
        package: rawSource.package,
        version: rawSource.version,
        registry: rawSource.registry
      };
    }
    case "pip": {
      if (typeof rawSource.package !== "string" || !rawSource.package) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': pip source is missing required 'package' field`);
        return void 0;
      }
      if (!isOptionalString(rawSource.version) || !isOptionalString(rawSource.registry)) {
        logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': pip source 'version' and 'registry' must be strings when provided`);
        return void 0;
      }
      return {
        kind: "pip" /* Pip */,
        package: rawSource.package,
        version: rawSource.version,
        registry: rawSource.registry
      };
    }
    default:
      logContext.logService.warn(`${logContext.logPrefix} Skipping plugin '${logContext.pluginName}': unknown source kind '${rawSource.source}'`);
      return void 0;
  }
}
function isOptionalString(value) {
  return value === void 0 || typeof value === "string";
}
function isOptionalGitSha(value) {
  return value === void 0 || typeof value === "string" && /^[0-9a-fA-F]{40}$/.test(value);
}
function isValidGitHubRepo(repo) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}
function getPluginSourceLabel(descriptor) {
  switch (descriptor.kind) {
    case "relativePath" /* RelativePath */:
      return descriptor.path || ".";
    case "github" /* GitHub */:
      return descriptor.path ? `${descriptor.repo}/${descriptor.path}` : descriptor.repo;
    case "url" /* GitUrl */:
      return descriptor.path ? `${descriptor.url}/${descriptor.path}` : descriptor.url;
    case "npm" /* Npm */:
      return descriptor.version ? `${descriptor.package}@${descriptor.version}` : descriptor.package;
    case "pip" /* Pip */:
      return descriptor.version ? `${descriptor.package}==${descriptor.version}` : descriptor.package;
  }
}
function hasSourceChanged(installed, marketplace) {
  if (installed.kind !== marketplace.kind) {
    return true;
  }
  switch (installed.kind) {
    case "github" /* GitHub */:
      return installed.ref !== marketplace.ref || installed.sha !== marketplace.sha || installed.path !== marketplace.path;
    case "url" /* GitUrl */:
      return installed.ref !== marketplace.ref || installed.sha !== marketplace.sha || installed.path !== marketplace.path;
    case "npm" /* Npm */:
      return installed.version !== marketplace.version;
    case "pip" /* Pip */:
      return installed.version !== marketplace.version;
    default:
      return false;
  }
}
function getMarketplaceReadmeUri(repo, source) {
  const normalizedSource = source.trim().replace(/^\.?\/+|\/+$/g, "");
  const readmePath = normalizedSource ? `${normalizedSource}/README.md` : "README.md";
  return URI.parse(`https://github.com/${repo}/blob/main/${readmePath}`);
}
function getMarketplaceReadmeFileUri(repoDir, source) {
  const normalizedSource = source.trim().replace(/^\.?\/+|\/+$/g, "");
  return normalizedSource ? joinPath(repoDir, normalizedSource, "README.md") : joinPath(repoDir, "README.md");
}
export {
  IPluginMarketplaceService,
  MarketplaceReferenceKind2 as MarketplaceReferenceKind,
  MarketplaceType,
  PluginMarketplaceService,
  PluginSourceKind,
  deduplicateMarketplaceReferences2 as deduplicateMarketplaceReferences,
  extraKnownMarketplacesToConfigDict,
  getPluginSourceLabel,
  hasSourceChanged,
  parseMarketplaceReference2 as parseMarketplaceReference,
  parseMarketplaceReferences2 as parseMarketplaceReferences,
  parsePluginSource,
  readConfiguredMarketplaces2 as readConfiguredMarketplaces
};
