import { RemoteAgentHostEntryType } from "../../platform/agentHost/common/remoteAgentHostService.js";
import { isAgentHostProvider } from "../common/agentHostSessionsProvider.js";
import { encodeHex, VSBuffer } from "../../base/common/buffer.js";
function resolveRemoteAuthority(providerId, sessionsProvidersService, remoteAgentHostService) {
  const provider = sessionsProvidersService.getProvider(providerId);
  if (!provider || !isAgentHostProvider(provider) || !provider.remoteAddress) {
    return void 0;
  }
  const entry = remoteAgentHostService.getEntryByAddress(provider.remoteAddress);
  if (!entry) {
    return void 0;
  }
  switch (entry.connection.type) {
    case RemoteAgentHostEntryType.SSH:
      if (entry.connection.sshConfigHost) {
        return `ssh-remote+${entry.connection.sshConfigHost}`;
      }
      return `ssh-remote+${sshAuthorityString(entry.connection)}`;
    case RemoteAgentHostEntryType.Tunnel:
      return `tunnel+${entry.connection.label ?? `${entry.connection.tunnelId}.${entry.connection.clusterId}`}`;
    default:
      return void 0;
  }
}
function sshAuthorityString(connection) {
  const hostName = connection.hostName;
  const needsEncoding = connection.user || connection.port || /[A-Z/\\+]/.test(hostName) || !/^[a-zA-Z0-9.:\-]+$/.test(hostName);
  if (!needsEncoding) {
    return hostName;
  }
  const obj = { hostName };
  if (connection.user) {
    obj.user = connection.user;
  }
  if (connection.port) {
    obj.port = connection.port;
  }
  const json = JSON.stringify(obj);
  return encodeHex(VSBuffer.fromString(json));
}
export {
  resolveRemoteAuthority,
  sshAuthorityString
};
