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
import { IntervalTimer } from "../../../../../base/common/async.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { IRemoteAgentHostService, RemoteAgentHostAutoConnectSettingId, RemoteAgentHostConnectionStatus, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { IWSLRemoteAgentHostService, WSL_ADDRESS_PREFIX } from "../../../../../platform/agentHost/common/wslRemoteAgentHost.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { ManagedReconnectAgentHostContribution } from "./managedReconnectAgentHostContribution.js";
const WSL_RECONNECT_INITIAL_DELAY = 1e3;
const WSL_RECONNECT_MAX_DELAY = 3e4;
const WSL_RECONNECT_MAX_ATTEMPTS = 10;
const WSL_RECONNECT_PAUSE_AUTO_RESUME_MS = 5 * 60 * 1e3;
const WSL_RUNNING_POLL_MS = 5 * 60 * 1e3;
function shouldPauseWSLReconnectAfterFailure(err) {
  return isCancellationError(err);
}
let WSLAgentHostContribution = class extends ManagedReconnectAgentHostContribution {
  constructor(remoteAgentHostService, _wslService, configurationService, logService, instantiationService, sessionsProvidersService, notificationService) {
    super(remoteAgentHostService, configurationService, logService, instantiationService, sessionsProvidersService, notificationService);
    this._wslService = _wslService;
    /** Distros that were running at the last poll; used to detect newly-running distros. */
    this._lastKnownRunningDistros = /* @__PURE__ */ new Set();
    this._register(this._remoteAgentHostService.onDidChangeConnections(() => {
      this._resumeReconnects("WSL");
      this._reconcile();
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(RemoteAgentHostsEnabledSettingId) || e.affectsConfiguration(RemoteAgentHostAutoConnectSettingId)) {
        this._resumeReconnects("WSL");
        this._reconcile();
      }
    }));
    this._reconcile();
    this._register(new IntervalTimer()).cancelAndSet(
      () => void this._reconnectWSLEntriesIfRunning(),
      WSL_RUNNING_POLL_MS
    );
  }
  static {
    this.ID = "sessions.contrib.wslAgentHostContribution";
  }
  _reconcile() {
    this._reconcileProviders();
    this._wireConnections();
    this._updateConnectionStatuses();
    void this._reconnectWSLEntriesIfRunning();
  }
  // -- Provider management --
  _reconcileProviders() {
    const entries = this._enabled ? this._getCachedWSLEntries() : [];
    const desiredAddresses = new Set(entries.map((e) => e.address));
    for (const [address] of this._providerStores) {
      if (!desiredAddresses.has(address)) {
        this._providerStores.deleteAndDispose(address);
      }
    }
    for (const entry of entries) {
      const existing = this._providerInstances.get(entry.address);
      if (existing && existing.label !== (entry.name || entry.address)) {
        this._providerStores.deleteAndDispose(entry.address);
      }
      if (!this._providerStores.has(entry.address)) {
        this._createProvider(entry.address, entry.name, {
          // WSL: an explicit user click should boot a stopped distro
          // (`wsl.exe -d <distro>` boots it). The "never auto-boot"
          // rule only applies to the periodic auto-reconnect path.
          connectOnDemand: () => this._connectWSLOnDemand(entry.distro, entry.name, entry.address),
          disconnectOnDemand: () => this._disconnectWSLOnDemand(entry.distro, entry.address),
          onDidReportConnectProgress: this._wslService.onDidReportConnectProgress
        });
      }
    }
  }
  /** Wire live connections to their providers so session operations work. */
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
  _updateConnectionStatuses() {
    for (const [address, provider] of this._providerInstances) {
      const connectionInfo = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (connectionInfo) {
        provider.setConnectionStatus(connectionInfo.status);
      } else if (this._pendingReconnects.has(this._distroForAddress(address))) {
        provider.setConnectionStatus(RemoteAgentHostConnectionStatus.connecting);
      } else if (!RemoteAgentHostConnectionStatus.isIncompatible(provider.connectionStatus.get())) {
        provider.setConnectionStatus(RemoteAgentHostConnectionStatus.disconnected);
      }
    }
  }
  _distroForAddress(address) {
    return address.startsWith(WSL_ADDRESS_PREFIX) ? address.slice(WSL_ADDRESS_PREFIX.length) : address;
  }
  _getCachedWSLEntries() {
    return this._wslService.getCachedDistros().map(({ distro, name }) => ({
      distro,
      name,
      address: `${WSL_ADDRESS_PREFIX}${distro}`
    }));
  }
  // -- Auto-reconnect --
  /**
   * Re-establish WSL connections for cached distros that are already
   * running. Never auto-boots a distro; only acts on user-initiated boots
   * observed via {@link IWSLRemoteAgentHostService.listRunningDistros}.
   */
  async _reconnectWSLEntriesIfRunning() {
    if (!isWindows) {
      return;
    }
    if (!this._enabled) {
      this._reconnectStates.clearAndDisposeAll();
      return;
    }
    const running = new Set(await this._wslService.listRunningDistros().catch(() => []));
    const newlyRunning = [];
    for (const distro of running) {
      if (!this._lastKnownRunningDistros.has(distro)) {
        newlyRunning.push(distro);
      }
    }
    this._lastKnownRunningDistros = running;
    if (newlyRunning.length > 0) {
      this._logService.info(`[WSLAgentHost] Newly running WSL distro(s): ${newlyRunning.join(", ")}`);
    }
    const autoConnect = this._configurationService.getValue(RemoteAgentHostAutoConnectSettingId);
    const entries = this._getCachedWSLEntries();
    const stillCached = /* @__PURE__ */ new Set();
    for (const entry of entries) {
      stillCached.add(entry.distro);
      if (!running.has(entry.distro)) {
        continue;
      }
      const hasConnection = this._remoteAgentHostService.connections.some(
        (c) => c.address === entry.address && RemoteAgentHostConnectionStatus.isConnected(c.status)
      );
      if (hasConnection) {
        this._reconnectStates.deleteAndDispose(entry.distro);
        continue;
      }
      if (this._pendingReconnects.has(entry.distro)) {
        this._logService.trace(`[WSLAgentHost] WSL reconnect for ${entry.distro}: reconnect already in progress, skipping`);
        continue;
      }
      const state = this._reconnectStates.get(entry.distro);
      if (state?.hasPendingTimer) {
        this._logService.trace(`[WSLAgentHost] WSL reconnect for ${entry.distro}: retry timer already scheduled, skipping`);
        continue;
      }
      if (state?.paused) {
        const pausedMs = Date.now() - state.pausedAt;
        if (pausedMs < WSL_RECONNECT_PAUSE_AUTO_RESUME_MS) {
          this._logService.trace(`[WSLAgentHost] WSL reconnect for ${entry.distro}: paused (${Math.round(pausedMs / 1e3)}s ago), skipping`);
          continue;
        }
        this._logService.info(`[WSLAgentHost] WSL reconnect for ${entry.distro}: auto-resuming after ${Math.round(pausedMs / 1e3)}s pause`);
        state.resetForResume();
      }
      if (!autoConnect) {
        this._logService.trace(`[WSLAgentHost] WSL reconnect for ${entry.distro}: auto-connect disabled, skipping`);
        continue;
      }
      void this._attemptWSLReconnect(entry.distro, entry.name, entry.address);
    }
    for (const distro of [...this._reconnectStates.keys()]) {
      if (!stillCached.has(distro)) {
        this._reconnectStates.deleteAndDispose(distro);
      }
    }
  }
  async _attemptWSLReconnect(distro, name, address, options = {}) {
    await this._attemptManagedReconnect({
      kind: "WSL",
      key: distro,
      address,
      userInitiated: !!options.userInitiated,
      maxAttempts: WSL_RECONNECT_MAX_ATTEMPTS,
      shouldPause: shouldPauseWSLReconnectAfterFailure,
      // WSL-specific gate: never auto-boot a stopped distro. The gate is
      // skipped on user-initiated attempts (the user explicitly clicked
      // Reconnect — `wsl.exe -d <distro>` will boot it). When the gate
      // triggers we return WITHOUT incrementing `attempts` so a long stop
      // doesn't burn the retry budget.
      preCheck: async (userInitiated) => {
        if (userInitiated) {
          return void 0;
        }
        const stillCached = this._wslService.getCachedDistros().some((d) => d.distro === distro);
        if (!stillCached) {
          this._reconnectStates.deleteAndDispose(distro);
          return { skip: true };
        }
        const running = new Set(await this._wslService.listRunningDistros().catch(() => []));
        this._lastKnownRunningDistros = running;
        if (!running.has(distro)) {
          return { skip: true, reason: `distro ${distro} not running` };
        }
        return void 0;
      },
      doConnect: () => this._wslService.reconnect(distro, name).then(() => void 0),
      schedule: (state) => this._scheduleWSLReconnect(distro, name, address, state)
    });
  }
  _scheduleWSLReconnect(distro, name, address, state) {
    const delay = Math.min(WSL_RECONNECT_INITIAL_DELAY * Math.pow(2, state.attempts - 1), WSL_RECONNECT_MAX_DELAY);
    this._logService.info(`[WSLAgentHost] Scheduling WSL reconnect for ${distro} in ${delay}ms (attempt ${state.attempts + 1}/${WSL_RECONNECT_MAX_ATTEMPTS})`);
    state.scheduleRetry(delay, () => {
      if (!this._enabled) {
        this._reconnectStates.deleteAndDispose(distro);
        return;
      }
      if (!this._configurationService.getValue(RemoteAgentHostAutoConnectSettingId)) {
        return;
      }
      const live = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (live && RemoteAgentHostConnectionStatus.isConnected(live.status)) {
        this._reconnectStates.deleteAndDispose(distro);
        return;
      }
      if (this._pendingReconnects.has(distro)) {
        return;
      }
      void this._attemptWSLReconnect(distro, name, address);
    });
  }
  // -- On-demand connection --
  async _connectWSLOnDemand(distro, name, address) {
    while (true) {
      const inFlight = this._pendingReconnects.get(distro);
      if (!inFlight) {
        break;
      }
      await inFlight.catch(() => void 0);
      const live = this._remoteAgentHostService.connections.find((c) => c.address === address);
      if (live && RemoteAgentHostConnectionStatus.isConnected(live.status)) {
        return;
      }
    }
    this._reconnectStates.get(distro)?.resetForResume();
    await this._attemptWSLReconnect(distro, name, address, { userInitiated: true });
  }
  /**
   * Tear down the active WSL connection for {@link distro} and cancel any
   * pending auto-reconnect. Removes the cached distro so it won't auto-reconnect.
   *
   * Order matters: `removeRemoteAgentHost` MUST run before the WSL service
   * teardown so the subsequent close event can't trip auto-reconnect.
   */
  async _disconnectWSLOnDemand(distro, address) {
    this._reconnectStates.deleteAndDispose(distro);
    await this._remoteAgentHostService.removeRemoteAgentHost(address);
    await this._wslService.disconnect(distro);
  }
};
WSLAgentHostContribution = __decorateClass([
  __decorateParam(0, IRemoteAgentHostService),
  __decorateParam(1, IWSLRemoteAgentHostService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ISessionsProvidersService),
  __decorateParam(6, INotificationService)
], WSLAgentHostContribution);
registerWorkbenchContribution2(WSLAgentHostContribution.ID, WSLAgentHostContribution, WorkbenchPhase.AfterRestored);
export {
  WSLAgentHostContribution,
  shouldPauseWSLReconnectAfterFailure
};
