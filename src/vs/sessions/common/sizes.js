import { localize } from "../../nls.js";
import { registerSize, sizeForAllThemes } from "../../platform/theme/common/sizeUtils.js";
import { AGENTS_FLOATING_PANEL_GAP } from "./layoutConstants.js";
const agentsLayoutFloatingPanelGap = registerSize(
  "agents.layout.floatingPanelGap",
  sizeForAllThemes(AGENTS_FLOATING_PANEL_GAP, "px"),
  localize("agents.layout.floatingPanelGap", "Gap between floating panels in the Agents window.")
);
const agentsFontSizeHeading1 = registerSize(
  "agents.fontSize.heading1",
  sizeForAllThemes(26, "px"),
  localize("agents.fontSize.heading1", "Heading 1 font size for the agents window (welcome screen title).")
);
const agentsFontSizeHeading2 = registerSize(
  "agents.fontSize.heading2",
  sizeForAllThemes(18, "px"),
  localize("agents.fontSize.heading2", "Heading 2 font size for the agents window (title).")
);
const agentsFontSizeHeading3 = registerSize(
  "agents.fontSize.heading3",
  sizeForAllThemes(13, "px"),
  localize("agents.fontSize.heading3", "Heading 3 font size for the agents window (subtitle).")
);
const agentsFontSizeBody1 = registerSize(
  "agents.fontSize.body1",
  sizeForAllThemes(13, "px"),
  localize("agents.fontSize.body1", "Primary body font size for the agents window.")
);
const agentsFontSizeBody2 = registerSize(
  "agents.fontSize.body2",
  sizeForAllThemes(11, "px"),
  localize("agents.fontSize.body2", "Secondary body font size for the agents window.")
);
const agentsFontSizeLabel1 = registerSize(
  "agents.fontSize.label1",
  sizeForAllThemes(12, "px"),
  localize("agents.fontSize.label1", "Label 1 font size for the agents window (section title, tabs).")
);
const agentsFontSizeLabel2 = registerSize(
  "agents.fontSize.label2",
  sizeForAllThemes(11, "px"),
  localize("agents.fontSize.label2", "Label 2 font size for the agents window (metadata).")
);
const agentsFontSizeLabel3 = registerSize(
  "agents.fontSize.label3",
  sizeForAllThemes(10, "px"),
  localize("agents.fontSize.label3", "Label 3 font size for the agents window (badge).")
);
const agentsFontWeightRegular = registerSize(
  "agents.fontWeight.regular",
  sizeForAllThemes(400, ""),
  localize("agents.fontWeight.regular", "Regular font weight (400) for the agents window.")
);
const agentsFontWeightSemiBold = registerSize(
  "agents.fontWeight.semiBold",
  sizeForAllThemes(600, ""),
  localize("agents.fontWeight.semiBold", "SemiBold font weight (600) for the agents window.")
);
export {
  agentsFontSizeBody1,
  agentsFontSizeBody2,
  agentsFontSizeHeading1,
  agentsFontSizeHeading2,
  agentsFontSizeHeading3,
  agentsFontSizeLabel1,
  agentsFontSizeLabel2,
  agentsFontSizeLabel3,
  agentsFontWeightRegular,
  agentsFontWeightSemiBold,
  agentsLayoutFloatingPanelGap
};
