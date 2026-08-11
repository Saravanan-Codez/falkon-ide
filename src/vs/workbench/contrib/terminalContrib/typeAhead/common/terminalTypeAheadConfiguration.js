import { localize } from "../../../../../nls.js";
const DEFAULT_LOCAL_ECHO_EXCLUDE = ["vim", "vi", "nano", "tmux"];
var TerminalTypeAheadSettingId = /* @__PURE__ */ ((TerminalTypeAheadSettingId2) => {
  TerminalTypeAheadSettingId2["LocalEchoLatencyThreshold"] = "terminal.integrated.localEchoLatencyThreshold";
  TerminalTypeAheadSettingId2["LocalEchoEnabled"] = "terminal.integrated.localEchoEnabled";
  TerminalTypeAheadSettingId2["LocalEchoExcludePrograms"] = "terminal.integrated.localEchoExcludePrograms";
  TerminalTypeAheadSettingId2["LocalEchoStyle"] = "terminal.integrated.localEchoStyle";
  return TerminalTypeAheadSettingId2;
})(TerminalTypeAheadSettingId || {});
const terminalTypeAheadConfiguration = {
  ["terminal.integrated.localEchoLatencyThreshold" /* LocalEchoLatencyThreshold */]: {
    description: localize("terminal.integrated.localEchoLatencyThreshold", "Length of network delay, in milliseconds, where local edits will be echoed on the terminal without waiting for server acknowledgement. If '0', local echo will always be on, and if '-1' it will be disabled."),
    type: "integer",
    minimum: -1,
    default: 30,
    tags: ["preview"]
  },
  ["terminal.integrated.localEchoEnabled" /* LocalEchoEnabled */]: {
    markdownDescription: localize("terminal.integrated.localEchoEnabled", "When local echo should be enabled. This will override {0}", "`#terminal.integrated.localEchoLatencyThreshold#`"),
    type: "string",
    enum: ["on", "off", "auto"],
    enumDescriptions: [
      localize("terminal.integrated.localEchoEnabled.on", "Always enabled"),
      localize("terminal.integrated.localEchoEnabled.off", "Always disabled"),
      localize("terminal.integrated.localEchoEnabled.auto", "Enabled only for remote workspaces")
    ],
    default: "off",
    tags: ["preview"]
  },
  ["terminal.integrated.localEchoExcludePrograms" /* LocalEchoExcludePrograms */]: {
    description: localize("terminal.integrated.localEchoExcludePrograms", "Local echo will be disabled when any of these program names are found in the terminal title."),
    type: "array",
    items: {
      type: "string",
      uniqueItems: true
    },
    default: DEFAULT_LOCAL_ECHO_EXCLUDE,
    tags: ["preview"]
  },
  ["terminal.integrated.localEchoStyle" /* LocalEchoStyle */]: {
    description: localize("terminal.integrated.localEchoStyle", "Terminal style of locally echoed text; either a font style or an RGB color."),
    default: "dim",
    anyOf: [
      {
        enum: ["bold", "dim", "italic", "underlined", "inverted", "#ff0000"]
      },
      {
        type: "string",
        format: "color-hex"
      }
    ],
    tags: ["preview"]
  }
};
export {
  DEFAULT_LOCAL_ECHO_EXCLUDE,
  TerminalTypeAheadSettingId,
  terminalTypeAheadConfiguration
};
