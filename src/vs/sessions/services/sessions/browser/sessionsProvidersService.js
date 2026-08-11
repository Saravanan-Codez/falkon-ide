import { Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
const ISessionsProvidersService = createDecorator("sessionsProvidersService");
class SessionsProvidersService extends Disposable {
  constructor() {
    super(...arguments);
    this._providers = /* @__PURE__ */ new Map();
    this._onDidChangeProviders = this._register(new Emitter());
    this.onDidChangeProviders = this._onDidChangeProviders.event;
  }
  registerProvider(provider) {
    if (this._providers.has(provider.id)) {
      throw new Error(`Sessions provider '${provider.id}' is already registered.`);
    }
    this._providers.set(provider.id, provider);
    this._onDidChangeProviders.fire({ added: [provider], removed: [] });
    return toDisposable(() => {
      const entry = this._providers.get(provider.id);
      if (entry) {
        this._providers.delete(provider.id);
        this._onDidChangeProviders.fire({ added: [], removed: [provider] });
      }
    });
  }
  /**
   * Returns all registered providers sorted by each provider's
   * {@link ISessionsProvider.order} (lower first). The sort is stable, so
   * providers with equal order keep their registration order.
   */
  getProviders() {
    return Array.from(this._providers.values()).sort((a, b) => a.order - b.order);
  }
  getProvider(providerId) {
    return this._providers.get(providerId);
  }
}
registerSingleton(ISessionsProvidersService, SessionsProvidersService, InstantiationType.Delayed);
export {
  ISessionsProvidersService
};
