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
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IURLService } from "../../../platform/url/common/url.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IExtensionUrlHandler } from "../../services/extensions/browser/extensionUrlHandler.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { ITrustedDomainService } from "../../contrib/url/browser/trustedDomainService.js";
class ExtensionUrlHandler {
  constructor(proxy, handle, extensionId, extensionDisplayName) {
    this.proxy = proxy;
    this.handle = handle;
    this.extensionId = extensionId;
    this.extensionDisplayName = extensionDisplayName;
  }
  async handleURL(uri, options) {
    if (!ExtensionIdentifier.equals(this.extensionId, uri.authority)) {
      return false;
    }
    await this.proxy.$handleExternalUri(this.handle, uri);
    return true;
  }
}
let MainThreadUrls = class extends Disposable {
  constructor(context, trustedDomainService, urlService, extensionUrlHandler) {
    super();
    this.urlService = urlService;
    this.extensionUrlHandler = extensionUrlHandler;
    this.handlers = /* @__PURE__ */ new Map();
    this.proxy = context.getProxy(ExtHostContext.ExtHostUrls);
  }
  async $registerUriHandler(handle, extensionId, extensionDisplayName) {
    const handler = new ExtensionUrlHandler(this.proxy, handle, extensionId, extensionDisplayName);
    const disposable = this.urlService.registerHandler(handler);
    this.handlers.set(handle, { extensionId, disposable });
    this.extensionUrlHandler.registerExtensionHandler(extensionId, handler);
    return void 0;
  }
  async $unregisterUriHandler(handle) {
    const tuple = this.handlers.get(handle);
    if (!tuple) {
      return void 0;
    }
    const { extensionId, disposable } = tuple;
    this.extensionUrlHandler.unregisterExtensionHandler(extensionId);
    this.handlers.delete(handle);
    disposable.dispose();
    return void 0;
  }
  async $createAppUri(uri) {
    return this.urlService.create(uri);
  }
  dispose() {
    super.dispose();
    this.handlers.forEach(({ disposable }) => disposable.dispose());
    this.handlers.clear();
  }
};
MainThreadUrls = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadUrls),
  __decorateParam(1, ITrustedDomainService),
  __decorateParam(2, IURLService),
  __decorateParam(3, IExtensionUrlHandler)
], MainThreadUrls);
export {
  MainThreadUrls
};
