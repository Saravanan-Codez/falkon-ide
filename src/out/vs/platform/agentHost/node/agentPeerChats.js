import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { renderResponseMarkdown, truncateMiddle } from "../common/agentHostConversationContext.js";
const SIDE_CHAT_CONTEXT_START = "<side-chat-context>";
const SIDE_CHAT_CONTEXT_END = "</side-chat-context>";
const SIDE_CHAT_CONTEXT_LENGTH_PREFIX = "length=";
const SIDE_CHAT_GUIDANCE = "This is a side conversation. Prefer explanation over action; do not make changes or carry out work unless the user explicitly asks.";
const MAX_SIDE_CHAT_CONTEXT_CHARS = 2e4;
function buildSideChatSourceContext(turns, activeTurn) {
  const blocks = [];
  for (const turn of turns) {
    const block = buildSideChatContextBlock(turn.message.text, renderResponseMarkdown(turn.responseParts));
    if (block) {
      blocks.push(block);
    }
  }
  if (activeTurn) {
    const block = buildSideChatContextBlock(activeTurn.message.text, void 0);
    if (block) {
      blocks.push(block);
    }
  }
  if (blocks.length === 0) {
    return void 0;
  }
  const conversation = blocks.join("\n\n---\n\n");
  return conversation.length > MAX_SIDE_CHAT_CONTEXT_CHARS ? truncateMiddle(conversation, MAX_SIDE_CHAT_CONTEXT_CHARS) : conversation;
}
function getSideChatPartialResponse(activeTurn) {
  if (!activeTurn) {
    return void 0;
  }
  const responseMarkdown = renderResponseMarkdown(activeTurn.responseParts);
  return responseMarkdown ? truncateMiddle(responseMarkdown, MAX_SIDE_CHAT_CONTEXT_CHARS) : void 0;
}
function buildBoundedSideChatSourceContext(turns, turnId, activeTurn) {
  if (activeTurn?.id === turnId) {
    return buildSideChatSourceContext(turns, activeTurn);
  }
  const turnIndex = turns.findIndex((turn) => turn.id === turnId);
  return turnIndex === -1 ? void 0 : buildSideChatSourceContext(turns.slice(0, turnIndex + 1));
}
function injectSideChatContext(prompt, partialResponse, sourceContext, selectionText) {
  const context = [SIDE_CHAT_GUIDANCE];
  if (selectionText) {
    context.push(
      "",
      "Selected text:",
      "",
      selectionText
    );
  }
  if (sourceContext) {
    context.push(
      "",
      "Source conversation up to the branching point:",
      "",
      sourceContext
    );
  }
  if (partialResponse) {
    context.push(
      "",
      "The side chat was created while the source assistant was still responding.",
      "The user-visible response had produced the following text at that moment:",
      "",
      partialResponse
    );
  }
  const contextBody = context.join("\n");
  return [SIDE_CHAT_CONTEXT_START, `${SIDE_CHAT_CONTEXT_LENGTH_PREFIX}${contextBody.length}`, contextBody, SIDE_CHAT_CONTEXT_END, "", prompt].join("\n");
}
function prepareSideChatPrompt(prompt, turns, sideChat) {
  if (!sideChat || turns.length > sideChat.inheritedTurnCount) {
    return prompt;
  }
  const selectedSourceTurn = turns.find((turn) => turn.id === sideChat.turnId);
  const sourceContext = selectedSourceTurn ? void 0 : sideChat.context;
  let partialResponse = sideChat.partialResponse;
  if (partialResponse) {
    const inheritedResponse = selectedSourceTurn ? renderResponseMarkdown(selectedSourceTurn.responseParts) : "";
    if (inheritedResponse.includes(partialResponse)) {
      partialResponse = void 0;
    }
  }
  return injectSideChatContext(prompt, partialResponse, sourceContext, sideChat.selection?.text);
}
function buildSideChatContextBlock(message, response) {
  const userText = message.trim();
  const responseText = response?.trim();
  if (!userText && !responseText) {
    return void 0;
  }
  return responseText ? `User request:
${userText}

Agent response:
${responseText}` : `User request:
${userText}`;
}
function stripSideChatContext(turns, sideChat) {
  if (!sideChat || turns.length === 0) {
    return turns;
  }
  const first = turns[0];
  const text = first.message.text;
  if (!text.startsWith(SIDE_CHAT_CONTEXT_START)) {
    return turns;
  }
  const lengthHeaderStart = SIDE_CHAT_CONTEXT_START.length + 1;
  if (text.slice(lengthHeaderStart).startsWith(SIDE_CHAT_CONTEXT_LENGTH_PREFIX)) {
    const lengthLineEnd = text.indexOf("\n", lengthHeaderStart);
    const parsedLength = lengthLineEnd > 0 ? Number.parseInt(text.slice(lengthHeaderStart + SIDE_CHAT_CONTEXT_LENGTH_PREFIX.length, lengthLineEnd), 10) : Number.NaN;
    if (Number.isInteger(parsedLength) && parsedLength >= 0) {
      const contextStart = lengthLineEnd + 1;
      const contextEnd = contextStart + parsedLength;
      if (text.slice(contextEnd, contextEnd + SIDE_CHAT_CONTEXT_END.length + 1) === `
${SIDE_CHAT_CONTEXT_END}`) {
        const userPrompt2 = text.slice(contextEnd + SIDE_CHAT_CONTEXT_END.length + 1).trimStart();
        return [{ ...first, message: { ...first.message, text: userPrompt2 } }, ...turns.slice(1)];
      }
    }
  }
  const endIndex = text.lastIndexOf(SIDE_CHAT_CONTEXT_END);
  if (endIndex < 0) {
    return turns;
  }
  const userPrompt = text.slice(endIndex + SIDE_CHAT_CONTEXT_END.length).trimStart();
  return [{ ...first, message: { ...first.message, text: userPrompt } }, ...turns.slice(1)];
}
function encodeProviderData(backing) {
  return JSON.stringify(backing);
}
function decodeProviderData(providerData) {
  try {
    const value = JSON.parse(providerData);
    if (!value || typeof value !== "object") {
      return void 0;
    }
    const { sdkSessionId, model } = value;
    if (typeof sdkSessionId !== "string" || !sdkSessionId) {
      return void 0;
    }
    const validModel = model && typeof model === "object" && typeof model.id === "string" ? model : void 0;
    const sideChat = value.sideChat;
    const validSelection = sideChat?.selection && typeof sideChat.selection === "object" && typeof sideChat.selection.text === "string" && (sideChat.selection.responsePartId === void 0 || typeof sideChat.selection.responsePartId === "string") ? {
      text: sideChat.selection.text,
      ...sideChat.selection.responsePartId ? { responsePartId: sideChat.selection.responsePartId } : {}
    } : void 0;
    const validSideChat = sideChat && typeof sideChat.source === "string" && typeof sideChat.turnId === "string" && (sideChat.providerAnchorTurnId === void 0 || typeof sideChat.providerAnchorTurnId === "string") && typeof sideChat.inheritedTurnCount === "number" && (sideChat.partialResponse === void 0 || typeof sideChat.partialResponse === "string") && (sideChat.context === void 0 || typeof sideChat.context === "string") ? {
      source: sideChat.source,
      turnId: sideChat.turnId,
      ...validSelection ? { selection: validSelection } : {},
      ...sideChat.providerAnchorTurnId ? { providerAnchorTurnId: sideChat.providerAnchorTurnId } : {},
      inheritedTurnCount: sideChat.inheritedTurnCount,
      ...sideChat.partialResponse ? { partialResponse: sideChat.partialResponse } : {},
      ...sideChat.context ? { context: sideChat.context } : {}
    } : void 0;
    return { sdkSessionId, ...validModel ? { model: validModel } : {}, ...validSideChat ? { sideChat: validSideChat } : {} };
  } catch {
    return void 0;
  }
}
class AgentSessionEntry extends Disposable {
  constructor(session) {
    super();
    /** All chats of the session (default + peers) as leaf entries, keyed by chat-URI string. */
    this._chats = this._register(new DisposableMap());
    if (session) {
      this._ownSession = session;
      this._register(session);
    }
  }
  /** This leaf's own chat session, or `undefined` for a bare container. */
  get ownSession() {
    return this._ownSession;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
  // ---- Uniform chat map (default + peers) --------------------------------
  /** Register the session's default (main) chat leaf under its chat-URI key. */
  setDefaultChat(chatKey, entry) {
    this._chats.set(chatKey, entry);
    this._defaultChatKey = chatKey;
  }
  /** Dispose the default chat leaf (e.g. a config-driven restart) while keeping peer chats. */
  clearDefaultChat() {
    if (this._defaultChatKey !== void 0) {
      this._chats.deleteAndDispose(this._defaultChatKey);
      this._defaultChatKey = void 0;
    }
  }
  /** The session's materialized default (main) chat, or `undefined` while provisional. */
  get defaultChat() {
    return this._defaultChatKey !== void 0 ? this._chats.get(this._defaultChatKey)?.ownSession : void 0;
  }
  /** Uniform lookup: the chat's session (default OR peer) by its chat-URI key. */
  getChat(chatKey) {
    return this._chats.get(chatKey)?.ownSession;
  }
  /** Uniform lookup with default-vs-peer identity from the entry that resolved the chat. */
  resolveChat(chatKey) {
    const chatSession = this._chats.get(chatKey)?.ownSession;
    if (!chatSession) {
      return void 0;
    }
    return { chatSession, isDefault: chatKey === this._defaultChatKey };
  }
  /** Every live chat session — the default chat plus all peers. */
  allChatSessions() {
    const sessions = [];
    for (const entry of this._chats.values()) {
      if (entry.ownSession) {
        sessions.push(entry.ownSession);
      }
    }
    return sessions;
  }
  // ---- Peer chats (every chat except the default) ------------------------
  getPeerChat(chatKey) {
    return chatKey === this._defaultChatKey ? void 0 : this._chats.get(chatKey)?.ownSession;
  }
  hasPeerChat(chatKey) {
    return chatKey !== this._defaultChatKey && this._chats.has(chatKey);
  }
  registerPeerChat(chatKey, entry) {
    this._chats.set(chatKey, entry);
  }
  disposePeerChat(chatKey) {
    if (chatKey !== this._defaultChatKey) {
      this._chats.deleteAndDispose(chatKey);
    }
  }
  peerChatKeys() {
    return [...this._chats.keys()].filter((key) => key !== this._defaultChatKey);
  }
  peerChatSessions() {
    const sessions = [];
    for (const key of this._chats.keys()) {
      if (key === this._defaultChatKey) {
        continue;
      }
      const session = this._chats.get(key)?.ownSession;
      if (session) {
        sessions.push(session);
      }
    }
    return sessions;
  }
}
export {
  AgentSessionEntry,
  MAX_SIDE_CHAT_CONTEXT_CHARS,
  buildBoundedSideChatSourceContext,
  buildSideChatSourceContext,
  decodeProviderData,
  encodeProviderData,
  getSideChatPartialResponse,
  injectSideChatContext,
  prepareSideChatPrompt,
  stripSideChatContext
};
