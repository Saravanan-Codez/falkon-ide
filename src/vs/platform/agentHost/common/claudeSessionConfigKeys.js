var ClaudeSessionConfigKey = /* @__PURE__ */ ((ClaudeSessionConfigKey2) => {
  ClaudeSessionConfigKey2["PermissionMode"] = "permissionMode";
  return ClaudeSessionConfigKey2;
})(ClaudeSessionConfigKey || {});
function narrowClaudePermissionMode(raw) {
  switch (raw) {
    case "default":
    case "acceptEdits":
    case "bypassPermissions":
    case "plan":
    case "auto":
      return raw;
    default:
      return void 0;
  }
}
export {
  ClaudeSessionConfigKey,
  narrowClaudePermissionMode
};
