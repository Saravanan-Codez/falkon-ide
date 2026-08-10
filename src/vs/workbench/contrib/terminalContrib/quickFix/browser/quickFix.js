import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const ITerminalQuickFixService = createDecorator("terminalQuickFixService");
var TerminalQuickFixType = /* @__PURE__ */ ((TerminalQuickFixType2) => {
  TerminalQuickFixType2[TerminalQuickFixType2["TerminalCommand"] = 0] = "TerminalCommand";
  TerminalQuickFixType2[TerminalQuickFixType2["Opener"] = 1] = "Opener";
  TerminalQuickFixType2[TerminalQuickFixType2["Port"] = 2] = "Port";
  TerminalQuickFixType2[TerminalQuickFixType2["VscodeCommand"] = 3] = "VscodeCommand";
  return TerminalQuickFixType2;
})(TerminalQuickFixType || {});
export {
  ITerminalQuickFixService,
  TerminalQuickFixType
};
