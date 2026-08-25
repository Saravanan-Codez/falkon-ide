import { SessionConfigKey } from "../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ChatConfiguration, ChatPermissionLevel } from "./constants.js";
function isAutoApprovePolicyRestricted(configurationService) {
  return configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false;
}
function isAssistedPermissionsEnabled(configurationService) {
  return configurationService.getValue(ChatConfiguration.AssistedPermissionsEnabled) === true;
}
function isPermissionLevelVisible(value, assistedPermissionsEnabled) {
  return value !== ChatPermissionLevel.Assisted || assistedPermissionsEnabled;
}
function isAutoApproveValuePolicyRestricted(value, policyRestricted) {
  return policyRestricted && value !== ChatPermissionLevel.Default;
}
function normalizeSessionConfigValue(property, value, policyRestricted) {
  if (property === SessionConfigKey.AutoApprove && isAutoApproveValuePolicyRestricted(value, policyRestricted)) {
    return ChatPermissionLevel.Default;
  }
  return value;
}
export {
  isAssistedPermissionsEnabled,
  isAutoApprovePolicyRestricted,
  isAutoApproveValuePolicyRestricted,
  isPermissionLevelVisible,
  normalizeSessionConfigValue
};
