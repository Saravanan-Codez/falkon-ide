import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IAICustomizationWorkspaceService = createDecorator("aiCustomizationWorkspaceService");
var AICustomizationSources;
((AICustomizationSources2) => {
  AICustomizationSources2.local = "local";
  AICustomizationSources2.user = "user";
  AICustomizationSources2.extension = "extension";
  AICustomizationSources2.plugin = "plugin";
  AICustomizationSources2.builtin = "builtin";
  AICustomizationSources2.all = [AICustomizationSources2.local, AICustomizationSources2.user, AICustomizationSources2.extension, AICustomizationSources2.plugin, AICustomizationSources2.builtin];
})(AICustomizationSources || (AICustomizationSources = {}));
const BUILTIN_STORAGE = AICustomizationSources.builtin;
const AICustomizationManagementSection = {
  Agents: "agents",
  Skills: "skills",
  Instructions: "instructions",
  Prompts: "prompts",
  Hooks: "hooks",
  Automations: "automations",
  McpServers: "mcpServers",
  Plugins: "plugins",
  Models: "models",
  Tools: "tools",
  HarnessSettings: "harnessSettings"
};
export {
  AICustomizationManagementSection,
  AICustomizationSources,
  BUILTIN_STORAGE,
  IAICustomizationWorkspaceService
};
