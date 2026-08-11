import { jsonSchemaToZodRawShape } from "./clientTools/claudeJsonSchemaToZod.js";
const CLAUDE_SERVER_TOOL_MCP_SERVER_NAME = "host";
function serverToolAllowList(toolNames) {
  return toolNames.map((name) => `mcp__${CLAUDE_SERVER_TOOL_MCP_SERVER_NAME}__${name}`);
}
function extractServerToolName(toolName) {
  const prefix = `mcp__${CLAUDE_SERVER_TOOL_MCP_SERVER_NAME}__`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : void 0;
}
async function buildServerToolMcpServer(host, sessionUri, sdk) {
  const tools = await Promise.all(host.definitions.map((def) => sdk.tool(
    def.name,
    def.description ?? "",
    jsonSchemaToZodRawShape(def.inputSchema),
    async (args) => {
      try {
        const text = await host.executeTool(sessionUri, def.name, args);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  )));
  return sdk.createSdkMcpServer({ name: CLAUDE_SERVER_TOOL_MCP_SERVER_NAME, tools });
}
export {
  CLAUDE_SERVER_TOOL_MCP_SERVER_NAME,
  buildServerToolMcpServer,
  extractServerToolName,
  serverToolAllowList
};
