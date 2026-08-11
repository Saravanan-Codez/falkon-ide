import { createHash } from "crypto";
import { Schemas } from "../../../base/common/network.js";
import { isLinux, isMacintosh, isWindows } from "../../../base/common/platform.js";
import { originalFSPath } from "../../../base/common/resources.js";
const NON_EMPTY_WORKSPACE_ID_LENGTH = 128 / 4;
function getWorkspaceIdentifier(configPath) {
  function getWorkspaceId() {
    let configPathStr = configPath.scheme === Schemas.file ? originalFSPath(configPath) : configPath.toString();
    if (!isLinux) {
      configPathStr = configPathStr.toLowerCase();
    }
    return createHash("md5").update(configPathStr).digest("hex");
  }
  return {
    id: getWorkspaceId(),
    configPath
  };
}
function getSingleFolderWorkspaceIdentifier(folderUri, folderStat) {
  function getFolderId() {
    if (folderUri.scheme !== Schemas.file) {
      return createHash("md5").update(folderUri.toString()).digest("hex");
    }
    if (!folderStat) {
      return void 0;
    }
    let ctime;
    if (isLinux) {
      ctime = folderStat.ino;
    } else if (isMacintosh) {
      ctime = folderStat.birthtime.getTime();
    } else if (isWindows) {
      if (typeof folderStat.birthtimeMs === "number") {
        ctime = Math.floor(folderStat.birthtimeMs);
      } else {
        ctime = folderStat.birthtime.getTime();
      }
    }
    return createHash("md5").update(folderUri.fsPath).update(ctime ? String(ctime) : "").digest("hex");
  }
  const folderId = getFolderId();
  if (typeof folderId === "string") {
    return {
      id: folderId,
      uri: folderUri
    };
  }
  return void 0;
}
function createEmptyWorkspaceIdentifier() {
  return {
    id: (Date.now() + Math.round(Math.random() * 1e3)).toString()
  };
}
export {
  NON_EMPTY_WORKSPACE_ID_LENGTH,
  createEmptyWorkspaceIdentifier,
  getSingleFolderWorkspaceIdentifier,
  getWorkspaceIdentifier
};
