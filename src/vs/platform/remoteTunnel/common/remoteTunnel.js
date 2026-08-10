import { createDecorator } from "../../instantiation/common/instantiation.js";
import { localize } from "../../../nls.js";
const IRemoteTunnelService = createDecorator("IRemoteTunnelService");
const INACTIVE_TUNNEL_MODE = { active: false };
var TunnelStates;
((TunnelStates2) => {
  TunnelStates2.disconnected = (onTokenFailed) => ({ type: "disconnected", onTokenFailed });
  TunnelStates2.connected = (info, serviceInstallFailed) => ({ type: "connected", info, serviceInstallFailed });
  TunnelStates2.connecting = (progress) => ({ type: "connecting", progress });
  TunnelStates2.uninitialized = { type: "uninitialized" };
})(TunnelStates || (TunnelStates = {}));
const CONFIGURATION_KEY_PREFIX = "remote.tunnels.access";
const CONFIGURATION_KEY_HOST_NAME = CONFIGURATION_KEY_PREFIX + ".hostNameOverride";
const CONFIGURATION_KEY_PREVENT_SLEEP = CONFIGURATION_KEY_PREFIX + ".preventSleep";
const MAX_TUNNEL_NAME_LENGTH = 20;
const TUNNEL_NAME_PLACEHOLDER = "remote-machine";
function tunnelNameFromHostname(hostname) {
  let cleaned = "";
  for (const char of Array.from(hostname).slice(0, 60)) {
    if (char === "-" || char === "_" || char === " ") {
      cleaned += "-";
    } else if (/[0-9a-zA-Z]/.test(char)) {
      cleaned += char;
    }
  }
  const trimmed = cleaned.replace(/^-+|-+$/g, "");
  const name = trimmed.length < 2 ? TUNNEL_NAME_PLACEHOLDER : trimmed;
  return name.toLowerCase().substring(0, MAX_TUNNEL_NAME_LENGTH);
}
function normalizeTunnelName(name) {
  return name.replace(/^-+/g, "").replace(/[^\w-]/g, "").substring(0, MAX_TUNNEL_NAME_LENGTH).toLowerCase();
}
const LOG_ID = "remoteTunnelService";
const LOGGER_NAME = localize("remoteTunnelLog", "Remote Tunnel Service");
export {
  CONFIGURATION_KEY_HOST_NAME,
  CONFIGURATION_KEY_PREFIX,
  CONFIGURATION_KEY_PREVENT_SLEEP,
  INACTIVE_TUNNEL_MODE,
  IRemoteTunnelService,
  LOGGER_NAME,
  LOG_ID,
  MAX_TUNNEL_NAME_LENGTH,
  TunnelStates,
  normalizeTunnelName,
  tunnelNameFromHostname
};
