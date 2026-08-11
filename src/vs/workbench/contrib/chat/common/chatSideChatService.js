import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { derived, observableValue } from "../../../../base/common/observable.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IChatSideChatService = createDecorator("chatSideChatService");
class ChatSideChatService extends Disposable {
  constructor() {
    super(...arguments);
    this._providers = observableValue(this, []);
    // Cheap deriveds keyed by session resource keep observable identities stable across renders.
    this._sideChatOrigins = new ResourceMap();
  }
  registerProvider(provider) {
    if (!this._providers.get().includes(provider)) {
      this._providers.set([...this._providers.get(), provider], void 0);
    }
    return toDisposable(() => {
      const providers = this._providers.get();
      const index = providers.indexOf(provider);
      if (index !== -1) {
        this._providers.set([...providers.slice(0, index), ...providers.slice(index + 1)], void 0);
      }
    });
  }
  canAskInSideChat(sessionResource) {
    return !!this._findProvider(sessionResource);
  }
  async askInSideChat(sessionResource, query, selection) {
    const provider = this._findProvider(sessionResource);
    if (!provider) {
      throw new Error(`No side chat provider for ${sessionResource.toString()}`);
    }
    await provider.askInSideChat(sessionResource, query, selection);
  }
  observeSideChatOrigin(sessionResource) {
    let origin = this._sideChatOrigins.get(sessionResource);
    if (!origin) {
      origin = derived(this, (reader) => {
        for (const provider of this._providers.read(reader)) {
          const providerOrigin = provider.observeSideChatOrigin(sessionResource).read(reader);
          if (providerOrigin !== void 0) {
            return providerOrigin;
          }
        }
        return void 0;
      });
      this._sideChatOrigins.set(sessionResource, origin);
    }
    return origin;
  }
  async revealSideChatSource(sessionResource) {
    for (const provider of this._providers.get()) {
      if (provider.observeSideChatOrigin(sessionResource).get() !== void 0) {
        await provider.revealSideChatSource(sessionResource);
        return;
      }
    }
  }
  _findProvider(sessionResource) {
    for (const provider of this._providers.get()) {
      if (provider.canAskInSideChat(sessionResource)) {
        return provider;
      }
    }
    return void 0;
  }
}
export {
  ChatSideChatService,
  IChatSideChatService
};
