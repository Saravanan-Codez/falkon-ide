import { Codicon } from "../../../../base/common/codicons.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { GroupsOrder, IEditorGroupsService } from "../../../../workbench/services/editor/common/editorGroupsService.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { CHAT_CATEGORY } from "../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
import { getActiveResourceCandidates } from "./agentFeedbackEditorUtils.js";
import { Menus } from "../../../browser/menus.js";
import { ICodeReviewService } from "../../codeReview/browser/codeReviewService.js";
import { getSessionEditorComments } from "./sessionEditorComments.js";
import { IPlanReviewFeedbackService } from "../../../../workbench/contrib/chat/browser/planReviewFeedback/planReviewFeedbackService.js";
const submitFeedbackActionId = "agentFeedbackEditor.action.submit";
const navigatePreviousFeedbackActionId = "agentFeedbackEditor.action.navigatePrevious";
const navigateNextFeedbackActionId = "agentFeedbackEditor.action.navigateNext";
const clearAllFeedbackActionId = "agentFeedbackEditor.action.clearAll";
const navigationBearingFakeActionId = "agentFeedbackEditor.navigation.bearings";
const hasSessionEditorComments = new RawContextKey("agentFeedbackEditor.hasSessionComments", false);
const hasUnsubmittedAgentFeedback = new RawContextKey("agentFeedbackEditor.hasUnsubmittedAgentFeedback", false);
const hasActiveSessionAgentFeedback = new RawContextKey("agentFeedbackEditor.hasActiveSessionAgentFeedback", false);
const submitActiveSessionFeedbackActionId = "agentFeedbackEditor.action.submitActiveSession";
class AgentFeedbackEditorAction extends Action2 {
  constructor(desc) {
    super({
      category: CHAT_CATEGORY,
      ...desc
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const agentFeedbackService = accessor.get(IAgentFeedbackService);
    const codeReviewService = accessor.get(ICodeReviewService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const activePane = editorService.activeEditorPane ?? editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find((g) => g.activeEditorPane)?.activeEditorPane ?? editorService.visibleEditorPanes[0];
    const candidates = getActiveResourceCandidates(activePane?.input);
    for (const candidate of candidates) {
      const sessionResource = agentFeedbackService.getFeedbackSessionResource(candidate) ?? agentFeedbackService.getMostRecentSessionForResource(candidate);
      if (!sessionResource) {
        continue;
      }
      const comments = getSessionEditorComments(
        sessionResource,
        agentFeedbackService.getFeedback(sessionResource),
        codeReviewService.getPRReviewState(sessionResource).get()
      );
      if (comments.length > 0) {
        return this.runWithSession(accessor, sessionResource, candidate);
      }
    }
  }
}
class SubmitFeedbackAction extends AgentFeedbackEditorAction {
  constructor() {
    super({
      id: submitFeedbackActionId,
      title: localize2("agentFeedback.submit", "Submit Feedback"),
      shortTitle: localize2("agentFeedback.submitShort", "Submit"),
      icon: Codicon.send,
      precondition: ChatContextKeys.enabled,
      menu: {
        id: Menus.AgentFeedbackEditorContent,
        group: "a_submit",
        order: 0,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, hasUnsubmittedAgentFeedback)
      }
    });
  }
  async runWithSession(accessor, sessionResource, resource) {
    const agentFeedbackService = accessor.get(IAgentFeedbackService);
    const planReviewFeedbackService = accessor.get(IPlanReviewFeedbackService);
    if (planReviewFeedbackService.isActivePlanReview(resource)) {
      return planReviewFeedbackService.submitAllFeedback(resource);
    }
    return agentFeedbackService.submitFeedback(sessionResource);
  }
}
class NavigateFeedbackAction extends AgentFeedbackEditorAction {
  constructor(_next) {
    super({
      id: _next ? navigateNextFeedbackActionId : navigatePreviousFeedbackActionId,
      title: _next ? localize2("agentFeedback.next", "Go to Next Feedback Comment") : localize2("agentFeedback.previous", "Go to Previous Feedback Comment"),
      icon: _next ? Codicon.arrowDown : Codicon.arrowUp,
      f1: true,
      precondition: ChatContextKeys.enabled,
      menu: {
        id: Menus.AgentFeedbackEditorContent,
        group: "navigate",
        order: _next ? 2 : 1,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, hasSessionEditorComments)
      }
    });
    this._next = _next;
  }
  async runWithSession(accessor, sessionResource) {
    const agentFeedbackService = accessor.get(IAgentFeedbackService);
    const codeReviewService = accessor.get(ICodeReviewService);
    const comments = getSessionEditorComments(
      sessionResource,
      agentFeedbackService.getFeedback(sessionResource),
      codeReviewService.getPRReviewState(sessionResource).get()
    );
    const comment = agentFeedbackService.getNextNavigableItem(sessionResource, comments, this._next);
    if (!comment) {
      return;
    }
    await agentFeedbackService.revealSessionComment(sessionResource, comment.id, comment.resourceUri, comment.range);
  }
}
class ClearAllFeedbackAction extends AgentFeedbackEditorAction {
  constructor() {
    super({
      id: clearAllFeedbackActionId,
      title: localize2("agentFeedback.clear", "Clear"),
      tooltip: localize2("agentFeedback.clearAllTooltip", "Clear All Feedback"),
      icon: Codicon.clearAll,
      f1: true,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled),
      menu: {
        id: Menus.AgentFeedbackEditorContent,
        group: "a_submit",
        order: 1,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, hasUnsubmittedAgentFeedback)
      }
    });
  }
  runWithSession(accessor, sessionResource) {
    const agentFeedbackService = accessor.get(IAgentFeedbackService);
    agentFeedbackService.clearFeedback(sessionResource);
  }
}
class SubmitActiveSessionFeedbackAction extends Action2 {
  static {
    this.ID = submitActiveSessionFeedbackActionId;
  }
  constructor() {
    super({
      id: SubmitActiveSessionFeedbackAction.ID,
      title: localize2("agentFeedback.submitFeedback", "Submit Feedback"),
      icon: Codicon.comment,
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, hasActiveSessionAgentFeedback)
    });
  }
  async run(accessor) {
    const agentFeedbackService = accessor.get(IAgentFeedbackService);
    const sessionResource = agentFeedbackService.activeFeedbackSessionResource.get();
    const hasAcceptedFeedback = agentFeedbackService.getFeedback(sessionResource).some((item) => item.state === AgentFeedbackState.Accepted);
    if (!hasAcceptedFeedback) {
      return;
    }
    await agentFeedbackService.submitFeedback(sessionResource);
  }
}
function registerAgentFeedbackEditorActions() {
  registerAction2(SubmitFeedbackAction);
  registerAction2(SubmitActiveSessionFeedbackAction);
  registerAction2(class extends NavigateFeedbackAction {
    constructor() {
      super(false);
    }
  });
  registerAction2(class extends NavigateFeedbackAction {
    constructor() {
      super(true);
    }
  });
  registerAction2(ClearAllFeedbackAction);
  MenuRegistry.appendMenuItem(Menus.AgentFeedbackEditorContent, {
    command: {
      id: navigationBearingFakeActionId,
      title: localize("label", "Navigation Status"),
      precondition: ContextKeyExpr.false()
    },
    group: "navigate",
    order: -1,
    when: ContextKeyExpr.and(ChatContextKeys.enabled, hasSessionEditorComments)
  });
}
export {
  clearAllFeedbackActionId,
  hasActiveSessionAgentFeedback,
  hasSessionEditorComments,
  hasUnsubmittedAgentFeedback,
  navigateNextFeedbackActionId,
  navigatePreviousFeedbackActionId,
  navigationBearingFakeActionId,
  registerAgentFeedbackEditorActions,
  submitActiveSessionFeedbackActionId,
  submitFeedbackActionId
};
