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
import * as dom from "../../../../../../base/browser/dom.js";
import { renderAsPlaintext } from "../../../../../../base/browser/markdownRenderer.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
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
import { IsSessionsWindowContext } from "../../../../../common/contextkeys.js";
import { IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
import { IChatSessionsService } from "../../../common/chatSessionsService.js";
import { ILanguageModelsService } from "../../../common/languageModels.js";
import { AgentSessionProviders, getAgentSessionProvider, getAgentSessionProviderDescription, getAgentSessionProviderIcon, getAgentSessionProviderName, isFirstPartyAgentSessionProvider } from "../../agentSessions/agentSessions.js";
import { getSessionTypeAvailability, getSessionTypeUnavailableDescription, getSessionTypeUnavailableHover, SessionTypeAvailability } from "../../agentSessions/sessionTypeAvailability.js";
import { ChatConfiguration, getDefaultNewChatSessionType, isVisibleEditorChatSessionType, recordUserSelectedSessionType } from "../../../common/constants.js";
import { ChatInputPickerActionViewItem } from "./chatInputPickerActionItem.js";
const firstPartyCategory = { label: localize("chat.sessionTarget.category.agent", "Agent Types"), order: 1 };
const otherCategory = { label: localize("chat.sessionTarget.category.other", "Other"), order: 2 };
function createSessionTypePickerAction(action, sessionTypeItem, currentType, availability, enabled, category, sourceDescription, icon, run) {
  const unavailable = availability !== SessionTypeAvailability.Available;
  const description = getSessionTypeUnavailableDescription(availability) ?? sourceDescription;
  const hoverDescription = getSessionTypeUnavailableHover(availability) ?? sessionTypeItem.hoverDescription;
  const ariaDescription = description ? renderAsPlaintext(description) : void 0;
  const ariaHoverDescription = hoverDescription ? renderAsPlaintext(hoverDescription) : void 0;
  return {
    ...action,
    id: sessionTypeItem.commandId,
    label: sessionTypeItem.label,
    checked: currentType === sessionTypeItem.type,
    icon,
    enabled: unavailable ? false : enabled,
    category,
    description,
    ariaDescription: ariaDescription && ariaHoverDescription ? localize("chat.sessionTarget.ariaDescription", "{0}. {1}", ariaDescription, ariaHoverDescription) : ariaDescription ?? ariaHoverDescription,
    tooltip: "",
    hover: { content: hoverDescription },
    run: async () => run()
  };
}
let SessionTypePickerActionItem = class extends ChatInputPickerActionViewItem {
  constructor(action, chatSessionPosition, delegate, pickerOptions, actionWidgetService, keybindingService, contextKeyService, chatSessionsService, commandService, openerService, telemetryService, chatEntitlementService, languageModelsService, configurationService, storageService, workspaceContextService, agentHostEnablementService) {
    const actionProvider = {
      getActions: () => {
        const currentType = this._getSelectedSessionType() ?? this._getDefaultSessionType();
        const actions = [...this._getAdditionalActions().map((a) => ({ ...action, ...a }))];
        for (const sessionTypeItem of this._sessionTypeItems) {
          const availability = getSessionTypeAvailability(this.chatSessionsService, this.chatEntitlementService, this.languageModelsService, sessionTypeItem.type);
          actions.push(createSessionTypePickerAction(
            action,
            sessionTypeItem,
            currentType,
            availability,
            this._isSessionTypeEnabled(sessionTypeItem.type),
            this._getSessionCategory(sessionTypeItem),
            this._getSessionDescription(sessionTypeItem),
            this._getSessionIcon(sessionTypeItem),
            () => this._run(sessionTypeItem)
          ));
        }
        return actions;
      }
    };
    const actionBarActionProvider = {
      getActions: () => {
        return [this._getLearnMore()];
      }
    };
    const sessionTargetPickerOptions = {
      actionProvider,
      actionBarActionProvider,
      showItemKeybindings: true,
      reporter: { id: "ChatSessionTypePicker", name: `ChatSessionTypePicker`, includeOptions: true }
    };
    super(action, sessionTargetPickerOptions, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this.chatSessionPosition = chatSessionPosition;
    this.delegate = delegate;
    this.keybindingService = keybindingService;
    this.chatSessionsService = chatSessionsService;
    this.commandService = commandService;
    this.openerService = openerService;
    this.chatEntitlementService = chatEntitlementService;
    this.languageModelsService = languageModelsService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this.workspaceContextService = workspaceContextService;
    this.agentHostEnablementService = agentHostEnablementService;
    this._sessionTypeItems = [];
    this._isSessionsWindow = IsSessionsWindowContext.getValue(contextKeyService) === true;
    this._register(this.chatSessionsService.onDidChangeAvailability(() => {
      this._updateAgentSessionItems();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.EditorPreferCopilotHarness) || e.affectsConfiguration(ChatConfiguration.DefaultToCopilotHarness) || e.affectsConfiguration(ChatConfiguration.EditorLocalAgentEnabled)) {
        this._updateAgentSessionItems();
        if (this.element) {
          this.renderLabel(this.element);
        }
      }
    }));
    this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this._updateAgentSessionItems()));
    this._updateAgentSessionItems();
  }
  _run(sessionTypeItem) {
    if (!this._isSessionsWindow) {
      recordUserSelectedSessionType(this.storageService, this.configurationService, this.chatSessionsService, this.workspaceContextService.getWorkspace(), sessionTypeItem.type, this.agentHostEnablementService.enabled.get());
    }
    if (this.delegate.setActiveSessionProvider) {
      this.delegate.setActiveSessionProvider(sessionTypeItem.type);
    } else {
      this.commandService.executeCommand(sessionTypeItem.commandId, this.chatSessionPosition);
    }
    if (this.element) {
      this.renderLabel(this.element);
    }
  }
  _getSelectedSessionType() {
    return this.delegate.getActiveSessionProvider();
  }
  _getAdditionalActions() {
    return [];
  }
  _getLearnMore() {
    const learnMoreUrl = "https://aka.ms/vscode-concept-harnesses";
    return {
      id: "workbench.action.chat.agentOverview.learnMore",
      label: localize("chat.learnMoreAgentTypes", "Learn about harnesses..."),
      tooltip: learnMoreUrl,
      class: void 0,
      enabled: true,
      run: async () => {
        await this.openerService.open(URI.parse(learnMoreUrl));
      }
    };
  }
  _updateAgentSessionItems() {
    const localSessionItem = {
      type: AgentSessionProviders.Local,
      label: getAgentSessionProviderName(AgentSessionProviders.Local),
      hoverDescription: getAgentSessionProviderDescription(AgentSessionProviders.Local),
      commandId: `workbench.action.chat.openNewChatSessionInPlace.${AgentSessionProviders.Local}`
    };
    const allAgentSessionItems = [localSessionItem];
    const contributions = this.chatSessionsService.getAllChatSessionContributions();
    for (const contribution of contributions) {
      const agentSessionType = getAgentSessionProvider(contribution.type);
      if (agentSessionType) {
        allAgentSessionItems.push({
          type: agentSessionType,
          label: getAgentSessionProviderName(agentSessionType),
          hoverDescription: getAgentSessionProviderDescription(agentSessionType),
          commandId: contribution.canDelegate ? `workbench.action.chat.openNewChatSessionInPlace.${contribution.type}` : `workbench.action.chat.openNewChatSessionExternal.${contribution.type}`
        });
      } else {
        allAgentSessionItems.push({
          type: contribution.type,
          label: contribution.displayName ?? contribution.name ?? contribution.type,
          hoverDescription: contribution.description ?? "",
          commandId: `workbench.action.chat.openNewChatSessionInPlace.${contribution.type}`
        });
      }
    }
    const agentSessionItems = allAgentSessionItems.filter((item) => this._isVisible(item.type));
    const defaultType = this._getDefaultSessionType();
    if (defaultType !== AgentSessionProviders.Local) {
      const index = agentSessionItems.findIndex((item) => item.type === defaultType);
      if (index > 0) {
        const [defaultItem] = agentSessionItems.splice(index, 1);
        agentSessionItems.unshift(defaultItem);
      }
    }
    this._sessionTypeItems = agentSessionItems;
  }
  /**
   * The default session type for the picker when no session is yet active.
   * Defaults to Agent Host Copilot when the agent host is enabled, otherwise
   * {@link AgentSessionProviders.Local}.
   */
  _getDefaultSessionType() {
    return getDefaultNewChatSessionType(this.configurationService, this.chatSessionsService, this.storageService, this.workspaceContextService.getWorkspace(), this.agentHostEnablementService.enabled.get());
  }
  _isVisible(type) {
    return isVisibleEditorChatSessionType(type, this.configurationService, this.chatSessionsService, this.workspaceContextService.getWorkspace());
  }
  _isSessionTypeEnabled(type) {
    if (type === AgentSessionProviders.Local) {
      return true;
    }
    return !!this.chatSessionsService.getChatSessionContribution(type);
  }
  _getSessionCategory(sessionTypeItem) {
    const knownType = getAgentSessionProvider(sessionTypeItem.type);
    return knownType && isFirstPartyAgentSessionProvider(knownType) ? firstPartyCategory : otherCategory;
  }
  _getSessionDescription(_sessionTypeItem) {
    return void 0;
  }
  _getSessionIcon(sessionTypeItem) {
    const knownType = getAgentSessionProvider(sessionTypeItem.type);
    if (knownType) {
      return getAgentSessionProviderIcon(knownType);
    }
    const contribution = this.chatSessionsService.getChatSessionContribution(sessionTypeItem.type);
    if (contribution && ThemeIcon.isThemeIcon(contribution.icon)) {
      return contribution.icon;
    }
    return Codicon.extensions;
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-session-target-picker-item");
  }
  renderLabel(element) {
    this.setAriaLabelAttributes(element);
    const currentType = this._getSelectedSessionType() ?? this._getDefaultSessionType();
    const knownType = getAgentSessionProvider(currentType);
    const label = knownType ? getAgentSessionProviderName(knownType) : this.chatSessionsService.getChatSessionContribution(currentType)?.displayName ?? currentType;
    const icon = this._getSessionIcon({ type: currentType, label, hoverDescription: "", commandId: "" });
    const labelElements = [];
    labelElements.push(...renderLabelWithIcons(`$(${icon.id})`));
    labelElements.push(dom.$("span.chat-input-picker-label", void 0, label));
    dom.reset(element, ...labelElements);
    return null;
  }
};
SessionTypePickerActionItem = __decorateClass([
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
  __decorateParam(16, IAgentHostEnablementService)
], SessionTypePickerActionItem);
export {
  SessionTypePickerActionItem,
  createSessionTypePickerAction
};
