var TerminalAccessibilityCommandId = /* @__PURE__ */ ((TerminalAccessibilityCommandId2) => {
  TerminalAccessibilityCommandId2["FocusAccessibleBuffer"] = "workbench.action.terminal.focusAccessibleBuffer";
  TerminalAccessibilityCommandId2["AccessibleBufferGoToNextCommand"] = "workbench.action.terminal.accessibleBufferGoToNextCommand";
  TerminalAccessibilityCommandId2["AccessibleBufferGoToPreviousCommand"] = "workbench.action.terminal.accessibleBufferGoToPreviousCommand";
  TerminalAccessibilityCommandId2["ScrollToBottomAccessibleView"] = "workbench.action.terminal.scrollToBottomAccessibleView";
  TerminalAccessibilityCommandId2["ScrollToTopAccessibleView"] = "workbench.action.terminal.scrollToTopAccessibleView";
  return TerminalAccessibilityCommandId2;
})(TerminalAccessibilityCommandId || {});
const defaultTerminalAccessibilityCommandsToSkipShell = [
  "workbench.action.terminal.focusAccessibleBuffer" /* FocusAccessibleBuffer */
];
export {
  TerminalAccessibilityCommandId,
  defaultTerminalAccessibilityCommandsToSkipShell
};
