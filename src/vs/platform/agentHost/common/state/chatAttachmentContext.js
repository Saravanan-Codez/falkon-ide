import { MessageAttachmentKind, ResponsePartKind } from "./protocol/state.js";
import { SessionServerToolName } from "../serverToolNames.js";
const MAX_CHAT_ATTACHMENT_EXCERPT_CHARS = 1e3;
function boundChatTranscriptTurns(turns, endTurn) {
  if (endTurn === void 0) {
    return turns;
  }
  const index = turns.findIndex((t) => t.id === endTurn);
  if (index < 0) {
    throw new Error(`Chat attachment endTurn ${endTurn} was not found in the retained transcript.`);
  }
  return turns.slice(0, index + 1);
}
function formatChatTranscript(turns) {
  const blocks = [];
  for (const turn of turns) {
    const userText = turn.message?.text?.trim();
    if (userText) {
      blocks.push(`User: ${userText}`);
    }
    const assistantText = turn.responseParts.map((part) => part.kind === ResponsePartKind.Markdown ? part.content : "").join("").trim();
    if (assistantText) {
      blocks.push(`Assistant: ${assistantText}`);
    }
  }
  return blocks.join("\n\n");
}
function truncateFront(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}
function buildChatAttachmentPointer(label, resource, openLink, transcript) {
  const intro = openLink ? `The user referenced another chat, "${label}". That chat is identified by the link ${openLink}. To read its full transcript, call the ${SessionServerToolName.GetSessionContext} server tool with its "session" argument set to that link.` : `The user referenced another chat, "${label}", identified by ${resource}.`;
  if (!transcript) {
    return `${intro}

The referenced chat has no transcript content up to the selected turn.`;
  }
  if (transcript.length > MAX_CHAT_ATTACHMENT_EXCERPT_CHARS) {
    const excerpt = truncateFront(transcript, MAX_CHAT_ATTACHMENT_EXCERPT_CHARS);
    return `${intro}

The excerpt below is only the tail end of that transcript up to the selected turn (about the last ${MAX_CHAT_ATTACHMENT_EXCERPT_CHARS} characters; the earlier part was omitted to keep the most recent content):

${excerpt}`;
  }
  return `${intro}

The excerpt below is that chat's full transcript up to the selected turn:

${transcript}`;
}
function resolveChatAttachment(attachment, sourceTurns, openLink) {
  const bounded = boundChatTranscriptTurns(sourceTurns, attachment.endTurn);
  const transcript = formatChatTranscript(bounded);
  const modelRepresentation = buildChatAttachmentPointer(attachment.label, attachment.resource.toString(), openLink, transcript);
  return {
    type: MessageAttachmentKind.Simple,
    label: attachment.label,
    modelRepresentation,
    ...attachment.range !== void 0 ? { range: attachment.range } : {}
  };
}
export {
  MAX_CHAT_ATTACHMENT_EXCERPT_CHARS,
  boundChatTranscriptTurns,
  formatChatTranscript,
  resolveChatAttachment
};
