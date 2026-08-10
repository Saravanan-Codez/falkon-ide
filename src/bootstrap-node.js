import * as path from "node:path";
import * as fs from "node:fs";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
const isWindows = process.platform === "win32";
if (process.platform === "linux") {
  Buffer.poolSize = 8 * 1024;
}
Error.stackTraceLimit = 100;
if (!process.env["VSCODE_HANDLES_SIGPIPE"]) {
  let didLogAboutSIGPIPE = false;
  process.on("SIGPIPE", () => {
    if (!didLogAboutSIGPIPE) {
      didLogAboutSIGPIPE = true;
      console.error(new Error(`Unexpected SIGPIPE`));
    }
  });
}
function setupCurrentWorkingDirectory() {
  try {
    if (typeof process.env["VSCODE_CWD"] !== "string") {
      process.env["VSCODE_CWD"] = process.cwd();
    }
    if (process.platform === "win32") {
      process.chdir(path.dirname(process.execPath));
    }
  } catch (err) {
    console.error(err);
  }
}
setupCurrentWorkingDirectory();
function enableASARSupport() {
  if (!process.env["ELECTRON_RUN_AS_NODE"] && !process.versions["electron"]) {
    return;
  }
  if (process.env["VSCODE_DEV"]) {
    return;
  }
  const normalizeDriveLetter = (p) => {
    if (isWindows && p.length >= 2 && p.charCodeAt(1) === 58) {
      const code = p.charCodeAt(0);
      if (code >= 65 && code <= 90 || code >= 97 && code <= 122) {
        return p[0].toLowerCase() + p.slice(1);
      }
    }
    return p;
  };
  const NODE_MODULES_PATH = normalizeDriveLetter(path.join(import.meta.dirname, "../node_modules"));
  const Module = require2("node:module");
  const originalResolveLookupPaths = Module._resolveLookupPaths;
  Module._resolveLookupPaths = function(request, parent) {
    const paths = originalResolveLookupPaths(request, parent);
    if (Array.isArray(paths)) {
      for (let i = 0, len = paths.length; i < len; i++) {
        if (normalizeDriveLetter(paths[i]) === NODE_MODULES_PATH) {
          paths.splice(i, 0, `${paths[i]}.asar`);
          break;
        }
      }
    }
    return paths;
  };
}
enableASARSupport();
function devInjectNodeModuleLookupPath(injectPath) {
  if (!process.env["VSCODE_DEV"]) {
    return;
  }
  if (!injectPath) {
    throw new Error("Missing injectPath");
  }
  const Module = require2("node:module");
  Module.register("./bootstrap-import.js", { parentURL: import.meta.url, data: injectPath });
}
function removeGlobalNodeJsModuleLookupPaths() {
  if (typeof process?.versions?.electron === "string") {
    return;
  }
  const Module = require2("module");
  const globalPaths = Module.globalPaths;
  const originalResolveLookupPaths = Module._resolveLookupPaths;
  Module._resolveLookupPaths = function(moduleName, parent) {
    const paths = originalResolveLookupPaths(moduleName, parent);
    if (Array.isArray(paths)) {
      let commonSuffixLength = 0;
      while (commonSuffixLength < paths.length && paths[paths.length - 1 - commonSuffixLength] === globalPaths[globalPaths.length - 1 - commonSuffixLength]) {
        commonSuffixLength++;
      }
      return paths.slice(0, paths.length - commonSuffixLength);
    }
    return paths;
  };
  const originalNodeModulePaths = Module._nodeModulePaths;
  Module._nodeModulePaths = function(from) {
    let paths = originalNodeModulePaths(from);
    if (!isWindows) {
      return paths;
    }
    const isDrive = (p) => p.length >= 3 && p.endsWith(":\\");
    if (!isDrive(from)) {
      paths = paths.filter((p) => !isDrive(path.dirname(p)));
    }
    if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
      const userDir = path.dirname(path.join(process.env.HOMEDRIVE, process.env.HOMEPATH));
      const isUsersDir = (p) => path.relative(p, userDir).length === 0;
      if (!isUsersDir(from)) {
        paths = paths.filter((p) => !isUsersDir(path.dirname(p)));
      }
    }
    return paths;
  };
}
function configurePortable(product) {
  const appRoot = path.dirname(import.meta.dirname);
  function getApplicationPath() {
    if (process.env["VSCODE_DEV"]) {
      return appRoot;
    }
    if (process.platform === "darwin") {
      return path.dirname(path.dirname(path.dirname(appRoot)));
    }
    if (process.platform === "win32" && product.win32VersionedUpdate) {
      return path.dirname(path.dirname(path.dirname(appRoot)));
    }
    return path.dirname(path.dirname(appRoot));
  }
  function getPortableDataPath() {
    if (process.env["VSCODE_PORTABLE"]) {
      return process.env["VSCODE_PORTABLE"];
    }
    if (process.platform === "win32" || process.platform === "linux") {
      return path.join(getApplicationPath(), "data");
    }
    const portableDataName = product.portable || `${product.applicationName}-portable-data`;
    return path.join(path.dirname(getApplicationPath()), portableDataName);
  }
  const portableDataPath = getPortableDataPath();
  const isPortable = !("target" in product) && fs.existsSync(portableDataPath);
  const portableTempPath = path.join(portableDataPath, "tmp");
  const isTempPortable = isPortable && fs.existsSync(portableTempPath);
  if (isPortable) {
    process.env["VSCODE_PORTABLE"] = portableDataPath;
  } else {
    delete process.env["VSCODE_PORTABLE"];
  }
  if (isTempPortable) {
    if (process.platform === "win32") {
      process.env["TMP"] = portableTempPath;
      process.env["TEMP"] = portableTempPath;
    } else {
      process.env["TMPDIR"] = portableTempPath;
    }
  }
  return {
    portableDataPath,
    isPortable
  };
}
export {
  configurePortable,
  devInjectNodeModuleLookupPath,
  removeGlobalNodeJsModuleLookupPaths
};
