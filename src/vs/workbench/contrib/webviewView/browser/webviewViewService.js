import { promiseWithResolvers } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IWebviewViewService = createDecorator("webviewViewService");
class WebviewViewService extends Disposable {
  constructor() {
    super(...arguments);
    this._resolvers = /* @__PURE__ */ new Map();
    this._awaitingRevival = /* @__PURE__ */ new Map();
    this._onNewResolverRegistered = this._register(new Emitter());
    this.onNewResolverRegistered = this._onNewResolverRegistered.event;
  }
  register(viewType, resolver) {
    if (this._resolvers.has(viewType)) {
      throw new Error(`View resolver already registered for ${viewType}`);
    }
    this._resolvers.set(viewType, resolver);
    this._onNewResolverRegistered.fire({ viewType });
    const pending = this._awaitingRevival.get(viewType);
    if (pending) {
      resolver.resolve(pending.webview, CancellationToken.None).then(() => {
        this._awaitingRevival.delete(viewType);
        pending.subscription.dispose();
        pending.resolve();
      });
    }
    return toDisposable(() => {
      this._resolvers.delete(viewType);
    });
  }
  resolve(viewType, webview, cancellation) {
    const resolver = this._resolvers.get(viewType);
    if (!resolver) {
      if (this._awaitingRevival.has(viewType)) {
        throw new Error("View already awaiting revival");
      }
      if (cancellation.isCancellationRequested) {
        return Promise.resolve();
      }
      const { promise, resolve } = promiseWithResolvers();
      const subscription = cancellation.onCancellationRequested(() => {
        if (this._awaitingRevival.get(viewType)?.resolve === resolve) {
          this._awaitingRevival.delete(viewType);
          subscription.dispose();
          resolve();
        }
      });
      this._awaitingRevival.set(viewType, { webview, resolve, subscription });
      return promise;
    }
    return resolver.resolve(webview, cancellation);
  }
}
export {
  IWebviewViewService,
  WebviewViewService
};
