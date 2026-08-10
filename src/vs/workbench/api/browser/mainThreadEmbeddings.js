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
import { Emitter } from "../../../base/common/event.js";
import { DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
const IEmbeddingsService = createDecorator("embeddingsService");
class EmbeddingsService {
  constructor() {
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this.providers = /* @__PURE__ */ new Map();
  }
  get allProviders() {
    return this.providers.keys();
  }
  registerProvider(id, provider) {
    this.providers.set(id, provider);
    this._onDidChange.fire();
    return {
      dispose: () => {
        this.providers.delete(id);
        this._onDidChange.fire();
      }
    };
  }
  computeEmbeddings(id, input, token) {
    const provider = this.providers.get(id);
    if (provider) {
      return provider.provideEmbeddings(input, token);
    } else {
      return Promise.reject(new Error(`No embeddings provider registered with id: ${id}`));
    }
  }
}
registerSingleton(IEmbeddingsService, EmbeddingsService, InstantiationType.Delayed);
let MainThreadEmbeddings = class {
  constructor(context, embeddingsService) {
    this.embeddingsService = embeddingsService;
    this._store = new DisposableStore();
    this._providers = this._store.add(new DisposableMap());
    this._proxy = context.getProxy(ExtHostContext.ExtHostEmbeddings);
    this._store.add(embeddingsService.onDidChange((() => {
      this._proxy.$acceptEmbeddingModels(Array.from(embeddingsService.allProviders));
    })));
  }
  dispose() {
    this._store.dispose();
  }
  $registerEmbeddingProvider(handle, identifier) {
    const registration = this.embeddingsService.registerProvider(identifier, {
      provideEmbeddings: (input, token) => {
        return this._proxy.$provideEmbeddings(handle, input, token);
      }
    });
    this._providers.set(handle, registration);
  }
  $unregisterEmbeddingProvider(handle) {
    this._providers.deleteAndDispose(handle);
  }
  $computeEmbeddings(embeddingsModel, input, token) {
    return this.embeddingsService.computeEmbeddings(embeddingsModel, input, token);
  }
};
MainThreadEmbeddings = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadEmbeddings),
  __decorateParam(1, IEmbeddingsService)
], MainThreadEmbeddings);
export {
  MainThreadEmbeddings
};
