var McpServerVariableType = /* @__PURE__ */ ((McpServerVariableType2) => {
  McpServerVariableType2["PROMPT"] = "promptString";
  McpServerVariableType2["PICK"] = "pickString";
  return McpServerVariableType2;
})(McpServerVariableType || {});
var McpServerType = /* @__PURE__ */ ((McpServerType2) => {
  McpServerType2["LOCAL"] = "stdio";
  McpServerType2["REMOTE"] = "http";
  return McpServerType2;
})(McpServerType || {});
export {
  McpServerType,
  McpServerVariableType
};
