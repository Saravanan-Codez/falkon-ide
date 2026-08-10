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
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { AgentHostSessionTypesAvailableContext } from "../../../common/contextkeys.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
let AgentHostReadinessContextContribution = class extends Disposable {
  constructor(_sessionsManagementService, contextKeyService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._agentHostSessionTypesAvailable = AgentHostSessionTypesAvailableContext.bindTo(contextKeyService);
    this._register(toDisposable(() => this._agentHostSessionTypesAvailable.reset()));
    this._register(this._sessionsManagementService.onDidChangeSessionTypes(() => this._update()));
    this._update();
  }
  static {
    this.ID = "sessions.contrib.onboardingTours.agentHostReadinessContext";
  }
  _update() {
    this._agentHostSessionTypesAvailable.set(this._sessionsManagementService.getAllProviderSessionTypes().some(({ providerId }) => isAgentHostProviderId(providerId)));
  }
};
AgentHostReadinessContextContribution = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, IContextKeyService)
], AgentHostReadinessContextContribution);
registerWorkbenchContribution2(AgentHostReadinessContextContribution.ID, AgentHostReadinessContextContribution, WorkbenchPhase.BlockRestore);
export {
  AgentHostReadinessContextContribution
};
