import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { ISandboxHelperService } from "../common/sandboxHelperService.js";
class NullSandboxHelperService {
  async checkSandboxDependencies() {
    return {
      bubblewrapInstalled: true,
      bubblewrapUsable: true,
      socatInstalled: true
    };
  }
  async getWindowsMxcFilesystemPolicy() {
    return void 0;
  }
  async getWindowsMxcEnvironment() {
    return void 0;
  }
  async buildWindowsMxcSandboxPayload(_commandLine, _policy, _workingDirectory, _containerName, _containment) {
    return void 0;
  }
}
registerSingleton(ISandboxHelperService, NullSandboxHelperService, InstantiationType.Delayed);
