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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue, transaction } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { mcpAutoStartConfig, McpAutoStartValue } from "../../../../platform/mcp/common/mcpManagement.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { CollisionEnablementModel, EnablementModel, isContributionEnabled } from "../../chat/common/enablement.js";
import { McpCollisionBehavior, mcpServerCollisionBehaviorSection } from "./mcpConfiguration.js";
import { IMcpRegistry } from "./mcpRegistryTypes.js";
import { McpPrefixGenerator, McpServer, McpServerMetadataCache } from "./mcpServer.js";
import { IAutostartResult, McpConnectionState, McpServerCacheState, McpServerDefinition, McpStartServerInteraction, UserInteractionRequiredError } from "./mcpTypes.js";
import { startServerAndWaitForLiveTools } from "./mcpTypesUtils.js";
let McpService = class extends Disposable {
  constructor(_instantiationService, _mcpRegistry, _logService, configurationService, storageService) {
    super();
    this._instantiationService = _instantiationService;
    this._mcpRegistry = _mcpRegistry;
    this._logService = _logService;
    this.configurationService = configurationService;
    this._currentAutoStarts = /* @__PURE__ */ new Set();
    this._servers = observableValue(this, []);
    this.servers = this._servers.map((servers) => servers.map((s) => s.object));
    this._prefixGenerator = new McpPrefixGenerator();
    const baseEnablement = this._register(new EnablementModel("mcp.enablement", storageService));
    const collisionBehavior = observableConfigValue(mcpServerCollisionBehaviorSection, McpCollisionBehavior.Disable, configurationService);
    this.enablementModel = new McpCollisionEnablementModel(baseEnablement, this._mcpRegistry, collisionBehavior);
    this.userCache = this._register(_instantiationService.createInstance(McpServerMetadataCache, StorageScope.PROFILE));
    this.workspaceCache = this._register(_instantiationService.createInstance(McpServerMetadataCache, StorageScope.WORKSPACE));
    const updateThrottle = this._store.add(new RunOnceScheduler(() => this.updateCollectedServers(), 500));
    this._register(autorun((reader) => {
      for (const collection of this._mcpRegistry.collections.read(reader)) {
        collection.serverDefinitions.read(reader);
      }
      updateThrottle.schedule(500);
    }));
  }
  get lazyCollectionState() {
    return this._mcpRegistry.lazyCollectionState;
  }
  cancelAutostart() {
    for (const cts of this._currentAutoStarts) {
      cts.cancel();
    }
  }
  autostart(_token) {
    const autoStartConfig = this.configurationService.getValue(mcpAutoStartConfig);
    if (autoStartConfig === McpAutoStartValue.Never) {
      return observableValue(this, IAutostartResult.Empty);
    }
    const state = observableValue(this, { working: true, starting: [], serversRequiringInteraction: [] });
    const store = new DisposableStore();
    const cts = store.add(new CancellationTokenSource(_token));
    this._currentAutoStarts.add(cts);
    store.add(toDisposable(() => {
      this._currentAutoStarts.delete(cts);
    }));
    store.add(cts.token.onCancellationRequested(() => {
      state.set(IAutostartResult.Empty, void 0);
    }));
    this._autostart(autoStartConfig, state, cts.token).catch((err) => {
      this._logService.error("Error during MCP autostart:", err);
      state.set(IAutostartResult.Empty, void 0);
    }).finally(() => store.dispose());
    return state;
  }
  async _autostart(autoStartConfig, state, token) {
    await this._activateCollections();
    if (token.isCancellationRequested) {
      return;
    }
    const candidates = this.servers.get().filter(
      (s) => s.connectionState.get().state !== McpConnectionState.Kind.Error && isContributionEnabled(s.enablement.get())
    );
    let todo = /* @__PURE__ */ new Set();
    if (autoStartConfig === McpAutoStartValue.OnlyNew) {
      todo = new Set(candidates.filter((s) => s.cacheState.get() === McpServerCacheState.Unknown));
    } else if (autoStartConfig === McpAutoStartValue.NewAndOutdated) {
      todo = new Set(candidates.filter((s) => {
        const c = s.cacheState.get();
        return c === McpServerCacheState.Unknown || c === McpServerCacheState.Outdated;
      }));
    }
    if (!todo.size) {
      state.set(IAutostartResult.Empty, void 0);
      return;
    }
    const interaction = new McpStartServerInteraction();
    const requiringInteraction = [];
    const update = () => state.set({
      working: todo.size > 0,
      starting: [...todo].map((t) => t.definition),
      serversRequiringInteraction: requiringInteraction
    }, void 0);
    update();
    await Promise.all([...todo].map(async (server, i) => {
      try {
        await startServerAndWaitForLiveTools(server, { interaction, errorOnUserInteraction: true }, token);
      } catch (error) {
        if (error instanceof UserInteractionRequiredError) {
          requiringInteraction.push({ id: server.definition.id, label: server.definition.label, errorMessage: error.message });
        }
      } finally {
        todo.delete(server);
        if (!token.isCancellationRequested) {
          update();
        }
      }
    }));
  }
  resetCaches() {
    this.userCache.reset();
    this.workspaceCache.reset();
  }
  resetTrust() {
    this.resetCaches();
  }
  async activateCollections() {
    await this._activateCollections();
  }
  async _activateCollections() {
    const collections = await this._mcpRegistry.discoverCollections();
    this.updateCollectedServers();
    return new Set(collections.map((c) => c.id));
  }
  updateCollectedServers() {
    const definitions = this._mcpRegistry.collections.get().flatMap(
      (collectionDefinition) => collectionDefinition.serverDefinitions.get().map((serverDefinition) => {
        return { serverDefinition, collectionDefinition };
      })
    );
    const nextDefinitions = new Set(definitions);
    const currentServers = this._servers.get();
    const nextServers = [];
    const pushMatch = (match, rec) => {
      nextDefinitions.delete(match);
      nextServers.push(rec);
      const connection = rec.object.connection.get();
      if (connection && !McpServerDefinition.equals(connection.definition, match.serverDefinition)) {
        rec.object.stop();
        this._logService.debug(`MCP server ${rec.object.definition.id} stopped because the definition changed`);
      }
    };
    for (const server of currentServers) {
      const match = definitions.find((d) => defsEqual(server.object, d));
      if (match) {
        pushMatch(match, server);
      } else {
        server.object.dispose();
      }
    }
    for (const def of nextDefinitions) {
      const object = this._instantiationService.createInstance(
        McpServer,
        def.collectionDefinition,
        def.serverDefinition,
        def.serverDefinition.roots,
        !!def.collectionDefinition.lazy,
        def.collectionDefinition.scope === StorageScope.WORKSPACE ? this.workspaceCache : this.userCache,
        this._prefixGenerator,
        this.enablementModel
      );
      nextServers.push({ object });
    }
    transaction((tx) => {
      this._servers.set(nextServers, tx);
    });
  }
  dispose() {
    this._servers.get().forEach((s) => s.object.dispose());
    super.dispose();
  }
};
McpService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, ILogService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IStorageService)
], McpService);
function defsEqual(server, def) {
  return server.collection.id === def.collectionDefinition.id && server.definition.id === def.serverDefinition.id;
}
class McpCollisionEnablementModel extends CollisionEnablementModel {
  /**
   * For each server definition ID, the list of all definition IDs that share
   * the same (case-insensitive) label, in priority order (lowest collection
   * order first). Empty when collision behavior is `suffix`.
   */
  constructor(base, registry, collisionBehavior) {
    const collisionGroups = derived((reader) => {
      if (collisionBehavior.read(reader) !== McpCollisionBehavior.Disable) {
        return /* @__PURE__ */ new Map();
      }
      const collections = registry.collections.read(reader);
      const labelToIds = /* @__PURE__ */ new Map();
      for (const collection of collections) {
        for (const server of collection.serverDefinitions.read(reader)) {
          const key = server.label.toLowerCase();
          let ids = labelToIds.get(key);
          if (!ids) {
            ids = [];
            labelToIds.set(key, ids);
          }
          ids.push(server.id);
        }
      }
      const groups = /* @__PURE__ */ new Map();
      for (const ids of labelToIds.values()) {
        if (ids.length < 2) {
          continue;
        }
        for (const id of ids) {
          groups.set(id, ids);
        }
      }
      return groups;
    });
    super(base, collisionGroups);
  }
}
export {
  McpCollisionEnablementModel,
  McpService
};
