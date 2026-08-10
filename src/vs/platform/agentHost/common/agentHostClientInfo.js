const EDITOR_WINDOW_CLIENT_NAME = "vscode-editor-window";
const AGENTS_WINDOW_CLIENT_NAME = "vscode-agents-window";
var AgentHostClientType = /* @__PURE__ */ ((AgentHostClientType2) => {
  AgentHostClientType2["EditorWindow"] = "editor_window";
  AgentHostClientType2["AgentsWindow"] = "agents_window";
  AgentHostClientType2["Unknown"] = "unknown";
  return AgentHostClientType2;
})(AgentHostClientType || {});
const editorWindowAgentHostClientInfo = Object.freeze({
  name: EDITOR_WINDOW_CLIENT_NAME,
  title: "VS Code"
});
const agentsWindowAgentHostClientInfo = Object.freeze({
  name: AGENTS_WINDOW_CLIENT_NAME,
  title: "VS Code Agents Window"
});
function getAgentHostClientType(clientInfo) {
  switch (clientInfo?.name) {
    case EDITOR_WINDOW_CLIENT_NAME:
      return "editor_window" /* EditorWindow */;
    case AGENTS_WINDOW_CLIENT_NAME:
      return "agents_window" /* AgentsWindow */;
    default:
      return "unknown" /* Unknown */;
  }
}
export {
  AgentHostClientType,
  agentsWindowAgentHostClientInfo,
  editorWindowAgentHostClientInfo,
  getAgentHostClientType
};
