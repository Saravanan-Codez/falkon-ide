import { existsSync } from "fs";
import * as path from "../../../base/common/path.js";
import { UpdateType } from "../common/update.js";
function isInnoSetupInstall(executablePath = process.execPath, fileExists = existsSync) {
  return fileExists(path.join(path.dirname(executablePath), "unins000.exe"));
}
function getWin32UpdateType() {
  return isInnoSetupInstall() ? UpdateType.Setup : UpdateType.Archive;
}
export {
  getWin32UpdateType,
  isInnoSetupInstall
};
