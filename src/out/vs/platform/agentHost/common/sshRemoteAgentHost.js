import { createDecorator } from "../../instantiation/common/instantiation.js";
const ISSHRemoteAgentHostService = createDecorator("sshRemoteAgentHostService");
const SSH_REMOTE_AGENT_HOST_CHANNEL = "sshRemoteAgentHost";
var SSHAuthMethod = /* @__PURE__ */ ((SSHAuthMethod2) => {
  SSHAuthMethod2["Agent"] = "agent";
  SSHAuthMethod2["KeyFile"] = "keyFile";
  SSHAuthMethod2["Password"] = "password";
  return SSHAuthMethod2;
})(SSHAuthMethod || {});
function computeSSHConnectionKey(config) {
  return config.sshConfigHost ? `ssh:${config.sshConfigHost}` : `${config.username}@${config.host}:${config.port ?? 22}`;
}
function isSSHStrictHostKeyChecking(value) {
  return value === "ask" || value === "accept-new" || value === "yes" || value === "no" || value === "off";
}
const SSH_HOST_KEY_DENIED_ERROR_NAME = "SSHHostKeyDenied";
class SSHHostKeyDeniedError extends Error {
  constructor(displayHost) {
    super(`Host key verification failed for ${displayHost}`);
    this.name = SSH_HOST_KEY_DENIED_ERROR_NAME;
  }
}
function isSSHHostKeyDeniedError(error) {
  return error instanceof Error && error.name === SSH_HOST_KEY_DENIED_ERROR_NAME;
}
const ISSHRemoteAgentHostMainService = createDecorator("sshRemoteAgentHostMainService");
export {
  ISSHRemoteAgentHostMainService,
  ISSHRemoteAgentHostService,
  SSHAuthMethod,
  SSHHostKeyDeniedError,
  SSH_HOST_KEY_DENIED_ERROR_NAME,
  SSH_REMOTE_AGENT_HOST_CHANNEL,
  computeSSHConnectionKey,
  isSSHHostKeyDeniedError,
  isSSHStrictHostKeyChecking
};
