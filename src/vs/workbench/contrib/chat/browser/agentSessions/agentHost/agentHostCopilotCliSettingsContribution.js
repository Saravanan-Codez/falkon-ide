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
import { autorun } from "../../../../../../base/common/observable.js";
import { isObject } from "../../../../../../base/common/types.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { AgentHostCopilotSdkLogLevelSettingId, AgentHostModelCapabilityOverridesSettingId, AgentHostOpus48PromptEnabledSettingId, AgentHostReasoningEffortOverrideSettingId, AgentHostToolSearchDeferThresholdSettingId, AgentHostToolSearchEnabledSettingId, CopilotCliConfigKey, normalizeToolSearchDeferThreshold } from "../../../../../../platform/agentHost/common/copilotCliConfig.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { AgentHostRootConfigForwarder } from "./agentHostRootConfigForwarder.js";
let AgentHostCopilotCliSettingsContribution = class extends Disposable {
  constructor(agentHostService, _configurationService, _agentHostEnablementService) {
    super();
    this._configurationService = _configurationService;
    this._agentHostEnablementService = _agentHostEnablementService;
    const keys = [
      {
        key: CopilotCliConfigKey.CopilotSdkLogLevel,
        computeValue: () => this._configurationService.getValue(AgentHostCopilotSdkLogLevelSettingId) ?? "info",
        registerTriggers: (store, push) => this._pushOnSettingChange(store, push, AgentHostCopilotSdkLogLevelSettingId)
      },
      {
        key: CopilotCliConfigKey.Opus48Prompt,
        computeValue: () => this._configurationService.getValue(AgentHostOpus48PromptEnabledSettingId) === true,
        registerTriggers: (store, push) => this._pushOnSettingChange(store, push, AgentHostOpus48PromptEnabledSettingId)
      },
      {
        key: CopilotCliConfigKey.ToolSearchEnabled,
        computeValue: () => this._configurationService.getValue(AgentHostToolSearchEnabledSettingId) === true,
        registerTriggers: (store, push) => this._pushOnSettingChange(store, push, AgentHostToolSearchEnabledSettingId)
      },
      {
        key: CopilotCliConfigKey.ToolSearchDeferThreshold,
        computeValue: () => normalizeToolSearchDeferThreshold(this._configurationService.getValue(AgentHostToolSearchDeferThresholdSettingId)),
        registerTriggers: (store, push) => this._pushOnSettingChange(store, push, AgentHostToolSearchDeferThresholdSettingId)
      },
      {
        key: CopilotCliConfigKey.ReasoningEffortOverride,
        computeValue: () => {
          const value = this._configurationService.getValue(AgentHostReasoningEffortOverrideSettingId);
          return typeof value === "string" ? value : "";
        },
        registerTriggers: (store, push) => this._pushOnSettingChange(store, push, AgentHostReasoningEffortOverrideSettingId)
      },
      {
        key: CopilotCliConfigKey.ModelCapabilityOverrides,
        computeValue: () => {
          const value = this._configurationService.getValue(AgentHostModelCapabilityOverridesSettingId);
          return isObject(value) ? value : {};
        },
        registerTriggers: (store, push) => this._pushOnSettingChange(store, push, AgentHostModelCapabilityOverridesSettingId)
      }
    ];
    this._forwarder = this._register(new AgentHostRootConfigForwarder(keys, agentHostService));
    this._register(autorun((reader) => {
      if (this._agentHostEnablementService.enabled.read(reader)) {
        this._forwarder.start();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentHostCopilotCliSettings";
  }
  _pushOnSettingChange(store, push, settingId) {
    store.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(settingId)) {
        push();
      }
    }));
  }
};
AgentHostCopilotCliSettingsContribution = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IAgentHostEnablementService)
], AgentHostCopilotCliSettingsContribution);
export {
  AgentHostCopilotCliSettingsContribution
};
