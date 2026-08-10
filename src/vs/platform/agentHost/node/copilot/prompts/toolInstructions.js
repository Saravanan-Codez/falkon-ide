import { coalesce } from "../../../../../base/common/arrays.js";
import { BrowserChatToolReferenceName, browserChatToolReferenceNames } from "../../../../browserView/common/browserChatToolReferenceNames.js";
import { CLIENT_TOOL_SEARCH_REFERENCE_NAME } from "../../../common/toolSearchConstants.js";
const agenticBrowserToolNames = browserChatToolReferenceNames.filter((name) => name !== BrowserChatToolReferenceName.OpenBrowserPage);
const COPILOT_AGENT_HOST_LARGE_OUTPUT_TOOL_INSTRUCTION = "When a tool reports that its output was saved to a temporary file because it was too large, ONLY use the `view` tool with a narrow `view_range` to inspect that file. NEVER read it with shell commands such as `cat`, `head`, `tail`, or `sed`, because their output may be offloaded again.";
const largeOutputToolInstructions = () => COPILOT_AGENT_HOST_LARGE_OUTPUT_TOOL_INSTRUCTION;
const browserToolInstructions = (hasTool) => {
  if (!hasTool(BrowserChatToolReferenceName.OpenBrowserPage)) {
    return void 0;
  }
  const companion = agenticBrowserToolNames.find(hasTool);
  if (!companion) {
    return void 0;
  }
  return `Use the browser tools (${BrowserChatToolReferenceName.OpenBrowserPage}, ${companion}, etc.) when beneficial for front-end tasks, such as when visualizing or validating UI changes.`;
};
const TOOL_INSTRUCTION_LINES = [largeOutputToolInstructions, browserToolInstructions];
const toolSearchToolInstructions = (hasTool) => hasTool(CLIENT_TOOL_SEARCH_REFERENCE_NAME) ? `Most tools are deferred and hidden until you search for them. Before calling a tool that has not already been loaded, ALWAYS use tool search first with a short description of the capability you need, then call the specific tool it returns; tools it returns are immediately available and must not be searched for again.` : void 0;
function toolSearchInstructionLines(toolSearchActive) {
  return toolSearchActive ? [...TOOL_INSTRUCTION_LINES, toolSearchToolInstructions] : TOOL_INSTRUCTION_LINES;
}
function universalToolInstructions(hasTool, lines = TOOL_INSTRUCTION_LINES) {
  const rendered = coalesce(lines.map((line) => line(hasTool)));
  return rendered.length > 0 ? rendered.join("\n") : void 0;
}
function composeToolInstructions(existing, content) {
  if (!existing) {
    return { action: "append", content: `
${content}` };
  }
  if (existing.action === "remove" || typeof existing.action === "function") {
    return existing;
  }
  const base = existing.content ?? "";
  const merged = base ? `${base}
${content}` : content;
  switch (existing.action) {
    case "append":
      return { action: "append", content: `
${merged}` };
    case "prepend":
      return { action: "prepend", content: `${merged}
` };
    default:
      return { action: existing.action, content: merged };
  }
}
function resolveToolInstructionsOverride(hasTool, existing, lines = TOOL_INSTRUCTION_LINES) {
  const content = universalToolInstructions(hasTool, lines);
  return content === void 0 ? void 0 : composeToolInstructions(existing, content);
}
export {
  COPILOT_AGENT_HOST_LARGE_OUTPUT_TOOL_INSTRUCTION,
  resolveToolInstructionsOverride,
  toolSearchInstructionLines,
  universalToolInstructions
};
