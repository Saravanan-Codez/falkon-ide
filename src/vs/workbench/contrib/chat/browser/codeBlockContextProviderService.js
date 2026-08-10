import { toDisposable } from "../../../../base/common/lifecycle.js";
class ChatCodeBlockContextProviderService {
  constructor() {
    this._providers = /* @__PURE__ */ new Map();
  }
  get providers() {
    return [...this._providers.values()];
  }
  registerProvider(provider, id) {
    this._providers.set(id, provider);
    return toDisposable(() => this._providers.delete(id));
  }
}
export {
  ChatCodeBlockContextProviderService
};
