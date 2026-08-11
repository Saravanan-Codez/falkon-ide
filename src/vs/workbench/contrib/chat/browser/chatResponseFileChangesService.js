import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { getChatSessionType } from "../common/model/chatUri.js";
const IChatResponseFileChangesService = createDecorator("chatResponseFileChangesService");
class ChatResponseFileChangesService extends Disposable {
  constructor() {
    super(...arguments);
    this._providers = /* @__PURE__ */ new Map();
  }
  registerProvider(chatSessionType, provider) {
    if (this._providers.has(chatSessionType)) {
      throw new Error(`A chat response file changes provider is already registered for session type '${chatSessionType}'`);
    }
    this._providers.set(chatSessionType, provider);
    return toDisposable(() => {
      if (this._providers.get(chatSessionType) === provider) {
        this._providers.delete(chatSessionType);
      }
    });
  }
  getChangesForRequest(sessionResource, requestId) {
    const provider = this._providers.get(getChatSessionType(sessionResource));
    return provider?.getChangesForRequest(sessionResource, requestId);
  }
  getFileEditsForRequest(sessionResource, requestId) {
    const provider = this._providers.get(getChatSessionType(sessionResource));
    return provider?.getFileEditsForRequest?.(sessionResource, requestId);
  }
}
export {
  ChatResponseFileChangesService,
  IChatResponseFileChangesService
};
