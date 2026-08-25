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
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { parse as parseJSONC } from "../../../../../base/common/json.js";
import { untildify } from "../../../../../base/common/labels.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { equals } from "../../../../../base/common/objects.js";
import { autorun, derived, derivedOpts, observableFromEvent, ObservablePromise, observableSignal, observableValue, transaction } from "../../../../../base/common/observable.js";
import {
  posix,
  win32
} from "../../../../../base/common/path.js";
import {
  basename,
  isEqual,
  isEqualOrParent,
  joinPath
} from "../../../../../base/common/resources.js";
import { hasKey } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, getConfigValueInTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { localize } from "../../../../../nls.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import {
  resolvePluginComponentDirs,
  getPluginManifestComponent,
  readPluginSkills,
  readMarkdownComponents,
  readPluginManifest,
  readPluginMcpServers,
  parseMcpServerDefinitionMap,
  detectPluginFormat
} from "../../../../../platform/agentPlugins/common/pluginParsers.js";
import { Extensions } from "../../../../services/extensionManagement/common/extensionFeatures.js";
import * as extensionsRegistry from "../../../../services/extensions/common/extensionsRegistry.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { ChatConfiguration } from "../constants.js";
import { ContributionEnablementState, EnablementModel } from "../enablement.js";
import { HookType } from "../promptSyntax/hookTypes.js";
import { AgentPluginCollisionEnablementModel, getAgentPluginPolicyId, getCanonicalAgentPluginCollisionGroups, getSortedAgentPlugins, isAgentPluginBlockedByPolicy } from "./agentPluginEnablement.js";
import { IAgentPluginRepositoryService } from "./agentPluginRepositoryService.js";
import { agentPluginDiscoveryRegistry } from "./agentPluginService.js";
import { IPluginMarketplaceService } from "./pluginMarketplaceService.js";
import { shellQuotePluginRootInCommand, resolveMcpServersMap, convertBareEnvVarsToVsCodeSyntax } from "../../../../../platform/agentPlugins/common/pluginParsers.js";
function toAgentPluginHooks(groups) {
  return groups.filter((g) => Object.values(HookType).includes(g.type)).map((g) => ({
    type: g.type,
    hooks: g.commands,
    uri: g.uri,
    originalId: g.originalId
  }));
}
const RULE_FILE_SUFFIXES = [".instructions.md", ".mdc", ".md"];
function resolveWorkspaceRoot(pluginUri, workspaceContextService) {
  const defaultFolder = workspaceContextService.getWorkspace().folders[0];
  const folder = workspaceContextService.getWorkspaceFolder(pluginUri) ?? defaultFolder;
  return folder?.uri;
}
let AgentPluginService = class extends Disposable {
  constructor(instantiationService, configurationService, storageService, logService) {
    super();
    const baseEnablementModel = this._register(new EnablementModel("agentPlugins.enablement", storageService));
    const pluginsEnabled = observableConfigValue(ChatConfiguration.PluginsEnabled, true, configurationService);
    const discoveries = [];
    for (const registration of agentPluginDiscoveryRegistry.getAll()) {
      const discovery = instantiationService.createInstance(registration.descriptor);
      this._register(discovery);
      discoveries.push({ discovery, priority: registration.priority, order: registration.order });
    }
    const enabledPluginsPolicy = observableFromEvent(
      this,
      Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(ChatConfiguration.EnabledPlugins)),
      () => configurationService.inspect(ChatConfiguration.EnabledPlugins).policyValue
    );
    const collisionGroups = derived((reader) => {
      if (!pluginsEnabled.read(reader)) {
        return /* @__PURE__ */ new Map();
      }
      const discoveredPlugins = readDiscoveredAgentPlugins(discoveries, reader);
      if (!discoveredPlugins) {
        return /* @__PURE__ */ new Map();
      }
      const policy = enabledPluginsPolicy.read(reader);
      return getCanonicalAgentPluginCollisionGroups(discoveredPlugins, (plugin) => isAgentPluginBlockedByPolicy(plugin, policy));
    });
    this.enablementModel = new AgentPluginCollisionEnablementModel(baseEnablementModel, collisionGroups);
    for (const { discovery } of discoveries) {
      discovery.start(this.enablementModel);
    }
    this.plugins = derived((read) => {
      if (!pluginsEnabled.read(read)) {
        return [];
      }
      const discoveredPlugins = readDiscoveredAgentPlugins(discoveries, read);
      if (!discoveredPlugins) {
        return [];
      }
      return getSortedAgentPlugins(discoveredPlugins);
    });
    this._register(autorun((reader) => {
      const plugins = this.plugins.read(reader);
      const policy = enabledPluginsPolicy.read(reader);
      transaction((tx) => {
        for (const plugin of plugins) {
          const blocked = isAgentPluginBlockedByPolicy(plugin, policy);
          if (setPolicyBlocked(plugin, blocked, tx) && blocked) {
            logService.debug(`[AgentPluginService] Plugin '${getAgentPluginPolicyId(plugin) ?? plugin.uri.toString()}' blocked \u2014 disabled by ChatEnabledPlugins policy`);
          }
        }
      });
    }));
  }
};
AgentPluginService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ILogService)
], AgentPluginService);
function readDiscoveredAgentPlugins(discoveries, reader) {
  const result = [];
  for (const { discovery, priority, order } of discoveries) {
    const plugins = discovery.plugins.read(reader);
    if (!plugins) {
      return void 0;
    }
    result.push({ plugins, priority, order });
  }
  return result;
}
function setPolicyBlocked(plugin, blocked, tx) {
  const obs = plugin.policyBlocked;
  if (obs && typeof obs.set === "function") {
    if (obs.get() === blocked) {
      return false;
    }
    obs.set(blocked, tx);
    return true;
  }
  return false;
}
class AbstractAgentPluginDiscovery extends Disposable {
  constructor(_fileService, _pathService, _logService, _workspaceContextService) {
    super();
    this._fileService = _fileService;
    this._pathService = _pathService;
    this._logService = _logService;
    this._workspaceContextService = _workspaceContextService;
    this._pluginEntries = /* @__PURE__ */ new Map();
    this._plugins = observableValue("discoveredAgentPlugins", void 0);
    this.plugins = this._plugins;
    this._discoverVersion = 0;
  }
  async _refreshPlugins() {
    const version = ++this._discoverVersion;
    const plugins = await this._discoverAndBuildPlugins(version);
    if (!this._isCurrentRefresh(version)) {
      return;
    }
    this._plugins.set(plugins, void 0);
  }
  async _discoverAndBuildPlugins(version) {
    const sources = await this._discoverPluginSources();
    if (!this._isCurrentRefresh(version)) {
      return [];
    }
    const plugins = [];
    const seenPluginUris = /* @__PURE__ */ new Set();
    const attemptedPluginUris = /* @__PURE__ */ new Set();
    for (const source of sources) {
      const key = source.uri.toString();
      if (!attemptedPluginUris.has(key)) {
        attemptedPluginUris.add(key);
        try {
          const format = await detectPluginFormat(source.uri, this._fileService);
          if (!this._isCurrentRefresh(version)) {
            return [];
          }
          const plugin = await this._toPlugin(source.uri, format, source.fromMarketplace, source.repositoryUri, source.remove, version);
          seenPluginUris.add(key);
          plugins.push(plugin);
        } catch (error) {
          this._logService.warn(`[AgentPluginDiscovery] Rejected plugin '${source.uri.toString()}': ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    if (this._isCurrentRefresh(version)) {
      this._disposePluginEntriesExcept(seenPluginUris);
    }
    plugins.sort((a, b) => a.uri.toString().localeCompare(b.uri.toString()));
    return plugins;
  }
  _isCurrentRefresh(version) {
    return version === this._discoverVersion && !this._store.isDisposed;
  }
  async _pathExists(resource) {
    try {
      await this._fileService.resolve(resource);
      return true;
    } catch {
      return false;
    }
  }
  async _toPlugin(uri, format, fromMarketplace, repositoryUri, removeCallback, version) {
    const key = uri.toString();
    const existing = this._pluginEntries.get(key);
    if (existing) {
      if (!this._isCurrentRefresh(version)) {
        return existing.plugin;
      }
      if (existing.format.format !== format.format) {
        existing.store.dispose();
        this._pluginEntries.delete(key);
      } else {
        existing.plugin.remove = removeCallback;
        return existing.plugin;
      }
    }
    const store = new DisposableStore();
    const policyBlocked = observableValue("policyBlocked", false);
    const enablement = derived((r) => policyBlocked.read(r) ? ContributionEnablementState.DisabledProfile : this._enablementModel.readEnabled(key, r));
    const initialManifest = await readPluginManifest(uri, format, this._fileService);
    const manifest = observableValue("agentPluginManifest", initialManifest);
    const observeComponent = (prop, doRead, tryReadEmbedded, defaultPath = prop) => {
      const secondObs = derivedOpts({ equalsFn: equals }, (reader) => getPluginManifestComponent(format, prop, manifest.read(reader)));
      const wrapped = derived((reader) => {
        if (format.requiresManifest && !manifest.read(reader)) {
          return { kind: "dirs", dirs: [] };
        }
        const section = secondObs.read(reader);
        if (tryReadEmbedded) {
          if (section && typeof section === "object" && !Array.isArray(section) && !hasKey(section, { paths: true })) {
            return { kind: "const", data: new ObservablePromise(tryReadEmbedded(section)) };
          }
        }
        const dirs = resolvePluginComponentDirs(uri, format, prop, defaultPath, section, repositoryUri);
        for (const d of dirs) {
          const watcher = this._fileService.createWatcher(d, { recursive: false, excludes: [] });
          reader.store.add(watcher);
          reader.store.add(watcher.onDidChange(() => changeTrigger.trigger(void 0)));
        }
        return { kind: "dirs", dirs };
      });
      const changeTrigger = observableSignal("fileChange");
      const promised = derived((reader) => {
        const w = wrapped.read(reader);
        if (w.kind === "const") {
          return w.data.promiseResult;
        } else {
          changeTrigger.read(reader);
          const promise = new ObservablePromise(doRead(w.dirs));
          return promise.promiseResult;
        }
      });
      const result = promised.map((w, r) => w.read(r)?.data ?? Iterable.empty());
      return result.recomputeInitiallyAndOnChange(store);
    };
    const manifestUri = joinPath(uri, format.manifestPath);
    const commands = observeComponent("commands", (d) => readMarkdownComponents(d, this._fileService));
    const skills = observeComponent("skills", (d) => readPluginSkills(uri, d, format, this._fileService));
    const agents = observeComponent("agents", (d) => readMarkdownComponents(d, this._fileService));
    const instructions = observeComponent("rules", (d) => this._readRules(d));
    const hooks = observeComponent(
      "hooks",
      (paths) => this._readHooksFromPaths(uri, paths, format),
      async (section) => {
        const userHome = await this._pathService.userHome();
        const workspaceRoot = resolveWorkspaceRoot(uri, this._workspaceContextService);
        return toAgentPluginHooks(format.parseHooks(manifestUri, section, uri, workspaceRoot, userHome));
      },
      format.hookConfigPath
    );
    const mcpServerDefinitions = observeComponent(
      "mcpServers",
      (paths) => readPluginMcpServers(uri, paths, format, this._fileService),
      async (section) => parseMcpServerDefinitionMap(manifestUri, { mcpServers: section }, uri.fsPath, format),
      ".mcp.json"
    );
    const readManifest = async () => {
      try {
        const latestFormat = await detectPluginFormat(uri, this._fileService);
        if (latestFormat.format !== format.format) {
          await this._refreshPlugins();
          return;
        }
        manifest.set(await readPluginManifest(uri, format, this._fileService), void 0);
      } catch (error) {
        manifest.set(void 0, void 0);
        this._logService.warn(`[AgentPluginDiscovery] Rejected updated plugin '${uri.toString()}': ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    const agentManifestUri = joinPath(uri, "plugin.json");
    const rootWatcher = this._fileService.createWatcher(uri, { recursive: false, excludes: [] });
    store.add(rootWatcher);
    store.add(rootWatcher.onDidChange((change) => {
      if (change.affects(agentManifestUri)) {
        void readManifest();
      }
    }));
    store.add(this._fileService.onDidRunOperation((event) => {
      if (isEqual(event.resource, agentManifestUri)) {
        void readManifest();
      }
    }));
    if (!isEqual(manifestUri, agentManifestUri)) {
      const manifestWatcher = this._fileService.createWatcher(manifestUri, { recursive: false, excludes: [] });
      store.add(manifestWatcher);
      store.add(manifestWatcher.onDidChange(() => readManifest()));
    }
    const manifestName = typeof initialManifest?.name === "string" && initialManifest.name.trim() ? initialManifest.name.trim() : void 0;
    const plugin = {
      uri,
      format: format.format,
      label: fromMarketplace?.name ?? manifestName ?? basename(uri),
      enablement,
      policyBlocked,
      remove: removeCallback,
      hooks,
      commands,
      skills,
      agents,
      instructions,
      mcpServerDefinitions,
      fromMarketplace
    };
    if (this._isCurrentRefresh(version)) {
      this._pluginEntries.set(key, { store, plugin, format });
    } else {
      store.dispose();
    }
    return plugin;
  }
  /**
   * Reads hook definitions from a list of resolved paths (JSON files).
   * Each path is tried in order; the first one that contains valid hook
   * JSON is used.
   */
  async _readHooksFromPaths(pluginUri, paths, format) {
    const userHome = await this._pathService.userHome();
    const workspaceRoot = resolveWorkspaceRoot(pluginUri, this._workspaceContextService);
    for (const hookPath of paths) {
      const json = await this._readJsonFile(hookPath);
      if (json) {
        try {
          return toAgentPluginHooks(format.parseHooks(hookPath, json, pluginUri, workspaceRoot, userHome));
        } catch (e) {
          this._logService.info(`[AgentPluginDiscovery] Failed to parse hooks from ${hookPath.toString()}:`, e);
        }
      }
    }
    return [];
  }
  async _readJsonFile(uri) {
    try {
      const fileContents = await this._fileService.readFile(uri);
      return parseJSONC(fileContents.value.toString());
    } catch {
      return void 0;
    }
  }
  /**
   * Scans directories for rule/instruction files (`.mdc`, `.md`,
   * `.instructions.md`), returning `{ uri, name }` entries where name is
   * derived from the filename minus the matched suffix.
   */
  async _readRules(dirs) {
    const seen = /* @__PURE__ */ new Set();
    const items = [];
    const matchSuffix = (filename) => {
      const lower = filename.toLowerCase();
      return RULE_FILE_SUFFIXES.find((s) => lower.endsWith(s));
    };
    const addItem = (name, uri) => {
      if (!seen.has(name)) {
        seen.add(name);
        items.push({ uri, name });
      }
    };
    for (const dir of dirs) {
      let stat;
      try {
        stat = await this._fileService.resolve(dir);
      } catch {
        continue;
      }
      if (stat.isFile) {
        const suffix = matchSuffix(basename(dir));
        if (suffix) {
          addItem(basename(dir).slice(0, -suffix.length), dir);
        }
        continue;
      }
      if (!stat.isDirectory || !stat.children) {
        continue;
      }
      for (const child of stat.children) {
        if (!child.isFile) {
          continue;
        }
        const suffix = matchSuffix(child.name);
        if (suffix) {
          addItem(child.name.slice(0, -suffix.length), child.resource);
        }
      }
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }
  _disposePluginEntriesExcept(keep) {
    for (const [key, entry] of this._pluginEntries) {
      if (!keep.has(key)) {
        entry.store.dispose();
        this._pluginEntries.delete(key);
      }
    }
  }
  dispose() {
    this._disposePluginEntriesExcept(/* @__PURE__ */ new Set());
    super.dispose();
  }
}
let ConfiguredAgentPluginDiscovery = class extends AbstractAgentPluginDiscovery {
  constructor(_configurationService, fileService, _pluginMarketplaceService, workspaceContextService, pathService, logService) {
    super(fileService, pathService, logService, workspaceContextService);
    this._configurationService = _configurationService;
    this._pluginMarketplaceService = _pluginMarketplaceService;
    this._pluginLocationsConfig = observableConfigValue(ChatConfiguration.PluginLocations, {}, _configurationService);
    this._enterpriseEnabledPluginsConfig = observableFromEvent(
      this,
      Event.filter(this._configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(ChatConfiguration.EnabledPlugins)),
      () => {
        const inspected = this._configurationService.inspect(ChatConfiguration.EnabledPlugins);
        return { ...inspected.defaultValue, ...inspected.userValue, ...inspected.policyValue };
      }
    );
  }
  start(enablementModel) {
    this._enablementModel = enablementModel;
    const scheduler = this._register(new RunOnceScheduler(() => this._refreshPlugins(), 0));
    this._register(autorun((reader) => {
      this._pluginLocationsConfig.read(reader);
      this._enterpriseEnabledPluginsConfig.read(reader);
      scheduler.schedule();
    }));
    scheduler.schedule();
  }
  async _discoverPluginSources() {
    const sources = [];
    const userHome = await this._getUserHome();
    for (const [key, enabled] of Object.entries(this._pluginLocationsConfig.get())) {
      const trimmed = key.trim();
      if (!trimmed || enabled === false) {
        continue;
      }
      for (const resource of this._resolvePluginPath(trimmed, userHome)) {
        await this._addPluginSource(sources, resource, "plugin path", () => this._removePluginPath(key));
      }
    }
    for (const [key, enabled] of Object.entries(this._enterpriseEnabledPluginsConfig.get())) {
      const trimmed = key.trim();
      if (!trimmed || enabled === false) {
        continue;
      }
      const resource = this._resolveEnterprisePluginId(trimmed, userHome);
      if (!resource) {
        this._logService.debug(`[ConfiguredAgentPluginDiscovery] Skipping enterprise plugin entry that is not in <plugin>@<marketplace> form: ${trimmed}`);
        continue;
      }
      await this._addPluginSource(sources, resource, "enterprise plugin path");
    }
    return sources;
  }
  async _addPluginSource(sources, resource, label, remove) {
    let stat;
    try {
      stat = await this._fileService.resolve(resource);
    } catch {
      this._logService.debug(`[ConfiguredAgentPluginDiscovery] Could not resolve ${label}: ${resource.toString()}`);
      return;
    }
    if (!stat.isDirectory) {
      this._logService.debug(`[ConfiguredAgentPluginDiscovery] ${label} is not a directory: ${resource.toString()}`);
      return;
    }
    sources.push({
      uri: stat.resource,
      fromMarketplace: this._pluginMarketplaceService.getMarketplacePluginMetadata(stat.resource),
      remove
    });
  }
  async _getUserHome() {
    const userHome = await this._pathService.userHome();
    return userHome.scheme === "file" ? userHome.fsPath : userHome.path;
  }
  /**
   * Resolves a user-configured plugin path to one or more resource URIs.
   * Supports absolute paths, tilde paths (expanded to user home), and
   * workspace-relative paths.
   */
  _resolvePluginPath(path, userHome) {
    if (path.startsWith("~")) {
      path = untildify(path, userHome);
    }
    if (win32.isAbsolute(path) || posix.isAbsolute(path)) {
      return [URI.file(path)];
    }
    return this._workspaceContextService.getWorkspace().folders.map(
      (folder) => joinPath(folder.uri, path)
    );
  }
  /**
   * Resolves an enterprise plugin ID of the form `<plugin>@<marketplace>` to
   * the Copilot CLI install convention `~/.copilot/installed-plugins/<marketplace>/<plugin>/`.
   * Returns `undefined` for anything that doesn't match the ID shape.
   */
  _resolveEnterprisePluginId(id, userHome) {
    const idMatch = id.match(/^([^@/\\~]+)@([^@/\\~]+)$/);
    if (!idMatch) {
      return void 0;
    }
    const [, plugin, marketplace] = idMatch;
    return URI.file(`${userHome}/.copilot/installed-plugins/${marketplace}/${plugin}`);
  }
  /**
   * Removes a plugin path from `chat.pluginLocations` in the most specific
   * config target where the key is defined.
   */
  _removePluginPath(configKey) {
    const inspected = this._configurationService.inspect(ChatConfiguration.PluginLocations);
    const targets = [
      ConfigurationTarget.WORKSPACE_FOLDER,
      ConfigurationTarget.WORKSPACE,
      ConfigurationTarget.USER_LOCAL,
      ConfigurationTarget.USER_REMOTE,
      ConfigurationTarget.USER,
      ConfigurationTarget.APPLICATION
    ];
    for (const target of targets) {
      const mapping = getConfigValueInTarget(inspected, target);
      if (mapping && Object.prototype.hasOwnProperty.call(mapping, configKey)) {
        const updated = { ...mapping };
        delete updated[configKey];
        this._configurationService.updateValue(
          ChatConfiguration.PluginLocations,
          updated,
          target
        );
        return;
      }
    }
  }
};
ConfiguredAgentPluginDiscovery = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IPluginMarketplaceService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IPathService),
  __decorateParam(5, ILogService)
], ConfiguredAgentPluginDiscovery);
let MarketplaceAgentPluginDiscovery = class extends AbstractAgentPluginDiscovery {
  constructor(_pluginMarketplaceService, _pluginRepositoryService, fileService, pathService, logService, workspaceContextService) {
    super(fileService, pathService, logService, workspaceContextService);
    this._pluginMarketplaceService = _pluginMarketplaceService;
    this._pluginRepositoryService = _pluginRepositoryService;
  }
  start(enablementModel) {
    this._enablementModel = enablementModel;
    const scheduler = this._register(new RunOnceScheduler(() => this._refreshPlugins(), 0));
    this._register(autorun((reader) => {
      this._pluginMarketplaceService.installedPlugins.read(reader);
      scheduler.schedule();
    }));
    scheduler.schedule();
  }
  async _discoverPluginSources() {
    const installed = this._pluginMarketplaceService.installedPlugins.get();
    const sources = [];
    for (const entry of installed) {
      let stat;
      try {
        stat = await this._fileService.resolve(entry.pluginUri);
      } catch {
        this._logService.debug(`[MarketplaceAgentPluginDiscovery] Could not resolve installed plugin: ${entry.pluginUri.toString()}`);
        continue;
      }
      if (!stat.isDirectory) {
        this._logService.debug(`[MarketplaceAgentPluginDiscovery] Installed plugin path is not a directory: ${entry.pluginUri.toString()}`);
        continue;
      }
      const repositoryUri = this._pluginRepositoryService.getRepositoryUri(entry.plugin.marketplaceReference, entry.plugin.marketplaceType);
      sources.push({
        uri: stat.resource,
        fromMarketplace: entry.plugin,
        repositoryUri,
        remove: () => {
          this._enablementModel.remove(stat.resource.toString());
          this._pluginMarketplaceService.removeInstalledPlugin(entry.pluginUri);
          const remaining = this._pluginMarketplaceService.installedPlugins.get();
          this._pluginRepositoryService.cleanupPluginSource(
            entry.plugin,
            remaining.map((e) => e.plugin.sourceDescriptor)
          ).catch((error) => {
            this._logService.error("[MarketplaceAgentPluginDiscovery] Failed to clean up plugin source", error);
          });
        }
      });
    }
    return sources;
  }
};
MarketplaceAgentPluginDiscovery = __decorateClass([
  __decorateParam(0, IPluginMarketplaceService),
  __decorateParam(1, IAgentPluginRepositoryService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IPathService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IWorkspaceContextService)
], MarketplaceAgentPluginDiscovery);
const COPILOT_CLI_INSTALLED_PLUGINS_DIR = ".copilot/installed-plugins";
let CopilotCliAgentPluginDiscovery = class extends AbstractAgentPluginDiscovery {
  constructor(fileService, pathService, logService, workspaceContextService, _dialogService) {
    super(fileService, pathService, logService, workspaceContextService);
    this._dialogService = _dialogService;
  }
  start(enablementModel) {
    this._enablementModel = enablementModel;
    const scheduler = this._register(new RunOnceScheduler(() => this._refreshPlugins(), 0));
    const watcherStore = this._register(new DisposableStore());
    const setupWatchers = async () => {
      watcherStore.clear();
      if (this._store.isDisposed) {
        return;
      }
      const root = await this._getInstalledPluginsDir();
      const dirsToWatch = [];
      let candidate = root;
      while (candidate) {
        dirsToWatch.unshift(candidate);
        const parent = joinPath(candidate, "..");
        if (parent.toString() === candidate.toString()) {
          break;
        }
        if (await this._pathExists(parent)) {
          dirsToWatch.unshift(parent);
          break;
        }
        candidate = parent;
      }
      for (const dir of dirsToWatch) {
        if (!await this._pathExists(dir)) {
          continue;
        }
        const watcher = this._fileService.createWatcher(dir, { recursive: false, excludes: [] });
        watcherStore.add(watcher);
        watcherStore.add(watcher.onDidChange(() => {
          scheduler.schedule();
          setupWatchers().catch(() => {
          });
        }));
      }
      let rootStat;
      try {
        rootStat = await this._fileService.resolve(root);
      } catch {
        return;
      }
      if (!rootStat.children) {
        return;
      }
      for (const marketplaceDir of rootStat.children) {
        if (!marketplaceDir.isDirectory) {
          continue;
        }
        const watcher = this._fileService.createWatcher(marketplaceDir.resource, { recursive: false, excludes: [] });
        watcherStore.add(watcher);
        watcherStore.add(watcher.onDidChange(() => scheduler.schedule()));
      }
    };
    setupWatchers().catch(() => {
    });
    scheduler.schedule();
  }
  async _getInstalledPluginsDir() {
    const userHome = await this._pathService.userHome();
    return joinPath(userHome, COPILOT_CLI_INSTALLED_PLUGINS_DIR);
  }
  async _discoverPluginSources() {
    const root = await this._getInstalledPluginsDir();
    let rootStat;
    try {
      rootStat = await this._fileService.resolve(root);
    } catch {
      return [];
    }
    if (!rootStat.isDirectory || !rootStat.children) {
      return [];
    }
    const sources = [];
    for (const marketplaceDir of rootStat.children) {
      if (!marketplaceDir.isDirectory) {
        continue;
      }
      let marketplaceStat;
      try {
        marketplaceStat = await this._fileService.resolve(marketplaceDir.resource);
      } catch {
        continue;
      }
      if (!marketplaceStat.children) {
        continue;
      }
      for (const pluginDir of marketplaceStat.children) {
        if (!pluginDir.isDirectory) {
          continue;
        }
        sources.push({
          uri: pluginDir.resource,
          fromMarketplace: void 0,
          remove: () => this._promptRemove(pluginDir.resource)
        });
      }
    }
    return sources;
  }
  async _promptRemove(resource) {
    const { confirmed } = await this._dialogService.confirm({
      message: localize("copilotCliPlugin.remove.confirm", "This plugin was installed by the Copilot CLI. Remove it from disk?"),
      detail: localize("copilotCliPlugin.remove.detail", "The plugin directory '{0}' will be moved to the trash. You can reinstall it later via the Copilot CLI.", resource.fsPath),
      primaryButton: localize("copilotCliPlugin.remove.primary", "Remove")
    });
    if (!confirmed) {
      return;
    }
    try {
      await this._fileService.del(resource, { recursive: true, useTrash: true });
      this._enablementModel.remove(resource.toString());
    } catch (error) {
      this._logService.error("[CopilotCliAgentPluginDiscovery] Failed to remove plugin", error);
    }
  }
};
CopilotCliAgentPluginDiscovery = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IPathService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IDialogService)
], CopilotCliAgentPluginDiscovery);
const epPlugins = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "chatPlugins",
  jsonSchema: {
    description: localize("chatPlugins.schema.description", "Contributes agent plugins for chat."),
    type: "array",
    items: {
      additionalProperties: false,
      type: "object",
      defaultSnippets: [{
        body: {
          path: "./relative/path/to/plugin/"
        }
      }],
      required: ["path"],
      properties: {
        path: {
          description: localize("chatPlugins.property.path", "Path to the agent plugin root directory relative to the extension root."),
          type: "string"
        },
        when: {
          description: localize("chatPlugins.property.when", "(Optional) A condition which must be true to enable this plugin."),
          type: "string"
        }
      }
    }
  }
});
let ExtensionAgentPluginDiscovery = class extends AbstractAgentPluginDiscovery {
  constructor(_commandService, _contextKeyService, _dialogService, fileService, pathService, logService, workspaceContextService) {
    super(fileService, pathService, logService, workspaceContextService);
    this._commandService = _commandService;
    this._contextKeyService = _contextKeyService;
    this._dialogService = _dialogService;
    this._extensionPlugins = /* @__PURE__ */ new Map();
    this._whenKeys = /* @__PURE__ */ new Set();
  }
  start(enablementModel) {
    this._enablementModel = enablementModel;
    const scheduler = this._register(new RunOnceScheduler(() => this._refreshPlugins(), 0));
    this._register(this._contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(this._whenKeys)) {
        scheduler.schedule();
      }
    }));
    epPlugins.setHandler((_extensions, delta) => {
      for (const ext of delta.added) {
        for (const raw of ext.value) {
          if (!raw.path) {
            ext.collector.error(localize("extension.plugin.missing.path", "Extension '{0}' cannot register a chatPlugins entry without a path.", ext.description.identifier.value));
            continue;
          }
          const pluginUri = joinPath(ext.description.extensionLocation, raw.path);
          if (!isEqualOrParent(pluginUri, ext.description.extensionLocation)) {
            ext.collector.error(localize("extension.plugin.invalid.path", "Extension '{0}' chatPlugins entry '{1}' resolves outside the extension.", ext.description.identifier.value, raw.path));
            continue;
          }
          let whenExpr;
          if (raw.when) {
            whenExpr = ContextKeyExpr.deserialize(raw.when);
            if (!whenExpr) {
              ext.collector.error(localize("extension.plugin.invalid.when", "Extension '{0}' chatPlugins entry '{1}' has an invalid when clause: '{2}'.", ext.description.identifier.value, raw.path, raw.when));
              continue;
            }
          }
          this._extensionPlugins.set(extensionPluginKey(ext.description.identifier, raw.path), { uri: pluginUri, when: whenExpr, extensionId: ext.description.identifier.value });
        }
      }
      for (const ext of delta.removed) {
        for (const raw of ext.value) {
          this._extensionPlugins.delete(extensionPluginKey(ext.description.identifier, raw.path));
        }
      }
      this._rebuildWhenKeys();
      scheduler.schedule();
    });
    scheduler.schedule();
  }
  _rebuildWhenKeys() {
    this._whenKeys.clear();
    for (const { when } of this._extensionPlugins.values()) {
      if (when) {
        for (const key of when.keys()) {
          this._whenKeys.add(key);
        }
      }
    }
  }
  async _discoverPluginSources() {
    const sources = [];
    for (const [, entry] of this._extensionPlugins) {
      if (entry.when && !this._contextKeyService.contextMatchesRules(entry.when)) {
        continue;
      }
      let stat;
      try {
        stat = await this._fileService.resolve(entry.uri);
      } catch {
        this._logService.debug(`[ExtensionAgentPluginDiscovery] Could not resolve extension plugin path: ${entry.uri.toString()}`);
        continue;
      }
      if (!stat.isDirectory) {
        this._logService.debug(`[ExtensionAgentPluginDiscovery] Extension plugin path is not a directory: ${entry.uri.toString()}`);
        continue;
      }
      sources.push({
        uri: stat.resource,
        fromMarketplace: void 0,
        remove: () => this._promptUninstallExtension(entry.extensionId)
      });
    }
    return sources;
  }
  async _promptUninstallExtension(extensionId) {
    const { confirmed } = await this._dialogService.confirm({
      message: localize("uninstallExtensionForPlugin", "This plugin is provided by the extension '{0}'. Do you want to uninstall the extension?", extensionId)
    });
    if (confirmed) {
      await this._commandService.executeCommand("workbench.extensions.uninstallExtension", extensionId);
    }
  }
};
ExtensionAgentPluginDiscovery = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IPathService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IWorkspaceContextService)
], ExtensionAgentPluginDiscovery);
function extensionPluginKey(extensionId, path) {
  return `${extensionId.value}/${path}`;
}
class ChatPluginsDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.chatPlugins?.length;
  }
  render(manifest) {
    const contributions = manifest.contributes?.chatPlugins ?? [];
    if (!contributions.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("chatPluginsPath", "Path"),
      localize("chatPluginsWhen", "When")
    ];
    const rows = contributions.map((d) => [
      d.path,
      d.when ?? "-"
    ]);
    return {
      data: { headers, rows },
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "chatPlugins",
  label: localize("chatPlugins", "Chat Plugins"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ChatPluginsDataRenderer)
});
export {
  AbstractAgentPluginDiscovery,
  AgentPluginService,
  ConfiguredAgentPluginDiscovery,
  CopilotCliAgentPluginDiscovery,
  ExtensionAgentPluginDiscovery,
  MarketplaceAgentPluginDiscovery,
  convertBareEnvVarsToVsCodeSyntax,
  resolveMcpServersMap,
  shellQuotePluginRootInCommand
};
