var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../../nls.js";
import { ILanguageModelsService } from "../../languageModels.js";
import { ILanguageModelToolsService, isToolSet } from "../../tools/languageModelToolsService.js";
import { IChatModeService, isBuiltinChatMode } from "../../chatModes.js";
import { getPromptsTypeForLanguageId, PromptsType, Target } from "../promptTypes.js";
import { IPromptsService } from "../service/promptsService.js";
import { parseCommaSeparatedList, PromptHeaderAttributes } from "../promptFileParser.js";
import { ClaudeHeaderAttributes, getAttributeDefinition, getTarget, isVSCodeOrDefaultTarget, knownClaudeModels, knownClaudeTools } from "./promptFileAttributes.js";
import { HOOKS_BY_TARGET, HOOK_METADATA } from "../hookTypes.js";
import { HOOK_COMMAND_FIELD_DESCRIPTIONS } from "../hookSchema.js";
let PromptHoverProvider = class {
  constructor(promptsService, languageModelToolsService, languageModelsService, chatModeService) {
    this.promptsService = promptsService;
    this.languageModelToolsService = languageModelToolsService;
    this.languageModelsService = languageModelsService;
    this.chatModeService = chatModeService;
    /**
     * Debug display name for this provider.
     */
    this._debugDisplayName = "PromptHoverProvider";
  }
  createHover(contents, range) {
    return {
      contents: [new MarkdownString(contents)],
      range
    };
  }
  async provideHover(model, position, token, _context) {
    const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
    if (!promptType) {
      return void 0;
    }
    const promptAST = this.promptsService.getParsedPromptFile(model);
    const target = getTarget(promptType, promptAST.header ?? model.uri);
    if (promptAST.header?.range.containsPosition(position)) {
      return this.provideHeaderHover(position, promptType, promptAST.header, target);
    }
    if (promptAST.body?.range.containsPosition(position)) {
      return this.provideBodyHover(position, promptAST.body, target);
    }
    return void 0;
  }
  async provideBodyHover(position, body, target) {
    for (const ref of body.variableReferences) {
      if (ref.range.containsPosition(position)) {
        const toolName = ref.name;
        return this.getToolHoverByName(toolName, ref.range, target);
      }
    }
    return void 0;
  }
  async provideHeaderHover(position, promptType, header, target) {
    for (const attribute of header.attributes) {
      if (attribute.range.containsPosition(position)) {
        const description = getAttributeDefinition(attribute.key, promptType, target)?.description;
        if (description) {
          switch (attribute.key) {
            case PromptHeaderAttributes.model:
              return this.getModelHover(attribute, position, description, target);
            case PromptHeaderAttributes.tools:
            case ClaudeHeaderAttributes.disallowedTools:
              return this.getToolHover(attribute, position, description, target);
            case PromptHeaderAttributes.agent:
            case PromptHeaderAttributes.mode:
              return this.getAgentHover(attribute, position, description);
            case PromptHeaderAttributes.handOffs:
              return this.getHandsOffHover(attribute, position, target);
            case PromptHeaderAttributes.hooks:
              return this.getHooksHover(attribute, position, description, target);
            case PromptHeaderAttributes.infer:
              return this.createHover(description + "\n\n" + localize("promptHeader.attribute.infer.hover", "Deprecated: Use `user-invocable` and `disable-model-invocation` instead."), attribute.range);
            default:
              return this.createHover(description, attribute.range);
          }
        }
      }
    }
    return void 0;
  }
  getToolHover(node, position, baseMessage, target) {
    let value = node.value;
    if (value.type === "scalar") {
      value = parseCommaSeparatedList(value);
    }
    if (value.type === "sequence") {
      for (const toolName of value.items) {
        if (toolName.type === "scalar" && toolName.range.containsPosition(position)) {
          const description = this.getToolHoverByName(toolName.value, toolName.range, target);
          if (description) {
            return description;
          }
        }
      }
    }
    return this.createHover(baseMessage, node.range);
  }
  getToolHoverByName(toolName, range, target) {
    if (target === Target.Claude) {
      const description = knownClaudeTools.find((tool2) => tool2.name === toolName)?.description;
      if (description) {
        return this.createHover(description, range);
      }
      return void 0;
    }
    const tool = this.languageModelToolsService.getToolByFullReferenceName(toolName);
    if (tool !== void 0) {
      if (isToolSet(tool)) {
        return this.getToolsetHover(tool, range);
      } else {
        return this.createHover(tool.userDescription ?? tool.modelDescription, range);
      }
    }
    return void 0;
  }
  getToolsetHover(toolSet, range) {
    const lines = [];
    lines.push(localize("toolSetName", "ToolSet: {0}\n\n", toolSet.referenceName));
    if (toolSet.description) {
      lines.push(toolSet.description);
    }
    for (const tool of toolSet.getTools()) {
      lines.push(`- ${tool.toolReferenceName ?? tool.displayName}`);
    }
    return this.createHover(lines.join("\n"), range);
  }
  getModelHover(node, position, baseMessage, target) {
    if (target === Target.GitHubCopilot) {
      return this.createHover(baseMessage + "\n\n" + localize("promptHeader.agent.model.githubCopilot", "Note: This attribute is not used when target is github-copilot."), node.range);
    }
    const modelHoverContent = (modelName) => {
      const lines = [];
      lines.push(baseMessage + "\n");
      if (target === Target.Claude) {
        const claudeModel = knownClaudeModels.find((model) => model.name === modelName);
        if (!claudeModel) {
          return this.createHover(lines.join("\n"), node.range);
        }
        if (claudeModel.modelEquivalent) {
          lines.push(localize("claudeModelEquivalent", "Claude model `{0}` maps to the following model:\n", modelName));
          modelName = claudeModel.modelEquivalent;
        } else {
          lines.push(claudeModel.description);
          return this.createHover(lines.join("\n"), node.range);
        }
      }
      const result = this.languageModelsService.lookupLanguageModelByQualifiedName(modelName);
      if (result) {
        const meta = result.metadata;
        lines.push(localize("modelName", "- Name: {0}", meta.name));
        lines.push(localize("modelFamily", "- Family: {0}", meta.family));
        lines.push(localize("modelVendor", "- Vendor: {0}", meta.vendor));
        if (meta.tooltip) {
          lines.push("", "", meta.tooltip);
        }
        return this.createHover(lines.join("\n"), node.range);
      }
      return void 0;
    };
    if (node.value.type === "scalar") {
      const hover = modelHoverContent(node.value.value);
      if (hover) {
        return hover;
      }
    } else if (node.value.type === "sequence") {
      for (const item of node.value.items) {
        if (item.type === "scalar" && item.range.containsPosition(position)) {
          const hover = modelHoverContent(item.value);
          if (hover) {
            return hover;
          }
        }
      }
    }
    return this.createHover(baseMessage, node.range);
  }
  async getAgentHover(agentAttribute, position, baseMessage) {
    const lines = [];
    const value = agentAttribute.value;
    if (value.type === "scalar" && value.range.containsPosition(position)) {
      const agent = (await this.chatModeService.getLocalModes()).findModeByName(value.value);
      if (agent) {
        const description = agent.description.get() || (isBuiltinChatMode(agent) ? localize("promptHeader.prompt.agent.builtInDesc", "Built-in agent") : localize("promptHeader.prompt.agent.customDesc", "Custom agent"));
        lines.push(`\`${agent.name.get()}\`: ${description}`);
      }
    } else {
      const agents = await this.chatModeService.getLocalModes();
      lines.push(baseMessage);
      lines.push("");
      lines.push(localize("promptHeader.prompt.agent.builtin", "**Built-in agents:**"));
      for (const agent of agents.builtin) {
        lines.push(`- \`${agent.name.get()}\`: ${agent.description.get() || agent.label.get()}`);
      }
      if (agents.custom.length > 0) {
        lines.push("");
        lines.push(localize("promptHeader.prompt.agent.custom", "**Custom agents:**"));
        for (const agent of agents.custom) {
          const description = agent.description.get();
          lines.push(`- \`${agent.name.get()}\`: ${description || localize("promptHeader.prompt.agent.customDesc", "Custom agent")}`);
        }
      }
    }
    return this.createHover(lines.join("\n"), agentAttribute.range);
  }
  getHooksHover(attribute, position, baseMessage, target) {
    const value = attribute.value;
    if (value.type === "map") {
      const hooksByTarget = HOOKS_BY_TARGET[target] ?? HOOKS_BY_TARGET[Target.Undefined];
      for (const prop of value.properties) {
        if (prop.key.range.containsPosition(position)) {
          const hookType = hooksByTarget[prop.key.value];
          if (hookType) {
            const meta = HOOK_METADATA[hookType];
            return this.createHover(`**${meta.label}**

${meta.description}`, prop.key.range);
          }
        }
        if (prop.value.type === "sequence") {
          const hover = this.getHookCommandItemHover(prop.value, position);
          if (hover) {
            return hover;
          }
        }
      }
    }
    return this.createHover(baseMessage, attribute.range);
  }
  /**
   * Recursively searches hook command items for hover information.
   * Handles both direct command objects and nested matcher format
   * (e.g., `{ matcher: "...", hooks: [{ type: command, ... }] }`).
   */
  getHookCommandItemHover(sequence, position) {
    for (const item of sequence.items) {
      if (item.type !== "map" || !item.range.containsPosition(position)) {
        continue;
      }
      const nestedHooks = item.properties.find((p) => p.key.value === "hooks");
      if (nestedHooks && nestedHooks.value.type === "sequence") {
        const hover = this.getHookCommandItemHover(nestedHooks.value, position);
        if (hover) {
          return hover;
        }
      }
      for (const field of item.properties) {
        if (field.key.range.containsPosition(position) || field.value.range.containsPosition(position)) {
          const desc = HOOK_COMMAND_FIELD_DESCRIPTIONS[field.key.value];
          if (desc) {
            return this.createHover(desc, field.key.range);
          }
        }
      }
    }
    return void 0;
  }
  getHandsOffHover(attribute, position, target) {
    const handoffsBaseMessage = getAttributeDefinition(PromptHeaderAttributes.handOffs, PromptsType.agent, target)?.description;
    if (!isVSCodeOrDefaultTarget(target)) {
      return this.createHover(handoffsBaseMessage + "\n\n" + localize("promptHeader.agent.handoffs.githubCopilot", "Note: This attribute is not used in GitHub Copilot or Claude targets."), attribute.range);
    }
    return this.createHover(handoffsBaseMessage, attribute.range);
  }
};
PromptHoverProvider = __decorateClass([
  __decorateParam(0, IPromptsService),
  __decorateParam(1, ILanguageModelToolsService),
  __decorateParam(2, ILanguageModelsService),
  __decorateParam(3, IChatModeService)
], PromptHoverProvider);
export {
  PromptHoverProvider
};
