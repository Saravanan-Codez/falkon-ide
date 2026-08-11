var TerminalCapability = /* @__PURE__ */ ((TerminalCapability2) => {
  TerminalCapability2[TerminalCapability2["CwdDetection"] = 0] = "CwdDetection";
  TerminalCapability2[TerminalCapability2["NaiveCwdDetection"] = 1] = "NaiveCwdDetection";
  TerminalCapability2[TerminalCapability2["CommandDetection"] = 2] = "CommandDetection";
  TerminalCapability2[TerminalCapability2["PartialCommandDetection"] = 3] = "PartialCommandDetection";
  TerminalCapability2[TerminalCapability2["BufferMarkDetection"] = 4] = "BufferMarkDetection";
  TerminalCapability2[TerminalCapability2["ShellEnvDetection"] = 5] = "ShellEnvDetection";
  TerminalCapability2[TerminalCapability2["PromptTypeDetection"] = 6] = "PromptTypeDetection";
  return TerminalCapability2;
})(TerminalCapability || {});
var CommandInvalidationReason = /* @__PURE__ */ ((CommandInvalidationReason2) => {
  CommandInvalidationReason2["Windows"] = "windows";
  CommandInvalidationReason2["NoProblemsReported"] = "noProblemsReported";
  return CommandInvalidationReason2;
})(CommandInvalidationReason || {});
export {
  CommandInvalidationReason,
  TerminalCapability
};
