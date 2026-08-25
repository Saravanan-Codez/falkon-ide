import { localize } from "../../../../../nls.js";
import { registerColor } from "../../../../../platform/theme/common/colorUtils.js";
const agentsMobileDiffAddedForeground = registerColor(
  "agentsMobileDiff.addedForeground",
  { dark: "#81b88b", light: "#587c0c", hcDark: "#a1e3ad", hcLight: "#374e06" },
  localize("agentsMobileDiff.addedForeground", "Foreground color used for added files / lines in the mobile changes-list and diff overlay in the agent sessions window.")
);
const agentsMobileDiffModifiedForeground = registerColor(
  "agentsMobileDiff.modifiedForeground",
  { dark: "#E2C08D", light: "#895503", hcDark: "#E2C08D", hcLight: "#895503" },
  localize("agentsMobileDiff.modifiedForeground", "Foreground color used for modified files in the mobile changes-list in the agent sessions window.")
);
const agentsMobileDiffDeletedForeground = registerColor(
  "agentsMobileDiff.deletedForeground",
  { dark: "#c74e39", light: "#ad0707", hcDark: "#c74e39", hcLight: "#ad0707" },
  localize("agentsMobileDiff.deletedForeground", "Foreground color used for deleted files / removed lines in the mobile changes-list and diff overlay in the agent sessions window.")
);
export {
  agentsMobileDiffAddedForeground,
  agentsMobileDiffDeletedForeground,
  agentsMobileDiffModifiedForeground
};
