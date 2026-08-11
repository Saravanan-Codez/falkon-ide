var AgentSystemNotificationKind = /* @__PURE__ */ ((AgentSystemNotificationKind2) => {
  AgentSystemNotificationKind2["WorktreeCreationFailure"] = "worktreeCreationFailure";
  return AgentSystemNotificationKind2;
})(AgentSystemNotificationKind || {});
var AgentSystemNotificationSeverity = /* @__PURE__ */ ((AgentSystemNotificationSeverity2) => {
  AgentSystemNotificationSeverity2["Warning"] = "warning";
  return AgentSystemNotificationSeverity2;
})(AgentSystemNotificationSeverity || {});
function readAgentSystemNotificationMeta(source) {
  const meta = source._meta;
  if (!meta) {
    return {};
  }
  return {
    kind: meta["kind"] === "worktreeCreationFailure" /* WorktreeCreationFailure */ ? meta["kind"] : void 0,
    severity: meta["severity"] === "warning" /* Warning */ ? meta["severity"] : void 0
  };
}
function toAgentSystemNotificationMeta(meta) {
  return { ...meta };
}
export {
  AgentSystemNotificationKind,
  AgentSystemNotificationSeverity,
  readAgentSystemNotificationMeta,
  toAgentSystemNotificationMeta
};
