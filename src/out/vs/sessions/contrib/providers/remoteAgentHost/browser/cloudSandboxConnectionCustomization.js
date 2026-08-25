import {
  CLOUD_SANDBOX_ADDRESS_PREFIX,
  CLOUD_SANDBOX_AGENT_PROVIDER,
  CLOUD_SANDBOX_SESSION_SCHEME,
  cloudSandboxEnvironmentId,
  isCloudSandboxSealedToken
} from "../../../../../platform/agentHost/common/cloudSandboxAgentHost.js";
function isGitHubResource(resource) {
  let host;
  try {
    host = new URL(resource).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === "github.com" || host.endsWith(".github.com") || host === "githubcopilot.com" || host.endsWith(".githubcopilot.com") || host.endsWith(".ghe.com");
}
function createCloudSandboxConnectionCustomization(address, sandboxService) {
  const environmentId = cloudSandboxEnvironmentId(address);
  if (environmentId === void 0) {
    return void 0;
  }
  return {
    authenticate: async (request) => {
      if (isCloudSandboxSealedToken(request.token)) {
        return request;
      }
      if (!isGitHubResource(request.resource)) {
        throw new Error(`Cloud sandbox cannot authenticate the non-GitHub resource '${request.resource}'.`);
      }
      const sealed = sandboxService.getSealedGitHubToken(environmentId);
      if (!sealed || !isCloudSandboxSealedToken(sealed)) {
        throw new Error(`No sealed GitHub token is available for cloud sandbox ${address}; refusing to forward a plaintext bearer.`);
      }
      return { resource: request.resource, scopes: request.scopes, token: sealed };
    },
    backendSessionScheme: (provider) => provider === CLOUD_SANDBOX_AGENT_PROVIDER ? CLOUD_SANDBOX_SESSION_SCHEME : void 0
  };
}
function isCloudSandboxConnectionAddress(address) {
  return address.startsWith(CLOUD_SANDBOX_ADDRESS_PREFIX);
}
export {
  createCloudSandboxConnectionCustomization,
  isCloudSandboxConnectionAddress
};
