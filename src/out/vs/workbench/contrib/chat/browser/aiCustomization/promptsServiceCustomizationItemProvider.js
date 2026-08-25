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
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { OS } from "../../../../../base/common/platform.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { localize } from "../../../../../nls.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IAICustomizationWorkspaceService, AICustomizationSources } from "../../common/aiCustomizationWorkspaceService.js";
import { HookType, HOOK_METADATA } from "../../common/promptSyntax/hookTypes.js";
import { formatHookCommandLabel } from "../../common/promptSyntax/hookSchema.js";
import { PromptsType, getSourceDescription } from "../../common/promptSyntax/promptTypes.js";
import { IPromptsService, matchesSessionType, PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
import { BUILTIN_STORAGE } from "./aiCustomizationManagement.js";
import { getFriendlyName, isChatExtensionItem } from "./aiCustomizationItemSource.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
let PromptsServiceCustomizationItemProvider = class {
  constructor(promptsService, workspaceService, productService) {
    this.promptsService = promptsService;
    this.workspaceService = workspaceService;
    this.productService = productService;
    this.onDidChange = Event.any(
      this.promptsService.onDidChangeCustomAgents,
      this.promptsService.onDidChangeSlashCommands,
      this.promptsService.onDidChangeSkills,
      this.promptsService.onDidChangeHooks,
      this.promptsService.onDidChangeInstructions,
      this.promptsService.onDidChangeAgentInstructions
    );
  }
  async provideChatSessionCustomizations(_sessionResource, token) {
    const itemSets = await Promise.all([
      this.provideCustomizations(PromptsType.agent, token),
      this.provideCustomizations(PromptsType.skill, token),
      this.provideCustomizations(PromptsType.instructions, token),
      this.provideCustomizations(PromptsType.hook, token),
      this.provideCustomizations(PromptsType.prompt, token)
    ]);
    return itemSets.flat();
  }
  async provideCustomAgents(sessionResource, token) {
    const sessionType = getChatSessionType(sessionResource);
    const agents = await this.promptsService.getCustomAgents(token);
    return agents.filter((agent) => matchesSessionType(agent.sessionTypes, sessionType));
  }
  async provideSourceFolders(_sessionResource, type, _token) {
    const folders = await this.promptsService.getSourceFolders(type);
    return folders.map((folder) => ({
      uri: folder.uri,
      // Prefer the source-specific description (e.g. "Global (only used by
      // Copilot agents)") over the generic "User Data" label so personal
      // folders like ~/.copilot/skills read naturally. Only folders that
      // carry a source (currently skills) use this; others fall back.
      label: (folder.source !== void 0 ? getSourceDescription(folder.source) : void 0) ?? this.promptsService.getPromptLocationLabel(folder),
      source: folder.storage
    }));
  }
  async provideCustomizations(promptType, token = CancellationToken.None) {
    const items = [];
    const disabledUris = this.promptsService.getDisabledPromptFiles(promptType);
    const extensionInfoByUri = new ResourceMap();
    if (promptType === PromptsType.agent) {
      const agents = await this.promptsService.getCustomAgents(token);
      const allAgentFiles = await this.promptsService.listPromptFiles(PromptsType.agent, token);
      for (const file of allAgentFiles) {
        if (file.extension) {
          extensionInfoByUri.set(file.uri, { id: file.extension.identifier, displayName: file.extension.displayName });
        }
      }
      for (const agent of agents) {
        items.push({
          uri: agent.uri,
          type: promptType,
          name: agent.name,
          description: agent.description,
          source: agent.source.storage,
          enabled: agent.enabled,
          extensionId: agent.source.storage === PromptsStorage.extension ? agent.source.extensionId.value : void 0,
          pluginUri: agent.source.storage === PromptsStorage.plugin ? agent.source.pluginUri : void 0,
          userInvocable: agent.visibility.userInvocable
        });
        if (agent.source.storage === PromptsStorage.extension && !extensionInfoByUri.has(agent.uri)) {
          extensionInfoByUri.set(agent.uri, { id: agent.source.extensionId });
        }
      }
    } else if (promptType === PromptsType.skill) {
      const skills = await this.promptsService.findAgentSkills(token);
      const allSkillFiles = await this.promptsService.listPromptFiles(PromptsType.skill, token);
      for (const file of allSkillFiles) {
        if (file.extension) {
          extensionInfoByUri.set(file.uri, { id: file.extension.identifier, displayName: file.extension.displayName });
        }
      }
      const uiIntegrations = this.workspaceService.getSkillUIIntegrations();
      const seenUris = new ResourceSet();
      for (const skill of skills || []) {
        const skillName = skill.name || basename(dirname(skill.uri)) || basename(skill.uri);
        seenUris.add(skill.uri);
        const skillFolderName = basename(dirname(skill.uri));
        const uiTooltip = uiIntegrations.get(skillFolderName);
        items.push({
          uri: skill.uri,
          type: promptType,
          name: skillName,
          description: skill.description,
          source: skill.storage,
          enabled: true,
          badge: uiTooltip ? localize("uiIntegrationBadge", "UI Integration") : void 0,
          badgeTooltip: uiTooltip,
          extensionId: skill.extension?.identifier.value,
          pluginUri: skill.pluginUri,
          pluginLabel: skill.pluginLabel,
          userInvocable: skill.userInvocable
        });
      }
      if (disabledUris.size > 0) {
        for (const file of allSkillFiles) {
          if (!seenUris.has(file.uri) && disabledUris.has(file.uri)) {
            const disabledName = file.name || basename(dirname(file.uri)) || basename(file.uri);
            const disabledFolderName = basename(dirname(file.uri));
            const uiTooltip = uiIntegrations.get(disabledFolderName);
            items.push({
              uri: file.uri,
              type: promptType,
              name: disabledName,
              description: file.description,
              source: file.storage,
              enabled: false,
              badge: uiTooltip ? localize("uiIntegrationBadge", "UI Integration") : void 0,
              badgeTooltip: uiTooltip,
              extensionId: file.extension?.identifier.value,
              pluginUri: file.pluginUri,
              pluginLabel: file.pluginLabel,
              userInvocable: false
            });
          }
        }
      }
    } else if (promptType === PromptsType.prompt) {
      const commands = await this.promptsService.getPromptSlashCommands(token);
      for (const command of commands) {
        if (command.type === PromptsType.skill) {
          continue;
        }
        items.push({
          uri: command.uri,
          type: promptType,
          name: command.name,
          description: command.description,
          source: command.storage,
          enabled: !disabledUris.has(command.uri),
          extensionId: command.extension?.identifier.value,
          pluginUri: command.pluginUri,
          pluginLabel: command.pluginLabel,
          userInvocable: command.userInvocable
        });
        if (command.extension) {
          extensionInfoByUri.set(command.uri, { id: command.extension.identifier, displayName: command.extension.displayName });
        }
      }
    } else if (promptType === PromptsType.hook) {
      await this.fetchPromptServiceHooks(items, disabledUris, promptType);
    } else {
      await this.fetchPromptServiceInstructions(items, extensionInfoByUri, disabledUris, promptType);
    }
    return this.applyBuiltinGroupKeys(items, extensionInfoByUri);
  }
  async fetchPromptServiceHooks(items, disabledUris, promptType) {
    const hookFiles = await this.promptsService.listPromptFiles(PromptsType.hook, CancellationToken.None);
    for (const f of hookFiles) {
      items.push({
        uri: f.uri,
        type: promptType,
        name: f.name || getFriendlyName(basename(f.uri)),
        source: f.storage,
        enabled: !disabledUris.has(f.uri),
        extensionId: f.extension?.identifier.value,
        pluginUri: f.pluginUri,
        userInvocable: void 0
      });
    }
    const agents = !this.workspaceService.isSessionsWindow ? await this.promptsService.getCustomAgents(CancellationToken.None) : [];
    for (const agent of agents) {
      if (!agent.hooks || !agent.enabled) {
        continue;
      }
      for (const hookType of Object.values(HookType)) {
        const hookCommands = agent.hooks[hookType];
        if (!hookCommands || hookCommands.length === 0) {
          continue;
        }
        const hookMeta = HOOK_METADATA[hookType];
        for (let i = 0; i < hookCommands.length; i++) {
          const hook = hookCommands[i];
          const cmdLabel = formatHookCommandLabel(hook, OS);
          const truncatedCmd = cmdLabel.length > 60 ? cmdLabel.substring(0, 57) + "..." : cmdLabel;
          items.push({
            uri: agent.uri,
            type: promptType,
            name: hookMeta?.label ?? hookType,
            description: `${agent.name}: ${truncatedCmd || localize("hookUnset", "(unset)")}`,
            source: agent.source.storage,
            groupKey: "agents",
            enabled: !disabledUris.has(agent.uri),
            extensionId: agent.source.storage === PromptsStorage.extension ? agent.source.extensionId.value : void 0,
            pluginUri: agent.source.storage === PromptsStorage.plugin ? agent.source.pluginUri : void 0,
            userInvocable: void 0
          });
        }
      }
    }
  }
  async fetchPromptServiceInstructions(items, extensionInfoByUri, disabledUris, promptType) {
    const instructionFiles = await this.promptsService.getInstructionFiles(CancellationToken.None);
    for (const file of instructionFiles) {
      if (file.extension) {
        extensionInfoByUri.set(file.uri, { id: file.extension.identifier, displayName: file.extension.displayName });
      }
    }
    const agentInstructionFiles = await this.promptsService.listAgentInstructions(CancellationToken.None, void 0);
    const agentInstructionUris = new ResourceSet(agentInstructionFiles.map((f) => f.uri));
    for (const file of agentInstructionFiles) {
      const storage = PromptsStorage.local;
      const filename = basename(file.uri);
      items.push({
        uri: file.uri,
        type: promptType,
        name: filename,
        source: storage,
        groupKey: "agent-instructions",
        enabled: !disabledUris.has(file.uri),
        extensionId: void 0,
        pluginUri: void 0,
        userInvocable: void 0
      });
    }
    for (const { uri, pattern, name, description, storage, extension, pluginUri } of instructionFiles) {
      if (agentInstructionUris.has(uri)) {
        continue;
      }
      const friendlyName = getFriendlyName(name);
      if (pattern !== void 0) {
        const badge = pattern === "**" ? localize("alwaysAdded", "always added") : pattern;
        const badgeTooltip = pattern === "**" ? localize("alwaysAddedTooltip", "This instruction is automatically included in every interaction.") : localize("onContextTooltip", "This instruction is automatically included when files matching '{0}' are in context.", pattern);
        items.push({
          uri,
          type: promptType,
          name: friendlyName,
          badge,
          badgeTooltip,
          description,
          source: storage,
          groupKey: "context-instructions",
          enabled: !disabledUris.has(uri),
          extensionId: extension?.identifier.value,
          pluginUri,
          userInvocable: void 0
        });
      } else {
        items.push({
          uri,
          type: promptType,
          name: friendlyName,
          description,
          source: storage,
          groupKey: "on-demand-instructions",
          enabled: !disabledUris.has(uri),
          extensionId: extension?.identifier.value,
          pluginUri,
          userInvocable: void 0
        });
      }
    }
  }
  applyBuiltinGroupKeys(items, extensionInfoByUri) {
    return items.map((item) => {
      if (item.source !== AICustomizationSources.extension) {
        return item;
      }
      const extInfo = extensionInfoByUri.get(item.uri);
      if (!extInfo) {
        return item;
      }
      if (isChatExtensionItem(extInfo.id, this.productService)) {
        return {
          ...item,
          groupKey: item.groupKey ?? BUILTIN_STORAGE
        };
      }
      return {
        ...item,
        extensionLabel: extInfo.displayName || extInfo.id.value
      };
    });
  }
};
PromptsServiceCustomizationItemProvider = __decorateClass([
  __decorateParam(0, IPromptsService),
  __decorateParam(1, IAICustomizationWorkspaceService),
  __decorateParam(2, IProductService)
], PromptsServiceCustomizationItemProvider);
export {
  PromptsServiceCustomizationItemProvider
};
