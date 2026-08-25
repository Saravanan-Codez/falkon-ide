var AgentHostLaunchKind = /* @__PURE__ */ ((AgentHostLaunchKind2) => {
  AgentHostLaunchKind2["VSCodeMainProcess"] = "vscode_main_process";
  AgentHostLaunchKind2["VSCodeCLI"] = "vscode_cli";
  AgentHostLaunchKind2["Unknown"] = "unknown";
  return AgentHostLaunchKind2;
})(AgentHostLaunchKind || {});
const AgentHostLaunchKindEnvVar = "VSCODE_AGENT_HOST_LAUNCH_KIND";
var AgentHostClientConnectionKind = /* @__PURE__ */ ((AgentHostClientConnectionKind2) => {
  AgentHostClientConnectionKind2["Local"] = "local";
  AgentHostClientConnectionKind2["DirectWebSocket"] = "direct_websocket";
  AgentHostClientConnectionKind2["DevTunnel"] = "dev_tunnel";
  AgentHostClientConnectionKind2["SSH"] = "ssh";
  AgentHostClientConnectionKind2["WSL"] = "wsl";
  AgentHostClientConnectionKind2["RemoteExtensionHost"] = "remote_extension_host";
  AgentHostClientConnectionKind2["WebPubSub"] = "web_pub_sub";
  AgentHostClientConnectionKind2["Unknown"] = "unknown";
  return AgentHostClientConnectionKind2;
})(AgentHostClientConnectionKind || {});
var AgentHostTransportKind = /* @__PURE__ */ ((AgentHostTransportKind2) => {
  AgentHostTransportKind2["MessagePort"] = "message_port";
  AgentHostTransportKind2["WebSocket"] = "websocket";
  AgentHostTransportKind2["Unknown"] = "unknown";
  return AgentHostTransportKind2;
})(AgentHostTransportKind || {});
function createUnknownAgentHostClientTelemetryContext(clientType) {
  return {
    clientType,
    connectionKind: "unknown" /* Unknown */,
    transportKind: "unknown" /* Unknown */,
    hostLaunchKind: "unknown" /* Unknown */
  };
}
const CLIENT_CONNECTION_KIND_META_KEY = "vscode.clientConnectionKind";
function toClientConnectionTelemetryMeta(connectionKind) {
  return connectionKind === void 0 || connectionKind === "unknown" /* Unknown */ ? void 0 : { [CLIENT_CONNECTION_KIND_META_KEY]: connectionKind };
}
function readClientConnectionKind(meta) {
  const value = meta?.[CLIENT_CONNECTION_KIND_META_KEY];
  switch (value) {
    case "local" /* Local */:
    case "direct_websocket" /* DirectWebSocket */:
    case "dev_tunnel" /* DevTunnel */:
    case "ssh" /* SSH */:
    case "wsl" /* WSL */:
    case "remote_extension_host" /* RemoteExtensionHost */:
    case "web_pub_sub" /* WebPubSub */:
      return value;
    default:
      return "unknown" /* Unknown */;
  }
}
function readAgentHostLaunchKind(value) {
  switch (value) {
    case "vscode_main_process" /* VSCodeMainProcess */:
    case "vscode_cli" /* VSCodeCLI */:
      return value;
    default:
      return "unknown" /* Unknown */;
  }
}
export {
  AgentHostClientConnectionKind,
  AgentHostLaunchKind,
  AgentHostLaunchKindEnvVar,
  AgentHostTransportKind,
  createUnknownAgentHostClientTelemetryContext,
  readAgentHostLaunchKind,
  readClientConnectionKind,
  toClientConnectionTelemetryMeta
};
