import { Disposable } from "../../../base/common/lifecycle.js";
const AGENT_HOST_CLIENT_CONNECTION_HISTORY_RETENTION = 3e4 * 10;
class AgentHostClientConnectionTelemetryTracker extends Disposable {
  constructor(_historyRetentionMs = AGENT_HOST_CLIENT_CONNECTION_HISTORY_RETENTION) {
    super();
    this._historyRetentionMs = _historyRetentionMs;
    this._recentlyDisconnectedClients = /* @__PURE__ */ new Map();
    this._activeTransports = /* @__PURE__ */ new Map();
  }
  hasSeenClient(clientId) {
    this._pruneDisconnectedClientHistory();
    return this._activeTransports.has(clientId) || this._recentlyDisconnectedClients.has(clientId);
  }
  connect(clientId, transportToken) {
    const isReconnect = this.hasSeenClient(clientId);
    this._recentlyDisconnectedClients.delete(clientId);
    let transports = this._activeTransports.get(clientId);
    if (!transports) {
      transports = /* @__PURE__ */ new Set();
      this._activeTransports.set(clientId, transports);
    }
    transports.add(transportToken);
    return { isReconnect, ...this._counts(clientId) };
  }
  disconnect(clientId, transportToken) {
    const transports = this._activeTransports.get(clientId);
    transports?.delete(transportToken);
    if (transports?.size === 0) {
      this._activeTransports.delete(clientId);
      this._recentlyDisconnectedClients.set(clientId, Date.now());
    }
    this._pruneDisconnectedClientHistory();
    return this._counts(clientId);
  }
  dispose() {
    this._recentlyDisconnectedClients.clear();
    this._activeTransports.clear();
    super.dispose();
  }
  _pruneDisconnectedClientHistory() {
    const cutoff = Date.now() - this._historyRetentionMs;
    for (const [clientId, disconnectedAt] of this._recentlyDisconnectedClients) {
      if (disconnectedAt <= cutoff) {
        this._recentlyDisconnectedClients.delete(clientId);
      }
    }
  }
  _counts(clientId) {
    let connectedTransportCount = 0;
    for (const transports of this._activeTransports.values()) {
      connectedTransportCount += transports.size;
    }
    return {
      connectedClientCount: this._activeTransports.size,
      connectedTransportCount,
      clientTransportCount: this._activeTransports.get(clientId)?.size ?? 0
    };
  }
}
export {
  AGENT_HOST_CLIENT_CONNECTION_HISTORY_RETENTION,
  AgentHostClientConnectionTelemetryTracker
};
