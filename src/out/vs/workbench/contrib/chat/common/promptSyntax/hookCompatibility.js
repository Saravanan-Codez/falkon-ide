import { basename, dirname } from "../../../../../base/common/path.js";
import { toHookType } from "./hookSchema.js";
import { parseClaudeHooks, extractHookCommandsFromItem } from "./hookClaudeCompat.js";
import { resolveCopilotCliHookType } from "./hookCopilotCliCompat.js";
var HookSourceFormat = /* @__PURE__ */ ((HookSourceFormat2) => {
  HookSourceFormat2["Copilot"] = "copilot";
  HookSourceFormat2["Claude"] = "claude";
  return HookSourceFormat2;
})(HookSourceFormat || {});
function getHookSourceFormat(fileUri) {
  const filename = basename(fileUri.path).toLowerCase();
  const dir = dirname(fileUri.path);
  if ((filename === "settings.json" || filename === "settings.local.json") && dir.endsWith(".claude")) {
    return "claude" /* Claude */;
  }
  return "copilot" /* Copilot */;
}
function isReadOnlyHookSource(format) {
  return format === "claude" /* Claude */;
}
function parseCopilotHooks(json, workspaceRootUri, userHome) {
  const result = /* @__PURE__ */ new Map();
  if (!json || typeof json !== "object") {
    return result;
  }
  const root = json;
  const hooks = root.hooks;
  if (!hooks || typeof hooks !== "object") {
    return result;
  }
  const hooksObj = hooks;
  for (const originalId of Object.keys(hooksObj)) {
    const hookType = resolveCopilotCliHookType(originalId) ?? toHookType(originalId);
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
      result.set(hookType, { hooks: commands, originalId });
    }
  }
  return result;
}
function parseHooksFromFile(fileUri, json, workspaceRootUri, userHome) {
  const format = getHookSourceFormat(fileUri);
  let hooks;
  let disabledAllHooks = false;
  switch (format) {
    case "claude" /* Claude */: {
      const result = parseClaudeHooks(json, workspaceRootUri, userHome);
      hooks = result.hooks;
      disabledAllHooks = result.disabledAllHooks;
      break;
    }
    case "copilot" /* Copilot */:
    default:
      hooks = parseCopilotHooks(json, workspaceRootUri, userHome);
      break;
  }
  return { format, hooks, disabledAllHooks };
}
function parseHooksIgnoringDisableAll(fileUri, json, workspaceRootUri, userHome) {
  const format = getHookSourceFormat(fileUri);
  let hooks;
  switch (format) {
    case "claude" /* Claude */: {
      if (json && typeof json === "object") {
        const { disableAllHooks: _, ...rest } = json;
        const result = parseClaudeHooks(rest, workspaceRootUri, userHome);
        hooks = result.hooks;
      } else {
        hooks = /* @__PURE__ */ new Map();
      }
      break;
    }
    case "copilot" /* Copilot */:
    default:
      hooks = parseCopilotHooks(json, workspaceRootUri, userHome);
      break;
  }
  return { format, hooks, disabledAllHooks: true };
}
function getHookSourceFormatLabel(format) {
  switch (format) {
    case "claude" /* Claude */:
      return "Claude";
    case "copilot" /* Copilot */:
      return "GitHub Copilot";
  }
}
function buildNewHookEntry(format) {
  const commandEntry = { type: "command", command: "" };
  if (format === "claude" /* Claude */) {
    return { matcher: "", hooks: [commandEntry] };
  }
  return commandEntry;
}
export {
  HookSourceFormat,
  buildNewHookEntry,
  getHookSourceFormat,
  getHookSourceFormatLabel,
  isReadOnlyHookSource,
  parseCopilotHooks,
  parseHooksFromFile,
  parseHooksIgnoringDisableAll
};
