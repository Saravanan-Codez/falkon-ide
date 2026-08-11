const attachmentDisplayKindParameter = "x-vscode-display-kind=";
const simpleAttachmentMimeType = "text/x-vscode-simple-attachment";
function addSimpleAttachmentDisplayKindToMimeType(attachment) {
  if (attachment.displayKind === void 0) {
    return "text/plain";
  }
  return `${simpleAttachmentMimeType}; ${attachmentDisplayKindParameter}${encodeURIComponent(attachment.displayKind)}`;
}
function readSimpleAttachmentDisplayKindFromMimeType(mimeType) {
  const parameter = mimeType.split(";").map((part) => part.trim()).find((part) => part.startsWith(attachmentDisplayKindParameter));
  if (!parameter) {
    return void 0;
  }
  try {
    return decodeURIComponent(parameter.slice(attachmentDisplayKindParameter.length));
  } catch {
    return void 0;
  }
}
export {
  addSimpleAttachmentDisplayKindToMimeType,
  readSimpleAttachmentDisplayKindFromMimeType
};
