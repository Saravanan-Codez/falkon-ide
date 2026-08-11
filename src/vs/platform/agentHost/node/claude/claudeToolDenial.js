const CLAUDE_USER_DECLINED_MESSAGE = "User declined";
const CLAUDE_PLAN_DECLINED_MESSAGE = "The user declined the plan, maybe ask why?";
const CLAUDE_QUESTION_CANCELLED_MESSAGE = "The user cancelled the question";
function claudeToolDenialCode(message) {
  switch (message) {
    case CLAUDE_USER_DECLINED_MESSAGE:
    case CLAUDE_PLAN_DECLINED_MESSAGE:
      return "denied";
    case CLAUDE_QUESTION_CANCELLED_MESSAGE:
      return "cancelled";
    default:
      return void 0;
  }
}
export {
  CLAUDE_PLAN_DECLINED_MESSAGE,
  CLAUDE_QUESTION_CANCELLED_MESSAGE,
  CLAUDE_USER_DECLINED_MESSAGE,
  claudeToolDenialCode
};
