import { localize } from "../../../nls.js";
import { createSchema, schemaProperty } from "./agentHostSchema.js";
var CopilotCliConfigKey = /* @__PURE__ */ ((CopilotCliConfigKey2) => {
  CopilotCliConfigKey2["EnableCustomTerminalTool"] = "enableCustomTerminalTool";
  CopilotCliConfigKey2["CopilotSdkLogLevel"] = "copilotSdkLogLevel";
  CopilotCliConfigKey2["RubberDuck"] = "rubberDuck";
  CopilotCliConfigKey2["Opus48Prompt"] = "opus48Prompt";
  CopilotCliConfigKey2["ToolSearchEnabled"] = "toolSearchEnabled";
  CopilotCliConfigKey2["ToolSearchDeferThreshold"] = "toolSearchDeferThreshold";
  CopilotCliConfigKey2["ReasoningEffortOverride"] = "reasoningEffortOverride";
  CopilotCliConfigKey2["ModelCapabilityOverrides"] = "modelCapabilityOverrides";
  return CopilotCliConfigKey2;
})(CopilotCliConfigKey || {});
const AgentHostCustomTerminalToolEnabledSettingId = "chat.agentHost.customTerminalTool.enabled";
const AgentHostCopilotSdkLogLevelSettingId = "chat.agentHost.copilotSdk.logLevel";
const AgentHostOpus48PromptEnabledSettingId = "chat.agentHost.opus48Prompt.enabled";
const AgentHostToolSearchEnabledSettingId = "chat.agentHost.copilot.toolSearch.enabled";
const AgentHostToolSearchDeferThresholdSettingId = "chat.agentHost.copilot.toolSearch.deferThreshold";
const AgentHostReasoningEffortOverrideSettingId = "chat.agentHost.copilot.reasoningEffortOverride";
const AgentHostModelCapabilityOverridesSettingId = "chat.agentHost.modelCapabilityOverrides";
const copilotSdkLogLevelSettingValues = ["info", "trace"];
function normalizeToolSearchDeferThreshold(value) {
  return value !== void 0 && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 1;
}
const copilotCliConfigSchema = createSchema({
  ["enableCustomTerminalTool" /* EnableCustomTerminalTool */]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.enableCustomTerminalTool.title", "Use Agent Host Terminal Tool"),
    description: localize("agentHost.config.enableCustomTerminalTool.description", "When enabled, Copilot SDK sessions use Agent Host's terminal tool override instead of the SDK's default terminal behavior."),
    default: false
  }),
  ["copilotSdkLogLevel" /* CopilotSdkLogLevel */]: schemaProperty({
    type: "string",
    title: localize("agentHost.config.copilotSdkLogLevel.title", "Copilot SDK Log Level"),
    description: localize("agentHost.config.copilotSdkLogLevel.description", "Controls logging from the Copilot SDK runtime. Agent host trace logging always enables trace output."),
    enum: [...copilotSdkLogLevelSettingValues],
    enumLabels: [
      localize("agentHost.config.copilotSdkLogLevel.info", "Info"),
      localize("agentHost.config.copilotSdkLogLevel.trace", "Trace")
    ],
    default: "info"
  }),
  ["rubberDuck" /* RubberDuck */]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.rubberDuck.title", "Rubber Duck Agent"),
    description: localize("agentHost.config.rubberDuck.description", "When enabled, the coding agent uses a rubber duck critic subagent to review code changes using a complementary model."),
    default: false
  }),
  ["opus48Prompt" /* Opus48Prompt */]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.opus48Prompt.title", "Opus 4.8 Agent Prompt"),
    description: localize("agentHost.config.opus48Prompt.description", "When enabled, Copilot SDK sessions running a Claude Opus 4.8 model apply Opus 4.8-tuned system-prompt section overrides on top of the default system message."),
    default: false
  }),
  ["toolSearchEnabled" /* ToolSearchEnabled */]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.toolSearchEnabled.title", "Agent Host Tool Search"),
    description: localize("agentHost.config.toolSearchEnabled.description", "When enabled, Copilot SDK sessions defer MCP and non-core VS Code tools behind a tool-search tool so the model discovers them on demand instead of loading every tool definition up front."),
    default: true
  }),
  ["toolSearchDeferThreshold" /* ToolSearchDeferThreshold */]: schemaProperty({
    type: "number",
    title: localize("agentHost.config.toolSearchDeferThreshold.title", "Tool Search Defer Threshold"),
    description: localize("agentHost.config.toolSearchDeferThreshold.description", "Minimum number of tools before MCP and external tools are deferred behind tool search. Set to 0 to always defer external tools. Only effective when tool search is enabled."),
    default: 1
  }),
  ["reasoningEffortOverride" /* ReasoningEffortOverride */]: schemaProperty({
    type: "string",
    title: localize("agentHost.config.reasoningEffortOverride.title", "Reasoning Effort Override"),
    description: localize("agentHost.config.reasoningEffortOverride.description", "Overrides the reasoning effort for Copilot SDK sessions regardless of the per-model picker value. Set it to a level the selected model supports (e.g. `low`, `medium`, `high`, `xhigh`, `max`); a value that isn't a recognized effort level is ignored and the session falls back to the picker value. Only affects Copilot SDK sessions; intended for experimentation."),
    default: ""
  }),
  ["modelCapabilityOverrides" /* ModelCapabilityOverrides */]: schemaProperty({
    type: "object",
    title: localize("agentHost.config.modelCapabilityOverrides.title", "Model Capability Overrides"),
    description: localize("agentHost.config.modelCapabilityOverrides.description", "Per-model capability overrides for Copilot SDK sessions, keyed by model id. Aliasing a model id to a known `family` routes it to that family's tuned system prompt without changing the model id sent to the runtime. Only affects Copilot SDK sessions; intended for experimentation."),
    additionalProperties: {
      type: "object",
      title: localize("agentHost.config.modelCapabilityOverrides.entry.title", "Capability Override"),
      description: localize("agentHost.config.modelCapabilityOverrides.entry.description", "A single capability override. The property key is the model id."),
      properties: {
        family: {
          type: "string",
          title: localize("agentHost.config.modelCapabilityOverrides.family.title", "Family"),
          description: localize("agentHost.config.modelCapabilityOverrides.family.description", "Alias the model's family for prompt/capability routing (e.g. `claude-opus-4-8`).")
        }
      }
    },
    default: {}
  })
});
function getModelFamilyAlias(overrides, modelId) {
  const family = overrides?.[modelId]?.family;
  return typeof family === "string" && family.length > 0 ? family : void 0;
}
function applyModelFamilyAlias(model, overrides) {
  if (!model) {
    return void 0;
  }
  const family = getModelFamilyAlias(overrides, model.id);
  return family ? { ...model, id: family } : model;
}
export {
  AgentHostCopilotSdkLogLevelSettingId,
  AgentHostCustomTerminalToolEnabledSettingId,
  AgentHostModelCapabilityOverridesSettingId,
  AgentHostOpus48PromptEnabledSettingId,
  AgentHostReasoningEffortOverrideSettingId,
  AgentHostToolSearchDeferThresholdSettingId,
  AgentHostToolSearchEnabledSettingId,
  CopilotCliConfigKey,
  applyModelFamilyAlias,
  copilotCliConfigSchema,
  copilotSdkLogLevelSettingValues,
  normalizeToolSearchDeferThreshold
};
