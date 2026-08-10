import { URI } from "../../../base/common/uri.js";
const GITHUB_DOT_COM_COPILOT_API_BASE_URI = "https://api.githubcopilot.com";
const GITHUB_DOT_COM_ENDPOINTS = {
  apiBaseUri: "https://api.github.com",
  graphQlUri: "https://api.github.com/graphql",
  oauthServer: "https://github.com/login/oauth",
  enterpriseHost: void 0
};
function deriveGitHubEndpoints(enterpriseUri) {
  if (!enterpriseUri) {
    return GITHUB_DOT_COM_ENDPOINTS;
  }
  let uri;
  try {
    uri = URI.parse(enterpriseUri);
  } catch {
    return GITHUB_DOT_COM_ENDPOINTS;
  }
  const authority = uri.authority;
  if (!authority) {
    return GITHUB_DOT_COM_ENDPOINTS;
  }
  if (authority === "github.com" || authority === "www.github.com" || authority === "api.github.com") {
    return GITHUB_DOT_COM_ENDPOINTS;
  }
  const scheme = uri.scheme || "https";
  const isCloud = /\.ghe\.com$/.test(authority);
  return {
    apiBaseUri: isCloud ? `${scheme}://api.${authority}` : `${scheme}://${authority}/api/v3`,
    graphQlUri: isCloud ? `${scheme}://api.${authority}/graphql` : `${scheme}://${authority}/api/graphql`,
    oauthServer: `${scheme}://${authority}/login/oauth`,
    enterpriseHost: authority
  };
}
function gitHubMcpServerUrl(copilotApiBaseUri) {
  try {
    const uri = URI.parse(copilotApiBaseUri ?? GITHUB_DOT_COM_COPILOT_API_BASE_URI, true);
    if (!uri.authority) {
      return void 0;
    }
    return uri.with({ path: "/mcp", query: null, fragment: null }).toString(true);
  } catch {
    return void 0;
  }
}
function gitHubCopilotResource(endpoints) {
  return {
    resource: endpoints.apiBaseUri,
    resource_name: "GitHub Copilot",
    authorization_servers: [endpoints.oauthServer],
    scopes_supported: ["read:user", "user:email"],
    required: true
  };
}
function gitHubRepoResource(endpoints) {
  return {
    resource: `${endpoints.apiBaseUri}/repos`,
    resource_name: "GitHub Repository",
    authorization_servers: [endpoints.oauthServer],
    scopes_supported: ["repo"],
    required: false
  };
}
export {
  GITHUB_DOT_COM_COPILOT_API_BASE_URI,
  deriveGitHubEndpoints,
  gitHubCopilotResource,
  gitHubMcpServerUrl,
  gitHubRepoResource
};
