import { OS } from "../../../base/common/platform.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const ITerminalSandboxService = createDecorator("terminalSandboxService");
var TerminalSandboxPrerequisiteCheck = /* @__PURE__ */ ((TerminalSandboxPrerequisiteCheck2) => {
  TerminalSandboxPrerequisiteCheck2["Config"] = "config";
  TerminalSandboxPrerequisiteCheck2["Dependencies"] = "dependencies";
  TerminalSandboxPrerequisiteCheck2["Bubblewrap"] = "bubblewrap";
  return TerminalSandboxPrerequisiteCheck2;
})(TerminalSandboxPrerequisiteCheck || {});
var TerminalSandboxPreCheckRemediation = /* @__PURE__ */ ((TerminalSandboxPreCheckRemediation2) => {
  TerminalSandboxPreCheckRemediation2["DisableUnprivilagedusernamespaceRestriction"] = "disableUserNamespaceRestriction";
  return TerminalSandboxPreCheckRemediation2;
})(TerminalSandboxPreCheckRemediation || {});
class NullTerminalSandboxService {
  async isEnabled() {
    return false;
  }
  async isSandboxAllowNetworkEnabled() {
    return false;
  }
  async getOS() {
    return OS;
  }
  async checkForSandboxingPrereqs() {
    return { enabled: false, sandboxConfigPath: void 0, failedCheck: void 0 };
  }
  async wrapCommand(command) {
    return { command, isSandboxWrapped: false };
  }
  async checkFileAccess() {
    return { allowed: true, denied: [] };
  }
  async getSandboxConfigPath() {
    return void 0;
  }
  getTempDir() {
    return void 0;
  }
  setNeedsForceUpdateConfigFile() {
  }
  getResolvedNetworkDomains() {
    return { allowedDomains: [], deniedDomains: [] };
  }
  async getMissingSandboxDependencies() {
    return [];
  }
  async installMissingSandboxDependencies() {
    return { exitCode: void 0 };
  }
  async runSandboxRemediation() {
    return { exitCode: void 0 };
  }
}
export {
  ITerminalSandboxService,
  NullTerminalSandboxService,
  TerminalSandboxPreCheckRemediation,
  TerminalSandboxPrerequisiteCheck
};
