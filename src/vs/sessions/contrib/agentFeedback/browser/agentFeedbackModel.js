var AgentFeedbackKind = /* @__PURE__ */ ((AgentFeedbackKind2) => {
  AgentFeedbackKind2["UserReview"] = "user";
  AgentFeedbackKind2["AgentReview"] = "codeReview";
  AgentFeedbackKind2["PRReview"] = "prReview";
  return AgentFeedbackKind2;
})(AgentFeedbackKind || {});
var AgentFeedbackState = /* @__PURE__ */ ((AgentFeedbackState2) => {
  AgentFeedbackState2["Created"] = "created";
  AgentFeedbackState2["Accepted"] = "accepted";
  AgentFeedbackState2["Submitted"] = "submitted";
  AgentFeedbackState2["Resolved"] = "resolved";
  return AgentFeedbackState2;
})(AgentFeedbackState || {});
export {
  AgentFeedbackKind,
  AgentFeedbackState
};
