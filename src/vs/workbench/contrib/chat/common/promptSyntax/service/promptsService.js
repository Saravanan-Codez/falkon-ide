import { ExtensionIdentifier } from "../../../../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { PromptsType } from "../promptTypes.js";
import { isEqual } from "../../../../../../base/common/resources.js";
function newInstructionsCollectionEvent() {
  return { applyingInstructionsCount: 0, referencedInstructionsCount: 0, agentInstructionsCount: 0, listedInstructionsCount: 0, totalInstructionsCount: 0, claudeRulesCount: 0, claudeMdCount: 0, claudeAgentsCount: 0 };
}
function newInstructionsCollectionDebugInfo() {
  return { debugDetails: [], durationInMillis: 0 };
}
const CUSTOM_AGENT_PROVIDER_ACTIVATION_EVENT = "onCustomAgentProvider";
const INSTRUCTIONS_PROVIDER_ACTIVATION_EVENT = "onInstructionsProvider";
const PROMPT_FILE_PROVIDER_ACTIVATION_EVENT = "onPromptFileProvider";
const SKILL_PROVIDER_ACTIVATION_EVENT = "onSkillProvider";
function matchesSessionType(sessionTypes, currentSessionType) {
  return sessionTypes === void 0 || currentSessionType === void 0 || sessionTypes.includes(currentSessionType);
}
const IPromptsService = createDecorator("IPromptsService");
var PromptsStorage = /* @__PURE__ */ ((PromptsStorage2) => {
  PromptsStorage2["local"] = "local";
  PromptsStorage2["user"] = "user";
  PromptsStorage2["extension"] = "extension";
  PromptsStorage2["plugin"] = "plugin";
  PromptsStorage2["builtIn"] = "builtin";
  return PromptsStorage2;
})(PromptsStorage || {});
function isUserToggleableCustomization(type, storage) {
  return type === PromptsType.skill && storage === "builtin" /* builtIn */;
}
function isExtensionPromptPath(obj) {
  return obj.storage === "extension" /* extension */;
}
function isBuiltinPromptPath(obj) {
  return obj.storage === "builtin" /* builtIn */;
}
var IAgentSource;
((IAgentSource2) => {
  function fromPromptPath(promptPath) {
    if (promptPath.storage === "extension" /* extension */) {
      return { storage: "extension" /* extension */, extensionId: promptPath.extension.identifier };
    } else if (promptPath.storage === "plugin" /* plugin */) {
      return { storage: "plugin" /* plugin */, pluginUri: promptPath.pluginUri };
    } else {
      return { storage: promptPath.storage };
    }
  }
  IAgentSource2.fromPromptPath = fromPromptPath;
  function isEquals(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    if (a.storage !== b.storage) {
      return false;
    }
    if (a.storage === "extension" /* extension */ && b.storage === "extension" /* extension */) {
      return ExtensionIdentifier.equals(a.extensionId, b.extensionId);
    } else if (a.storage === "plugin" /* plugin */ && b.storage === "plugin" /* plugin */) {
      return isEqual(a.pluginUri, b.pluginUri);
    }
    return true;
  }
  IAgentSource2.isEquals = isEquals;
})(IAgentSource || (IAgentSource = {}));
function isCustomAgentVisibility(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const v = obj;
  return typeof v.userInvocable === "boolean" && typeof v.agentInvocable === "boolean";
}
var AgentInstructionFileType = /* @__PURE__ */ ((AgentInstructionFileType2) => {
  AgentInstructionFileType2["agentsMd"] = "agentsMd";
  AgentInstructionFileType2["claudeMd"] = "claudeMd";
  AgentInstructionFileType2["copilotInstructionsMd"] = "copilotInstructionsMd";
  return AgentInstructionFileType2;
})(AgentInstructionFileType || {});
export {
  AgentInstructionFileType,
  CUSTOM_AGENT_PROVIDER_ACTIVATION_EVENT,
  IAgentSource,
  INSTRUCTIONS_PROVIDER_ACTIVATION_EVENT,
  IPromptsService,
  PROMPT_FILE_PROVIDER_ACTIVATION_EVENT,
  PromptsStorage,
  SKILL_PROVIDER_ACTIVATION_EVENT,
  isBuiltinPromptPath,
  isCustomAgentVisibility,
  isExtensionPromptPath,
  isUserToggleableCustomization,
  matchesSessionType,
  newInstructionsCollectionDebugInfo,
  newInstructionsCollectionEvent
};
