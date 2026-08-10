import { createDecorator } from "../../instantiation/common/instantiation.js";
const ITunnelAgentHostService = createDecorator("tunnelAgentHostService");
const TUNNEL_AGENT_HOST_CHANNEL = "tunnelAgentHost";
const TunnelAgentHostsSettingId = "chat.remoteAgentTunnels";
const TUNNEL_MIN_PROTOCOL_VERSION = 5;
const TUNNEL_AGENT_HOST_PORT = 31546;
const TUNNEL_LAUNCHER_LABEL = "vscode-server-launcher";
const TUNNEL_ADDRESS_PREFIX = "tunnel:";
const TUNNEL_GATEWAY_SELECT_PATH = "/agent-host/select";
const TUNNEL_GATEWAY_MIN_PROTOCOL_VERSION = 6;
const PROTOCOL_VERSION_TAG_PREFIX = "protocolv";
class TunnelTags {
  constructor(value) {
    this.value = value;
    this.protocolVersion = 2;
    if (value) {
      let protocolVersion;
      let name;
      for (const tag of value) {
        if (tag.startsWith(PROTOCOL_VERSION_TAG_PREFIX)) {
          const parsed = Number(tag.slice(PROTOCOL_VERSION_TAG_PREFIX.length));
          if (!isNaN(parsed)) {
            protocolVersion = parsed;
          }
        } else if (!tag.startsWith("_") && tag !== TUNNEL_LAUNCHER_LABEL && !name) {
          name = tag;
        }
      }
      if (protocolVersion !== void 0) {
        this.protocolVersion = protocolVersion;
      }
      if (name !== void 0) {
        this.name = name;
      }
    }
  }
}
class TunnelGatewayProtocolError extends Error {
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseTunnelGatewayEndpoint(value, index) {
  if (!isPlainObject(value)) {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} is not an object`);
  }
  const { type, pid, instanceId, quality, tunnelName, endpointKind, endpointLabel } = value;
  if (type !== "editor" && type !== "standalone") {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} has an invalid "type"`);
  }
  if (typeof pid !== "number") {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} has an invalid "pid"`);
  }
  if (typeof instanceId !== "string" || !instanceId) {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} has an invalid "instanceId"`);
  }
  if (quality !== void 0 && typeof quality !== "string") {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} has an invalid "quality"`);
  }
  if (tunnelName !== void 0 && typeof tunnelName !== "string") {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} has an invalid "tunnelName"`);
  }
  if (endpointKind !== "tcp" && endpointKind !== "socket") {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} has an invalid "endpointKind"`);
  }
  if (typeof endpointLabel !== "string" || !endpointLabel) {
    throw new TunnelGatewayProtocolError(`Gateway inventory endpoint at index ${index} has an invalid "endpointLabel"`);
  }
  return { type, pid, instanceId, quality, tunnelName, endpointKind, endpointLabel };
}
function parseTunnelGatewayInventory(json) {
  const parsed = JSON.parse(json);
  if (!isPlainObject(parsed)) {
    throw new TunnelGatewayProtocolError("Gateway inventory message is not an object");
  }
  const { userDataPath, endpoints } = parsed;
  if (typeof userDataPath !== "string" || !userDataPath) {
    throw new TunnelGatewayProtocolError('Gateway inventory message has an invalid "userDataPath"');
  }
  if (!Array.isArray(endpoints)) {
    throw new TunnelGatewayProtocolError('Gateway inventory message has an invalid "endpoints"');
  }
  return { userDataPath, endpoints: endpoints.map((e, i) => parseTunnelGatewayEndpoint(e, i)) };
}
function parseTunnelGatewaySelectionResponse(json) {
  const parsed = JSON.parse(json);
  if (!isPlainObject(parsed) || typeof parsed.ok !== "boolean") {
    throw new TunnelGatewayProtocolError("Gateway selection acknowledgement is not a valid response");
  }
  if (!parsed.ok) {
    const error = typeof parsed.error === "string" ? parsed.error : "Gateway selection failed";
    return { ok: false, error };
  }
  const selected = parsed.selected;
  if (!isPlainObject(selected) || selected.type !== "editor" && selected.type !== "standalone" || typeof selected.instanceId !== "string" || !selected.instanceId || selected.role !== "primary" || selected.lifecycle !== "external" && selected.lifecycle !== "managed") {
    throw new TunnelGatewayProtocolError('Gateway selection acknowledgement has an invalid "selected" payload');
  }
  return {
    ok: true,
    selected: {
      serverType: selected.type,
      instanceId: selected.instanceId,
      role: "primary",
      lifecycle: selected.lifecycle
    }
  };
}
const TUNNEL_GATEWAY_SELECTION_REJECTED_ERROR_NAME = "TunnelGatewaySelectionRejectedError";
function createTunnelGatewaySelectionRejectedError(message) {
  const error = new Error(message);
  error.name = TUNNEL_GATEWAY_SELECTION_REJECTED_ERROR_NAME;
  return error;
}
function isTunnelGatewaySelectionRejectedError(error) {
  return error instanceof Error && error.name === TUNNEL_GATEWAY_SELECTION_REJECTED_ERROR_NAME;
}
const ITunnelAgentHostMainService = createDecorator("tunnelAgentHostMainService");
const TUNNEL_HOST_CHANNEL = "tunnelHost";
const TUNNEL_HOST_LOG_ID = "tunnelHostService";
const ITunnelAgentHostHostingService = createDecorator("tunnelAgentHostHostingService");
export {
  ITunnelAgentHostHostingService,
  ITunnelAgentHostMainService,
  ITunnelAgentHostService,
  PROTOCOL_VERSION_TAG_PREFIX,
  TUNNEL_ADDRESS_PREFIX,
  TUNNEL_AGENT_HOST_CHANNEL,
  TUNNEL_AGENT_HOST_PORT,
  TUNNEL_GATEWAY_MIN_PROTOCOL_VERSION,
  TUNNEL_GATEWAY_SELECTION_REJECTED_ERROR_NAME,
  TUNNEL_GATEWAY_SELECT_PATH,
  TUNNEL_HOST_CHANNEL,
  TUNNEL_HOST_LOG_ID,
  TUNNEL_LAUNCHER_LABEL,
  TUNNEL_MIN_PROTOCOL_VERSION,
  TunnelAgentHostsSettingId,
  TunnelGatewayProtocolError,
  TunnelTags,
  createTunnelGatewaySelectionRejectedError,
  isTunnelGatewaySelectionRejectedError,
  parseTunnelGatewayInventory,
  parseTunnelGatewaySelectionResponse
};
