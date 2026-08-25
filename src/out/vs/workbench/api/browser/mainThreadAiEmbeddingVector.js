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
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IAiEmbeddingVectorService } from "../../services/aiEmbeddingVector/common/aiEmbeddingVectorService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadAiEmbeddingVector = class extends Disposable {
  constructor(context, _AiEmbeddingVectorService) {
    super();
    this._AiEmbeddingVectorService = _AiEmbeddingVectorService;
    this._registrations = this._register(new DisposableMap());
    this._proxy = context.getProxy(ExtHostContext.ExtHostAiEmbeddingVector);
  }
  $registerAiEmbeddingVectorProvider(model, handle) {
    const provider = {
      provideAiEmbeddingVector: (strings, token) => {
        return this._proxy.$provideAiEmbeddingVector(
          handle,
          strings,
          token
        );
      }
    };
    this._registrations.set(handle, this._AiEmbeddingVectorService.registerAiEmbeddingVectorProvider(model, provider));
  }
  $unregisterAiEmbeddingVectorProvider(handle) {
    this._registrations.deleteAndDispose(handle);
  }
};
MainThreadAiEmbeddingVector = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadAiEmbeddingVector),
  __decorateParam(1, IAiEmbeddingVectorService)
], MainThreadAiEmbeddingVector);
export {
  MainThreadAiEmbeddingVector
};
