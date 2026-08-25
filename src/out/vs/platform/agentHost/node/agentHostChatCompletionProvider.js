import { URI } from "../../../base/common/uri.js";
import { CompletionItemKind } from "../common/state/protocol/commands.js";
import { ChatInteractivity, ChatOriginKind, MessageAttachmentKind } from "../common/state/protocol/state.js";
import { buildDefaultChatUri, isAhpChatChannel, isDefaultChatUri, parseRequiredSessionUriFromChatUri } from "../common/state/sessionState.js";
import { CompletionTriggerCharacter } from "./agentHostCompletions.js";
import { resolveChatStateForUri } from "./agentHostStateManager.js";
const MAX_RESULTS = 20;
const CHAT_PREFIX = "chat:";
function extractChatToken(text, offset) {
  if (offset < 0 || offset > text.length) {
    return void 0;
  }
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text.charCodeAt(i);
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
      return void 0;
    }
    if (text[i] === CompletionTriggerCharacter.Hash) {
      if (i > 0) {
        const prev = text.charCodeAt(i - 1);
        const prevIsWs = prev === 32 || prev === 9 || prev === 10 || prev === 13;
        if (!prevIsWs) {
          return void 0;
        }
      }
      const raw = text.slice(i + 1, offset);
      const lower = raw.toLowerCase();
      if (lower.startsWith(CHAT_PREFIX)) {
        return { typed: raw.slice(CHAT_PREFIX.length), rangeStart: i, rangeEnd: offset };
      }
      if (CHAT_PREFIX.startsWith(lower)) {
        return { typed: "", rangeStart: i, rangeEnd: offset };
      }
      return void 0;
    }
  }
  return void 0;
}
function sanitizeChatTitle(title) {
  return title.replace(/\s+/g, " ").trim();
}
class AgentHostChatCompletionProvider {
  constructor(_stateManager) {
    this._stateManager = _stateManager;
    this.kinds = /* @__PURE__ */ new Set([CompletionItemKind.UserMessage]);
    this.triggerCharacters = [CompletionTriggerCharacter.Hash];
  }
  async provideCompletionItems(params, token) {
    const chatToken = extractChatToken(params.text, params.offset);
    if (!chatToken) {
      return [];
    }
    const session = this._stateManager.getSessionState(params.channel);
    if (!session) {
      return [];
    }
    const sessionUri = isAhpChatChannel(params.channel) ? parseRequiredSessionUriFromChatUri(params.channel) : params.channel;
    const defaultChatUri = session.defaultChat ?? buildDefaultChatUri(sessionUri);
    const currentChatId = this._canonicalChatId(params.channel, sessionUri, defaultChatUri);
    const filter = sanitizeChatTitle(chatToken.typed).toLowerCase();
    const candidates = session.chats.filter((chat) => {
      if (this._canonicalChatId(chat.resource, sessionUri, defaultChatUri) === currentChatId) {
        return false;
      }
      if (chat.origin?.kind === ChatOriginKind.Tool) {
        return false;
      }
      if (chat.interactivity === ChatInteractivity.Hidden) {
        return false;
      }
      if (filter && !sanitizeChatTitle(chat.title).toLowerCase().includes(filter)) {
        return false;
      }
      return true;
    }).sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
    const items = [];
    for (const chat of candidates) {
      if (token.isCancellationRequested || items.length >= MAX_RESULTS) {
        break;
      }
      const endTurn = this._lastCompletedTurnId(chat.resource);
      if (!endTurn) {
        continue;
      }
      const sanitizedTitle = sanitizeChatTitle(chat.title);
      items.push({
        insertText: `#chat:${sanitizedTitle} `,
        rangeStart: chatToken.rangeStart,
        rangeEnd: chatToken.rangeEnd,
        attachment: {
          type: MessageAttachmentKind.Chat,
          resource: chat.resource,
          endTurn,
          label: sanitizedTitle
        }
      });
    }
    return items;
  }
  /**
   * Normalize a session/chat URI to a single identity string, collapsing every
   * alias of the session's default chat (the session URI, the default chat
   * URI, and the session's `defaultChat` field) onto one value.
   */
  _canonicalChatId(uri, sessionUri, defaultChatUri) {
    const normalizedDefault = URI.parse(defaultChatUri).toString();
    const normalized = URI.parse(uri).toString();
    if (normalized === URI.parse(sessionUri).toString() || isDefaultChatUri(uri)) {
      return normalizedDefault;
    }
    return normalized;
  }
  /**
   * The id of the chat's last completed turn, or `undefined` when it has none.
   * Uses the shared {@link resolveChatStateForUri} so it derives turns the same
   * way as the server-side chat-attachment resolver.
   */
  _lastCompletedTurnId(chatUri) {
    const turns = resolveChatStateForUri(this._stateManager, chatUri)?.turns;
    return turns && turns.length > 0 ? turns[turns.length - 1].id : void 0;
  }
}
export {
  AgentHostChatCompletionProvider,
  extractChatToken
};
