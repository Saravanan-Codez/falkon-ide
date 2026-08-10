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
import { createHash } from "crypto";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { raceTimeout } from "../../../base/common/async.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { ILogService } from "../../log/common/log.js";
import {
  createTunnelGatewaySelectionRejectedError,
  parseTunnelGatewayInventory,
  parseTunnelGatewaySelectionResponse,
  TUNNEL_ADDRESS_PREFIX,
  TUNNEL_AGENT_HOST_PORT,
  TUNNEL_GATEWAY_MIN_PROTOCOL_VERSION,
  TUNNEL_GATEWAY_SELECT_PATH,
  TUNNEL_LAUNCHER_LABEL,
  TUNNEL_MIN_PROTOCOL_VERSION,
  TunnelTags
} from "../common/tunnelAgentHost.js";
const LOG_PREFIX = "[TunnelAgentHost]";
const TUNNEL_STEP_TIMEOUT_MS = 3e4;
async function withTimeout(op, timeoutMs, stepName) {
  let timedOut = false;
  const result = await raceTimeout(op(), timeoutMs, () => {
    timedOut = true;
  });
  if (timedOut) {
    throw new Error(`${LOG_PREFIX} ${stepName} timed out after ${timeoutMs}ms`);
  }
  return result;
}
function deriveConnectionToken(tunnelId) {
  const hash = createHash("sha256");
  hash.update(tunnelId);
  let result = hash.digest("base64url");
  if (result.startsWith("-")) {
    result = `a${result}`;
  }
  return result;
}
function rawGatewayDataToString(data) {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString();
  } else if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString();
  }
  return data.toString();
}
class TunnelConnection extends Disposable {
  constructor(connectionId, address, name, connectionToken, _relay, _relayClient) {
    super();
    this.connectionId = connectionId;
    this.address = address;
    this.name = name;
    this.connectionToken = connectionToken;
    this._relay = _relay;
    this._relayClient = _relayClient;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._closed = false;
  }
  dispose() {
    if (!this._closed) {
      this._closed = true;
      this._relay.close();
      this._relayClient.dispose();
      this._onDidClose.fire();
    }
    super.dispose();
  }
  relaySend(data) {
    this._relay.send(data);
  }
}
class PendingGatewaySelection {
  constructor(address, name, connectionToken, ws, relayClient, _onUnexpectedClose) {
    this.address = address;
    this.name = name;
    this.connectionToken = connectionToken;
    this.ws = ws;
    this.relayClient = relayClient;
    this._onUnexpectedClose = _onUnexpectedClose;
    this._disposed = false;
    this._onSocketClosed = () => {
      if (!this._disposed) {
        this._onUnexpectedClose();
      }
    };
    this.ws.once("close", this._onSocketClosed);
  }
  /** Detach the auto-cleanup listener so ownership of the socket can transfer to a live {@link TunnelConnection}. */
  detach() {
    this.ws.off("close", this._onSocketClosed);
  }
  dispose() {
    if (!this._disposed) {
      this._disposed = true;
      this.ws.off("close", this._onSocketClosed);
      try {
        this.ws.close();
      } catch {
      }
      try {
        this.relayClient.dispose();
      } catch {
      }
    }
  }
}
let TunnelAgentHostMainService = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._onDidRelayMessage = this._register(new Emitter());
    this.onDidRelayMessage = this._onDidRelayMessage.event;
    this._onDidRelayClose = this._register(new Emitter());
    this.onDidRelayClose = this._onDidRelayClose.event;
    this._connections = /* @__PURE__ */ new Map();
    this._pendingSelections = this._register(new DisposableMap());
  }
  async listTunnels(token, authProvider, additionalTunnelNames) {
    const client = await this._createManagementClient(token, authProvider);
    const results = [];
    const seen = /* @__PURE__ */ new Set();
    try {
      const tunnels = await client.listTunnels(void 0, void 0, {
        labels: [TUNNEL_LAUNCHER_LABEL],
        requireAllLabels: true,
        includePorts: true,
        tokenScopes: ["connect"]
      });
      for (const tunnel of tunnels) {
        const info = this._parseTunnelInfo(tunnel);
        if (info && info.protocolVersion >= TUNNEL_MIN_PROTOCOL_VERSION) {
          results.push(info);
          seen.add(info.tunnelId);
        }
      }
    } catch (err) {
      this._logService.error(`${LOG_PREFIX} Failed to enumerate tunnels`, err);
    }
    if (additionalTunnelNames) {
      for (const tunnelName of additionalTunnelNames) {
        try {
          const [tunnel] = await client.listTunnels(void 0, void 0, {
            labels: [tunnelName, TUNNEL_LAUNCHER_LABEL],
            requireAllLabels: true,
            includePorts: true,
            tokenScopes: ["connect"],
            limit: 1
          });
          if (tunnel) {
            const info = this._parseTunnelInfo(tunnel);
            if (info && info.protocolVersion >= TUNNEL_MIN_PROTOCOL_VERSION && !seen.has(info.tunnelId)) {
              results.push(info);
              seen.add(info.tunnelId);
            }
          }
        } catch (err) {
          this._logService.warn(`${LOG_PREFIX} Failed to look up tunnel '${tunnelName}'`, err);
        }
      }
    }
    this._logService.info(`${LOG_PREFIX} Found ${results.length} tunnel(s) with agent host support`);
    return results;
  }
  async deleteTunnel(token, authProvider, tunnelId, clusterId) {
    const client = await this._createManagementClient(token, authProvider);
    const tunnel = { tunnelId, clusterId };
    this._logService.info(`${LOG_PREFIX} Deleting tunnel ${tunnelId} in cluster ${clusterId}...`);
    await client.deleteTunnel(tunnel);
    this._closeTunnelConnections(tunnelId, "deleting");
    this._logService.info(`${LOG_PREFIX} Deleted tunnel ${tunnelId}`);
  }
  async connect(token, authProvider, tunnelId, clusterId) {
    this._closeTunnelConnections(tunnelId, "reconnecting");
    const client = await this._createManagementClient(token, authProvider);
    const connectionId = generateUuid();
    const address = `${TUNNEL_ADDRESS_PREFIX}${tunnelId}`;
    this._logService.info(`${LOG_PREFIX} Connecting to tunnel ${tunnelId} in cluster ${clusterId}...`);
    const tunnel = { tunnelId, clusterId };
    const resolved = await client.getTunnel(tunnel, {
      includePorts: true,
      tokenScopes: ["connect"]
    });
    if (!resolved) {
      throw new Error(`${LOG_PREFIX} Tunnel ${tunnelId} not found`);
    }
    const { TunnelRelayTunnelClient } = await import("@microsoft/dev-tunnels-connections");
    const relayClient = new TunnelRelayTunnelClient(client);
    relayClient.acceptLocalConnectionsForForwardedPorts = false;
    if (resolved.endpoints) {
      relayClient.endpoints = resolved.endpoints;
    }
    let portStream;
    try {
      await withTimeout(() => relayClient.connect(resolved), TUNNEL_STEP_TIMEOUT_MS, "tunnel relay connect");
      this._logService.info(`${LOG_PREFIX} Tunnel relay connected, waiting for port ${TUNNEL_AGENT_HOST_PORT}...`);
      await withTimeout(() => relayClient.waitForForwardedPort(TUNNEL_AGENT_HOST_PORT), TUNNEL_STEP_TIMEOUT_MS, `wait for forwarded port ${TUNNEL_AGENT_HOST_PORT}`);
      portStream = await withTimeout(() => relayClient.connectToForwardedPort(TUNNEL_AGENT_HOST_PORT), TUNNEL_STEP_TIMEOUT_MS, `connect to forwarded port ${TUNNEL_AGENT_HOST_PORT}`);
      this._logService.info(`${LOG_PREFIX} Connected to forwarded port ${TUNNEL_AGENT_HOST_PORT}`);
    } catch (err) {
      try {
        relayClient.dispose();
      } catch {
      }
      throw err;
    }
    const connectionToken = deriveConnectionToken(tunnelId);
    const tags = new TunnelTags(resolved.labels);
    const name = tags.name || resolved.name || tunnelId;
    let relay;
    try {
      relay = await withTimeout(
        () => this._createWebSocketRelay(portStream, connectionToken, connectionId),
        TUNNEL_STEP_TIMEOUT_MS,
        "WebSocket relay open"
      );
    } catch (err) {
      try {
        relayClient.dispose();
      } catch {
      }
      throw err;
    }
    const conn = new TunnelConnection(
      connectionId,
      address,
      name,
      connectionToken,
      relay,
      relayClient
    );
    const onConnClose = conn.onDidClose(() => {
      onConnClose.dispose();
      this._connections.delete(connectionId);
      this._onDidRelayClose.fire(connectionId);
    });
    this._connections.set(connectionId, conn);
    return {
      connectionId,
      address,
      name,
      connectionToken,
      // Legacy v5 tunnels have no gateway inventory, so `connect` always
      // reuses a single deterministic target with no picker involved.
      selected: { serverType: "unknown", instanceId: "", role: "primary", lifecycle: "external" }
    };
  }
  async prepareSelection(token, authProvider, tunnelId, clusterId) {
    const client = await this._createManagementClient(token, authProvider);
    const tunnel = { tunnelId, clusterId };
    const resolved = await client.getTunnel(tunnel, {
      includePorts: true,
      tokenScopes: ["connect"]
    });
    if (!resolved) {
      throw new Error(`${LOG_PREFIX} Tunnel ${tunnelId} not found`);
    }
    const tags = new TunnelTags(resolved.labels);
    if (tags.protocolVersion < TUNNEL_GATEWAY_MIN_PROTOCOL_VERSION) {
      return void 0;
    }
    this._logService.info(`${LOG_PREFIX} Preparing gateway selection for tunnel ${tunnelId} in cluster ${clusterId}...`);
    const { TunnelRelayTunnelClient } = await import("@microsoft/dev-tunnels-connections");
    const relayClient = new TunnelRelayTunnelClient(client);
    relayClient.acceptLocalConnectionsForForwardedPorts = false;
    if (resolved.endpoints) {
      relayClient.endpoints = resolved.endpoints;
    }
    let ws;
    try {
      await withTimeout(() => relayClient.connect(resolved), TUNNEL_STEP_TIMEOUT_MS, "tunnel relay connect");
      await withTimeout(() => relayClient.waitForForwardedPort(TUNNEL_AGENT_HOST_PORT), TUNNEL_STEP_TIMEOUT_MS, `wait for forwarded port ${TUNNEL_AGENT_HOST_PORT}`);
      const portStream = await withTimeout(() => relayClient.connectToForwardedPort(TUNNEL_AGENT_HOST_PORT), TUNNEL_STEP_TIMEOUT_MS, `connect to forwarded port ${TUNNEL_AGENT_HOST_PORT}`);
      ws = await withTimeout(() => this._openGatewaySelectSocket(portStream), TUNNEL_STEP_TIMEOUT_MS, "gateway selection WebSocket open");
    } catch (err) {
      try {
        relayClient.dispose();
      } catch {
      }
      throw err;
    }
    let inventoryText;
    try {
      inventoryText = await withTimeout(() => this._readNextGatewayMessage(ws), TUNNEL_STEP_TIMEOUT_MS, "gateway inventory message");
    } catch (err) {
      try {
        ws.close();
      } catch {
      }
      try {
        relayClient.dispose();
      } catch {
      }
      throw err;
    }
    const inventory = parseTunnelGatewayInventory(inventoryText);
    const connectionToken = deriveConnectionToken(tunnelId);
    const name = tags.name || resolved.name || tunnelId;
    const address = `${TUNNEL_ADDRESS_PREFIX}${tunnelId}`;
    const selectionId = generateUuid();
    this._pendingSelections.set(selectionId, new PendingGatewaySelection(
      address,
      name,
      connectionToken,
      ws,
      relayClient,
      () => {
        this._logService.warn(`${LOG_PREFIX} Gateway selection WebSocket for ${selectionId} closed before a selection was made`);
        this._pendingSelections.deleteAndDispose(selectionId);
      }
    ));
    return { selectionId, inventory };
  }
  async completeSelection(selectionId, selection) {
    const pending = this._pendingSelections.deleteAndLeak(selectionId);
    if (!pending) {
      throw new Error(`${LOG_PREFIX} No pending gateway selection with id ${selectionId}`);
    }
    pending.detach();
    const { ws, relayClient, address, name, connectionToken } = pending;
    let responseText;
    try {
      ws.send(JSON.stringify(selection));
      responseText = await withTimeout(() => this._readNextGatewayMessage(ws), TUNNEL_STEP_TIMEOUT_MS, "gateway selection acknowledgement");
    } catch (err) {
      try {
        ws.close();
      } catch {
      }
      try {
        relayClient.dispose();
      } catch {
      }
      throw err;
    }
    const response = parseTunnelGatewaySelectionResponse(responseText);
    if (!response.ok) {
      try {
        ws.close();
      } catch {
      }
      try {
        relayClient.dispose();
      } catch {
      }
      throw createTunnelGatewaySelectionRejectedError(`${LOG_PREFIX} ${response.error}`);
    }
    const connectionId = generateUuid();
    const relay = this._attachRelaySteadyStateHandlers(ws, connectionId);
    const conn = new TunnelConnection(connectionId, address, name, connectionToken, relay, relayClient);
    const onConnClose = conn.onDidClose(() => {
      onConnClose.dispose();
      this._connections.delete(connectionId);
      this._onDidRelayClose.fire(connectionId);
    });
    this._connections.set(connectionId, conn);
    this._logService.info(`${LOG_PREFIX} Gateway selection ${selectionId} completed: selected ${response.selected.serverType} ${response.selected.instanceId}`);
    return { connectionId, address, name, connectionToken, selected: response.selected };
  }
  async cancelSelection(selectionId) {
    this._pendingSelections.deleteAndDispose(selectionId);
  }
  async relaySend(connectionId, message) {
    const conn = this._connections.get(connectionId);
    if (conn) {
      conn.relaySend(message);
    }
  }
  async disconnect(connectionId) {
    const conn = this._connections.get(connectionId);
    if (conn) {
      conn.dispose();
    }
  }
  async _createManagementClient(token, authProvider) {
    const mgmt = await import("@microsoft/dev-tunnels-management");
    const authHeader = authProvider === "github" ? `github ${token}` : `Bearer ${token}`;
    return new mgmt.TunnelManagementHttpClient(
      "vscode-sessions",
      mgmt.ManagementApiVersions.Version20230927preview,
      async () => authHeader
    );
  }
  _closeTunnelConnections(tunnelId, operation) {
    const address = `${TUNNEL_ADDRESS_PREFIX}${tunnelId}`;
    for (const [connectionId, connection] of this._connections) {
      if (connection.address === address) {
        this._logService.info(`${LOG_PREFIX} Closing existing relay for tunnel ${tunnelId} before ${operation}`);
        this._connections.delete(connectionId);
        connection.dispose();
      }
    }
  }
  _parseTunnelInfo(tunnel) {
    const labels = tunnel.labels ?? [];
    const tags = new TunnelTags(labels);
    if (tags.protocolVersion < TUNNEL_MIN_PROTOCOL_VERSION) {
      return void 0;
    }
    const tunnelId = tunnel.tunnelId;
    const clusterId = tunnel.clusterId;
    if (!tunnelId || !clusterId) {
      return void 0;
    }
    const name = tags.name || tunnel.name || tunnelId;
    const rawCount = tunnel.status?.hostConnectionCount;
    const hostConnectionCount = typeof rawCount === "number" ? rawCount : rawCount?.current ?? 0;
    return {
      tunnelId,
      clusterId,
      name,
      tags: labels,
      protocolVersion: tags.protocolVersion,
      hostConnectionCount
    };
  }
  async _createWebSocketRelay(portStream, connectionToken, connectionId) {
    const WS = await import("ws");
    return new Promise((resolve, reject) => {
      let url = `ws://localhost:${TUNNEL_AGENT_HOST_PORT}`;
      if (connectionToken) {
        url += `?tkn=${encodeURIComponent(connectionToken)}`;
      }
      const ws = new WS.WebSocket(url, {
        createConnection: (() => portStream)
      });
      ws.on("open", () => {
        this._logService.info(`${LOG_PREFIX} WebSocket relay connected to agent host via tunnel`);
        resolve(this._attachRelaySteadyStateHandlers(ws, connectionId));
      });
      ws.on("error", (wsErr) => {
        this._logService.warn(`${LOG_PREFIX} WebSocket relay error: ${wsErr instanceof Error ? wsErr.message : String(wsErr)}`);
        reject(wsErr);
      });
    });
  }
  /**
   * Attach the steady-state message-pump handlers ('message'/'close') to an
   * already-open agent host WebSocket, shared between the legacy
   * direct-reuse relay and the protocol-v6 gateway relay (which reuses the
   * same WebSocket used for inventory/selection once a selection succeeds).
   */
  _attachRelaySteadyStateHandlers(ws, connectionId) {
    ws.on("message", (data) => {
      this._onDidRelayMessage.fire({ connectionId, data: rawGatewayDataToString(data) });
    });
    ws.on("close", (code, reason) => {
      this._logService.info(`${LOG_PREFIX} WebSocket relay closed for connection ${connectionId}; code=${code}, reason=${reason?.toString() || "(empty)"}`);
      const conn = this._connections.get(connectionId);
      if (conn) {
        conn.dispose();
      }
    });
    return {
      send: (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(data);
        }
      },
      close: () => ws.close()
    };
  }
  /**
   * Open the protocol-v6 gateway's selection WebSocket route over an
   * already-connected tunnel port stream. No `?tkn=` query parameter is
   * needed: connections arriving through the tunnel relay bypass the
   * gateway's loopback per-request token check entirely (only used for
   * the local, non-tunneled accept loop on the CLI side).
   */
  async _openGatewaySelectSocket(portStream) {
    const WS = await import("ws");
    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${TUNNEL_AGENT_HOST_PORT}${TUNNEL_GATEWAY_SELECT_PATH}`;
      const ws = new WS.WebSocket(url, {
        createConnection: (() => portStream)
      });
      const onError = (wsErr) => reject(wsErr);
      ws.once("open", () => {
        ws.off("error", onError);
        resolve(ws);
      });
      ws.once("error", onError);
    });
  }
  /**
   * Await exactly one message on a gateway WebSocket — used to read the
   * one-time inventory message and, later, the one-time selection
   * acknowledgement, both of which precede the raw AHP frame-proxying
   * phase that reuses the same socket.
   */
  _readNextGatewayMessage(ws) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        ws.off("message", onMessage);
        ws.off("close", onClose);
        ws.off("error", onError);
      };
      const onMessage = (data) => {
        cleanup();
        resolve(rawGatewayDataToString(data));
      };
      const onClose = (code, reason) => {
        cleanup();
        reject(new Error(`${LOG_PREFIX} Gateway WebSocket closed before expected message; code=${code}, reason=${reason?.toString() || "(empty)"}`));
      };
      const onError = (wsErr) => {
        cleanup();
        reject(wsErr);
      };
      ws.once("message", onMessage);
      ws.once("close", onClose);
      ws.once("error", onError);
    });
  }
};
TunnelAgentHostMainService = __decorateClass([
  __decorateParam(0, ILogService)
], TunnelAgentHostMainService);
function setPendingGatewaySelectionForTests(service, selectionId, pending) {
  service._pendingSelections.set(selectionId, pending);
}
function deletePendingGatewaySelectionForTests(service, selectionId) {
  service._pendingSelections.deleteAndDispose(selectionId);
}
export {
  PendingGatewaySelection,
  TUNNEL_STEP_TIMEOUT_MS,
  TunnelAgentHostMainService,
  deletePendingGatewaySelectionForTests,
  setPendingGatewaySelectionForTests,
  withTimeout
};
