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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Iterable } from "../../../../../../base/common/iterator.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
import { IChatSessionsService } from "../../../common/chatSessionsService.js";
import { ILanguageModelsService } from "../../../common/languageModels.js";
import { ACTION_ID_NEW_CHAT } from "../../actions/chatActions.js";
import { AgentSessionProviders, getAgentCanContinueIn, getAgentSessionProvider, isAgentHostTarget, isFirstPartyAgentSessionProvider } from "../../agentSessions/agentSessions.js";
import { SessionTypePickerActionItem } from "./sessionTargetPickerActionItem.js";
import { IGitService } from "../../../../git/common/gitService.js";
let DelegationSessionPickerActionItem = class extends SessionTypePickerActionItem {
  constructor(action, chatSessionPosition, delegate, pickerOptions, actionWidgetService, keybindingService, contextKeyService, chatSessionsService, commandService, openerService, telemetryService, chatEntitlementService, languageModelsService, configurationService, storageService, workspaceContextService, agentHostEnablementService, gitService) {
    super(action, chatSessionPosition, delegate, pickerOptions, actionWidgetService, keybindingService, contextKeyService, chatSessionsService, commandService, openerService, telemetryService, chatEntitlementService, languageModelsService, configurationService, storageService, workspaceContextService, agentHostEnablementService);
    this.gitService = gitService;
  }
  _run(sessionTypeItem) {
    if (this.delegate.setPendingDelegationTarget) {
      this.delegate.setPendingDelegationTarget(sessionTypeItem.type);
    }
    if (this.element) {
      this.renderLabel(this.element);
    }
  }
  _getSelectedSessionType() {
    const delegationTarget = this.delegate.getPendingDelegationTarget ? this.delegate.getPendingDelegationTarget() : void 0;
    if (delegationTarget) {
      return delegationTarget;
    }
    return this.delegate.getActiveSessionProvider();
  }
  _isSessionTypeEnabled(type) {
    const allContributions = this.chatSessionsService.getAllChatSessionContributions();
    const contribution = allContributions.find((contribution2) => getAgentSessionProvider(contribution2.type) === type || contribution2.type === type);
    const activeProvider = this.delegate.getActiveSessionProvider();
    const isAgentHostSource = activeProvider !== void 0 && isAgentHostTarget(activeProvider);
    if (!this._isSessionsWindow && activeProvider !== AgentSessionProviders.Local && !isAgentHostSource) {
      return false;
    }
    if (this._isSessionsWindow && activeProvider !== AgentSessionProviders.Background && !isAgentHostSource) {
      return false;
    }
    if (this._isSessionsWindow && type === AgentSessionProviders.Cloud && !this._hasGitRepository()) {
      return false;
    }
    if (contribution && !contribution.canDelegate && activeProvider !== type) {
      return false;
    }
    return this._getSelectedSessionType() !== type;
  }
  _hasGitRepository() {
    if (this.delegate.hasGitRepository) {
      return this.delegate.hasGitRepository();
    }
    return !Iterable.isEmpty(this.gitService.repositories);
  }
  _isVisible(type) {
    if (this._isSessionsWindow && type === AgentSessionProviders.Local) {
      return false;
    }
    if (this.delegate.getActiveSessionProvider() === type) {
      return true;
    }
    if (this._isSessionsWindow && type === AgentSessionProviders.Background && this.chatSessionsService.getChatSessionContribution(AgentSessionProviders.AgentHostCopilot)) {
      return false;
    }
    if (!super._isVisible(type)) {
      return false;
    }
    return getAgentCanContinueIn(type);
  }
  _getSessionCategory(sessionTypeItem) {
    if (isFirstPartyAgentSessionProvider(sessionTypeItem.type)) {
      return { label: localize("continueIn", "Continue In"), order: 1, showHeader: true };
    }
    return { label: localize("continueInThirdParty", "Continue In (Third Party)"), order: 2, showHeader: false };
  }
  _getSessionDescription(sessionTypeItem) {
    return void 0;
  }
  _getLearnMore() {
    const learnMoreUrl = "https://aka.ms/vscode-agent-handoff";
    return {
      id: "workbench.action.chat.agentOverview.learnMoreHandOff",
      label: localize("chat.learnMoreAgentHandOff", "Learn about agent handoff..."),
      tooltip: learnMoreUrl,
      class: void 0,
      enabled: true,
      run: async () => {
        await this.openerService.open(URI.parse(learnMoreUrl));
      }
    };
  }
  _getAdditionalActions() {
    if (this._isSessionsWindow) {
      return [];
    }
    return [{
      id: "newChatSession",
      class: void 0,
      label: localize("chat.newChatSession", "New Chat Session"),
      tooltip: "",
      hover: { content: "" },
      checked: false,
      icon: Codicon.plus,
      enabled: true,
      category: { label: localize("chat.newChatSession.category", "New Chat Session"), order: 0, showHeader: false },
      description: this.keybindingService.lookupKeybinding(ACTION_ID_NEW_CHAT)?.getLabel() || void 0,
      run: async () => {
        this.commandService.executeCommand(ACTION_ID_NEW_CHAT, this.chatSessionPosition);
      }
    }];
  }
};
DelegationSessionPickerActionItem = __decorateClass([
  __decorateParam(4, IActionWidgetService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IChatSessionsService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, IChatEntitlementService),
  __decorateParam(12, ILanguageModelsService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IStorageService),
  __decorateParam(15, IWorkspaceContextService),
  __decorateParam(16, IAgentHostEnablementService),
  __decorateParam(17, IGitService)
], DelegationSessionPickerActionItem);
export {
  DelegationSessionPickerActionItem
};
