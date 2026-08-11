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
import { URI } from "../../../../../../base/common/uri.js";
import { extUriBiasedIgnorePathCase } from "../../../../../../base/common/resources.js";
import { compare } from "../../../../../../base/common/strings.js";
import { Emitter, Event } from "../../../../../../base/common/event.js";
import { Disposable, DisposableResourceMap, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { NKeyMap, ResourceSet } from "../../../../../../base/common/map.js";
import { StringSHA1 } from "../../../../../../base/common/hash.js";
import { AgentHostMcpServersConfigKey } from "../../../../../../platform/agentHost/common/agentHostSchema.js";
import { IAgentHostConnectionsService } from "../../../../../../platform/agentHost/common/agentHostConnectionsService.js";
import { getEffectiveAgents } from "../../../../../../platform/agentHost/common/customAgents.js";
import { ActionType } from "../../../../../../platform/agentHost/common/state/protocol/actions.js";
import { CustomizationType, McpServerStatus } from "../../../../../../platform/agentHost/common/state/protocol/state.js";
import { ROOT_STATE_URI, StateComponents } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILoggerService, ILogService } from "../../../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { ContributionEnablementState, EnablementModel, isContributionEnabled } from "../../../common/enablement.js";
import { localize } from "../../../../../../nls.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { isUntitledChatSession } from "../../../common/model/chatUri.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentHostUntitledProvisionalSessionService.js";
import { resolveMcpServerAuthentication, agentHostMcpServerId } from "./agentHostAuth.js";
import { IOutputService } from "../../../../../services/output/common/output.js";
const MCP_SERVER_ENABLEMENT_STORAGE_KEY = "chat.agentHost.mcpServerEnablement";
const IAgentHostCustomizationService = createDecorator("agentHostCustomizationService");
class NullAgentHostCustomizationService {
  constructor() {
    this.onDidChangeCustomAgents = Event.None;
    this.onDidChangeCustomizations = Event.None;
  }
  getCustomAgents(_sessionResource) {
    return [];
  }
  getCustomizations(_sessionResource) {
    return [];
  }
  getWorkingDirectory(sessionResource) {
    return void 0;
  }
  getWorkingDirectories(_sessionResource) {
    return [];
  }
  getMcpServers(_sessionResource) {
    return [];
  }
  addMcpServer(_sessionResource, _name, _config) {
  }
  authenticateMcpServer(_sessionResource, _serverId) {
    return Promise.resolve(false);
  }
  getMcpServerEnablement(_sessionResource, _serverName, _reader) {
    return ContributionEnablementState.EnabledProfile;
  }
  setMcpServerEnablement(_sessionResource, _serverName, _state) {
  }
  prepareMcpServersForTurn(_sessionResource) {
  }
  async showMcpServerLog(_sessionResource, _serverId, beforeShow) {
    await beforeShow?.();
  }
}
class AbstractAgentHostCustomizationService extends Disposable {
  constructor(_instantiationService, _logService, storageService) {
    super();
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._onDidChangeCustomAgents = this._register(new Emitter());
    this._onDidChangeCustomizations = this._register(new Emitter());
    this.onDidChangeCustomAgents = this._onDidChangeCustomAgents.event;
    this.onDidChangeCustomizations = this._onDidChangeCustomizations.event;
    this._mcpServerTracking = new NKeyMap();
    /**
     * Sessions whose MCP diagnostics we mirror into per-server Output channels.
     * A session is tracked once the user reveals a server's output; from then
     * on every state change is recorded via {@link onDidChangeCustomizations},
     * so subsequent failures and recoveries land in the channel history.
     */
    this._mcpDiagnosticSessions = new ResourceSet();
    this._mcpEnablementModel = this._register(new EnablementModel(MCP_SERVER_ENABLEMENT_STORAGE_KEY, storageService));
    this._mcpLogRegistry = this._register(this._instantiationService.createInstance(AgentHostMcpServerLogRegistry));
    this._register(this.onDidChangeCustomizations(() => this._recordMcpDiagnostics()));
  }
  getCustomAgents(sessionResource) {
    return getEffectiveAgents(this._resolveTarget(sessionResource)?.customizations);
  }
  getCustomizations(sessionResource) {
    return this._resolveTarget(sessionResource)?.customizations ?? [];
  }
  getWorkingDirectory(sessionResource) {
    return this._resolveTarget(sessionResource)?.workingDirectory;
  }
  getWorkingDirectories(sessionResource) {
    return this._resolveTarget(sessionResource)?.workingDirectories ?? [];
  }
  getMcpServers(sessionResource) {
    const target = this._resolveTarget(sessionResource);
    if (!target) {
      return [];
    }
    return this._flattenMcpServers(target.customizations).map((c) => ({
      id: this._scopedMcpServerId(sessionResource, c.id),
      name: c.name,
      enabled: c.enabled,
      status: c.state.kind,
      state: c.state,
      logOutputChannelId: channelIdForMcpServer(sessionResource.toString(), c.id),
      setEnabled: (enabled) => target.setCustomizationEnabled(c.id, enabled),
      start: () => target.startMcpServer(c.id),
      stop: () => target.stopMcpServer(c.id)
    }));
  }
  showMcpServerLog(sessionResource, serverId, beforeShow) {
    const target = this._resolveTarget(sessionResource);
    if (!target) {
      return Promise.resolve();
    }
    const server = this._flattenMcpServers(target.customizations).find((c) => this._scopedMcpServerId(sessionResource, c.id) === serverId);
    if (!server) {
      return Promise.resolve();
    }
    this._trackMcpDiagnostics(sessionResource, target);
    const channelId = this._mcpLogRegistry.record({ sessionResource, rawId: server.id, name: server.name, enabled: server.enabled, state: server.state });
    return this._mcpLogRegistry.show(channelId, beforeShow);
  }
  /**
   * Registers `sessionResource` for MCP diagnostics mirroring and records the
   * currently-observed state of each of its servers. Idempotent: registering
   * an already-tracked session simply re-records (dedup'd by state signature).
   */
  _trackMcpDiagnostics(sessionResource, target) {
    this._mcpDiagnosticSessions.add(sessionResource);
    for (const server of this._flattenMcpServers(target.customizations)) {
      this._mcpLogRegistry.record({ sessionResource, rawId: server.id, name: server.name, enabled: server.enabled, state: server.state });
    }
  }
  /** Re-records every tracked session's MCP server states (on any customizations change). */
  _recordMcpDiagnostics() {
    for (const sessionResource of this._mcpDiagnosticSessions) {
      const target = this._resolveTarget(sessionResource);
      if (!target) {
        continue;
      }
      for (const server of this._flattenMcpServers(target.customizations)) {
        this._mcpLogRegistry.record({ sessionResource, rawId: server.id, name: server.name, enabled: server.enabled, state: server.state });
      }
    }
  }
  /** Stops mirroring and disposes all MCP diagnostics channels for a session that is going away. */
  _disposeMcpDiagnostics(sessionResource) {
    this._mcpDiagnosticSessions.delete(sessionResource);
    this._mcpLogRegistry.disposeForSession(sessionResource);
  }
  addMcpServer(sessionResource, name, config) {
    const target = this._resolveTarget(sessionResource);
    const existingServers = target?.rootConfig?.values?.[AgentHostMcpServersConfigKey];
    if (!target || !target.rootConfig) {
      return;
    }
    const servers = existingServers && typeof existingServers === "object" && !Array.isArray(existingServers) ? existingServers : {};
    target.setRootConfigValue(AgentHostMcpServersConfigKey, {
      ...servers,
      [name]: config
    });
  }
  async authenticateMcpServer(sessionResource, serverId) {
    const target = this._resolveTarget(sessionResource);
    if (!target) {
      return false;
    }
    const server = this._findMcpServer(target.customizations, serverId);
    if (!server || server.state.kind !== McpServerStatus.AuthRequired) {
      return false;
    }
    const scopedServerId = agentHostMcpServerId(sessionResource.authority, server.name, server.state.resource.resource);
    try {
      return await this._instantiationService.invokeFunction(resolveMcpServerAuthentication, server.state.resource, {
        allowInteraction: true,
        logPrefix: "[AgentHost]",
        mcpServerId: scopedServerId,
        mcpServerName: server.name,
        mcpServerUrl: server.state.resource.resource,
        oauthClient: server.state.oauthClient,
        scopes: server.state.requiredScopes ?? [],
        agentHost: { scheme: sessionResource.scheme, authority: sessionResource.authority },
        authenticate: (request) => target.authenticate(request)
      });
    } catch (err) {
      this._logService.error(`[AgentHost] Failed to authenticate MCP server '${server.name}'`, err);
      return false;
    }
  }
  getMcpServerEnablement(sessionResource, serverName, reader) {
    return this._mcpEnablementModel.readEnabledWithWorkspaceKey(
      this._mcpServerProfileEnablementKey(sessionResource, serverName),
      this._mcpServerWorkspaceEnablementKey(sessionResource, serverName),
      reader
    );
  }
  setMcpServerEnablement(sessionResource, serverName, state) {
    this._mcpEnablementModel.setEnabledWithWorkspaceKey(
      this._mcpServerProfileEnablementKey(sessionResource, serverName),
      this._mcpServerWorkspaceEnablementKey(sessionResource, serverName),
      state
    );
  }
  prepareMcpServersForTurn(sessionResource) {
    const trackingResource = this._mcpTrackingResource(sessionResource);
    const target = this._resolveTarget(trackingResource);
    if (!target) {
      return;
    }
    this._reconcileMcpServerTracking(trackingResource, this._flattenMcpServers(target.customizations), target);
  }
  /** Drops all durable-enablement tracking for a session that is no longer known. */
  _clearMcpServerTracking(sessionResource) {
    this._mcpServerTracking.deleteAll(this._mcpTrackingResource(sessionResource).toString());
  }
  _reconcileMcpServerTracking(sessionResource, servers, target) {
    const sessionKey = sessionResource.toString();
    const currentRawIds = new Set(servers.map((server) => server.id));
    for (const entry of this._mcpServerTracking.getAll(sessionKey)) {
      if (!currentRawIds.has(entry.rawId)) {
        this._mcpServerTracking.delete(sessionKey, entry.rawId);
      }
    }
    for (const server of servers) {
      const durableState = this.getMcpServerEnablement(sessionResource, server.name);
      const previous = this._mcpServerTracking.get(sessionKey, server.id);
      if (previous?.serverName === server.name && previous.durableState === durableState) {
        continue;
      }
      this._mcpServerTracking.set({ rawId: server.id, serverName: server.name, durableState }, sessionKey, server.id);
      if (previous || durableState !== ContributionEnablementState.EnabledProfile) {
        target.setCustomizationEnabled(server.id, isContributionEnabled(durableState));
      }
    }
  }
  _mcpServerProfileEnablementKey(sessionResource, serverName) {
    return JSON.stringify([sessionResource.scheme, serverName]);
  }
  _mcpServerWorkspaceEnablementKey(sessionResource, serverName) {
    const roots = this.getWorkingDirectories(sessionResource);
    if (roots.length === 0) {
      return void 0;
    }
    if (roots.length === 1) {
      return JSON.stringify([sessionResource.scheme, roots[0], serverName]);
    }
    const canonical = this._canonicalWorkspaceRoots(roots);
    if (canonical.length === 1) {
      return JSON.stringify([sessionResource.scheme, canonical[0], serverName]);
    }
    return JSON.stringify(["roots-v2", sessionResource.scheme, canonical, serverName]);
  }
  /**
   * De-duplicates working-directory roots by canonical URI identity (so
   * `file:///a` and `file:///a/` or case variants collapse to one root) and
   * returns a stable, order-independent list of representative strings.
   *
   * Order-independence requires that (a) a trailing path separator does not
   * change identity — {@link IExtUri.getComparisonKey} preserves it, so it is
   * stripped first — and (b) among case-variant spellings that share a
   * comparison key, a deterministic representative is chosen (the
   * lexicographically smallest) rather than the first one encountered.
   *
   * @example
   * // Distinct roots (any order) → same sorted list:
   * _canonicalWorkspaceRoots(['file:///b', 'file:///a']) // ['file:///a', 'file:///b']
   * _canonicalWorkspaceRoots(['file:///a', 'file:///b']) // ['file:///a', 'file:///b']
   *
   * // Trailing separator collapses (`/a/` === `/a`):
   * _canonicalWorkspaceRoots(['file:///a/', 'file:///a']) // ['file:///a']
   *
   * // Case-variant spellings of one root collapse to the smallest spelling,
   * // regardless of order (for case-insensitive schemes):
   * _canonicalWorkspaceRoots(['vscode-remote://h/Repo', 'vscode-remote://h/repo'])
   * _canonicalWorkspaceRoots(['vscode-remote://h/repo', 'vscode-remote://h/Repo'])
   * // both → ['vscode-remote://h/Repo']  ('R' (0x52) sorts before 'r' (0x72))
   */
  _canonicalWorkspaceRoots(roots) {
    const byComparisonKey = /* @__PURE__ */ new Map();
    for (const root of roots) {
      let key;
      let representative;
      try {
        const uri = extUriBiasedIgnorePathCase.removeTrailingPathSeparator(URI.parse(root));
        key = extUriBiasedIgnorePathCase.getComparisonKey(uri);
        representative = uri.toString();
      } catch {
        key = root;
        representative = root;
      }
      const existing = byComparisonKey.get(key);
      if (existing === void 0 || compare(representative, existing) < 0) {
        byComparisonKey.set(key, representative);
      }
    }
    return [...byComparisonKey.values()].sort(compare);
  }
  _mcpTrackingResource(sessionResource) {
    return sessionResource.fragment ? sessionResource.with({ fragment: null }) : sessionResource;
  }
  _fireCustomAgentsChanged() {
    this._onDidChangeCustomAgents.fire();
  }
  _fireCustomizationsChanged() {
    this._onDidChangeCustomizations.fire();
  }
  _flattenMcpServers(customizations) {
    return customizations.flatMap((c) => c.type === CustomizationType.McpServer ? [c] : c.children?.filter((c2) => c2.type === CustomizationType.McpServer) ?? []);
  }
  _findMcpServer(customizations, serverId) {
    for (const server of this._flattenMcpServers(customizations)) {
      if (server.id === serverId || this._isScopedMcpServerIdForRawId(serverId, server.id)) {
        return server;
      }
    }
    return void 0;
  }
  _scopedMcpServerId(sessionResource, rawId) {
    return `${sessionResource.authority}/${rawId}`;
  }
  _isScopedMcpServerIdForRawId(serverId, rawId) {
    const separator = serverId.indexOf("/");
    return separator >= 0 && serverId.slice(separator + 1) === rawId;
  }
}
let WorkbenchAgentHostCustomizationService = class extends AbstractAgentHostCustomizationService {
  constructor(_connectionsService, _provisionalSessionService, instantiationService, logService, _chatService, storageService) {
    super(instantiationService, logService, storageService);
    this._connectionsService = _connectionsService;
    this._provisionalSessionService = _provisionalSessionService;
    this._chatService = _chatService;
    this._sessionStateSubscriptions = this._register(new DisposableResourceMap());
    this._register(this._connectionsService.ambientConnection.onDidAction((envelope) => {
      switch (envelope.action.type) {
        case ActionType.SessionCustomizationsChanged:
        case ActionType.SessionCustomizationUpdated:
        case ActionType.SessionMcpServerStateChanged:
          this._fireCustomizationsChanged();
          this._fireCustomAgentsChanged();
          break;
      }
    }));
    this._register(this._provisionalSessionService.onDidChange((sessionResource) => {
      const existing = this._sessionStateSubscriptions.get(sessionResource);
      const currentBackend = this._provisionalSessionService.get(sessionResource);
      if (existing && existing.backendSession.toString() !== currentBackend?.toString()) {
        this._clearMcpServerTracking(sessionResource);
        this._disposeMcpDiagnostics(sessionResource);
      }
      this._sessionStateSubscriptions.deleteAndDispose(sessionResource);
      this._fireCustomizationsChanged();
      this._fireCustomAgentsChanged();
    }));
    this._register(this._chatService.onDidDisposeSession((e) => {
      for (const sessionResource of e.sessionResources) {
        this._sessionStateSubscriptions.deleteAndDispose(sessionResource);
        this._clearMcpServerTracking(sessionResource);
        this._disposeMcpDiagnostics(sessionResource);
      }
      this._fireCustomizationsChanged();
      this._fireCustomAgentsChanged();
    }));
  }
  _resolveTarget(sessionResource) {
    const target = this._resolveSessionTarget(sessionResource);
    if (!target) {
      return void 0;
    }
    const sessionState = this._readSessionState(sessionResource);
    const rootState = target.connection.rootState.value;
    const channel = target.backendSession.toString();
    return {
      customizations: sessionState?.customizations ?? [],
      workingDirectory: sessionState?.workingDirectories?.[0],
      workingDirectories: sessionState?.workingDirectories,
      rootConfig: rootState && !(rootState instanceof Error) ? rootState.config : void 0,
      authenticate: (request) => target.connection.authenticate(request),
      setCustomizationEnabled: (rawId, enabled) => {
        target.connection.dispatch(channel, {
          type: ActionType.SessionCustomizationToggled,
          id: rawId,
          enabled
        });
      },
      startMcpServer: (rawId) => {
        target.connection.dispatch(channel, {
          type: ActionType.SessionMcpServerStartRequested,
          id: rawId
        });
        return Promise.resolve();
      },
      stopMcpServer: (rawId) => {
        target.connection.dispatch(channel, {
          type: ActionType.SessionMcpServerStopRequested,
          id: rawId
        });
        return Promise.resolve();
      },
      setRootConfigValue: (property, value) => {
        target.connection.dispatch(ROOT_STATE_URI, {
          type: ActionType.RootConfigChanged,
          config: { [property]: value }
        });
      }
    };
  }
  _readSessionState(sessionResource) {
    const target = this._resolveSessionTarget(sessionResource);
    const value = target ? this._ensureSessionStateSubscription(sessionResource, target)?.sub.value : void 0;
    return value && !(value instanceof Error) ? value : void 0;
  }
  _ensureSessionStateSubscription(sessionResource, target) {
    const existing = this._sessionStateSubscriptions.get(sessionResource);
    if (existing?.backendSession.toString() === target.backendSession.toString() && existing.connection === target.connection) {
      return existing;
    }
    const ref = target.connection.getSubscription(StateComponents.Session, target.backendSession, "AgentHostCustomizationService");
    const sub = ref.object;
    const listener = sub.onDidChange(() => {
      this._fireCustomizationsChanged();
      this._fireCustomAgentsChanged();
    });
    const entry = {
      connection: target.connection,
      backendSession: target.backendSession,
      sub,
      dispose: () => {
        listener.dispose();
        ref.dispose();
      }
    };
    this._sessionStateSubscriptions.set(sessionResource, entry);
    return entry;
  }
  /**
   * Resolves a chat session resource to the backend agent-session URI plus
   * the {@link IAgentConnection} (local or remote) that owns it. Returns
   * `undefined` for sessions not backed by an agent host.
   */
  _resolveSessionTarget(sessionResource) {
    const provisionalSession = this._provisionalSessionService.get(sessionResource);
    if (provisionalSession) {
      return { connection: this._connectionsService.ambientConnection, backendSession: provisionalSession };
    }
    if (isUntitledChatSession(sessionResource)) {
      return void 0;
    }
    return this._connectionsService.resolveSessionResource(sessionResource);
  }
};
WorkbenchAgentHostCustomizationService = __decorateClass([
  __decorateParam(0, IAgentHostConnectionsService),
  __decorateParam(1, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IStorageService)
], WorkbenchAgentHostCustomizationService);
registerSingleton(IAgentHostCustomizationService, WorkbenchAgentHostCustomizationService, InstantiationType.Delayed);
let AgentHostMcpServerLogRegistry = class extends Disposable {
  constructor(_loggerService, _outputService) {
    super();
    this._loggerService = _loggerService;
    this._outputService = _outputService;
    this._entries = /* @__PURE__ */ new Map();
    /** Channel ids grouped by owning session key, so a session teardown can dispose them all. */
    this._bySession = /* @__PURE__ */ new Map();
    this._register(toDisposable(() => {
      for (const key of [...this._bySession.keys()]) {
        this._disposeSessionKey(key);
      }
    }));
  }
  /**
   * Ensures a hidden diagnostics channel exists for the MCP server identified
   * by `(sessionResource, rawId)` and records a line whenever its state
   * changes (including the first observed state). Returns the stable channel
   * id for the service to reveal via {@link show} -- the id is internal.
   */
  record(server) {
    const sessionKey = server.sessionResource.toString();
    const channelId = channelIdForMcpServer(sessionKey, server.rawId);
    let entry = this._entries.get(channelId);
    if (!entry) {
      const logger = this._loggerService.createLogger(channelId, {
        hidden: true,
        name: localize("agentHost.mcpServer.outputChannel", "MCP: {0}", server.name)
      });
      const dispose = () => {
        logger.dispose();
        this._loggerService.deregisterLogger(channelId);
      };
      entry = { logger, dispose, lastSignature: void 0 };
      this._entries.set(channelId, entry);
      let group = this._bySession.get(sessionKey);
      if (!group) {
        group = /* @__PURE__ */ new Set();
        this._bySession.set(sessionKey, group);
      }
      group.add(channelId);
    }
    const { signature, message, isError } = describeMcpServerState(server.name, server.enabled, server.state);
    if (entry.lastSignature !== signature) {
      entry.lastSignature = signature;
      if (isError) {
        entry.logger.error(message);
      } else {
        entry.logger.info(message);
      }
    }
    return channelId;
  }
  /** Reveals the diagnostics channel `channelId`, making its hidden logger visible. */
  async show(channelId, beforeShow) {
    if (!this._entries.has(channelId)) {
      return;
    }
    this._loggerService.setVisibility(channelId, true);
    await beforeShow?.();
    await this._outputService.showChannel(channelId);
  }
  /** Disposes every channel/logger owned by `sessionResource` (session teardown). */
  disposeForSession(sessionResource) {
    this._disposeSessionKey(sessionResource.toString());
  }
  _disposeSessionKey(sessionKey) {
    const group = this._bySession.get(sessionKey);
    if (!group) {
      return;
    }
    this._bySession.delete(sessionKey);
    for (const channelId of group) {
      this._entries.get(channelId)?.dispose();
      this._entries.delete(channelId);
    }
  }
};
AgentHostMcpServerLogRegistry = __decorateClass([
  __decorateParam(0, ILoggerService),
  __decorateParam(1, IOutputService)
], AgentHostMcpServerLogRegistry);
function channelIdForMcpServer(sessionKey, rawId) {
  const sha = new StringSHA1();
  sha.update(sessionKey);
  sha.update("\0");
  sha.update(rawId);
  return `agentHostMcpServer.${sha.digest()}`;
}
function describeMcpServerState(name, enabled, state) {
  if (!enabled) {
    return { signature: "disabled", message: localize("agentHost.mcpServer.disabled", "Server '{0}' is disabled", name), isError: false };
  }
  switch (state.kind) {
    case McpServerStatus.Ready:
      return { signature: "ready", message: localize("agentHost.mcpServer.ready", "Server '{0}' is running", name), isError: false };
    case McpServerStatus.Starting:
      return { signature: "starting", message: localize("agentHost.mcpServer.starting", "Server '{0}' is starting", name), isError: false };
    case McpServerStatus.AuthRequired:
      return { signature: `authRequired:${state.resource.resource}`, message: localize("agentHost.mcpServer.authRequired", "Server '{0}' requires authentication ({1})", name, state.resource.resource), isError: false };
    case McpServerStatus.Error:
      return { signature: `error:${state.error.errorType}:${state.error.message}`, message: localize("agentHost.mcpServer.error", "Server '{0}' failed: {1}", name, state.error.message), isError: true };
    case McpServerStatus.Stopped:
    default:
      return { signature: "stopped", message: localize("agentHost.mcpServer.stopped", "Server '{0}' is stopped", name), isError: false };
  }
}
export {
  AbstractAgentHostCustomizationService,
  IAgentHostCustomizationService,
  NullAgentHostCustomizationService
};
