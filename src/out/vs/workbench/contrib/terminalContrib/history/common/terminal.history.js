import { localize } from "../../../../../nls.js";
var TerminalHistoryCommandId = /* @__PURE__ */ ((TerminalHistoryCommandId2) => {
  TerminalHistoryCommandId2["ClearPreviousSessionHistory"] = "workbench.action.terminal.clearPreviousSessionHistory";
  TerminalHistoryCommandId2["GoToRecentDirectory"] = "workbench.action.terminal.goToRecentDirectory";
  TerminalHistoryCommandId2["RunRecentCommand"] = "workbench.action.terminal.runRecentCommand";
  return TerminalHistoryCommandId2;
})(TerminalHistoryCommandId || {});
const defaultTerminalHistoryCommandsToSkipShell = [
  "workbench.action.terminal.goToRecentDirectory" /* GoToRecentDirectory */,
  "workbench.action.terminal.runRecentCommand" /* RunRecentCommand */
];
var TerminalHistorySettingId = /* @__PURE__ */ ((TerminalHistorySettingId2) => {
  TerminalHistorySettingId2["ShellIntegrationCommandHistory"] = "terminal.integrated.shellIntegration.history";
  return TerminalHistorySettingId2;
})(TerminalHistorySettingId || {});
const terminalHistoryConfiguration = {
  ["terminal.integrated.shellIntegration.history" /* ShellIntegrationCommandHistory */]: {
    restricted: true,
    markdownDescription: localize("terminal.integrated.shellIntegration.history", "Controls the number of recently used commands to keep in the terminal command history. Set to 0 to disable terminal command history."),
    type: "number",
    default: 100
  }
};
export {
  TerminalHistoryCommandId,
  TerminalHistorySettingId,
  defaultTerminalHistoryCommandsToSkipShell,
  terminalHistoryConfiguration
};
