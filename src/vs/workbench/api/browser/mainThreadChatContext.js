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
import { Disposable } from "../../../base/common/lifecycle.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IChatContextService } from "../../contrib/chat/browser/contextContrib/chatContextService.js";
import { URI } from "../../../base/common/uri.js";
import { IconPath } from "../common/extHostTypeConverters.js";
function reviveContextItem(item) {
  return {
    ...item,
    iconPath: IconPath.to(item.iconPath),
    resourceUri: item.resourceUri ? URI.revive(item.resourceUri) : void 0
  };
}
function reviveContextItems(items) {
  return items.map(reviveContextItem);
}
let MainThreadChatContext = class extends Disposable {
  constructor(extHostContext, _chatContextService) {
    super();
    this._chatContextService = _chatContextService;
    this._providers = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatContext);
    this._chatContextService.setExecuteCommandCallback((itemHandle) => this._proxy.$executeChatContextItemCommand(itemHandle));
  }
  $registerChatWorkspaceContextProvider(handle, id) {
    this._providers.set(handle, { id });
    this._chatContextService.registerChatWorkspaceContextProvider(id, {
      provideWorkspaceChatContext: async (token) => {
        const items = await this._proxy.$provideWorkspaceChatContext(handle, token);
        return reviveContextItems(items);
      }
    });
  }
  $registerChatExplicitContextProvider(handle, id) {
    this._providers.set(handle, { id });
    this._chatContextService.registerChatExplicitContextProvider(id, {
      provideChatContext: async (token) => {
        const items = await this._proxy.$provideExplicitChatContext(handle, token);
        return reviveContextItems(items);
      },
      resolveChatContext: async (context, token) => {
        const result = await this._proxy.$resolveExplicitChatContext(handle, context, token);
        return reviveContextItem(result);
      }
    });
  }
  $registerChatResourceContextProvider(handle, id, selector) {
    this._providers.set(handle, { id, selector });
    this._chatContextService.registerChatResourceContextProvider(id, selector, {
      provideChatContext: async (resource, withValue, viewType, token) => {
        const result = await this._proxy.$provideResourceChatContext(handle, { resource, withValue, viewType }, token);
        return result ? reviveContextItem(result) : void 0;
      },
      resolveChatContext: async (context, token) => {
        const result = await this._proxy.$resolveResourceChatContext(handle, context, token);
        return reviveContextItem(result);
      }
    });
  }
  $unregisterChatContextProvider(handle) {
    const provider = this._providers.get(handle);
    if (!provider) {
      return;
    }
    this._chatContextService.unregisterChatContextProvider(provider.id);
    this._providers.delete(handle);
  }
  $updateWorkspaceContextItems(handle, items) {
    const provider = this._providers.get(handle);
    if (!provider) {
      return;
    }
    this._chatContextService.updateWorkspaceContextItems(provider.id, reviveContextItems(items));
  }
  $executeChatContextItemCommand(itemHandle) {
    return this._proxy.$executeChatContextItemCommand(itemHandle);
  }
};
MainThreadChatContext = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatContext),
  __decorateParam(1, IChatContextService)
], MainThreadChatContext);
export {
  MainThreadChatContext
};
