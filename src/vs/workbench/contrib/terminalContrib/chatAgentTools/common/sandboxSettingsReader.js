import { AgentNetworkDomainSettingId } from "../../../../../platform/networkFilter/common/settings.js";
import { AgentSandboxSettingId } from "../../../../../platform/sandbox/common/settings.js";
import { sandboxSettingIdToAgentHostKey } from "../../../../../platform/agentHost/common/sandboxConfigSchema.js";
const SANDBOX_SETTING_KEYS = [
  AgentSandboxSettingId.AgentSandboxEnabled,
  AgentSandboxSettingId.AgentSandboxWindowsEnabled,
  AgentSandboxSettingId.AgentSandboxAllowNetwork,
  AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands,
  AgentSandboxSettingId.AgentSandboxLinuxFileSystem,
  AgentSandboxSettingId.AgentSandboxMacFileSystem,
  AgentSandboxSettingId.AgentSandboxWindowsFileSystem,
  AgentSandboxSettingId.AgentSandboxWindowsSchemaVersion,
  AgentSandboxSettingId.AgentSandboxAdvancedRuntime,
  AgentNetworkDomainSettingId.AllowedNetworkDomains,
  AgentNetworkDomainSettingId.DeniedNetworkDomains
];
function readSandboxSetting(configurationService, _logService, settingId) {
  return normalizeSandboxSettingValue(settingId, configurationService.inspect(settingId).value);
}
function readAgentHostSandboxValues(configurationService, logService) {
  const values = {};
  for (const [settingId, sandboxKey] of Object.entries(sandboxSettingIdToAgentHostKey)) {
    const value = readSandboxSetting(configurationService, logService, settingId);
    if (value !== void 0) {
      values[sandboxKey] = value;
    }
  }
  return values;
}
function normalizeSandboxSettingValue(settingId, value) {
  if (settingId === AgentSandboxSettingId.AgentSandboxEnabled || settingId === AgentSandboxSettingId.AgentSandboxWindowsEnabled) {
    if (value === true) {
      return "on";
    }
    if (value === false) {
      return "off";
    }
  }
  return value;
}
export {
  SANDBOX_SETTING_KEYS,
  readAgentHostSandboxValues,
  readSandboxSetting
};
