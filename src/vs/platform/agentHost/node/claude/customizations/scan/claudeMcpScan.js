import { URI } from "../../../../../../base/common/uri.js";
import { makeMcpServerCustomization, readJsonFile } from "../../../../../agentPlugins/common/pluginParsers.js";
import { McpServerStatus } from "../../../../common/state/protocol/channels-session/state.js";
function claudeMcpFiles(workingDirectory, userHome) {
  const files = [];
  if (workingDirectory) {
    files.push(URI.joinPath(workingDirectory, ".claude", "settings.json"));
    files.push(URI.joinPath(workingDirectory, ".mcp.json"));
  }
  files.push(URI.joinPath(userHome, ".claude", "settings.json"));
  return files;
}
function extractMcpServerMap(uri, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return void 0;
  }
  const obj = raw;
  if (Object.hasOwn(obj, "mcpServers")) {
    const servers = obj.mcpServers;
    return servers && typeof servers === "object" && !Array.isArray(servers) ? servers : void 0;
  }
  return uri.path.endsWith(".mcp.json") ? obj : void 0;
}
async function scanClaudeMcpServers(workingDirectory, userHome, fileService) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const uri of claudeMcpFiles(workingDirectory, userHome)) {
    const raw = await readJsonFile(uri, fileService);
    const servers = extractMcpServerMap(uri, raw);
    if (!servers) {
      continue;
    }
    for (const [name, config] of Object.entries(servers)) {
      if (!config || typeof config !== "object" || Array.isArray(config) || seen.has(name)) {
        continue;
      }
      seen.add(name);
      result.push(makeMcpServerCustomization(uri, name));
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}
function deriveMcpState(status) {
  switch (status) {
    case "connected":
      return { kind: McpServerStatus.Ready };
    case "disabled":
      return { kind: McpServerStatus.Stopped };
    default:
      return { kind: McpServerStatus.Starting };
  }
}
export {
  deriveMcpState,
  scanClaudeMcpServers
};
