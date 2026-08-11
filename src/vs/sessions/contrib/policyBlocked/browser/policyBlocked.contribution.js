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
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { ChatConfiguration } from "../../../../workbench/contrib/chat/common/constants.js";
import { SessionsBlockedReason, SessionsPolicyBlockedOverlay } from "./sessionsPolicyBlocked.js";
import { AccountPolicyGateState, AccountPolicyGateUnsatisfiedReason, IAccountPolicyGateService } from "../../../../workbench/services/policies/common/accountPolicyService.js";
let SessionsPolicyBlockedContribution = class extends Disposable {
  constructor(configurationService, layoutService, instantiationService, gateService, defaultAccountService) {
    super();
    this.configurationService = configurationService;
    this.layoutService = layoutService;
    this.instantiationService = instantiationService;
    this.gateService = gateService;
    this.defaultAccountService = defaultAccountService;
    this.overlayRef = this._register(new MutableDisposable());
    this.update();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.AgentEnabled)) {
        this.update();
      }
    }));
    this._register(this.gateService.onDidChangeGateInfo(() => this.update()));
  }
  static {
    this.ID = "workbench.contrib.sessionsPolicyBlocked";
  }
  update() {
    const gateInfo = this.gateService.gateInfo;
    const gateForcesAgentDisabled = gateInfo.state === AccountPolicyGateState.Restricted && gateInfo.reason !== AccountPolicyGateUnsatisfiedReason.PolicyNotResolved;
    const agentEnabled = this.configurationService.getValue(ChatConfiguration.AgentEnabled);
    if (agentEnabled === false && !gateForcesAgentDisabled) {
      this.showOverlay({ reason: SessionsBlockedReason.AgentDisabled });
      return;
    }
    if (gateInfo.state === AccountPolicyGateState.Restricted) {
      if (gateInfo.reason === AccountPolicyGateUnsatisfiedReason.NoAccount || gateInfo.reason === AccountPolicyGateUnsatisfiedReason.WrongProvider) {
        this.overlayRef.clear();
        this.currentReason = void 0;
        return;
      }
      if (gateInfo.reason === AccountPolicyGateUnsatisfiedReason.PolicyNotResolved) {
        this.showOverlay({ reason: SessionsBlockedReason.Loading });
      } else {
        const accountName = this.defaultAccountService.currentDefaultAccount?.accountName;
        this.showOverlay({
          reason: SessionsBlockedReason.AccountPolicyGate,
          approvedOrganizations: gateInfo.approvedOrganizations,
          accountName
        });
      }
      return;
    }
    this.overlayRef.clear();
    this.currentReason = void 0;
  }
  showOverlay(options) {
    if (this.currentReason === options.reason && options.reason !== SessionsBlockedReason.AccountPolicyGate) {
      return;
    }
    this.overlayRef.clear();
    this.currentReason = options.reason;
    this.overlayRef.value = this.instantiationService.createInstance(
      SessionsPolicyBlockedOverlay,
      this.layoutService.mainContainer,
      options
    );
  }
};
SessionsPolicyBlockedContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IAccountPolicyGateService),
  __decorateParam(4, IDefaultAccountService)
], SessionsPolicyBlockedContribution);
registerWorkbenchContribution2(SessionsPolicyBlockedContribution.ID, SessionsPolicyBlockedContribution, WorkbenchPhase.BlockRestore);
export {
  SessionsPolicyBlockedContribution
};
