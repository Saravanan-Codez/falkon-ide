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
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { CancellationError } from "../../../../../base/common/errors.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import {
  CLOUD_SANDBOX_AGENT_PROVIDER,
  CLOUD_SANDBOX_SESSION_SCHEME,
  CloudSandboxEnabledSettingId,
  cloudSandboxAddress,
  ICloudSandboxAgentHostService,
  ICloudSandboxApiService
} from "../../../../../platform/agentHost/common/cloudSandboxAgentHost.js";
import { AgentSession } from "../../../../../platform/agentHost/common/agentService.js";
import { agentHostAuthority } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { findRemoteAgentHostSessionTypeAuthority, remoteAgentHostSessionTypeId } from "../../../../../platform/agentHost/common/agentHostSessionType.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IAuthenticationService } from "../../../../../workbench/services/authentication/common/authentication.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { ChatSessionsExtensions, IChatSessionsService } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { CloudSandboxReadOnlySessionHandler } from "./cloudSandboxReadOnlySessionHandler.js";
import { IAgentHostFilterService } from "../../../../services/agentHostFilter/common/agentHostFilter.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { RemoteAgentHostSessionsProvider } from "./remoteAgentHostSessionsProvider.js";
import { IRemoteAgentHostConnectionCustomizationService } from "./remoteAgentHostConnectionCustomization.js";
import { createCloudSandboxConnectionCustomization, isCloudSandboxConnectionAddress } from "./cloudSandboxConnectionCustomization.js";
import { watchForIncompatibleNotifications } from "./remoteHostOptions.js";
const LOG_PREFIX = "[CloudSandboxAgentHost]";
const SANDBOX_SESSION_SCHEME_ALIAS = {
  ui: CLOUD_SANDBOX_AGENT_PROVIDER,
  backend: CLOUD_SANDBOX_SESSION_SCHEME
};
let CloudSandboxAgentHostContribution = class extends Disposable {
  constructor(_cloudSandboxService, _apiService, _remoteAgentHostService, _connectionCustomizations, _sessionsProvidersService, _agentHostFilterService, _configurationService, _authenticationService, _instantiationService, _notificationService, _chatSessionsService, _logService) {
    super();
    this._cloudSandboxService = _cloudSandboxService;
    this._apiService = _apiService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this._connectionCustomizations = _connectionCustomizations;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._agentHostFilterService = _agentHostFilterService;
    this._configurationService = _configurationService;
    this._authenticationService = _authenticationService;
    this._instantiationService = _instantiationService;
    this._notificationService = _notificationService;
    this._chatSessionsService = _chatSessionsService;
    this._logService = _logService;
    /** Provider instances keyed by connection address (`cloudsandbox:<envId>`). */
    this._providerInstances = /* @__PURE__ */ new Map();
    this._providerStores = this._register(new DisposableMap());
    /** Environment metadata keyed by connection address, for on-demand reconnect. */
    this._environments = /* @__PURE__ */ new Map();
    /** In-flight connects keyed by address, so concurrent opens share one attempt. */
    this._pendingConnects = /* @__PURE__ */ new Map();
    /**
     * Read-only content providers standing in for unreachable environments, keyed by session type.
     * Disposed when the environment becomes reachable again.
     */
    this._readOnlyHandlers = this._register(new DisposableMap());
    /** Live handler instances, so an already-open session can be settled read-only in place. */
    this._readOnlyInstances = /* @__PURE__ */ new Map();
    /**
     * Cancelled when the feature is disabled (or the contribution is disposed), so in-flight
     * discovery and connects abort instead of committing state after teardown has run.
     */
    this._enabledCts = new CancellationTokenSource();
    /** Whether discovery has completed at least once, used to stop the auth-driven retry. */
    this._hasDiscovered = false;
    this._register(this._connectionCustomizations.register(
      isCloudSandboxConnectionAddress,
      (address) => createCloudSandboxConnectionCustomization(address, this._cloudSandboxService)
    ));
    this._register(this._remoteAgentHostService.onDidChangeConnections(() => {
      for (const connection of this._remoteAgentHostService.connections) {
        if (RemoteAgentHostConnectionStatus.isConnected(connection.status)) {
          this._clearReadOnly(connection.address);
        }
      }
      this._wireConnections();
      this._updateConnectionStatuses();
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CloudSandboxEnabledSettingId) || e.affectsConfiguration(RemoteAgentHostsEnabledSettingId)) {
        if (this._isEnabled()) {
          void this._discoverAndSeed();
        } else {
          this._teardownAll();
        }
      }
    }));
    this._register(this._agentHostFilterService.registerDiscoveryHandler(() => this._discoverAndSeed()));
    void this._discoverAndSeed();
    const retryUntilFirstSuccess = this._register(new DisposableStore());
    const retry = () => {
      if (this._hasDiscovered) {
        retryUntilFirstSuccess.clear();
        return;
      }
      void this._discoverAndSeed();
    };
    retryUntilFirstSuccess.add(this._authenticationService.onDidChangeSessions(retry));
    retryUntilFirstSuccess.add(this._authenticationService.onDidRegisterAuthenticationProvider(retry));
    this._register(toDisposable(() => {
      this._enabledCts.cancel();
      this._enabledCts.dispose();
    }));
    this._register(Registry.as(ChatSessionsExtensions.AsyncActivation).register({
      matchSessionType: (sessionType) => this._findAddressForSessionType(sessionType) !== void 0,
      waitForActivation: (_accessor, sessionType) => this._waitForActivation(sessionType)
    }));
  }
  static {
    this.ID = "workbench.contrib.cloudSandboxAgentHost";
  }
  /**
   * Discover environment-bound sandbox sessions and seed them into per-environment providers so
   * they appear in the sessions list **without** connecting. Reconciles against the result:
   * environments that have vanished from discovery (e.g. their task was archived) and are not
   * currently connected are torn down, so stale providers/sessions don't linger. Best-effort:
   * a failed discovery is logged and leaves existing state untouched.
   *
   * Runs are serialized, with at most one follow-up queued, so overlapping triggers can't
   * interleave their reconciliation passes.
   */
  _discoverAndSeed() {
    if (this._discoveryInFlight) {
      this._discoveryQueued ??= this._discoveryInFlight.then(() => {
        this._discoveryQueued = void 0;
        return this._discoverAndSeed();
      });
      return this._discoveryQueued;
    }
    this._discoveryInFlight = this._doDiscoverAndSeed().finally(() => {
      this._discoveryInFlight = void 0;
    });
    return this._discoveryInFlight;
  }
  async _doDiscoverAndSeed() {
    if (!this._isEnabled()) {
      return;
    }
    const token = this._enabledCts.token;
    let result;
    try {
      result = await this._apiService.listSessions(token);
    } catch (error) {
      result = { kind: "failed", reason: error instanceof Error ? error.message : String(error) };
    }
    if (result.kind === "failed") {
      this._logService.warn(`${LOG_PREFIX} Discovery failed: ${result.reason}`);
      return;
    }
    if (token.isCancellationRequested || !this._isEnabled()) {
      return;
    }
    this._hasDiscovered = true;
    const present = /* @__PURE__ */ new Set();
    for (const session of result.sessions) {
      if (!session.environmentId || !session.sessionId) {
        continue;
      }
      const address = cloudSandboxAddress(session.environmentId);
      present.add(address);
      this._ensureProvider({ environmentId: session.environmentId, sessionId: session.sessionId, taskId: session.taskId, name: session.name });
      const provider = this._providerInstances.get(address);
      const parsed = session.updatedAt ? Date.parse(session.updatedAt) : Number.NaN;
      const modifiedTime = Number.isNaN(parsed) ? Date.now() : parsed;
      const meta = {
        // Seed under the agent-provider (UI) scheme, preserving the session id. Mission Control
        // issues each session as `ahp-session:/<id>` (the id it also returns here), and the
        // Copilot host lists that same id back, so the seed reconciles deterministically with
        // the live `listSessions()` result on connect. See copilot-host session-identity docs.
        session: AgentSession.uri(CLOUD_SANDBOX_AGENT_PROVIDER, session.sessionId),
        startTime: modifiedTime,
        modifiedTime,
        summary: session.name
      };
      provider?.seedSessions([meta]);
    }
    if (result.kind === "complete") {
      for (const address of [...this._environments.keys()]) {
        if (present.has(address)) {
          continue;
        }
        const connected = this._remoteAgentHostService.connections.some((c) => c.address === address);
        if (!connected) {
          this._teardownEnvironment(address);
        }
      }
    }
    this._logService.info(`${LOG_PREFIX} Seeded ${present.size} discovered sandbox environment(s)${result.kind === "partial" ? " (partial scan; kept existing entries)" : ""}.`);
  }
  /**
   * Remove the connection (and its credential refresher) for an environment while keeping the
   * provider and its cached sessions visible in a disconnected state. Disposing the protocol
   * client stops the soft-reconnect loop; the {@link CloudSandboxAgentHostService} prunes the
   * refresher via `onDidChangeConnections`.
   */
  async _disconnectEnvironment(address) {
    try {
      await this._remoteAgentHostService.removeRemoteAgentHost(address);
    } catch (error) {
      this._logService.warn(`${LOG_PREFIX} Failed to disconnect ${address}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /**
   * Fully tear down an environment: dispose its provider (unregistering it and its sessions) and
   * remove its connection + credential refresher. Used when an environment vanishes from discovery
   * or the feature is disabled.
   */
  _teardownEnvironment(address) {
    this._environments.delete(address);
    this._pendingConnects.delete(address);
    this._providerStores.deleteAndDispose(address);
    this._clearReadOnly(address);
    void this._disconnectEnvironment(address);
  }
  /** Tear down every known sandbox environment (feature disabled). */
  _teardownAll() {
    this._enabledCts.cancel();
    this._enabledCts.dispose();
    this._enabledCts = new CancellationTokenSource();
    for (const address of [...this._environments.keys()]) {
      this._teardownEnvironment(address);
    }
  }
  /** Map each known sandbox connection authority to its address (`cloudsandbox:<envId>`). */
  _authoritiesByAddress() {
    const byAuthority = /* @__PURE__ */ new Map();
    for (const address of this._environments.keys()) {
      byAuthority.set(agentHostAuthority(address), address);
    }
    return byAuthority;
  }
  /** Resolve the sandbox address owning a remote-agent-host session type, if any. */
  _findAddressForSessionType(sessionType) {
    const byAuthority = this._authoritiesByAddress();
    const authority = findRemoteAgentHostSessionTypeAuthority(sessionType, byAuthority.keys());
    return authority ? byAuthority.get(authority) : void 0;
  }
  /**
   * Async-activation hook for a sandbox session type: establish the relay connection on demand,
   * then resolve once the host advertises the agent backing this session type (its content
   * provider is registered), so the chat can load. Returns false if the environment is unknown,
   * the connection fails, or the agent never appears.
   */
  async _waitForActivation(sessionType) {
    const address = this._findAddressForSessionType(sessionType);
    const env = address ? this._environments.get(address) : void 0;
    if (!address || !env) {
      return false;
    }
    const connecting = this.connect({ environmentId: env.environmentId, sessionId: env.sessionId, name: env.name });
    const connectOutcome = connecting.then(() => void 0, (error) => error ?? new Error("connect failed"));
    const prefetchedHistory = this._prefetchHistoryIfDormant(env);
    if (prefetchedHistory) {
      const historyFirst = await Promise.race([
        connectOutcome.then(() => void 0),
        prefetchedHistory
      ]);
      if (historyFirst && this._isEnabled() && !this._enabledCts.token.isCancellationRequested) {
        this._logService.info(`${LOG_PREFIX} History for ${address} arrived before the connect settled; opening it now.`);
        const opened = this._activateReadOnly(sessionType, address, env, prefetchedHistory);
        void connectOutcome.then((connectError2) => {
          if (connectError2 !== void 0 && this._isEnabled() && !this._enabledCts.token.isCancellationRequested) {
            this._logService.info(`${LOG_PREFIX} Connect for ${address} failed after the session opened; settling it read-only.`);
            this._settleReadOnly(sessionType, address);
          }
        });
        return opened;
      }
    }
    const connectError = await connectOutcome;
    if (connectError !== void 0) {
      this._logService.warn(`${LOG_PREFIX} connect-on-open failed for ${address}: ${connectError instanceof Error ? connectError.message : String(connectError)}`);
      if (this._isEnabled() && !this._enabledCts.token.isCancellationRequested) {
        const opened = this._activateReadOnly(sessionType, address, env, prefetchedHistory);
        if (opened) {
          this._settleReadOnly(sessionType, address);
        }
        return opened;
      }
      return false;
    }
    const authority = agentHostAuthority(address);
    while (true) {
      const connection = this._remoteAgentHostService.getConnection(address);
      if (!connection) {
        return false;
      }
      const rootState = connection.rootState.value;
      if (rootState instanceof Error) {
        return false;
      }
      if (rootState) {
        return rootState.agents.some((agent) => remoteAgentHostSessionTypeId(authority, agent.provider) === sessionType);
      }
      await Event.toPromise(connection.rootState.onDidChange);
    }
  }
  /**
   * Persisted history for an environment that is not currently online, or `undefined` when it is
   * online, has no task, or the read failed.
   *
   * `status` cannot predict whether a dormant environment will wake — suspended and deleted both
   * read `offline` — but it does say, in a few hundred milliseconds, that this open is on the slow
   * path, which is enough to start the fetch now. Never rejects; the handler still reads history
   * itself when this yields nothing.
   */
  _prefetchHistoryIfDormant(env) {
    const taskId = env.taskId;
    if (!taskId) {
      return void 0;
    }
    const token = this._enabledCts.token;
    return (async () => {
      try {
        const record = await this._apiService.getEnvironment(env.environmentId, token);
        if (record.status === "online") {
          return void 0;
        }
        this._logService.trace(`${LOG_PREFIX} Environment ${env.environmentId} is '${record.status}'; prefetching history in case the connect does not land.`);
        return await this._apiService.getSessionHistory(taskId, token);
      } catch (error) {
        this._logService.trace(`${LOG_PREFIX} History prefetch for ${env.environmentId} did not complete: ${error instanceof Error ? error.message : String(error)}`);
        return void 0;
      }
    })();
  }
  /**
   * Register a content provider that serves this session from replayed history.
   *
   * Deliberately does *not* mark the session read-only: this also runs while a connect is in
   * flight and the environment may yet wake — callers settle it via {@link _settleReadOnly}.
   * Returns `true` once registered, which is what lets `canResolveChatSession` proceed, or `false`
   * when there is no task to read history from.
   */
  _activateReadOnly(sessionType, address, env, prefetchedHistory) {
    if (this._readOnlyHandlers.has(sessionType)) {
      return true;
    }
    if (this._chatSessionsService.getContentProviderSchemes().includes(sessionType)) {
      this._logService.trace(`${LOG_PREFIX} ${sessionType} already has a content provider; leaving it to serve the session.`);
      return true;
    }
    if (!env.taskId) {
      this._logService.warn(`${LOG_PREFIX} No task id for ${address}; cannot serve history read-only.`);
      return false;
    }
    const store = new DisposableStore();
    const handler = store.add(this._instantiationService.createInstance(CloudSandboxReadOnlySessionHandler, {
      taskId: env.taskId,
      // The live handler registers `agentId === sessionType`; matching it keeps replayed
      // history attributed to the same participant.
      agentId: sessionType,
      connectionAuthority: agentHostAuthority(address),
      prefetchedHistory
    }));
    store.add(this._chatSessionsService.registerChatSessionContentProvider(sessionType, handler));
    this._readOnlyHandlers.set(sessionType, store);
    this._readOnlyInstances.set(sessionType, handler);
    store.add(toDisposable(() => this._readOnlyInstances.delete(sessionType)));
    this._logService.info(`${LOG_PREFIX} Serving ${sessionType} from Mission Control history.`);
    return true;
  }
  /**
   * Settle a history-backed session as read-only once the connect has failed. Sessions already on
   * screen observe this and disable their composer in place, without needing a reopen.
   */
  _settleReadOnly(sessionType, address) {
    const handler = this._readOnlyInstances.get(sessionType);
    if (!handler) {
      return;
    }
    handler.markReadOnly();
    this._providerInstances.get(address)?.setReadOnly(true);
  }
  /**
   * Drop any read-only stand-in for an address so the live handler can own the session type.
   * Registering two content providers for one session type throws, so this must run before a
   * connection is established rather than after.
   */
  _clearReadOnly(address) {
    this._providerInstances.get(address)?.setReadOnly(false);
    const authority = agentHostAuthority(address);
    for (const sessionType of [...this._readOnlyHandlers.keys()]) {
      if (findRemoteAgentHostSessionTypeAuthority(sessionType, [authority]) === authority) {
        this._readOnlyHandlers.deleteAndDispose(sessionType);
        this._logService.info(`${LOG_PREFIX} Dropped read-only stand-in for ${sessionType}; the environment is reachable again.`);
      }
    }
  }
  /**
   * Ensure a provider exists for the environment and establish (or reuse) the
   * connection. Resolves with the connection's display address.
   */
  async connect(options) {
    if (!this._isEnabled()) {
      throw new Error("Copilot cloud sandbox connections are not enabled.");
    }
    const address = cloudSandboxAddress(options.environmentId);
    this._ensureProvider({ environmentId: options.environmentId, sessionId: options.sessionId, name: options.name });
    const pending = this._pendingConnects.get(address);
    if (pending) {
      return pending;
    }
    const token = this._enabledCts.token;
    const attempt = (async () => {
      try {
        this._providerInstances.get(address)?.setConnectionStatus(RemoteAgentHostConnectionStatus.connecting);
        this._clearReadOnly(address);
        const result = await this._cloudSandboxService.connect(options, token);
        if (token.isCancellationRequested || !this._isEnabled()) {
          void this._disconnectEnvironment(address);
          throw new CancellationError();
        }
        this._wireConnections();
        return result;
      } finally {
        this._pendingConnects.delete(address);
      }
    })();
    this._pendingConnects.set(address, attempt);
    return attempt;
  }
  _isEnabled() {
    return this._configurationService.getValue(CloudSandboxEnabledSettingId) && this._configurationService.getValue(RemoteAgentHostsEnabledSettingId);
  }
  /** Create the sessions provider for an environment if it doesn't exist yet. */
  _ensureProvider(env) {
    const address = cloudSandboxAddress(env.environmentId);
    const known = this._environments.get(address);
    this._environments.set(address, { ...known, ...env, taskId: env.taskId ?? known?.taskId });
    if (this._providerStores.has(address)) {
      return;
    }
    const store = new DisposableStore();
    const provider = this._instantiationService.createInstance(
      RemoteAgentHostSessionsProvider,
      {
        address,
        name: env.name,
        connectOnDemand: () => this.connect({ environmentId: env.environmentId, sessionId: env.sessionId, name: env.name }).then(() => {
        }),
        sessionSchemeAlias: SANDBOX_SESSION_SCHEME_ALIAS
      }
    );
    store.add(provider);
    store.add(this._sessionsProvidersService.registerProvider(provider));
    store.add(watchForIncompatibleNotifications(provider, this._instantiationService, this._notificationService));
    this._providerInstances.set(address, provider);
    store.add(toDisposable(() => this._providerInstances.delete(address)));
    this._providerStores.set(address, store);
    this._logService.info(`${LOG_PREFIX} Registered sessions provider for ${address}`);
  }
  /** Wire each live connection to its provider so session enumeration runs. */
  _wireConnections() {
    for (const [address, provider] of this._providerInstances) {
      const connectionInfo = this._remoteAgentHostService.connections.find(
        (c) => c.address === address && RemoteAgentHostConnectionStatus.isConnected(c.status)
      );
      if (connectionInfo) {
        const connection = this._remoteAgentHostService.getConnection(address);
        if (connection) {
          provider.setConnection(connection, connectionInfo.defaultDirectory);
        }
      }
    }
  }
  /** Push the service's authoritative connection status onto each provider. */
  _updateConnectionStatuses() {
    for (const [address, provider] of this._providerInstances) {
      const connectionInfo = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (connectionInfo) {
        provider.setConnectionStatus(connectionInfo.status);
      } else if (!RemoteAgentHostConnectionStatus.isIncompatible(provider.connectionStatus.get())) {
        provider.setConnectionStatus(RemoteAgentHostConnectionStatus.disconnected);
      }
    }
  }
};
CloudSandboxAgentHostContribution = __decorateClass([
  __decorateParam(0, ICloudSandboxAgentHostService),
  __decorateParam(1, ICloudSandboxApiService),
  __decorateParam(2, IRemoteAgentHostService),
  __decorateParam(3, IRemoteAgentHostConnectionCustomizationService),
  __decorateParam(4, ISessionsProvidersService),
  __decorateParam(5, IAgentHostFilterService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IAuthenticationService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IChatSessionsService),
  __decorateParam(11, ILogService)
], CloudSandboxAgentHostContribution);
export {
  CloudSandboxAgentHostContribution
};
