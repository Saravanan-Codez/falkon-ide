import { timeout } from "../../../base/common/async.js";
import { vArray, vObj, vString, vUnknown } from "../../../base/common/validation.js";
import { getAgentHostEndpointIdentityKey, parseAgentHostEndpointRegistry } from "../common/agentHostEndpointRegistry.js";
function validateShellToken(value, label) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`Unsafe ${label} value for shell interpolation: ${JSON.stringify(value)}`);
  }
  return value;
}
function validateCommit(commit) {
  const normalized = commit.toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`Unsafe commit value (expected 40-char hex SHA): ${JSON.stringify(commit)}`);
  }
  return normalized;
}
function getRemoteCLIArchiveName(quality) {
  const q = validateShellToken(quality, "quality");
  switch (q) {
    case "stable":
      return "code";
    case "exploration":
      return "code-exploration";
    default:
      return "code-insiders";
  }
}
function getRemoteCLIInstallRoot(serverDataFolderName) {
  const d = validateShellToken(serverDataFolderName, "server data folder name");
  return `~/${d}`;
}
function getRemoteCLIDataDir(serverDataFolderName) {
  return `${getRemoteCLIInstallRoot(serverDataFolderName)}/cli`;
}
function getRemoteCLIBin(serverDataFolderName, quality, commit) {
  const archive = getRemoteCLIArchiveName(quality);
  const root = getRemoteCLIInstallRoot(serverDataFolderName);
  if (commit) {
    const c = validateCommit(commit);
    return `${root}/${archive}-${c}`;
  }
  return `${root}/${archive}`;
}
function shellEscape(s) {
  const escaped = s.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}
function buildAgentHostBaseCommand(cliBin, cliDataDir) {
  return `${cliBin} --cli-data-dir ${cliDataDir} agent host --port 0`;
}
function resolveRemotePlatform(unameS, unameM) {
  const os = unameS.trim().toLowerCase();
  const machine = unameM.trim().toLowerCase();
  let platformOs;
  if (os === "linux") {
    platformOs = "linux";
  } else if (os === "darwin") {
    platformOs = "darwin";
  } else {
    return void 0;
  }
  let arch;
  if (machine === "x86_64" || machine === "amd64") {
    arch = "x64";
  } else if (machine === "aarch64" || machine === "arm64") {
    arch = "arm64";
  } else if (machine === "armv7l") {
    arch = "armhf";
  } else {
    return void 0;
  }
  return { os: platformOs, arch };
}
function buildCLIDownloadUrl(os, arch, quality, commit) {
  const base = "https://update.code.visualstudio.com";
  const artifact = `cli-${os}-${arch}`;
  if (commit) {
    const c = validateCommit(commit);
    return `${base}/commit:${c}/${artifact}/${quality}`;
  }
  return `${base}/latest/${artifact}/${quality}`;
}
function buildCleanupOldCLIsCommand(serverDataFolderName, quality) {
  const root = getRemoteCLIInstallRoot(serverDataFolderName);
  const archive = getRemoteCLIArchiveName(quality);
  const commitGlob = "[0-9a-f]".repeat(40);
  return `ls -1t -- ${root}/${archive}-${commitGlob} 2>/dev/null | awk 'NR>5' | xargs -I{} rm -f -- {} 2>/dev/null; true`;
}
function buildFindFallbackCLICommand(serverDataFolderName, quality) {
  const root = getRemoteCLIInstallRoot(serverDataFolderName);
  const archive = getRemoteCLIArchiveName(quality);
  const commitGlob = "[0-9a-f]".repeat(40);
  const q = validateShellToken(quality, "quality");
  const legacyDir = q === "stable" ? "~/.vscode-cli" : `~/.vscode-cli-${q}`;
  const legacyBin = `${legacyDir}/${archive}`;
  return [
    `ls -1t -- ${root}/${archive}-${commitGlob} 2>/dev/null`,
    `ls -1 -- ${legacyBin} 2>/dev/null`,
    "true"
  ].join("; ");
}
function isValidFallbackCLIPath(candidate, serverDataFolderName, quality) {
  const root = getRemoteCLIInstallRoot(serverDataFolderName);
  const archive = getRemoteCLIArchiveName(quality);
  const q = validateShellToken(quality, "quality");
  const legacyDir = q === "stable" ? "~/.vscode-cli" : `~/.vscode-cli-${q}`;
  const legacyBin = `${legacyDir}/${archive}`;
  if (candidate === legacyBin) {
    return true;
  }
  const pinnedPrefix = `${root}/${archive}-`;
  if (candidate.startsWith(pinnedPrefix)) {
    const suffix = candidate.slice(pinnedPrefix.length);
    return /^[0-9a-f]{40}$/.test(suffix);
  }
  return false;
}
function redactToken(text) {
  return text.replace(/\?tkn=[^\s&]+/g, "?tkn=***");
}
const AGENT_HOST_WS_URL_RE = /ws:\/\/(?:127\.0\.0\.1|localhost):(\d+)(?:\?tkn=([^\s&]+))?/;
function extractAgentHostWebSocketURL(text) {
  const match = text.match(AGENT_HOST_WS_URL_RE);
  if (!match) {
    return void 0;
  }
  return {
    url: match[0],
    host: "127.0.0.1",
    port: parseInt(match[1], 10),
    token: match[2] || void 0
  };
}
function dialAgentHostHost(bound) {
  if (!bound || bound === "0.0.0.0" || bound === "::" || bound === "[::]") {
    return "127.0.0.1";
  }
  return bound;
}
function buildAgentEndpointsCommand(cliBin, cliDataDir, userDataPath) {
  const userDataArg = userDataPath ? ` --user-data-dir ${shellEscape(userDataPath)}` : "";
  return `${cliBin} --cli-data-dir ${cliDataDir} agent endpoints${userDataArg}`;
}
function buildAgentHostSpawnCommand(cliBin, cliDataDir, userDataPath, idleTimeoutSec = 300) {
  if (!Number.isSafeInteger(idleTimeoutSec) || idleTimeoutSec <= 0) {
    throw new Error(`Unsafe idle timeout value for shell interpolation: ${JSON.stringify(idleTimeoutSec)}`);
  }
  return `${buildAgentHostBaseCommand(cliBin, cliDataDir)} --new-instance --user-data-dir ${shellEscape(userDataPath)} --idle-timeout ${idleTimeoutSec}`;
}
function buildAgentRelayCommand(cliBin, cliDataDir, instanceId, userDataPath) {
  return `${cliBin} --cli-data-dir ${cliDataDir} agent relay ${shellEscape(instanceId)} --user-data-dir ${shellEscape(userDataPath)}`;
}
const agentEndpointsEnvelopeValidator = vObj({
  userDataPath: vString(),
  endpoints: vArray(vUnknown())
});
function parseAgentEndpointsOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return void 0;
  }
  const candidates = [trimmed];
  const lastLine = trimmed.split("\n").at(-1)?.trim();
  if (lastLine && lastLine !== trimmed) {
    candidates.push(lastLine);
  }
  for (const candidate of candidates) {
    const result = parseAgentEndpointsDocument(candidate);
    if (result) {
      return result;
    }
  }
  return void 0;
}
function parseAgentEndpointsDocument(value) {
  let raw;
  try {
    raw = JSON.parse(value);
  } catch {
    return void 0;
  }
  const { content, error } = agentEndpointsEnvelopeValidator.validate(raw);
  if (error) {
    return void 0;
  }
  return {
    userDataPath: content.userDataPath,
    endpoints: parseAgentHostEndpointRegistry(content.endpoints)
  };
}
async function runAgentEndpoints(exec, cliBin, cliDataDir, userDataPath) {
  const command = buildAgentEndpointsCommand(cliBin, cliDataDir, userDataPath);
  const { stdout, stderr, code } = await exec(command, { ignoreExitCode: true });
  if (code !== 0) {
    throw new Error(`'agent endpoints' failed (exit code ${code})${stderr.trim() ? `: ${stderr.trim()}` : ""}`);
  }
  const result = parseAgentEndpointsOutput(stdout);
  if (!result) {
    throw new Error(`'agent endpoints' produced unparsable output (${stdout.length} characters)`);
  }
  return result;
}
async function filterLiveAgentHostEndpoints(exec, entries) {
  const pids = [...new Set(entries.map((e) => e.pid))];
  const alive = /* @__PURE__ */ new Set();
  await Promise.all(pids.map(async (pid) => {
    const { code } = await exec(`kill -0 ${pid} 2>/dev/null`, { ignoreExitCode: true });
    if (code === 0) {
      alive.add(pid);
    }
  }));
  return entries.filter((e) => alive.has(e.pid));
}
function findNewAgentHostEndpoint(before, after) {
  const beforeKeys = new Set(before.map(getAgentHostEndpointIdentityKey));
  return after.find((entry) => entry.type === "standalone" && !beforeKeys.has(getAgentHostEndpointIdentityKey(entry)));
}
async function waitForNewStandaloneEndpoint(exec, cliBin, cliDataDir, userDataPath, before, options) {
  const attempts = options?.attempts ?? 20;
  const intervalMs = options?.intervalMs ?? 500;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { endpoints } = await runAgentEndpoints(exec, cliBin, cliDataDir, userDataPath);
    const found = findNewAgentHostEndpoint(before, endpoints);
    if (found) {
      return found;
    }
    if (attempt < attempts - 1) {
      if (options?.token) {
        await timeout(intervalMs, options.token);
      } else {
        await timeout(intervalMs);
      }
    }
  }
  throw new Error(`Timed out waiting for the newly spawned agent host to register itself (checked ${attempts} times, ~${Math.round(attempts * intervalMs / 1e3)}s)`);
}
export {
  buildAgentEndpointsCommand,
  buildAgentHostBaseCommand,
  buildAgentHostSpawnCommand,
  buildAgentRelayCommand,
  buildCLIDownloadUrl,
  buildCleanupOldCLIsCommand,
  buildFindFallbackCLICommand,
  dialAgentHostHost,
  extractAgentHostWebSocketURL,
  filterLiveAgentHostEndpoints,
  findNewAgentHostEndpoint,
  getRemoteCLIArchiveName,
  getRemoteCLIBin,
  getRemoteCLIDataDir,
  getRemoteCLIInstallRoot,
  isValidFallbackCLIPath,
  parseAgentEndpointsOutput,
  redactToken,
  resolveRemotePlatform,
  runAgentEndpoints,
  shellEscape,
  validateCommit,
  validateShellToken,
  waitForNewStandaloneEndpoint
};
