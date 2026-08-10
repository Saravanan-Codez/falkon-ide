import * as os from "os";
import { isWindows } from "../common/platform.js";
let versionInfo;
async function initWindowsVersionInfo() {
  if (versionInfo) {
    return;
  }
  if (!isWindows) {
    versionInfo = { release: os.release(), buildNumber: 0 };
    return;
  }
  let buildNumber;
  let release;
  try {
    const Registry = await import("@vscode/windows-registry");
    const versionKey = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion";
    const build = Registry.GetStringRegKey("HKEY_LOCAL_MACHINE", versionKey, "CurrentBuild");
    if (build !== void 0) {
      buildNumber = parseInt(build, 10);
      if (isNaN(buildNumber)) {
        buildNumber = void 0;
      }
    }
    const major = Registry.GetDWORDRegKey("HKEY_LOCAL_MACHINE", versionKey, "CurrentMajorVersionNumber");
    const minor = Registry.GetDWORDRegKey("HKEY_LOCAL_MACHINE", versionKey, "CurrentMinorVersionNumber");
    if (major !== void 0 && minor !== void 0 && build !== void 0) {
      release = `${major}.${minor}.${build}`;
    }
  } catch {
  } finally {
    versionInfo = {
      release: release || os.release(),
      buildNumber: buildNumber || getWindowsBuildNumberFromOsRelease()
    };
  }
}
async function getWindowsRelease() {
  if (!versionInfo) {
    await initWindowsVersionInfo();
  }
  return versionInfo.release;
}
async function getWindowsBuildNumberAsync() {
  if (!versionInfo) {
    await initWindowsVersionInfo();
  }
  return versionInfo.buildNumber;
}
function getWindowsBuildNumberSync() {
  if (versionInfo) {
    return versionInfo.buildNumber;
  } else {
    return isWindows ? getWindowsBuildNumberFromOsRelease() : 0;
  }
}
function getWindowsReleaseSync() {
  return versionInfo?.release ?? os.release();
}
function getWindowsBuildNumberFromOsRelease() {
  const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(os.release());
  if (osVersion && osVersion.length === 4) {
    return parseInt(osVersion[3], 10);
  }
  return 0;
}
export {
  getWindowsBuildNumberAsync,
  getWindowsBuildNumberSync,
  getWindowsRelease,
  getWindowsReleaseSync,
  initWindowsVersionInfo
};
