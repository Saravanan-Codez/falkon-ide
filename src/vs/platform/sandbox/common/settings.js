var AgentSandboxSettingId = /* @__PURE__ */ ((AgentSandboxSettingId2) => {
  AgentSandboxSettingId2["AgentSandboxEnabled"] = "chat.agent.sandbox.enabled";
  AgentSandboxSettingId2["AgentSandboxWindowsEnabled"] = "chat.agent.sandbox.enabledWindows";
  AgentSandboxSettingId2["AgentSandboxAllowNetwork"] = "chat.agent.sandbox.allowNetwork";
  AgentSandboxSettingId2["AgentSandboxAllowUnsandboxedCommands"] = "chat.agent.sandbox.allowUnsandboxedCommands";
  AgentSandboxSettingId2["AgentSandboxRetryWithAllowNetworkRequests"] = "chat.agent.sandbox.retryWithAllowNetworkRequests";
  AgentSandboxSettingId2["AgentSandboxAllowAutoApprove"] = "chat.agent.sandbox.allowAutoApprove";
  AgentSandboxSettingId2["AgentSandboxLinuxFileSystem"] = "chat.agent.sandbox.fileSystem.linux";
  AgentSandboxSettingId2["AgentSandboxMacFileSystem"] = "chat.agent.sandbox.fileSystem.mac";
  AgentSandboxSettingId2["AgentSandboxWindowsFileSystem"] = "chat.agent.sandbox.fileSystem.windows";
  AgentSandboxSettingId2["AgentSandboxWindowsSchemaVersion"] = "chat.agent.sandbox.advanced.windows.schemaVersion";
  AgentSandboxSettingId2["AgentSandboxAdvancedRuntime"] = "chat.agent.sandbox.advanced.runtime";
  return AgentSandboxSettingId2;
})(AgentSandboxSettingId || {});
var AgentSandboxEnabledValue = /* @__PURE__ */ ((AgentSandboxEnabledValue2) => {
  AgentSandboxEnabledValue2["Off"] = "off";
  AgentSandboxEnabledValue2["On"] = "on";
  AgentSandboxEnabledValue2["AllowNetwork"] = "allowNetwork";
  return AgentSandboxEnabledValue2;
})(AgentSandboxEnabledValue || {});
function normalizeAgentSandboxEnabledValue(value) {
  if (value === true) {
    return "on" /* On */;
  }
  if (value === false) {
    return "off" /* Off */;
  }
  return value;
}
function isAgentSandboxEnabledValue(value) {
  return value !== void 0 && normalizeAgentSandboxEnabledValue(value) !== "off" /* Off */;
}
export {
  AgentSandboxEnabledValue,
  AgentSandboxSettingId,
  isAgentSandboxEnabledValue,
  normalizeAgentSandboxEnabledValue
};
