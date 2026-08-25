import { URI } from "../../../../../../base/common/uri.js";
import { createChatReferenceVariableEntry } from "../../../common/attachments/chatVariableEntries.js";
function restoreChatReferenceVariableEntryFromAttachment(attachment, messageText) {
  const range = messageText !== void 0 ? textRangeToOffsetRange(messageText, attachment.range) : void 0;
  return createChatReferenceVariableEntry(URI.parse(attachment.resource), attachment.endTurn, attachment.label, attachment._meta, range);
}
function textRangeToOffsetRange(messageText, range) {
  if (!range) {
    return void 0;
  }
  const start = positionToOffset(messageText, range.start.line, range.start.character);
  const endExclusive = positionToOffset(messageText, range.end.line, range.end.character);
  if (start < 0 || endExclusive > messageText.length || start > endExclusive) {
    return void 0;
  }
  return { start, endExclusive };
}
function positionToOffset(text, line, character) {
  let offset = 0;
  for (let currentLine = 0; currentLine < line; currentLine++) {
    const newline = text.indexOf("\n", offset);
    if (newline === -1) {
      return text.length;
    }
    offset = newline + 1;
  }
  return Math.min(offset + Math.max(0, character), text.length);
}
export {
  restoreChatReferenceVariableEntryFromAttachment
};
