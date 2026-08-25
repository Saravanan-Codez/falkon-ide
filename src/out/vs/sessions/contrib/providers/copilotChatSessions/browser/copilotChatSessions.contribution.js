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
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { CopilotChatSessionsProvider, COPILOT_MULTI_CHAT_SETTING } from "../../copilotChatSessions/browser/copilotChatSessionsProvider.js";
import "../../copilotChatSessions/browser/copilotChatSessionsActions.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { localize } from "../../../../../nls.js";
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "sessions",
  properties: {
    [COPILOT_MULTI_CHAT_SETTING]: {
      type: "boolean",
      default: true,
      tags: ["preview"],
      description: localize("sessions.github.copilot.multiChatSessions", "Whether to enable multiple chats within a single session in the Copilot Chat sessions provider.")
    }
  }
});
let DefaultSessionsProviderContribution = class extends Disposable {
  static {
    this.ID = "sessions.defaultSessionsProvider";
  }
  constructor(instantiationService, sessionsProvidersService) {
    super();
    const provider = this._register(instantiationService.createInstance(CopilotChatSessionsProvider));
    this._register(sessionsProvidersService.registerProvider(provider));
  }
};
DefaultSessionsProviderContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ISessionsProvidersService)
], DefaultSessionsProviderContribution);
registerWorkbenchContribution2(DefaultSessionsProviderContribution.ID, DefaultSessionsProviderContribution, WorkbenchPhase.AfterRestored);
