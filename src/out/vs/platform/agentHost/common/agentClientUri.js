import { URI } from "../../../base/common/uri.js";
const AGENT_CLIENT_SCHEME = "vscode-agent-client";
function toAgentClientUri(originalUri, clientId) {
  const originalAuthority = originalUri.authority || "-";
  const isOpaque = originalUri.path.length > 0 && !originalUri.path.startsWith("/");
  const schemeSlot = isOpaque ? `${originalUri.scheme}!` : originalUri.scheme;
  const pathBody = isOpaque ? `/${originalUri.path}` : originalUri.path;
  return URI.from({
    scheme: AGENT_CLIENT_SCHEME,
    authority: clientId,
    path: `/${schemeSlot}/${originalAuthority}${pathBody}`,
    query: originalUri.query || void 0,
    fragment: originalUri.fragment || void 0
  });
}
function fromAgentClientUri(agentClientUri) {
  const path = agentClientUri.path;
  const query = agentClientUri.query || void 0;
  const fragment = agentClientUri.fragment || void 0;
  const schemeEnd = path.indexOf("/", 1);
  if (schemeEnd === -1) {
    return URI.from({ scheme: "file", path, query, fragment });
  }
  let originalScheme = path.substring(1, schemeEnd);
  const isOpaque = originalScheme.endsWith("!");
  if (isOpaque) {
    originalScheme = originalScheme.substring(0, originalScheme.length - 1);
  }
  const authorityEnd = path.indexOf("/", schemeEnd + 1);
  if (authorityEnd === -1) {
    const originalAuthority2 = path.substring(schemeEnd + 1);
    return URI.from({ scheme: originalScheme, authority: originalAuthority2 === "-" ? "" : originalAuthority2, path: "/", query, fragment });
  }
  let originalAuthority = path.substring(schemeEnd + 1, authorityEnd);
  if (originalAuthority === "-") {
    originalAuthority = "";
  }
  let originalPath = path.substring(authorityEnd);
  if (isOpaque) {
    originalPath = originalPath.substring(1);
  }
  return URI.from({
    scheme: originalScheme,
    authority: originalAuthority || void 0,
    path: originalPath,
    query,
    fragment
  });
}
export {
  AGENT_CLIENT_SCHEME,
  fromAgentClientUri,
  toAgentClientUri
};
