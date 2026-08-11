import { localize } from "../../../../../nls.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
var TerminalStickyScrollSettingId = /* @__PURE__ */ ((TerminalStickyScrollSettingId2) => {
  TerminalStickyScrollSettingId2["Enabled"] = "terminal.integrated.stickyScroll.enabled";
  TerminalStickyScrollSettingId2["MaxLineCount"] = "terminal.integrated.stickyScroll.maxLineCount";
  TerminalStickyScrollSettingId2["IgnoredCommands"] = "terminal.integrated.stickyScroll.ignoredCommands";
  return TerminalStickyScrollSettingId2;
})(TerminalStickyScrollSettingId || {});
const terminalStickyScrollConfiguration = {
  ["terminal.integrated.stickyScroll.enabled" /* Enabled */]: {
    markdownDescription: localize("stickyScroll.enabled", "Shows the current command at the top of the terminal. This feature requires [shell integration]({0}) to be activated. See {1}.", "https://code.visualstudio.com/docs/terminal/shell-integration", `\`#${TerminalSettingId.ShellIntegrationEnabled}#\``),
    type: "boolean",
    default: true
  },
  ["terminal.integrated.stickyScroll.maxLineCount" /* MaxLineCount */]: {
    markdownDescription: localize("stickyScroll.maxLineCount", "Defines the maximum number of sticky lines to show. Sticky scroll lines will never exceed 40% of the viewport regardless of this setting."),
    type: "number",
    default: 5,
    minimum: 1,
    maximum: 10
  },
  ["terminal.integrated.stickyScroll.ignoredCommands" /* IgnoredCommands */]: {
    markdownDescription: localize("stickyScroll.ignoredCommands", "A list of commands that should not trigger sticky scroll. When a command from this list is detected, the sticky scroll overlay will be hidden."),
    type: "array",
    items: {
      type: "string"
    },
    default: [
      "clear",
      "cls",
      "clear-host",
      "agent",
      "agy",
      "copilot",
      "claude",
      "codex",
      "gemini"
    ]
  }
};
export {
  TerminalStickyScrollSettingId,
  terminalStickyScrollConfiguration
};
