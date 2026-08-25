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
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import * as nls from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { agentHostAgentPickerStorageKey, resolveAgentHostAgent } from "../../../../../platform/agentHost/common/customAgents.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { IChatWidgetService } from "../../../../../workbench/contrib/chat/browser/chat.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { ChatMode } from "../../../../../workbench/contrib/chat/common/chatModes.js";
import { IChatService } from "../../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { logChangesToStateModel } from "../../../../../workbench/contrib/chat/common/model/chatModel.js";
import { ChatModeKind } from "../../../../../workbench/contrib/chat/common/constants.js";
import { Menus } from "../../../../browser/menus.js";
import { isAgentHostProvider, LOCAL_AGENT_HOST_PROVIDER_ID, REMOTE_AGENT_HOST_PROVIDER_RE } from "../../../../common/agentHostSessionsProvider.js";
import { SessionProviderIdContext, IsPhoneLayoutContext } from "../../../../common/contextkeys.js";
import { IsSessionsWindowContext } from "../../../../../workbench/common/contextkeys.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { SessionStatus } from "../../../../services/sessions/common/session.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { ModePicker, ModePickerModel } from "../../copilotChatSessions/browser/modePicker.js";
import { ISessionContext } from "../../../../services/sessions/browser/sessionContext.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
const IsActiveSessionAgentHost = ContextKeyExpr.or(
  ContextKeyExpr.equals(SessionProviderIdContext.key, LOCAL_AGENT_HOST_PROVIDER_ID),
  ContextKeyExpr.regex(SessionProviderIdContext.key, REMOTE_AGENT_HOST_PROVIDER_RE)
);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "sessions.agentHost.agentPicker",
      title: nls.localize2("agentHostAgentPicker", "Agent"),
      f1: false,
      menu: [{
        id: Menus.NewSessionConfig,
        group: "navigation",
        order: -1,
        when: ContextKeyExpr.and(IsActiveSessionAgentHost, IsPhoneLayoutContext.negate())
      }, {
        // Running-session input bar — only inside the dedicated
        // Agents Window. The regular VS Code chat editor uses the
        // built-in mode picker for Agent Host custom agents.
        id: MenuId.ChatInput,
        group: "navigation",
        order: 1,
        // Hide the agent picker while a delegation (continue in) target is pending.
        when: ContextKeyExpr.and(ChatContextKeyExprs.isAgentHostSession, IsSessionsWindowContext, IsPhoneLayoutContext.negate(), ChatContextKeys.hasPendingDelegationTarget.negate())
      }]
    });
  }
  async run() {
  }
});
class AgentHostModePickerActionViewItem extends BaseActionViewItem {
  constructor(picker, disposable) {
    super(void 0, { id: "", label: "", enabled: true, class: void 0, tooltip: "", run: () => {
    } });
    this.picker = picker;
    this._register(disposable);
  }
  render(container) {
    container.classList.add("chat-input-picker-item", "chat-agent-picker-item");
    this.picker.render(container);
  }
  dispose() {
    this.picker.dispose();
    super.dispose();
  }
}
let AgentHostAgentPickerContribution = class extends Disposable {
  constructor(actionViewItemService, instantiationService, sessionsService, sessionsProvidersService, chatService, chatWidgetService, storageService, logService) {
    super();
    this.chatService = chatService;
    this.chatWidgetService = chatWidgetService;
    this.storageService = storageService;
    this.logService = logService;
    const modePickerModel = this._register(instantiationService.createInstance(ModePickerModel));
    let settingAgentInternally = false;
    const initAgentFromActiveSession = () => {
      const session = sessionsService.activeSession.get();
      this._initAgent(session, session?.mode.get()?.id, session?.status.get() === SessionStatus.Untitled, sessionsProvidersService, () => settingAgentInternally = true, () => settingAgentInternally = false);
    };
    const syncChatInputModeFromActiveSession = () => {
      const session = sessionsService.activeSession.get();
      const selectedAgentUri = session?.mode.get()?.id;
      this._syncChatInputMode(session, selectedAgentUri, sessionsProvidersService);
    };
    this._register(autorun((reader) => {
      const session = sessionsService.activeSession.read(reader);
      const provider = this._getProvider(session, sessionsProvidersService);
      const selectedAgentUri = session?.mode.read(reader)?.id;
      modePickerModel.setSession(provider ? session : void 0, selectedAgentUri);
      const isUntitled = session?.status.read(reader) === SessionStatus.Untitled;
      this._syncChatInputMode(session, selectedAgentUri, sessionsProvidersService);
      this._initAgent(session, selectedAgentUri, isUntitled, sessionsProvidersService, () => settingAgentInternally = true, () => settingAgentInternally = false);
    }));
    this._register(this.chatWidgetService.onDidAddWidget(() => {
      syncChatInputModeFromActiveSession();
    }));
    this._register(this.chatWidgetService.onDidChangeFocusedSession(() => {
      syncChatInputModeFromActiveSession();
    }));
    const customAgentsListener = this._register(new MutableDisposable());
    this._register(autorun((reader) => {
      const session = sessionsService.activeSession.read(reader);
      const provider = this._getProvider(session, sessionsProvidersService);
      customAgentsListener.value = provider?.onDidChangeCustomAgents(() => {
        if (!settingAgentInternally) {
          initAgentFromActiveSession();
        }
      });
    }));
    const factory = (_action, _options, scopedInstantiationService) => {
      const { session } = scopedInstantiationService.invokeFunction((accessor) => accessor.get(ISessionContext));
      const picker = scopedInstantiationService.createInstance(ModePicker, modePickerModel, session);
      const disposableStore = new DisposableStore();
      disposableStore.add(picker.onDidSelect((mode) => {
        this._selectMode(mode, session.get(), sessionsProvidersService);
      }));
      return scopedInstantiationService.createInstance(AgentHostModePickerActionViewItem, picker, disposableStore);
    };
    this._register(actionViewItemService.register(Menus.NewSessionConfig, "sessions.agentHost.agentPicker", factory));
    this._register(actionViewItemService.register(MenuId.ChatInput, "sessions.agentHost.agentPicker", factory));
  }
  static {
    this.ID = "sessions.contrib.agentHostAgentPicker";
  }
  _getProvider(session, sessionsProvidersService) {
    if (!session) {
      return void 0;
    }
    const provider = sessionsProvidersService.getProvider(session.providerId);
    return provider && isAgentHostProvider(provider) ? provider : void 0;
  }
  _syncChatInputMode(session, selectedAgentUri, sessionsProvidersService) {
    if (!session || !this._getProvider(session, sessionsProvidersService)) {
      return;
    }
    const chatModel = this.chatService.getSession(session.resource);
    const currentMode = chatModel?.inputModel.state.get()?.mode;
    const nextMode = selectedAgentUri ? { id: selectedAgentUri, kind: ChatModeKind.Agent } : { id: ChatMode.Agent.id, kind: ChatModeKind.Agent };
    if (currentMode?.id === nextMode.id && currentMode.kind === nextMode.kind) {
      this._syncVisibleChatInputMode(session, nextMode.id);
      return;
    }
    chatModel?.inputModel.setState({ mode: nextMode });
    this._syncVisibleChatInputMode(session, nextMode.id);
  }
  _syncVisibleChatInputMode(session, modeId) {
    const widget = this.chatWidgetService.getWidgetBySessionResource(session.resource);
    if (!widget) {
      return;
    }
    const currentMode = widget.input.currentModeObs.get();
    if (currentMode.id === modeId) {
      return;
    }
    const apply = async () => {
      await widget.input.currentChatModesObs.get().waitForPendingUpdates();
      if (widget.viewModel?.model.sessionResource.toString() !== session.resource.toString()) {
        return;
      }
      const mode = widget.input.currentChatModesObs.get().findModeById(modeId);
      if (!mode) {
        return;
      }
      const chatModel = this.chatService.getSession(session.resource);
      logChangesToStateModel(chatModel?.inputModel, `[AGPK] _syncVisibleChatInputMode -> widget.input.setChatMode(${modeId}) for ${session.resource.toString()}`, void 0, chatModel?.inputModel.state.get(), this.logService);
      widget.input.setChatMode(modeId, false);
    };
    apply().catch((err) => this.logService.error("[AgentHostAgentPickerProbe] sync visible chat input mode failed", err));
  }
  _initAgent(session, selectedAgentUri, isUntitled, sessionsProvidersService, beginInternalSet, endInternalSet) {
    const provider = this._getProvider(session, sessionsProvidersService);
    if (!session || !provider) {
      return;
    }
    const agents = provider.getCustomAgents(session.sessionId);
    const storedUri = isUntitled ? this.storageService.get(agentHostAgentPickerStorageKey(session.resource.scheme), StorageScope.PROFILE) : void 0;
    const resolved = resolveAgentHostAgent(agents, selectedAgentUri, storedUri);
    if (!selectedAgentUri && isUntitled && resolved) {
      beginInternalSet();
      try {
        this._setAgent(session, provider, resolved);
      } finally {
        endInternalSet();
      }
    } else if (selectedAgentUri && !resolved && agents.length > 0 && !isUntitled) {
      beginInternalSet();
      try {
        this._setAgent(session, provider, void 0);
      } finally {
        endInternalSet();
      }
    }
  }
  _selectMode(mode, session, sessionsProvidersService) {
    if (!session) {
      return;
    }
    const provider = sessionsProvidersService.getProvider(session.providerId);
    if (!provider || !isAgentHostProvider(provider)) {
      return;
    }
    if (mode.id === ChatMode.Agent.id) {
      this._setAgent(session, provider, void 0);
    } else {
      const rawAgentUri = mode.id;
      this._setAgent(session, provider, { uri: rawAgentUri, name: mode.name.get() });
    }
  }
  _setAgent(session, provider, agent) {
    const key = agentHostAgentPickerStorageKey(session.resource.scheme);
    if (agent) {
      this.storageService.store(key, agent.uri, StorageScope.PROFILE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(key, StorageScope.PROFILE);
    }
    provider.setAgent?.(session.sessionId, agent ? { uri: agent.uri, name: agent.name } : void 0);
  }
};
AgentHostAgentPickerContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, ISessionsProvidersService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, ILogService)
], AgentHostAgentPickerContribution);
registerWorkbenchContribution2(AgentHostAgentPickerContribution.ID, AgentHostAgentPickerContribution, WorkbenchPhase.AfterRestored);
