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
import { Codicon } from "../../../../base/common/codicons.js";
import { fromNow } from "../../../../base/common/date.js";
import { hash } from "../../../../base/common/hash.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuRegistry, MenuId, registerAction2, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { InputFocusedContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { EditorAreaFocusContext, IsAuxiliaryWindowContext, IsSessionsWindowContext } from "../../../../workbench/common/contextkeys.js";
import { IWorkbenchLayoutService, Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { getQuickNavigateHandler, inQuickPickContext } from "../../../../workbench/browser/quickaccess.js";
import { Menus } from "../../../browser/menus.js";
import { SessionsCategories } from "../../../common/categories.js";
import { CanGoBackContext, CanGoForwardContext, SessionProviderIdContext, MultipleSessionsVisibleContext, SessionIsArchivedContext, SessionIsCreatedContext, SessionIsMaximizedContext, SessionIsStickyContext, SessionsFocusContext, SessionSupportsMultipleChatsContext, SessionsWelcomeVisibleContext, SessionIdContext, SessionHasMultipleCommittedChatsContext, SessionShouldShowChatTabsContext, SessionHasMultipleOpenChatsContext, SessionsPickerVisibleContext, SessionActiveChatIsClosableContext, SessionActiveChatIsDeletableContext, SessionChatsPickerVisibleContext, SessionActiveChatHasSubagentsContext, SessionsTitleBarNewSessionEnabledContext } from "../../../common/contextkeys.js";
import { ANY_AGENT_HOST_PROVIDER_RE } from "../../../common/agentHostSessionsProvider.js";
import { CLOSE_CHAT_COMMAND_ID } from "../../../common/sessionCommands.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ChatOriginKind, getChatCapabilities, getUntitledSessionTitle, SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionsPartService } from "../../../services/sessions/browser/sessionsPartService.js";
import { ISessionsListModelService } from "../../../services/sessions/browser/sessionsListModelService.js";
import { $, append, EventHelper, reset } from "../../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { OS } from "../../../../base/common/platform.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { asCssVariable } from "../../../../platform/theme/common/colorRegistry.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { markOnboardingTarget } from "../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js";
import { IWorkbenchAssignmentService } from "../../../../workbench/services/assignment/common/assignmentService.js";
import { agentsNewSessionButtonBackground, agentsNewSessionButtonBorder, agentsNewSessionButtonForeground, agentsNewSessionButtonHoverBackground } from "../../../common/theme.js";
import { logSessionsInteraction } from "../../../common/sessionsTelemetry.js";
import { NEW_SESSION_ACTION_ID } from "../../chat/common/constants.js";
import { groupSessionsForPicker } from "./sessionsPicker.js";
import "./media/newSessionActionViewItem.css";
const SHOW_SESSIONS_PICKER_COMMAND_ID = "sessions.showSessionsPicker";
registerAction2(class ShowSessionsPickerAction extends Action2 {
  constructor() {
    super({
      id: SHOW_SESSIONS_PICKER_COMMAND_ID,
      title: localize2("showSessionsPicker", "Show Sessions Picker"),
      f1: true,
      category: SessionsCategories.Sessions,
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyCode.KeyR,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KeyR },
        weight: KeybindingWeight.SessionsContrib,
        when: IsSessionsWindowContext
      }
    });
  }
  async run(accessor) {
    const sessionsService = accessor.get(ISessionsService);
    const quickInputService = accessor.get(IQuickInputService);
    const sessionsPartService = accessor.get(ISessionsPartService);
    const sessionsListModelService = accessor.get(ISessionsListModelService);
    const contextKeyService = accessor.get(IContextKeyService);
    const { recent, other } = sessionsService.getRecentlyOpenedSessions();
    const sessionGroups = groupSessionsForPicker(recent, other);
    const activeSessionId = sessionsService.activeSession.get()?.sessionId;
    const items = [];
    let firstSessionItem;
    items.push({
      label: `$(add) ${localize("newSession", "New Session")}`,
      session: void 0
    });
    const toPickItem = (session) => {
      const title = session.title.get() || getUntitledSessionTitle(session.isQuickChat?.get() ?? false);
      const status = session.status.get();
      const isRead = session.isRead.get();
      const isArchived = session.isArchived.get();
      const workspace = session.workspace.get();
      const pullRequestIcon = workspace?.folders[0]?.gitRepository?.gitHubInfo.get()?.pullRequest?.icon;
      const icon = sessionsListModelService.getStatusIcon(status, isRead, isArchived, pullRequestIcon);
      const detailParts = [];
      if (workspace?.label) {
        const isWorkspaceFolder = workspace.folders.length > 0 && workspace.folders[0]?.gitRepository?.workTreeUri === void 0;
        const workspaceIcon = workspace.isVirtualWorkspace ? Codicon.cloud : isWorkspaceFolder ? Codicon.folder : Codicon.worktree;
        detailParts.push(`$(${Codicon.blank.id}) $(${workspaceIcon.id}) ${workspace.label}`);
      } else {
        detailParts.push(`$(${Codicon.blank.id})`);
      }
      detailParts.push(fromNow(session.updatedAt.get(), true, true));
      return {
        label: title,
        detail: detailParts.join(" \xB7 "),
        iconClass: ThemeIcon.asClassName(icon),
        session
      };
    };
    const appendSessions = (label, sessions) => {
      if (sessions.length === 0) {
        return;
      }
      items.push({ type: "separator", label });
      for (const session of sessions) {
        const item = toPickItem(session);
        firstSessionItem ??= item;
        items.push(item);
      }
    };
    appendSessions(localize("sessionsPickerNeedsInput", "needs input"), sessionGroups.needsInput);
    appendSessions(localize("sessionsPickerUnread", "unread"), sessionGroups.unread);
    appendSessions(localize("recentlyOpened", "recently opened"), sessionGroups.recent);
    appendSessions(localize("otherSessions", "other sessions"), sessionGroups.other);
    const picker = quickInputService.createQuickPick({ useSeparators: true });
    picker.items = items;
    picker.placeholder = localize("searchSessions", "Search sessions by name or folder");
    picker.canAcceptInBackground = true;
    picker.matchOnDetail = true;
    if (firstSessionItem) {
      picker.activeItems = [firstSessionItem];
    }
    const disposables = new DisposableStore();
    disposables.add(picker);
    const pickerVisibleContext = SessionsPickerVisibleContext.bindTo(contextKeyService);
    pickerVisibleContext.set(true);
    disposables.add(toDisposable(() => pickerVisibleContext.reset()));
    const openSelected = (selected, inBackground, toSide) => {
      if (!selected.session) {
        sessionsService.openNewSession();
        sessionsPartService.focusSession(sessionsService.activeSession.get());
        return;
      }
      if (toSide && activeSessionId !== void 0 && selected.session.sessionId !== activeSessionId) {
        sessionsService.insertAt(selected.session, activeSessionId, "right", !inBackground);
      } else {
        sessionsService.openSession(selected.session.resource, { preserveFocus: inBackground });
      }
    };
    disposables.add(picker.onDidAccept((e) => {
      const [selected] = picker.selectedItems;
      if (selected) {
        const toSide = picker.keyMods.ctrlCmd || picker.keyMods.alt;
        openSelected(selected, e.inBackground, toSide);
      }
      if (!e.inBackground) {
        picker.hide();
      }
    }));
    disposables.add(picker.onDidHide(() => disposables.dispose()));
    picker.show();
  }
});
const SESSIONS_PICKER_NAVIGATE_NEXT_ID = "sessions.showSessionsPicker.navigateNext";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: SESSIONS_PICKER_NAVIGATE_NEXT_ID,
  weight: KeybindingWeight.SessionsContrib + 50,
  handler: getQuickNavigateHandler(SESSIONS_PICKER_NAVIGATE_NEXT_ID, true),
  when: SessionsPickerVisibleContext,
  primary: KeyMod.CtrlCmd | KeyCode.KeyR,
  mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KeyR }
});
const SESSIONS_PICKER_NAVIGATE_PREVIOUS_ID = "sessions.showSessionsPicker.navigatePrevious";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: SESSIONS_PICKER_NAVIGATE_PREVIOUS_ID,
  weight: KeybindingWeight.SessionsContrib + 50,
  handler: getQuickNavigateHandler(SESSIONS_PICKER_NAVIGATE_PREVIOUS_ID, false),
  when: SessionsPickerVisibleContext,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
  mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyMod.Shift | KeyCode.KeyR }
});
registerAction2(class GoBackAction extends Action2 {
  constructor() {
    super({
      id: "sessions.goBack",
      title: {
        ...localize2("sessionsGoBack", "Go Back"),
        mnemonicTitle: localize({ key: "miSessionsBack", comment: ["&& denotes a mnemonic"] }, "&&Back")
      },
      f1: true,
      icon: Codicon.arrowLeft,
      tooltip: localize("sessionsGoBackTooltip", "Go Back One Session"),
      category: SessionsCategories.Sessions,
      precondition: CanGoBackContext,
      keybinding: {
        // Higher than `WorkbenchContrib` so the `Ctrl+Shift+Tab` secondary wins over the
        // editor quick-open actions (which bind the same chord at `WorkbenchContrib`).
        weight: KeybindingWeight.SessionsContrib,
        win: { primary: KeyMod.Alt | KeyCode.LeftArrow, secondary: [KeyCode.BrowserBack, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Tab] },
        mac: { primary: KeyMod.WinCtrl | KeyCode.Minus, secondary: [KeyCode.BrowserBack, KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Tab] },
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Minus, secondary: [KeyCode.BrowserBack, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Tab] },
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated())
      },
      menu: [{
        id: Menus.TitleBarCenterLeft,
        group: "navigation",
        order: 1,
        when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated())
      }, {
        id: Menus.GoMenu,
        group: "1_history_nav",
        order: 1
      }]
    });
  }
  async run(accessor) {
    await accessor.get(ISessionsService).openPreviousSession();
  }
});
registerAction2(class GoForwardAction extends Action2 {
  constructor() {
    super({
      id: "sessions.goForward",
      title: {
        ...localize2("sessionsGoForward", "Go Forward"),
        mnemonicTitle: localize({ key: "miSessionsForward", comment: ["&& denotes a mnemonic"] }, "&&Forward")
      },
      f1: true,
      icon: Codicon.arrowRight,
      tooltip: localize("sessionsGoForwardTooltip", "Go Forward One Session"),
      category: SessionsCategories.Sessions,
      precondition: CanGoForwardContext,
      keybinding: {
        // Higher than `WorkbenchContrib` so the `Ctrl+Tab` secondary wins over the
        // editor quick-open actions (which bind the same chord at `WorkbenchContrib`).
        weight: KeybindingWeight.SessionsContrib,
        win: { primary: KeyMod.Alt | KeyCode.RightArrow, secondary: [KeyCode.BrowserForward, KeyMod.CtrlCmd | KeyCode.Tab] },
        mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Minus, secondary: [KeyCode.BrowserForward, KeyMod.WinCtrl | KeyCode.Tab] },
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Minus, secondary: [KeyCode.BrowserForward, KeyMod.CtrlCmd | KeyCode.Tab] },
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated())
      },
      menu: [{
        id: Menus.TitleBarCenterLeft,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated())
      }, {
        id: Menus.GoMenu,
        group: "1_history_nav",
        order: 2
      }]
    });
  }
  async run(accessor) {
    await accessor.get(ISessionsService).openNextSession();
  }
});
registerAction2(class FocusActiveSessionAction extends Action2 {
  constructor() {
    super({
      id: "sessions.focusActiveSession",
      title: localize2("focusActiveSession", "Focus Active Session"),
      f1: true,
      category: SessionsCategories.Sessions,
      keybinding: {
        // Must outrank the workbench `workbench.action.chat.open` binding
        // (WorkbenchContrib) so that in the sessions window the chord
        // focuses the active session. Using the normal open chat action will not work for new session views.
        weight: KeybindingWeight.SessionsContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI,
        mac: { primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.KeyI }
      }
    });
  }
  async run(accessor) {
    const sessionsPartService = accessor.get(ISessionsPartService);
    const sessionsService = accessor.get(ISessionsService);
    sessionsPartService.focusSession(sessionsService.activeSession.get());
  }
});
for (let index = 0; index < 9; index++) {
  const position = index + 1;
  const isLast = position === 9;
  registerAction2(class FocusSessionByPositionAction extends Action2 {
    constructor() {
      super({
        id: `sessions.focusSessionInGrid${position}`,
        title: isLast ? localize2("focusLastSessionInGrid", "Focus Last Session in Grid") : localize2("focusSessionInGrid", "Focus Session {0} in Grid", position),
        f1: true,
        category: SessionsCategories.Sessions,
        keybinding: {
          weight: KeybindingWeight.SessionsContrib,
          primary: KeyMod.CtrlCmd | KeyCode.Digit1 + index,
          when: IsSessionsWindowContext
        }
      });
    }
    async run(accessor) {
      const sessionsService = accessor.get(ISessionsService);
      const sessionsPartService = accessor.get(ISessionsPartService);
      const visible = sessionsService.visibleSessions.get();
      const targetIndex = isLast ? visible.length - 1 : index;
      if (targetIndex < 0 || targetIndex >= visible.length) {
        return;
      }
      const session = visible[targetIndex];
      sessionsService.setActive(session);
      sessionsPartService.focusSession(session);
    }
  });
}
registerAction2(class CloseAllSessionsAction extends Action2 {
  constructor() {
    super({
      id: "sessions.closeAllSessions",
      title: localize2("closeAllSessions", "Close All Sessions"),
      f1: true,
      category: SessionsCategories.Sessions,
      precondition: IsSessionsWindowContext,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyW),
        // Only fire from the keyboard while a session (its chat view) has focus.
        when: ContextKeyExpr.and(IsSessionsWindowContext, SessionsFocusContext)
      }
    });
  }
  async run(accessor) {
    accessor.get(ISessionsService).closeAllSessions();
  }
});
const CHAT_TAB_KEYBINDING_WEIGHT = KeybindingWeight.SessionsContrib + 10;
const ADD_CHAT_TO_SESSION_ACTION_ID = "sessions.chatCompositeBar.addChat";
registerAction2(class AddChatToSessionAction extends Action2 {
  constructor() {
    super({
      id: ADD_CHAT_TO_SESSION_ACTION_ID,
      title: localize2("chatCompositeBar.addChat", "New Chat"),
      icon: Codicon.add,
      keybinding: {
        weight: CHAT_TAB_KEYBINDING_WEIGHT,
        // Like Cmd/Ctrl+T in a browser — opens a new chat tab within the
        // active session. Scoped so it does not steal the shortcut outside
        // the agents window or when the session does not support multiple chats.
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), SessionIsCreatedContext, SessionSupportsMultipleChatsContext, SessionIsArchivedContext.negate()),
        primary: KeyMod.CtrlCmd | KeyCode.KeyT
      },
      menu: {
        id: Menus.SessionBarToolbar,
        group: "navigation",
        order: 0,
        when: ContextKeyExpr.and(SessionIsCreatedContext, SessionSupportsMultipleChatsContext, SessionIsArchivedContext.negate(), SessionShouldShowChatTabsContext.negate())
      }
    });
  }
  async run(accessor, session) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionsPartService = accessor.get(ISessionsPartService);
    const target = session ?? sessionsService.activeSession.get();
    if (!target) {
      return;
    }
    await sessionsService.openNewChatInSession(target);
    sessionsPartService.focusSession(target);
  }
});
function navigateChatTab(accessor, direction) {
  const sessionsService = accessor.get(ISessionsService);
  const sessionsPartService = accessor.get(ISessionsPartService);
  const extUri = accessor.get(IUriIdentityService).extUri;
  const session = sessionsService.activeSession.get();
  if (!session) {
    return;
  }
  const tabs = session.visibleChatTabs.get();
  if (tabs.length < 2) {
    return;
  }
  const activeChat = session.activeChat.get();
  const currentIndex = activeChat ? tabs.findIndex((chat) => extUri.isEqual(chat.resource, activeChat.resource)) : -1;
  const from = currentIndex === -1 ? 0 : currentIndex;
  const delta = direction === "next" ? 1 : -1;
  const target = tabs[(from + delta + tabs.length) % tabs.length];
  sessionsService.openChat(session, target.resource);
  sessionsPartService.focusSession(session);
}
registerAction2(class NavigateNextChatAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.navigateNextChat",
      title: localize2("navigateNextChat", "Go to Next Chat"),
      f1: true,
      category: SessionsCategories.Sessions,
      precondition: SessionHasMultipleOpenChatsContext,
      keybinding: {
        weight: CHAT_TAB_KEYBINDING_WEIGHT,
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), SessionHasMultipleOpenChatsContext),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketRight
      }
    });
  }
  run(accessor) {
    navigateChatTab(accessor, "next");
  }
});
registerAction2(class NavigatePreviousChatAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.navigatePreviousChat",
      title: localize2("navigatePreviousChat", "Go to Previous Chat"),
      f1: true,
      category: SessionsCategories.Sessions,
      precondition: SessionHasMultipleOpenChatsContext,
      keybinding: {
        weight: CHAT_TAB_KEYBINDING_WEIGHT,
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), SessionHasMultipleOpenChatsContext),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketLeft
      }
    });
  }
  run(accessor) {
    navigateChatTab(accessor, "previous");
  }
});
registerAction2(class CloseChatAction extends Action2 {
  constructor() {
    super({
      id: CLOSE_CHAT_COMMAND_ID,
      title: localize2("closeActiveChat", "Close Chat"),
      icon: Codicon.close,
      // Hidden from the palette: closing a specific chat is contextual (the
      // keybinding targets the active chat; the menu targets a tab).
      f1: false,
      category: SessionsCategories.Sessions,
      keybinding: {
        weight: CHAT_TAB_KEYBINDING_WEIGHT,
        // Intercept Ctrl/Cmd+W (which otherwise closes the session) only
        // while the active chat is a closeable non-main chat, so it closes
        // the chat tab instead — like closing a tab vs the window.
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), SessionActiveChatIsClosableContext),
        primary: KeyMod.CtrlCmd | KeyCode.KeyW,
        win: { primary: KeyMod.CtrlCmd | KeyCode.F4, secondary: [KeyMod.CtrlCmd | KeyCode.KeyW] }
      },
      // Rendered as the tab's close button by the chat tab strip; the main
      // chat's tab does not render this menu, so no per-tab gating is needed.
      menu: {
        id: Menus.SessionChatTab,
        group: "navigation",
        order: 10
      }
    });
  }
  async run(accessor, context) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionsManagementService = accessor.get(ISessionsManagementService);
    const extUri = accessor.get(IUriIdentityService).extUri;
    const session = context?.session ?? sessionsService.activeSession.get();
    if (!session) {
      return;
    }
    const chat = context?.chat ?? session.activeChat.get();
    if (!chat || extUri.isEqual(chat.resource, session.mainChat.get().resource)) {
      return;
    }
    if (chat.status.get() === SessionStatus.Untitled) {
      await sessionsManagementService.deleteChat(session, chat.resource, { skipConfirmation: true });
    } else {
      await sessionsService.closeChat(session, chat);
    }
  }
});
registerAction2(class CloseAllChatsAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.closeAllChats",
      title: localize2("closeAllChats", "Close All Chats"),
      f1: true,
      category: SessionsCategories.Sessions,
      // Enabled (palette + keybinding) only while the active session has more
      // than one open chat, so the chord targets the focused session and
      // stays inert for single-chat sessions.
      precondition: SessionHasMultipleOpenChatsContext,
      keybinding: {
        weight: CHAT_TAB_KEYBINDING_WEIGHT,
        when: ContextKeyExpr.and(
          IsSessionsWindowContext,
          // While a modal editor has focus, let VS Code's own
          // closeEditorsInGroup (same chord) act on the editor group.
          EditorAreaFocusContext.toNegated(),
          SessionHasMultipleOpenChatsContext
        ),
        // Mirror VS Code's "Close All Editors in Group" chord (Ctrl/Cmd+K W):
        // a session is the Agents-window analogue of an editor group. Note
        // "Close All Sessions" already owns Ctrl/Cmd+K Ctrl/Cmd+W.
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyW)
      }
    });
  }
  async run(accessor) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionsManagementService = accessor.get(ISessionsManagementService);
    const extUri = accessor.get(IUriIdentityService).extUri;
    const session = sessionsService.activeSession.get();
    if (!session) {
      return;
    }
    const mainResource = session.mainChat.get().resource;
    const chatsToClose = session.openChats.get().filter((chat) => !extUri.isEqual(chat.resource, mainResource));
    for (const chat of chatsToClose) {
      if (chat.status.get() === SessionStatus.Untitled) {
        await sessionsManagementService.deleteChat(session, chat.resource, { skipConfirmation: true });
      } else {
        await sessionsService.closeChat(session, chat);
      }
    }
  }
});
registerAction2(class DeleteChatAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.deleteChat",
      title: localize2("deleteActiveChat", "Delete Chat"),
      f1: true,
      category: SessionsCategories.Sessions,
      keybinding: {
        weight: CHAT_TAB_KEYBINDING_WEIGHT,
        // Delete / Cmd+Backspace (Mac) — mirrors the file-delete keybinding
        // in the Explorer. Scoped so it never fires while typing in an input
        // (chat composer, rename field, etc.) or on the session's main chat.
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), InputFocusedContext.toNegated(), SessionActiveChatIsDeletableContext),
        primary: KeyCode.Delete,
        mac: {
          primary: KeyMod.CtrlCmd | KeyCode.Backspace,
          secondary: [KeyCode.Delete]
        }
      }
    });
  }
  async run(accessor) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionsManagementService = accessor.get(ISessionsManagementService);
    const session = sessionsService.activeSession.get();
    if (!session) {
      return;
    }
    const chat = session.activeChat.get();
    if (!chat || !getChatCapabilities(chat, session, void 0).canDelete) {
      return;
    }
    await sessionsManagementService.deleteChat(session, chat.resource);
  }
});
registerAction2(class ReopenLastClosedChatAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.reopenLastClosedChat",
      title: localize2("chatCompositeBar.reopenLastClosedChat", "Reopen Last Closed Chat"),
      f1: true,
      category: SessionsCategories.Sessions,
      precondition: SessionSupportsMultipleChatsContext,
      keybinding: {
        weight: CHAT_TAB_KEYBINDING_WEIGHT,
        // Like Cmd/Ctrl+Shift+T in a browser — reopens the most recently
        // closed chat tab. Scoped to the agents window, outside editor area.
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), SessionIsCreatedContext, SessionSupportsMultipleChatsContext),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyT
      }
    });
  }
  async run(accessor) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionsPartService = accessor.get(ISessionsPartService);
    const session = sessionsService.activeSession.get();
    if (!session) {
      return;
    }
    const lastClosed = session.lastClosedChat;
    if (!lastClosed) {
      return;
    }
    await sessionsService.openChat(session, lastClosed.resource);
    sessionsPartService.focusSession(session);
  }
});
const SHOW_CHATS_PICKER_COMMAND_ID = "sessions.showChatsPicker";
const QUICK_SWITCH_NEXT_CHAT_ID = "sessions.quickSwitchNextChat";
const QUICK_SWITCH_PREVIOUS_CHAT_ID = "sessions.quickSwitchPreviousChat";
const CHATS_PICKER_QUICK_NAVIGATE_NEXT_ID = "sessions.chatsPicker.quickNavigateNext";
const CHATS_PICKER_QUICK_NAVIGATE_PREVIOUS_ID = "sessions.chatsPicker.quickNavigatePrevious";
const ChatsPickerScopeContext = ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), SessionHasMultipleOpenChatsContext, inQuickPickContext.negate());
function openChatsPicker(accessor, mru) {
  const sessionsService = accessor.get(ISessionsService);
  const quickInputService = accessor.get(IQuickInputService);
  const sessionsPartService = accessor.get(ISessionsPartService);
  const contextKeyService = accessor.get(IContextKeyService);
  const keybindingService = accessor.get(IKeybindingService);
  const session = sessionsService.activeSession.get();
  if (!session) {
    return;
  }
  const extUri = accessor.get(IUriIdentityService).extUri;
  const toItem = (chat) => ({
    label: chat.title.get()?.trim() || localize("untitledChat", "Untitled Chat"),
    description: fromNow(chat.updatedAt.get(), true, true),
    iconClass: ThemeIcon.asClassName(Codicon.commentDiscussion),
    chat
  });
  const openItems = (mru ? session.visibleChatTabs.get() : session.visibleChatTabs.get().filter((chat) => chat.status.get() !== SessionStatus.Untitled)).map(toItem);
  const closedItems = mru ? [] : session.closedChats.get().filter((chat) => chat.status.get() !== SessionStatus.Untitled && chat.origin?.kind !== ChatOriginKind.Tool).map(toItem);
  const pickItems = [...openItems, ...closedItems];
  if (pickItems.length === 0) {
    return;
  }
  const displayItems = closedItems.length === 0 ? openItems : [
    { type: "separator", label: localize("openChatsGroup", "Open") },
    ...openItems,
    { type: "separator", label: localize("closedChatsGroup", "Closed") },
    ...closedItems
  ];
  const activeChat = session.activeChat.get();
  const activeIndex = Math.max(0, activeChat ? pickItems.findIndex((item) => extUri.isEqual(item.chat.resource, activeChat.resource)) : -1);
  const startIndex = mru ? (activeIndex + (mru.backward ? -1 : 1) + pickItems.length) % pickItems.length : activeIndex;
  const disposables = new DisposableStore();
  const picker = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
  picker.items = displayItems;
  picker.activeItems = [pickItems[startIndex]];
  if (mru) {
    picker.hideInput = true;
    picker.quickNavigate = { keybindings: keybindingService.lookupKeybindings(CHATS_PICKER_QUICK_NAVIGATE_NEXT_ID) };
  } else {
    picker.placeholder = localize("searchChats", "Search chats by name");
    picker.matchOnDescription = true;
  }
  const pickerVisibleContext = SessionChatsPickerVisibleContext.bindTo(contextKeyService);
  pickerVisibleContext.set(true);
  disposables.add(toDisposable(() => pickerVisibleContext.reset()));
  disposables.add(picker.onDidAccept(() => {
    const [selected] = picker.selectedItems;
    if (selected) {
      sessionsService.openChat(session, selected.chat.resource);
      sessionsPartService.focusSession(session);
    }
    picker.hide();
  }));
  disposables.add(picker.onDidHide(() => disposables.dispose()));
  picker.show();
}
registerAction2(class ShowChatsPickerAction extends Action2 {
  constructor() {
    super({
      id: SHOW_CHATS_PICKER_COMMAND_ID,
      title: localize2("showChatsPicker", "Go to Chat in Session"),
      f1: true,
      category: SessionsCategories.Sessions,
      precondition: SessionHasMultipleCommittedChatsContext,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        when: ContextKeyExpr.and(IsSessionsWindowContext, EditorAreaFocusContext.toNegated(), inQuickPickContext.negate()),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO
      }
    });
  }
  run(accessor) {
    openChatsPicker(accessor);
  }
});
registerAction2(class QuickSwitchNextChatAction extends Action2 {
  constructor() {
    super({
      id: QUICK_SWITCH_NEXT_CHAT_ID,
      title: localize2("quickSwitchNextChat", "Quick Switch to Next Chat"),
      f1: false,
      category: SessionsCategories.Sessions,
      precondition: SessionHasMultipleOpenChatsContext,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib + 1,
        when: ChatsPickerScopeContext,
        primary: KeyMod.CtrlCmd | KeyCode.Tab,
        mac: { primary: KeyMod.WinCtrl | KeyCode.Tab }
      }
    });
  }
  run(accessor) {
    openChatsPicker(accessor, { backward: false });
  }
});
registerAction2(class QuickSwitchPreviousChatAction extends Action2 {
  constructor() {
    super({
      id: QUICK_SWITCH_PREVIOUS_CHAT_ID,
      title: localize2("quickSwitchPreviousChat", "Quick Switch to Previous Chat"),
      f1: false,
      category: SessionsCategories.Sessions,
      precondition: SessionHasMultipleOpenChatsContext,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib + 1,
        when: ChatsPickerScopeContext,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Tab,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Tab }
      }
    });
  }
  run(accessor) {
    openChatsPicker(accessor, { backward: true });
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CHATS_PICKER_QUICK_NAVIGATE_NEXT_ID,
  weight: KeybindingWeight.SessionsContrib + 50,
  handler: getQuickNavigateHandler(CHATS_PICKER_QUICK_NAVIGATE_NEXT_ID, true),
  when: SessionChatsPickerVisibleContext,
  primary: KeyMod.CtrlCmd | KeyCode.Tab,
  mac: { primary: KeyMod.WinCtrl | KeyCode.Tab }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CHATS_PICKER_QUICK_NAVIGATE_PREVIOUS_ID,
  weight: KeybindingWeight.SessionsContrib + 50,
  handler: getQuickNavigateHandler(CHATS_PICKER_QUICK_NAVIGATE_PREVIOUS_ID, false),
  when: SessionChatsPickerVisibleContext,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Tab,
  mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Tab }
});
let CompactButtonActionViewItem = class extends BaseActionViewItem {
  constructor(action, keybindingService, hoverService, contextKeyService) {
    super(void 0, action);
    this.keybindingService = keybindingService;
    this.hoverService = hoverService;
    this.contextKeyService = contextKeyService;
  }
  /** Optional onboarding spotlight target id for the pill. */
  get onboardingTargetId() {
    return void 0;
  }
  /** Whether to render the trailing keybinding hint chip in the label. */
  get showKeybindingHint() {
    return true;
  }
  /** Hook invoked right before the action runs (e.g. for telemetry). */
  onRun() {
  }
  render(container) {
    super.render(container);
    if (!this.element) {
      return;
    }
    const button = this._register(new Button(this.element, {
      ...defaultButtonStyles,
      buttonSecondaryBackground: asCssVariable(agentsNewSessionButtonBackground),
      buttonSecondaryForeground: asCssVariable(agentsNewSessionButtonForeground),
      buttonSecondaryHoverBackground: asCssVariable(agentsNewSessionButtonHoverBackground),
      buttonSecondaryBorder: asCssVariable(agentsNewSessionButtonBorder),
      secondary: true,
      supportIcons: true
    }));
    button.element.classList.add("agent-sessions-compact-new-button");
    const onboardingTargetId = this.onboardingTargetId;
    if (onboardingTargetId) {
      this._register(markOnboardingTarget(button.element, onboardingTargetId));
    }
    this._register(button.onDidClick((e) => {
      EventHelper.stop(e, true);
      if (!this.action.enabled) {
        return;
      }
      this.onRun();
      this.actionRunner.run(this.action, this._context);
    }));
    const buttonLabel = $("span.new-session-button-label", void 0, this.label);
    const keybindingHint = $("span.new-session-keybinding-hint");
    const keybindingHintLabel = this.showKeybindingHint ? this._register(new KeybindingLabel(keybindingHint, OS, {
      disableTitle: true,
      keybindingLabelBackground: "transparent",
      keybindingLabelForeground: "inherit",
      keybindingLabelBorder: "transparent",
      keybindingLabelBottomBorder: void 0,
      keybindingLabelShadow: void 0
    })) : void 0;
    reset(button.element, buttonLabel);
    const getKeybinding = () => {
      const primaryKeybinding = this.keybindingService.lookupKeybinding(this.commandId, this.contextKeyService, true);
      const resolvedKeybindings = this.keybindingService.lookupKeybindings(this.commandId);
      return primaryKeybinding ?? resolvedKeybindings[0];
    };
    this._register(this.hoverService.setupDelayedHover(button.element, () => ({
      content: this.getHoverContent(getKeybinding()?.getLabel() ?? void 0),
      appearance: { compact: true },
      position: { hoverPosition: HoverPosition.BELOW }
    })));
    let lastRenderedKeybindingLabel = null;
    let lastRenderedKeybindingAriaLabel = null;
    const updateButton = () => {
      const keybinding = getKeybinding();
      const keybindingLabel = keybinding?.getLabel() ?? void 0;
      const keybindingAriaLabel = keybinding?.getAriaLabel() ?? void 0;
      if (lastRenderedKeybindingLabel === keybindingLabel && lastRenderedKeybindingAriaLabel === keybindingAriaLabel) {
        return;
      }
      lastRenderedKeybindingLabel = keybindingLabel;
      lastRenderedKeybindingAriaLabel = keybindingAriaLabel;
      keybindingHintLabel?.set(keybinding);
      if (keybindingHintLabel && keybinding) {
        if (keybindingHint.parentElement !== button.element) {
          append(button.element, keybindingHint);
        }
      } else {
        keybindingHint.remove();
      }
      button.element.setAttribute("aria-label", this.getAriaLabel(keybindingAriaLabel));
    };
    this._register(Event.runAndSubscribe(this.keybindingService.onDidUpdateKeybindings, updateButton));
  }
};
CompactButtonActionViewItem = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IHoverService),
  __decorateParam(3, IContextKeyService)
], CompactButtonActionViewItem);
let NewSessionActionViewItem = class extends CompactButtonActionViewItem {
  constructor(action, telemetrySource, keybindingService, hoverService, telemetryService, contextKeyService) {
    super(action, keybindingService, hoverService, contextKeyService);
    this.telemetrySource = telemetrySource;
    this.telemetryService = telemetryService;
  }
  get commandId() {
    return NEW_SESSION_ACTION_ID;
  }
  get label() {
    return localize("newCompact", "New");
  }
  get onboardingTargetId() {
    return "sessions.newSession.button";
  }
  getHoverContent(keybindingLabel) {
    return keybindingLabel ? localize("newSessionButtonTitle", "New Session ({0})", keybindingLabel) : localize("newSessionButtonTitleWithoutKeybinding", "New Session");
  }
  getAriaLabel(keybindingAriaLabel) {
    return keybindingAriaLabel ? localize("newSessionButtonAriaLabel", "New Session ({0})", keybindingAriaLabel) : localize("newSessionButtonAriaLabelWithoutKeybinding", "New Session");
  }
  onRun() {
    logSessionsInteraction(this.telemetryService, "newSession", this.telemetrySource);
  }
};
NewSessionActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IContextKeyService)
], NewSessionActionViewItem);
let NewSessionActionViewItemContribution = class extends Disposable {
  constructor(actionViewItemService, contextKeyService, assignmentService, environmentService) {
    super();
    this.assignmentService = assignmentService;
    this.environmentService = environmentService;
    this.titleBarEnabledContext = SessionsTitleBarNewSessionEnabledContext.bindTo(contextKeyService);
    const onDidRegister = this._register(new Emitter());
    const menus = [Menus.SidebarSessionsHeader, Menus.TitleBarLeftLayout];
    for (const menu of menus) {
      const source = menu === Menus.TitleBarLeftLayout ? "titleBar" : "sidebar";
      this._register(actionViewItemService.register(menu, NEW_SESSION_ACTION_ID, (action, _options, instantiationService) => {
        if (!(action instanceof MenuItemAction)) {
          return void 0;
        }
        return instantiationService.createInstance(NewSessionActionViewItem, action, source);
      }, onDidRegister.event));
    }
    onDidRegister.fire();
    this._register(this.assignmentService.onDidRefetchAssignments(() => this.updateTitleBarTreatment()));
    this.updateTitleBarTreatment();
  }
  static {
    this.ID = "workbench.contrib.sessions.newSessionActionViewItem";
  }
  static {
    /** ExP treatment that shows the new-session button in the titlebar. */
    this.NEW_SESSION_TITLEBAR_TREATMENT = "agentSessionsTitleBarNewSession";
  }
  async updateTitleBarTreatment() {
    if (!this.environmentService.isBuilt) {
      this.titleBarEnabledContext.set(true);
      return;
    }
    const enabled = await this.assignmentService.getTreatment(NewSessionActionViewItemContribution.NEW_SESSION_TITLEBAR_TREATMENT);
    this.titleBarEnabledContext.set(enabled === true);
  }
};
NewSessionActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IWorkbenchAssignmentService),
  __decorateParam(3, IEnvironmentService)
], NewSessionActionViewItemContribution);
class NewChatActionViewItem extends CompactButtonActionViewItem {
  get commandId() {
    return ADD_CHAT_TO_SESSION_ACTION_ID;
  }
  get label() {
    return localize("chatCompositeBar.addChat.compact", "New Chat");
  }
  get showKeybindingHint() {
    return false;
  }
  getHoverContent(keybindingLabel) {
    return keybindingLabel ? localize("newChatButtonTitle", "New Chat ({0})", keybindingLabel) : localize("newChatButtonTitleWithoutKeybinding", "New Chat");
  }
  getAriaLabel(keybindingAriaLabel) {
    return keybindingAriaLabel ? localize("newChatButtonAriaLabel", "New Chat ({0})", keybindingAriaLabel) : localize("newChatButtonAriaLabelWithoutKeybinding", "New Chat");
  }
}
let SessionNewChatActionViewItemContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.newChatActionViewItem";
  }
  constructor(actionViewItemService) {
    super();
    const onDidRegister = this._register(new Emitter());
    this._register(actionViewItemService.register(Menus.SessionBarToolbar, ADD_CHAT_TO_SESSION_ACTION_ID, (action, _options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(NewChatActionViewItem, action);
    }, onDidRegister.event));
    onDidRegister.fire();
  }
};
SessionNewChatActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService)
], SessionNewChatActionViewItemContribution);
MenuRegistry.appendMenuItem(Menus.SessionHeaderMeta, {
  submenu: Menus.SessionConversations,
  title: localize2("chatCompositeBar.conversations", "Chats"),
  icon: Codicon.commentDiscussion,
  group: "navigation",
  order: 100,
  when: ContextKeyExpr.and(SessionIsCreatedContext, SessionIsArchivedContext.negate(), ContextKeyExpr.or(ContextKeyExpr.and(SessionSupportsMultipleChatsContext, SessionHasMultipleCommittedChatsContext), SessionActiveChatHasSubagentsContext))
});
let SessionConversationsMenuContribution = class extends Disposable {
  constructor(_sessionsService, _uriIdentityService) {
    super();
    this._sessionsService = _sessionsService;
    this._uriIdentityService = _uriIdentityService;
    this._register(autorun((reader) => {
      for (const session of this._sessionsService.visibleSessions.read(reader)) {
        if (session) {
          reader.store.add(this._registerSessionConversations(session, reader));
        }
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.sessions.conversationsMenu";
  }
  _registerSessionConversations(session, reader) {
    const store = new DisposableStore();
    const that = this;
    const extUri = this._uriIdentityService.extUri;
    const scopedToSession = ContextKeyExpr.equals(SessionIdContext.key, session.sessionId);
    const allChats = session.chats.read(reader);
    const mainResource = session.mainChat.read(reader).resource;
    const visibleChatTabs = session.visibleChatTabs.read(reader);
    const activeChatResource = session.activeChat.read(reader).resource;
    const registerToggle = (chat, group, order) => {
      const chatResource = chat.resource;
      const isShown = visibleChatTabs.some((c) => extUri.isEqual(c.resource, chatResource));
      const isMain = extUri.isEqual(chatResource, mainResource);
      const title = chat.title.read(reader) || localize("untitledChat", "Untitled Chat");
      store.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `sessions.toggleChat.${session.sessionId}.${hash(chatResource.toString())}`,
            title,
            toggled: isShown ? ContextKeyExpr.true() : void 0,
            precondition: isMain ? ContextKeyExpr.false() : void 0,
            menu: { id: Menus.SessionConversations, group, order, when: scopedToSession }
          });
        }
        async run(_accessor, forwardedSession) {
          const target = forwardedSession ?? session;
          const targetChat = target.chats.get().find((c) => extUri.isEqual(c.resource, chatResource));
          if (!targetChat) {
            return;
          }
          if (target.visibleChatTabs.get().some((c) => extUri.isEqual(c.resource, chatResource))) {
            await that._sessionsService.closeChat(target, targetChat);
          } else {
            await that._sessionsService.openChat(target, targetChat.resource);
          }
        }
      }));
    };
    allChats.forEach((chat, index) => {
      if (chat.status.read(reader) === SessionStatus.Untitled) {
        return;
      }
      if (chat.origin?.kind === ChatOriginKind.Tool) {
        return;
      }
      registerToggle(chat, "1_chats", index);
    });
    allChats.filter((chat) => chat.origin?.kind === ChatOriginKind.Tool && !!chat.origin.parentChat && extUri.isEqual(chat.origin.parentChat, activeChatResource)).forEach((chat, index) => registerToggle(chat, "2_subagents", index));
    return store;
  }
};
SessionConversationsMenuContribution = __decorateClass([
  __decorateParam(0, ISessionsService),
  __decorateParam(1, IUriIdentityService)
], SessionConversationsMenuContribution);
registerAction2(class TogglePinSessionAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.togglePin",
      title: localize2("chatCompositeBar.pin", "Pin Session"),
      icon: Codicon.pin,
      toggled: {
        condition: SessionIsStickyContext,
        icon: Codicon.pinned,
        title: localize("chatCompositeBar.unpin", "Unpin Session")
      },
      menu: {
        id: Menus.SessionBarToolbar,
        group: "1_session",
        order: 10,
        when: ContextKeyExpr.and(SessionIsCreatedContext, SessionIsArchivedContext.negate())
      }
    });
  }
  async run(accessor, session) {
    if (!session) {
      return;
    }
    accessor.get(ISessionsService).toggleSessionStickiness(session);
  }
});
MenuRegistry.appendMenuItem(Menus.SessionHeaderContext, {
  command: {
    id: "sessions.chatCompositeBar.togglePin",
    title: localize("chatCompositeBar.pinView", "Pin View"),
    toggled: {
      condition: SessionIsStickyContext,
      title: localize("chatCompositeBar.unpinView", "Unpin View")
    }
  },
  group: "1_view",
  order: 1,
  when: SessionIsCreatedContext
});
registerAction2(class RenameSessionHeaderAction extends Action2 {
  constructor() {
    super({
      id: "sessions.sessionHeader.rename",
      title: localize2("renameSessionHeader", "Rename..."),
      menu: [{
        id: Menus.SessionHeaderContext,
        group: "2_edit",
        order: 1,
        when: ContextKeyExpr.regex(SessionProviderIdContext.key, ANY_AGENT_HOST_PROVIDER_RE)
      }]
    });
  }
  run(accessor, session) {
    if (!session) {
      return;
    }
    accessor.get(ISessionsPartService).getSessionView(session.sessionId)?.startTitleEditing();
  }
});
registerAction2(class CloseSessionAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.close",
      title: localize2("chatCompositeBar.close", "Close"),
      icon: Codicon.close,
      menu: [{
        id: Menus.SessionBarToolbar,
        when: ContextKeyExpr.or(SessionIsCreatedContext, MultipleSessionsVisibleContext),
        group: "1_session",
        order: 30
      }, {
        id: Menus.SessionHeaderContext,
        when: ContextKeyExpr.or(SessionIsCreatedContext, MultipleSessionsVisibleContext),
        group: "1_view",
        order: 2
      }]
    });
  }
  async run(accessor, session) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionsPartService = accessor.get(ISessionsPartService);
    sessionsService.closeSession(session);
    sessionsPartService.focusSession(sessionsService.activeSession.get());
  }
});
registerAction2(class ToggleMaximizeSessionViewAction extends Action2 {
  constructor() {
    super({
      id: "sessions.chatCompositeBar.toggleMaximize",
      title: localize2("chatCompositeBar.maximize", "Maximize Session"),
      icon: Codicon.screenFull,
      toggled: {
        condition: SessionIsMaximizedContext,
        icon: Codicon.screenNormal,
        title: localize("chatCompositeBar.unmaximize", "Restore Session")
      },
      menu: {
        id: Menus.SessionBarToolbar,
        when: MultipleSessionsVisibleContext,
        group: "1_session",
        order: 20
      }
    });
  }
  async run(accessor, session) {
    accessor.get(ISessionsPartService).toggleMaximizeSession(session);
    accessor.get(ISessionsService).setActive(session);
  }
});
registerAction2(class CloseEditorAreaAction extends Action2 {
  constructor() {
    super({
      id: "sessions.closeEditorArea",
      title: localize2("closeEditorArea", "Close Editor Area"),
      icon: Codicon.close,
      category: SessionsCategories.Sessions,
      menu: {
        id: MenuId.EditorGroupWatermarkToolbar,
        group: "navigation",
        order: 10,
        when: IsSessionsWindowContext
      }
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    layoutService.setPartHidden(true, Parts.EDITOR_PART);
  }
});
export {
  CompactButtonActionViewItem,
  NewSessionActionViewItemContribution,
  SHOW_CHATS_PICKER_COMMAND_ID,
  SHOW_SESSIONS_PICKER_COMMAND_ID,
  SessionConversationsMenuContribution,
  SessionNewChatActionViewItemContribution
};
