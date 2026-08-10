import { ToolResultContentType } from "../../../common/state/protocol/channels-chat/state.js";
const CLAUDE_CLIENT_RESOURCE_SCHEME = "claude-client";
function convertToolCallResult(result, toolUseId) {
  const blocks = result.content ?? [];
  const content = blocks.map((block, index) => convertBlock(block, toolUseId, index));
  const out = { content };
  if (result.structuredContent !== void 0) {
    out.structuredContent = result.structuredContent;
  }
  if (!result.success || result.error) {
    out.isError = true;
  }
  return out;
}
function convertBlock(block, toolUseId, index) {
  switch (block.type) {
    case ToolResultContentType.Text:
      return { type: "text", text: block.text };
    case ToolResultContentType.EmbeddedResource:
      return convertEmbeddedResource(block, toolUseId, index);
    default: {
      console.warn(`[Claude] convertToolCallResult: unsupported tool-result block kind '${block.type}'; degrading to text`);
      let text;
      try {
        text = JSON.stringify(block);
      } catch {
        text = `[unserializable ${block.type} block]`;
      }
      return { type: "text", text };
    }
  }
}
function convertEmbeddedResource(block, toolUseId, index) {
  if (block.contentType.startsWith("image/")) {
    return { type: "image", data: block.data, mimeType: block.contentType };
  }
  const uri = `${CLAUDE_CLIENT_RESOURCE_SCHEME}://${encodeURIComponent(toolUseId)}/${index}`;
  return {
    type: "resource",
    resource: { uri, mimeType: block.contentType, blob: block.data }
  };
}
export {
  convertToolCallResult
};
