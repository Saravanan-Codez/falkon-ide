import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { McpServer } from "./mcpServer.js";
import { McpCapability, McpServerCacheState, McpToolVisibility } from "./mcpTypes.js";
import { startServerAndWaitForLiveTools } from "./mcpTypesUtils.js";
class McpGatewayToolBrokerChannel extends Disposable {
  constructor(_mcpService, _logService, _startupGracePeriodMs = 5e3) {
    super();
    this._mcpService = _mcpService;
    this._logService = _logService;
    this._startupGracePeriodMs = _startupGracePeriodMs;
    this._onDidChangeTools = this._register(new Emitter());
    this._onDidChangeResources = this._register(new Emitter());
    this._onDidChangeServers = this._register(new Emitter());
    /**
     * Per-server promise that races server startup against the grace period timeout.
     * Once set for a server, subsequent list calls await the already-resolved promise
     * and return immediately instead of waiting again.
     *
     * The `resolved` flag tracks whether the promise has settled. If a server's
     * cacheState regresses to Unknown/Outdated after the promise resolved (e.g.
     * after a cache reset), `_waitForStartup` discards the stale entry and creates
     * a fresh race so the server gets another chance to start.
     */
    this._startupGrace = /* @__PURE__ */ new Map();
    this._logService.debug("[McpGateway][ToolBroker] Initialized");
    let toolsInitialized = false;
    this._register(autorun((reader) => {
      for (const server of this._mcpService.servers.read(reader)) {
        server.tools.read(reader);
      }
      if (toolsInitialized) {
        this._logService.debug("[McpGateway][ToolBroker] Tools changed, firing onDidChangeTools");
        this._onDidChangeTools.fire();
      } else {
        toolsInitialized = true;
      }
    }));
    let resourcesInitialized = false;
    this._register(autorun((reader) => {
      for (const server of this._mcpService.servers.read(reader)) {
        server.capabilities.read(reader);
      }
      if (resourcesInitialized) {
        this._logService.debug("[McpGateway][ToolBroker] Resources changed, firing onDidChangeResources");
        this._onDidChangeResources.fire();
      } else {
        resourcesInitialized = true;
      }
    }));
    let serversInitialized = false;
    this._register(autorun((reader) => {
      const servers = this._mcpService.servers.read(reader);
      if (serversInitialized) {
        this._logService.debug("[McpGateway][ToolBroker] Servers changed, firing onDidChangeServers");
        this._onDidChangeServers.fire(servers.map((s) => ({ id: s.definition.id, label: s.definition.label })));
      } else {
        serversInitialized = true;
      }
    }));
  }
  _getServerById(serverId) {
    for (const server of this._mcpService.servers.get()) {
      if (server.definition.id === serverId) {
        return server;
      }
    }
    return void 0;
  }
  _waitForStartup(server) {
    const id = server.definition.id;
    const existing = this._startupGrace.get(id);
    if (existing?.resolved) {
      const state = server.cacheState.get();
      if (state === McpServerCacheState.Unknown || state === McpServerCacheState.Outdated) {
        this._startupGrace.delete(id);
      }
    }
    if (!this._startupGrace.has(id)) {
      const entry = {
        promise: Promise.race([
          this._ensureServerReady(server),
          new Promise((resolve) => setTimeout(() => resolve(false), this._startupGracePeriodMs))
        ]),
        resolved: false
      };
      entry.promise.then(() => {
        entry.resolved = true;
      });
      this._startupGrace.set(id, entry);
    }
    return this._startupGrace.get(id).promise;
  }
  async _shouldUseCachedData(server) {
    const cacheState = server.cacheState.get();
    if (cacheState === McpServerCacheState.Unknown || cacheState === McpServerCacheState.Outdated) {
      await this._waitForStartup(server);
      const newState = server.cacheState.get();
      return newState === McpServerCacheState.Live || newState === McpServerCacheState.Cached || newState === McpServerCacheState.RefreshingFromCached;
    }
    return cacheState === McpServerCacheState.Live || cacheState === McpServerCacheState.Cached || cacheState === McpServerCacheState.RefreshingFromCached;
  }
  listen(_ctx, event) {
    switch (event) {
      case "onDidChangeTools":
        return this._onDidChangeTools.event;
      case "onDidChangeResources":
        return this._onDidChangeResources.event;
      case "onDidChangeServers":
        return this._onDidChangeServers.event;
    }
    throw new Error(`Invalid listen: ${event}`);
  }
  async call(_ctx, command, arg, cancellationToken) {
    this._logService.debug(`[McpGateway][ToolBroker] IPC call: ${command}`);
    switch (command) {
      case "listServers": {
        const servers = this._listServers();
        return servers;
      }
      case "listToolsForServer": {
        const { serverId } = arg;
        const tools = await this._listToolsForServer(serverId);
        return tools;
      }
      case "callToolForServer": {
        const { serverId, name, args, chatSessionResource } = arg;
        const result = await this._callToolForServer(serverId, name, args || {}, chatSessionResource, cancellationToken);
        return result;
      }
      case "listResourcesForServer": {
        const { serverId } = arg;
        const resources = await this._listResourcesForServer(serverId);
        return resources;
      }
      case "readResourceForServer": {
        const { serverId, uri } = arg;
        const result = await this._readResourceForServer(serverId, uri, cancellationToken);
        return result;
      }
      case "listResourceTemplatesForServer": {
        const { serverId } = arg;
        const templates = await this._listResourceTemplatesForServer(serverId);
        return templates;
      }
    }
    throw new Error(`Invalid call: ${command}`);
  }
  _listServers() {
    const servers = this._mcpService.servers.get();
    const result = [];
    for (const server of servers) {
      result.push({ id: server.definition.id, label: server.definition.label });
    }
    this._logService.debug(`[McpGateway][ToolBroker] listServers result: ${result.length} server(s): [${result.map((s) => s.label).join(", ")}]`);
    return result;
  }
  async _listToolsForServer(serverId) {
    const server = this._getServerById(serverId);
    if (!server) {
      this._logService.warn(`[McpGateway][ToolBroker] listToolsForServer: unknown server '${serverId}'`);
      return [];
    }
    if (!await this._shouldUseCachedData(server)) {
      this._logService.debug(`[McpGateway][ToolBroker] Server '${serverId}' not ready, skipping tool listing`);
      return [];
    }
    const tools = server.tools.get().filter((t) => t.visibility & McpToolVisibility.Model).map((t) => t.definition);
    this._logService.debug(`[McpGateway][ToolBroker] listToolsForServer '${serverId}': ${tools.length} tool(s)`);
    return tools;
  }
  async _callToolForServer(serverId, name, args, chatSessionResource, token = CancellationToken.None) {
    this._logService.debug(`[McpGateway][ToolBroker] callToolForServer '${serverId}' tool '${name}' with args: ${JSON.stringify(args)}`);
    const server = this._getServerById(serverId);
    if (!server) {
      throw new Error(`Unknown server: ${serverId}`);
    }
    const tool = server.tools.get().find(
      (t) => t.definition.name === name && t.visibility & McpToolVisibility.Model
    );
    if (!tool) {
      throw new Error(`Unknown tool '${name}' on server '${serverId}'`);
    }
    const context = chatSessionResource ? { chatSessionResource: URI.parse(chatSessionResource) } : void 0;
    const result = await tool.call(args, context, token);
    this._logService.debug(`[McpGateway][ToolBroker] Tool '${name}' on '${serverId}' completed (isError=${result.isError ?? false}, content blocks=${result.content.length})`);
    return result;
  }
  async _listResourcesForServer(serverId) {
    const server = this._getServerById(serverId);
    if (!server) {
      this._logService.warn(`[McpGateway][ToolBroker] listResourcesForServer: unknown server '${serverId}'`);
      return [];
    }
    if (!await this._shouldUseCachedData(server)) {
      return [];
    }
    const capabilities = server.capabilities.get();
    if (!capabilities || !(capabilities & McpCapability.Resources)) {
      this._logService.debug(`[McpGateway][ToolBroker] Server '${serverId}' has no resource capability`);
      return [];
    }
    try {
      const resources = await McpServer.callOn(server, (h) => h.listResources());
      this._logService.debug(`[McpGateway][ToolBroker] Server '${serverId}' listed ${resources.length} resource(s)`);
      return resources;
    } catch (error) {
      this._logService.warn(`[McpGateway][ToolBroker] Server '${serverId}' failed to list resources`, error);
      return [];
    }
  }
  async _readResourceForServer(serverId, uri, token = CancellationToken.None) {
    const server = this._getServerById(serverId);
    if (!server) {
      throw new Error(`Unknown server: ${serverId}`);
    }
    this._logService.debug(`[McpGateway][ToolBroker] readResourceForServer '${uri}' from server '${serverId}'`);
    const result = await McpServer.callOn(server, (h) => h.readResource({ uri }, token), token);
    this._logService.debug(`[McpGateway][ToolBroker] readResourceForServer returned ${result.contents.length} content(s)`);
    return result;
  }
  async _listResourceTemplatesForServer(serverId) {
    const server = this._getServerById(serverId);
    if (!server) {
      this._logService.warn(`[McpGateway][ToolBroker] listResourceTemplatesForServer: unknown server '${serverId}'`);
      return [];
    }
    if (!await this._shouldUseCachedData(server)) {
      return [];
    }
    const capabilities = server.capabilities.get();
    if (!capabilities || !(capabilities & McpCapability.Resources)) {
      return [];
    }
    try {
      const resourceTemplates = await McpServer.callOn(server, (h) => h.listResourceTemplates());
      this._logService.debug(`[McpGateway][ToolBroker] Server '${serverId}' listed ${resourceTemplates.length} resource template(s)`);
      return resourceTemplates;
    } catch (error) {
      this._logService.warn(`[McpGateway][ToolBroker] Server '${serverId}' failed to list resource templates`, error);
      return [];
    }
  }
  async _ensureServerReady(server) {
    const cacheState = server.cacheState.get();
    if (cacheState !== McpServerCacheState.Unknown && cacheState !== McpServerCacheState.Outdated) {
      return true;
    }
    this._logService.debug(`[McpGateway][ToolBroker] Server '${server.definition.id}' not ready (cacheState=${cacheState}), starting...`);
    try {
      const ready = await startServerAndWaitForLiveTools(server, {
        promptType: "all-untrusted",
        errorOnUserInteraction: true
      });
      this._logService.debug(`[McpGateway][ToolBroker] Server '${server.definition.id}' ready=${ready}`);
      return ready;
    } catch (error) {
      this._logService.warn(`[McpGateway][ToolBroker] Server '${server.definition.id}' failed to start`, error);
      return false;
    }
  }
}
export {
  McpGatewayToolBrokerChannel
};
