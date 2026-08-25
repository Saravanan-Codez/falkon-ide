import { ResponsePartKind } from "./state/sessionState.js";
function renderResponseMarkdown(parts) {
  const segments = [];
  for (const part of parts) {
    if (part.kind === ResponsePartKind.Markdown) {
      const text = part.content.trim();
      if (text) {
        segments.push(text);
      }
    }
  }
  return segments.join("\n\n");
}
function buildConversationContext(turns, options) {
  const blocks = [];
  for (const turn of turns) {
    const userText = turn.message.text.trim();
    const responseText = renderResponseMarkdown(turn.responseParts);
    if (!userText && !responseText) {
      continue;
    }
    blocks.push(responseText ? `User request:
${userText}

Agent response:
${responseText}` : `User request:
${userText}`);
  }
  if (blocks.length === 0) {
    return void 0;
  }
  const conversation = blocks.join("\n\n---\n\n");
  const truncatedConversation = conversation.length > options.maxChars ? truncateMiddle(conversation, options.maxChars) : conversation;
  return `${options.framing ?? ""}${truncatedConversation}`;
}
function truncateMiddle(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  const marker = "\n...\n";
  if (maxChars <= marker.length) {
    return text.slice(0, maxChars);
  }
  const keep = maxChars - marker.length;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${text.slice(0, head)}${marker}${text.slice(text.length - tail)}`;
}
export {
  buildConversationContext,
  renderResponseMarkdown,
  truncateMiddle
};
