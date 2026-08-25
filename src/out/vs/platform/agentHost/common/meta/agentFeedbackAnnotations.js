const FEEDBACK_ANNOTATION_META_KEY = "vscode.agentFeedback";
const VIEW_UNREVIEWED_COMMENTS_TOOL_NAME = "viewUnreviewedComments";
const ADD_COMMENT_TOOL_NAME = "addComment";
function isViewUnreviewedCommentsTool(toolName) {
  return toolName === VIEW_UNREVIEWED_COMMENTS_TOOL_NAME || toolName.endsWith(`__${VIEW_UNREVIEWED_COMMENTS_TOOL_NAME}`);
}
function isAddCommentTool(toolName) {
  return toolName === ADD_COMMENT_TOOL_NAME || toolName.endsWith(`__${ADD_COMMENT_TOOL_NAME}`);
}
function isAgentFeedbackKindValue(value) {
  return value === "user" || value === "codeReview" || value === "prReview";
}
function isAgentFeedbackStateValue(value) {
  return value === "created" || value === "accepted" || value === "submitted" || value === "resolved";
}
function readFeedbackAnnotationMeta(annotation) {
  const meta = annotation._meta;
  const slot = meta?.[FEEDBACK_ANNOTATION_META_KEY];
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
    return void 0;
  }
  const raw = slot;
  if (!isAgentFeedbackKindValue(raw["kind"]) || !isAgentFeedbackStateValue(raw["state"]) || typeof raw["sessionResource"] !== "string") {
    return void 0;
  }
  const result = { kind: raw["kind"], state: raw["state"], sessionResource: raw["sessionResource"] };
  if (raw["suggestion"] !== void 0) {
    result.suggestion = raw["suggestion"];
  }
  if (typeof raw["codeSelection"] === "string") {
    result.codeSelection = raw["codeSelection"];
  }
  if (typeof raw["diffHunks"] === "string") {
    result.diffHunks = raw["diffHunks"];
  }
  if (typeof raw["sourcePRReviewCommentId"] === "string") {
    result.sourcePRReviewCommentId = raw["sourcePRReviewCommentId"];
  }
  if (typeof raw["pendingAgentReveal"] === "boolean") {
    result.pendingAgentReveal = raw["pendingAgentReveal"];
  }
  return result;
}
export {
  ADD_COMMENT_TOOL_NAME,
  FEEDBACK_ANNOTATION_META_KEY,
  VIEW_UNREVIEWED_COMMENTS_TOOL_NAME,
  isAddCommentTool,
  isViewUnreviewedCommentsTool,
  readFeedbackAnnotationMeta
};
