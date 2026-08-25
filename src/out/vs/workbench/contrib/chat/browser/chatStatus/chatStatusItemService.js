import { Emitter } from "../../../../../base/common/event.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const IChatStatusItemService = createDecorator("chatStatusItemService");
class ChatStatusItemService {
  constructor() {
    this._entries = /* @__PURE__ */ new Map();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  setOrUpdateEntry(entry) {
    const isUpdate = this._entries.has(entry.id);
    this._entries.set(entry.id, entry);
    if (isUpdate) {
      this._onDidChange.fire({ entry });
    }
  }
  deleteEntry(id) {
    this._entries.delete(id);
  }
  getEntries() {
    return this._entries.values();
  }
}
registerSingleton(IChatStatusItemService, ChatStatusItemService, InstantiationType.Delayed);
export {
  IChatStatusItemService
};
