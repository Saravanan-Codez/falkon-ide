import { homedir } from "os";
import { ExtHostVariableResolverProviderService } from "../common/extHostVariableResolverService.js";
class NodeExtHostVariableResolverProviderService extends ExtHostVariableResolverProviderService {
  homeDir() {
    return homedir();
  }
}
export {
  NodeExtHostVariableResolverProviderService
};
