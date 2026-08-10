var SessionConfigKey = /* @__PURE__ */ ((SessionConfigKey2) => {
  SessionConfigKey2["AutoApprove"] = "autoApprove";
  SessionConfigKey2["Permissions"] = "permissions";
  SessionConfigKey2["Isolation"] = "isolation";
  SessionConfigKey2["Branch"] = "branch";
  SessionConfigKey2["Mode"] = "mode";
  SessionConfigKey2["WorktreeBranchPrefix"] = "worktreeBranchPrefix";
  SessionConfigKey2["WorktreeIncludeFiles"] = "worktreeIncludeFiles";
  SessionConfigKey2["WorktreeBranchTrack"] = "worktreeBranchTrack";
  return SessionConfigKey2;
})(SessionConfigKey || {});
const KNOWN_AUTO_APPROVE_VALUES = /* @__PURE__ */ new Set(["default", "assisted", "autoApprove", "autopilot"]);
const KNOWN_MODE_VALUES = /* @__PURE__ */ new Set(["interactive", "plan", "autopilot"]);
export {
  KNOWN_AUTO_APPROVE_VALUES,
  KNOWN_MODE_VALUES,
  SessionConfigKey
};
