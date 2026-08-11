import { execFile } from "child_process";
import { createHash, randomBytes } from "crypto";
import * as fs from "fs";
import * as os from "os";
import { join } from "../../../base/common/path.js";
import {
  AGENT_HOST_ENDPOINT_REGISTRY_SCHEMA_VERSION,
  dedupeAgentHostEndpointMetadata,
  getAgentHostEndpointIdentityHashInput,
  parseAgentHostEndpointMetadataEntry,
  parseAgentHostEndpointRegistry
} from "../common/agentHostEndpointRegistry.js";
import { PROTOCOL_VERSION } from "../common/state/protocol/version/registry.js";
import { isPidAlive } from "./agentHostLockfile.js";
const metadataDirectoryName = "agent-host";
const endpointDirectoryName = "local-endpoint";
const entriesDirectoryName = "entries";
const legacyMetadataFileName = "metadata.json";
function createLocalAgentHostEndpointMetadata(userDataPath) {
  const instanceId = randomBytes(16).toString("base64url");
  return {
    schemaVersion: AGENT_HOST_ENDPOINT_REGISTRY_SCHEMA_VERSION,
    type: "editor",
    pid: process.pid,
    instanceId,
    endpoint: { type: "socket", path: getEndpointPath(userDataPath, instanceId) },
    connectionToken: randomBytes(32).toString("base64url"),
    protocolVersion: PROTOCOL_VERSION
  };
}
async function prepareLocalAgentHostEndpointMetadataDirectory(userDataPath) {
  await prepareOwnerOnlyDirectory(getMetadataDirectory(userDataPath));
  await prepareOwnerOnlyDirectory(getEntriesDirectory(userDataPath));
}
async function prepareOwnerOnlyDirectory(directory) {
  await fs.promises.mkdir(directory, { recursive: true, mode: 448 });
  const stat = await fs.promises.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Local agent host endpoint directory is not a directory: ${directory}`);
  }
  if (process.platform === "win32") {
    await applyWindowsOwnerOnlyAcl(directory);
  } else {
    if (process.getuid && stat.uid !== process.getuid()) {
      throw new Error(`Local agent host endpoint directory is not owned by the current user: ${directory}`);
    }
    await fs.promises.chmod(directory, 448);
  }
}
async function prepareLocalAgentHostEndpointSocketDirectory(userDataPath) {
  if (process.platform !== "win32") {
    const directory = getSocketDirectory(userDataPath);
    await fs.promises.mkdir(directory, { recursive: true, mode: 448 });
    const stat = await fs.promises.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Local agent host endpoint socket directory is not a directory: ${directory}`);
    }
    if (process.getuid && stat.uid !== process.getuid()) {
      throw new Error(`Local agent host endpoint socket directory is not owned by the current user: ${directory}`);
    }
    await fs.promises.chmod(directory, 448);
  }
}
async function publishLocalAgentHostEndpointMetadata(userDataPath, metadata, logService) {
  await prepareLocalAgentHostEndpointMetadataDirectory(userDataPath);
  const entriesDirectory = getEntriesDirectory(userDataPath);
  const entryPath = join(entriesDirectory, getAgentHostEndpointEntryFileName(metadata));
  await writeEntryFileAtomicAsync(entriesDirectory, entryPath, metadata, logService);
}
function cleanupLocalAgentHostEndpointMetadataSync(userDataPath, owner, logService) {
  const entryPath = join(getEntriesDirectory(userDataPath), getAgentHostEndpointEntryFileName(owner));
  try {
    fs.rmSync(entryPath, { force: true });
  } catch (error) {
    logService?.error(`[AgentHost] Failed to remove our local agent host endpoint entry ${entryPath}`, error);
  }
}
function cleanupLocalAgentHostEndpointSocketSync(endpointPath) {
  if (process.platform !== "win32") {
    fs.rmSync(endpointPath, { force: true });
  }
}
async function readLocalAgentHostEndpointRegistry(userDataPath, logService) {
  const entryFiles = await readEntryFilesAsync(getEntriesDirectory(userDataPath), logService);
  const legacy = await readLegacyRegistryAsync(getLegacyMetadataPath(userDataPath), logService);
  const live = [];
  for (const entry of legacy) {
    if (isPidAlive(entry.pid)) {
      live.push(entry);
    }
  }
  for (const { entry, path } of entryFiles) {
    if (isPidAlive(entry.pid)) {
      live.push(entry);
    } else {
      logService?.info(`[AgentHost] Pruning stale local endpoint registry entry: ${entry.type} PID ${entry.pid} (instance ${entry.instanceId}) is no longer running`);
      await fs.promises.rm(path, { force: true }).catch(() => {
      });
    }
  }
  return sortForDeterministicOrder(dedupeAgentHostEndpointMetadata(live));
}
function getMetadataDirectory(userDataPath) {
  return join(userDataPath, metadataDirectoryName, endpointDirectoryName);
}
function getEntriesDirectory(userDataPath) {
  return join(getMetadataDirectory(userDataPath), entriesDirectoryName);
}
function getLegacyMetadataPath(userDataPath) {
  return join(getMetadataDirectory(userDataPath), legacyMetadataFileName);
}
function getAgentHostEndpointEntryFileName(identity) {
  const hash = createHash("sha256").update(getAgentHostEndpointIdentityHashInput(identity), "utf8").digest("hex");
  return `${hash}.json`;
}
function getSocketDirectory(userDataPath) {
  const owner = process.getuid?.().toString() ?? "";
  const hash = createHash("sha256").update(`${owner}:${userDataPath}`).digest("hex").slice(0, 12);
  return join(os.tmpdir(), `vscode-ah-${hash}`);
}
function getEndpointPath(userDataPath, instanceId) {
  if (process.platform === "win32") {
    const userDataHash = createHash("sha256").update(userDataPath).digest("hex");
    return `\\\\.\\pipe\\vscode-agent-host-${userDataHash}-${instanceId}`;
  }
  return join(getSocketDirectory(userDataPath), `${instanceId}.sock`);
}
async function readEntryFilesAsync(entriesDirectory, logService) {
  let names;
  try {
    names = await fs.promises.readdir(entriesDirectory);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
  const results = [];
  for (const name of names) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const path = join(entriesDirectory, name);
    const entry = await readEntryFileAsync(path, logService);
    if (!entry) {
      continue;
    }
    if (name !== getAgentHostEndpointEntryFileName(entry)) {
      logService?.warn(`[AgentHost] Ignoring local agent host endpoint entry ${path} whose file name does not match its identity`);
      continue;
    }
    results.push({ entry, path });
  }
  return results;
}
async function readEntryFileAsync(path, logService) {
  let raw;
  try {
    const stat = await fs.promises.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return void 0;
    }
    raw = await fs.promises.readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return void 0;
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      logService?.warn(`[AgentHost] Ignoring malformed local agent host endpoint entry ${path}`);
      return void 0;
    }
    throw error;
  }
  const entry = parseAgentHostEndpointMetadataEntry(parsed);
  if (!entry) {
    logService?.warn(`[AgentHost] Ignoring invalid or unsupported local agent host endpoint entry ${path}`);
    return void 0;
  }
  return entry;
}
async function readLegacyRegistryAsync(metadataPath, logService) {
  let raw;
  try {
    const stat = await fs.promises.lstat(metadataPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return [];
    }
    raw = await fs.promises.readFile(metadataPath, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
  try {
    return parseAgentHostEndpointRegistry(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      logService?.warn(`[AgentHost] Ignoring malformed legacy local agent host endpoint registry ${metadataPath}`);
      return [];
    }
    throw error;
  }
}
async function writeEntryFileAtomicAsync(entriesDirectory, entryPath, metadata, logService) {
  const temporaryPath = join(entriesDirectory, `${randomBytes(16).toString("hex")}.tmp`);
  const handle = await fs.promises.open(temporaryPath, "wx", 384);
  try {
    await handle.writeFile(JSON.stringify(metadata), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await renameReplacingAsync(temporaryPath, entryPath, logService);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true }).catch(() => {
    });
  }
}
async function renameReplacingAsync(from, to, logService) {
  try {
    await fs.promises.rename(from, to);
  } catch (error) {
    if (process.platform === "win32" && isWindowsRenameContention(error)) {
      logService?.info(`[AgentHost] Replacing our own local agent host endpoint entry ${to} after a rename contention`);
      await fs.promises.rm(to, { force: true });
      await fs.promises.rename(from, to);
      return;
    }
    throw error;
  }
}
function sortForDeterministicOrder(entries) {
  return entries.sort((a, b) => {
    const rankDelta = serverTypeSortRank(a.type) - serverTypeSortRank(b.type);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;
  });
}
function serverTypeSortRank(type) {
  return type === "standalone" ? 0 : 1;
}
function isNotFound(error) {
  return error?.code === "ENOENT";
}
function isWindowsRenameContention(error) {
  const code = error?.code;
  return code === "EPERM" || code === "EACCES" || code === "EEXIST";
}
async function applyWindowsOwnerOnlyAcl(path) {
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (!systemRoot) {
    throw new Error("Unable to resolve the Windows system directory for local agent host metadata.");
  }
  const systemDirectory = join(systemRoot, "System32");
  const whoAmI = await runWindowsCommand(join(systemDirectory, "whoami.exe"), ["/user", "/fo", "csv", "/nh"]);
  const sid = whoAmI.match(/S-\d+(?:-\d+)+/)?.[0];
  if (!sid) {
    throw new Error("Unable to determine the current Windows user SID for local agent host metadata.");
  }
  const icacls = join(systemDirectory, "icacls.exe");
  await runWindowsCommand(icacls, [path, "/reset"]);
  await runWindowsCommand(icacls, [
    path,
    "/inheritance:r",
    "/grant:r",
    `*${sid}:(OI)(CI)F`,
    "*S-1-5-18:(OI)(CI)F",
    "*S-1-5-32-544:(OI)(CI)F"
  ]);
}
function runWindowsCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, [...args], { encoding: "utf8", windowsHide: true }, (error, stdout) => error ? reject(error) : resolve(String(stdout)));
  });
}
export {
  cleanupLocalAgentHostEndpointMetadataSync,
  cleanupLocalAgentHostEndpointSocketSync,
  createLocalAgentHostEndpointMetadata,
  prepareLocalAgentHostEndpointMetadataDirectory,
  prepareLocalAgentHostEndpointSocketDirectory,
  publishLocalAgentHostEndpointMetadata,
  readLocalAgentHostEndpointRegistry
};
