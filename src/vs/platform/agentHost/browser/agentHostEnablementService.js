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
import { Disposable } from "../../../base/common/lifecycle.js";
import { observableValue } from "../../../base/common/observable.js";
import { isWeb } from "../../../base/common/platform.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { ChatAIDisabledSettingId } from "../../chat/common/chatSettings.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { AGENT_HOST_ENABLED_CONTEXT_KEY, IAgentHostEnablementService } from "../common/agentHostEnablementService.js";
class AgentHostEnablementService extends Disposable {
  constructor(_isAgentHostRuntimeAvailable, configurationService, contextKeyService) {
    super();
    this._isAgentHostRuntimeAvailable = _isAgentHostRuntimeAvailable;
    this._enabled = observableValue(this, this._readEnabled(configurationService));
    this.enabled = this._enabled;
    this._enabledContextKey = AGENT_HOST_ENABLED_CONTEXT_KEY.bindTo(contextKeyService);
    this._enabledContextKey.set(this.enabled.get());
    this._register(configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ChatAIDisabledSettingId)) {
        this._updateEnabled(configurationService);
      }
    }));
  }
  _readEnabled(configurationService) {
    return this._isAgentHostRuntimeAvailable && configurationService.getValue(ChatAIDisabledSettingId) !== true;
  }
  _updateEnabled(configurationService) {
    const enabled = this._readEnabled(configurationService);
    if (this._enabled.get() || !enabled) {
      return;
    }
    this._enabled.set(true, void 0);
    this._enabledContextKey.set(true);
  }
}
let BrowserAgentHostEnablementService = class extends AgentHostEnablementService {
  constructor(configurationService, contextKeyService) {
    super(!isWeb, configurationService, contextKeyService);
  }
};
BrowserAgentHostEnablementService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IContextKeyService)
], BrowserAgentHostEnablementService);
registerSingleton(IAgentHostEnablementService, BrowserAgentHostEnablementService, InstantiationType.Eager);
export {
  AgentHostEnablementService
};
