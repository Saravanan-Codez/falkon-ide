import * as DOM from "../../../../../base/browser/dom.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { localize } from "../../../../../nls.js";
import { AgentHostAhpJsonlLoggingSettingId } from "../../../../../platform/agentHost/common/agentService.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { AgentHostAgentDebugLogEnabledSettingId, AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING } from "../../common/promptSyntax/promptTypes.js";
import { isAgentHostSession } from "./agentHostLogSources.js";
const $ = DOM.$;
function getChatDebugLoggingSettingId(sessionResource) {
  return isAgentHostSession(sessionResource) ? AgentHostAgentDebugLogEnabledSettingId : AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING;
}
function isChatDebugLoggingEnabledForSession(configurationService, sessionResource) {
  return configurationService.getValue(getChatDebugLoggingSettingId(sessionResource));
}
function renderEnableSettingMessage(container, settingId, message, preferencesService, disposables) {
  const wrapper = DOM.append(container, $(".chat-debug-logging-disabled"));
  DOM.append(wrapper, $("p.chat-debug-logging-disabled-message", void 0, message));
  const enableButton = disposables.add(new Button(wrapper, { ...defaultButtonStyles, secondary: true }));
  enableButton.element.style.width = "auto";
  enableButton.label = localize("chatDebug.openSetting", "Enable in Settings");
  disposables.add(enableButton.onDidClick(() => {
    preferencesService.openSettings({ jsonEditor: false, query: settingId });
  }));
}
function renderChatDebugLoggingDisabledMessage(container, sessionResource, preferencesService, disposables) {
  renderEnableSettingMessage(
    container,
    getChatDebugLoggingSettingId(sessionResource),
    localize("chatDebug.loggingDisabled", "Agent debug logging is turned off. Enable it to capture and view debug logs for this session."),
    preferencesService,
    disposables
  );
}
function isWireLogLoggingEnabled(configurationService) {
  return configurationService.getValue(AgentHostAhpJsonlLoggingSettingId);
}
function renderWireLogLoggingDisabledMessage(container, preferencesService, disposables) {
  renderEnableSettingMessage(
    container,
    AgentHostAhpJsonlLoggingSettingId,
    localize("chatDebug.wireLogLoggingDisabled", "AHP logging is turned off. Enable it and reproduce the issue to capture and view client\u2194host protocol frames for this session."),
    preferencesService,
    disposables
  );
}
export {
  getChatDebugLoggingSettingId,
  isChatDebugLoggingEnabledForSession,
  isWireLogLoggingEnabled,
  renderChatDebugLoggingDisabledMessage,
  renderWireLogLoggingDisabledMessage
};
