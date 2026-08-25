import { CLAUDE_SERVER_TOOL_MCP_SERVER_NAME } from "./claudeServerToolMcpServer.js";
import { CLAUDE_CLIENT_MCP_SERVER_NAME } from "./clientTools/claudeClientToolMcpServer.js";
const HOST_INJECTED_MCP_SERVER_NAMES = /* @__PURE__ */ new Set([
  CLAUDE_CLIENT_MCP_SERVER_NAME,
  CLAUDE_SERVER_TOOL_MCP_SERVER_NAME
]);
function isHostInjectedMcpServerName(name) {
  return HOST_INJECTED_MCP_SERVER_NAMES.has(name);
}
export {
  isHostInjectedMcpServerName
};
