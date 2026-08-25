import { localize } from "../../../nls.js";
import { getReasoningEffortDescription, getReasoningEffortLabel } from "./reasoningEffort.js";
const CLAUDE_THINKING_LEVEL_KEY = "thinkingLevel";
function toRuntimeEffortLevel(effort) {
  return effort;
}
function resolveClaudeEffort(model) {
  const raw = model?.config?.[CLAUDE_THINKING_LEVEL_KEY];
  switch (raw) {
    case "low":
    case "medium":
    case "high":
    case "xhigh":
    case "max":
      return raw;
    default:
      return void 0;
  }
}
const CLAUDE_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];
function isClaudeEffortLevel(value) {
  return CLAUDE_EFFORT_LEVELS.includes(value);
}
function createClaudeThinkingLevelSchema(supportedEfforts) {
  if (supportedEfforts.length === 0) {
    return void 0;
  }
  const defaultEffort = supportedEfforts.includes("high") ? "high" : void 0;
  return {
    type: "object",
    properties: {
      [CLAUDE_THINKING_LEVEL_KEY]: {
        type: "string",
        title: localize("claude.modelThinkingLevel.title", "Thinking Level"),
        description: localize("claude.modelThinkingLevel.description", "Controls how much reasoning effort Claude uses."),
        enum: [...supportedEfforts],
        enumLabels: supportedEfforts.map(getReasoningEffortLabel),
        enumDescriptions: supportedEfforts.map((effort) => getReasoningEffortDescription(effort) ?? ""),
        ...defaultEffort !== void 0 ? { default: defaultEffort } : {}
      }
    }
  };
}
export {
  CLAUDE_THINKING_LEVEL_KEY,
  createClaudeThinkingLevelSchema,
  isClaudeEffortLevel,
  resolveClaudeEffort,
  toRuntimeEffortLevel
};
