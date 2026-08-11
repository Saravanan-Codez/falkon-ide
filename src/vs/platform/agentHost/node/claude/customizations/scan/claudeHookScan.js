import { URI } from "../../../../../../base/common/uri.js";
import { ResourceSet } from "../../../../../../base/common/map.js";
import { parseHooksJson, readJsonFile } from "../../../../../agentPlugins/common/pluginParsers.js";
function claudeHookFiles(workingDirectory, userHome) {
  const files = [];
  if (workingDirectory) {
    files.push(URI.joinPath(workingDirectory, ".claude", "settings.json"));
    files.push(URI.joinPath(workingDirectory, ".claude", "settings.local.json"));
  }
  files.push(URI.joinPath(userHome, ".claude", "settings.json"));
  return files;
}
async function scanClaudeHooks(workingDirectory, userHome, fileService) {
  const result = [];
  const seen = new ResourceSet();
  for (const uri of claudeHookFiles(workingDirectory, userHome)) {
    if (seen.has(uri)) {
      continue;
    }
    seen.add(uri);
    const raw = await readJsonFile(uri, fileService);
    if (raw === void 0) {
      continue;
    }
    const groups = parseHooksJson(uri, raw, workingDirectory, userHome);
    if (groups.length > 0) {
      result.push(groups[0].customization);
    }
  }
  return result;
}
export {
  scanClaudeHooks
};
