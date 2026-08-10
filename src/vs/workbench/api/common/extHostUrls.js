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
import { MainContext } from "./extHost.protocol.js";
import { URI } from "../../../base/common/uri.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { onUnexpectedError } from "../../../base/common/errors.js";
import { ExtensionIdentifierSet } from "../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
let ExtHostUrls = class {
  constructor(extHostRpc) {
    this.handles = new ExtensionIdentifierSet();
    this.handlers = /* @__PURE__ */ new Map();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadUrls);
  }
  static {
    this.HandlePool = 0;
  }
  registerUriHandler(extension, handler) {
    const extensionId = extension.identifier;
    if (this.handles.has(extensionId)) {
      throw new Error(`Protocol handler already registered for extension ${extensionId}`);
    }
    const handle = ExtHostUrls.HandlePool++;
    this.handles.add(extensionId);
    this.handlers.set(handle, handler);
    this._proxy.$registerUriHandler(handle, extensionId, extension.displayName || extension.name);
    return toDisposable(() => {
      this.handles.delete(extensionId);
      this.handlers.delete(handle);
      this._proxy.$unregisterUriHandler(handle);
    });
  }
  $handleExternalUri(handle, uri) {
    const handler = this.handlers.get(handle);
    if (!handler) {
      return Promise.resolve(void 0);
    }
    try {
      handler.handleUri(URI.revive(uri));
    } catch (err) {
      onUnexpectedError(err);
    }
    return Promise.resolve(void 0);
  }
  async createAppUri(uri) {
    return URI.revive(await this._proxy.$createAppUri(uri));
  }
};
ExtHostUrls = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostUrls);
const IExtHostUrlsService = createDecorator("IExtHostUrlsService");
export {
  ExtHostUrls,
  IExtHostUrlsService
};
