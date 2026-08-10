import { Codicon } from "../../../../../base/common/codicons.js";
import { localize } from "../../../../../nls.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import { AICustomizationSources } from "../../common/aiCustomizationWorkspaceService.js";
const aiCustomizationViewIcon = registerIcon("ai-customization-view-icon", Codicon.sparkle, localize("aiCustomizationViewIcon", "Icon for the Agent Customization view."));
const agentIcon = registerIcon("ai-customization-agent", Codicon.agent, localize("aiCustomizationAgentIcon", "Icon for custom agents."));
const skillIcon = registerIcon("ai-customization-skill", Codicon.lightbulb, localize("aiCustomizationSkillIcon", "Icon for skills."));
const instructionsIcon = registerIcon("ai-customization-instructions", Codicon.book, localize("aiCustomizationInstructionsIcon", "Icon for instruction files."));
const promptIcon = registerIcon("ai-customization-prompt", Codicon.bookmark, localize("aiCustomizationPromptIcon", "Icon for prompt files."));
const hookIcon = registerIcon("ai-customization-hook", Codicon.zap, localize("aiCustomizationHookIcon", "Icon for hooks."));
const automationIcon = registerIcon("ai-customization-automation", Codicon.watch, localize("aiCustomizationAutomationIcon", "Icon for scheduled automations."));
const addIcon = registerIcon("ai-customization-add", Codicon.add, localize("aiCustomizationAddIcon", "Icon for adding new items."));
const runIcon = registerIcon("ai-customization-run", Codicon.play, localize("aiCustomizationRunIcon", "Icon for running a prompt or agent."));
const workspaceIcon = registerIcon("ai-customization-workspace", Codicon.folder, localize("aiCustomizationWorkspaceIcon", "Icon for workspace items."));
const userIcon = registerIcon("ai-customization-user", Codicon.account, localize("aiCustomizationUserIcon", "Icon for user items."));
const extensionIcon = registerIcon("ai-customization-extension", Codicon.extensions, localize("aiCustomizationExtensionIcon", "Icon for extension-contributed items."));
const pluginIcon = registerIcon("ai-customization-plugin", Codicon.plug, localize("aiCustomizationPluginIcon", "Icon for plugin-contributed items."));
const toolsIcon = registerIcon("ai-customization-tools", Codicon.tools, localize("aiCustomizationToolsIcon", "Icon for the Tools section."));
const builtinIcon = registerIcon("ai-customization-builtin", Codicon.starFull, localize("aiCustomizationBuiltinIcon", "Icon for built-in items."));
const mcpServerIcon = registerIcon("ai-customization-mcp-server", Codicon.server, localize("aiCustomizationMcpServerIcon", "Icon for MCP servers."));
function sourceToIcon(source) {
  switch (source) {
    case AICustomizationSources.local:
      return workspaceIcon;
    case AICustomizationSources.user:
      return userIcon;
    case AICustomizationSources.extension:
      return extensionIcon;
    case AICustomizationSources.plugin:
      return pluginIcon;
    case AICustomizationSources.builtin:
      return builtinIcon;
    default:
      return instructionsIcon;
  }
}
export {
  addIcon,
  agentIcon,
  aiCustomizationViewIcon,
  automationIcon,
  builtinIcon,
  extensionIcon,
  hookIcon,
  instructionsIcon,
  mcpServerIcon,
  pluginIcon,
  promptIcon,
  runIcon,
  skillIcon,
  sourceToIcon,
  toolsIcon,
  userIcon,
  workspaceIcon
};
