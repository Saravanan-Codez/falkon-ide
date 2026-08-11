import { ElicitationState, IChatToolInvocation } from "../chatService/chatService.js";
import { AskQuestionsToolId } from "../tools/builtinTools/askQuestionsTool.js";
function isVoiceQuestionnaireInvocation(part) {
  return part.kind === "toolInvocation" && part.toolId === AskQuestionsToolId;
}
function isPendingVoiceQuestionnaireInvocation(part) {
  if (!isVoiceQuestionnaireInvocation(part)) {
    return false;
  }
  const state = part.state.get();
  return state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval;
}
function getVoiceConfirmationType(parts) {
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index];
    if (part.kind === "questionCarousel" && !part.isUsed) {
      return "questionnaire";
    }
    if (part.kind === "elicitation2" && part.state.get() === ElicitationState.Pending) {
      return "elicitation";
    }
    if (isPendingVoiceQuestionnaireInvocation(part)) {
      return "questionnaire";
    }
  }
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index];
    if (part.kind === "planReview" && !part.isUsed) {
      return "plan";
    }
    if (part.kind === "toolInvocation") {
      const state = part.state.get();
      if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
        return "tool";
      }
      if (state.type === IChatToolInvocation.StateKind.WaitingForAuthentication) {
        return "generic";
      }
    }
    if (part.kind === "confirmation" && !part.isUsed) {
      return "generic";
    }
  }
  return void 0;
}
export {
  getVoiceConfirmationType,
  isPendingVoiceQuestionnaireInvocation,
  isVoiceQuestionnaireInvocation
};
