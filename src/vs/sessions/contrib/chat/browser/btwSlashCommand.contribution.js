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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { IWorkbenchEnvironmentService } from "../../../../workbench/services/environment/common/environmentService.js";
import { ChatAgentLocation } from "../../../../workbench/contrib/chat/common/constants.js";
import { IChatService } from "../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { IChatSlashCommandService } from "../../../../workbench/contrib/chat/common/participants/chatSlashCommands.js";
import { captureSideChatSelection } from "../../../../workbench/contrib/chat/browser/chatSideChat.js";
import { IsSessionsWindowContext } from "../../../../workbench/common/contextkeys.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { SessionIsArchivedContext, SessionIsCreatedContext, SessionSupportsSideChatContext } from "../../../common/contextkeys.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { openAndSendSideChat } from "./sideChatOrchestration.js";
let BtwSlashCommandContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.btwSlashCommand";
  }
  constructor(slashCommandService, sessionsService, sessionsManagementService, chatService, chatWidgetService, environmentService, logService, notificationService) {
    super();
    if (!environmentService.isSessionsWindow) {
      return;
    }
    this._register(slashCommandService.registerSlashCommand({
      command: "btw",
      detail: localize("btw", "Ask a side question without adding it to this conversation"),
      sortText: "z2_btw",
      executeImmediately: false,
      executeDuringRequest: true,
      silent: true,
      locations: [ChatAgentLocation.Chat],
      when: ContextKeyExpr.and(
        IsSessionsWindowContext,
        SessionIsCreatedContext,
        SessionIsArchivedContext.negate(),
        SessionSupportsSideChatContext
      )
    }, async (prompt, _progress, _history, _location, sessionResource) => {
      const remainder = prompt.trim();
      if (!remainder) {
        notificationService.warn(localize("btw.missingPrompt", "Enter a question after `/btw`."));
        return;
      }
      const found = sessionsManagementService.getSessionForChatResource(sessionResource);
      if (!found) {
        notificationService.warn(localize("btw.sessionUnavailable", "A side chat cannot be created from this conversation."));
        return;
      }
      const { session, chat } = found;
      if (session.status.get() === SessionStatus.Untitled || session.isArchived.get() || !session.capabilities.get().supportsSideChat) {
        notificationService.warn(localize("btw.unsupported", "This conversation does not support side chats."));
        return;
      }
      const sourceTurn = chatService.getSession(chat.resource)?.getRequests().at(-1);
      if (!sourceTurn) {
        logService.warn("[btw] No turn to branch a side chat from");
        notificationService.warn(localize("btw.noTurn", "Send a message in this conversation before starting a side chat."));
        return;
      }
      const selection = captureSideChatSelection(chatWidgetService.getWidgetBySessionResource(chat.resource));
      let sideChat;
      try {
        sideChat = await sessionsManagementService.createSideChatInSession(session, chat.resource, sourceTurn.id, selection);
      } catch (err) {
        logService.error("[btw] Failed to create side chat", err);
        notificationService.error(localize("btw.createFailed", "The side chat could not be created."));
        return;
      }
      await openAndSendSideChat(sessionsManagementService, sessionsService, session, sideChat, remainder);
    }));
  }
};
BtwSlashCommandContribution = __decorateClass([
  __decorateParam(0, IChatSlashCommandService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ISessionsManagementService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatWidgetService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, ILogService),
  __decorateParam(7, INotificationService)
], BtwSlashCommandContribution);
registerWorkbenchContribution2(BtwSlashCommandContribution.ID, BtwSlashCommandContribution, WorkbenchPhase.Eventually);
export {
  BtwSlashCommandContribution
};
