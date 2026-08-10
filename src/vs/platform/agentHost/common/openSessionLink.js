import { URI } from "../../../base/common/uri.js";
import { AgentSession } from "./agentService.js";
import { SessionServerToolName } from "./serverToolNames.js";
import { DEFAULT_CHAT_ID, isAhpChatChannel, parseChatUri } from "./state/sessionState.js";
const AGENT_HOST_SESSION_LINK_SCHEME = "agent-host-session";
function matchesToolName(toolName, bareName) {
  return toolName === bareName || toolName.endsWith(`__${bareName}`);
}
function isCreateSessionTool(toolName) {
  return matchesToolName(toolName, SessionServerToolName.CreateSession);
}
function isCreateChatTool(toolName) {
  return matchesToolName(toolName, SessionServerToolName.CreateChat);
}
function isSendMessageTool(toolName) {
  return matchesToolName(toolName, SessionServerToolName.SendMessage);
}
function buildOpenSessionLinkUri(backendSession, chatId) {
  const provider = AgentSession.provider(backendSession);
  const rawId = AgentSession.id(backendSession);
  if (!provider) {
    throw new Error(`Cannot build open-session link: missing provider in ${backendSession.toString()}`);
  }
  const base = URI.from({ scheme: AGENT_HOST_SESSION_LINK_SCHEME, authority: provider, path: `/${rawId}` }).toString();
  return chatId && chatId !== DEFAULT_CHAT_ID ? `${base}?chat=${encodeURIComponent(chatId)}` : base;
}
function parseOpenSessionLinkUri(uri) {
  const parsed = typeof uri === "string" ? URI.parse(uri) : uri;
  if (parsed.scheme !== AGENT_HOST_SESSION_LINK_SCHEME || !parsed.authority) {
    return void 0;
  }
  const rawId = parsed.path.replace(/^\//, "");
  if (!rawId) {
    return void 0;
  }
  return AgentSession.uri(parsed.authority, rawId);
}
function parseOpenSessionLinkChatId(uri) {
  const parsed = typeof uri === "string" ? URI.parse(uri) : uri;
  if (parsed.scheme !== AGENT_HOST_SESSION_LINK_SCHEME) {
    return void 0;
  }
  const match = /(?:^|&)chat=([^&]+)/.exec(parsed.query);
  const chatId = match ? decodeURIComponent(match[1]) : void 0;
  return chatId === DEFAULT_CHAT_ID ? void 0 : chatId;
}
function buildOpenSessionLinkForChatResource(chatResource) {
  try {
    const resourceStr = typeof chatResource === "string" ? chatResource : chatResource.toString();
    const parsedChat = isAhpChatChannel(resourceStr) ? parseChatUri(resourceStr) : void 0;
    const sourceSession = parsedChat ? parsedChat.session : URI.parse(resourceStr).toString();
    return buildOpenSessionLinkUri(sourceSession, parsedChat?.chatId);
  } catch {
    return void 0;
  }
}
export {
  AGENT_HOST_SESSION_LINK_SCHEME,
  buildOpenSessionLinkForChatResource,
  buildOpenSessionLinkUri,
  isCreateChatTool,
  isCreateSessionTool,
  isSendMessageTool,
  parseOpenSessionLinkChatId,
  parseOpenSessionLinkUri
};
