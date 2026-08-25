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
import "./media/openInAgents.css";
import { $, append } from "../../../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../../platform/accessibility/common/accessibility.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INativeHostService } from "../../../../../platform/native/common/native.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../../platform/workspace/common/workspace.js";
import { IsSessionsWindowContext } from "../../../../common/contextkeys.js";
import { ToggleTitleBarConfigAction } from "../../../../browser/parts/titlebar/titlebarActions.js";
import { CHAT_CATEGORY } from "../../browser/actions/chatActions.js";
import { IChatWidgetService } from "../../browser/chat.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { SessionType } from "../../common/chatSessionsService.js";
import { getChatSessionType, isUntitledChatSession } from "../../common/model/chatUri.js";
import { ChatInputNotificationActionKind, ChatInputNotificationSeverity, IChatInputNotificationService } from "../../browser/widget/input/chatInputNotificationService.js";
import { OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID, OPEN_AGENTS_WINDOW_PRECONDITION, OPEN_AGENTS_WINDOW_COMMAND_ID, ChatConfiguration } from "../../common/constants.js";
import { CommandsRegistry, ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { AgentsWindowOpenSource, isAgentsWindowOpenSource } from "../../../../../platform/window/common/window.js";
const OPEN_WORKSPACE_IN_AGENTS_WINDOW_TITLE = localize2("openWorkspaceInAgentsWindow", "Open in Agents");
const OPEN_WORKSPACE_IN_AGENTS_WINDOW_CHAT_TITLE_COMMAND_ID = "workbench.action.chat.openWorkspaceInAgentsWindow.chatTitle";
const OPEN_WORKSPACE_IN_AGENTS_WINDOW_TITLE_BAR_COMMAND_ID = "workbench.action.chat.openWorkspaceInAgentsWindow.titleBar";
async function openCurrentWorkspaceInAgentsWindow(accessor, source) {
  const nativeHostService = accessor.get(INativeHostService);
  const workspaceContextService = accessor.get(IWorkspaceContextService);
  const folderUri = workspaceContextService.getWorkspace().folders[0]?.uri;
  await nativeHostService.openAgentsWindow({ folderUri: folderUri?.scheme === Schemas.file ? folderUri : void 0, source });
}
function isOpenChatSessionInAgentsWindowOptions(value) {
  return !!value && typeof value === "object" && isAgentsWindowOpenSource(value.agentsWindowOpenSource);
}
class OpenWorkspaceInAgentsWindowAction extends Action2 {
  constructor() {
    super({
      id: OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID,
      title: OPEN_WORKSPACE_IN_AGENTS_WINDOW_TITLE,
      category: CHAT_CATEGORY,
      precondition: OPEN_AGENTS_WINDOW_PRECONDITION,
      f1: true
    });
  }
  async run(accessor, options) {
    await openCurrentWorkspaceInAgentsWindow(accessor, options?.source ?? AgentsWindowOpenSource.CommandPalette);
  }
}
class OpenWorkspaceInAgentsWindowChatTitleAction extends Action2 {
  constructor() {
    super({
      id: OPEN_WORKSPACE_IN_AGENTS_WINDOW_CHAT_TITLE_COMMAND_ID,
      title: OPEN_WORKSPACE_IN_AGENTS_WINDOW_TITLE,
      precondition: OPEN_AGENTS_WINDOW_PRECONDITION,
      f1: false,
      menu: {
        id: MenuId.ChatTitleBarMenu,
        group: "c_sessions",
        order: 1,
        when: OPEN_AGENTS_WINDOW_PRECONDITION
      }
    });
  }
  async run(accessor) {
    await accessor.get(ICommandService).executeCommand(OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID, { source: AgentsWindowOpenSource.ChatTitleBar });
  }
}
class OpenWorkspaceInAgentsWindowTitleBarAction extends Action2 {
  constructor() {
    super({
      id: OPEN_WORKSPACE_IN_AGENTS_WINDOW_TITLE_BAR_COMMAND_ID,
      title: OPEN_WORKSPACE_IN_AGENTS_WINDOW_TITLE,
      precondition: OPEN_AGENTS_WINDOW_PRECONDITION,
      f1: false,
      menu: {
        id: MenuId.TitleBarAdjacentCenter,
        order: -1e3,
        when: ContextKeyExpr.and(
          OPEN_AGENTS_WINDOW_PRECONDITION,
          ContextKeyExpr.notEquals(`config.${ChatConfiguration.TitleBarOpenInAgentsWindowEnabled}`, false)
        )
      }
    });
  }
  async run(accessor) {
    await accessor.get(ICommandService).executeCommand(OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID, { source: AgentsWindowOpenSource.TitleBar });
  }
}
class ToggleOpenInAgentsWindowTitleBarAction extends ToggleTitleBarConfigAction {
  constructor() {
    super(
      ChatConfiguration.TitleBarOpenInAgentsWindowEnabled,
      localize("toggle.openInAgentsWindow", "Open in Agents Window"),
      localize("toggle.openInAgentsWindowDescription", "Toggle visibility of the Open in Agents Window button in title bar"),
      6,
      OPEN_AGENTS_WINDOW_PRECONDITION
    );
  }
}
class OpenAgentsWindowAction extends Action2 {
  constructor() {
    super({
      id: OPEN_AGENTS_WINDOW_COMMAND_ID,
      title: localize2("openAgentsWindow", "Open Agents Window"),
      category: CHAT_CATEGORY,
      precondition: OPEN_AGENTS_WINDOW_PRECONDITION,
      f1: true,
      keybinding: [{
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA,
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(IsSessionsWindowContext.toNegated(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.toNegated()),
        args: { source: AgentsWindowOpenSource.KeyboardShortcut }
      }, {
        // In screen reader mode, Cmd/Ctrl+Shift+A conflicts with many screen reader keybindings,
        // so require an additional Alt modifier.
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.KeyA,
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(IsSessionsWindowContext.toNegated(), CONTEXT_ACCESSIBILITY_MODE_ENABLED),
        args: { source: AgentsWindowOpenSource.KeyboardShortcut }
      }]
    });
  }
  async run(accessor, args) {
    const nativeHostService = accessor.get(INativeHostService);
    await nativeHostService.openAgentsWindow({ ...args, source: args?.source ?? AgentsWindowOpenSource.CommandPalette });
  }
}
class OpenChatSessionInAgentsWindowAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openSessionInAgentsWindow";
  }
  constructor() {
    super({
      id: OpenChatSessionInAgentsWindowAction.ID,
      title: localize2("openSessionInAgentsWindow", "Open in Agents Window"),
      category: CHAT_CATEGORY,
      precondition: OPEN_AGENTS_WINDOW_PRECONDITION,
      f1: false,
      menu: [{
        id: MenuId.ChatTitleBarMenu,
        group: "c_sessions",
        order: 0,
        when: ContextKeyExpr.and(
          OPEN_AGENTS_WINDOW_PRECONDITION,
          ContextKeyExpr.or(
            ChatContextKeys.chatSessionType.isEqualTo(SessionType.CopilotCLI),
            ChatContextKeys.chatSessionType.isEqualTo(SessionType.AgentHostCopilot)
          )
        )
      }]
    });
  }
  async run(accessor, ...rest) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const nativeHostService = accessor.get(INativeHostService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const commandOptions = isOpenChatSessionInAgentsWindowOptions(rest[0]) ? rest[0] : void 0;
    const source = commandOptions?.agentsWindowOpenSource ?? AgentsWindowOpenSource.ChatTitleBar;
    const args = commandOptions ? rest.slice(1) : rest;
    let sessionResource;
    const arg = args[0];
    if (URI.isUri(arg)) {
      sessionResource = arg;
    } else if (arg && typeof arg === "object") {
      const ctx = arg;
      if (URI.isUri(ctx.sessionResource)) {
        sessionResource = ctx.sessionResource;
      }
    }
    if (!sessionResource) {
      sessionResource = chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource;
    }
    const hasRealSession = sessionResource && !isUntitledChatSession(sessionResource);
    const folderUri = workspaceContextService.getWorkspace().folders[0]?.uri;
    await nativeHostService.openAgentsWindow({
      folderUri: !hasRealSession && folderUri?.scheme === Schemas.file ? folderUri.toJSON() : void 0,
      sessionResource: hasRealSession ? sessionResource?.toJSON() : void 0,
      source
    });
  }
}
let OpenWorkspaceInAgentsTitleBarWidget = class extends BaseActionViewItem {
  constructor(action, options, hoverService, keybindingService) {
    super(void 0, action, options);
    this.hoverService = hoverService;
    this.keybindingService = keybindingService;
  }
  render(container) {
    super.render(container);
    container.classList.add("open-in-agents-titlebar-widget");
    container.setAttribute("role", "button");
    const label = this.action.label;
    const hoverText = this.keybindingService.appendKeybinding(localize("openInAgentsHover", "Open in Agents Window"), OPEN_AGENTS_WINDOW_COMMAND_ID);
    container.setAttribute("aria-label", hoverText);
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), container, hoverText));
    const icon = append(container, $("span.open-in-agents-titlebar-widget-icon"));
    icon.setAttribute("aria-hidden", "true");
    const labelEl = append(container, $("span.open-in-agents-titlebar-widget-label"));
    labelEl.textContent = label;
  }
};
OpenWorkspaceInAgentsTitleBarWidget = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IKeybindingService)
], OpenWorkspaceInAgentsTitleBarWidget);
let OpenWorkspaceInAgentsContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.openWorkspaceInAgents.desktop";
  }
  constructor(actionViewItemService, instantiationService, contextKeyService, productService) {
    super();
    this._register(actionViewItemService.register(MenuId.TitleBarAdjacentCenter, OPEN_WORKSPACE_IN_AGENTS_WINDOW_TITLE_BAR_COMMAND_ID, (action, options) => {
      return instantiationService.createInstance(OpenWorkspaceInAgentsTitleBarWidget, action, options);
    }, void 0));
  }
};
OpenWorkspaceInAgentsContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IProductService)
], OpenWorkspaceInAgentsContribution);
var AgentsHandoffTipMode = /* @__PURE__ */ ((AgentsHandoffTipMode2) => {
  AgentsHandoffTipMode2["Hidden"] = "hidden";
  AgentsHandoffTipMode2["Default"] = "default";
  AgentsHandoffTipMode2["Custom"] = "custom";
  return AgentsHandoffTipMode2;
})(AgentsHandoffTipMode || {});
let AgentsHandoffInputTipContribution = class extends Disposable {
  constructor(_chatWidgetService, _notificationService, contextKeyService, _workspaceContextService, _telemetryService, _configurationService) {
    super();
    this._chatWidgetService = _chatWidgetService;
    this._notificationService = _notificationService;
    this._workspaceContextService = _workspaceContextService;
    this._telemetryService = _telemetryService;
    this._configurationService = _configurationService;
    /**
     * Set once the user dismisses (X) or opens the tip. Suppresses the tip for
     * the rest of this window's lifetime — intentionally in-memory only, so it
     * shows again the next time VS Code is reopened.
     */
    this._dismissedForWindow = false;
    this._register(CommandsRegistry.registerCommand(AgentsHandoffInputTipContribution.TIP_OPEN_COMMAND_ID, (accessor, ...args) => {
      this._logTipAction("open");
      this._dismissForWindow();
      return accessor.get(ICommandService).executeCommand(OpenChatSessionInAgentsWindowAction.ID, { agentsWindowOpenSource: AgentsWindowOpenSource.ChatHandoff }, ...args);
    }));
    this._register(CommandsRegistry.registerCommand(AgentsHandoffInputTipContribution.TIP_MUTE_COMMAND_ID, () => {
      this._logTipAction("mute");
      this._dismissForWindow();
      return this._configurationService.updateValue(ChatConfiguration.AgentsHandoffTipMode, "hidden" /* Hidden */);
    }));
    this._register(this._chatWidgetService.onDidChangeFocusedSession(() => this._update()));
    this._register(this._chatWidgetService.onDidAddWidget(() => this._update()));
    this._register(contextKeyService.onDidChangeContext(() => this._update()));
    this._register(this._workspaceContextService.onDidChangeWorkbenchState(() => this._update()));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.AgentsHandoffTipMode)) {
        this._lastPostedFor = void 0;
        this._update();
      }
    }));
    this._register(this._notificationService.onDidDismiss((id) => {
      if (id !== AgentsHandoffInputTipContribution.NOTIFICATION_ID) {
        return;
      }
      this._logTipAction("dismiss");
      this._dismissForWindow();
    }));
    this._update();
  }
  static {
    this.ID = "workbench.contrib.agentsHandoffInputTip";
  }
  static {
    this.NOTIFICATION_ID = "chat.agentsHandoff.openInAgentsWindow";
  }
  static {
    /**
     * Dedicated command backing the tip's action button. Lets us attach
     * mode + harness telemetry to the exact tip click (the title-bar menu
     * entry runs {@link OpenChatSessionInAgentsWindowAction} directly and is
     * intentionally not tracked here).
     */
    this.TIP_OPEN_COMMAND_ID = "workbench.action.chat.agentsHandoffTip.open";
  }
  static {
    /**
     * Dedicated command backing the tip's "Don't Show Again" button. Closes the
     * tip and flips {@link ChatConfiguration.AgentsHandoffTipMode} to `hidden`
     * so it never shows again.
     */
    this.TIP_MUTE_COMMAND_ID = "workbench.action.chat.agentsHandoffTip.mute";
  }
  static {
    /** Session types eligible for the handoff tip — the same set the Agents window can render directly. */
    this.ELIGIBLE_SESSION_TYPES = /* @__PURE__ */ new Set([SessionType.CopilotCLI, SessionType.AgentHostCopilot]);
  }
  static {
    /** Pseudo-key used as the {@link _lastPostedFor} value for the empty-workspace tip (no real session URI exists). */
    this.EMPTY_WORKSPACE_KEY = "__empty-workspace__";
  }
  /** Log a user interaction (open, dismiss, mute) with the handoff tip. */
  _logTipAction(action) {
    this._telemetryService.publicLog2("chat.agentsHandoffTip.action", {
      action,
      mode: this._getMode(),
      sessionType: this._lastPostedSessionType ?? ""
    });
  }
  _getMode() {
    const value = this._configurationService.getValue(ChatConfiguration.AgentsHandoffTipMode);
    switch (value) {
      case "hidden" /* Hidden */:
      case "custom" /* Custom */:
        return value;
      default:
        return "default" /* Default */;
    }
  }
  _update() {
    const mode = this._getMode();
    if (mode === "hidden" /* Hidden */ || this._dismissedForWindow) {
      if (this._lastPostedFor) {
        this._notificationService.deleteNotification(AgentsHandoffInputTipContribution.NOTIFICATION_ID);
        this._lastPostedFor = void 0;
      }
      return;
    }
    const widget = this._chatWidgetService.lastFocusedWidget;
    const sessionResource = widget?.viewModel?.sessionResource;
    const resourceSessionType = sessionResource ? getChatSessionType(sessionResource) : void 0;
    const preconditionMet = widget?.scopedContextKeyService.contextMatchesRules(OPEN_AGENTS_WINDOW_PRECONDITION) ?? false;
    const eligible = preconditionMet && !!sessionResource && !!resourceSessionType && AgentsHandoffInputTipContribution.ELIGIBLE_SESSION_TYPES.has(resourceSessionType) && !isUntitledChatSession(sessionResource);
    const widgetSessionType = widget?.scopedContextKeyService.getContextKeyValue(ChatContextKeys.chatSessionType.key);
    const isEmptyWorkspace = this._workspaceContextService.getWorkbenchState() === WorkbenchState.EMPTY;
    const emptyWorkspaceEligible = preconditionMet && isEmptyWorkspace && (!sessionResource || isUntitledChatSession(sessionResource)) && widgetSessionType === SessionType.AgentHostCopilot;
    if (!eligible && !emptyWorkspaceEligible) {
      if (this._lastPostedFor) {
        this._notificationService.deleteNotification(AgentsHandoffInputTipContribution.NOTIFICATION_ID);
        this._lastPostedFor = void 0;
      }
      return;
    }
    const key = eligible && sessionResource ? sessionResource.toString() : AgentsHandoffInputTipContribution.EMPTY_WORKSPACE_KEY;
    if (this._lastPostedFor === key) {
      return;
    }
    this._lastPostedFor = key;
    this._lastPostedSessionType = eligible ? resourceSessionType : widgetSessionType;
    const commandArgs = eligible && sessionResource ? [sessionResource] : [];
    const useEmptyWorkspaceCopy = emptyWorkspaceEligible && !eligible;
    const message = useEmptyWorkspaceCopy ? localize("chat.agentsHandoff.tip.emptyWorkspace.message", "Copilot CLI [Agent Host] isn't available without an open folder") : localize("chat.agentsHandoff.tip.message", "Continue this session in the Agents Window");
    const description = useEmptyWorkspaceCopy ? localize("chat.agentsHandoff.tip.emptyWorkspace.description", "Open the Agents Window to start a Copilot CLI session.") : mode === "custom" /* Custom */ ? localize("chat.agentsHandoff.tip.description.copilot", "Free with your Copilot plan \u2014 get a dedicated, multi-pane view alongside your workspace.") : localize("chat.agentsHandoff.tip.description", "Get a dedicated, multi-pane view alongside your workspace.");
    const actionLabel = useEmptyWorkspaceCopy ? localize("chat.agentsHandoff.tip.action", "Open in Agents Window") : mode === "custom" /* Custom */ ? localize("chat.agentsHandoff.tip.action.custom", "Give your agent more room?") : localize("chat.agentsHandoff.tip.action.default", "Continue in Agents Window");
    this._notificationService.setNotification({
      id: AgentsHandoffInputTipContribution.NOTIFICATION_ID,
      severity: ChatInputNotificationSeverity.Info,
      message,
      description,
      actions: [
        {
          kind: ChatInputNotificationActionKind.Command,
          label: actionLabel,
          commandId: AgentsHandoffInputTipContribution.TIP_OPEN_COMMAND_ID,
          commandArgs
        }
      ],
      dismissible: true,
      autoDismissOnMessage: false,
      mute: {
        commandId: AgentsHandoffInputTipContribution.TIP_MUTE_COMMAND_ID,
        tooltip: localize("chat.agentsHandoff.tip.mute", "Don't Show Again")
      },
      sessionTypes: useEmptyWorkspaceCopy ? [SessionType.AgentHostCopilot] : Array.from(AgentsHandoffInputTipContribution.ELIGIBLE_SESSION_TYPES)
    });
  }
  /**
   * Mark the tip as handled (dismissed or opened) for the rest of this
   * window's lifetime and tear down any currently posted notification.
   */
  _dismissForWindow() {
    if (this._dismissedForWindow) {
      return;
    }
    this._dismissedForWindow = true;
    this._update();
  }
};
AgentsHandoffInputTipContribution = __decorateClass([
  __decorateParam(0, IChatWidgetService),
  __decorateParam(1, IChatInputNotificationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IConfigurationService)
], AgentsHandoffInputTipContribution);
export {
  AgentsHandoffInputTipContribution,
  AgentsHandoffTipMode,
  OpenAgentsWindowAction,
  OpenChatSessionInAgentsWindowAction,
  OpenWorkspaceInAgentsContribution,
  OpenWorkspaceInAgentsWindowAction,
  OpenWorkspaceInAgentsWindowChatTitleAction,
  OpenWorkspaceInAgentsWindowTitleBarAction,
  ToggleOpenInAgentsWindowTitleBarAction
};
