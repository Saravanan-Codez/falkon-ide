import { URI } from "../../../../../../base/common/uri.js";
import { ResourceSet } from "../../../../../../base/common/map.js";
import { detectPluginFormat, parsePlugin, readJsonFile } from "../../../../../agentPlugins/common/pluginParsers.js";
import { findMostSpecificClaudeWorkspaceRoot, selectEnabledClaudePluginIds } from "../claudeCustomizationPolicy.js";
const SKILLS_DIR_MARKETPLACE = "skills-dir";
function claudeSettingsFilesByPrecedence(workingDirectory, userHome) {
  const files = [URI.joinPath(userHome, ".claude", "settings.json")];
  if (workingDirectory) {
    files.push(URI.joinPath(workingDirectory, ".claude", "settings.json"));
    files.push(URI.joinPath(workingDirectory, ".claude", "settings.local.json"));
  }
  return files;
}
async function readEnabledPlugins(uri, fileService) {
  const result = /* @__PURE__ */ new Map();
  const raw = await readJsonFile(uri, fileService);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return result;
  }
  const enabledPlugins = raw["enabledPlugins"];
  if (!enabledPlugins || typeof enabledPlugins !== "object" || Array.isArray(enabledPlugins)) {
    return result;
  }
  for (const [id, value] of Object.entries(enabledPlugins)) {
    result.set(id, value !== false);
  }
  return result;
}
async function resolveEnabledPluginIds(workingDirectory, userHome, fileService) {
  const effective = /* @__PURE__ */ new Map();
  const seenFiles = new ResourceSet();
  for (const uri of claudeSettingsFilesByPrecedence(workingDirectory, userHome)) {
    if (seenFiles.has(uri)) {
      continue;
    }
    seenFiles.add(uri);
    const raw = await readJsonFile(uri, fileService);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const enabledPlugins = raw["enabledPlugins"];
    if (!enabledPlugins || typeof enabledPlugins !== "object" || Array.isArray(enabledPlugins)) {
      continue;
    }
    for (const [id, value] of Object.entries(enabledPlugins)) {
      effective.set(id, value !== false);
    }
  }
  return [...effective].filter(([, enabled]) => enabled).map(([id]) => id);
}
function splitPluginId(id) {
  const at = id.lastIndexOf("@");
  if (at <= 0 || at === id.length - 1) {
    return void 0;
  }
  const plugin = id.slice(0, at);
  const marketplace = id.slice(at + 1);
  const isUnsafeSegment = (s) => s.includes("/") || s.includes("\\") || s.includes("..");
  if (isUnsafeSegment(plugin) || isUnsafeSegment(marketplace)) {
    return void 0;
  }
  return { plugin, marketplace };
}
async function hasManifest(dir, fileService) {
  const format = await detectPluginFormat(dir, fileService);
  return fileService.exists(URI.joinPath(dir, format.manifestPath));
}
async function resolveSkillsDirRoot(plugin, workingDirectories, userHome, fileService) {
  const candidates = [];
  for (const workingDirectory of workingDirectories) {
    candidates.push(URI.joinPath(workingDirectory, ".claude", "skills", plugin));
  }
  candidates.push(URI.joinPath(userHome, ".claude", "skills", plugin));
  for (const candidate of candidates) {
    if (await hasManifest(candidate, fileService)) {
      return candidate;
    }
  }
  return void 0;
}
async function resolveMarketplaceCacheRoot(plugin, marketplace, userHome, fileService) {
  const base = URI.joinPath(userHome, ".claude", "plugins", "cache", marketplace, plugin);
  if (await hasManifest(base, fileService)) {
    return base;
  }
  let stat;
  try {
    stat = await fileService.resolve(base);
  } catch {
    return void 0;
  }
  if (!stat.isDirectory || !stat.children) {
    return void 0;
  }
  let best;
  for (const child of stat.children) {
    if (!child.isDirectory || !await hasManifest(child.resource, fileService)) {
      continue;
    }
    const mtime = child.mtime ?? 0;
    if (!best || mtime > best.mtime || mtime === best.mtime && child.name.localeCompare(best.name, void 0, { numeric: true }) > 0) {
      best = { uri: child.resource, mtime, name: child.name };
    }
  }
  return best?.uri;
}
async function scanClaudeNativePlugins(workingDirectory, userHome, fileService, logService) {
  const ids = await resolveEnabledPluginIds(workingDirectory, userHome, fileService);
  return resolveNativePlugins(ids, workingDirectory ? [workingDirectory] : [], userHome, fileService, logService);
}
async function scanClaudeNativePluginsForRoots(workingDirectories, userHome, fileService, logService) {
  const settingsFiles = [];
  for (const workingDirectory of workingDirectories) {
    settingsFiles.push(
      URI.joinPath(workingDirectory, ".claude", "settings.local.json"),
      URI.joinPath(workingDirectory, ".claude", "settings.json")
    );
  }
  settingsFiles.push(URI.joinPath(userHome, ".claude", "settings.json"));
  const ids = selectEnabledClaudePluginIds(await Promise.all(settingsFiles.map((uri) => readEnabledPlugins(uri, fileService))));
  return resolveNativePlugins(ids, workingDirectories, userHome, fileService, logService);
}
async function resolveNativePlugins(ids, workingDirectories, userHome, fileService, logService) {
  const result = [];
  const seenRoots = new ResourceSet();
  for (const id of ids) {
    const parts = splitPluginId(id);
    if (!parts) {
      logService.warn(`[claudeNativePluginScan] skipping malformed plugin id '${id}'`);
      continue;
    }
    const root = parts.marketplace === SKILLS_DIR_MARKETPLACE ? await resolveSkillsDirRoot(parts.plugin, workingDirectories, userHome, fileService) : await resolveMarketplaceCacheRoot(parts.plugin, parts.marketplace, userHome, fileService);
    if (!root) {
      logService.warn(`[claudeNativePluginScan] could not resolve an on-disk root for enabled plugin '${id}'`);
      continue;
    }
    if (seenRoots.has(root)) {
      continue;
    }
    seenRoots.add(root);
    try {
      const workspaceRoot = parts.marketplace === SKILLS_DIR_MARKETPLACE ? findMostSpecificClaudeWorkspaceRoot(root, workingDirectories) : void 0;
      const parsed = await parsePlugin(root, fileService, workspaceRoot ?? workingDirectories[0], userHome, root);
      result.push({ id, root, parsed });
    } catch (err) {
      logService.warn(`[claudeNativePluginScan] failed to parse plugin '${id}' at '${root.toString()}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  result.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}
export {
  scanClaudeNativePlugins,
  scanClaudeNativePluginsForRoots
};
