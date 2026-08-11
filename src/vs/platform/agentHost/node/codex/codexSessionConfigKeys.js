import { CodexSessionConfigKey, CODEX_DEFAULT_PERMISSIONS_PRESET, narrowCodexPermissionsPreset, presetForResolvedPermissions, resolveCodexPermissionsPreset } from "../../common/codexSessionConfigKeys.js";
import { CodexSessionConfigKey as CodexSessionConfigKey2, resolveCodexPermissionsPreset as resolveCodexPermissionsPreset2, presetForResolvedPermissions as presetForResolvedPermissions2, narrowCodexPermissionsPreset as narrowCodexPermissionsPreset2, CODEX_PERMISSIONS_PRESETS, CODEX_DEFAULT_PERMISSIONS_PRESET as CODEX_DEFAULT_PERMISSIONS_PRESET2 } from "../../common/codexSessionConfigKeys.js";
function narrowApprovalPolicy(value) {
  switch (value) {
    case "never":
    case "on-request":
    case "untrusted":
      return value;
    default:
      return void 0;
  }
}
function narrowSandboxMode(value) {
  switch (value) {
    case "read-only":
    case "workspace-write":
    case "danger-full-access":
      return value;
    default:
      return void 0;
  }
}
function resolveCodexPermissions(values, defaults) {
  const preset = narrowCodexPermissionsPreset(values?.[CodexSessionConfigKey.PermissionsPreset]);
  if (preset) {
    return resolveCodexPermissionsPreset(preset);
  }
  return {
    approvalPolicy: narrowApprovalPolicy(values?.[CodexSessionConfigKey.ApprovalPolicy]) ?? defaults.approvalPolicy,
    sandboxMode: narrowSandboxMode(values?.[CodexSessionConfigKey.SandboxMode]) ?? defaults.sandboxMode,
    approvalsReviewer: "user"
  };
}
function migrateCodexPermissionValues(config, defaults) {
  const explicitPreset = narrowCodexPermissionsPreset(config?.[CodexSessionConfigKey.PermissionsPreset]);
  if (explicitPreset) {
    return { [CodexSessionConfigKey.PermissionsPreset]: explicitPreset };
  }
  const resolved = resolveCodexPermissions(config, defaults);
  const equivalentPreset = presetForResolvedPermissions(resolved);
  if (equivalentPreset) {
    return { [CodexSessionConfigKey.PermissionsPreset]: equivalentPreset };
  }
  if (resolved.sandboxMode === "read-only") {
    return {
      [CodexSessionConfigKey.ApprovalPolicy]: resolved.approvalPolicy,
      [CodexSessionConfigKey.SandboxMode]: resolved.sandboxMode
    };
  }
  return {
    [CodexSessionConfigKey.PermissionsPreset]: resolved.sandboxMode === "danger-full-access" ? "full-access" : CODEX_DEFAULT_PERMISSIONS_PRESET
  };
}
function narrowAdditionalDirectories(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  return value.filter((entry) => typeof entry === "string" && entry.length > 0);
}
function narrowBoolean(value) {
  return typeof value === "boolean" ? value : void 0;
}
function narrowWebSearchMode(value) {
  switch (value) {
    case "disabled":
    case "cached":
    case "live":
      return value;
    default:
      return void 0;
  }
}
function narrowReasoningEffort(value) {
  switch (value) {
    case "none":
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return value;
    default:
      return void 0;
  }
}
function narrowPersonality(value) {
  switch (value) {
    case "none":
    case "friendly":
    case "pragmatic":
      return value;
    default:
      return void 0;
  }
}
function narrowReasoningSummary(value) {
  switch (value) {
    case "auto":
    case "concise":
    case "detailed":
    case "none":
      return value;
    default:
      return void 0;
  }
}
function collaborationModeKind(value) {
  return value === "plan" ? "plan" : "default";
}
export {
  CODEX_DEFAULT_PERMISSIONS_PRESET2 as CODEX_DEFAULT_PERMISSIONS_PRESET,
  CODEX_PERMISSIONS_PRESETS,
  CodexSessionConfigKey2 as CodexSessionConfigKey,
  collaborationModeKind,
  migrateCodexPermissionValues,
  narrowAdditionalDirectories,
  narrowApprovalPolicy,
  narrowBoolean,
  narrowCodexPermissionsPreset2 as narrowCodexPermissionsPreset,
  narrowPersonality,
  narrowReasoningEffort,
  narrowReasoningSummary,
  narrowSandboxMode,
  narrowWebSearchMode,
  presetForResolvedPermissions2 as presetForResolvedPermissions,
  resolveCodexPermissions,
  resolveCodexPermissionsPreset2 as resolveCodexPermissionsPreset
};
