import { isString } from "../../../../base/common/types.js";
import { MessageAttachmentKind } from "../state/protocol/state.js";
const AgentFeedbackAttachmentDisplayKind = "agentFeedback";
const AgentFeedbackAttachmentMetadataKey = "agentFeedback";
function isAgentFeedbackAttachment(attachment) {
  return attachment.type === MessageAttachmentKind.Simple && attachment.displayKind === AgentFeedbackAttachmentDisplayKind;
}
function isAgentFeedbackAnnotationsAttachment(attachment) {
  return attachment.type === MessageAttachmentKind.Annotations && attachment.displayKind === AgentFeedbackAttachmentDisplayKind;
}
function renderAgentFeedbackAnnotationsAttachment(attachment) {
  const ids = attachment.annotationIds?.filter(isString) ?? [];
  if (ids.length === 0) {
    return void 0;
  }
  const idList = ids.map((id) => `- ${id}`).join("\n");
  return `The user attached specific feedback comments to act on (comment ids):
${idList}

Use the \`listComments\` tool to read their content and focus on these comments.`;
}
function getAgentFeedbackAttachmentMetadata(attachment) {
  if (!isAgentFeedbackAttachment(attachment) && !isAgentFeedbackAnnotationsAttachment(attachment)) {
    return void 0;
  }
  const metadata = attachment._meta?.[AgentFeedbackAttachmentMetadataKey];
  if (!isRecord(metadata) || !isString(metadata.sessionResource) || !Array.isArray(metadata.feedbackItems)) {
    return void 0;
  }
  const feedbackItems = [];
  for (const item of metadata.feedbackItems) {
    const parsedItem = parseAgentFeedbackAttachmentItem(item);
    if (parsedItem) {
      feedbackItems.push(parsedItem);
    }
  }
  return {
    sessionResource: metadata.sessionResource,
    feedbackItems
  };
}
function parseAgentFeedbackAttachmentItem(item) {
  if (!isRecord(item) || !isString(item.id) || !isString(item.text) || !isString(item.resourceUri)) {
    return void 0;
  }
  const range = parseTextRange(item.range);
  if (!range) {
    return void 0;
  }
  const replies = parseReplies(item.replies);
  return {
    id: item.id,
    text: item.text,
    resourceUri: item.resourceUri,
    range,
    replies
  };
}
function parseReplies(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const replies = value.filter(isString);
  return replies.length > 0 ? replies : void 0;
}
function parseTextRange(range) {
  if (!isRecord(range) || !isRecord(range.start) || !isRecord(range.end)) {
    return void 0;
  }
  const start = parseTextPosition(range.start);
  const end = parseTextPosition(range.end);
  if (!start || !end) {
    return void 0;
  }
  return { start, end };
}
function parseTextPosition(position) {
  if (typeof position.line !== "number" || typeof position.character !== "number") {
    return void 0;
  }
  return { line: position.line, character: position.character };
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
export {
  AgentFeedbackAttachmentDisplayKind,
  AgentFeedbackAttachmentMetadataKey,
  getAgentFeedbackAttachmentMetadata,
  isAgentFeedbackAnnotationsAttachment,
  isAgentFeedbackAttachment,
  renderAgentFeedbackAnnotationsAttachment
};
