var TerminalFindCommandId = /* @__PURE__ */ ((TerminalFindCommandId2) => {
  TerminalFindCommandId2["FindFocus"] = "workbench.action.terminal.focusFind";
  TerminalFindCommandId2["FindHide"] = "workbench.action.terminal.hideFind";
  TerminalFindCommandId2["FindNext"] = "workbench.action.terminal.findNext";
  TerminalFindCommandId2["FindPrevious"] = "workbench.action.terminal.findPrevious";
  TerminalFindCommandId2["ToggleFindRegex"] = "workbench.action.terminal.toggleFindRegex";
  TerminalFindCommandId2["ToggleFindWholeWord"] = "workbench.action.terminal.toggleFindWholeWord";
  TerminalFindCommandId2["ToggleFindCaseSensitive"] = "workbench.action.terminal.toggleFindCaseSensitive";
  TerminalFindCommandId2["SearchWorkspace"] = "workbench.action.terminal.searchWorkspace";
  return TerminalFindCommandId2;
})(TerminalFindCommandId || {});
const defaultTerminalFindCommandToSkipShell = [
  "workbench.action.terminal.focusFind" /* FindFocus */,
  "workbench.action.terminal.hideFind" /* FindHide */,
  "workbench.action.terminal.findNext" /* FindNext */,
  "workbench.action.terminal.findPrevious" /* FindPrevious */,
  "workbench.action.terminal.toggleFindRegex" /* ToggleFindRegex */,
  "workbench.action.terminal.toggleFindWholeWord" /* ToggleFindWholeWord */,
  "workbench.action.terminal.toggleFindCaseSensitive" /* ToggleFindCaseSensitive */,
  "workbench.action.terminal.searchWorkspace" /* SearchWorkspace */
];
export {
  TerminalFindCommandId,
  defaultTerminalFindCommandToSkipShell
};
