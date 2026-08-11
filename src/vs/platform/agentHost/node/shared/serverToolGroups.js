import { feedbackServerToolGroup } from "./agentFeedbackServerTools.js";
import { createSessionServerToolGroup } from "./sessionServerTools.js";
function buildServerToolGroups(sessionAccessor) {
  return [feedbackServerToolGroup, createSessionServerToolGroup(sessionAccessor)];
}
const serverToolGroupsForDisplay = buildServerToolGroups();
function matchesServerToolName(toolName, bareName) {
  return toolName === bareName || toolName.endsWith(`__${bareName}`);
}
function getServerToolDisplay(toolName, args, result) {
  for (const group of serverToolGroupsForDisplay) {
    if (!group.getDisplay) {
      continue;
    }
    for (const def of group.definitions) {
      if (matchesServerToolName(toolName, def.name)) {
        return group.getDisplay(def.name, args, result);
      }
    }
  }
  return void 0;
}
export {
  buildServerToolGroups,
  getServerToolDisplay
};
