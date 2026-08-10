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
import { RemoteAgentHostProtocolClient } from "../../../../../platform/agentHost/browser/remoteAgentHostProtocolClient.js";
import { agentsWindowAgentHostClientInfo } from "../../../../../platform/agentHost/common/agentHostClientInfo.js";
import { AgentHostClientConnectionKind } from "../../../../../platform/agentHost/common/agentHostTelemetry.js";
import { RemoteAgentHostEntryType, IRemoteAgentHostService, RemoteAgentHostConnectionStatus, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { PROTOCOL_VERSION } from "../../../../../platform/agentHost/common/state/protocol/version/registry.js";
import { MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD, MALFORMED_FRAMES_LOG_CAP } from "../../../../../platform/agentHost/common/transportConstants.js";
import {
  TUNNEL_ADDRESS_PREFIX,
  TUNNEL_MIN_PROTOCOL_VERSION,
  TunnelTags
} from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../../../workbench/services/environment/browser/environmentService.js";
import { IAuthenticationService } from "../../../../../workbench/services/authentication/common/authentication.js";
const LOG_PREFIX = "[WebTunnelAgentHost]";
const CACHED_TUNNELS_KEY = "tunnelAgentHost.recentTunnels";
const AUTO_CONNECT_SUPPRESSED_TUNNELS_KEY = "tunnelAgentHost.autoConnectSuppressedTunnels";
let WebTunnelAgentHostService = class extends Disposable {
  constructor(_remoteAgentHostService, environmentService, _logService, _instantiationService, _configurationService, _authenticationService, _storageService) {
    super();
    this._remoteAgentHostService = _remoteAgentHostService;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._authenticationService = _authenticationService;
    this._storageService = _storageService;
    this._onDidChangeTunnels = this._register(new Emitter());
    this.onDidChangeTunnels = this._onDidChangeTunnels.event;
    this._discoveryProvider = environmentService.options?.tunnelDiscoveryProvider;
    if (!this._discoveryProvider) {
      this._logService.debug(`${LOG_PREFIX} No tunnelDiscoveryProvider \u2014 tunnel discovery disabled`);
    }
  }
  // Discovery
  async listTunnels(options) {
    if (!this._discoveryProvider) {
      return [];
    }
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      return [];
    }
    try {
      const discovered = await this._discoveryProvider.listTunnels();
      const results = [];
      let droppedByProtocolVersion = 0;
      let withoutIds = 0;
      for (const tunnel of discovered) {
        const info = this._toTunnelInfo(tunnel);
        if (!info) {
          withoutIds++;
          continue;
        }
        if (info.protocolVersion < TUNNEL_MIN_PROTOCOL_VERSION) {
          droppedByProtocolVersion++;
          this._logService.debug(
            `${LOG_PREFIX} Dropping tunnel ${info.tunnelId} (protocolVersion=${info.protocolVersion} < ${TUNNEL_MIN_PROTOCOL_VERSION})`
          );
          continue;
        }
        results.push(info);
      }
      const withActiveHost = results.filter((t) => t.hostConnectionCount > 0).length;
      this._logService.info(
        `${LOG_PREFIX} Discovery complete: total=${discovered.length}, accepted=${results.length}, withActiveHost=${withActiveHost}, droppedByProtocolVersion=${droppedByProtocolVersion}, droppedMissingIds=${withoutIds}`
      );
      return results;
    } catch (err) {
      this._logService.error(`${LOG_PREFIX} Failed to list tunnels`, err);
      return [];
    }
  }
  _toTunnelInfo(tunnel) {
    if (!tunnel.tunnelId || !tunnel.clusterId) {
      return void 0;
    }
    const tags = new TunnelTags(tunnel.tags);
    return {
      tunnelId: tunnel.tunnelId,
      clusterId: tunnel.clusterId,
      name: tags.name || tunnel.name || tunnel.tunnelId,
      tags: tunnel.tags,
      protocolVersion: tags.protocolVersion,
      hostConnectionCount: tunnel.hostConnectionCount
    };
  }
  // Connection (via embedder)
  async connect(tunnel, authProvider) {
    if (!this._discoveryProvider) {
      throw new Error("No tunnelDiscoveryProvider available");
    }
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const { tunnelId, clusterId } = tunnel;
    this._logService.info(`${LOG_PREFIX} Connecting to tunnel '${tunnel.name}' (${tunnelId})`);
    const connection = await this._discoveryProvider.connect(tunnelId, clusterId);
    const connectionToken = await deriveConnectionToken(tunnelId);
    const transport = new TunnelConnectionTransport(connection, this._logService);
    const address = `${TUNNEL_ADDRESS_PREFIX}${tunnelId}`;
    const protocolClient = this._instantiationService.createInstance(
      RemoteAgentHostProtocolClient,
      address,
      transport,
      void 0,
      void 0,
      agentsWindowAgentHostClientInfo
    );
    let status = RemoteAgentHostConnectionStatus.connected;
    let connectError;
    try {
      await protocolClient.connect();
      this._logService.info(`${LOG_PREFIX} Protocol handshake completed with ${address}`);
    } catch (err) {
      const incompatible = RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION]);
      if (!RemoteAgentHostConnectionStatus.isIncompatible(incompatible)) {
        protocolClient.dispose();
        this._logService.error(`${LOG_PREFIX} Connection setup failed`, err);
        throw err;
      }
      this._logService.warn(`${LOG_PREFIX} Incompatible with ${address}: ${incompatible.message}`);
      status = incompatible;
      connectError = err;
    }
    this.cacheTunnel(tunnel, authProvider);
    try {
      await this._remoteAgentHostService.addManagedConnection({
        name: tunnel.name,
        connectionToken,
        connection: {
          type: RemoteAgentHostEntryType.Tunnel,
          tunnelId,
          clusterId,
          label: tunnel.name,
          authProvider
        }
      }, protocolClient, void 0, status);
    } catch (err) {
      protocolClient.dispose();
      this._logService.error(`${LOG_PREFIX} addManagedConnection failed`, err);
      throw err;
    }
    if (connectError) {
      throw connectError;
    }
  }
  get canDeleteTunnels() {
    return !!this._discoveryProvider?.deleteTunnel;
  }
  async deleteTunnel(tunnel) {
    const provider = this._discoveryProvider;
    if (!provider?.deleteTunnel) {
      throw new Error("Deleting dev tunnels is not supported by the tunnel discovery provider.");
    }
    await provider.deleteTunnel(tunnel.tunnelId, tunnel.clusterId);
    this.removeCachedTunnel(tunnel.tunnelId);
  }
  async disconnect(address) {
    await this._remoteAgentHostService.removeRemoteAgentHost(address);
    this._onDidChangeTunnels.fire();
  }
  // Auth
  async getAuthProvider(options) {
    for (const provider of ["github", "microsoft"]) {
      const sessions = await this._authenticationService.getSessions(provider, void 0, {}, true);
      if (sessions.length > 0) {
        return provider;
      }
    }
    return void 0;
  }
  // Tunnel cache
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
WebTunnelAgentHostService = __decorateClass([
  __decorateParam(0, IRemoteAgentHostService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IAuthenticationService),
  __decorateParam(6, IStorageService)
], WebTunnelAgentHostService);
class TunnelConnectionTransport extends Disposable {
  constructor(_connection, _logService) {
    super();
    this._connection = _connection;
    this._logService = _logService;
    this.clientConnectionKind = AgentHostClientConnectionKind.DevTunnel;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._malformedFrames = 0;
    this._register(_connection.onMessage((data) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch (err) {
        this._malformedFrames++;
        if (this._malformedFrames <= MALFORMED_FRAMES_LOG_CAP) {
          const preview = data.length > 80 ? data.slice(0, 80) + "\u2026" : data;
          this._logService.warn(
            `[TunnelConnectionTransport] Malformed frame #${this._malformedFrames} (len=${data.length}): ${preview}`,
            err instanceof Error ? err.message : String(err)
          );
        }
        if (this._malformedFrames > MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD) {
          this._logService.warn(
            "[TunnelConnectionTransport] Malformed frame threshold exceeded; forcing tunnel close."
          );
          this._connection.close();
        }
        return;
      }
      this._onMessage.fire(message);
    }));
    this._register(_connection.onClose(() => {
      this._onClose.fire();
    }));
  }
  send(message) {
    this._connection.send(JSON.stringify(message));
  }
  dispose() {
    this._connection.close();
    super.dispose();
  }
}
async function deriveConnectionToken(tunnelId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(tunnelId);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  let result = btoa(String.fromCharCode(...hashArray)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (result.startsWith("-")) {
    result = "a" + result;
  }
  return result;
}
export {
  WebTunnelAgentHostService
};
