import { localize } from "../../../../../nls.js";
var TerminalCommandGuideSettingId = /* @__PURE__ */ ((TerminalCommandGuideSettingId2) => {
  TerminalCommandGuideSettingId2["ShowCommandGuide"] = "terminal.integrated.shellIntegration.showCommandGuide";
  return TerminalCommandGuideSettingId2;
})(TerminalCommandGuideSettingId || {});
const terminalCommandGuideConfigSection = "terminal.integrated.shellIntegration";
const terminalCommandGuideConfiguration = {
  ["terminal.integrated.shellIntegration.showCommandGuide" /* ShowCommandGuide */]: {
    restricted: true,
    markdownDescription: localize("showCommandGuide", "Whether to show the command guide when hovering over a command in the terminal."),
    type: "boolean",
    default: true
  }
};
export {
  TerminalCommandGuideSettingId,
  terminalCommandGuideConfigSection,
  terminalCommandGuideConfiguration
};
