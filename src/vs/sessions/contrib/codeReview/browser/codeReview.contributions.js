import { Codicon } from "../../../../base/common/codicons.js";
import { URI } from "../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ActiveEditorContext, IsAuxiliaryWindowContext, IsSessionsWindowContext, IsTopRightEditorGroupContext, MainEditorAreaVisibleContext } from "../../../../workbench/common/contextkeys.js";
import { IsPhoneLayoutContext, SessionHasChangesContext, SessionIsCreatedContext, SessionWorkspaceIsVirtualContext, SessionProviderIdContext, SinglePaneLayoutEnabledContext } from "../../../common/contextkeys.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { CHAT_CATEGORY } from "../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { CodeReviewService, ICodeReviewService } from "./codeReviewService.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { ANY_AGENT_HOST_PROVIDER_RE } from "../../../common/agentHostSessionsProvider.js";
import { Menus } from "../../../browser/menus.js";
import { SessionChangesEditorInput } from "../../changes/browser/sessionChangesEditorInput.js";
import { ISessionChangesService } from "../../changes/browser/sessionChangesService.js";
registerSingleton(ICodeReviewService, CodeReviewService, InstantiationType.Delayed);
const CODE_REVIEW_QUERY = "/code-review";
const singlePaneDetailPanel = SinglePaneLayoutEnabledContext;
const codeReviewChangesToolbarWhen = ContextKeyExpr.and(
  IsSessionsWindowContext,
  SessionWorkspaceIsVirtualContext.toNegated(),
  IsPhoneLayoutContext.negate(),
  SessionIsCreatedContext,
  ContextKeyExpr.regex(SessionProviderIdContext.key, ANY_AGENT_HOST_PROVIDER_RE),
  singlePaneDetailPanel.negate()
);
const singlePaneCodeReviewWhen = ContextKeyExpr.and(
  IsSessionsWindowContext,
  ActiveEditorContext.isEqualTo(SessionChangesEditorInput.EDITOR_ID),
  singlePaneDetailPanel,
  IsAuxiliaryWindowContext.toNegated(),
  IsTopRightEditorGroupContext,
  SessionWorkspaceIsVirtualContext.toNegated(),
  SessionIsCreatedContext,
  SessionHasChangesContext
);
class RunSessionCodeReviewAction extends Action2 {
  static {
    this.ID = "sessions.codeReview.run";
  }
  constructor() {
    super({
      id: RunSessionCodeReviewAction.ID,
      title: localize2("sessions.runCodeReview", "Run Code Review"),
      tooltip: localize("sessions.runCodeReview.tooltip", "Run Code Review"),
      category: CHAT_CATEGORY,
      icon: Codicon.codeReview,
      precondition: ChatContextKeys.hasAgentSessionChanges,
      menu: [
        {
          id: MenuId.AgentsChangesToolbar,
          group: "navigation",
          order: 7,
          when: codeReviewChangesToolbarWhen
        },
        {
          id: Menus.SessionsEditorHeaderSecondary,
          group: "0_codeReview",
          order: 10,
          when: ContextKeyExpr.and(singlePaneCodeReviewWhen, MainEditorAreaVisibleContext)
        },
        {
          id: Menus.SessionsEditorHeaderSecondary,
          group: "secondary/1_codeReview",
          order: 10,
          when: ContextKeyExpr.and(singlePaneCodeReviewWhen, MainEditorAreaVisibleContext.toNegated())
        }
      ]
    });
  }
  async run(accessor, sessionResource) {
    const sessionManagementService = accessor.get(ISessionsManagementService);
    const sessionsService = accessor.get(ISessionsService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const sessionChangesService = accessor.get(ISessionChangesService);
    const candidateResource = URI.isUri(sessionResource) ? sessionResource : sessionsService.activeSession.get()?.resource;
    const resource = candidateResource ? sessionChangesService.getSessionResource(candidateResource) ?? candidateResource : void 0;
    if (!resource) {
      return;
    }
    const session = sessionManagementService.getSession(resource);
    if (!session) {
      return;
    }
    if (session.capabilities.get().supportsMultipleChats) {
      await sessionManagementService.sendNewChatRequest(session, { query: CODE_REVIEW_QUERY });
    } else {
      chatWidgetService.getWidgetBySessionResource(session.resource)?.acceptInput(CODE_REVIEW_QUERY);
    }
  }
}
registerAction2(RunSessionCodeReviewAction);
