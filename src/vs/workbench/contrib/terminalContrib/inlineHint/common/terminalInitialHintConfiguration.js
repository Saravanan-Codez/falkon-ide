import { localize } from "../../../../../nls.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
var TerminalInitialHintSettingId = /* @__PURE__ */ ((TerminalInitialHintSettingId2) => {
  TerminalInitialHintSettingId2["Enabled"] = "terminal.integrated.initialHint";
  return TerminalInitialHintSettingId2;
})(TerminalInitialHintSettingId || {});
const terminalInitialHintConfiguration = {
  ["terminal.integrated.initialHint" /* Enabled */]: {
    restricted: true,
    markdownDescription: localize("terminal.integrated.initialHint", "Controls if the first terminal without input will show a hint about available actions when it is focused. This will only show when {0} is disabled.", `\`#${TerminalSettingId.SendKeybindingsToShell}#\``),
    type: "boolean",
    default: true,
    agentsWindow: { default: false }
  }
};
export {
  TerminalInitialHintSettingId,
  terminalInitialHintConfiguration
};
