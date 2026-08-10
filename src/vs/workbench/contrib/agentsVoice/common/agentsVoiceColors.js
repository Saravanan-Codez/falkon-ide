import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { localize } from "../../../../nls.js";
const agentsVoiceSpeakingForeground = registerColor(
  "agentsVoice.speakingForeground",
  { dark: "#a371f7", light: "#8250df", hcDark: "#d2a8ff", hcLight: "#6639ba" },
  localize("agentsVoice.speakingForeground", "Color for the speaking/active voice state indicator")
);
const agentsVoiceSpeakingBackground = registerColor(
  "agentsVoice.speakingBackground",
  { dark: "#a371f714", light: "#8250df14", hcDark: "#d2a8ff14", hcLight: "#6639ba14" },
  localize("agentsVoice.speakingBackground", "Background color for the speaking voice state row highlight")
);
export {
  agentsVoiceSpeakingBackground,
  agentsVoiceSpeakingForeground
};
