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
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import * as nls from "../../../../../nls.js";
import { IRemoteAgentHostService, RemoteAgentHostAutoConnectSettingId, RemoteAgentHostConnectionStatus, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { ITunnelAgentHostService, TUNNEL_ADDRESS_PREFIX } from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { PROTOCOL_VERSION } from "../../../../../platform/agentHost/common/state/protocol/version/registry.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { IAuthenticationService } from "../../../../../workbench/services/authentication/common/authentication.js";
import { IHostService } from "../../../../../workbench/services/host/browser/host.js";
import { logTunnelConnectAttempt, logTunnelConnectResolved, logTunnelDiscoveryResult } from "../../../../common/sessionsTelemetry.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { IAgentHostFilterService } from "../../../../services/agentHostFilter/common/agentHostFilter.js";
import { RemoteAgentHostSessionsProvider } from "./remoteAgentHostSessionsProvider.js";
import { watchForIncompatibleNotifications } from "./remoteHostOptions.js";
const STATUS_CHECK_INTERVAL = 5 * 60 * 1e3;
const RECONNECT_INITIAL_DELAY = 1e3;
const RECONNECT_MAX_DELAY = 3e4;
const RECONNECT_MAX_ATTEMPTS = 10;
const RESUME_RATE_LIMIT_MS = 1e4;
let TunnelAgentHostContribution = class extends Disposable {
  constructor(_tunnelService, _remoteAgentHostService, _sessionsProvidersService, _configurationService, _instantiationService, _notificationService, _logService, _authenticationService, _telemetryService, _hostService, agentHostFilterService) {
    super();
    this._tunnelService = _tunnelService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._notificationService = _notificationService;
    this._logService = _logService;
    this._authenticationService = _authenticationService;
    this._telemetryService = _telemetryService;
    this._hostService = _hostService;
    this._providerStores = this._register(new DisposableMap());
    this._providerInstances = /* @__PURE__ */ new Map();
    this._pendingConnects = /* @__PURE__ */ new Map();
    this._lastStatusCheck = 0;
    /**
     * `false` until the first {@link _silentStatusCheck} resolves. Until then
     * we keep newly-created providers in the `Connecting` state so the picker
     * doesn't briefly show every cached tunnel as "Offline" on startup.
     */
    this._initialStatusChecked = false;
    /** Previous connection status per address — used to detect Connected→Disconnected transitions. */
    this._previousStatuses = /* @__PURE__ */ new Map();
    /** Pending auto-reconnect timer per address. */
    this._reconnectTimeouts = /* @__PURE__ */ new Map();
    /** Consecutive failed auto-reconnect attempts per address. */
    this._reconnectAttempts = /* @__PURE__ */ new Map();
    /** Addresses whose auto-reconnect loop has paused after too many failures. */
    this._reconnectPaused = /* @__PURE__ */ new Set();
    /**
     * Addresses whose provider currently holds a live connection. Tracked
     * separately from {@link _previousStatuses} so a drop is still detected when
     * the connection passes through an intermediate `connecting` state on its
     * way down.
     */
    this._wiredAddresses = /* @__PURE__ */ new Set();
    /** Timestamp of the last wake-triggered resume, to rate-limit rapid tab toggles. */
    this._lastResumeAt = 0;
    /**
     * Per-address connect sessions for telemetry. A session starts at the
     * first attempt of a connect cycle (initial or reconnect) and ends on
     * terminal resolution (connected, host-offline, max-attempts).
     */
    this._connectSessions = /* @__PURE__ */ new Map();
    this._reconcileProviders();
    this._register(agentHostFilterService.registerDiscoveryHandler(() => this._silentStatusCheck()));
    this._register(this._remoteAgentHostService.onDidChangeConnections(() => {
      this._handleConnectionChanges();
      this._updateConnectionStatuses();
      this._wireConnections();
    }));
    this._register(this._tunnelService.onDidChangeTunnels(() => {
      this._reconcileProviders();
      this._pruneReconnectState();
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(RemoteAgentHostsEnabledSettingId)) {
        this._reconcileProviders();
        this._pruneReconnectState();
      }
    }));
    this._register(this._authenticationService.onDidChangeSessions((e) => {
      if (e.providerId !== "github") {
        return;
      }
      this._handleSessionsChange(e);
    }));
    this._register(this._hostService.onDidChangeFocus((focused) => {
      if (focused) {
        this._resumeReconnects("focus");
      }
    }));
    if (isWeb) {
      const onWake = () => this._resumeReconnects("wake");
      mainWindow.addEventListener("online", onWake);
      this._register(toDisposable(() => mainWindow.removeEventListener("online", onWake)));
    }
    this._register(toDisposable(() => {
      for (const timer of this._reconnectTimeouts.values()) {
        clearTimeout(timer);
      }
      this._reconnectTimeouts.clear();
    }));
    agentHostFilterService.rediscover();
  }
  static {
    this.ID = "sessions.contrib.tunnelAgentHostContribution";
  }
  /**
   * Called by the workspace picker when it opens. Silently re-checks
   * tunnel statuses if more than 5 minutes have elapsed since the last check.
   */
  async checkTunnelStatuses() {
    if (Date.now() - this._lastStatusCheck < STATUS_CHECK_INTERVAL) {
      return;
    }
    await this._silentStatusCheck();
  }
  // -- Provider management --
  _reconcileProviders() {
    const enabled = this._configurationService.getValue(RemoteAgentHostsEnabledSettingId);
    const cached = enabled ? this._getProviderTunnels() : [];
    const desiredAddresses = new Set(cached.map((t) => `${TUNNEL_ADDRESS_PREFIX}${t.tunnelId}`));
    for (const [address] of this._providerStores) {
      if (!desiredAddresses.has(address)) {
        this._providerStores.deleteAndDispose(address);
        this._providerInstances.delete(address);
      }
    }
    for (const tunnel of cached) {
      const address = `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`;
      if (!this._providerStores.has(address)) {
        this._createProvider(address, tunnel.name);
      }
    }
  }
  _getProviderTunnels() {
    return this._tunnelService.getCachedTunnels().filter((tunnel) => !this._tunnelService.isAutoConnectSuppressed(tunnel.tunnelId));
  }
  _createProvider(address, name) {
    const store = new DisposableStore();
    const provider = this._instantiateProvider(address, name);
    provider.setConnectionStatus(RemoteAgentHostConnectionStatus.connecting);
    store.add(provider);
    store.add(this._sessionsProvidersService.registerProvider(provider));
    store.add(watchForIncompatibleNotifications(provider, this._instantiationService, this._notificationService));
    this._providerInstances.set(address, provider);
    store.add(toDisposable(() => {
      this._providerInstances.delete(address);
      this._wiredAddresses.delete(address);
    }));
    this._providerStores.set(address, store);
  }
  _instantiateProvider(address, name) {
    return this._instantiationService.createInstance(
      RemoteAgentHostSessionsProvider,
      {
        address,
        name,
        connectOnDemand: () => this._connectTunnel(address, { userInitiated: true }),
        disconnectOnDemand: () => this._disconnectTunnel(address)
      }
    );
  }
  // -- Connection status --
  _updateConnectionStatuses() {
    for (const [address, provider] of this._providerInstances) {
      const connectionInfo = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (connectionInfo) {
        provider.setConnectionStatus(connectionInfo.status);
        continue;
      }
      if (RemoteAgentHostConnectionStatus.isIncompatible(provider.connectionStatus.get())) {
        continue;
      }
      if (this._pendingConnects.has(address)) {
        provider.setConnectionStatus(RemoteAgentHostConnectionStatus.connecting);
      } else if (!this._initialStatusChecked) {
        provider.setConnectionStatus(RemoteAgentHostConnectionStatus.connecting);
      } else {
        provider.setConnectionStatus(RemoteAgentHostConnectionStatus.disconnected);
      }
    }
  }
  /**
   * Wire live connections to their providers so session operations work, and
   * drop a provider's connection once its transport is gone.
   */
  _wireConnections() {
    for (const [address, provider] of this._providerInstances) {
      const connectionInfo = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (connectionInfo && RemoteAgentHostConnectionStatus.isConnected(connectionInfo.status)) {
        const connection = this._remoteAgentHostService.getConnection(address);
        if (connection) {
          provider.setConnection(connection, connectionInfo.defaultDirectory);
          this._wiredAddresses.add(address);
        }
      } else if (this._wiredAddresses.has(address) && !RemoteAgentHostConnectionStatus.isConnecting(connectionInfo?.status)) {
        this._wiredAddresses.delete(address);
        provider.clearConnection();
      }
    }
  }
  // -- On-demand connection --
  /**
   * Establish a relay connection to a cached tunnel. Called on demand
   * when the user invokes the browse action on an online-but-not-connected tunnel.
   */
  _connectTunnel(address, options) {
    const existing = this._pendingConnects.get(address);
    if (existing) {
      return existing;
    }
    const tunnelId = address.slice(TUNNEL_ADDRESS_PREFIX.length);
    const cached = this._tunnelService.getCachedTunnels().find((t) => t.tunnelId === tunnelId);
    if (!cached) {
      return Promise.resolve();
    }
    if (!options.userInitiated && this._tunnelService.isAutoConnectSuppressed(tunnelId)) {
      this._logService.info(`[TunnelAgentHost] Skipping background connect for user-disconnected tunnel ${address}`);
      return Promise.resolve();
    }
    if (options.userInitiated) {
      this._tunnelService.clearAutoConnectSuppression(tunnelId);
      const provider = this._providerInstances.get(address);
      if (provider && RemoteAgentHostConnectionStatus.isIncompatible(provider.connectionStatus.get())) {
        provider.setConnectionStatus(RemoteAgentHostConnectionStatus.connecting);
      }
    }
    this._cancelReconnect(address);
    const { attemptNumber, attemptStart, session, isReconnect } = this._beginConnectAttempt(address);
    const promise = (async () => {
      let handle;
      const timer = options.userInitiated ? setTimeout(() => {
        handle = this._notificationService.notify({
          severity: Severity.Info,
          message: nls.localize("tunnelConnecting", "Connecting to tunnel '{0}'...", cached.name),
          progress: { infinite: true }
        });
      }, 1e3) : void 0;
      this._updateConnectionStatuses();
      try {
        const tunnelInfo = {
          tunnelId: cached.tunnelId,
          clusterId: cached.clusterId,
          name: cached.name,
          tags: [],
          protocolVersion: 5,
          hostConnectionCount: 0
        };
        await this._tunnelService.connect(tunnelInfo, cached.authProvider, { userInitiated: options.userInitiated });
        if (!options.userInitiated && this._tunnelService.isAutoConnectSuppressed(cached.tunnelId)) {
          this._logService.info(`[TunnelAgentHost] Disconnecting background connection for user-disconnected tunnel ${address}`);
          await this._tunnelService.disconnect(address);
          this._connectSessions.delete(address);
          return;
        }
        this._finishConnectAttempt(address, { success: true, attemptNumber, attemptStart, session, isReconnect });
      } catch (err) {
        this._logService.warn(`[TunnelAgentHost] Connect to ${cached.name} failed:`, err);
        const errorCategory = this._categorizeError(err);
        this._finishConnectAttempt(address, { success: false, attemptNumber, attemptStart, session, isReconnect, error: err });
        this._pendingConnects.delete(address);
        const incompatible = RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION]);
        if (incompatible) {
          this._providerInstances.get(address)?.setConnectionStatus(incompatible);
          this._resetReconnectState(address);
          throw err;
        }
        if (errorCategory === "authExpired" || errorCategory === "auth") {
          this._pauseReconnect(address, errorCategory);
          throw err;
        }
        const hostOnline = await this._probeHostOnline(cached.tunnelId);
        if (hostOnline === false) {
          this._pauseReconnect(address, "hostOffline");
        } else {
          this._logService.info(`[TunnelAgentHost] Scheduling reconnect for ${address}`);
          this._scheduleReconnect(address);
        }
        throw err;
      } finally {
        if (timer !== void 0) {
          clearTimeout(timer);
        }
        handle?.close();
        this._pendingConnects.delete(address);
        this._updateConnectionStatuses();
      }
    })();
    promise.catch(() => {
    });
    this._pendingConnects.set(address, promise);
    return promise;
  }
  /**
   * Tear down the active tunnel relay for {@link address} and cancel any
   * pending auto-reconnect. The cached tunnel entry is kept so the user
   * can re-connect later; only the live WebSocket is closed.
   */
  async _disconnectTunnel(address) {
    this._cancelReconnect(address);
    this._resetReconnectState(address);
    this._tunnelService.suppressAutoConnect(address.slice(TUNNEL_ADDRESS_PREFIX.length));
    this._previousStatuses.delete(address);
    await this._tunnelService.disconnect(address);
  }
  /**
   * Detect tunnel connections that transitioned from Connected to
   * Disconnected and schedule an auto-reconnect.
   *
   * Important: we only trigger on a Connected → Disconnected transition
   * where the connection entry is still present. If the entry has been
   * removed from the service (e.g. the user clicked "Remove Remote"),
   * we do NOT schedule a reconnect — that would override their intent.
   */
  _handleConnectionChanges() {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      return;
    }
    const cachedAddresses = new Set(this._getProviderTunnels().map((t) => `${TUNNEL_ADDRESS_PREFIX}${t.tunnelId}`));
    const currentStatuses = /* @__PURE__ */ new Map();
    for (const conn of this._remoteAgentHostService.connections) {
      currentStatuses.set(conn.address, conn.status);
    }
    for (const address of cachedAddresses) {
      const previous = this._previousStatuses.get(address);
      const current = currentStatuses.get(address);
      const wasConnected = RemoteAgentHostConnectionStatus.isConnected(previous);
      const isExplicitlyDisconnected = RemoteAgentHostConnectionStatus.isDisconnected(current);
      if (wasConnected && isExplicitlyDisconnected && !this._pendingConnects.has(address)) {
        this._logService.info(`[TunnelAgentHost] Connection lost for ${address}, scheduling reconnect`);
        if (!this._connectSessions.has(address)) {
          this._connectSessions.set(address, { startedAt: Date.now(), attempts: 0, isReconnect: true });
        }
        this._scheduleReconnect(
          address,
          /*immediate*/
          true
        );
      }
      if (current !== void 0) {
        this._previousStatuses.set(address, current);
      } else {
        this._previousStatuses.delete(address);
        this._resetReconnectState(address);
      }
    }
    for (const address of [...this._previousStatuses.keys()]) {
      if (!cachedAddresses.has(address)) {
        this._previousStatuses.delete(address);
      }
    }
  }
  _scheduleReconnect(address, immediate = false) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      return;
    }
    const tunnelId = address.slice(TUNNEL_ADDRESS_PREFIX.length);
    const cached = this._tunnelService.getCachedTunnels().find((t) => t.tunnelId === tunnelId);
    if (!cached) {
      return;
    }
    if (this._pendingConnects.has(address)) {
      return;
    }
    const live = this._remoteAgentHostService.connections.find((c) => c.address === address);
    if (live && RemoteAgentHostConnectionStatus.isConnected(live.status)) {
      this._clearReconnectBackoff(address);
      return;
    }
    this._cancelReconnect(address);
    const attempt = this._reconnectAttempts.get(address) ?? 0;
    if (attempt >= RECONNECT_MAX_ATTEMPTS) {
      this._pauseReconnect(address, "maxAttemptsReached");
      return;
    }
    const delay = immediate ? 0 : Math.min(RECONNECT_INITIAL_DELAY * Math.pow(2, attempt), RECONNECT_MAX_DELAY);
    this._logService.info(
      `[TunnelAgentHost] Scheduling reconnect for ${address} in ${delay}ms (attempt ${attempt + 1}/${RECONNECT_MAX_ATTEMPTS})`
    );
    const timer = setTimeout(() => {
      this._reconnectTimeouts.delete(address);
      if (this._pendingConnects.has(address)) {
        return;
      }
      const live2 = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (live2 && RemoteAgentHostConnectionStatus.isConnected(live2.status)) {
        this._clearReconnectBackoff(address);
        return;
      }
      this._reconnectAttempts.set(address, attempt + 1);
      this._connectTunnel(address, { userInitiated: false }).catch(() => {
      });
    }, delay);
    this._reconnectTimeouts.set(address, timer);
  }
  /**
   * Best-effort probe of whether the host backing `tunnelId` is online
   * (has any host connections). Returns `undefined` if we couldn't
   * determine — caller should treat as "retry normally" in that case.
   */
  async _probeHostOnline(tunnelId) {
    try {
      const tunnels = await this._tunnelService.listTunnels({ silent: true });
      if (!tunnels) {
        return void 0;
      }
      const info = tunnels.find((t) => t.tunnelId === tunnelId);
      if (!info) {
        return false;
      }
      return info.hostConnectionCount > 0;
    } catch {
      return void 0;
    }
  }
  _cancelReconnect(address) {
    const timer = this._reconnectTimeouts.get(address);
    if (timer !== void 0) {
      clearTimeout(timer);
      this._reconnectTimeouts.delete(address);
    }
  }
  /** Clear retry-backoff and pause state for an address. */
  _clearReconnectBackoff(address) {
    this._reconnectAttempts.delete(address);
    this._reconnectPaused.delete(address);
  }
  /** Drop all reconnect + telemetry state for an address (e.g. on removal). */
  _resetReconnectState(address) {
    this._cancelReconnect(address);
    this._clearReconnectBackoff(address);
    this._connectSessions.delete(address);
  }
  /**
   * React to auth session add/remove. Additions re-run discovery (a fresh
   * token may unblock a previously auth-paused tunnel). Removals drop any
   * tunnel state that depended on that provider — otherwise we'd sit on a
   * stale auth pause forever, or hammer a provider whose session is gone.
   */
  _handleSessionsChange(e) {
    const added = (e.event.added?.length ?? 0) > 0;
    const removed = (e.event.removed?.length ?? 0) > 0;
    if (removed) {
      const cached = this._tunnelService.getCachedTunnels();
      for (const tunnel of cached) {
        if (tunnel.authProvider !== e.providerId) {
          continue;
        }
        const address = `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`;
        this._logService.info(
          `[TunnelAgentHost] Auth session removed for ${e.providerId}; tearing down ${address}.`
        );
        this._resetReconnectState(address);
        this._tunnelService.disconnect(address).catch(() => {
        });
      }
    }
    if (added) {
      this._logService.info(`[TunnelAgentHost] ${e.providerId} session added; resuming reconnects and rediscovering.`);
      this._resumeReconnects("sessionAdded");
      this._silentStatusCheck("sessionChange");
    }
  }
  /**
   * Stop auto-reconnecting for an address until a recovery signal resumes us.
   */
  _pauseReconnect(address, reason) {
    this._cancelReconnect(address);
    this._reconnectAttempts.delete(address);
    this._reconnectPaused.add(address);
    this._logService.info(
      `[TunnelAgentHost] Pausing auto-reconnect for ${address} (${reason}); will resume on ${isWeb ? "network-online, " : ""}window focus, session change, or a status check that confirms the host is online.`
    );
    const session = this._connectSessions.get(address);
    if (session) {
      logTunnelConnectResolved(this._telemetryService, {
        isReconnect: session.isReconnect,
        totalAttempts: session.attempts,
        totalDurationMs: Date.now() - session.startedAt,
        success: false,
        failureReason: reason
      });
      this._connectSessions.delete(address);
    }
  }
  /**
   * Begin (or continue) a connect telemetry session for `address` and
   * return the bookkeeping needed to later finish the attempt. A session
   * already exists if `_handleConnectionChanges` marked this as a
   * reconnect cycle; otherwise this starts a fresh initial-connect session.
   */
  _beginConnectAttempt(address) {
    let session = this._connectSessions.get(address);
    if (!session) {
      session = { startedAt: Date.now(), attempts: 0, isReconnect: false };
      this._connectSessions.set(address, session);
    }
    session.attempts++;
    return { session, attemptNumber: session.attempts, attemptStart: Date.now(), isReconnect: session.isReconnect };
  }
  /**
   * Finalize the telemetry for a single connect attempt. On success, also
   * clears backoff state and closes the session; on failure, only the
   * per-attempt event is emitted (the caller decides whether to retry).
   */
  _finishConnectAttempt(address, args) {
    const { success, attemptNumber, attemptStart, session, isReconnect, error } = args;
    const durationMs = Date.now() - attemptStart;
    if (success) {
      this._clearReconnectBackoff(address);
      logTunnelConnectAttempt(this._telemetryService, { isReconnect, attempt: attemptNumber, durationMs, success: true });
      logTunnelConnectResolved(this._telemetryService, { isReconnect, totalAttempts: attemptNumber, totalDurationMs: Date.now() - session.startedAt, success: true });
      this._connectSessions.delete(address);
    } else {
      logTunnelConnectAttempt(this._telemetryService, { isReconnect, attempt: attemptNumber, durationMs, success: false, errorCategory: this._categorizeError(error) });
    }
  }
  _categorizeError(err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/\b(401|403)\b|token.*expired|expired.*token|invalid[_ -]?grant/i.test(message)) {
      return "authExpired";
    }
    if (/authenticat|unauthoriz|auth.*(fail|error|invalid)/i.test(message)) {
      return "auth";
    }
    if (/WebSocket relay connection failed|failed to connect to relay/i.test(message)) {
      return "relayConnectionFailed";
    }
    if (/network|fetch|offline|ECONN|ENOTFOUND|ETIMEDOUT/i.test(message)) {
      return "network";
    }
    return "other";
  }
  /**
   * Invoked on a browser network, window-focus, or authentication event. Kicks off an
   * immediate attempt for any disconnected cached tunnel.
   *
   * Rate-limited: at most one resume per RESUME_RATE_LIMIT_MS so that
   * rapid tab toggling can't hammer a permanently broken endpoint with
   * an unbounded number of attempt bursts. Resumes the normal backoff
   * sequence (by clearing the pause flag) rather than zeroing the
   * attempt counter.
   */
  _resumeReconnects(trigger) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      return;
    }
    const now = Date.now();
    if (now - this._lastResumeAt < RESUME_RATE_LIMIT_MS) {
      return;
    }
    this._lastResumeAt = now;
    const cached = this._getProviderTunnels();
    for (const tunnel of cached) {
      const address = `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`;
      if (this._pendingConnects.has(address)) {
        continue;
      }
      const live = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (live && RemoteAgentHostConnectionStatus.isConnected(live.status)) {
        continue;
      }
      this._logService.info(`[TunnelAgentHost] Resuming reconnect for ${address} (trigger: ${trigger})`);
      if (this._reconnectPaused.has(address)) {
        this._clearReconnectBackoff(address);
      }
      this._scheduleReconnect(
        address,
        /*immediate*/
        true
      );
    }
  }
  /** Drop reconnect state for addresses whose tunnel is no longer cached. */
  _pruneReconnectState() {
    const cachedAddresses = new Set(this._getProviderTunnels().map((t) => `${TUNNEL_ADDRESS_PREFIX}${t.tunnelId}`));
    const tracked = /* @__PURE__ */ new Set([
      ...this._reconnectTimeouts.keys(),
      ...this._reconnectAttempts.keys(),
      ...this._reconnectPaused,
      ...this._connectSessions.keys()
    ]);
    for (const address of tracked) {
      if (!cachedAddresses.has(address)) {
        this._resetReconnectState(address);
      }
    }
  }
  // -- Silent status check --
  async _silentStatusCheck(trigger) {
    const resolvedTrigger = trigger ?? (this._initialStatusChecked ? "rediscover" : "startup");
    const hostsEnabled = this._configurationService.getValue(RemoteAgentHostsEnabledSettingId);
    const autoConnectEnabled = this._configurationService.getValue(RemoteAgentHostAutoConnectSettingId);
    if (!hostsEnabled) {
      this._initialStatusChecked = true;
      this._updateConnectionStatuses();
      logTunnelDiscoveryResult(this._telemetryService, {
        trigger: resolvedTrigger,
        totalFound: 0,
        withActiveHost: 0,
        cachedBefore: this._tunnelService.getCachedTunnels().length,
        autoConnectEnabled,
        hostsEnabled,
        success: true
      });
      return;
    }
    this._lastStatusCheck = Date.now();
    const cachedBefore = this._tunnelService.getCachedTunnels().length;
    let onlineTunnels;
    try {
      onlineTunnels = await this._tunnelService.listTunnels({ silent: true });
    } catch {
      this._initialStatusChecked = true;
      this._updateConnectionStatuses();
      logTunnelDiscoveryResult(this._telemetryService, {
        trigger: resolvedTrigger,
        totalFound: 0,
        withActiveHost: 0,
        cachedBefore,
        autoConnectEnabled,
        hostsEnabled,
        success: false
      });
      return;
    }
    const cached = this._tunnelService.getCachedTunnels();
    if (onlineTunnels) {
      const onlineIds = new Set(onlineTunnels.map((t) => t.tunnelId));
      for (const tunnel of cached) {
        if (!onlineIds.has(tunnel.tunnelId)) {
          this._tunnelService.removeCachedTunnel(tunnel.tunnelId);
        }
      }
      const cachedIds = new Set(cached.map((t) => t.tunnelId));
      for (const tunnel of onlineTunnels) {
        if (!cachedIds.has(tunnel.tunnelId)) {
          this._tunnelService.cacheTunnel(tunnel, "github");
        }
      }
      const onlineTunnelMap = new Map(onlineTunnels.map((t) => [t.tunnelId, t]));
      for (const [address, provider] of this._providerInstances) {
        const hasConnection = this._remoteAgentHostService.connections.some(
          (c) => c.address === address && RemoteAgentHostConnectionStatus.isConnected(c.status)
        );
        if (hasConnection) {
          continue;
        }
        const tunnelId = address.slice(TUNNEL_ADDRESS_PREFIX.length);
        const info = onlineTunnelMap.get(tunnelId);
        if (info && info.hostConnectionCount > 0) {
          provider.setConnectionStatus(RemoteAgentHostConnectionStatus.connected);
          if (this._reconnectPaused.has(address)) {
            this._logService.info(
              `[TunnelAgentHost] Confirmed host online for paused ${address}; auto-resuming reconnect.`
            );
            this._clearReconnectBackoff(address);
            this._scheduleReconnect(
              address,
              /*immediate*/
              true
            );
          }
        } else {
          provider.setConnectionStatus(RemoteAgentHostConnectionStatus.disconnected);
          provider.unpublishCachedSessions();
        }
      }
      const autoConnect = this._configurationService.getValue(RemoteAgentHostAutoConnectSettingId);
      if (autoConnect) {
        for (const tunnel of onlineTunnels) {
          if (tunnel.hostConnectionCount > 0) {
            const address = `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`;
            if (this._tunnelService.isAutoConnectSuppressed(tunnel.tunnelId)) {
              continue;
            }
            const alreadyConnected = this._remoteAgentHostService.connections.some(
              (c) => c.address === address && RemoteAgentHostConnectionStatus.isConnected(c.status)
            );
            if (!alreadyConnected) {
              this._connectTunnel(address, { userInitiated: false });
            }
          }
        }
      }
    }
    this._initialStatusChecked = true;
    this._updateConnectionStatuses();
    const totalFound = onlineTunnels?.length ?? 0;
    const withActiveHost = onlineTunnels?.filter((t) => t.hostConnectionCount > 0).length ?? 0;
    this._logService.info(
      `[TunnelAgentHost] Silent status check (${resolvedTrigger}): totalFound=${totalFound}, withActiveHost=${withActiveHost}, cachedBefore=${cachedBefore}, autoConnect=${autoConnectEnabled}`
    );
    logTunnelDiscoveryResult(this._telemetryService, {
      trigger: resolvedTrigger,
      totalFound,
      withActiveHost,
      cachedBefore,
      autoConnectEnabled,
      hostsEnabled,
      success: true
    });
  }
};
TunnelAgentHostContribution = __decorateClass([
  __decorateParam(0, ITunnelAgentHostService),
  __decorateParam(1, IRemoteAgentHostService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IAuthenticationService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IHostService),
  __decorateParam(10, IAgentHostFilterService)
], TunnelAgentHostContribution);
registerWorkbenchContribution2(TunnelAgentHostContribution.ID, TunnelAgentHostContribution, WorkbenchPhase.AfterRestored);
export {
  TunnelAgentHostContribution
};
