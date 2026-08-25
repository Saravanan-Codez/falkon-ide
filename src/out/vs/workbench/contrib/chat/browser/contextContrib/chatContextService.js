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
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { score } from "../../../../../editor/common/languageSelector.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { IChatContextPickService } from "../attachments/chatContextPickService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { basename } from "../../../../../base/common/resources.js";
const IChatContextService = createDecorator("chatContextService");
function isViewTypeTabSelector(selector) {
  return selector.viewType !== void 0;
}
let ChatContextService = class extends Disposable {
  constructor(_contextPickService, _extensionService) {
    super();
    this._contextPickService = _contextPickService;
    this._extensionService = _extensionService;
    this._providers = /* @__PURE__ */ new Map();
    this._workspaceContext = /* @__PURE__ */ new Map();
    this._registeredPickers = this._register(new DisposableMap());
    this._lastResourceContext = /* @__PURE__ */ new Map();
  }
  setExecuteCommandCallback(callback) {
    this._executeCommandCallback = callback;
  }
  async executeChatContextItemCommand(handle) {
    if (!this._executeCommandCallback) {
      return;
    }
    await this._executeCommandCallback(handle);
  }
  setChatContextProvider(id, picker) {
    const providerEntry = this._providers.get(id) ?? {};
    providerEntry.picker = picker;
    this._providers.set(id, providerEntry);
    this._registerWithPickService(id);
  }
  _registerWithPickService(id) {
    const providerEntry = this._providers.get(id);
    if (!providerEntry || !providerEntry.picker || !providerEntry.explicitProvider) {
      return;
    }
    const title = `${providerEntry.picker.title.replace(/\.+$/, "")}...`;
    this._registeredPickers.set(id, this._contextPickService.registerChatContextItem(this._asPicker(title, providerEntry.picker.icon, id)));
  }
  registerChatWorkspaceContextProvider(id, provider) {
    const providerEntry = this._providers.get(id) ?? {};
    providerEntry.workspaceProvider = provider;
    this._providers.set(id, providerEntry);
  }
  registerChatExplicitContextProvider(id, provider) {
    const providerEntry = this._providers.get(id) ?? {};
    providerEntry.explicitProvider = provider;
    this._providers.set(id, providerEntry);
    this._registerWithPickService(id);
  }
  registerChatResourceContextProvider(id, selector, provider) {
    const providerEntry = this._providers.get(id) ?? {};
    providerEntry.resourceProvider = { selector, provider };
    this._providers.set(id, providerEntry);
  }
  unregisterChatContextProvider(id) {
    this._providers.delete(id);
    this._registeredPickers.deleteAndDispose(id);
  }
  updateWorkspaceContextItems(id, items) {
    this._workspaceContext.set(id, items);
  }
  getWorkspaceContextItems() {
    const items = [];
    for (const workspaceContexts of this._workspaceContext.values()) {
      for (const item of workspaceContexts) {
        if (!item.value) {
          continue;
        }
        const derivedLabel = item.label ?? (item.resourceUri ? basename(item.resourceUri) : "Unknown");
        items.push({
          value: item.value,
          name: derivedLabel,
          modelDescription: item.modelDescription,
          id: derivedLabel,
          kind: "workspace"
        });
      }
    }
    return items;
  }
  async contextForResource(uri, language, viewType) {
    return this._contextForResource(uri, false, language, viewType);
  }
  async _contextForResource(uri, withValue, language, viewType) {
    const scoredProviders = [];
    for (const providerEntry of this._providers.values()) {
      if (!providerEntry.resourceProvider) {
        continue;
      }
      const selector = providerEntry.resourceProvider.selector;
      const matchScore = isViewTypeTabSelector(selector) ? viewType !== void 0 && selector.viewType === viewType ? 10 : 0 : score(selector.uri, uri, language ?? "", true, void 0, void 0);
      scoredProviders.push({ score: matchScore, provider: providerEntry.resourceProvider.provider });
    }
    scoredProviders.sort((a, b) => b.score - a.score);
    if (scoredProviders.length === 0 || scoredProviders[0].score <= 0) {
      return;
    }
    const provider = scoredProviders[0].provider;
    const context = await provider.provideChatContext(uri, withValue, viewType, CancellationToken.None);
    if (!context) {
      return;
    }
    const effectiveResourceUri = context.resourceUri ?? uri;
    const derivedLabel = context.label ?? basename(effectiveResourceUri);
    const contextValue = {
      value: void 0,
      name: derivedLabel,
      iconPath: context.iconPath,
      uri,
      resourceUri: context.resourceUri,
      modelDescription: context.modelDescription,
      tooltip: context.tooltip,
      commandId: context.command?.id,
      handle: context.handle
    };
    this._lastResourceContext.clear();
    this._lastResourceContext.set(contextValue, { originalItem: context, provider });
    return contextValue;
  }
  async resolveChatContext(context, language) {
    if (context.value !== void 0) {
      return context;
    }
    const item = this._lastResourceContext.get(context);
    if (!item) {
      const resolved = await this._contextForResource(context.uri, true, language);
      context.value = resolved?.value;
      context.modelDescription = resolved?.modelDescription;
      context.tooltip = resolved?.tooltip;
      return context;
    } else {
      const resolved = await item.provider.resolveChatContext(item.originalItem, CancellationToken.None);
      if (resolved) {
        context.value = resolved.value;
        context.modelDescription = resolved.modelDescription;
        context.tooltip = resolved.tooltip;
        return context;
      }
    }
    return context;
  }
  _asPicker(title, icon, id) {
    const asPicker = () => {
      let providerEntry = this._providers.get(id);
      if (!providerEntry) {
        throw new Error("No chat context provider registered");
      }
      const picks = async () => {
        if (providerEntry && !providerEntry.explicitProvider) {
          await this._extensionService.activateByEvent(`onChatContextProvider:${id}`);
          providerEntry = this._providers.get(id);
          if (!providerEntry?.explicitProvider) {
            return [];
          }
        }
        const results = await providerEntry?.explicitProvider.provideChatContext(CancellationToken.None);
        return results || [];
      };
      return {
        picks: picks().then((items) => {
          return items.map((item) => {
            const derivedLabel = item.label ?? (item.resourceUri ? basename(item.resourceUri) : "Unknown");
            const iconPath = item.iconPath;
            const isThemeIcon = ThemeIcon.isThemeIcon(iconPath);
            return {
              label: derivedLabel,
              iconClass: isThemeIcon ? ThemeIcon.asClassName(iconPath) : void 0,
              iconPath: !isThemeIcon && iconPath ? URI.isUri(iconPath) ? { dark: iconPath, light: iconPath } : { dark: iconPath.dark, light: iconPath.light } : void 0,
              asAttachment: async () => {
                let contextValue = item;
                if (contextValue.value === void 0 && providerEntry?.explicitProvider) {
                  contextValue = await providerEntry.explicitProvider.resolveChatContext(item, CancellationToken.None);
                }
                const resolvedLabel = contextValue.label ?? (contextValue.resourceUri ? basename(contextValue.resourceUri) : "Unknown");
                return {
                  kind: "generic",
                  id: resolvedLabel,
                  name: resolvedLabel,
                  iconPath: contextValue.iconPath ?? item.iconPath,
                  value: contextValue.value,
                  tooltip: contextValue.tooltip ?? item.tooltip
                };
              }
            };
          });
        }),
        placeholder: title
      };
    };
    const picker = {
      asPicker,
      type: "pickerPick",
      label: title,
      icon
    };
    return picker;
  }
};
ChatContextService = __decorateClass([
  __decorateParam(0, IChatContextPickService),
  __decorateParam(1, IExtensionService)
], ChatContextService);
registerSingleton(IChatContextService, ChatContextService, InstantiationType.Delayed);
export {
  ChatContextService,
  IChatContextService
};
