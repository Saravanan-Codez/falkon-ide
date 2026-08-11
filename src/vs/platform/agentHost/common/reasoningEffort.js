import { localize } from "../../../nls.js";
const reasoningEffortLevels = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
function getReasoningEffortLabel(level) {
  switch (level) {
    case "none":
      return localize("reasoningEffort.none", "None");
    case "minimal":
      return localize("reasoningEffort.minimal", "Minimal");
    case "low":
      return localize("reasoningEffort.low", "Low");
    case "medium":
      return localize("reasoningEffort.medium", "Medium");
    case "high":
      return localize("reasoningEffort.high", "High");
    case "xhigh":
      return localize("reasoningEffort.xhigh", "Extra High");
    case "max":
      return localize("reasoningEffort.max", "Max");
    default:
      return level.charAt(0).toUpperCase() + level.slice(1);
  }
}
function getReasoningEffortDescription(level) {
  switch (level) {
    case "none":
      return localize("reasoningEffort.noneDescription", "No reasoning applied");
    case "minimal":
      return localize("reasoningEffort.minimalDescription", "Minimal reasoning for fastest responses");
    case "low":
      return localize("reasoningEffort.lowDescription", "Faster responses with less reasoning");
    case "medium":
      return localize("reasoningEffort.mediumDescription", "Balanced reasoning and speed");
    case "high":
      return localize("reasoningEffort.highDescription", "Greater reasoning depth but slower");
    case "xhigh":
      return localize("reasoningEffort.xhighDescription", "Highest reasoning depth but slowest");
    case "max":
      return localize("reasoningEffort.maxDescription", "Absolute maximum capability with no constraints");
    default:
      return void 0;
  }
}
function resolveDefaultReasoningEffort(supportedEfforts, declaredDefault, modelId) {
  if (!supportedEfforts?.length) {
    return void 0;
  }
  if (declaredDefault && supportedEfforts.includes(declaredDefault)) {
    return declaredDefault;
  }
  const lowerId = modelId?.toLowerCase() ?? "";
  const preferred = lowerId.startsWith("claude") || lowerId.includes("kimi-k3") ? "high" : "medium";
  return supportedEfforts.includes(preferred) ? preferred : supportedEfforts[0];
}
export {
  getReasoningEffortDescription,
  getReasoningEffortLabel,
  reasoningEffortLevels,
  resolveDefaultReasoningEffort
};
