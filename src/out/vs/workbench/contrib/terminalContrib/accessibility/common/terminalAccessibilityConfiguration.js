import { localize } from "../../../../../nls.js";
var TerminalAccessibilitySettingId = /* @__PURE__ */ ((TerminalAccessibilitySettingId2) => {
  TerminalAccessibilitySettingId2["AccessibleViewPreserveCursorPosition"] = "terminal.integrated.accessibleViewPreserveCursorPosition";
  TerminalAccessibilitySettingId2["AccessibleViewFocusOnCommandExecution"] = "terminal.integrated.accessibleViewFocusOnCommandExecution";
  return TerminalAccessibilitySettingId2;
})(TerminalAccessibilitySettingId || {});
var TerminalAccessibleViewPreserveCursorPosition = /* @__PURE__ */ ((TerminalAccessibleViewPreserveCursorPosition2) => {
  TerminalAccessibleViewPreserveCursorPosition2["Always"] = "always";
  return TerminalAccessibleViewPreserveCursorPosition2;
})(TerminalAccessibleViewPreserveCursorPosition || {});
const terminalAccessibilityConfiguration = {
  ["terminal.integrated.accessibleViewPreserveCursorPosition" /* AccessibleViewPreserveCursorPosition */]: {
    markdownDescription: localize("terminal.integrated.accessibleViewPreserveCursorPosition", "Controls whether the cursor position is preserved in the terminal's accessible view."),
    type: ["boolean", "string"],
    enum: [false, true, "always" /* Always */],
    enumDescriptions: [
      localize("terminal.integrated.accessibleViewPreserveCursorPosition.false", "Always position the cursor at the bottom of the buffer."),
      localize("terminal.integrated.accessibleViewPreserveCursorPosition.true", "Preserve the cursor position on reopen until new terminal content arrives."),
      localize("terminal.integrated.accessibleViewPreserveCursorPosition.always", "Always preserve the cursor position, including when new terminal content arrives.")
    ],
    default: false
  },
  ["terminal.integrated.accessibleViewFocusOnCommandExecution" /* AccessibleViewFocusOnCommandExecution */]: {
    markdownDescription: localize("terminal.integrated.accessibleViewFocusOnCommandExecution", "Focus the terminal accessible view when a command is executed."),
    type: "boolean",
    default: false
  }
};
export {
  TerminalAccessibilitySettingId,
  TerminalAccessibleViewPreserveCursorPosition,
  terminalAccessibilityConfiguration
};
