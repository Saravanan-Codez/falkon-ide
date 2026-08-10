import { ClaudeSessionConfigKey, narrowClaudePermissionMode } from "../../common/claudeSessionConfigKeys.js";
function readClaudePermissionMode(configurationService, sessionUri) {
  return narrowClaudePermissionMode(
    configurationService.getSessionConfigValues(sessionUri.toString())?.[ClaudeSessionConfigKey.PermissionMode]
  );
}
export {
  readClaudePermissionMode
};
