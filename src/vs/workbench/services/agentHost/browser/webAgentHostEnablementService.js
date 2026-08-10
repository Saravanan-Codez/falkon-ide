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
import { AgentHostEnablementService } from "../../../../platform/agentHost/browser/agentHostEnablementService.js";
import { IAgentHostEnablementService } from "../../../../platform/agentHost/common/agentHostEnablementService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
let WebAgentHostEnablementService = class extends AgentHostEnablementService {
  constructor(configurationService, contextKeyService, environmentService) {
    super(!!environmentService.remoteAuthority, configurationService, contextKeyService);
  }
};
WebAgentHostEnablementService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IWorkbenchEnvironmentService)
], WebAgentHostEnablementService);
registerSingleton(IAgentHostEnablementService, WebAgentHostEnablementService, InstantiationType.Eager);
export {
  WebAgentHostEnablementService
};
