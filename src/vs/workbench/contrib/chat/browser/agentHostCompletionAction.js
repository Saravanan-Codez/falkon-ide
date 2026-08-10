import { SessionConfigKey } from "../../../../platform/agentHost/common/sessionConfigKeys.js";
import { isAutoApprovePolicyRestricted } from "../common/agentHostConfigPolicy.js";
import { maybeConfirmElevatedPermissionLevel } from "../common/chatPermissionWarnings.js";
import { ChatConfiguration, ChatPermissionLevel, isChatPermissionLevel } from "../common/constants.js";
async function applyAgentHostCompletionAction(action, dialogService, storageService, apply) {
  const config = action.applyConfig;
  if (!config || Object.keys(config).length === 0) {
    return true;
  }
  const elevatedLevel = getElevatedAutoApproveLevel(config[SessionConfigKey.AutoApprove]);
  if (elevatedLevel !== void 0) {
    const confirmed = await maybeConfirmElevatedPermissionLevel(elevatedLevel, dialogService, storageService, {
      defaultSettingKey: ChatConfiguration.DefaultConfiguration
    });
    if (!confirmed) {
      return false;
    }
  }
  await apply(config);
  return true;
}
function getElevatedAutoApproveLevel(value) {
  if (value === void 0 || value === ChatPermissionLevel.Default) {
    return void 0;
  }
  if (!isChatPermissionLevel(value)) {
    return void 0;
  }
  return value === ChatPermissionLevel.AutoApprove || value === ChatPermissionLevel.Assisted || value === ChatPermissionLevel.Autopilot ? value : void 0;
}
function isPolicyBlockedCompletionAction(action, configurationService) {
  return getElevatedAutoApproveLevel(action.applyConfig?.[SessionConfigKey.AutoApprove]) !== void 0 && isAutoApprovePolicyRestricted(configurationService);
}
export {
  applyAgentHostCompletionAction,
  isPolicyBlockedCompletionAction
};
