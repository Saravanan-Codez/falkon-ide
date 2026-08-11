import { isEqualOrParent } from "../../../../../base/common/resources.js";
function selectFirstClaudeCustomizationByKey(groups, keyOf) {
  const selected = /* @__PURE__ */ new Map();
  for (const group of groups) {
    for (const item of group) {
      const key = keyOf(item);
      if (!selected.has(key)) {
        selected.set(key, item);
      }
    }
  }
  return [...selected.values()];
}
function selectEnabledClaudePluginIds(groups) {
  const selected = /* @__PURE__ */ new Map();
  for (const group of groups) {
    for (const [id, enabled] of group) {
      if (!selected.has(id)) {
        selected.set(id, enabled);
      }
    }
  }
  return [...selected].filter(([, enabled]) => enabled).map(([id]) => id);
}
function findMostSpecificClaudeWorkspaceRoot(resource, workingDirectories) {
  let result;
  for (const directory of workingDirectories) {
    if (resource.scheme === directory.scheme && isEqualOrParent(resource, directory) && (!result || directory.path.length > result.path.length)) {
      result = directory;
    }
  }
  return result;
}
export {
  findMostSpecificClaudeWorkspaceRoot,
  selectEnabledClaudePluginIds,
  selectFirstClaudeCustomizationByKey
};
