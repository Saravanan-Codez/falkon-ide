var CodexSessionConfigKey = /* @__PURE__ */ ((CodexSessionConfigKey2) => {
  CodexSessionConfigKey2["PermissionsPreset"] = "codex.permissionsPreset";
  CodexSessionConfigKey2["ApprovalPolicy"] = "codex.approvalPolicy";
  CodexSessionConfigKey2["SandboxMode"] = "codex.sandboxMode";
  CodexSessionConfigKey2["AdditionalDirectories"] = "codex.additionalDirectories";
  CodexSessionConfigKey2["NetworkAccessEnabled"] = "codex.networkAccessEnabled";
  CodexSessionConfigKey2["WebSearchMode"] = "codex.webSearchMode";
  CodexSessionConfigKey2["ModelReasoningEffort"] = "codex.modelReasoningEffort";
  CodexSessionConfigKey2["Personality"] = "codex.personality";
  CodexSessionConfigKey2["ReasoningSummary"] = "codex.reasoningSummary";
  return CodexSessionConfigKey2;
})(CodexSessionConfigKey || {});
const CODEX_PERMISSIONS_PRESETS = ["default", "auto-review", "full-access"];
const CODEX_DEFAULT_PERMISSIONS_PRESET = "default";
function narrowCodexPermissionsPreset(raw) {
  switch (raw) {
    case "default":
    case "auto-review":
    case "full-access":
      return raw;
    default:
      return void 0;
  }
}
function resolveCodexPermissionsPreset(preset) {
  switch (preset) {
    case "auto-review":
      return { approvalPolicy: "on-request", sandboxMode: "workspace-write", approvalsReviewer: "auto_review" };
    case "full-access":
      return { approvalPolicy: "never", sandboxMode: "danger-full-access", approvalsReviewer: "user" };
    case "default":
    default:
      return { approvalPolicy: "on-request", sandboxMode: "workspace-write", approvalsReviewer: "user" };
  }
}
function presetForResolvedPermissions(resolved) {
  for (const preset of CODEX_PERMISSIONS_PRESETS) {
    const axes = resolveCodexPermissionsPreset(preset);
    if (axes.approvalPolicy === resolved.approvalPolicy && axes.sandboxMode === resolved.sandboxMode && axes.approvalsReviewer === resolved.approvalsReviewer) {
      return preset;
    }
  }
  return void 0;
}
export {
  CODEX_DEFAULT_PERMISSIONS_PRESET,
  CODEX_PERMISSIONS_PRESETS,
  CodexSessionConfigKey,
  narrowCodexPermissionsPreset,
  presetForResolvedPermissions,
  resolveCodexPermissionsPreset
};
