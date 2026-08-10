import { StorageScope } from "../../../../../../platform/storage/common/storage.js";
import { TerminalToolConfirmationStorageKeys } from "../../../../chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolConfirmationSubPart.js";
import { ChatConfiguration, isAutoApproveLevel } from "../../../../chat/common/constants.js";
import { TerminalChatAgentToolsSettingId } from "../../common/terminalChatAgentToolsConfiguration.js";
function isSessionAutoApproveLevel(chatSessionResource, configurationService, chatWidgetService, chatService) {
  const inspected = configurationService.inspect(ChatConfiguration.GlobalAutoApprove);
  if (inspected.policyValue === false) {
    return false;
  }
  const widget = chatWidgetService.getWidgetBySessionResource(chatSessionResource) ?? chatWidgetService.lastFocusedWidget;
  if (widget && isAutoApproveLevel(widget.input.currentModeInfo.permissionLevel)) {
    return true;
  }
  const model = chatService.getSession(chatSessionResource);
  const request = model?.getRequests().at(-1);
  return isAutoApproveLevel(request?.modeInfo?.permissionLevel);
}
function isToolEligibleForTerminalAutoApproval(toolReferenceName, configurationService, legacyToolReferenceFullNames) {
  const config = configurationService.getValue(ChatConfiguration.EligibleForAutoApproval);
  if (config && typeof config === "object") {
    if (Object.prototype.hasOwnProperty.call(config, toolReferenceName)) {
      return config[toolReferenceName];
    }
    if (legacyToolReferenceFullNames) {
      for (const legacyName of legacyToolReferenceFullNames) {
        if (Object.prototype.hasOwnProperty.call(config, legacyName)) {
          return config[legacyName];
        }
      }
    }
  }
  return true;
}
function isTerminalAutoApproveAllowed(toolReferenceName, configurationService, storageService, legacyToolReferenceFullNames) {
  const isEligible = isToolEligibleForTerminalAutoApproval(toolReferenceName, configurationService, legacyToolReferenceFullNames);
  const isAutoApproveEnabled = configurationService.getValue(TerminalChatAgentToolsSettingId.EnableAutoApprove) === true;
  const isAutoApproveWarningAccepted = storageService.getBoolean(TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted, StorageScope.APPLICATION, false);
  return isEligible && isAutoApproveEnabled && isAutoApproveWarningAccepted;
}
export {
  isSessionAutoApproveLevel,
  isTerminalAutoApproveAllowed,
  isToolEligibleForTerminalAutoApproval
};
