import { disposableTimeout } from "../../../../../base/common/async.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { RemoteAgentHostConnectionStatus, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { PROTOCOL_VERSION } from "../../../../../platform/agentHost/common/state/protocol/version/registry.js";
import { RemoteAgentHostSessionsProvider } from "./remoteAgentHostSessionsProvider.js";
import { watchForIncompatibleNotifications } from "./remoteHostOptions.js";
class ManagedReconnectState extends Disposable {
  constructor() {
    super(...arguments);
    this._timer = this._register(new MutableDisposable());
    /** Consecutive failed reconnect attempts. */
    this.attempts = 0;
    /** True after we've given up auto-reconnecting until something resumes us. */
    this.paused = false;
    /** Wall-clock timestamp when {@link paused} was last set to true. */
    this.pausedAt = 0;
  }
  get hasPendingTimer() {
    return !!this._timer.value;
  }
  scheduleRetry(delayMs, handler) {
    this._timer.value = disposableTimeout(() => {
      this._timer.value = void 0;
      handler();
    }, delayMs);
  }
  cancelTimer() {
    this._timer.clear();
  }
  resetForResume() {
    this.attempts = 0;
    this.paused = false;
    this._timer.clear();
  }
}
class ManagedReconnectAgentHostContribution extends Disposable {
  constructor(_remoteAgentHostService, _configurationService, _logService, _instantiationService, _sessionsProvidersService, _notificationService) {
    super();
    this._remoteAgentHostService = _remoteAgentHostService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._notificationService = _notificationService;
    /** Per-address sessions provider stores. */
    this._providerStores = this._register(new DisposableMap());
    this._providerInstances = /* @__PURE__ */ new Map();
    /** Per-key auto-reconnect state (timer + attempts + paused). */
    this._reconnectStates = this._register(new DisposableMap());
    /**
     * In-flight reconnect attempts keyed by reconnect-state key. Stored so
     * concurrent on-demand callers join the existing attempt rather than
     * racing it.
     */
    this._pendingReconnects = /* @__PURE__ */ new Map();
  }
  get _enabled() {
    return this._configurationService.getValue(RemoteAgentHostsEnabledSettingId);
  }
  // -- Provider registry --
  _createProvider(address, name, options) {
    const store = new DisposableStore();
    const provider = this._instantiationService.createInstance(
      RemoteAgentHostSessionsProvider,
      {
        address,
        name,
        connectOnDemand: options.connectOnDemand,
        disconnectOnDemand: options.disconnectOnDemand,
        onDidReportConnectProgress: options.onDidReportConnectProgress
      }
    );
    if (options.initialStatus !== void 0) {
      provider.setConnectionStatus(options.initialStatus);
    }
    store.add(provider);
    store.add(this._sessionsProvidersService.registerProvider(provider));
    store.add(watchForIncompatibleNotifications(provider, this._instantiationService, this._notificationService));
    this._providerInstances.set(address, provider);
    store.add(toDisposable(() => this._providerInstances.delete(address)));
    this._providerStores.set(address, store);
    return provider;
  }
  // -- Managed auto-reconnect --
  _getOrCreateReconnectState(key) {
    let state = this._reconnectStates.get(key);
    if (!state) {
      state = new ManagedReconnectState();
      this._reconnectStates.set(key, state);
    }
    return state;
  }
  /**
   * Resume auto-reconnect for any paused entries. Called when a fresh
   * trigger (config change, new connection event) gives paused hosts another
   * chance. Returns the number of entries resumed.
   */
  _resumeReconnects(logKind) {
    let resumed = 0;
    for (const [, state] of this._reconnectStates) {
      if (state.paused) {
        state.resetForResume();
        resumed++;
      }
    }
    if (resumed > 0) {
      this._logService.info(`[RemoteAgentHost] Resuming ${logKind} auto-reconnect for ${resumed} paused host(s)`);
    }
    return resumed;
  }
  /**
   * Shared retry-loop body for managed-reconnect entries. Handles
   * `connecting`/`disconnected`/`incompatible` provider status, cached-session
   * unpublishing on failure, pause-on-cancel, and pause-after-max-attempts.
   * Type-specific behaviour is provided via {@link IManagedReconnectAttemptOptions}.
   */
  async _attemptManagedReconnect(opts) {
    const runPromise = (async () => {
      const state = this._getOrCreateReconnectState(opts.key);
      const attempt = state.attempts;
      const provider = this._providerInstances.get(opts.address);
      if (opts.userInitiated) {
        provider?.setConnectionStatus(RemoteAgentHostConnectionStatus.connecting);
      }
      this._logService.info(`[RemoteAgentHost] Re-establishing ${opts.kind} connection for ${opts.key} (attempt ${attempt + 1})`);
      try {
        if (opts.preCheck) {
          const result = await opts.preCheck(opts.userInitiated);
          if (result?.skip) {
            if (result.reason) {
              this._logService.info(`[RemoteAgentHost] ${opts.kind} reconnect for ${opts.key}: ${result.reason}; skipping`);
            }
            return;
          }
        }
        await opts.doConnect();
        this._reconnectStates.deleteAndDispose(opts.key);
        this._logService.info(`[RemoteAgentHost] ${opts.kind} connection re-established for ${opts.key}`);
      } catch (err) {
        if (!this._enabled) {
          this._reconnectStates.deleteAndDispose(opts.key);
          return;
        }
        if (opts.userInitiated) {
          provider?.setConnectionStatus(RemoteAgentHostConnectionStatus.disconnected);
        }
        if (opts.shouldPause(err)) {
          this._logService.info(`[RemoteAgentHost] Pausing ${opts.kind} auto-reconnect for ${opts.key} after user cancellation`);
          provider?.unpublishCachedSessions();
          const liveState2 = this._getOrCreateReconnectState(opts.key);
          liveState2.paused = true;
          liveState2.pausedAt = Date.now();
          return;
        }
        this._logService.error(`[RemoteAgentHost] ${opts.kind} reconnect failed for ${opts.key}`, err);
        const incompatible = RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION]);
        if (incompatible) {
          provider?.setConnectionStatus(incompatible);
          this._reconnectStates.deleteAndDispose(opts.key);
          return;
        }
        provider?.unpublishCachedSessions();
        const liveState = this._getOrCreateReconnectState(opts.key);
        liveState.attempts = attempt + 1;
        if (liveState.attempts >= opts.maxAttempts) {
          this._logService.info(`[RemoteAgentHost] Pausing ${opts.kind} auto-reconnect for ${opts.key} after ${liveState.attempts} consecutive failures`);
          liveState.paused = true;
          liveState.pausedAt = Date.now();
          return;
        }
        if (opts.userInitiated) {
          return;
        }
        opts.schedule(liveState);
      }
    })();
    this._pendingReconnects.set(opts.key, runPromise);
    try {
      await runPromise;
    } finally {
      this._pendingReconnects.delete(opts.key);
    }
  }
}
export {
  ManagedReconnectAgentHostContribution,
  ManagedReconnectState
};
