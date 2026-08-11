var ChatOriginKind = /* @__PURE__ */ ((ChatOriginKind2) => {
  ChatOriginKind2["User"] = "user";
  ChatOriginKind2["Fork"] = "fork";
  ChatOriginKind2["SideChat"] = "sideChat";
  ChatOriginKind2["Tool"] = "tool";
  return ChatOriginKind2;
})(ChatOriginKind || {});
var ChatInteractivity = /* @__PURE__ */ ((ChatInteractivity2) => {
  ChatInteractivity2["Full"] = "full";
  ChatInteractivity2["ReadOnly"] = "read-only";
  ChatInteractivity2["Hidden"] = "hidden";
  return ChatInteractivity2;
})(ChatInteractivity || {});
var PendingMessageKind = /* @__PURE__ */ ((PendingMessageKind2) => {
  PendingMessageKind2["Steering"] = "steering";
  PendingMessageKind2["Queued"] = "queued";
  return PendingMessageKind2;
})(PendingMessageKind || {});
var ChatInputResponseKind = /* @__PURE__ */ ((ChatInputResponseKind2) => {
  ChatInputResponseKind2["Accept"] = "accept";
  ChatInputResponseKind2["Decline"] = "decline";
  ChatInputResponseKind2["Cancel"] = "cancel";
  return ChatInputResponseKind2;
})(ChatInputResponseKind || {});
var ChatInputQuestionKind = /* @__PURE__ */ ((ChatInputQuestionKind2) => {
  ChatInputQuestionKind2["Text"] = "text";
  ChatInputQuestionKind2["Number"] = "number";
  ChatInputQuestionKind2["Integer"] = "integer";
  ChatInputQuestionKind2["Boolean"] = "boolean";
  ChatInputQuestionKind2["SingleSelect"] = "single-select";
  ChatInputQuestionKind2["MultiSelect"] = "multi-select";
  return ChatInputQuestionKind2;
})(ChatInputQuestionKind || {});
var ChatInputRequestPurpose = /* @__PURE__ */ ((ChatInputRequestPurpose2) => {
  ChatInputRequestPurpose2["AskUser"] = "askUser";
  ChatInputRequestPurpose2["Elicitation"] = "elicitation";
  ChatInputRequestPurpose2["PlanReview"] = "planReview";
  return ChatInputRequestPurpose2;
})(ChatInputRequestPurpose || {});
var ChatInputAnswerValueKind = /* @__PURE__ */ ((ChatInputAnswerValueKind2) => {
  ChatInputAnswerValueKind2["Text"] = "text";
  ChatInputAnswerValueKind2["Number"] = "number";
  ChatInputAnswerValueKind2["Boolean"] = "boolean";
  ChatInputAnswerValueKind2["Selected"] = "selected";
  ChatInputAnswerValueKind2["SelectedMany"] = "selected-many";
  return ChatInputAnswerValueKind2;
})(ChatInputAnswerValueKind || {});
var ChatInputAnswerState = /* @__PURE__ */ ((ChatInputAnswerState2) => {
  ChatInputAnswerState2["Draft"] = "draft";
  ChatInputAnswerState2["Submitted"] = "submitted";
  ChatInputAnswerState2["Skipped"] = "skipped";
  return ChatInputAnswerState2;
})(ChatInputAnswerState || {});
var TurnState = /* @__PURE__ */ ((TurnState2) => {
  TurnState2["Complete"] = "complete";
  TurnState2["Cancelled"] = "cancelled";
  TurnState2["Error"] = "error";
  return TurnState2;
})(TurnState || {});
var MessageAttachmentKind = /* @__PURE__ */ ((MessageAttachmentKind2) => {
  MessageAttachmentKind2["Simple"] = "simple";
  MessageAttachmentKind2["EmbeddedResource"] = "embeddedResource";
  MessageAttachmentKind2["Resource"] = "resource";
  MessageAttachmentKind2["Annotations"] = "annotations";
  MessageAttachmentKind2["Chat"] = "chat";
  return MessageAttachmentKind2;
})(MessageAttachmentKind || {});
var MessageKind = /* @__PURE__ */ ((MessageKind2) => {
  MessageKind2["User"] = "user";
  MessageKind2["Agent"] = "agent";
  MessageKind2["Tool"] = "tool";
  MessageKind2["SystemNotification"] = "systemNotification";
  return MessageKind2;
})(MessageKind || {});
var ResponsePartKind = /* @__PURE__ */ ((ResponsePartKind2) => {
  ResponsePartKind2["Markdown"] = "markdown";
  ResponsePartKind2["ContentRef"] = "contentRef";
  ResponsePartKind2["ToolCall"] = "toolCall";
  ResponsePartKind2["Reasoning"] = "reasoning";
  ResponsePartKind2["SystemNotification"] = "systemNotification";
  ResponsePartKind2["InputRequest"] = "inputRequest";
  return ResponsePartKind2;
})(ResponsePartKind || {});
var ToolCallStatus = /* @__PURE__ */ ((ToolCallStatus2) => {
  ToolCallStatus2["Streaming"] = "streaming";
  ToolCallStatus2["PendingConfirmation"] = "pending-confirmation";
  ToolCallStatus2["Running"] = "running";
  ToolCallStatus2["AuthRequired"] = "auth-required";
  ToolCallStatus2["PendingResultConfirmation"] = "pending-result-confirmation";
  ToolCallStatus2["Completed"] = "completed";
  ToolCallStatus2["Cancelled"] = "cancelled";
  return ToolCallStatus2;
})(ToolCallStatus || {});
var ToolCallConfirmationReason = /* @__PURE__ */ ((ToolCallConfirmationReason2) => {
  ToolCallConfirmationReason2["NotNeeded"] = "not-needed";
  ToolCallConfirmationReason2["UserAction"] = "user-action";
  ToolCallConfirmationReason2["Setting"] = "setting";
  return ToolCallConfirmationReason2;
})(ToolCallConfirmationReason || {});
var ToolCallRiskAssessmentKind = /* @__PURE__ */ ((ToolCallRiskAssessmentKind2) => {
  ToolCallRiskAssessmentKind2["Judge"] = "judge";
  return ToolCallRiskAssessmentKind2;
})(ToolCallRiskAssessmentKind || {});
var ToolCallRiskAssessmentStatus = /* @__PURE__ */ ((ToolCallRiskAssessmentStatus2) => {
  ToolCallRiskAssessmentStatus2["Loading"] = "loading";
  ToolCallRiskAssessmentStatus2["Complete"] = "complete";
  return ToolCallRiskAssessmentStatus2;
})(ToolCallRiskAssessmentStatus || {});
var ToolCallCancellationReason = /* @__PURE__ */ ((ToolCallCancellationReason2) => {
  ToolCallCancellationReason2["Denied"] = "denied";
  ToolCallCancellationReason2["Skipped"] = "skipped";
  ToolCallCancellationReason2["ResultDenied"] = "result-denied";
  return ToolCallCancellationReason2;
})(ToolCallCancellationReason || {});
var ConfirmationOptionKind = /* @__PURE__ */ ((ConfirmationOptionKind2) => {
  ConfirmationOptionKind2["Approve"] = "approve";
  ConfirmationOptionKind2["Deny"] = "deny";
  return ConfirmationOptionKind2;
})(ConfirmationOptionKind || {});
var ToolCallContributorKind = /* @__PURE__ */ ((ToolCallContributorKind2) => {
  ToolCallContributorKind2["Client"] = "client";
  ToolCallContributorKind2["MCP"] = "mcp";
  return ToolCallContributorKind2;
})(ToolCallContributorKind || {});
var ToolResultContentType = /* @__PURE__ */ ((ToolResultContentType2) => {
  ToolResultContentType2["Text"] = "text";
  ToolResultContentType2["EmbeddedResource"] = "embeddedResource";
  ToolResultContentType2["Resource"] = "resource";
  ToolResultContentType2["FileEdit"] = "fileEdit";
  ToolResultContentType2["Terminal"] = "terminal";
  ToolResultContentType2["Subagent"] = "subagent";
  return ToolResultContentType2;
})(ToolResultContentType || {});
export {
  ChatInputAnswerState,
  ChatInputAnswerValueKind,
  ChatInputQuestionKind,
  ChatInputRequestPurpose,
  ChatInputResponseKind,
  ChatInteractivity,
  ChatOriginKind,
  ConfirmationOptionKind,
  MessageAttachmentKind,
  MessageKind,
  PendingMessageKind,
  ResponsePartKind,
  ToolCallCancellationReason,
  ToolCallConfirmationReason,
  ToolCallContributorKind,
  ToolCallRiskAssessmentKind,
  ToolCallRiskAssessmentStatus,
  ToolCallStatus,
  ToolResultContentType,
  TurnState
};
