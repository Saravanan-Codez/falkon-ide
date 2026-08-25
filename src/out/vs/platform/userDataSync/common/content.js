import { setProperty } from "../../../base/common/jsonEdit.js";
function edit(content, originalPath, value, formattingOptions) {
  const edit2 = setProperty(content, originalPath, value, formattingOptions)[0];
  if (edit2) {
    content = content.substring(0, edit2.offset) + edit2.content + content.substring(edit2.offset + edit2.length);
  }
  return content;
}
function getLineStartOffset(content, eol, atOffset) {
  let lineStartingOffset = atOffset;
  while (lineStartingOffset >= 0) {
    if (content.charAt(lineStartingOffset) === eol.charAt(eol.length - 1)) {
      if (eol.length === 1) {
        return lineStartingOffset + 1;
      }
    }
    lineStartingOffset--;
    if (eol.length === 2) {
      if (lineStartingOffset >= 0 && content.charAt(lineStartingOffset) === eol.charAt(0)) {
        return lineStartingOffset + 2;
      }
    }
  }
  return 0;
}
function getLineEndOffset(content, eol, atOffset) {
  let lineEndOffset = atOffset;
  while (lineEndOffset >= 0) {
    if (content.charAt(lineEndOffset) === eol.charAt(eol.length - 1)) {
      if (eol.length === 1) {
        return lineEndOffset;
      }
    }
    lineEndOffset++;
    if (eol.length === 2) {
      if (lineEndOffset >= 0 && content.charAt(lineEndOffset) === eol.charAt(1)) {
        return lineEndOffset;
      }
    }
  }
  return content.length - 1;
}
export {
  edit,
  getLineEndOffset,
  getLineStartOffset
};
