import { isSSHStrictHostKeyChecking } from "./sshRemoteAgentHost.js";
function stripSSHComment(s) {
  const idx = s.indexOf(" #");
  return idx !== -1 ? s.substring(0, idx).trim() : s;
}
function parseSSHConfigHostEntries(content) {
  const hosts = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const hostMatch = trimmed.match(/^Host\s+(.+)$/i);
    if (hostMatch) {
      const hostValue = stripSSHComment(hostMatch[1]);
      for (const h of hostValue.split(/\s+/)) {
        if (!h.includes("*") && !h.includes("?") && !h.startsWith("!")) {
          hosts.push(h);
        }
      }
    }
  }
  return hosts;
}
function parseSSHPathList(value) {
  const paths = [];
  const pattern = /"([^"]*)"|(\S+)/g;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    const path = match[1] ?? match[2];
    if (path) {
      paths.push(path);
    }
  }
  return paths;
}
function parseSSHGOutput(stdout) {
  const map = /* @__PURE__ */ new Map();
  const identityFiles = [];
  for (const line of stdout.split("\n")) {
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) {
      continue;
    }
    const key = line.substring(0, spaceIdx).toLowerCase();
    const value = line.substring(spaceIdx + 1).trim();
    if (key === "identityfile") {
      identityFiles.push(value);
    } else {
      map.set(key, value);
    }
  }
  const strictHostKeyChecking = map.get("stricthostkeychecking")?.toLowerCase();
  return {
    hostname: map.get("hostname") ?? "",
    user: map.get("user") || void 0,
    port: parseInt(map.get("port") ?? "22", 10),
    identityFile: identityFiles,
    identityAgent: map.get("identityagent") || void 0,
    forwardAgent: map.get("forwardagent") === "yes",
    userKnownHostsFiles: parseSSHPathList(map.get("userknownhostsfile") ?? ""),
    globalKnownHostsFiles: parseSSHPathList(map.get("globalknownhostsfile") ?? ""),
    strictHostKeyChecking: strictHostKeyChecking && isSSHStrictHostKeyChecking(strictHostKeyChecking) ? strictHostKeyChecking : void 0
  };
}
export {
  parseSSHConfigHostEntries,
  parseSSHGOutput,
  stripSSHComment
};
