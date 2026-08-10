function isToolKind(value) {
  return value === "terminal" || value === "subagent" || value === "search" || value === "read";
}
function readToolCallUiMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  if (typeof raw["resourceUri"] !== "string" || raw["resourceUri"].length === 0) {
    return void 0;
  }
  const result = { resourceUri: raw["resourceUri"] };
  if (typeof raw["channel"] === "string" && raw["channel"].length > 0) {
    result.channel = raw["channel"];
  }
  return result;
}
function readToolSearchCandidates(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const result = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return void 0;
    }
    const raw = candidate;
    if (typeof raw["name"] !== "string" || typeof raw["description"] !== "string") {
      return void 0;
    }
    result.push({
      name: raw["name"],
      description: raw["description"]
    });
  }
  return result;
}
function readToolCallMeta(source) {
  const meta = source._meta;
  if (!meta) {
    return {};
  }
  const result = {};
  if (isToolKind(meta["toolKind"])) {
    result.toolKind = meta["toolKind"];
  }
  if (typeof meta["language"] === "string") {
    result.language = meta["language"];
  }
  if (typeof meta["subagentDescription"] === "string") {
    result.subagentDescription = meta["subagentDescription"];
  }
  if (typeof meta["subagentAgentName"] === "string") {
    result.subagentAgentName = meta["subagentAgentName"];
  }
  if (typeof meta["subagentChatUri"] === "string") {
    result.subagentChatUri = meta["subagentChatUri"];
  }
  if (typeof meta["mcpServerName"] === "string") {
    result.mcpServerName = meta["mcpServerName"];
  }
  if (typeof meta["mcpToolName"] === "string") {
    result.mcpToolName = meta["mcpToolName"];
  }
  if (typeof meta["autoApproveBySetting"] === "boolean") {
    result.autoApproveBySetting = meta["autoApproveBySetting"];
  }
  if (typeof meta["autoApproveRuleResolvable"] === "boolean") {
    result.autoApproveRuleResolvable = meta["autoApproveRuleResolvable"];
  }
  const toolSearchCandidates = readToolSearchCandidates(meta["toolSearchCandidates"]);
  if (toolSearchCandidates) {
    result.toolSearchCandidates = toolSearchCandidates;
  }
  const ui = readToolCallUiMeta(meta["ui"]);
  if (ui) {
    result.ui = ui;
  }
  return result;
}
function toToolCallMeta(meta) {
  const result = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value !== void 0) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
export {
  readToolCallMeta,
  toToolCallMeta
};
