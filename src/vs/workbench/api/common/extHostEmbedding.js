import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { MainContext } from "./extHost.protocol.js";
class ExtHostEmbeddings {
  constructor(mainContext) {
    this._provider = /* @__PURE__ */ new Map();
    this._registeredModels = /* @__PURE__ */ new Set();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._allKnownModels = /* @__PURE__ */ new Set();
    this._handlePool = 0;
    this._proxy = mainContext.getProxy(MainContext.MainThreadEmbeddings);
  }
  registerEmbeddingsProvider(_extension, embeddingsModel, provider) {
    if (this._registeredModels.has(embeddingsModel)) {
      throw new Error(`An embeddings provider for model '${embeddingsModel}' is already registered`);
    }
    const handle = this._handlePool++;
    this._proxy.$registerEmbeddingProvider(handle, embeddingsModel);
    this._provider.set(handle, { id: embeddingsModel, provider });
    this._registeredModels.add(embeddingsModel);
    return toDisposable(() => {
      this._registeredModels.delete(embeddingsModel);
      this._proxy.$unregisterEmbeddingProvider(handle);
      this._provider.delete(handle);
    });
  }
  async computeEmbeddings(embeddingsModel, input, token) {
    token ??= CancellationToken.None;
    let returnSingle = false;
    if (typeof input === "string") {
      input = [input];
      returnSingle = true;
    }
    const result = await this._proxy.$computeEmbeddings(embeddingsModel, input, token);
    if (result.length !== input.length) {
      throw new Error();
    }
    if (returnSingle) {
      if (result.length !== 1) {
        throw new Error();
      }
      return result[0];
    }
    return result;
  }
  async $provideEmbeddings(handle, input, token) {
    const data = this._provider.get(handle);
    if (!data) {
      return [];
    }
    const result = await data.provider.provideEmbeddings(input, token);
    if (!result) {
      return [];
    }
    return result;
  }
  get embeddingsModels() {
    return Array.from(this._allKnownModels);
  }
  $acceptEmbeddingModels(models) {
    this._allKnownModels = new Set(models);
    this._onDidChange.fire();
  }
}
export {
  ExtHostEmbeddings
};
