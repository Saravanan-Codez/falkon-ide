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
import { Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { AgentHostAllowSignedOutWhenUsableSettingId, IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { AgentHostConfigKey } from "../../../../../../platform/agentHost/common/agentHostCustomizationConfig.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { AgentHostRootConfigForwarder } from "./agentHostRootConfigForwarder.js";
let AgentHostAllowSignedOutWhenUsableContribution = class extends Disposable {
  constructor(agentHostService, _configurationService, _agentHostEnablementService) {
    super();
    this._configurationService = _configurationService;
    this._agentHostEnablementService = _agentHostEnablementService;
    const keys = [
      {
        key: AgentHostConfigKey.AllowSignedOutWhenUsable,
        computeValue: () => this._configurationService.getValue(AgentHostAllowSignedOutWhenUsableSettingId) === true,
        registerTriggers: (store, push) => {
          const optInChanged = Event.filter(this._configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(AgentHostAllowSignedOutWhenUsableSettingId), store);
          store.add(optInChanged(() => push()));
        }
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
    this.ID = "workbench.contrib.agentHostAllowSignedOutWhenUsable";
  }
};
AgentHostAllowSignedOutWhenUsableContribution = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IAgentHostEnablementService)
], AgentHostAllowSignedOutWhenUsableContribution);
export {
  AgentHostAllowSignedOutWhenUsableContribution
};
