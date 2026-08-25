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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { hasKey } from "../../../../../base/common/types.js";
import { ProxyChannel } from "../../../../../base/parts/ipc/common/ipc.js";
import { localize } from "../../../../../nls.js";
import { IAuthenticationService } from "../../../../../workbench/services/authentication/common/authentication.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ISharedProcessService } from "../../../../../platform/ipc/electron-browser/services.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus, RemoteAgentHostEntryType, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { IRemoteAgentHostLocationPreferenceService } from "../../../../../platform/agentHost/common/remoteAgentHostLocationPreference.js";
import { promptRemoteAgentHostLocationPreference } from "../../../../../platform/agentHost/common/remoteAgentHostLocationPreferenceDialog.js";
import { PROTOCOL_VERSION } from "../../../../../platform/agentHost/common/state/protocol/version/registry.js";
import {
  isTunnelGatewaySelectionRejectedError,
  TUNNEL_ADDRESS_PREFIX,
  TUNNEL_AGENT_HOST_CHANNEL,
  TunnelAgentHostsSettingId
} from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { AhpJsonlLogger } from "../../../../../platform/agentHost/common/ahpJsonlLogger.js";
import { AgentHostAhpJsonlLoggingSettingId } from "../../../../../platform/agentHost/common/agentService.js";
import { RemoteAgentHostProtocolClient } from "../../../../../platform/agentHost/browser/remoteAgentHostProtocolClient.js";
import { agentsWindowAgentHostClientInfo } from "../../../../../platform/agentHost/common/agentHostClientInfo.js";
import { TunnelRelayTransport } from "../../../../../platform/agentHost/electron-browser/tunnelRelayTransport.js";
const LOG_PREFIX = "[TunnelAgentHost]";
const CACHED_TUNNELS_KEY = "tunnelAgentHost.recentTunnels";
const AUTO_CONNECT_SUPPRESSED_TUNNELS_KEY = "tunnelAgentHost.autoConnectSuppressedTunnels";
function sortedGatewayEndpoints(inventory, type) {
  return inventory.endpoints.filter((endpoint) => endpoint.type === type).sort((a, b) => a.instanceId.localeCompare(b.instanceId));
}
function selectEditorGatewayEndpoint(inventory) {
  return sortedGatewayEndpoints(inventory, "editor")[0];
}
function selectDedicatedGatewayFallback(inventory) {
  const standalone = sortedGatewayEndpoints(inventory, "standalone")[0];
  return standalone ? { instanceId: standalone.instanceId } : { newDedicated: true };
}
function selectGatewayFallbackAfterRejection(rejected, inventory) {
  if (!hasKey(rejected, { instanceId: true })) {
    return void 0;
  }
  const standalone = sortedGatewayEndpoints(inventory, "standalone").find((endpoint) => endpoint.instanceId !== rejected.instanceId);
  return standalone ? { instanceId: standalone.instanceId } : { newDedicated: true };
}
function isEditorGatewaySelection(selection, inventory) {
  return hasKey(selection, { instanceId: true }) && inventory.endpoints.some((endpoint) => endpoint.instanceId === selection.instanceId && endpoint.type === "editor");
}
async function resolveGatewaySelection(locationPreferenceService, dialogService, request) {
  const { hostKey, hostLabel, productName, inventory, userInitiated } = request;
  const editor = selectEditorGatewayEndpoint(inventory);
  const preference = locationPreferenceService.getPreference(hostKey);
  if (preference === "editor") {
    return editor ? { instanceId: editor.instanceId } : selectDedicatedGatewayFallback(inventory);
  }
  if (preference === "dedicated" || !editor || !userInitiated) {
    return selectDedicatedGatewayFallback(inventory);
  }
  const chosen = await promptRemoteAgentHostLocationPreference(dialogService, hostLabel, productName);
  if (!chosen) {
    return void 0;
  }
  locationPreferenceService.setPreference(hostKey, chosen);
  return chosen === "editor" ? { instanceId: editor.instanceId } : selectDedicatedGatewayFallback(inventory);
}
function shouldNotifyTunnelFailover(previousServerType, newServerType, userInitiated, editorFallback = false) {
  if (editorFallback) {
    return newServerType === "standalone" && previousServerType !== "standalone";
  }
  return !userInitiated && previousServerType === "editor" && newServerType === "standalone";
}
function shouldTrackTunnelConnection(connectError) {
  return !connectError;
}
class TunnelFailoverTracker {
  constructor() {
    this._lastSelectedServerType = /* @__PURE__ */ new Map();
  }
  /**
   * Record a successful registration for `address` and report whether it
   * should trigger a failover notification. Always updates the retained
   * metadata, regardless of the returned value.
   */
  recordAndShouldNotify(address, newServerType, userInitiated, editorFallback = false) {
    const previousServerType = this._lastSelectedServerType.get(address);
    const notify = shouldNotifyTunnelFailover(previousServerType, newServerType, userInitiated, editorFallback);
    this._lastSelectedServerType.set(address, newServerType);
    return notify;
  }
}
let TunnelAgentHostService = class extends Disposable {
  constructor(sharedProcessService, _remoteAgentHostService, _logService, _instantiationService, _configurationService, _authenticationService, _productService, _storageService, _environmentService, _locationPreferenceService, _dialogService, _notificationService) {
    super();
    this._remoteAgentHostService = _remoteAgentHostService;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._authenticationService = _authenticationService;
    this._productService = _productService;
    this._storageService = _storageService;
    this._environmentService = _environmentService;
    this._locationPreferenceService = _locationPreferenceService;
    this._dialogService = _dialogService;
    this._notificationService = _notificationService;
    this._onDidChangeTunnels = this._register(new Emitter());
    this.onDidChangeTunnels = this._onDidChangeTunnels.event;
    /** See {@link TunnelFailoverTracker}. */
    this._failoverTracker = new TunnelFailoverTracker();
    this.canDeleteTunnels = true;
    this._mainService = ProxyChannel.toService(
      sharedProcessService.getChannel(TUNNEL_AGENT_HOST_CHANNEL)
    );
  }
  async listTunnels(options) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      return [];
    }
    const silent = options?.silent ?? false;
    const auth = await this._getToken(silent);
    if (!auth) {
      if (silent) {
        this._logService.debug(`${LOG_PREFIX} No cached token available for silent tunnel enumeration`);
      } else {
        this._logService.warn(`${LOG_PREFIX} No auth token available for tunnel enumeration`);
      }
      return [];
    }
    const additionalNames = this._configurationService.getValue(TunnelAgentHostsSettingId) ?? [];
    return this._mainService.listTunnels(auth.token, auth.provider, additionalNames.length > 0 ? additionalNames : void 0);
  }
  async connect(tunnel, authProvider, options) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const auth = authProvider ? await this._getTokenForProvider(authProvider, false) : await this._getToken(false);
    if (!auth) {
      throw new Error("No authentication available");
    }
    this._logService.info(`${LOG_PREFIX} Connecting to tunnel '${tunnel.name}' (${tunnel.tunnelId})`);
    const session = await this._mainService.prepareSelection(auth.token, auth.provider, tunnel.tunnelId, tunnel.clusterId);
    let result;
    let editorFallback = false;
    if (session) {
      const selection = await resolveGatewaySelection(this._locationPreferenceService, this._dialogService, {
        hostKey: `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`,
        hostLabel: tunnel.name,
        productName: this._productService.nameShort,
        inventory: session.inventory,
        userInitiated: options?.userInitiated ?? true
      });
      if (!selection) {
        this._logService.info(`${LOG_PREFIX} Agent host selection cancelled for tunnel '${tunnel.name}'`);
        await this._mainService.cancelSelection(session.selectionId);
        return;
      }
      const completed = await this._completeSelectionWithFallback(auth, tunnel, session, selection);
      result = completed.result;
      editorFallback = completed.editorFallback;
    } else {
      result = await this._mainService.connect(auth.token, auth.provider, tunnel.tunnelId, tunnel.clusterId);
    }
    this._logService.info(`${LOG_PREFIX} Tunnel relay connected, connectionId=${result.connectionId}`);
    let protocolClient;
    try {
      const ahpLoggingEnabled = !!this._configurationService.getValue(AgentHostAhpJsonlLoggingSettingId);
      const logger = ahpLoggingEnabled ? this._instantiationService.createInstance(
        AhpJsonlLogger,
        { logsHome: this._environmentService.logsHome, connectionId: result.connectionId, transport: "tunnel" }
      ) : void 0;
      const transport = new TunnelRelayTransport(result.connectionId, this._mainService, logger);
      protocolClient = this._instantiationService.createInstance(
        RemoteAgentHostProtocolClient,
        result.address,
        transport,
        void 0,
        void 0,
        agentsWindowAgentHostClientInfo
      );
    } catch (err) {
      this._logService.error(`${LOG_PREFIX} Connection setup failed`, err);
      this._mainService.disconnect(result.connectionId).catch(() => {
      });
      throw err;
    }
    let status = RemoteAgentHostConnectionStatus.connected;
    let connectError;
    try {
      await protocolClient.connect();
      this._logService.info(`${LOG_PREFIX} Protocol handshake completed with ${result.address}`);
    } catch (err) {
      const incompatible = RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION]);
      if (!RemoteAgentHostConnectionStatus.isIncompatible(incompatible)) {
        this._logService.error(`${LOG_PREFIX} Connection setup failed`, err);
        protocolClient.dispose();
        this._mainService.disconnect(result.connectionId).catch(() => {
        });
        throw err;
      }
      this._logService.warn(`${LOG_PREFIX} Incompatible with ${result.address}: ${incompatible.message}`);
      status = incompatible;
      connectError = err;
    }
    this.cacheTunnel(tunnel, auth.provider);
    try {
      await this._remoteAgentHostService.addManagedConnection({
        name: result.name,
        connectionToken: result.connectionToken,
        connection: {
          type: RemoteAgentHostEntryType.Tunnel,
          tunnelId: tunnel.tunnelId,
          clusterId: tunnel.clusterId,
          label: tunnel.name,
          authProvider: auth.provider
        }
      }, protocolClient, void 0, status);
    } catch (err) {
      this._logService.error(`${LOG_PREFIX} addManagedConnection failed`, err);
      protocolClient.dispose();
      this._mainService.disconnect(result.connectionId).catch(() => {
      });
      throw err;
    }
    if (!shouldTrackTunnelConnection(connectError)) {
      throw connectError;
    }
    this._notifyIfTunnelFailover(result, options, editorFallback);
  }
  /**
   * Send `selection` over the prepared gateway session and, if the gateway
   * *rejects* it, transparently retry once against a dedicated agent host.
   *
   * A rejection (see {@link isTunnelGatewaySelectionRejectedError}) is the
   * one failure that proves the tunnel itself is healthy: the CLI answered,
   * it simply could not hand us the endpoint we asked for because that
   * agent host is no longer alive. Its registry entry can outlive it (the
   * entry is only pruned once the owning PID dies, which a crashed or
   * detached editor agent host may not do promptly), so the inventory keeps
   * advertising it and every reconnect would otherwise pick it again and
   * fail — the connection stays down for the whole backoff window instead
   * of failing over. Retrying here fails over within the same attempt.
   *
   * Every other failure means the tunnel is unreachable, and is rethrown so
   * the caller keeps retrying the same destination and selection unchanged.
   * The stored location preference is never mutated by a fallback, so the
   * editor host is preferred again as soon as it is back.
   */
  async _completeSelectionWithFallback(auth, tunnel, session, selection) {
    try {
      return { result: await this._mainService.completeSelection(session.selectionId, selection), editorFallback: false };
    } catch (err) {
      if (!isTunnelGatewaySelectionRejectedError(err)) {
        throw err;
      }
      const wasEditor = isEditorGatewaySelection(selection, session.inventory);
      this._logService.warn(`${LOG_PREFIX} Gateway rejected the selected agent host for tunnel '${tunnel.name}', falling back to a dedicated agent host: ${err instanceof Error ? err.message : String(err)}`);
      const retry = await this._mainService.prepareSelection(auth.token, auth.provider, tunnel.tunnelId, tunnel.clusterId);
      if (!retry) {
        throw err;
      }
      const fallback = selectGatewayFallbackAfterRejection(selection, retry.inventory);
      if (!fallback) {
        await this._mainService.cancelSelection(retry.selectionId);
        throw err;
      }
      const result = await this._mainService.completeSelection(retry.selectionId, fallback);
      return { result, editorFallback: wasEditor && result.selected.serverType === "standalone" };
    }
  }
  /**
   * After a successful {@link addManagedConnection} registration, compare
   * the newly selected endpoint's server type against the last one
   * successfully registered for this tunnel's stable address and, if this
   * was a silent editor → standalone failover, show a single informational
   * notification. Delegates the retention + decision to
   * {@link TunnelFailoverTracker}, which always records this connection
   * for future comparisons regardless of whether a notification was shown.
   *
   * `editorFallback` reports that {@link _completeSelectionWithFallback}
   * already performed the substitution within this very attempt, which
   * notifies on its own — see {@link shouldNotifyTunnelFailover}.
   */
  _notifyIfTunnelFailover(result, options, editorFallback) {
    const userInitiated = options?.userInitiated ?? true;
    const shouldNotify = this._failoverTracker.recordAndShouldNotify(result.address, result.selected.serverType, userInitiated, editorFallback);
    if (shouldNotify) {
      this._notificationService.notify({
        severity: Severity.Info,
        // The in-attempt fallback can happen on a first connect too,
        // where nothing was interrupted and nothing was reconnected.
        message: editorFallback ? localize(
          "tunnelAgentHostRejectedEditorNotification",
          "The editor agent host is no longer running. Connected to a dedicated agent host instead."
        ) : localize(
          "tunnelAgentHostFailoverNotification",
          "The editor agent host exited. Reconnected to a dedicated agent host. In-progress work may have been interrupted."
        )
      });
    }
  }
  async deleteTunnel(tunnel) {
    const auth = await this._getToken(false);
    if (!auth) {
      throw new Error("No authentication available");
    }
    this._logService.info(`${LOG_PREFIX} Deleting tunnel '${tunnel.name}' (${tunnel.tunnelId})`);
    await this._mainService.deleteTunnel(auth.token, auth.provider, tunnel.tunnelId, tunnel.clusterId);
    this.removeCachedTunnel(tunnel.tunnelId);
  }
  async disconnect(address) {
    await this._remoteAgentHostService.removeRemoteAgentHost(address);
    this._onDidChangeTunnels.fire();
  }
  /**
   * Get an auth token, trying cached sessions first (silent),
   * then prompting interactively if `silent` is false.
   */
  async _getToken(silent) {
    if (this._lastAuthProvider) {
      const result = await this._getTokenForProvider(this._lastAuthProvider, silent);
      if (result) {
        return result;
      }
    }
    for (const provider of ["github", "microsoft"]) {
      if (provider === this._lastAuthProvider) {
        continue;
      }
      const result = await this._getTokenForProvider(provider, true);
      if (result) {
        return result;
      }
    }
    return void 0;
  }
  /**
   * Get a token for a specific auth provider.
   * @param provider The auth provider to use.
   * @param silent If true, only try cached sessions. If false, prompt the user.
   */
  _getScopesForProvider(provider) {
    const config = this._productService.tunnelApplicationConfig?.authenticationProviders;
    return config?.[provider]?.scopes ?? [];
  }
  async _getTokenForProvider(provider, silent) {
    const providerId = provider;
    const scopes = this._getScopesForProvider(provider);
    if (scopes.length === 0) {
      return void 0;
    }
    try {
      let sessions = await this._authenticationService.getSessions(providerId, scopes, {}, true);
      if (sessions.length === 0) {
        const allSessions = await this._authenticationService.getSessions(providerId, void 0, {}, true);
        const requestedSet = new Set(scopes);
        let bestSession;
        let bestExtra = Infinity;
        for (const session of allSessions) {
          const sessionScopes = new Set(session.scopes);
          let isSuperset = true;
          for (const scope of requestedSet) {
            if (!sessionScopes.has(scope)) {
              isSuperset = false;
              break;
            }
          }
          if (isSuperset) {
            const extra = sessionScopes.size - requestedSet.size;
            if (extra < bestExtra) {
              bestExtra = extra;
              bestSession = session;
            }
          }
        }
        if (bestSession) {
          sessions = [bestSession];
        }
      }
      if (sessions.length === 0 && !silent) {
        const session = await this._authenticationService.createSession(providerId, scopes, { activateImmediate: true });
        sessions = [session];
      }
      if (sessions.length > 0) {
        const token = sessions[0].accessToken;
        if (token) {
          this._lastAuthProvider = provider;
          return { token, provider };
        }
      }
    } catch (err) {
      this._logService.debug(`${LOG_PREFIX} Failed to get ${provider} token: ${err}`);
    }
    return void 0;
  }
  async getAuthProvider(options) {
    const result = await this._getToken(options?.silent ?? true);
    return result?.provider;
  }
  getCachedTunnels() {
    const raw = this._storageService.get(CACHED_TUNNELS_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  cacheTunnel(tunnel, authProvider) {
    const cached = this.getCachedTunnels();
    const filtered = cached.filter((t) => t.tunnelId !== tunnel.tunnelId);
    filtered.unshift({
      tunnelId: tunnel.tunnelId,
      clusterId: tunnel.clusterId,
      name: tunnel.name,
      authProvider
    });
    this.clearAutoConnectSuppression(tunnel.tunnelId);
    this._storeCachedTunnels(filtered);
    this._onDidChangeTunnels.fire();
  }
  removeCachedTunnel(tunnelId) {
    const cached = this.getCachedTunnels();
    this._storeCachedTunnels(cached.filter((t) => t.tunnelId !== tunnelId));
    this.clearAutoConnectSuppression(tunnelId);
    this._onDidChangeTunnels.fire();
  }
  isAutoConnectSuppressed(tunnelId) {
    return this._getAutoConnectSuppressedTunnels().has(tunnelId);
  }
  suppressAutoConnect(tunnelId) {
    const suppressed = this._getAutoConnectSuppressedTunnels();
    suppressed.add(tunnelId);
    this._storeAutoConnectSuppressedTunnels(suppressed);
  }
  clearAutoConnectSuppression(tunnelId) {
    const suppressed = this._getAutoConnectSuppressedTunnels();
    if (!suppressed.delete(tunnelId)) {
      return;
    }
    this._storeAutoConnectSuppressedTunnels(suppressed);
  }
  _storeCachedTunnels(tunnels) {
    if (tunnels.length === 0) {
      this._storageService.remove(CACHED_TUNNELS_KEY, StorageScope.APPLICATION);
    } else {
      this._storageService.store(CACHED_TUNNELS_KEY, JSON.stringify(tunnels), StorageScope.APPLICATION, StorageTarget.USER);
    }
  }
  _getAutoConnectSuppressedTunnels() {
    const raw = this._storageService.get(AUTO_CONNECT_SUPPRESSED_TUNNELS_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return /* @__PURE__ */ new Set();
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return /* @__PURE__ */ new Set();
      }
      return new Set(parsed.filter((item) => typeof item === "string"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  _storeAutoConnectSuppressedTunnels(tunnelIds) {
    if (tunnelIds.size === 0) {
      this._storageService.remove(AUTO_CONNECT_SUPPRESSED_TUNNELS_KEY, StorageScope.APPLICATION);
    } else {
      this._storageService.store(AUTO_CONNECT_SUPPRESSED_TUNNELS_KEY, JSON.stringify([...tunnelIds]), StorageScope.APPLICATION, StorageTarget.USER);
    }
  }
};
TunnelAgentHostService = __decorateClass([
  __decorateParam(0, ISharedProcessService),
  __decorateParam(1, IRemoteAgentHostService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IAuthenticationService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IEnvironmentService),
  __decorateParam(9, IRemoteAgentHostLocationPreferenceService),
  __decorateParam(10, IDialogService),
  __decorateParam(11, INotificationService)
], TunnelAgentHostService);
export {
  TunnelAgentHostService,
  TunnelFailoverTracker,
  resolveGatewaySelection,
  selectDedicatedGatewayFallback,
  selectEditorGatewayEndpoint,
  selectGatewayFallbackAfterRejection,
  shouldNotifyTunnelFailover,
  shouldTrackTunnelConnection
};
