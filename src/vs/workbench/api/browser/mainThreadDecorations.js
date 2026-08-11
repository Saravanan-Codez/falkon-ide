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
import { URI } from "../../../base/common/uri.js";
import { Emitter } from "../../../base/common/event.js";
import { dispose } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IDecorationsService } from "../../services/decorations/common/decorations.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { DeferredPromise } from "../../../base/common/async.js";
import { CancellationError } from "../../../base/common/errors.js";
class DecorationRequestsQueue {
  constructor(_proxy, _handle) {
    this._proxy = _proxy;
    this._handle = _handle;
    this._idPool = 0;
    this._requests = /* @__PURE__ */ new Map();
    this._resolver = /* @__PURE__ */ new Map();
  }
  enqueue(uri, token) {
    const id = ++this._idPool;
    const defer = new DeferredPromise();
    this._requests.set(id, { id, uri });
    this._resolver.set(id, defer);
    this._processQueue();
    const sub = token.onCancellationRequested(() => {
      this._requests.delete(id);
      this._resolver.delete(id);
      defer.error(new CancellationError());
    });
    return defer.p.finally(() => sub.dispose());
  }
  _processQueue() {
    if (this._timer !== void 0) {
      return;
    }
    this._timer = setTimeout(() => {
      const requests = this._requests;
      const resolver = this._resolver;
      this._proxy.$provideDecorations(this._handle, [...requests.values()], CancellationToken.None).then((data) => {
        for (const [id, defer] of resolver) {
          defer.complete(data[id]);
        }
      });
      this._requests = /* @__PURE__ */ new Map();
      this._resolver = /* @__PURE__ */ new Map();
      this._timer = void 0;
    }, 0);
  }
}
let MainThreadDecorations = class {
  constructor(context, _decorationsService) {
    this._decorationsService = _decorationsService;
    this._provider = /* @__PURE__ */ new Map();
    this._proxy = context.getProxy(ExtHostContext.ExtHostDecorations);
  }
  dispose() {
    this._provider.forEach((value) => dispose(value));
    this._provider.clear();
  }
  $registerDecorationProvider(handle, label) {
    const emitter = new Emitter();
    const queue = new DecorationRequestsQueue(this._proxy, handle);
    const registration = this._decorationsService.registerDecorationsProvider({
      label,
      onDidChange: emitter.event,
      provideDecorations: async (uri, token) => {
        const data = await queue.enqueue(uri, token);
        if (!data) {
          return void 0;
        }
        const [bubble, tooltip, letter, themeColor] = data;
        return {
          weight: 10,
          bubble: bubble ?? false,
          color: themeColor?.id,
          tooltip,
          letter
        };
      }
    });
    this._provider.set(handle, [emitter, registration]);
  }
  $onDidChange(handle, resources) {
    const provider = this._provider.get(handle);
    if (provider) {
      const [emitter] = provider;
      emitter.fire(resources && resources.map((r) => URI.revive(r)));
    }
  }
  $unregisterDecorationProvider(handle) {
    const provider = this._provider.get(handle);
    if (provider) {
      dispose(provider);
      this._provider.delete(handle);
    }
  }
};
MainThreadDecorations = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDecorations),
  __decorateParam(1, IDecorationsService)
], MainThreadDecorations);
export {
  MainThreadDecorations
};
