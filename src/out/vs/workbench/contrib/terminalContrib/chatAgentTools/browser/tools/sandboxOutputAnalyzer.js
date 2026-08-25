var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { OperatingSystem } from "../../../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ITerminalSandboxService } from "../../common/terminalSandboxService.js";
import { TerminalChatAgentToolsSettingId } from "../../common/terminalChatAgentToolsConfiguration.js";
import { AgentNetworkDomainSettingId } from "../../../../../../platform/networkFilter/common/settings.js";
import { AgentSandboxSettingId } from "../../../../../../platform/sandbox/common/settings.js";
let SandboxOutputAnalyzer = class extends Disposable {
  constructor(_sandboxService, _configurationService) {
    super();
    this._sandboxService = _sandboxService;
    this._configurationService = _configurationService;
  }
  async analyze(options) {
    if (!options.isSandboxWrapped) {
      return void 0;
    }
    const knownFailure = options.exitCode !== void 0 && options.exitCode !== 0;
    const suspectedFailure = !knownFailure && options.exitCode === void 0 && this._outputLooksSandboxBlocked(options.exitResult);
    if (!knownFailure && !suspectedFailure) {
      return void 0;
    }
    const os = await this._sandboxService.getOS();
    let fileSystemSetting;
    switch (os) {
      case OperatingSystem.Linux:
        fileSystemSetting = TerminalChatAgentToolsSettingId.AgentSandboxLinuxFileSystem;
        break;
      case OperatingSystem.Windows:
        fileSystemSetting = TerminalChatAgentToolsSettingId.AgentSandboxWindowsFileSystem;
        break;
      default:
        fileSystemSetting = TerminalChatAgentToolsSettingId.AgentSandboxMacFileSystem;
        break;
    }
    const prefix = knownFailure ? "Command failed while running in sandboxed mode. If the command failed due to sandboxing:" : "Command ran in sandboxed mode and may have been blocked by the sandbox. If the command failed due to sandboxing:";
    const retryWithAllowNetworkRequests = this._configurationService.getValue(AgentSandboxSettingId.AgentSandboxRetryWithAllowNetworkRequests) === true;
    const networkRecovery = retryWithAllowNetworkRequests ? "- If you determine from the output that the failure was caused by blocked network access, immediately retry the command with requestAllowNetwork=true and provide requestAllowNetworkReason. This keeps the command sandboxed with unrestricted network access and automatically shows a confirmation prompt to the user.\n- If it is not a network restriction, or the command still fails after retrying with requestAllowNetwork=true, immediately retry the command with requestUnsandboxedExecution=true and provide requestUnsandboxedExecutionReason. Do NOT ask the user - setting this flag automatically shows a confirmation prompt to the user." : "- Sandboxed execution with unrestricted network access is disabled by chat.agent.sandbox.retryWithAllowNetworkRequests. Do not set requestAllowNetwork=true.\n- If the command cannot be made to work by updating sandbox rules, immediately retry it with requestUnsandboxedExecution=true and provide requestUnsandboxedExecutionReason. Do NOT ask the user - setting this flag automatically shows a confirmation prompt to the user.";
    return `${prefix}
- If it would be reasonable to extend the sandbox rules, work with the user to update allowWrite for file system access problems in ${fileSystemSetting}, or to add required domains to ${AgentNetworkDomainSettingId.AllowedNetworkDomains}.
- If the output contains 'No such file or directory', treat it as a sandbox access error and immediately retry the command with requestUnsandboxedExecution=true and provide requestUnsandboxedExecutionReason.
${networkRecovery}

Here is the output of the command:
`;
  }
  /**
   * Checks whether the command output contains strings that typically indicate
   * the sandbox blocked the operation. Used when exit code is unavailable.
   *
   * The output may contain newlines inserted by terminal wrapping, so we
   * strip them before testing.
   */
  _outputLooksSandboxBlocked(output) {
    return outputLooksSandboxBlocked(output);
  }
};
SandboxOutputAnalyzer = __decorateClass([
  __decorateParam(0, ITerminalSandboxService),
  __decorateParam(1, IConfigurationService)
], SandboxOutputAnalyzer);
function outputLooksSandboxBlocked(output) {
  const normalized = output.replace(/\n/g, " ");
  return /Operation not permitted|Permission denied|Read-only file system|sandbox-exec|bwrap|sandbox_violation|No such file or directory/i.test(normalized);
}
function outputLooksSandboxNetworkBlocked(output) {
  const normalized = output.replace(/\n/g, " ");
  return /Could not resolve host|Temporary failure in name resolution|Name or service not known|EAI_AGAIN|ENETUNREACH|Network is unreachable|Received HTTP code 403 from proxy after CONNECT|network (?:access )?(?:blocked|disabled)|(?:connect|socket).*(?:Operation not permitted|Permission denied)|(?:Operation not permitted|Permission denied).*(?:connect|socket)/i.test(normalized);
}
export {
  SandboxOutputAnalyzer,
  outputLooksSandboxBlocked,
  outputLooksSandboxNetworkBlocked
};
