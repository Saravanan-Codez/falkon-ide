import { AHPFileSystemProvider } from "./agentHostFileSystemProvider.js";
import { fromAgentClientUri, toAgentClientUri } from "./agentClientUri.js";
class AgentHostClientFileSystemProvider extends AHPFileSystemProvider {
  _decodeUri(resource) {
    return fromAgentClientUri(resource);
  }
  _encodeUri(resource, authority) {
    return toAgentClientUri(resource, authority);
  }
}
export {
  AgentHostClientFileSystemProvider
};
