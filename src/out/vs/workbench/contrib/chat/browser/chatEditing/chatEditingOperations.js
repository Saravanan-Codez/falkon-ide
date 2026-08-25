import { StringSHA1 } from "../../../../../base/common/hash.js";
import { LocalChatSessionUri } from "../../common/model/chatUri.js";
var FileOperationType = /* @__PURE__ */ ((FileOperationType2) => {
  FileOperationType2["Create"] = "create";
  FileOperationType2["Delete"] = "delete";
  FileOperationType2["Rename"] = "rename";
  FileOperationType2["TextEdit"] = "textEdit";
  FileOperationType2["NotebookEdit"] = "notebookEdit";
  return FileOperationType2;
})(FileOperationType || {});
function getKeyForChatSessionResource(chatSessionResource) {
  const sessionId = LocalChatSessionUri.parseLocalSessionId(chatSessionResource);
  if (sessionId) {
    return sessionId;
  }
  const sha = new StringSHA1();
  sha.update(chatSessionResource.toString());
  return sha.digest();
}
export {
  FileOperationType,
  getKeyForChatSessionResource
};
