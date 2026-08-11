import { toHookType, extractHookCommandsFromItem } from "./hookSchema.js";
import { HOOKS_BY_TARGET } from "./hookTypes.js";
import { Target } from "./promptTypes.js";
let _hookTypeToClaudeName;
function getHookTypeToClaudeNameMap() {
  if (!_hookTypeToClaudeName) {
    _hookTypeToClaudeName = /* @__PURE__ */ new Map();
    for (const [claudeName, hookType] of Object.entries(HOOKS_BY_TARGET[Target.Claude])) {
      _hookTypeToClaudeName.set(hookType, claudeName);
    }
  }
  return _hookTypeToClaudeName;
}
function resolveClaudeHookType(name) {
  return HOOKS_BY_TARGET[Target.Claude][name];
}
function getClaudeHookTypeName(hookType) {
  return getHookTypeToClaudeNameMap().get(hookType);
}
function parseClaudeHooks(json, workspaceRootUri, userHome) {
  const result = /* @__PURE__ */ new Map();
  if (!json || typeof json !== "object") {
    return { hooks: result, disabledAllHooks: false };
  }
  const root = json;
  if (root.disableAllHooks === true) {
    return { hooks: result, disabledAllHooks: true };
  }
  const hooks = root.hooks;
  if (!hooks || typeof hooks !== "object") {
    return { hooks: result, disabledAllHooks: false };
  }
  const hooksObj = hooks;
  for (const originalId of Object.keys(hooksObj)) {
    const hookType = resolveClaudeHookType(originalId) ?? toHookType(originalId);
    if (!hookType) {
      continue;
    }
    const hookArray = hooksObj[originalId];
    if (!Array.isArray(hookArray)) {
      continue;
    }
    const commands = [];
    for (const item of hookArray) {
      const extracted = extractHookCommandsFromItem(item, workspaceRootUri, userHome);
      commands.push(...extracted);
    }
    if (commands.length > 0) {
      const existing = result.get(hookType);
      if (existing) {
        existing.hooks.push(...commands);
      } else {
        result.set(hookType, { hooks: commands, originalId });
      }
    }
  }
  return { hooks: result, disabledAllHooks: false };
}
export {
  extractHookCommandsFromItem,
  getClaudeHookTypeName,
  parseClaudeHooks,
  resolveClaudeHookType
};
