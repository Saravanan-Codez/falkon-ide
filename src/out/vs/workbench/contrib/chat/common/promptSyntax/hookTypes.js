import * as nls from "../../../../../nls.js";
import { Target } from "./promptTypes.js";
var HookType = /* @__PURE__ */ ((HookType2) => {
  HookType2["SessionStart"] = "SessionStart";
  HookType2["SessionEnd"] = "SessionEnd";
  HookType2["UserPromptSubmit"] = "UserPromptSubmit";
  HookType2["PreToolUse"] = "PreToolUse";
  HookType2["PostToolUse"] = "PostToolUse";
  HookType2["PreCompact"] = "PreCompact";
  HookType2["SubagentStart"] = "SubagentStart";
  HookType2["SubagentStop"] = "SubagentStop";
  HookType2["Stop"] = "Stop";
  HookType2["ErrorOccurred"] = "ErrorOccurred";
  return HookType2;
})(HookType || {});
const HOOKS_BY_TARGET = {
  // see https://code.visualstudio.com/docs/copilot/customization/hooks#_hook-lifecycle-events
  [Target.VSCode]: {
    "SessionStart": "SessionStart" /* SessionStart */,
    "UserPromptSubmit": "UserPromptSubmit" /* UserPromptSubmit */,
    "PreToolUse": "PreToolUse" /* PreToolUse */,
    "PostToolUse": "PostToolUse" /* PostToolUse */,
    "PreCompact": "PreCompact" /* PreCompact */,
    "SubagentStart": "SubagentStart" /* SubagentStart */,
    "SubagentStop": "SubagentStop" /* SubagentStop */,
    "Stop": "Stop" /* Stop */
  },
  // see https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks#types-of-hooks
  [Target.GitHubCopilot]: {
    "sessionStart": "SessionStart" /* SessionStart */,
    "sessionEnd": "SessionEnd" /* SessionEnd */,
    "userPromptSubmitted": "UserPromptSubmit" /* UserPromptSubmit */,
    "preToolUse": "PreToolUse" /* PreToolUse */,
    "postToolUse": "PostToolUse" /* PostToolUse */,
    "agentStop": "Stop" /* Stop */,
    "subagentStop": "SubagentStop" /* SubagentStop */,
    "errorOccurred": "ErrorOccurred" /* ErrorOccurred */
  },
  // see https://docs.anthropic.com/en/docs/claude-code/hooks
  [Target.Claude]: {
    "SessionStart": "SessionStart" /* SessionStart */,
    "UserPromptSubmit": "UserPromptSubmit" /* UserPromptSubmit */,
    "PreToolUse": "PreToolUse" /* PreToolUse */,
    "PostToolUse": "PostToolUse" /* PostToolUse */,
    "PreCompact": "PreCompact" /* PreCompact */,
    "SubagentStart": "SubagentStart" /* SubagentStart */,
    "SubagentStop": "SubagentStop" /* SubagentStop */,
    "Stop": "Stop" /* Stop */
  },
  // if no target, just list all known hook types.
  [Target.Undefined]: Object.fromEntries(
    Object.values(HookType).map((h) => [h, h])
  )
};
const HOOK_METADATA = {
  ["SessionStart" /* SessionStart */]: {
    label: nls.localize("hookType.sessionStart.label", "Session Start"),
    description: nls.localize("hookType.sessionStart.description", "Executed when a new agent session begins.")
  },
  ["UserPromptSubmit" /* UserPromptSubmit */]: {
    label: nls.localize("hookType.userPromptSubmit.label", "User Prompt Submit"),
    description: nls.localize("hookType.userPromptSubmit.description", "Executed when the user submits a prompt to the agent.")
  },
  ["PreToolUse" /* PreToolUse */]: {
    label: nls.localize("hookType.preToolUse.label", "Pre-Tool Use"),
    description: nls.localize("hookType.preToolUse.description", "Executed before the agent uses any tool.")
  },
  ["PostToolUse" /* PostToolUse */]: {
    label: nls.localize("hookType.postToolUse.label", "Post-Tool Use"),
    description: nls.localize("hookType.postToolUse.description", "Executed after a tool completes execution successfully.")
  },
  ["PreCompact" /* PreCompact */]: {
    label: nls.localize("hookType.preCompact.label", "Pre-Compact"),
    description: nls.localize("hookType.preCompact.description", "Executed before the agent compacts the conversation context.")
  },
  ["SubagentStart" /* SubagentStart */]: {
    label: nls.localize("hookType.subagentStart.label", "Subagent Start"),
    description: nls.localize("hookType.subagentStart.description", "Executed when a subagent is started.")
  },
  ["SubagentStop" /* SubagentStop */]: {
    label: nls.localize("hookType.subagentStop.label", "Subagent Stop"),
    description: nls.localize("hookType.subagentStop.description", "Executed when a subagent stops.")
  },
  ["Stop" /* Stop */]: {
    label: nls.localize("hookType.stop.label", "Stop"),
    description: nls.localize("hookType.stop.description", "Executed when the agent stops.")
  },
  ["SessionEnd" /* SessionEnd */]: {
    label: nls.localize("hookType.sessionEnd.label", "Session End"),
    description: nls.localize("hookType.sessionEnd.description", "Executed when an agent session ends.")
  },
  ["ErrorOccurred" /* ErrorOccurred */]: {
    label: nls.localize("hookType.errorOccurred.label", "Error Occurred"),
    description: nls.localize("hookType.errorOccurred.description", "Executed when an error occurs during the agent session.")
  }
};
export {
  HOOKS_BY_TARGET,
  HOOK_METADATA,
  HookType
};
