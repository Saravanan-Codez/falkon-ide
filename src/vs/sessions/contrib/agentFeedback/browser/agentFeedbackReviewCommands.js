import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { Range } from "../../../../editor/common/core/range.js";
import { localize } from "../../../../nls.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { AgentFeedbackReviewCommandId } from "../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ICodeReviewService } from "../../codeReview/browser/codeReviewService.js";
import { AgentFeedbackKind, AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
const REVIEWABLE_KINDS = /* @__PURE__ */ new Set([AgentFeedbackKind.PRReview, AgentFeedbackKind.AgentReview]);
function kindLabel(kind) {
  switch (kind) {
    case AgentFeedbackKind.PRReview:
      return localize("agentFeedbackReview.prReview", "PR Review");
    case AgentFeedbackKind.AgentReview:
      return localize("agentFeedbackReview.agentReview", "Agent Review");
    default:
      return void 0;
  }
}
function getOwningSessionResource(sessionsManagementService, resource) {
  return sessionsManagementService.getSessionForChatResource(resource)?.session.resource ?? resource;
}
function registerAgentFeedbackReviewCommands() {
  const registrations = new DisposableStore();
  registrations.add(CommandsRegistry.registerCommand(AgentFeedbackReviewCommandId.GetComments, (accessor, sessionOrChatResource) => {
    const feedbackService = accessor.get(IAgentFeedbackService);
    const resource = getOwningSessionResource(accessor.get(ISessionsManagementService), URI.revive(sessionOrChatResource));
    return feedbackService.getFeedback(resource).filter((item) => item.state === AgentFeedbackState.Created && REVIEWABLE_KINDS.has(item.kind)).map((item) => ({
      id: item.id,
      kindLabel: kindLabel(item.kind),
      text: item.text,
      fileUri: item.resourceUri
    }));
  }));
  registrations.add(CommandsRegistry.registerCommand(AgentFeedbackReviewCommandId.Reveal, async (accessor, sessionOrChatResource, commentId) => {
    const feedbackService = accessor.get(IAgentFeedbackService);
    const resource = getOwningSessionResource(accessor.get(ISessionsManagementService), URI.revive(sessionOrChatResource));
    await feedbackService.revealFeedback(resource, commentId);
  }));
  registrations.add(CommandsRegistry.registerCommand(AgentFeedbackReviewCommandId.RevealAt, async (accessor, resourceUri, range) => {
    const feedbackService = accessor.get(IAgentFeedbackService);
    const resource = URI.parse(resourceUri);
    const sessionResource = feedbackService.getFeedbackSessionResource(resource) ?? feedbackService.getMostRecentSessionForResource(resource);
    if (!sessionResource) {
      return;
    }
    const match = feedbackService.getFeedback(sessionResource).find((item) => isEqual(item.resourceUri, resource) && Range.equalsRange(item.range, range));
    if (match) {
      await feedbackService.revealFeedback(sessionResource, match.id);
    } else {
      await feedbackService.revealSessionComment(sessionResource, "", resource, range);
    }
  }));
  registrations.add(CommandsRegistry.registerCommand(AgentFeedbackReviewCommandId.Delete, (accessor, sessionOrChatResource, commentId) => {
    const feedbackService = accessor.get(IAgentFeedbackService);
    const codeReviewService = accessor.get(ICodeReviewService);
    const resource = getOwningSessionResource(accessor.get(ISessionsManagementService), URI.revive(sessionOrChatResource));
    const item = feedbackService.getFeedback(resource).find((f) => f.id === commentId);
    if (item?.kind === AgentFeedbackKind.PRReview && item.sourcePRReviewCommentId) {
      codeReviewService.dismissPRReviewComment(resource, item.sourcePRReviewCommentId);
    }
    feedbackService.removeFeedback(resource, commentId);
  }));
  registrations.add(CommandsRegistry.registerCommand(AgentFeedbackReviewCommandId.Accept, (accessor, sessionOrChatResource, commentIds) => {
    const feedbackService = accessor.get(IAgentFeedbackService);
    const resource = getOwningSessionResource(accessor.get(ISessionsManagementService), URI.revive(sessionOrChatResource));
    for (const id of commentIds) {
      feedbackService.acceptFeedback(resource, id, { revealToAgent: true });
    }
  }));
  return registrations;
}
export {
  registerAgentFeedbackReviewCommands
};
