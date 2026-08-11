import { URI } from "../../../../../../base/common/uri.js";
import { basename } from "../../../../../../base/common/resources.js";
import { parseRuleFile, pathExists } from "../../../../../agentPlugins/common/pluginParsers.js";
import { CustomizationType } from "../../../../common/state/protocol/channels-session/state.js";
import { customizationId } from "../../../../common/state/sessionState.js";
function claudeMemoryFiles(workingDirectory, userHome) {
  const files = [URI.joinPath(userHome, ".claude", "CLAUDE.md")];
  if (workingDirectory) {
    files.push(
      URI.joinPath(workingDirectory, "CLAUDE.md"),
      URI.joinPath(workingDirectory, ".claude", "CLAUDE.md"),
      URI.joinPath(workingDirectory, "CLAUDE.local.md")
    );
  }
  return files;
}
const MAX_RULE_SCAN_DEPTH = 32;
async function readMarkdownFilesRecursive(dir, fileService, seen = /* @__PURE__ */ new Set(), depth = 0) {
  const key = dir.toString();
  if (depth > MAX_RULE_SCAN_DEPTH || seen.has(key)) {
    return [];
  }
  seen.add(key);
  let stat;
  try {
    stat = await fileService.resolve(dir);
  } catch {
    return [];
  }
  if (!stat.isDirectory || !stat.children) {
    return [];
  }
  const files = [];
  for (const child of stat.children) {
    if (child.isDirectory) {
      files.push(...await readMarkdownFilesRecursive(child.resource, fileService, seen, depth + 1));
    } else if (child.isFile && child.resource.path.toLowerCase().endsWith(".md")) {
      files.push(child.resource);
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
async function scanClaudeRules(workingDirectory, userHome, fileService) {
  const result = [];
  for (const uri of claudeMemoryFiles(workingDirectory, userHome)) {
    if (await pathExists(uri, fileService)) {
      const ruleUri = uri.toString();
      const name = basename(uri);
      const customization = {
        type: CustomizationType.Rule,
        id: customizationId(ruleUri),
        uri: ruleUri,
        name,
        alwaysApply: true
      };
      result.push({ uri, name, customization });
    }
  }
  const scopes = workingDirectory ? [workingDirectory, userHome] : [userHome];
  for (const scope of scopes) {
    const files = await readMarkdownFilesRecursive(URI.joinPath(scope, ".claude", "rules"), fileService);
    for (const uri of files) {
      const parsed = await parseRuleFile(uri, fileService);
      const ruleUri = uri.toString();
      const hasGlobs = !!parsed.globs?.length;
      const customization = {
        type: CustomizationType.Rule,
        id: customizationId(ruleUri),
        uri: ruleUri,
        name: parsed.name,
        ...parsed.description ? { description: parsed.description } : {},
        ...hasGlobs ? { globs: parsed.globs } : {},
        alwaysApply: !hasGlobs
      };
      result.push({ uri, name: parsed.name, ...parsed.description ? { description: parsed.description } : {}, customization });
    }
  }
  return result;
}
export {
  claudeMemoryFiles,
  scanClaudeRules
};
