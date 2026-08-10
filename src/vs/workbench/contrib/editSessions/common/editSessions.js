import { decodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { localize, localize2 } from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { StringSHA1 } from "../../../../base/common/hash.js";
const EDIT_SESSION_SYNC_CATEGORY = localize2("cloud changes", "Cloud Changes");
const IEditSessionsStorageService = createDecorator("IEditSessionsStorageService");
const IEditSessionsLogService = createDecorator("IEditSessionsLogService");
var ChangeType = /* @__PURE__ */ ((ChangeType2) => {
  ChangeType2[ChangeType2["Addition"] = 1] = "Addition";
  ChangeType2[ChangeType2["Deletion"] = 2] = "Deletion";
  return ChangeType2;
})(ChangeType || {});
var FileType = /* @__PURE__ */ ((FileType2) => {
  FileType2[FileType2["File"] = 1] = "File";
  return FileType2;
})(FileType || {});
const EditSessionSchemaVersion = 3;
const EDIT_SESSIONS_SIGNED_IN_KEY = "editSessionsSignedIn";
const EDIT_SESSIONS_SIGNED_IN = new RawContextKey(EDIT_SESSIONS_SIGNED_IN_KEY, false);
const EDIT_SESSIONS_PENDING_KEY = "editSessionsPending";
const EDIT_SESSIONS_PENDING = new RawContextKey(EDIT_SESSIONS_PENDING_KEY, false);
const EDIT_SESSIONS_CONTAINER_ID = "workbench.view.editSessions";
const EDIT_SESSIONS_DATA_VIEW_ID = "workbench.views.editSessions.data";
const EDIT_SESSIONS_TITLE = localize2("cloud changes", "Cloud Changes");
const EDIT_SESSIONS_VIEW_ICON = registerIcon("edit-sessions-view-icon", Codicon.cloudDownload, localize("editSessionViewIcon", "View icon of the cloud changes view."));
const EDIT_SESSIONS_SHOW_VIEW = new RawContextKey("editSessionsShowView", false);
const EDIT_SESSIONS_SCHEME = "vscode-edit-sessions";
function decodeEditSessionFileContent(version, content) {
  switch (version) {
    case 1:
      return VSBuffer.fromString(content);
    case 2:
      return decodeBase64(content);
    default:
      throw new Error("Upgrade to a newer version to decode this content.");
  }
}
function hashedEditSessionId(editSessionId) {
  const sha1 = new StringSHA1();
  sha1.update(editSessionId);
  return sha1.digest();
}
const editSessionsLogId = "editSessions";
export {
  ChangeType,
  EDIT_SESSIONS_CONTAINER_ID,
  EDIT_SESSIONS_DATA_VIEW_ID,
  EDIT_SESSIONS_PENDING,
  EDIT_SESSIONS_PENDING_KEY,
  EDIT_SESSIONS_SCHEME,
  EDIT_SESSIONS_SHOW_VIEW,
  EDIT_SESSIONS_SIGNED_IN,
  EDIT_SESSIONS_SIGNED_IN_KEY,
  EDIT_SESSIONS_TITLE,
  EDIT_SESSIONS_VIEW_ICON,
  EDIT_SESSION_SYNC_CATEGORY,
  EditSessionSchemaVersion,
  FileType,
  IEditSessionsLogService,
  IEditSessionsStorageService,
  decodeEditSessionFileContent,
  editSessionsLogId,
  hashedEditSessionId
};
