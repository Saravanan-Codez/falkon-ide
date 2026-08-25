import { URI } from "../../../../../../base/common/uri.js";
function toAgentHostBackendSessionUri(sessionResource) {
  const scheme = sessionResource.scheme;
  const prefix = "agent-host-";
  if (!scheme.startsWith(prefix)) {
    return void 0;
  }
  const provider = scheme.substring(prefix.length);
  if (!provider) {
    return void 0;
  }
  const rawId = sessionResource.path.replace(/^\//, "");
  return URI.from({ scheme: provider, path: `/${rawId}` });
}
export {
  toAgentHostBackendSessionUri
};
