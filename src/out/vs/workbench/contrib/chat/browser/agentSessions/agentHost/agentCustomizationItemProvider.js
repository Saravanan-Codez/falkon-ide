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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { URI } from "../../../../../../base/common/uri.js";
import { extUriBiasedIgnorePathCase } from "../../../../../../base/common/resources.js";
import { CustomizationLoadStatus, CustomizationType } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { SYNCED_CUSTOMIZATION_SCHEME } from "../../../../../services/agentHost/common/agentHostFileSystemService.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { toAgentHostUri } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import { readAgentCustomizationMeta } from "../../../../../../platform/agentHost/common/meta/agentCustomizationMeta.js";
import { AICustomizationSources } from "../../../common/aiCustomizationWorkspaceService.js";
import { PromptsType, Target } from "../../../common/promptSyntax/promptTypes.js";
import { AgentCustomizationContentExpander } from "./agentCustomizationContentExpander.js";
import { IAgentHostCustomizationService } from "./agentHostCustomizationService.js";
import { PromptsStorage } from "../../../common/promptSyntax/service/promptsService.js";
import { getChatSessionType } from "../../../common/model/chatUri.js";
import { localize } from "../../../../../../nls.js";
const REMOTE_HOST_GROUP = "remote-host";
const REMOTE_CLIENT_GROUP = "remote-client";
let AgentCustomizationItemProvider = class extends Disposable {
  constructor(_connectionAuthority, _getItemActions, _resolveSyncedOrigin, _fileService, _logService, _customAgentsService) {
    super();
    this._connectionAuthority = _connectionAuthority;
    this._getItemActions = _getItemActions;
    this._resolveSyncedOrigin = _resolveSyncedOrigin;
    this._fileService = _fileService;
    this._logService = _logService;
    this._customAgentsService = _customAgentsService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    /** Cache: pluginUri → last expansion (keyed by nonce and label so we re-fetch on content or display-name changes). */
    this._expansionCache = new ResourceMap();
    this._contentExpander = new AgentCustomizationContentExpander(this._fileService, this._logService);
    this._register(this._customAgentsService.onDidChangeCustomizations(() => {
      this._onDidChange.fire();
    }));
  }
  setDraftCustomAgents(customAgents) {
    this._draftCustomAgents = customAgents;
    this._register(autorun((reader) => {
      customAgents.read(reader);
      this._onDidChange.fire();
    }));
  }
  setDraftCustomizations(customizations) {
    this._draftCustomizations = customizations;
    this._register(autorun((reader) => {
      customizations.read(reader);
      this._onDidChange.fire();
    }));
  }
  toRemoteUri(customizationUri) {
    const original = URI.parse(customizationUri);
    if (original.scheme === SYNCED_CUSTOMIZATION_SCHEME) {
      return original;
    }
    return toAgentHostUri(original, this._connectionAuthority);
  }
  toBadge(customization, fromClient) {
    if (fromClient) {
      return {
        groupKey: REMOTE_CLIENT_GROUP
      };
    }
    return {
      groupKey: REMOTE_HOST_GROUP
    };
  }
  toItem(customization, source) {
    const clientId = customization.clientId;
    const badge = this.toBadge(customization, clientId !== void 0);
    const uri = this.toRemoteUri(customization.uri);
    return {
      itemKey: customizationItemKey(customization, clientId),
      uri,
      type: "plugin",
      name: customization.name,
      description: void 0,
      source,
      status: toStatusString(customization.load),
      statusMessage: toStatusMessage(customization.load),
      enabled: customization.enabled,
      badge: badge.badge,
      badgeTooltip: badge.badgeTooltip,
      groupKey: badge.groupKey,
      extensionId: void 0,
      pluginUri: uri,
      userInvocable: void 0,
      actions: this._getItemActions?.(customization, clientId)
    };
  }
  toDirectoryItems(customization, source, isRemote) {
    const items = [];
    for (const child of customization.children ?? []) {
      const item = this.toDirectoryChildItem(child, source, isRemote);
      if (item) {
        items.push(item);
      }
    }
    return items;
  }
  toDirectoryChildItem(child, source, isRemote) {
    const type = toPromptsType(child.type);
    if (!type) {
      return void 0;
    }
    let userInvocable = void 0;
    if (child.type === CustomizationType.Agent) {
      userInvocable = readAgentCustomizationMeta(child).userInvocable !== false;
    }
    let groupKey = isRemote ? REMOTE_CLIENT_GROUP : void 0;
    let badge = void 0;
    let badgeTooltip = void 0;
    if (!groupKey && child.type === CustomizationType.Rule) {
      const pattern = child.globs?.[0];
      if (child.globs && child.globs.length > 0) {
        groupKey = "context-instructions";
        badge = pattern === "**" ? localize("alwaysAdded", "always added") : pattern;
        badgeTooltip = pattern === "**" ? localize("alwaysIncluded", "This instruction is automatically included in every interaction.") : localize("contextInstructions", "This instruction is automatically included when files matching '{0}' are in context.", pattern);
      } else if (child.alwaysApply) {
        groupKey = "agent-instructions";
      } else {
        groupKey = "on-demand-instructions";
      }
    }
    return {
      itemKey: child.id,
      uri: this.toRemoteUri(child.uri),
      type,
      name: child.name,
      description: getChildDescription(child),
      source,
      groupKey,
      badge,
      badgeTooltip,
      extensionId: void 0,
      pluginUri: void 0,
      userInvocable
    };
  }
  async provideSourceFolders(sessionResource, type, _token) {
    const workingDirectories = this._customAgentsService.getWorkingDirectories(sessionResource);
    const folders = [];
    for (const customization of this._customAgentsService.getCustomizations(sessionResource)) {
      if (!isDirectoryCustomization(customization) || !customization.writable) {
        continue;
      }
      if (toPromptsType(customization.contents) !== type) {
        continue;
      }
      const source = isUnderAnyRoot(workingDirectories, customization.uri) ? AICustomizationSources.local : AICustomizationSources.user;
      folders.push({
        uri: this.toRemoteUri(customization.uri),
        label: customization.name,
        source
      });
    }
    return folders;
  }
  async provideCustomAgents(sessionResource) {
    const agents = this.getCustomAgents(sessionResource);
    const sessionTypes = [getChatSessionType(sessionResource)];
    return agents.map((agent) => ({
      id: agent.uri,
      uri: this.toRemoteUri(agent.uri),
      name: agent.name,
      description: agent.description,
      sessionTypes,
      enabled: true,
      // fill default/empty values for all other properties they will not be used by the UI
      // when making a request, all that's needed is the agent id.
      source: { storage: PromptsStorage.local },
      tools: void 0,
      agents: void 0,
      argumentHint: void 0,
      handOffs: void 0,
      hooks: void 0,
      model: void 0,
      agentInstructions: { content: "", toolReferences: [] },
      visibility: {
        agentInvocable: true,
        userInvocable: readAgentCustomizationMeta(agent).userInvocable !== false
      },
      target: Target.Undefined
    }));
  }
  async provideChatSessionCustomizations(sessionResource, token) {
    const items = /* @__PURE__ */ new Map();
    const workingDirectories = this._customAgentsService.getWorkingDirectories(sessionResource);
    for (const agent of this.getCustomAgents(sessionResource)) {
      const source = isUnderAnyRoot(workingDirectories, agent.uri) ? AICustomizationSources.local : AICustomizationSources.user;
      items.set(agent.id, {
        itemKey: agent.id,
        uri: this.toRemoteUri(agent.uri),
        type: PromptsType.agent,
        name: agent.name,
        description: agent.description,
        source,
        extensionId: void 0,
        pluginUri: void 0,
        enabled: agent.enabled !== false,
        userInvocable: readAgentCustomizationMeta(agent).userInvocable !== false
      });
    }
    const plugins = [];
    const expandPromises = [];
    const customizations = this.getCustomizations(sessionResource);
    const directoryCustomizations = [];
    for (const sessionCustomization of customizations) {
      if (isDirectoryCustomization(sessionCustomization)) {
        directoryCustomizations.push(sessionCustomization);
      } else if (sessionCustomization.type === CustomizationType.McpServer) {
        continue;
      } else {
        const isBundleItem = isSyntheticBundle(sessionCustomization);
        const isClientSynced = sessionCustomization.clientId !== void 0;
        const childGroupKey = isClientSynced ? REMOTE_CLIENT_GROUP : REMOTE_HOST_GROUP;
        let item;
        if (!isBundleItem) {
          item = this.toItem(sessionCustomization, AICustomizationSources.plugin);
          items.set(customizationItemKey(sessionCustomization, sessionCustomization.clientId), item);
        } else {
          item = { uri: this.toRemoteUri(sessionCustomization.uri), type: "plugin", source: AICustomizationSources.plugin, name: "", groupKey: childGroupKey, extensionId: void 0, pluginUri: void 0 };
        }
        const pluginMeta = {
          item,
          nonce: sessionCustomization.nonce,
          status: toStatusString(sessionCustomization.load),
          statusMessage: toStatusMessage(sessionCustomization.load),
          enabled: sessionCustomization.enabled,
          childGroupKey,
          isBundleItem,
          pluginLabel: isBundleItem ? void 0 : item.name
        };
        plugins.push(pluginMeta);
        expandPromises.push(this._expandPluginContents(pluginMeta, token));
      }
    }
    const expansions = await Promise.all(expandPromises);
    if (token.isCancellationRequested) {
      return [];
    }
    for (let i = 0; i < plugins.length; i++) {
      const p = plugins[i];
      for (const child of expansions[i]) {
        const enriched = p.isBundleItem ? this._applySyncedOrigin(child) : child;
        items.set(enriched.uri.toString(), {
          ...enriched,
          status: p.status,
          statusMessage: p.statusMessage,
          enabled: p.enabled
        });
      }
    }
    for (const sessionCustomization of directoryCustomizations) {
      const source = isUnderAnyRoot(workingDirectories, sessionCustomization.uri) ? AICustomizationSources.local : AICustomizationSources.user;
      const isRemote = sessionCustomization.clientId !== void 0;
      for (const child of this.toDirectoryItems(sessionCustomization, source, isRemote)) {
        items.set(child.itemKey ?? child.uri.toString(), {
          ...child,
          status: toStatusString(sessionCustomization.load),
          statusMessage: toStatusMessage(sessionCustomization.load),
          enabled: sessionCustomization.enabled
        });
      }
    }
    return [...items.values()];
  }
  getCustomAgents(sessionResource) {
    const sessionAgents = this._customAgentsService.getCustomAgents(sessionResource);
    return sessionAgents.length > 0 ? sessionAgents : this._draftCustomAgents?.get() ?? [];
  }
  getCustomizations(sessionResource) {
    const sessionCustomizations = this._customAgentsService.getCustomizations(sessionResource);
    const draftCustomizations = this._draftCustomizations?.get() ?? [];
    if (draftCustomizations.length === 0) {
      return sessionCustomizations;
    }
    const sessionKeys = new Set(sessionCustomizations.map((customization) => `${customization.type}:${customization.uri}`));
    return [
      ...sessionCustomizations,
      ...draftCustomizations.filter((customization) => !sessionKeys.has(`${customization.type}:${customization.uri}`))
    ];
  }
  /**
   * Rewrites a bundle child item to reflect the original source location of
   * the flattened file, when it can be recovered from the synthetic bundle's
   * reverse map. The synced (in-memory) URI is replaced with the real local
   * URI so the item points at its true origin, and the source/extension/plugin
   * metadata is restored. Returns the item unchanged when no origin is known.
   */
  _applySyncedOrigin(child) {
    const origin = this._resolveSyncedOrigin?.(child.uri);
    if (!origin) {
      return child;
    }
    return {
      ...child,
      uri: origin.uri,
      source: origin.source,
      extensionId: origin.extensionId,
      pluginUri: origin.pluginUri,
      groupKey: origin.source === AICustomizationSources.user ? child.groupKey : void 0
    };
  }
  /**
   * Reads a plugin's directory contents through the agent-host
   * filesystem provider and returns one {@link ICustomizationItem} per
   * supported file (agents/skills/instructions/prompts).
   */
  async _expandPluginContents(plugin, token) {
    const cached = this._expansionCache.get(plugin.item.uri);
    if (cached && cached.nonce === plugin.nonce && cached.pluginLabel === plugin.pluginLabel) {
      return cached.children;
    }
    const children = await this._contentExpander.expandPluginContents(plugin.item.uri, plugin.childGroupKey, plugin.isBundleItem, plugin.item.source, plugin.pluginLabel, token);
    this._expansionCache.set(plugin.item.uri, { nonce: plugin.nonce, pluginLabel: plugin.pluginLabel, children });
    return children;
  }
};
AgentCustomizationItemProvider = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IAgentHostCustomizationService)
], AgentCustomizationItemProvider);
function isParentOrEqual(folderURI, childURI) {
  try {
    return extUriBiasedIgnorePathCase.isEqualOrParent(URI.parse(childURI), URI.parse(folderURI));
  } catch {
    return childURI === folderURI || childURI.startsWith(folderURI + "/");
  }
}
function isUnderAnyRoot(roots, childURI) {
  return roots.some((root) => isParentOrEqual(root, childURI));
}
function toStatusString(load) {
  return load?.kind;
}
function toStatusMessage(load) {
  if (load?.kind === CustomizationLoadStatus.Degraded || load?.kind === CustomizationLoadStatus.Error) {
    return load.message;
  }
  return void 0;
}
function customizationKey(customization) {
  return customization.id;
}
function customizationItemKey(customization, clientId) {
  return clientId !== void 0 ? `${customizationKey(customization)}::${clientId}` : customizationKey(customization);
}
function isDirectoryCustomization(customization) {
  return customization.type === CustomizationType.Directory;
}
function toPromptsType(type) {
  switch (type) {
    case CustomizationType.Agent:
      return PromptsType.agent;
    case CustomizationType.Skill:
      return PromptsType.skill;
    case CustomizationType.Rule:
      return PromptsType.instructions;
    case CustomizationType.Prompt:
      return PromptsType.prompt;
    case CustomizationType.Hook:
      return PromptsType.hook;
    default:
      return void 0;
  }
}
function getChildDescription(child) {
  switch (child.type) {
    case CustomizationType.Agent:
    case CustomizationType.Skill:
    case CustomizationType.Prompt:
    case CustomizationType.Rule:
      return child.description;
    default:
      return void 0;
  }
}
function isSyntheticBundle(customization) {
  try {
    return URI.parse(customization.uri).scheme === SYNCED_CUSTOMIZATION_SCHEME;
  } catch {
    return false;
  }
}
export {
  AgentCustomizationItemProvider
};
