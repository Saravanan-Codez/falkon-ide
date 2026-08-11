import { posix as pathPosix, win32 as pathWin32 } from "../../../base/common/path.js";
import * as platform from "../../../base/common/platform.js";
function isZsh(shell) {
  if (platform.OS === platform.OperatingSystem.Windows) {
    return /^zsh(?:\.exe)?$/i.test(pathWin32.basename(shell));
  }
  return /^zsh$/.test(pathPosix.basename(shell));
}
export {
  isZsh
};
