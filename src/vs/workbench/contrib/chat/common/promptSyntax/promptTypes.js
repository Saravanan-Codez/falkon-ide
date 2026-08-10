import { localize } from "../../../../../nls.js";
const PROMPT_DOCUMENTATION_URL = "https://aka.ms/vscode-ghcp-prompt-snippets";
const INSTRUCTIONS_DOCUMENTATION_URL = "https://aka.ms/vscode-ghcp-custom-instructions";
const AGENT_DOCUMENTATION_URL = "https://aka.ms/vscode-ghcp-custom-chat-modes";
const SKILL_DOCUMENTATION_URL = "https://aka.ms/vscode-agent-skills";
const HOOK_DOCUMENTATION_URL = "https://aka.ms/vscode-chat-hooks";
const PROMPT_LANGUAGE_ID = "prompt";
const INSTRUCTIONS_LANGUAGE_ID = "instructions";
const AGENT_LANGUAGE_ID = "chatagent";
const SKILL_LANGUAGE_ID = "skill";
const ALL_PROMPTS_LANGUAGE_SELECTOR = [PROMPT_LANGUAGE_ID, INSTRUCTIONS_LANGUAGE_ID, AGENT_LANGUAGE_ID, SKILL_LANGUAGE_ID];
const AGENT_DEBUG_LOG_ENABLED_SETTING = "github.copilot.chat.agentDebugLog.enabled";
const AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING = "github.copilot.chat.agentDebugLog.fileLogging.enabled";
const AgentHostAgentDebugLogEnabledSettingId = "chat.agentHost.agentDebugLog.enabled";
const AgentHostAgentDebugLogMaxEventsSettingId = "chat.agentHost.agentDebugLog.maxEventsInMemory";
const TROUBLESHOOT_COMMAND_NAME = "troubleshoot";
const COPILOT_SKILL_URI_SCHEME = "copilot-skill";
const TROUBLESHOOT_SKILL_PATH = "troubleshoot/SKILL.md";
function getLanguageIdForPromptsType(type) {
  switch (type) {
    case "prompt" /* prompt */:
      return PROMPT_LANGUAGE_ID;
    case "instructions" /* instructions */:
      return INSTRUCTIONS_LANGUAGE_ID;
    case "agent" /* agent */:
      return AGENT_LANGUAGE_ID;
    case "skill" /* skill */:
      return SKILL_LANGUAGE_ID;
    case "hook" /* hook */:
      return "jsonc";
    default:
      throw new Error(`Unknown prompt type: ${type}`);
  }
}
function getPromptsTypeForLanguageId(languageId) {
  switch (languageId) {
    case PROMPT_LANGUAGE_ID:
      return "prompt" /* prompt */;
    case INSTRUCTIONS_LANGUAGE_ID:
      return "instructions" /* instructions */;
    case AGENT_LANGUAGE_ID:
      return "agent" /* agent */;
    case SKILL_LANGUAGE_ID:
      return "skill" /* skill */;
    // Note: hook uses 'jsonc' language ID which is shared, so we don't map it here
    default:
      return void 0;
  }
}
var PromptsType = /* @__PURE__ */ ((PromptsType2) => {
  PromptsType2["instructions"] = "instructions";
  PromptsType2["prompt"] = "prompt";
  PromptsType2["agent"] = "agent";
  PromptsType2["skill"] = "skill";
  PromptsType2["hook"] = "hook";
  return PromptsType2;
})(PromptsType || {});
function isValidPromptType(type) {
  return Object.values(PromptsType).includes(type);
}
var Target = /* @__PURE__ */ ((Target2) => {
  Target2["VSCode"] = "vscode";
  Target2["GitHubCopilot"] = "github-copilot";
  Target2["Claude"] = "claude";
  Target2["Undefined"] = "undefined";
  return Target2;
})(Target || {});
var PromptFileSource = /* @__PURE__ */ ((PromptFileSource2) => {
  PromptFileSource2["GitHubWorkspace"] = "github-workspace";
  PromptFileSource2["CopilotPersonal"] = "copilot-personal";
  PromptFileSource2["ClaudePersonal"] = "claude-personal";
  PromptFileSource2["ClaudeWorkspace"] = "claude-workspace";
  PromptFileSource2["ClaudeWorkspaceLocal"] = "claude-workspace-local";
  PromptFileSource2["AgentsWorkspace"] = "agents-workspace";
  PromptFileSource2["AgentsPersonal"] = "agents-personal";
  PromptFileSource2["ConfigWorkspace"] = "config-workspace";
  PromptFileSource2["ConfigPersonal"] = "config-personal";
  PromptFileSource2["UserData"] = "user-data";
  PromptFileSource2["ExtensionContribution"] = "extension-contribution";
  PromptFileSource2["ExtensionAPI"] = "extension-api";
  PromptFileSource2["Plugin"] = "plugin";
  return PromptFileSource2;
})(PromptFileSource || {});
function getSourceDescription(source) {
  switch (source) {
    case "agents-workspace" /* AgentsWorkspace */:
      return localize("source.agentsWorkspace", "Workspace");
    case "agents-personal" /* AgentsPersonal */:
      return localize("source.agentsPersonal", "Global");
    case "github-workspace" /* GitHubWorkspace */:
      return localize("source.githubWorkspace", "Workspace (only used by Copilot agents)");
    case "copilot-personal" /* CopilotPersonal */:
      return localize("source.copilotPersonal", "Global (only used by Copilot agents)");
    case "claude-workspace" /* ClaudeWorkspace */:
      return localize("source.claudeWorkspace", "Workspace (only used by Claude agents)");
    case "claude-workspace-local" /* ClaudeWorkspaceLocal */:
      return localize("source.claudeWorkspaceLocal", "Workspace (only used by Claude agents, usually git-ignored)");
    case "claude-personal" /* ClaudePersonal */:
      return localize("source.claudePersonal", "Global (only used by Claude agents)");
    case "user-data" /* UserData */:
      return localize("source.userData", "Global (roams with Settings Sync, only used by VS Code)");
    case "config-workspace" /* ConfigWorkspace */:
      return localize("source.configWorkspace", "Workspace (contributed from settings)");
    case "config-personal" /* ConfigPersonal */:
      return localize("source.configPersonal", "Global (contributed from settings)");
    default:
      return void 0;
  }
}
export {
  AGENT_DEBUG_LOG_ENABLED_SETTING,
  AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING,
  AGENT_DOCUMENTATION_URL,
  AGENT_LANGUAGE_ID,
  ALL_PROMPTS_LANGUAGE_SELECTOR,
  AgentHostAgentDebugLogEnabledSettingId,
  AgentHostAgentDebugLogMaxEventsSettingId,
  COPILOT_SKILL_URI_SCHEME,
  HOOK_DOCUMENTATION_URL,
  INSTRUCTIONS_DOCUMENTATION_URL,
  INSTRUCTIONS_LANGUAGE_ID,
  PROMPT_DOCUMENTATION_URL,
  PROMPT_LANGUAGE_ID,
  PromptFileSource,
  PromptsType,
  SKILL_DOCUMENTATION_URL,
  SKILL_LANGUAGE_ID,
  TROUBLESHOOT_COMMAND_NAME,
  TROUBLESHOOT_SKILL_PATH,
  Target,
  getLanguageIdForPromptsType,
  getPromptsTypeForLanguageId,
  getSourceDescription,
  isValidPromptType
};
