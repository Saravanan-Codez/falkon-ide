import * as cp from "child_process";
import { promises } from "fs";
import { getCaseInsensitive } from "../common/objects.js";
import * as path from "../common/path.js";
import * as Platform from "../common/platform.js";
import * as processCommon from "../common/process.js";
import { Source, TerminateResponseCode } from "../common/processes.js";
import * as Types from "../common/types.js";
import * as pfs from "./pfs.js";
import { FileAccess } from "../common/network.js";
function getWindowsShell(env = processCommon.env) {
  return env["comspec"] || "cmd.exe";
}
function createQueuedSender(childProcess) {
  let msgQueue = [];
  let useQueue = false;
  const send = function(msg) {
    if (useQueue) {
      msgQueue.push(msg);
      return;
    }
    const result = childProcess.send(msg, (error) => {
      if (error) {
        console.error(error);
      }
      useQueue = false;
      if (msgQueue.length > 0) {
        const msgQueueCopy = msgQueue.slice(0);
        msgQueue = [];
        msgQueueCopy.forEach((entry) => send(entry));
      }
    });
    if (!result || Platform.isWindows) {
      useQueue = true;
    }
  };
  return { send };
}
async function fileExistsDefault(path2) {
  if (await pfs.Promises.exists(path2)) {
    let statValue;
    try {
      statValue = await promises.stat(path2);
    } catch (e) {
      if (e.message.startsWith("EACCES")) {
        statValue = await promises.lstat(path2);
      }
    }
    return statValue ? !statValue.isDirectory() : false;
  }
  return false;
}
async function findExecutable(command, cwd, paths, env = processCommon.env, fileExists = fileExistsDefault) {
  if (path.isAbsolute(command)) {
    return await fileExists(command) ? command : void 0;
  }
  if (cwd === void 0) {
    cwd = processCommon.cwd();
  }
  const dir = path.dirname(command);
  if (dir !== ".") {
    const fullPath2 = path.join(cwd, command);
    return await fileExists(fullPath2) ? fullPath2 : void 0;
  }
  const envPath = getCaseInsensitive(env, "PATH");
  if (paths === void 0 && Types.isString(envPath)) {
    paths = envPath.split(path.delimiter);
  }
  if (paths === void 0 || paths.length === 0) {
    const fullPath2 = path.join(cwd, command);
    return await fileExists(fullPath2) ? fullPath2 : void 0;
  }
  for (const pathEntry of paths) {
    let fullPath2;
    if (path.isAbsolute(pathEntry)) {
      fullPath2 = path.join(pathEntry, command);
    } else {
      fullPath2 = path.join(cwd, pathEntry, command);
    }
    if (Platform.isWindows) {
      const pathExt = getCaseInsensitive(env, "PATHEXT") || ".COM;.EXE;.BAT;.CMD";
      const pathExtsFound = pathExt.split(";").map(async (ext) => {
        const withExtension = fullPath2 + ext;
        return await fileExists(withExtension) ? withExtension : void 0;
      });
      for (const foundPromise of pathExtsFound) {
        const found = await foundPromise;
        if (found) {
          return found;
        }
      }
    }
    if (await fileExists(fullPath2)) {
      return fullPath2;
    }
  }
  const fullPath = path.join(cwd, command);
  return await fileExists(fullPath) ? fullPath : void 0;
}
async function killTree(pid, forceful = false) {
  let child;
  if (Platform.isWindows) {
    const windir = process.env["WINDIR"] || "C:\\Windows";
    const taskKill = path.join(windir, "System32", "taskkill.exe");
    const args = ["/T"];
    if (forceful) {
      args.push("/F");
    }
    args.push("/PID", String(pid));
    child = cp.spawn(taskKill, args, { stdio: ["ignore", "pipe", "pipe"] });
  } else {
    const killScript = FileAccess.asFileUri("vs/base/node/terminateProcess.sh").fsPath;
    child = cp.spawn("/bin/sh", [killScript, String(pid), forceful ? "9" : "15"], { stdio: ["ignore", "pipe", "pipe"] });
  }
  return new Promise((resolve, reject) => {
    const stdout = [];
    child.stdout.on("data", (data) => stdout.push(data));
    child.stderr.on("data", (data) => stdout.push(data));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`taskkill exited with code ${code}: ${Buffer.concat(stdout).toString()}`));
      }
    });
  });
}
export {
  Source,
  TerminateResponseCode,
  createQueuedSender,
  findExecutable,
  getWindowsShell,
  killTree
};
