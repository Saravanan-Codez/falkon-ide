import { HOOKS_BY_TARGET } from "./hookTypes.js";
import { Target } from "./promptTypes.js";
const COPILOT_CLI_HOOK_TYPE_MAP = HOOKS_BY_TARGET[Target.GitHubCopilot];
let _hookTypeToCopilotCliName;
function getHookTypeToCopilotCliNameMap() {
  if (!_hookTypeToCopilotCliName) {
    _hookTypeToCopilotCliName = /* @__PURE__ */ new Map();
    for (const [copilotCliName, hookType] of Object.entries(COPILOT_CLI_HOOK_TYPE_MAP)) {
      _hookTypeToCopilotCliName.set(hookType, copilotCliName);
    }
  }
  return _hookTypeToCopilotCliName;
}
function resolveCopilotCliHookType(name) {
  return COPILOT_CLI_HOOK_TYPE_MAP[name];
}
function getCopilotCliHookTypeName(hookType) {
  return getHookTypeToCopilotCliNameMap().get(hookType);
}
export {
  getCopilotCliHookTypeName,
  resolveCopilotCliHookType
};
