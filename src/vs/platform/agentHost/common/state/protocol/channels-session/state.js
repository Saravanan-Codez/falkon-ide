var SessionLifecycle = /* @__PURE__ */ ((SessionLifecycle2) => {
  SessionLifecycle2["Creating"] = "creating";
  SessionLifecycle2["Ready"] = "ready";
  SessionLifecycle2["CreationFailed"] = "creationFailed";
  return SessionLifecycle2;
})(SessionLifecycle || {});
var SessionStatus = /* @__PURE__ */ ((SessionStatus2) => {
  SessionStatus2[SessionStatus2["Idle"] = 1] = "Idle";
  SessionStatus2[SessionStatus2["Error"] = 2] = "Error";
  SessionStatus2[SessionStatus2["InProgress"] = 8] = "InProgress";
  SessionStatus2[SessionStatus2["InputNeeded"] = 24] = "InputNeeded";
  SessionStatus2[SessionStatus2["IsRead"] = 32] = "IsRead";
  SessionStatus2[SessionStatus2["IsArchived"] = 64] = "IsArchived";
  return SessionStatus2;
})(SessionStatus || {});
var SessionInputRequestKind = /* @__PURE__ */ ((SessionInputRequestKind2) => {
  SessionInputRequestKind2["ChatInput"] = "chatInput";
  SessionInputRequestKind2["ToolConfirmation"] = "toolConfirmation";
  SessionInputRequestKind2["ToolClientExecution"] = "toolClientExecution";
  SessionInputRequestKind2["ToolAuthentication"] = "toolAuthentication";
  return SessionInputRequestKind2;
})(SessionInputRequestKind || {});
var CustomizationType = /* @__PURE__ */ ((CustomizationType2) => {
  CustomizationType2["Plugin"] = "plugin";
  CustomizationType2["Directory"] = "directory";
  CustomizationType2["Agent"] = "agent";
  CustomizationType2["Skill"] = "skill";
  CustomizationType2["Prompt"] = "prompt";
  CustomizationType2["Rule"] = "rule";
  CustomizationType2["Hook"] = "hook";
  CustomizationType2["McpServer"] = "mcpServer";
  return CustomizationType2;
})(CustomizationType || {});
var CustomizationLoadStatus = /* @__PURE__ */ ((CustomizationLoadStatus2) => {
  CustomizationLoadStatus2["Loading"] = "loading";
  CustomizationLoadStatus2["Loaded"] = "loaded";
  CustomizationLoadStatus2["Degraded"] = "degraded";
  CustomizationLoadStatus2["Error"] = "error";
  return CustomizationLoadStatus2;
})(CustomizationLoadStatus || {});
var McpServerStatus = /* @__PURE__ */ ((McpServerStatus2) => {
  McpServerStatus2["Starting"] = "starting";
  McpServerStatus2["Ready"] = "ready";
  McpServerStatus2["AuthRequired"] = "authRequired";
  McpServerStatus2["Error"] = "error";
  McpServerStatus2["Stopped"] = "stopped";
  return McpServerStatus2;
})(McpServerStatus || {});
var McpAuthRequiredReason = /* @__PURE__ */ ((McpAuthRequiredReason2) => {
  McpAuthRequiredReason2["Required"] = "required";
  McpAuthRequiredReason2["Expired"] = "expired";
  McpAuthRequiredReason2["InsufficientScope"] = "insufficientScope";
  return McpAuthRequiredReason2;
})(McpAuthRequiredReason || {});
export {
  CustomizationLoadStatus,
  CustomizationType,
  McpAuthRequiredReason,
  McpServerStatus,
  SessionInputRequestKind,
  SessionLifecycle,
  SessionStatus
};
