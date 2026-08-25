import { PANEL_ACTIVE_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_INACTIVE_TITLE_FOREGROUND } from "../../../workbench/common/theme.js";
import { agentsPanelBackground } from "../../common/theme.js";
function applySessionBarThemeColors(container, theme) {
  const bg = theme.getColor(agentsPanelBackground);
  const activeFg = theme.getColor(PANEL_ACTIVE_TITLE_FOREGROUND);
  const inactiveFg = theme.getColor(PANEL_INACTIVE_TITLE_FOREGROUND);
  const activeBorder = theme.getColor(PANEL_ACTIVE_TITLE_BORDER);
  container.style.setProperty("--chat-bar-background", bg?.toString() ?? "");
  container.style.setProperty("--chat-tab-active-foreground", activeFg?.toString() ?? "");
  container.style.setProperty("--chat-tab-inactive-foreground", inactiveFg?.toString() ?? "");
  container.style.setProperty("--chat-tab-active-border", activeBorder?.toString() ?? "");
}
export {
  applySessionBarThemeColors
};
