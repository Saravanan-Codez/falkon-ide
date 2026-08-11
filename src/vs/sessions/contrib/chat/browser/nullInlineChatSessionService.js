import { Event } from "../../../../base/common/event.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInlineChatSessionService } from "../../../../workbench/contrib/inlineChat/browser/inlineChatSessionService.js";
class NullInlineChatSessionService {
  constructor() {
    this.onWillStartSession = Event.None;
    this.onDidChangeSessions = Event.None;
  }
  dispose() {
  }
  createSession(_editor) {
    throw new Error("Inline chat sessions are not supported in the sessions window");
  }
  getSessionByTextModel(_uri) {
    return void 0;
  }
  getSessionBySessionUri(_uri) {
    return void 0;
  }
}
registerSingleton(IInlineChatSessionService, NullInlineChatSessionService, InstantiationType.Delayed);
