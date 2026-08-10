import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { parse as parseJSONC } from "../../../../../base/common/json.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { Schemas } from "../../../../../base/common/network.js";
import { OS } from "../../../../../base/common/platform.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { localize } from "../../../../../nls.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { AICustomizationSources } from "../../common/aiCustomizationWorkspaceService.js";
import { parseHooksFromFile } from "../../common/promptSyntax/hookCompatibility.js";
import { formatHookCommandLabel } from "../../common/promptSyntax/hookSchema.js";
import { HOOK_METADATA } from "../../common/promptSyntax/hookTypes.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
import { sourceToIcon } from "./aiCustomizationIcons.js";
import { BUILTIN_STORAGE } from "./aiCustomizationManagement.js";
function isChatExtensionItem(extensionId, productService) {
  const chatExtensionId = productService.defaultChatAgent?.chatExtensionId;
  return !!chatExtensionId && ExtensionIdentifier.equals(extensionId, chatExtensionId);
}
function getFriendlyName(filename) {
  let name = filename.replace(/\.instructions\.md$/i, "").replace(/\.prompt\.md$/i, "").replace(/\.agent\.md$/i, "").replace(/\.md$/i, "");
  name = name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return name || filename;
}
async function expandHookFileItems(hookFileItems, workspaceService, fileService, pathService) {
  const items = [];
  const activeRoot = workspaceService.getActiveProjectRoot();
  const userHomeUri = await pathService.userHome();
  const userHome = userHomeUri.scheme === Schemas.file ? userHomeUri.fsPath : userHomeUri.path;
  for (const item of hookFileItems) {
    let parsedHooks = false;
    try {
      const content = await fileService.readFile(item.uri);
      const json = parseJSONC(content.value.toString());
      const { hooks } = parseHooksFromFile(item.uri, json, activeRoot, userHome);
      if (hooks.size > 0) {
        parsedHooks = true;
        for (const [hookType, entry] of hooks) {
          const hookMeta = HOOK_METADATA[hookType];
          for (let i = 0; i < entry.hooks.length; i++) {
            const hook = entry.hooks[i];
            const cmdLabel = formatHookCommandLabel(hook, OS);
            const truncatedCmd = cmdLabel.length > 60 ? cmdLabel.substring(0, 57) + "..." : cmdLabel;
            items.push({
              uri: item.uri,
              type: PromptsType.hook,
              name: hookMeta?.label ?? entry.originalId,
              description: truncatedCmd || localize("hookUnset", "(unset)"),
              enabled: item.enabled,
              groupKey: item.groupKey,
              source: item.source,
              extensionId: item.extensionId,
              pluginUri: item.pluginUri,
              userInvocable: item.userInvocable
            });
          }
        }
      }
    } catch {
    }
    if (!parsedHooks) {
      items.push(item);
    }
  }
  return items;
}
class AICustomizationItemNormalizer {
  constructor(labelService, productService) {
    this.labelService = labelService;
    this.productService = productService;
  }
  normalizeItems(items, promptType) {
    const uriUseCounts = new ResourceMap();
    return items.filter((item) => item.type === promptType).map((item) => this.normalizeItem(item, promptType, uriUseCounts)).sort((a, b) => a.name.localeCompare(b.name));
  }
  normalizeItem(item, promptType, uriUseCounts = new ResourceMap()) {
    const { source, groupKey, isBuiltin, extensionId, pluginUri } = this.inferStorageAndGroup(item);
    const seenCount = uriUseCounts.get(item.uri) ?? 0;
    uriUseCounts.set(item.uri, seenCount + 1);
    const duplicateSuffix = seenCount === 0 ? "" : `#${seenCount}`;
    const isWorkspaceItem = source === AICustomizationSources.local;
    return {
      id: `${item.uri.toString()}${duplicateSuffix}`,
      uri: item.uri,
      name: item.name,
      filename: item.uri.scheme === Schemas.file ? this.labelService.getUriLabel(item.uri, { relative: isWorkspaceItem }) : basename(item.uri),
      description: item.description,
      source,
      promptType,
      disabled: item.enabled === false,
      groupKey,
      pluginUri,
      displayName: item.name,
      badge: item.badge,
      badgeTooltip: item.badgeTooltip,
      typeIcon: promptType === PromptsType.instructions && source ? sourceToIcon(source) : void 0,
      isBuiltin,
      extensionId,
      status: item.status,
      statusMessage: item.statusMessage
    };
  }
  inferStorageAndGroup(item) {
    const groupKey = item.groupKey;
    const hasBuiltinStorage = item.source === AICustomizationSources.builtin;
    const isBuiltin = groupKey === BUILTIN_STORAGE || hasBuiltinStorage;
    if (hasBuiltinStorage) {
      return { source: AICustomizationSources.builtin, groupKey: groupKey ?? BUILTIN_STORAGE, isBuiltin: true, extensionId: item.extensionId };
    }
    if (item.source === AICustomizationSources.plugin) {
      return { source: AICustomizationSources.plugin, pluginUri: item.pluginUri, groupKey, isBuiltin };
    }
    if (item.source === AICustomizationSources.extension) {
      if (item.extensionId) {
        const extensionIdentifier = new ExtensionIdentifier(item.extensionId);
        if (isChatExtensionItem(extensionIdentifier, this.productService)) {
          return { source: AICustomizationSources.extension, groupKey: BUILTIN_STORAGE, isBuiltin: true, extensionId: item.extensionId };
        }
      }
      return { source: AICustomizationSources.extension, extensionId: item.extensionId, groupKey, isBuiltin };
    }
    return { source: item.source, groupKey, isBuiltin, pluginUri: item.pluginUri, extensionId: item.extensionId };
  }
}
async function mergeBuiltinSkills(items, promptType, promptsService, workspaceService, itemNormalizer) {
  const builtinPaths = await promptsService.listPromptFilesForStorage(PromptsType.skill, PromptsStorage.builtIn, CancellationToken.None);
  if (builtinPaths.length === 0) {
    return [...items];
  }
  const builtinUris = new ResourceMap();
  for (const p of builtinPaths) {
    builtinUris.set(p.uri, p);
  }
  const deduped = items.filter((item) => !builtinUris.has(item.uri));
  const uiIntegrations = workspaceService.getSkillUIIntegrations();
  const uiIntegrationBadge = localize("uiIntegrationBadge", "UI Integration");
  const overriddenNames = /* @__PURE__ */ new Set();
  for (const item of deduped) {
    if (item.source === AICustomizationSources.local || item.source === AICustomizationSources.user) {
      if (item.name) {
        overriddenNames.add(item.name);
      }
    }
  }
  const uriUseCounts = new ResourceMap();
  for (const item of deduped) {
    uriUseCounts.set(item.uri, (uriUseCounts.get(item.uri) ?? 0) + 1);
  }
  const appended = [];
  const disabledPromptFiles = promptsService.getDisabledPromptFiles(PromptsType.skill);
  for (const p of builtinPaths) {
    const name = p.name ?? basename(p.uri);
    if (overriddenNames.has(name)) {
      continue;
    }
    const folderName = basename(dirname(p.uri));
    const uiTooltip = uiIntegrations.get(folderName);
    const builtinItem = {
      uri: p.uri,
      type: PromptsType.skill,
      name,
      description: p.description,
      source: AICustomizationSources.builtin,
      groupKey: BUILTIN_STORAGE,
      enabled: !disabledPromptFiles.has(p.uri),
      badge: uiTooltip ? uiIntegrationBadge : void 0,
      badgeTooltip: uiTooltip,
      extensionId: void 0,
      pluginUri: void 0,
      userInvocable: true
    };
    appended.push(itemNormalizer.normalizeItem(builtinItem, promptType, uriUseCounts));
  }
  return [...deduped, ...appended];
}
class ItemProviderItemSource extends Disposable {
  constructor(sessionResource, itemProvider, promptsService, workspaceService, fileService, pathService, itemNormalizer) {
    super();
    this.sessionResource = sessionResource;
    this.itemProvider = itemProvider;
    this.promptsService = promptsService;
    this.workspaceService = workspaceService;
    this.fileService = fileService;
    this.pathService = pathService;
    this.itemNormalizer = itemNormalizer;
    this.onDidAICustomizationItemsChange = Event.any(
      this.itemProvider.onDidChange,
      this.promptsService.onDidChangeSkills
    );
    this._register(this.onDidAICustomizationItemsChange(() => {
      this.cachedPromise = void 0;
    }));
  }
  dispose() {
    super.dispose();
    this.cachedPromise = void 0;
  }
  async fetchProviderItems() {
    if (!this.cachedPromise) {
      this.cachedPromise = this.itemProvider.provideChatSessionCustomizations(this.sessionResource, CancellationToken.None);
    }
    const cached = this.cachedPromise;
    const allItems = await cached;
    if (cached !== this.cachedPromise || !allItems) {
      return [];
    }
    return allItems;
  }
  async fetchAICustomizationItems(promptType) {
    const allItems = await this.fetchProviderItems();
    let providerItems;
    if (promptType === PromptsType.hook) {
      const hookItems = allItems.filter((item) => item.type === PromptsType.hook);
      const toExpand = hookItems.filter((item) => item.source !== AICustomizationSources.plugin);
      const preExpanded = hookItems.filter((item) => item.source === AICustomizationSources.plugin);
      const expanded = await expandHookFileItems(
        toExpand,
        this.workspaceService,
        this.fileService,
        this.pathService
      );
      providerItems = [...expanded, ...preExpanded];
    } else {
      providerItems = allItems.filter((item) => item.type === promptType);
    }
    if (promptType === PromptsType.skill) {
      providerItems = await this.addSkillDescriptionFallbacks(providerItems);
    }
    const normalized = this.itemNormalizer.normalizeItems(providerItems, promptType);
    if (promptType === PromptsType.skill) {
      return mergeBuiltinSkills(normalized, promptType, this.promptsService, this.workspaceService, this.itemNormalizer);
    }
    return normalized;
  }
  async fetchSourceFolders(promptType) {
    if (!this.itemProvider.provideSourceFolders) {
      return [];
    }
    return await this.itemProvider.provideSourceFolders(this.sessionResource, promptType, CancellationToken.None) ?? [];
  }
  async addSkillDescriptionFallbacks(items) {
    const descriptionsByUri = /* @__PURE__ */ new Map();
    const skills = await this.promptsService.findAgentSkills(CancellationToken.None);
    for (const skill of skills ?? []) {
      if (skill.description) {
        descriptionsByUri.set(skill.uri.toString(), skill.description);
      }
    }
    return items.map((item) => item.description ? item : { ...item, description: descriptionsByUri.get(item.uri.toString()) });
  }
}
class EmptyItemProviderItemSource extends Disposable {
  constructor(sessionResource) {
    super();
    this.sessionResource = sessionResource;
    this.onDidAICustomizationItemsChange = Event.None;
  }
  fetchAICustomizationItems(promptType) {
    return Promise.resolve([]);
  }
  fetchProviderItems() {
    return Promise.resolve([]);
  }
  fetchSourceFolders(_promptType) {
    return Promise.resolve([]);
  }
}
class PureItemProviderItemSource extends Disposable {
  constructor(sessionResource, itemProvider, itemNormalizer, promptsService, workspaceService) {
    super();
    this.sessionResource = sessionResource;
    this.itemProvider = itemProvider;
    this.itemNormalizer = itemNormalizer;
    this.promptsService = promptsService;
    this.workspaceService = workspaceService;
    this.onDidAICustomizationItemsChange = Event.any(this.itemProvider.onDidChange, this.promptsService.onDidChangeSkills);
    this._register(this.itemProvider.onDidChange(() => {
      this.cachedPromise = void 0;
    }));
  }
  async fetchProviderItems() {
    if (!this.cachedPromise) {
      const promise = this.itemProvider.provideChatSessionCustomizations(this.sessionResource, CancellationToken.None);
      this.cachedPromise = promise;
      promise.catch(() => {
        if (this.cachedPromise === promise) {
          this.cachedPromise = void 0;
        }
      });
    }
    const cached = this.cachedPromise;
    const allItems = await cached;
    if (cached !== this.cachedPromise || !allItems) {
      return [];
    }
    return allItems;
  }
  async fetchAICustomizationItems(promptType) {
    const allItems = await this.fetchProviderItems();
    const normalized = this.itemNormalizer.normalizeItems(allItems, promptType);
    if (promptType === PromptsType.skill) {
      return mergeBuiltinSkills(normalized, promptType, this.promptsService, this.workspaceService, this.itemNormalizer);
    }
    return normalized;
  }
  async fetchSourceFolders(promptType) {
    if (!this.itemProvider.provideSourceFolders) {
      return [];
    }
    return await this.itemProvider.provideSourceFolders(this.sessionResource, promptType, CancellationToken.None) ?? [];
  }
}
export {
  AICustomizationItemNormalizer,
  EmptyItemProviderItemSource,
  ItemProviderItemSource,
  PureItemProviderItemSource,
  expandHookFileItems,
  getFriendlyName,
  isChatExtensionItem,
  mergeBuiltinSkills
};
