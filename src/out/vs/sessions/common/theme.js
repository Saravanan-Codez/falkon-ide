import { localize } from "../../nls.js";
import { Color } from "../../base/common/color.js";
import { darken, lighten, registerColor, transparent } from "../../platform/theme/common/colorUtils.js";
import { contrastBorder, focusBorder } from "../../platform/theme/common/colorRegistry.js";
import { editorWidgetBackground, editorWidgetBorder, editorBackground, toolbarHoverBackground } from "../../platform/theme/common/colors/editorColors.js";
import { foreground } from "../../platform/theme/common/colors/baseColors.js";
import { buttonBackground, buttonSecondaryBorder, inputBackground, inputBorder, inputForeground, inputPlaceholderForeground } from "../../platform/theme/common/colors/inputColors.js";
import { ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, SIDE_BAR_BACKGROUND, SIDE_BAR_FOREGROUND } from "../../workbench/common/theme.js";
const agentsBackground = registerColor(
  "agents.background",
  { dark: editorBackground, light: SIDE_BAR_BACKGROUND, hcDark: editorBackground, hcLight: editorBackground },
  localize("agents.background", "Background color of the agent sessions window shell and gradient base.")
);
const agentsPanelBackground = registerColor(
  "agentsPanel.background",
  { dark: SIDE_BAR_BACKGROUND, light: editorBackground, hcDark: SIDE_BAR_BACKGROUND, hcLight: SIDE_BAR_BACKGROUND },
  localize("agentsPanel.background", "Background color of the card panels (chat, files, terminal) in the agent sessions window.")
);
const agentsPanelForeground = registerColor(
  "agentsPanel.foreground",
  SIDE_BAR_FOREGROUND,
  localize("agentsPanel.foreground", "Foreground color of the card panels (chat, files, terminal) in the agent sessions window.")
);
const agentsPanelBorder = registerColor(
  "agentsPanel.border",
  { dark: transparent(foreground, 0.15), light: transparent(foreground, 0.15), hcDark: contrastBorder, hcLight: contrastBorder },
  localize("agentsPanel.border", "Border color of the card panels (chat, files, terminal) in the agent sessions window.")
);
const agentsGradientTintColor = registerColor(
  "agentsGradient.tintColor",
  buttonBackground,
  localize("agentsGradient.tintColor", "Tint color used in the background gradient of the agent sessions window shell.")
);
const agentFeedbackEditorWidgetBackground = registerColor(
  "agentFeedbackEditorWidget.background",
  { dark: lighten(editorWidgetBackground, 0.08), light: darken(editorWidgetBackground, 0.04), hcDark: Color.black, hcLight: Color.white },
  localize("agentFeedbackEditorWidget.background", "Background color of the agent feedback widget shown in the editor.")
);
const agentFeedbackEditorWidgetBorder = registerColor(
  "agentFeedbackEditorWidget.border",
  { dark: transparent(foreground, 0.35), light: transparent(foreground, 0.35), hcDark: contrastBorder, hcLight: contrastBorder },
  localize("agentFeedbackEditorWidget.border", "Border color of the agent feedback widget shown in the editor.")
);
const agentFeedbackInputWidgetBorder = registerColor(
  "agentFeedbackInputWidget.border",
  { dark: editorWidgetBorder, light: editorWidgetBorder, hcDark: contrastBorder, hcLight: contrastBorder },
  localize("agentFeedbackInputWidget.border", "Border color of the agent feedback input widget shown in the editor.")
);
const agentsUpdateButtonDownloadingBackground = registerColor(
  "agentsUpdateButton.downloadingBackground",
  transparent(buttonBackground, 0.4),
  localize("agentsUpdateButton.downloadingBackground", "Background color of the update button to show download progress in the agent sessions window.")
);
const agentsUpdateButtonDownloadedBackground = registerColor(
  "agentsUpdateButton.downloadedBackground",
  transparent(buttonBackground, 0.7),
  localize("agentsUpdateButton.downloadedBackground", "Background color of the update button when download is complete in the agent sessions window.")
);
const agentsChatInputBackground = registerColor(
  "agentsChatInput.background",
  inputBackground,
  localize("agentsChatInput.background", "Background color of the chat input field in the agent sessions window.")
);
const agentsChatInputForeground = registerColor(
  "agentsChatInput.foreground",
  inputForeground,
  localize("agentsChatInput.foreground", "Foreground color of the chat input field in the agent sessions window.")
);
const agentsChatInputBorder = registerColor(
  "agentsChatInput.border",
  inputBorder,
  localize("agentsChatInput.border", "Border color of the chat input field in the agent sessions window.")
);
const agentsChatInputFocusBorder = registerColor(
  "agentsChatInput.focusBorder",
  focusBorder,
  localize("agentsChatInput.focusBorder", "Border color of the chat input field when focused in the agent sessions window.")
);
const agentsChatInputPlaceholderForeground = registerColor(
  "agentsChatInput.placeholderForeground",
  inputPlaceholderForeground,
  localize("agentsChatInput.placeholderForeground", "Placeholder text color in the chat input field in the agent sessions window.")
);
const agentsNewSessionButtonBackground = registerColor(
  "agentsNewSessionButton.background",
  "#00000000",
  localize("agentsNewSessionButton.background", "Background color of the New Session button in the agent sessions sidebar.")
);
const agentsNewSessionButtonForeground = registerColor(
  "agentsNewSessionButton.foreground",
  SIDE_BAR_FOREGROUND,
  localize("agentsNewSessionButton.foreground", "Foreground color of the New Session button in the agent sessions sidebar.")
);
const agentsNewSessionButtonBorder = registerColor(
  "agentsNewSessionButton.border",
  buttonSecondaryBorder,
  localize("agentsNewSessionButton.border", "Border color of the New Session button in the agent sessions sidebar.")
);
const agentsNewSessionButtonHoverBackground = registerColor(
  "agentsNewSessionButton.hoverBackground",
  toolbarHoverBackground,
  localize("agentsNewSessionButton.hoverBackground", "Background color of the New Session button when hovered in the agent sessions sidebar.")
);
const agentsBadgeBackground = registerColor(
  "agentsBadge.background",
  ACTIVITY_BAR_BADGE_BACKGROUND,
  localize("agentsBadge.background", "Background color of badges in the agent sessions window.")
);
const agentsBadgeForeground = registerColor(
  "agentsBadge.foreground",
  ACTIVITY_BAR_BADGE_FOREGROUND,
  localize("agentsBadge.foreground", "Foreground color of badges in the agent sessions window.")
);
const agentsUnreadBadgeBackground = registerColor(
  "agentsUnreadBadge.background",
  ACTIVITY_BAR_BADGE_BACKGROUND,
  localize("agentsUnreadBadge.background", "Background color of the unread sessions count badge on the sidebar toggle.")
);
const agentsUnreadBadgeForeground = registerColor(
  "agentsUnreadBadge.foreground",
  ACTIVITY_BAR_BADGE_FOREGROUND,
  localize("agentsUnreadBadge.foreground", "Foreground color of the unread sessions count badge on the sidebar toggle.")
);
const activeSessionViewBackground = registerColor(
  "activeSessionView.background",
  agentsPanelBackground,
  localize("activeSessionView.background", "Background color of an active session view in the agent sessions window.")
);
const inactiveSessionViewBackground = registerColor(
  "inactiveSessionView.background",
  agentsBackground,
  localize("inactiveSessionView.background", "Background color of an inactive session view in the agent sessions window.")
);
const activeSessionViewForeground = registerColor(
  "activeSessionView.foreground",
  agentsPanelForeground,
  localize("activeSessionView.foreground", "Foreground color of an active session view in the agent sessions window.")
);
const inactiveSessionViewForeground = registerColor(
  "inactiveSessionView.foreground",
  agentsPanelForeground,
  localize("inactiveSessionView.foreground", "Foreground color of an inactive session view in the agent sessions window.")
);
export {
  activeSessionViewBackground,
  activeSessionViewForeground,
  agentFeedbackEditorWidgetBackground,
  agentFeedbackEditorWidgetBorder,
  agentFeedbackInputWidgetBorder,
  agentsBackground,
  agentsBadgeBackground,
  agentsBadgeForeground,
  agentsChatInputBackground,
  agentsChatInputBorder,
  agentsChatInputFocusBorder,
  agentsChatInputForeground,
  agentsChatInputPlaceholderForeground,
  agentsGradientTintColor,
  agentsNewSessionButtonBackground,
  agentsNewSessionButtonBorder,
  agentsNewSessionButtonForeground,
  agentsNewSessionButtonHoverBackground,
  agentsPanelBackground,
  agentsPanelBorder,
  agentsPanelForeground,
  agentsUnreadBadgeBackground,
  agentsUnreadBadgeForeground,
  agentsUpdateButtonDownloadedBackground,
  agentsUpdateButtonDownloadingBackground,
  inactiveSessionViewBackground,
  inactiveSessionViewForeground
};
