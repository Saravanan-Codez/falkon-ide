import { Event } from "../../../../base/common/event.js";
import { FileAccess } from "../../../../base/common/network.js";
import { dirname } from "../../../../base/common/path.js";
import { OS } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { createHash } from "crypto";
import { TerminalSandboxEngine } from "../../../sandbox/common/terminalSandboxEngine.js";
import { getAppNodeModulesDirName } from "../appNodeModules.js";
import { AgentHostSandboxConfigKey, sandboxConfigSchema, sandboxSettingIdToAgentHostKey } from "../../common/sandboxConfigSchema.js";
const SANDBOX_TEMP_DIR_NAME = "tmp";
class AgentHostTerminalSandboxHost {
  constructor(_sessionId, _workingDirectory, _environmentService, _productService, _agentConfigurationService, sandboxHelper) {
    this._sessionId = _sessionId;
    this._workingDirectory = _workingDirectory;
    this._environmentService = _environmentService;
    this._productService = _productService;
    this._agentConfigurationService = _agentConfigurationService;
    this.onDidChangeRoots = Event.None;
    this._sandboxHelper = sandboxHelper;
    this.onDidChangeSandboxSettings = this._agentConfigurationService.onDidRootConfigChange;
  }
  async getOS() {
    return OS;
  }
  async getRuntimeInfo() {
    const appRoot = dirname(FileAccess.asFileUri("").path);
    const runAsNode = !!process.versions["electron"];
    const nativeModulesDir = getAppNodeModulesDirName();
    return { appRoot, execPath: process.execPath, runAsNode, nativeModulesDir };
  }
  async getUserHome() {
    return this._environmentService.userHome;
  }
  async getSandboxTempDir() {
    const userHome = this._environmentService.userHome;
    if (!userHome) {
      return void 0;
    }
    const sandboxRoot = URI.joinPath(userHome, this._productService.dataFolderName, SANDBOX_TEMP_DIR_NAME);
    const digest = createHash("sha256").update(this._sessionId).digest("hex");
    const sessionLeaf = `agenthost_${digest.substring(0, 16)}`;
    return URI.joinPath(sandboxRoot, sessionLeaf);
  }
  async getWorkspaceStorageReadRoot() {
    return void 0;
  }
  getWriteRoots() {
    return this._workingDirectory ? [this._workingDirectory] : [];
  }
  async checkSandboxDependencies() {
    return this._sandboxHelper.checkSandboxDependencies();
  }
  async getWindowsMxcFilesystemPolicy() {
    return this._sandboxHelper.getWindowsMxcFilesystemPolicy();
  }
  async getWindowsMxcEnvironment() {
    return this._sandboxHelper.getWindowsMxcEnvironment();
  }
  async buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment) {
    return this._sandboxHelper.buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment);
  }
  getSandboxSetting(settingId) {
    const innerKey = sandboxSettingIdToAgentHostKey[settingId];
    if (innerKey === void 0) {
      return void 0;
    }
    const sandbox = this._agentConfigurationService.getRootValue(sandboxConfigSchema, AgentHostSandboxConfigKey.Sandbox);
    return sandbox?.[innerKey];
  }
}
function createAgentHostSandboxEngine(instantiationService, environmentService, productService, agentConfigurationService, sandboxHelper, sessionId, workingDirectory) {
  const host = new AgentHostTerminalSandboxHost(sessionId, workingDirectory, environmentService, productService, agentConfigurationService, sandboxHelper);
  return instantiationService.createInstance(TerminalSandboxEngine, host);
}
export {
  createAgentHostSandboxEngine
};
