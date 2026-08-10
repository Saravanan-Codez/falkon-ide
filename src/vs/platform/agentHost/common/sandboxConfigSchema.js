import { localize } from "../../../nls.js";
import { AgentNetworkDomainSettingId } from "../../networkFilter/common/settings.js";
import { AgentSandboxEnabledValue, AgentSandboxSettingId } from "../../sandbox/common/settings.js";
import { createSchema, schemaProperty } from "./agentHostSchema.js";
var AgentHostSandboxConfigKey = /* @__PURE__ */ ((AgentHostSandboxConfigKey2) => {
  AgentHostSandboxConfigKey2["Sandbox"] = "sandbox";
  return AgentHostSandboxConfigKey2;
})(AgentHostSandboxConfigKey || {});
var AgentHostSandboxKey = /* @__PURE__ */ ((AgentHostSandboxKey2) => {
  AgentHostSandboxKey2["Enabled"] = "enabled";
  AgentHostSandboxKey2["WindowsEnabled"] = "enabled.windows";
  AgentHostSandboxKey2["AllowNetwork"] = "allowNetwork";
  AgentHostSandboxKey2["AllowUnsandboxedCommands"] = "allowUnsandboxedCommands";
  AgentHostSandboxKey2["LinuxFileSystem"] = "fileSystem.linux";
  AgentHostSandboxKey2["MacFileSystem"] = "fileSystem.mac";
  AgentHostSandboxKey2["WindowsFileSystem"] = "fileSystem.windows";
  AgentHostSandboxKey2["AdvancedRuntime"] = "advanced.runtime";
  AgentHostSandboxKey2["AllowedNetworkDomains"] = "allowedNetworkDomains";
  AgentHostSandboxKey2["DeniedNetworkDomains"] = "deniedNetworkDomains";
  return AgentHostSandboxKey2;
})(AgentHostSandboxKey || {});
const sandboxConfigSchema = createSchema({
  ["sandbox" /* Sandbox */]: schemaProperty({
    type: "object",
    title: localize("agentHost.config.sandbox.title", "Agent Sandbox"),
    properties: {
      ["enabled" /* Enabled */]: {
        type: "string",
        title: localize("agentHost.config.sandbox.enabled.title", "Sandbox Enabled"),
        enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On, AgentSandboxEnabledValue.AllowNetwork]
      },
      ["enabled.windows" /* WindowsEnabled */]: {
        type: "string",
        title: localize("agentHost.config.sandbox.windowsEnabled.title", "Sandbox Enabled (Windows)"),
        enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On, AgentSandboxEnabledValue.AllowNetwork]
      },
      ["allowNetwork" /* AllowNetwork */]: {
        type: "boolean",
        title: localize("agentHost.config.sandbox.allowNetwork.title", "Allow Network")
      },
      ["allowUnsandboxedCommands" /* AllowUnsandboxedCommands */]: {
        type: "boolean",
        title: localize("agentHost.config.sandbox.allowUnsandboxedCommands.title", "Allow Unsandboxed Commands")
      },
      ["fileSystem.linux" /* LinuxFileSystem */]: {
        type: "object",
        title: localize("agentHost.config.sandbox.linuxFileSystem.title", "Linux Sandbox Filesystem")
      },
      ["fileSystem.mac" /* MacFileSystem */]: {
        type: "object",
        title: localize("agentHost.config.sandbox.macFileSystem.title", "macOS Sandbox Filesystem")
      },
      ["fileSystem.windows" /* WindowsFileSystem */]: {
        type: "object",
        title: localize("agentHost.config.sandbox.windowsFileSystem.title", "Windows Sandbox Filesystem")
      },
      ["advanced.runtime" /* AdvancedRuntime */]: {
        type: "object",
        title: localize("agentHost.config.sandbox.advancedRuntime.title", "Advanced Sandbox Runtime")
      },
      ["allowedNetworkDomains" /* AllowedNetworkDomains */]: {
        type: "array",
        title: localize("agentHost.config.sandbox.allowedDomains.title", "Allowed Network Domains"),
        items: { type: "string", title: localize("agentHost.config.sandbox.allowedDomains.item.title", "Domain") }
      },
      ["deniedNetworkDomains" /* DeniedNetworkDomains */]: {
        type: "array",
        title: localize("agentHost.config.sandbox.deniedDomains.title", "Denied Network Domains"),
        items: { type: "string", title: localize("agentHost.config.sandbox.deniedDomains.item.title", "Domain") }
      }
    }
  })
});
const sandboxSettingIdToAgentHostKey = {
  [AgentSandboxSettingId.AgentSandboxEnabled]: "enabled" /* Enabled */,
  [AgentSandboxSettingId.AgentSandboxWindowsEnabled]: "enabled.windows" /* WindowsEnabled */,
  [AgentSandboxSettingId.AgentSandboxAllowNetwork]: "allowNetwork" /* AllowNetwork */,
  [AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands]: "allowUnsandboxedCommands" /* AllowUnsandboxedCommands */,
  [AgentSandboxSettingId.AgentSandboxLinuxFileSystem]: "fileSystem.linux" /* LinuxFileSystem */,
  [AgentSandboxSettingId.AgentSandboxMacFileSystem]: "fileSystem.mac" /* MacFileSystem */,
  [AgentSandboxSettingId.AgentSandboxWindowsFileSystem]: "fileSystem.windows" /* WindowsFileSystem */,
  [AgentSandboxSettingId.AgentSandboxAdvancedRuntime]: "advanced.runtime" /* AdvancedRuntime */,
  [AgentNetworkDomainSettingId.AllowedNetworkDomains]: "allowedNetworkDomains" /* AllowedNetworkDomains */,
  [AgentNetworkDomainSettingId.DeniedNetworkDomains]: "deniedNetworkDomains" /* DeniedNetworkDomains */
};
export {
  AgentHostSandboxConfigKey,
  AgentHostSandboxKey,
  sandboxConfigSchema,
  sandboxSettingIdToAgentHostKey
};
