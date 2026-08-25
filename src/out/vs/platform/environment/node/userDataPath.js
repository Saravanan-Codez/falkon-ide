import { homedir } from "os";
import { resolve, isAbsolute, join } from "path";
const cwd = process.env["VSCODE_CWD"] || process.cwd();
function getUserDataPath(cliArgs, productName) {
  const userDataPath = doGetUserDataPath(cliArgs, productName);
  const pathsToResolve = [userDataPath];
  if (!isAbsolute(userDataPath)) {
    pathsToResolve.unshift(cwd);
  }
  return resolve(...pathsToResolve);
}
function doGetUserDataPath(cliArgs, productName) {
  if (process.env["VSCODE_DEV"]) {
    productName = "code-oss-dev";
  }
  const portablePath = process.env["VSCODE_PORTABLE"];
  if (portablePath) {
    return join(portablePath, "user-data");
  }
  const appDataPath = process.env["VSCODE_APPDATA"];
  if (appDataPath) {
    return join(appDataPath, productName);
  }
  const cliPath = cliArgs["user-data-dir"];
  if (cliPath) {
    return cliPath;
  }
  return getDefaultUserDataPath(productName);
}
function getDefaultUserDataPath(productName) {
  let appDataPath;
  switch (process.platform) {
    case "win32":
      appDataPath = process.env["APPDATA"];
      if (!appDataPath) {
        const userProfile = process.env["USERPROFILE"];
        if (typeof userProfile !== "string") {
          throw new Error("Windows: Unexpected undefined %USERPROFILE% environment variable");
        }
        appDataPath = join(userProfile, "AppData", "Roaming");
      }
      break;
    case "darwin":
      appDataPath = join(homedir(), "Library", "Application Support");
      break;
    case "linux":
      appDataPath = process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config");
      break;
    default:
      throw new Error("Platform not supported");
  }
  return join(appDataPath, productName);
}
export {
  getDefaultUserDataPath,
  getUserDataPath
};
