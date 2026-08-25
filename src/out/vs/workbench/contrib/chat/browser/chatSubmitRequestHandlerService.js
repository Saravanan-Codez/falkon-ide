import { toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IChatSubmitRequestHandlerService = createDecorator("chatSubmitRequestHandlerService");
class ChatSubmitRequestHandlerService {
  constructor() {
    this._handlers = [];
  }
  register(handler) {
    this._handlers.push(handler);
    return toDisposable(() => {
      const index = this._handlers.indexOf(handler);
      if (index >= 0) {
        this._handlers.splice(index, 1);
      }
    });
  }
  async tryHandle(request) {
    for (const handler of this._handlers) {
      if (await handler.tryHandle(request)) {
        return true;
      }
    }
    return false;
  }
}
export {
  ChatSubmitRequestHandlerService,
  IChatSubmitRequestHandlerService
};
