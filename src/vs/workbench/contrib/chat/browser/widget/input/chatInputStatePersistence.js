import { parse, stringify } from "../../../../../../base/common/marshalling.js";
import { IChatRequestVariableEntry } from "../../../common/attachments/chatVariableEntries.js";
function serializeUntitledInputState(value) {
  return stringify(value && { ...value, attachments: [] });
}
function deserializeUntitledInputState(value) {
  return parse(value);
}
function serializeUntitledInputAttachments(attachments) {
  return stringify(attachments.map(IChatRequestVariableEntry.toExport));
}
function deserializeUntitledInputAttachments(value) {
  return parse(value).map(IChatRequestVariableEntry.fromExport);
}
export {
  deserializeUntitledInputAttachments,
  deserializeUntitledInputState,
  serializeUntitledInputAttachments,
  serializeUntitledInputState
};
