import * as fs from "fs";
import * as cp from "child_process";
import { join } from "../../../base/common/path.js";
import { getWindowsBuildNumberAsync } from "../../../base/node/windowsVersion.js";
let hasWSLFeaturePromise;
async function hasWSLFeatureInstalled(refresh = false) {
  if (hasWSLFeaturePromise === void 0 || refresh) {
    hasWSLFeaturePromise = testWSLFeatureInstalled();
  }
  return hasWSLFeaturePromise;
}
async function testWSLFeatureInstalled() {
  const windowsBuildNumber = await getWindowsBuildNumberAsync();
  if (windowsBuildNumber === 0) {
    return false;
  }
  if (windowsBuildNumber >= 22e3) {
    const wslExePath = getWSLExecutablePath();
    if (wslExePath) {
      return new Promise((s) => {
        try {
          cp.execFile(wslExePath, ["--status"], (err) => s(!err));
        } catch (e) {
          s(false);
        }
      });
    }
  } else {
    const dllPath = getLxssManagerDllPath();
    if (dllPath) {
      try {
        if ((await fs.promises.stat(dllPath)).isFile()) {
          return true;
        }
      } catch (e) {
      }
    }
  }
  return false;
}
function getSystem32Path(subPath) {
  const systemRoot = process.env["SystemRoot"];
  if (systemRoot) {
    const is32ProcessOn64Windows = process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432");
    return join(systemRoot, is32ProcessOn64Windows ? "Sysnative" : "System32", subPath);
  }
  return void 0;
}
function getWSLExecutablePath() {
  return getSystem32Path("wsl.exe");
}
function getLxssManagerDllPath() {
  return getSystem32Path("lxss\\LxssManager.dll");
}
export {
  hasWSLFeatureInstalled
};
