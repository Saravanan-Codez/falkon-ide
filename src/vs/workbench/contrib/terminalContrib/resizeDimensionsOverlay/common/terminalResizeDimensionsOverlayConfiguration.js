import { localize } from "../../../../../nls.js";
var TerminalResizeDimensionsOverlaySettingId = /* @__PURE__ */ ((TerminalResizeDimensionsOverlaySettingId2) => {
  TerminalResizeDimensionsOverlaySettingId2["Enabled"] = "terminal.integrated.resizeDimensionsOverlay.enabled";
  return TerminalResizeDimensionsOverlaySettingId2;
})(TerminalResizeDimensionsOverlaySettingId || {});
const terminalResizeDimensionsOverlayConfiguration = {
  ["terminal.integrated.resizeDimensionsOverlay.enabled" /* Enabled */]: {
    markdownDescription: localize("resizeDimensionsOverlay.enabled", "Whether to show a visual overlay with the terminal's columns and rows when it is resized."),
    type: "boolean",
    default: true
  }
};
export {
  TerminalResizeDimensionsOverlaySettingId,
  terminalResizeDimensionsOverlayConfiguration
};
