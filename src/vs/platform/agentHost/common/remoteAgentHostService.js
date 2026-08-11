import { Event } from "../../../base/common/event.js";
import { connectionTokenQueryName } from "../../../base/common/network.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { AHP_UNSUPPORTED_PROTOCOL_VERSION, ProtocolError } from "./state/sessionProtocol.js";
import { readUnsupportedProtocolVersionErrorMeta } from "./state/protocolUpgrade.js";
import { TUNNEL_ADDRESS_PREFIX } from "./tunnelAgentHost.js";
var RemoteAgentHostConnectionStatus;
((RemoteAgentHostConnectionStatus2) => {
  RemoteAgentHostConnectionStatus2.connected = Object.freeze({ kind: "connected" });
  RemoteAgentHostConnectionStatus2.connecting = Object.freeze({ kind: "connecting" });
  RemoteAgentHostConnectionStatus2.disconnected = Object.freeze({ kind: "disconnected" });
  function incompatible(message, supportedByClient, offeredByServer, vscodeUpgradeMethod) {
    return Object.freeze({ kind: "incompatible", message, supportedByClient, offeredByServer, vscodeUpgradeMethod });
  }
  RemoteAgentHostConnectionStatus2.incompatible = incompatible;
  function isConnected(status) {
    return status?.kind === "connected";
  }
  RemoteAgentHostConnectionStatus2.isConnected = isConnected;
  function isConnecting(status) {
    return status?.kind === "connecting";
  }
  RemoteAgentHostConnectionStatus2.isConnecting = isConnecting;
  function isDisconnected(status) {
    return status?.kind === "disconnected";
  }
  RemoteAgentHostConnectionStatus2.isDisconnected = isDisconnected;
  function isIncompatible(status) {
    return status?.kind === "incompatible";
  }
  RemoteAgentHostConnectionStatus2.isIncompatible = isIncompatible;
  function isUnavailable(status) {
    return status?.kind !== "connected";
  }
  RemoteAgentHostConnectionStatus2.isUnavailable = isUnavailable;
  function fromConnectError(err, supportedByClient) {
    if (err instanceof ProtocolError && err.code === AHP_UNSUPPORTED_PROTOCOL_VERSION) {
      const data = err.data;
      const offeredByServer = Array.isArray(data?.supportedVersions) ? data.supportedVersions : void 0;
      const vscodeUpgradeMethod = readUnsupportedProtocolVersionErrorMeta(err.data)?.vscodeUpgradeMethod;
      return incompatible(err.message, supportedByClient, offeredByServer, vscodeUpgradeMethod);
    }
    return void 0;
  }
  RemoteAgentHostConnectionStatus2.fromConnectError = fromConnectError;
})(RemoteAgentHostConnectionStatus || (RemoteAgentHostConnectionStatus = {}));
const RemoteAgentHostsSettingId = "chat.remoteAgentHosts";
const RemoteAgentHostsEnabledSettingId = "chat.remoteAgentHostsEnabled";
const RemoteAgentHostAutoConnectSettingId = "chat.remoteAgentHostsAutoConnect";
var RemoteAgentHostEntryType = /* @__PURE__ */ ((RemoteAgentHostEntryType2) => {
  RemoteAgentHostEntryType2["WebSocket"] = "websocket";
  RemoteAgentHostEntryType2["SSH"] = "ssh";
  RemoteAgentHostEntryType2["WSL"] = "wsl";
  RemoteAgentHostEntryType2["Tunnel"] = "tunnel";
  RemoteAgentHostEntryType2["CloudSandbox"] = "cloudSandbox";
  return RemoteAgentHostEntryType2;
})(RemoteAgentHostEntryType || {});
const WEBSOCKET_ENTRY_TYPE_CONFIG = {
  type: "websocket" /* WebSocket */,
  store: "settings",
  selfConnecting: true,
  normalizedAddress: true,
  address: (connection) => connection.address,
  toRaw: (entry, connection) => ({
    address: connection.address,
    name: entry.name,
    connectionToken: entry.connectionToken
  }),
  fromRaw: (raw) => ({ name: raw.name, connectionToken: raw.connectionToken, connection: { type: "websocket" /* WebSocket */, address: raw.address } })
};
const SSH_ENTRY_TYPE_CONFIG = {
  type: "ssh" /* SSH */,
  store: "storage",
  selfConnecting: false,
  normalizedAddress: true,
  address: (connection) => connection.address,
  toRaw: (entry, connection) => ({
    address: connection.address,
    name: entry.name,
    connectionToken: entry.connectionToken,
    sshConfigHost: connection.sshConfigHost,
    sshHostName: connection.hostName,
    sshUser: connection.user,
    sshPort: connection.port
  }),
  fromRaw: (raw) => ({
    name: raw.name,
    connectionToken: raw.connectionToken,
    connection: { type: "ssh" /* SSH */, address: raw.address, sshConfigHost: raw.sshConfigHost, hostName: raw.sshHostName ?? raw.address, user: raw.sshUser, port: raw.sshPort }
  })
};
function runtimeEntryTypeConfig(type, normalizedAddress, address) {
  return { type, store: "runtime", selfConnecting: false, normalizedAddress, address };
}
const WSL_ENTRY_TYPE_CONFIG = runtimeEntryTypeConfig("wsl" /* WSL */, true, (connection) => connection.address);
const TUNNEL_ENTRY_TYPE_CONFIG = runtimeEntryTypeConfig("tunnel" /* Tunnel */, false, (connection) => `${TUNNEL_ADDRESS_PREFIX}${connection.tunnelId}`);
const CLOUD_SANDBOX_ENTRY_TYPE_CONFIG = runtimeEntryTypeConfig("cloudSandbox" /* CloudSandbox */, true, (connection) => connection.address);
const ENTRY_TYPE_CONFIGS = {
  ["websocket" /* WebSocket */]: WEBSOCKET_ENTRY_TYPE_CONFIG,
  ["ssh" /* SSH */]: SSH_ENTRY_TYPE_CONFIG,
  ["wsl" /* WSL */]: WSL_ENTRY_TYPE_CONFIG,
  ["tunnel" /* Tunnel */]: TUNNEL_ENTRY_TYPE_CONFIG,
  ["cloudSandbox" /* CloudSandbox */]: CLOUD_SANDBOX_ENTRY_TYPE_CONFIG
};
function getEntryTypeConfig(type) {
  return ENTRY_TYPE_CONFIGS[type];
}
function getEntryAddress(entry) {
  return getEntryTypeConfig(entry.connection.type).address(entry.connection);
}
function remoteAgentHostLogOutputChannelId(address) {
  return `agentHost.otlp.${address}`;
}
const AGENT_HOST_LOG_OUTPUT_CHANNEL_ID = "agenthost";
var RemoteAgentHostInputValidationError = /* @__PURE__ */ ((RemoteAgentHostInputValidationError2) => {
  RemoteAgentHostInputValidationError2["Empty"] = "empty";
  RemoteAgentHostInputValidationError2["Invalid"] = "invalid";
  return RemoteAgentHostInputValidationError2;
})(RemoteAgentHostInputValidationError || {});
const IRemoteAgentHostService = createDecorator("remoteAgentHostService");
class NullRemoteAgentHostService {
  constructor() {
    this.onDidChangeConnections = Event.None;
    this.connections = [];
    this.configuredEntries = [];
  }
  getConnection() {
    return void 0;
  }
  getConnectionByAuthority() {
    return void 0;
  }
  async addRemoteAgentHost() {
    throw new Error("Remote agent host connections are not supported in this environment.");
  }
  async removeRemoteAgentHost(_address) {
  }
  reconnect(_address) {
  }
  notifyConnectionClosed(_address) {
  }
  async addManagedConnection() {
    throw new Error("Remote agent host connections are not supported in this environment.");
  }
  getEntryByAddress() {
    return void 0;
  }
  async triggerServerUpgrade() {
    throw new Error("Remote agent host connections are not supported in this environment.");
  }
}
function parseRemoteAgentHostInput(input) {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return { error: "empty" /* Empty */ };
  }
  const candidate = extractRemoteAgentHostCandidate(trimmedInput);
  if (!candidate) {
    return { error: "invalid" /* Invalid */ };
  }
  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(candidate);
  try {
    const url = new URL(hasExplicitScheme ? candidate : `ws://${candidate}`);
    const normalizedProtocol = normalizeRemoteAgentHostProtocol(url.protocol);
    if (!normalizedProtocol || !url.host) {
      return { error: "invalid" /* Invalid */ };
    }
    const connectionToken = url.searchParams.get(connectionTokenQueryName) ?? void 0;
    url.searchParams.delete(connectionTokenQueryName);
    const address = formatRemoteAgentHostAddress(url, normalizedProtocol === "wss:" ? normalizedProtocol : void 0);
    if (!address) {
      return { error: "invalid" /* Invalid */ };
    }
    return {
      parsed: {
        address,
        connectionToken,
        suggestedName: url.host
      }
    };
  } catch {
    return { error: "invalid" /* Invalid */ };
  }
}
function extractRemoteAgentHostCandidate(input) {
  const urlMatch = input.match(/(?<url>(?:https?|wss?):\/\/\S+)/i);
  const candidate = urlMatch?.groups?.url ?? input;
  const trimmedCandidate = candidate.trim().replace(/[),.;\]]+$/, "");
  return trimmedCandidate || void 0;
}
function normalizeRemoteAgentHostProtocol(protocol) {
  switch (protocol.toLowerCase()) {
    case "ws:":
    case "http:":
      return "ws:";
    case "wss:":
    case "https:":
      return "wss:";
    default:
      return void 0;
  }
}
function formatRemoteAgentHostAddress(url, protocol) {
  if (!url.host) {
    return void 0;
  }
  const path = url.pathname !== "/" ? url.pathname : "";
  const query = url.search;
  const base = protocol ? `${protocol}//${url.host}` : url.host;
  return `${base}${path}${query}`;
}
function parseLegacyRawEntry(raw) {
  if (raw.sshConfigHost !== void 0 || raw.sshHostName !== void 0 || raw.sshUser !== void 0 || raw.sshPort !== void 0) {
    return SSH_ENTRY_TYPE_CONFIG.fromRaw(raw);
  }
  return WEBSOCKET_ENTRY_TYPE_CONFIG.fromRaw(raw);
}
export {
  AGENT_HOST_LOG_OUTPUT_CHANNEL_ID,
  IRemoteAgentHostService,
  NullRemoteAgentHostService,
  RemoteAgentHostAutoConnectSettingId,
  RemoteAgentHostConnectionStatus,
  RemoteAgentHostEntryType,
  RemoteAgentHostInputValidationError,
  RemoteAgentHostsEnabledSettingId,
  RemoteAgentHostsSettingId,
  SSH_ENTRY_TYPE_CONFIG,
  WEBSOCKET_ENTRY_TYPE_CONFIG,
  getEntryAddress,
  getEntryTypeConfig,
  parseLegacyRawEntry,
  parseRemoteAgentHostInput,
  remoteAgentHostLogOutputChannelId
};
