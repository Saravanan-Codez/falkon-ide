import { jsonSchemaToZodRawShape } from "./claudeJsonSchemaToZod.js";
const TOOL_USE_ID_META_KEY = "claudecode/toolUseId";
async function buildClientToolMcpServer(snapshot, awaitResult, sdk) {
  const tools = await Promise.all(snapshot.map((def) => sdk.tool(
    def.name,
    def.description ?? "",
    jsonSchemaToZodRawShape(def.inputSchema),
    async (_args, extra) => {
      const toolUseId = extractToolUseId(extra);
      if (toolUseId === void 0) {
        return {
          content: [{
            type: "text",
            text: `Client tool "${def.name}" could not run: SDK omitted tool_use_id (expected at extra._meta["${TOOL_USE_ID_META_KEY}"]).`
          }],
          isError: true
        };
      }
      return awaitResult(toolUseId);
    }
  )));
  return sdk.createSdkMcpServer({ name: CLAUDE_CLIENT_MCP_SERVER_NAME, tools });
}
function extractToolUseId(extra) {
  if (!extra || typeof extra !== "object") {
    return void 0;
  }
  const meta = extra._meta;
  if (!meta || typeof meta !== "object") {
    return void 0;
  }
  const value = meta[TOOL_USE_ID_META_KEY];
  return typeof value === "string" ? value : void 0;
}
const CLAUDE_CLIENT_MCP_SERVER_NAME = "client";
function stripClientToolNamePrefix(toolName) {
  const prefix = `mcp__${CLAUDE_CLIENT_MCP_SERVER_NAME}__`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;
}
function hasClientToolNamePrefix(toolName) {
  return toolName.startsWith(`mcp__${CLAUDE_CLIENT_MCP_SERVER_NAME}__`);
}
export {
  CLAUDE_CLIENT_MCP_SERVER_NAME,
  buildClientToolMcpServer,
  extractToolUseId,
  hasClientToolNamePrefix,
  stripClientToolNamePrefix
};
