import { isGpt56Model } from "./modelIdentifiers.js";
import { CLIENT_TOOL_SEARCH_REFERENCE_NAME, RUNTIME_TOOL_SEARCH_TOOL_NAME } from "../../common/toolSearchConstants.js";
const NON_DEFERRED_CLIENT_TOOL_NAMES = /* @__PURE__ */ new Set([
  "runTests",
  "rename",
  "usages"
]);
function agentHostModelSupportsToolSearch(modelId) {
  if (!modelId) {
    return false;
  }
  const id = modelId.toLowerCase();
  const normalizedId = id.replace(/\./g, "-");
  if (normalizedId === "gpt-5-4" || normalizedId === "gpt-5-5" || isGpt56Model(id)) {
    return true;
  }
  if (!normalizedId.startsWith("claude")) {
    return false;
  }
  const isPre45 = normalizedId.startsWith("claude-1") || normalizedId.startsWith("claude-2") || normalizedId.startsWith("claude-3") || normalizedId === "claude-sonnet-4" || normalizedId.startsWith("claude-sonnet-4-2") || normalizedId === "claude-opus-4" || normalizedId.startsWith("claude-opus-4-1") || normalizedId.startsWith("claude-opus-4-2");
  return !isPre45;
}
export {
  CLIENT_TOOL_SEARCH_REFERENCE_NAME,
  NON_DEFERRED_CLIENT_TOOL_NAMES,
  RUNTIME_TOOL_SEARCH_TOOL_NAME,
  agentHostModelSupportsToolSearch
};
