import { createDecorator } from "../../instantiation/common/instantiation.js";
const CloudSandboxEnabledSettingId = "chat.agentHost.cloudSandbox.enabled";
const CLOUD_SANDBOX_ADDRESS_PREFIX = "cloudsandbox:";
const CLOUD_SANDBOX_SESSION_SCHEME = "ahp-session";
const CLOUD_SANDBOX_AGENT_PROVIDER = "copilot";
const CLOUD_SANDBOX_SEALED_TOKEN_PREFIX = "copilot-sealed.v1.";
function isCloudSandboxSealedToken(token) {
  return typeof token === "string" && token.startsWith(CLOUD_SANDBOX_SEALED_TOKEN_PREFIX);
}
function cloudSandboxEnvironmentId(address) {
  return address.startsWith(CLOUD_SANDBOX_ADDRESS_PREFIX) ? address.slice(CLOUD_SANDBOX_ADDRESS_PREFIX.length) : void 0;
}
const CLOUD_SANDBOX_AGENT_SLUG = "copilot-developer-cli";
function cloudSandboxAddress(environmentId) {
  return `${CLOUD_SANDBOX_ADDRESS_PREFIX}${environmentId}`;
}
function buildWpsUrl(token) {
  const base = token.wps_endpoint.replace(/^ws:\/\//i, "wss://").replace(/^http:\/\//i, "wss://").replace(/^https:\/\//i, "wss://");
  const withScheme = /^wss:\/\//i.test(base) ? base : `wss://${base}`;
  const separator = withScheme.includes("?") ? "&" : "?";
  return `${withScheme}${separator}access_token=${encodeURIComponent(token.access_token)}&clientId=${encodeURIComponent(token.client_id)}`;
}
const ICloudSandboxApiService = createDecorator("cloudSandboxApiService");
class CloudSandboxAuthenticationRequiredError extends Error {
  constructor() {
    super("Connecting to a cloud sandbox requires a signed-in GitHub account.");
    this.name = "CloudSandboxAuthenticationRequiredError";
  }
}
class CloudSandboxRequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "CloudSandboxRequestError";
  }
}
function isRetryableCloudSandboxError(error) {
  if (!(error instanceof CloudSandboxRequestError) || error.statusCode === void 0) {
    return true;
  }
  const status = error.statusCode;
  return status === 408 || status === 429 || status < 400 || status >= 500;
}
const ICloudSandboxAgentHostService = createDecorator("cloudSandboxAgentHostService");
export {
  CLOUD_SANDBOX_ADDRESS_PREFIX,
  CLOUD_SANDBOX_AGENT_PROVIDER,
  CLOUD_SANDBOX_AGENT_SLUG,
  CLOUD_SANDBOX_SEALED_TOKEN_PREFIX,
  CLOUD_SANDBOX_SESSION_SCHEME,
  CloudSandboxAuthenticationRequiredError,
  CloudSandboxEnabledSettingId,
  CloudSandboxRequestError,
  ICloudSandboxAgentHostService,
  ICloudSandboxApiService,
  buildWpsUrl,
  cloudSandboxAddress,
  cloudSandboxEnvironmentId,
  isCloudSandboxSealedToken,
  isRetryableCloudSandboxError
};
