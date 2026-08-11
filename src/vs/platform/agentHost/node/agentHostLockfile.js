import * as fs from "fs";
import * as os from "os";
import { join } from "../../../base/common/path.js";
import { parseRemoteAgentHostState } from "../common/remoteAgentHostMetadata.js";
import { dialAgentHostHost, validateShellToken } from "./sshRemoteAgentHostHelpers.js";
const LOG_PREFIX = "[AgentHostLockfile]";
function getLocalAgentHostLockfilePath(serverDataFolderName, quality) {
  const d = validateShellToken(serverDataFolderName, "server data folder name");
  const q = validateShellToken(quality, "quality");
  return join(os.homedir(), d, "cli", `agent-host-${q}.lock`);
}
async function readLocalAgentHostLockfile(lockfilePath, logService) {
  let raw;
  try {
    raw = await fs.promises.readFile(lockfilePath, "utf8");
  } catch (err) {
    const code = err?.code;
    if (code !== "ENOENT") {
      logService?.warn(`${LOG_PREFIX} Failed to read agent host lockfile ${lockfilePath}: ${err}`);
    }
    return void 0;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logService?.info(`${LOG_PREFIX} Agent host lockfile ${lockfilePath} contains invalid JSON`);
    return void 0;
  }
  const state = parseRemoteAgentHostState(parsed);
  if (!state) {
    logService?.info(`${LOG_PREFIX} Agent host lockfile ${lockfilePath} does not match expected schema`);
    return void 0;
  }
  return state;
}
async function readActiveAgentHostFromLockfile(lockfilePath, logService) {
  const state = await readLocalAgentHostLockfile(lockfilePath, logService);
  if (!state) {
    return { kind: "notFound" };
  }
  if (!isPidAlive(state.pid)) {
    logService.info(`${LOG_PREFIX} Stale agent host lockfile ${lockfilePath} (PID ${state.pid} not running)`);
    return { kind: "stale", pid: state.pid };
  }
  logService.info(`${LOG_PREFIX} Found running agent host via ${lockfilePath}: PID ${state.pid}, port ${state.port}`);
  return {
    kind: "compatible",
    pid: state.pid,
    host: dialAgentHostHost(state.host),
    port: state.port,
    connectionToken: state.connectionToken ?? void 0
  };
}
function isPidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = err?.code;
    return code === "EPERM";
  }
}
export {
  getLocalAgentHostLockfilePath,
  isPidAlive,
  readActiveAgentHostFromLockfile,
  readLocalAgentHostLockfile
};
