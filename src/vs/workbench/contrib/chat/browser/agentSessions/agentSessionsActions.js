import { localize, localize2 } from "../../../../../nls.js";
import { AgentSessionSection, isAgentHostAgentSessionItem, isAgentSessionSection, isLocalAgentSessionItem, isMarshalledAgentSessionContext } from "./agentSessionsModel.js";
import { Action2, MenuId, MenuRegistry } from "../../../../../platform/actions/common/actions.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { AGENT_SESSION_DELETE_ACTION_ID, AGENT_SESSION_RENAME_ACTION_ID, AgentSessionProviders, AgentSessionsViewerOrientation } from "./agentSessions.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { IChatSessionsService } from "../../common/chatSessionsService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { LocalChatSessionUri } from "../../common/model/chatUri.js";
import { ChatViewId, IChatWidgetService } from "../chat.js";
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../common/views.js";
import { IWorkbenchLayoutService, Position } from "../../../../services/layout/browser/layoutService.js";
import { IAgentSessionsService } from "./agentSessionsService.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { showClearEditingSessionConfirmation } from "../widgetHosts/editor/chatEditorInput.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ChatConfiguration } from "../../common/constants.js";
import { ACTION_ID_NEW_CHAT } from "../actions/chatActions.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IsSessionsWindowContext } from "../../../../common/contextkeys.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { coalesce } from "../../../../../base/common/arrays.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IPaneCompositePartService } from "../../../../services/panecomposite/browser/panecomposite.js";
import { ChatSessionArchiveActionWording, getChatSessionArchiveActionPresentation } from "../../../../../platform/chat/common/sessionArchiveActions.js";
const AGENT_SESSIONS_CATEGORY = localize2("chatSessions", "Chat Agent Sessions");
class ToggleShowAgentSessionsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.toggleShowAgentSessions",
      title: localize2("chat.showSessions", "Show Sessions"),
      toggled: ContextKeyExpr.equals(`config.${ChatConfiguration.ChatViewSessionsEnabled}`, true),
      menu: {
        id: MenuId.ChatWelcomeContext,
        group: "0_sessions",
        order: 2,
        when: ChatContextKeys.inChatEditor.negate()
      }
    });
  }
  async run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    const currentValue = configurationService.getValue(ChatConfiguration.ChatViewSessionsEnabled);
    await configurationService.updateValue(ChatConfiguration.ChatViewSessionsEnabled, !currentValue);
  }
}
const agentSessionsOrientationSubmenu = new MenuId("chatAgentSessionsOrientationSubmenu");
MenuRegistry.appendMenuItem(MenuId.ChatWelcomeContext, {
  submenu: agentSessionsOrientationSubmenu,
  title: localize2("chat.sessionsOrientation", "Sessions Orientation"),
  group: "0_sessions",
  order: 1,
  when: ChatContextKeys.inChatEditor.negate()
});
class SetAgentSessionsOrientationStackedAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.setAgentSessionsOrientationStacked",
      title: localize2("chat.sessionsOrientation.stacked", "Stacked"),
      toggled: ContextKeyExpr.equals(`config.${ChatConfiguration.ChatViewSessionsOrientation}`, "stacked"),
      precondition: ContextKeyExpr.equals(`config.${ChatConfiguration.ChatViewSessionsEnabled}`, true),
      menu: {
        id: agentSessionsOrientationSubmenu,
        group: "navigation",
        order: 2
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand(HideAgentSessionsSidebar.ID);
  }
}
class SetAgentSessionsOrientationSideBySideAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.setAgentSessionsOrientationSideBySide",
      title: localize2("chat.sessionsOrientation.sideBySide", "Side by Side"),
      toggled: ContextKeyExpr.notEquals(`config.${ChatConfiguration.ChatViewSessionsOrientation}`, "stacked"),
      precondition: ContextKeyExpr.equals(`config.${ChatConfiguration.ChatViewSessionsEnabled}`, true),
      menu: {
        id: agentSessionsOrientationSubmenu,
        group: "navigation",
        order: 1
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    await commandService.executeCommand(ShowAgentSessionsSidebar.ID);
  }
}
class BaseArchiveAllAgentSessionsAction extends Action2 {
  constructor(wording) {
    const action = getChatSessionArchiveActionPresentation(wording).archiveAll;
    super({
      id: "workbench.action.chat.archiveAllAgentSessions",
      title: action.title,
      icon: action.icon,
      precondition: ChatContextKeys.enabled,
      category: AGENT_SESSIONS_CATEGORY,
      f1: true
    });
    this.wording = wording;
  }
  async run(accessor) {
    const agentSessionsService = accessor.get(IAgentSessionsService);
    const dialogService = accessor.get(IDialogService);
    const sessionsToArchive = agentSessionsService.model.sessions.filter((session) => !session.isArchived());
    if (sessionsToArchive.length === 0) {
      return;
    }
    const confirmed = await dialogService.confirm({
      message: this.wording === ChatSessionArchiveActionWording.MarkAsDone ? sessionsToArchive.length === 1 ? localize("markAllSessionsDone.confirmSingle", "Are you sure you want to mark 1 agent session as done?") : localize("markAllSessionsDone.confirm", "Are you sure you want to mark {0} agent sessions as done?", sessionsToArchive.length) : sessionsToArchive.length === 1 ? localize("archiveAllSessions.confirmSingle", "Are you sure you want to archive 1 agent session?") : localize("archiveAllSessions.confirm", "Are you sure you want to archive {0} agent sessions?", sessionsToArchive.length),
      detail: this.wording === ChatSessionArchiveActionWording.MarkAsDone ? localize("markAllSessionsDone.detail", "You can restore sessions later if needed from the sessions view.") : localize("archiveAllSessions.detail", "You can unarchive sessions later if needed from the sessions view."),
      primaryButton: getChatSessionArchiveActionPresentation(this.wording).archiveAll.title.value
    });
    if (!confirmed.confirmed) {
      return;
    }
    for (const session of sessionsToArchive) {
      session.setArchived(true);
    }
  }
}
class ArchiveAllAgentSessionsAction extends BaseArchiveAllAgentSessionsAction {
  constructor() {
    super(ChatSessionArchiveActionWording.Archive);
  }
}
class MarkAllAgentSessionsDoneAction extends BaseArchiveAllAgentSessionsAction {
  constructor() {
    super(ChatSessionArchiveActionWording.MarkAsDone);
  }
}
class MarkAllAgentSessionsReadAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.markAllAgentSessionsRead",
      title: localize2("markAllRead.label", "Mark All as Read"),
      precondition: ChatContextKeys.enabled,
      category: AGENT_SESSIONS_CATEGORY,
      f1: true,
      menu: {
        id: MenuId.AgentSessionsContext,
        group: "0_read",
        order: 2,
        when: ChatContextKeys.isArchivedAgentSession.negate()
        // no read state for archived sessions
      }
    });
  }
  async run(accessor) {
    const agentSessionsService = accessor.get(IAgentSessionsService);
    const sessionsToMarkRead = agentSessionsService.model.sessions.filter((session) => !session.isArchived() && !session.isRead());
    if (sessionsToMarkRead.length === 0) {
      return;
    }
    for (const session of sessionsToMarkRead) {
      session.setRead(true);
    }
  }
}
const ConfirmArchiveStorageKey = "chat.sessions.confirmArchive";
class BaseArchiveAgentSessionSectionAction extends Action2 {
  constructor(wording) {
    const action = getChatSessionArchiveActionPresentation(wording).archiveAll;
    super({
      id: "agentSessionSection.archive",
      title: action.title,
      icon: action.icon,
      menu: [{
        id: MenuId.AgentSessionSectionToolbar,
        group: "navigation",
        order: 1,
        when: ChatContextKeys.agentSessionSection.notEqualsTo(AgentSessionSection.Archived)
      }, {
        id: MenuId.AgentSessionSectionContext,
        group: "1_edit",
        order: 2,
        when: ChatContextKeys.agentSessionSection.notEqualsTo(AgentSessionSection.Archived)
      }]
    });
    this.wording = wording;
  }
  async run(accessor, context) {
    if (!context || !isAgentSessionSection(context)) {
      return;
    }
    const dialogService = accessor.get(IDialogService);
    const storageService = accessor.get(IStorageService);
    const skipConfirmation = storageService.getBoolean(ConfirmArchiveStorageKey, StorageScope.PROFILE, false);
    if (!skipConfirmation) {
      const confirmed = await dialogService.confirm({
        message: this.wording === ChatSessionArchiveActionWording.MarkAsDone ? context.sessions.length === 1 ? localize("markSectionSessionsDone.confirmSingle", "Are you sure you want to mark 1 agent session from '{0}' as done?", context.label) : localize("markSectionSessionsDone.confirm", "Are you sure you want to mark {0} agent sessions from '{1}' as done?", context.sessions.length, context.label) : context.sessions.length === 1 ? localize("archiveSectionSessions.confirmSingle", "Are you sure you want to archive 1 agent session from '{0}'?", context.label) : localize("archiveSectionSessions.confirm", "Are you sure you want to archive {0} agent sessions from '{1}'?", context.sessions.length, context.label),
        detail: this.wording === ChatSessionArchiveActionWording.MarkAsDone ? localize("markSectionSessionsDone.detail", "You can restore sessions later if needed from the sessions view.") : localize("archiveSectionSessions.detail", "You can unarchive sessions later if needed from the sessions view."),
        primaryButton: getChatSessionArchiveActionPresentation(this.wording).archiveAll.title.value,
        checkbox: {
          label: localize("doNotAskAgain", "Do not ask me again")
        }
      });
      if (!confirmed.confirmed) {
        return;
      }
      if (confirmed.checkboxChecked) {
        storageService.store(ConfirmArchiveStorageKey, true, StorageScope.PROFILE, StorageTarget.USER);
      }
    }
    for (const session of context.sessions) {
      session.setArchived(true);
    }
  }
}
class ArchiveAgentSessionSectionAction extends BaseArchiveAgentSessionSectionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.Archive);
  }
}
class MarkAgentSessionSectionDoneAction extends BaseArchiveAgentSessionSectionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.MarkAsDone);
  }
}
class BaseUnarchiveAgentSessionSectionAction extends Action2 {
  constructor(wording) {
    const action = getChatSessionArchiveActionPresentation(wording).unarchiveAll;
    super({
      id: "agentSessionSection.unarchive",
      title: action.title,
      icon: action.icon,
      menu: [{
        id: MenuId.AgentSessionSectionToolbar,
        group: "navigation",
        order: 1,
        when: ChatContextKeys.agentSessionSection.isEqualTo(AgentSessionSection.Archived)
      }, {
        id: MenuId.AgentSessionSectionContext,
        group: "1_edit",
        order: 2,
        when: ChatContextKeys.agentSessionSection.isEqualTo(AgentSessionSection.Archived)
      }]
    });
    this.wording = wording;
  }
  async run(accessor, context) {
    if (!context || !isAgentSessionSection(context)) {
      return;
    }
    const dialogService = accessor.get(IDialogService);
    const storageService = accessor.get(IStorageService);
    if (context.sessions.length > 1) {
      const skipConfirmation = storageService.getBoolean(ConfirmArchiveStorageKey, StorageScope.PROFILE, false);
      if (!skipConfirmation) {
        const confirmed = await dialogService.confirm({
          message: this.wording === ChatSessionArchiveActionWording.MarkAsDone ? localize("restoreSectionSessions.confirm", "Are you sure you want to restore {0} agent sessions?", context.sessions.length) : localize("unarchiveSectionSessions.confirm", "Are you sure you want to unarchive {0} agent sessions?", context.sessions.length),
          primaryButton: getChatSessionArchiveActionPresentation(this.wording).unarchiveAll.title.value,
          checkbox: {
            label: localize("doNotAskAgain", "Do not ask me again")
          }
        });
        if (!confirmed.confirmed) {
          return;
        }
        if (confirmed.checkboxChecked) {
          storageService.store(ConfirmArchiveStorageKey, true, StorageScope.PROFILE, StorageTarget.USER);
        }
      }
    }
    for (const session of context.sessions) {
      session.setArchived(false);
    }
  }
}
class UnarchiveAgentSessionSectionAction extends BaseUnarchiveAgentSessionSectionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.Archive);
  }
}
class RestoreAgentSessionSectionAction extends BaseUnarchiveAgentSessionSectionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.MarkAsDone);
  }
}
class MarkAgentSessionSectionReadAction extends Action2 {
  constructor() {
    super({
      id: "agentSessionSection.markRead",
      title: localize2("markSectionRead", "Mark All as Read"),
      menu: [{
        id: MenuId.AgentSessionSectionContext,
        group: "1_edit",
        order: 1,
        when: ChatContextKeys.agentSessionSection.notEqualsTo(AgentSessionSection.Archived)
      }]
    });
  }
  async run(accessor, context) {
    if (!context || !isAgentSessionSection(context)) {
      return;
    }
    for (const session of context.sessions) {
      session.setRead(true);
    }
  }
}
class CollapseAllAgentSessionSectionsAction extends Action2 {
  constructor() {
    super({
      id: "agentSessionSection.collapseAll",
      title: localize2("collapseAll", "Collapse All"),
      menu: [{
        id: MenuId.AgentSessionSectionContext,
        group: "2_collapse",
        order: 1
      }]
    });
  }
  async run(accessor, _section, control) {
    control?.collapseAllSections();
  }
}
class BaseAgentSessionAction extends Action2 {
  async run(accessor, context) {
    const agentSessionsService = accessor.get(IAgentSessionsService);
    const viewsService = accessor.get(IViewsService);
    let sessions = [];
    if (isMarshalledAgentSessionContext(context)) {
      sessions = coalesce((context.sessions ?? [context.session]).map((session) => agentSessionsService.getSession(session.resource)));
    } else if (context) {
      sessions = [context];
    }
    if (sessions.length === 0) {
      const chatView = viewsService.getActiveViewWithId(ChatViewId);
      const focused = chatView?.getFocusedSessions().at(0);
      if (focused) {
        sessions = [focused];
      }
    }
    if (sessions.length > 0) {
      await this.runWithSessions(sessions, accessor);
    }
  }
}
class MarkAgentSessionUnreadAction extends BaseAgentSessionAction {
  constructor() {
    super({
      id: "agentSession.markUnread",
      title: localize2("markUnread", "Mark as Unread"),
      menu: {
        id: MenuId.AgentSessionsContext,
        group: "0_read",
        order: 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.isReadAgentSession,
          ChatContextKeys.isArchivedAgentSession.negate()
          // no read state for archived sessions
        )
      }
    });
  }
  runWithSessions(sessions) {
    for (const session of sessions) {
      session.setRead(false);
    }
  }
}
class MarkAgentSessionReadAction extends BaseAgentSessionAction {
  constructor() {
    super({
      id: "agentSession.markRead",
      title: localize2("markRead", "Mark as Read"),
      menu: {
        id: MenuId.AgentSessionsContext,
        group: "0_read",
        order: 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.isReadAgentSession.negate(),
          ChatContextKeys.isArchivedAgentSession.negate()
          // no read state for archived sessions
        )
      }
    });
  }
  runWithSessions(sessions) {
    for (const session of sessions) {
      session.setRead(true);
    }
  }
}
class BaseArchiveAgentSessionAction extends BaseAgentSessionAction {
  constructor(wording) {
    const action = getChatSessionArchiveActionPresentation(wording).archive;
    super({
      id: "agentSession.archive",
      title: action.title,
      icon: action.icon,
      keybinding: {
        primary: KeyCode.Delete,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.Backspace },
        weight: KeybindingWeight.WorkbenchContrib + 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.agentSessionsViewerFocused,
          ChatContextKeys.isArchivedAgentSession.negate()
        )
      },
      menu: [{
        id: MenuId.AgentSessionItemToolbar,
        group: "navigation",
        order: 1,
        when: ChatContextKeys.isArchivedAgentSession.negate()
      }, {
        id: MenuId.AgentSessionsContext,
        group: "1_edit",
        order: 2,
        when: ChatContextKeys.isArchivedAgentSession.negate()
      }]
    });
    this.wording = wording;
  }
  async runWithSessions(sessions, accessor) {
    const chatService = accessor.get(IChatService);
    const dialogService = accessor.get(IDialogService);
    for (const session of sessions) {
      const chatModel = chatService.getSession(session.resource);
      if (chatModel && !await showClearEditingSessionConfirmation(chatModel, dialogService, {
        isArchiveAction: true,
        titleOverride: this.wording === ChatSessionArchiveActionWording.MarkAsDone ? localize("markSessionDone", "Mark chat as done with pending edits?") : localize("archiveSession", "Archive chat with pending edits?"),
        messageOverride: localize("archiveSessionDescription", "You have pending changes in this chat session.")
      })) {
        return;
      }
      session.setArchived(true);
    }
  }
}
class ArchiveAgentSessionAction extends BaseArchiveAgentSessionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.Archive);
  }
}
class MarkAgentSessionDoneAction extends BaseArchiveAgentSessionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.MarkAsDone);
  }
}
class BaseUnarchiveAgentSessionAction extends BaseAgentSessionAction {
  constructor(wording) {
    const action = getChatSessionArchiveActionPresentation(wording).unarchive;
    super({
      id: "agentSession.unarchive",
      title: action.title,
      icon: action.icon,
      keybinding: {
        primary: KeyMod.Shift | KeyCode.Delete,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backspace
        },
        weight: KeybindingWeight.WorkbenchContrib + 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.agentSessionsViewerFocused,
          ChatContextKeys.isArchivedAgentSession
        )
      },
      menu: [{
        id: MenuId.AgentSessionItemToolbar,
        group: "navigation",
        order: 1,
        when: ChatContextKeys.isArchivedAgentSession
      }, {
        id: MenuId.AgentSessionsContext,
        group: "1_edit",
        order: 2,
        when: ChatContextKeys.isArchivedAgentSession
      }]
    });
  }
  runWithSessions(sessions) {
    for (const session of sessions) {
      session.setArchived(false);
    }
  }
}
class UnarchiveAgentSessionAction extends BaseUnarchiveAgentSessionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.Archive);
  }
}
class RestoreAgentSessionAction extends BaseUnarchiveAgentSessionAction {
  constructor() {
    super(ChatSessionArchiveActionWording.MarkAsDone);
  }
}
function getAgentSessionArchiveActionConstructors(wording) {
  return wording === ChatSessionArchiveActionWording.MarkAsDone ? [
    MarkAllAgentSessionsDoneAction,
    MarkAgentSessionSectionDoneAction,
    RestoreAgentSessionSectionAction,
    MarkAgentSessionDoneAction,
    RestoreAgentSessionAction
  ] : [
    ArchiveAllAgentSessionsAction,
    ArchiveAgentSessionSectionAction,
    UnarchiveAgentSessionSectionAction,
    ArchiveAgentSessionAction,
    UnarchiveAgentSessionAction
  ];
}
class PinAgentSessionAction extends BaseAgentSessionAction {
  constructor() {
    super({
      id: "agentSession.pin",
      title: localize2("pin", "Pin"),
      icon: Codicon.pin,
      menu: [{
        id: MenuId.AgentSessionItemToolbar,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.and(
          ChatContextKeys.isPinnedAgentSession.negate(),
          ChatContextKeys.isArchivedAgentSession.negate()
        )
      }, {
        id: MenuId.AgentSessionsContext,
        group: "0_pin",
        order: 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.isPinnedAgentSession.negate(),
          ChatContextKeys.isArchivedAgentSession.negate()
        )
      }]
    });
  }
  runWithSessions(sessions) {
    for (const session of sessions) {
      session.setPinned(true);
    }
  }
}
class UnpinAgentSessionAction extends BaseAgentSessionAction {
  constructor() {
    super({
      id: "agentSession.unpin",
      title: localize2("unpin", "Unpin"),
      icon: Codicon.pinned,
      menu: [{
        id: MenuId.AgentSessionItemToolbar,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.and(
          ChatContextKeys.isPinnedAgentSession,
          ChatContextKeys.isArchivedAgentSession.negate()
        )
      }, {
        id: MenuId.AgentSessionsContext,
        group: "0_pin",
        order: 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.isPinnedAgentSession,
          ChatContextKeys.isArchivedAgentSession.negate()
        )
      }]
    });
  }
  runWithSessions(sessions) {
    for (const session of sessions) {
      session.setPinned(false);
    }
  }
}
const renameSupportedSessionTypes = ContextKeyExpr.or(
  ChatContextKeys.agentSessionType.isEqualTo(AgentSessionProviders.Local),
  ChatContextKeyExprs.isAgentHostSessionItem
);
class RenameAgentSessionAction extends BaseAgentSessionAction {
  constructor() {
    super({
      id: AGENT_SESSION_RENAME_ACTION_ID,
      title: localize2("rename", "Rename..."),
      precondition: ChatContextKeys.hasMultipleAgentSessionsSelected.negate(),
      keybinding: {
        primary: KeyCode.F2,
        mac: {
          primary: KeyCode.Enter
        },
        weight: KeybindingWeight.WorkbenchContrib + 1,
        when: ContextKeyExpr.and(
          ChatContextKeys.agentSessionsViewerFocused,
          renameSupportedSessionTypes
        )
      },
      menu: {
        id: MenuId.AgentSessionsContext,
        group: "1_edit",
        order: 3,
        when: renameSupportedSessionTypes
      }
    });
  }
  async runWithSessions(sessions, accessor) {
    const session = sessions.at(0);
    if (!session) {
      return;
    }
    const quickInputService = accessor.get(IQuickInputService);
    const chatService = accessor.get(IChatService);
    const chatSessionsService = accessor.get(IChatSessionsService);
    const title = await quickInputService.input({ prompt: localize("newChatTitle", "New agent session title"), value: session.label });
    if (title) {
      if (isAgentHostAgentSessionItem(session)) {
        await chatSessionsService.renameChatSession(session.resource, title, CancellationToken.None);
      } else {
        chatService.setChatSessionTitle(session.resource, title);
      }
    }
  }
}
class DeleteAgentSessionAction extends BaseAgentSessionAction {
  constructor() {
    super({
      id: AGENT_SESSION_DELETE_ACTION_ID,
      title: localize2("delete", "Delete..."),
      menu: {
        id: MenuId.AgentSessionsContext,
        group: "1_edit",
        order: 4,
        when: ContextKeyExpr.or(
          ChatContextKeys.agentSessionType.isEqualTo(AgentSessionProviders.Local),
          ChatContextKeyExprs.isAgentHostSessionItem
        )
      }
    });
  }
  async runWithSessions(sessions, accessor) {
    if (sessions.length === 0) {
      return;
    }
    const chatService = accessor.get(IChatService);
    const chatSessionsService = accessor.get(IChatSessionsService);
    const dialogService = accessor.get(IDialogService);
    const widgetService = accessor.get(IChatWidgetService);
    const commandService = accessor.get(ICommandService);
    const confirmed = await dialogService.confirm({
      message: sessions.length === 1 ? localize("deleteSession.confirm", "Are you sure you want to delete this chat session?") : localize("deleteSessions.confirm", "Are you sure you want to delete {0} chat sessions?", sessions.length),
      detail: localize("deleteSession.detail", "This action cannot be undone."),
      primaryButton: localize("deleteSession.delete", "Delete")
    });
    if (!confirmed.confirmed) {
      return;
    }
    const deletedSessionIds = [];
    for (const session of sessions) {
      if (isLocalAgentSessionItem(session)) {
        await widgetService.getWidgetBySessionResource(session.resource)?.clear();
        await chatService.removeHistoryEntry(session.resource);
        const sessionId = LocalChatSessionUri.parseLocalSessionId(session.resource);
        if (sessionId) {
          deletedSessionIds.push(sessionId);
        }
      } else if (isAgentHostAgentSessionItem(session)) {
        try {
          await chatSessionsService.deleteChatSessionItem(session.resource, CancellationToken.None);
          await widgetService.getWidgetBySessionResource(session.resource)?.clear();
        } catch (err) {
          dialogService.error(localize("deleteSession.error", "Failed to delete chat session: {0}", toErrorMessage(err)));
        }
      }
    }
    if (deletedSessionIds.length > 0) {
      commandService.executeCommand("github.copilot.sessionSync.deleteSessionFromCloud", deletedSessionIds).catch(() => {
      });
    }
  }
}
class DeleteAllLocalSessionsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.clearHistory",
      title: localize2("agentSessions.deleteAll", "Delete All Local Workspace Chat Sessions"),
      precondition: ChatContextKeys.enabled,
      category: AGENT_SESSIONS_CATEGORY,
      f1: true
    });
  }
  async run(accessor, ...args) {
    const chatService = accessor.get(IChatService);
    const widgetService = accessor.get(IChatWidgetService);
    const dialogService = accessor.get(IDialogService);
    const agentSessionsService = accessor.get(IAgentSessionsService);
    const localSessionsCount = agentSessionsService.model.sessions.filter((session) => isLocalAgentSessionItem(session)).length;
    if (localSessionsCount === 0) {
      return;
    }
    const confirmed = await dialogService.confirm({
      message: localSessionsCount === 1 ? localize("deleteAllChats.confirmSingle", "Are you sure you want to delete 1 local workspace chat session?") : localize("deleteAllChats.confirm", "Are you sure you want to delete {0} local workspace chat sessions?", localSessionsCount),
      detail: localize("deleteAllChats.detail", "This action cannot be undone."),
      primaryButton: localize("deleteAllChats.button", "Delete All")
    });
    if (!confirmed.confirmed) {
      return;
    }
    await Promise.all(widgetService.getAllWidgets().map((widget) => widget.clear()));
    await chatService.clearAllHistoryEntries();
  }
}
class BaseOpenAgentSessionAction extends BaseAgentSessionAction {
  async runWithSessions(sessions, accessor) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const targetGroup = this.getTargetGroup();
    for (const session of sessions) {
      const uri = session.resource;
      await chatWidgetService.openSession(uri, targetGroup, {
        ...this.getOptions(),
        pinned: true
      });
    }
  }
}
class OpenAgentSessionInEditorGroupAction extends BaseOpenAgentSessionAction {
  static {
    this.id = "workbench.action.chat.openSessionInEditorGroup";
  }
  constructor() {
    super({
      id: OpenAgentSessionInEditorGroupAction.id,
      title: localize2("chat.openSessionInEditorGroup.label", "Open as Editor"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        mac: {
          primary: KeyMod.WinCtrl | KeyCode.Enter
        },
        weight: KeybindingWeight.WorkbenchContrib + 1,
        when: ContextKeyExpr.and(ChatContextKeys.agentSessionsViewerFocused, IsSessionsWindowContext.negate())
      },
      menu: {
        id: MenuId.AgentSessionsContext,
        when: IsSessionsWindowContext.negate(),
        order: 1,
        group: "navigation"
      }
    });
  }
  getTargetGroup() {
    return ACTIVE_GROUP;
  }
  getOptions() {
    return {};
  }
}
class OpenAgentSessionInNewEditorGroupAction extends BaseOpenAgentSessionAction {
  static {
    this.id = "workbench.action.chat.openSessionInNewEditorGroup";
  }
  constructor() {
    super({
      id: OpenAgentSessionInNewEditorGroupAction.id,
      title: localize2("chat.openSessionInNewEditorGroup.label", "Open to the Side"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter,
        mac: {
          primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Enter
        },
        weight: KeybindingWeight.WorkbenchContrib + 1,
        when: ContextKeyExpr.and(ChatContextKeys.agentSessionsViewerFocused, IsSessionsWindowContext.negate())
      },
      menu: {
        id: MenuId.AgentSessionsContext,
        when: IsSessionsWindowContext.negate(),
        order: 2,
        group: "navigation"
      }
    });
  }
  getTargetGroup() {
    return SIDE_GROUP;
  }
  getOptions() {
    return {};
  }
}
class OpenAgentSessionInNewWindowAction extends BaseOpenAgentSessionAction {
  static {
    this.id = "workbench.action.chat.openSessionInNewWindow";
  }
  constructor() {
    super({
      id: OpenAgentSessionInNewWindowAction.id,
      title: localize2("chat.openSessionInNewWindow.label", "Open in New Window"),
      menu: {
        id: MenuId.AgentSessionsContext,
        order: 3,
        group: "navigation"
      }
    });
  }
  getTargetGroup() {
    return AUX_WINDOW_GROUP;
  }
  getOptions() {
    return {
      auxiliary: { compact: true, bounds: { width: 800, height: 640 } }
    };
  }
}
class RefreshAgentSessionsViewerAction extends Action2 {
  constructor() {
    super({
      id: "agentSessionsViewer.refresh",
      title: localize2("refresh", "Refresh Agent Sessions"),
      icon: Codicon.refresh,
      menu: {
        id: MenuId.AgentSessionsToolbar,
        group: "navigation",
        order: 1
      }
    });
  }
  run(accessor, agentSessionsControl) {
    const control = agentSessionsControl ?? accessor.get(IViewsService).getActiveViewWithId(ChatViewId)?.agentSessionsControl;
    if (control) {
      control.refresh();
    } else {
      accessor.get(ICommandService).executeCommand("sessionsViewPane.refresh");
    }
  }
}
class FindAgentSessionInViewerAction extends Action2 {
  constructor() {
    super({
      id: "agentSessionsViewer.find",
      title: localize2("find", "Find Agent Session"),
      icon: Codicon.search,
      menu: {
        id: MenuId.AgentSessionsToolbar,
        group: "navigation",
        order: 2
      }
    });
  }
  run(accessor, agentSessionsControl) {
    const control = agentSessionsControl ?? accessor.get(IViewsService).getActiveViewWithId(ChatViewId)?.agentSessionsControl;
    if (control) {
      return control.openFind();
    } else {
      return accessor.get(ICommandService).executeCommand("sessionsViewPane.find");
    }
  }
}
class UpdateChatViewWidthAction extends Action2 {
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const viewDescriptorService = accessor.get(IViewDescriptorService);
    const configurationService = accessor.get(IConfigurationService);
    const viewsService = accessor.get(IViewsService);
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const chatLocation = viewDescriptorService.getViewLocationById(ChatViewId);
    if (typeof chatLocation !== "number") {
      return;
    }
    const panelPosition = layoutService.getPanelPosition();
    const canResizeView = chatLocation !== ViewContainerLocation.Panel || (panelPosition === Position.LEFT || panelPosition === Position.RIGHT);
    const chatViewSessionsEnabled = configurationService.getValue(ChatConfiguration.ChatViewSessionsEnabled);
    if (!chatViewSessionsEnabled) {
      await configurationService.updateValue(ChatConfiguration.ChatViewSessionsEnabled, true);
    }
    let chatView = viewsService.getActiveViewWithId(ChatViewId);
    if (!chatView) {
      chatView = await viewsService.openView(ChatViewId, false);
    }
    if (!chatView) {
      return;
    }
    const configuredOrientation = configurationService.getValue(ChatConfiguration.ChatViewSessionsOrientation);
    let validatedConfiguredOrientation;
    if (configuredOrientation === "stacked" || configuredOrientation === "sideBySide") {
      validatedConfiguredOrientation = configuredOrientation;
    } else {
      validatedConfiguredOrientation = "sideBySide";
    }
    const newOrientation = this.getOrientation();
    const lastWidthForOrientation = chatView?.getLastDimensions(newOrientation)?.width;
    if ((!canResizeView || validatedConfiguredOrientation === "sideBySide") && newOrientation === AgentSessionsViewerOrientation.Stacked) {
      chatView.updateConfiguredSessionsViewerOrientation("stacked");
    } else if ((!canResizeView || validatedConfiguredOrientation === "stacked") && newOrientation === AgentSessionsViewerOrientation.SideBySide) {
      chatView.updateConfiguredSessionsViewerOrientation("sideBySide");
    }
    if (!canResizeView) {
      return;
    }
    const part = paneCompositeService.getPartId(chatLocation);
    let currentSize = layoutService.getSize(part);
    const chatViewDefaultWidth = 300;
    const sessionsViewDefaultWidth = chatViewDefaultWidth;
    const sideBySideMinWidth = chatViewDefaultWidth + sessionsViewDefaultWidth + 1;
    if (newOrientation === AgentSessionsViewerOrientation.SideBySide && currentSize.width >= sideBySideMinWidth || // already wide enough to show side by side
    newOrientation === AgentSessionsViewerOrientation.Stacked && chatLocation === ViewContainerLocation.AuxiliaryBar && layoutService.isAuxiliaryBarMaximized()) {
      return;
    }
    if (chatLocation === ViewContainerLocation.AuxiliaryBar) {
      layoutService.setAuxiliaryBarMaximized(false);
      currentSize = layoutService.getSize(part);
    }
    let newWidth;
    if (newOrientation === AgentSessionsViewerOrientation.SideBySide) {
      newWidth = Math.max(sideBySideMinWidth, lastWidthForOrientation || Math.round(layoutService.mainContainerDimension.width / 2));
    } else {
      newWidth = lastWidthForOrientation || Math.max(chatViewDefaultWidth, currentSize.width - sessionsViewDefaultWidth);
    }
    layoutService.setSize(part, { width: newWidth, height: currentSize.height });
    const actualSize = layoutService.getSize(part);
    if (chatLocation === ViewContainerLocation.AuxiliaryBar && // only applicable for auxiliary bar
    newOrientation === AgentSessionsViewerOrientation.SideBySide && // only applicable when going to side by side
    actualSize.width < sideBySideMinWidth) {
      layoutService.setAuxiliaryBarMaximized(true);
    }
  }
}
class ShowAgentSessionsSidebar extends UpdateChatViewWidthAction {
  static {
    this.ID = "agentSessions.showAgentSessionsSidebar";
  }
  static {
    this.TITLE = localize2("showAgentSessionsSidebar", "Show Agent Sessions Sidebar");
  }
  constructor() {
    super({
      id: ShowAgentSessionsSidebar.ID,
      title: ShowAgentSessionsSidebar.TITLE,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.Stacked)
      ),
      f1: true,
      category: AGENT_SESSIONS_CATEGORY
    });
  }
  getOrientation() {
    return AgentSessionsViewerOrientation.SideBySide;
  }
}
class HideAgentSessionsSidebar extends UpdateChatViewWidthAction {
  static {
    this.ID = "agentSessions.hideAgentSessionsSidebar";
  }
  static {
    this.TITLE = localize2("hideAgentSessionsSidebar", "Hide Agent Sessions Sidebar");
  }
  constructor() {
    super({
      id: HideAgentSessionsSidebar.ID,
      title: HideAgentSessionsSidebar.TITLE,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.SideBySide)
      ),
      f1: true,
      category: AGENT_SESSIONS_CATEGORY
    });
  }
  getOrientation() {
    return AgentSessionsViewerOrientation.Stacked;
  }
}
class ToggleAgentSessionsSidebar extends Action2 {
  static {
    this.ID = "agentSessions.toggleAgentSessionsSidebar";
  }
  static {
    this.TITLE = localize2("toggleAgentSessionsSidebar", "Toggle Agent Sessions Sidebar");
  }
  constructor() {
    super({
      id: ToggleAgentSessionsSidebar.ID,
      title: ToggleAgentSessionsSidebar.TITLE,
      precondition: ChatContextKeys.enabled,
      f1: true,
      category: AGENT_SESSIONS_CATEGORY
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    const viewsService = accessor.get(IViewsService);
    const chatView = viewsService.getActiveViewWithId(ChatViewId);
    const currentOrientation = chatView?.getSessionsViewerOrientation();
    if (currentOrientation === AgentSessionsViewerOrientation.SideBySide) {
      await commandService.executeCommand(HideAgentSessionsSidebar.ID);
    } else {
      await commandService.executeCommand(ShowAgentSessionsSidebar.ID);
    }
  }
}
class FocusAgentSessionsAction extends Action2 {
  static {
    this.id = "workbench.action.chat.focusAgentSessionsViewer";
  }
  constructor() {
    super({
      id: FocusAgentSessionsAction.id,
      title: localize2("chat.focusAgentSessionsViewer.label", "Focus Agent Sessions"),
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.equals(`config.${ChatConfiguration.ChatViewSessionsEnabled}`, true)
      ),
      category: AGENT_SESSIONS_CATEGORY,
      f1: true
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const configurationService = accessor.get(IConfigurationService);
    const commandService = accessor.get(ICommandService);
    const chatView = await viewsService.openView(ChatViewId, true);
    const focused = chatView?.focusSessions();
    if (focused) {
      return;
    }
    const configuredSessionsViewerOrientation = configurationService.getValue(ChatConfiguration.ChatViewSessionsOrientation);
    if (configuredSessionsViewerOrientation === "stacked") {
      await commandService.executeCommand(ACTION_ID_NEW_CHAT);
    } else {
      await commandService.executeCommand(ShowAgentSessionsSidebar.ID);
    }
    chatView?.focusSessions();
  }
}
export {
  ArchiveAgentSessionAction,
  ArchiveAgentSessionSectionAction,
  ArchiveAllAgentSessionsAction,
  CollapseAllAgentSessionSectionsAction,
  DeleteAgentSessionAction,
  DeleteAllLocalSessionsAction,
  FindAgentSessionInViewerAction,
  FocusAgentSessionsAction,
  HideAgentSessionsSidebar,
  MarkAgentSessionDoneAction,
  MarkAgentSessionReadAction,
  MarkAgentSessionSectionDoneAction,
  MarkAgentSessionSectionReadAction,
  MarkAgentSessionUnreadAction,
  MarkAllAgentSessionsDoneAction,
  MarkAllAgentSessionsReadAction,
  OpenAgentSessionInEditorGroupAction,
  OpenAgentSessionInNewEditorGroupAction,
  OpenAgentSessionInNewWindowAction,
  PinAgentSessionAction,
  RefreshAgentSessionsViewerAction,
  RenameAgentSessionAction,
  RestoreAgentSessionAction,
  RestoreAgentSessionSectionAction,
  SetAgentSessionsOrientationSideBySideAction,
  SetAgentSessionsOrientationStackedAction,
  ShowAgentSessionsSidebar,
  ToggleAgentSessionsSidebar,
  ToggleShowAgentSessionsAction,
  UnarchiveAgentSessionAction,
  UnarchiveAgentSessionSectionAction,
  UnpinAgentSessionAction,
  getAgentSessionArchiveActionConstructors
};
