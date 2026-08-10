import { TerminalAccessibilityCommandId, defaultTerminalAccessibilityCommandsToSkipShell } from "../terminalContrib/accessibility/common/terminal.accessibility.js";
import { terminalAccessibilityConfiguration } from "../terminalContrib/accessibility/common/terminalAccessibilityConfiguration.js";
import { terminalAutoRepliesConfiguration } from "../terminalContrib/autoReplies/common/terminalAutoRepliesConfiguration.js";
import { TerminalChatCommandId, TerminalChatContextKeyStrings } from "../terminalContrib/chat/browser/terminalChat.js";
import { terminalInitialHintConfiguration } from "../terminalContrib/inlineHint/common/terminalInitialHintConfiguration.js";
import { terminalChatAgentToolsConfiguration, TerminalChatAgentToolsSettingId } from "../terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.js";
import { AgentSandboxSettingId } from "../../../platform/sandbox/common/settings.js";
import { terminalCommandGuideConfiguration } from "../terminalContrib/commandGuide/common/terminalCommandGuideConfiguration.js";
import { TerminalDeveloperCommandId } from "../terminalContrib/developer/common/terminal.developer.js";
import { defaultTerminalFindCommandToSkipShell } from "../terminalContrib/find/common/terminal.find.js";
import { defaultTerminalHistoryCommandsToSkipShell, terminalHistoryConfiguration } from "../terminalContrib/history/common/terminal.history.js";
import { terminalOscNotificationsConfiguration } from "../terminalContrib/notification/common/terminalNotificationConfiguration.js";
import { terminalResizeDimensionsOverlayConfiguration } from "../terminalContrib/resizeDimensionsOverlay/common/terminalResizeDimensionsOverlayConfiguration.js";
import { TerminalStickyScrollSettingId, terminalStickyScrollConfiguration } from "../terminalContrib/stickyScroll/common/terminalStickyScrollConfiguration.js";
import { defaultTerminalSuggestCommandsToSkipShell } from "../terminalContrib/suggest/common/terminal.suggest.js";
import { TerminalSuggestSettingId, terminalSuggestConfiguration } from "../terminalContrib/suggest/common/terminalSuggestConfiguration.js";
import { terminalTypeAheadConfiguration } from "../terminalContrib/typeAhead/common/terminalTypeAheadConfiguration.js";
import { terminalZoomConfiguration } from "../terminalContrib/zoom/common/terminal.zoom.js";
var TerminalContribCommandId = ((TerminalContribCommandId2) => {
  TerminalContribCommandId2[TerminalContribCommandId2["A11yFocusAccessibleBuffer"] = TerminalAccessibilityCommandId.FocusAccessibleBuffer] = "A11yFocusAccessibleBuffer";
  TerminalContribCommandId2[TerminalContribCommandId2["DeveloperRestartPtyHost"] = TerminalDeveloperCommandId.RestartPtyHost] = "DeveloperRestartPtyHost";
  TerminalContribCommandId2[TerminalContribCommandId2["OpenTerminalSettingsLink"] = TerminalChatCommandId.OpenTerminalSettingsLink] = "OpenTerminalSettingsLink";
  TerminalContribCommandId2[TerminalContribCommandId2["DisableSessionAutoApproval"] = TerminalChatCommandId.DisableSessionAutoApproval] = "DisableSessionAutoApproval";
  TerminalContribCommandId2[TerminalContribCommandId2["FocusMostRecentChatTerminalOutput"] = TerminalChatCommandId.FocusMostRecentChatTerminalOutput] = "FocusMostRecentChatTerminalOutput";
  TerminalContribCommandId2[TerminalContribCommandId2["FocusMostRecentChatTerminal"] = TerminalChatCommandId.FocusMostRecentChatTerminal] = "FocusMostRecentChatTerminal";
  TerminalContribCommandId2[TerminalContribCommandId2["ToggleChatTerminalOutput"] = TerminalChatCommandId.ToggleChatTerminalOutput] = "ToggleChatTerminalOutput";
  TerminalContribCommandId2[TerminalContribCommandId2["FocusChatInstanceAction"] = TerminalChatCommandId.FocusChatInstanceAction] = "FocusChatInstanceAction";
  TerminalContribCommandId2[TerminalContribCommandId2["ContinueInBackground"] = TerminalChatCommandId.ContinueInBackground] = "ContinueInBackground";
  return TerminalContribCommandId2;
})(TerminalContribCommandId || {});
var TerminalContribSettingId = ((TerminalContribSettingId2) => {
  TerminalContribSettingId2[TerminalContribSettingId2["StickyScrollEnabled"] = TerminalStickyScrollSettingId.Enabled] = "StickyScrollEnabled";
  TerminalContribSettingId2[TerminalContribSettingId2["SuggestEnabled"] = TerminalSuggestSettingId.Enabled] = "SuggestEnabled";
  TerminalContribSettingId2[TerminalContribSettingId2["AutoApprove"] = TerminalChatAgentToolsSettingId.AutoApprove] = "AutoApprove";
  TerminalContribSettingId2[TerminalContribSettingId2["EnableAutoApprove"] = TerminalChatAgentToolsSettingId.EnableAutoApprove] = "EnableAutoApprove";
  TerminalContribSettingId2[TerminalContribSettingId2["ShellIntegrationTimeout"] = TerminalChatAgentToolsSettingId.ShellIntegrationTimeout] = "ShellIntegrationTimeout";
  TerminalContribSettingId2[TerminalContribSettingId2["OutputLocation"] = TerminalChatAgentToolsSettingId.OutputLocation] = "OutputLocation";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxEnabled"] = AgentSandboxSettingId.AgentSandboxEnabled] = "AgentSandboxEnabled";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxWindowsEnabled"] = AgentSandboxSettingId.AgentSandboxWindowsEnabled] = "AgentSandboxWindowsEnabled";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxAllowNetwork"] = AgentSandboxSettingId.AgentSandboxAllowNetwork] = "AgentSandboxAllowNetwork";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxAllowUnsandboxedCommands"] = AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands] = "AgentSandboxAllowUnsandboxedCommands";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxRetryWithAllowNetworkRequests"] = AgentSandboxSettingId.AgentSandboxRetryWithAllowNetworkRequests] = "AgentSandboxRetryWithAllowNetworkRequests";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxAllowAutoApprove"] = AgentSandboxSettingId.AgentSandboxAllowAutoApprove] = "AgentSandboxAllowAutoApprove";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxLinuxFileSystem"] = TerminalChatAgentToolsSettingId.AgentSandboxLinuxFileSystem] = "AgentSandboxLinuxFileSystem";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxMacFileSystem"] = TerminalChatAgentToolsSettingId.AgentSandboxMacFileSystem] = "AgentSandboxMacFileSystem";
  TerminalContribSettingId2[TerminalContribSettingId2["AgentSandboxWindowsFileSystem"] = TerminalChatAgentToolsSettingId.AgentSandboxWindowsFileSystem] = "AgentSandboxWindowsFileSystem";
  return TerminalContribSettingId2;
})(TerminalContribSettingId || {});
var TerminalContribContextKeyStrings = ((TerminalContribContextKeyStrings2) => {
  TerminalContribContextKeyStrings2[TerminalContribContextKeyStrings2["ChatHasTerminals"] = TerminalChatContextKeyStrings.ChatHasTerminals] = "ChatHasTerminals";
  TerminalContribContextKeyStrings2[TerminalContribContextKeyStrings2["ChatHasHiddenTerminals"] = TerminalChatContextKeyStrings.ChatHasHiddenTerminals] = "ChatHasHiddenTerminals";
  return TerminalContribContextKeyStrings2;
})(TerminalContribContextKeyStrings || {});
const terminalContribConfiguration = {
  ...terminalAccessibilityConfiguration,
  ...terminalAutoRepliesConfiguration,
  ...terminalChatAgentToolsConfiguration,
  ...terminalInitialHintConfiguration,
  ...terminalCommandGuideConfiguration,
  ...terminalHistoryConfiguration,
  ...terminalOscNotificationsConfiguration,
  ...terminalResizeDimensionsOverlayConfiguration,
  ...terminalStickyScrollConfiguration,
  ...terminalSuggestConfiguration,
  ...terminalTypeAheadConfiguration,
  ...terminalZoomConfiguration
};
const defaultTerminalContribCommandsToSkipShell = [
  ...defaultTerminalAccessibilityCommandsToSkipShell,
  ...defaultTerminalFindCommandToSkipShell,
  ...defaultTerminalHistoryCommandsToSkipShell,
  ...defaultTerminalSuggestCommandsToSkipShell
];
export {
  TerminalContribCommandId,
  TerminalContribContextKeyStrings,
  TerminalContribSettingId,
  defaultTerminalContribCommandsToSkipShell,
  terminalContribConfiguration
};
