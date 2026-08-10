import { isMacintosh } from "../../../../../base/common/platform.js";
import { localize } from "../../../../../nls.js";
var TerminalZoomCommandId = /* @__PURE__ */ ((TerminalZoomCommandId2) => {
  TerminalZoomCommandId2["FontZoomIn"] = "workbench.action.terminal.fontZoomIn";
  TerminalZoomCommandId2["FontZoomOut"] = "workbench.action.terminal.fontZoomOut";
  TerminalZoomCommandId2["FontZoomReset"] = "workbench.action.terminal.fontZoomReset";
  return TerminalZoomCommandId2;
})(TerminalZoomCommandId || {});
var TerminalZoomSettingId = /* @__PURE__ */ ((TerminalZoomSettingId2) => {
  TerminalZoomSettingId2["MouseWheelZoom"] = "terminal.integrated.mouseWheelZoom";
  return TerminalZoomSettingId2;
})(TerminalZoomSettingId || {});
const terminalZoomConfiguration = {
  ["terminal.integrated.mouseWheelZoom" /* MouseWheelZoom */]: {
    markdownDescription: isMacintosh ? localize("terminal.integrated.mouseWheelZoom.mac", "Zoom the font of the terminal when using mouse wheel and holding `Cmd`.") : localize("terminal.integrated.mouseWheelZoom", "Zoom the font of the terminal when using mouse wheel and holding `Ctrl`."),
    type: "boolean",
    default: false
  }
};
export {
  TerminalZoomCommandId,
  TerminalZoomSettingId,
  terminalZoomConfiguration
};
