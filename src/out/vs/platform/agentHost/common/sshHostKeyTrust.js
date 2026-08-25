import { createDecorator } from "../../instantiation/common/instantiation.js";
function computeHostKeyStoreKey(host, port) {
  return `${host.toLowerCase()}:${port}`;
}
const ISSHHostKeyTrustService = createDecorator("sshHostKeyTrustService");
export {
  ISSHHostKeyTrustService,
  computeHostKeyStoreKey
};
