import * as extHostProtocol from "./extHost.protocol.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
class ExtHostChatStatus {
  constructor(mainContext) {
    this._items = /* @__PURE__ */ new Map();
    this._proxy = mainContext.getProxy(extHostProtocol.MainContext.MainThreadChatStatus);
  }
  createChatStatusItem(extension, id) {
    const internalId = asChatItemIdentifier(extension.identifier, id);
    if (this._items.has(internalId)) {
      throw new Error(`Chat status item '${id}' already exists`);
    }
    const state = {
      id: internalId,
      title: "",
      description: "",
      detail: "",
      tooltip: void 0
    };
    let disposed = false;
    let visible = false;
    const syncState = () => {
      if (disposed) {
        throw new Error("Chat status item is disposed");
      }
      if (!visible) {
        return;
      }
      this._proxy.$setEntry(id, state);
    };
    const item = Object.freeze({
      id,
      get title() {
        return state.title;
      },
      set title(value) {
        state.title = value;
        syncState();
      },
      get description() {
        return state.description;
      },
      set description(value) {
        state.description = value;
        syncState();
      },
      get detail() {
        return state.detail;
      },
      set detail(value) {
        state.detail = value;
        syncState();
      },
      get tooltip() {
        return state.tooltip;
      },
      set tooltip(value) {
        state.tooltip = value;
        syncState();
      },
      show: () => {
        visible = true;
        syncState();
      },
      hide: () => {
        visible = false;
        this._proxy.$disposeEntry(id);
      },
      dispose: () => {
        disposed = true;
        this._proxy.$disposeEntry(id);
        this._items.delete(internalId);
      }
    });
    this._items.set(internalId, item);
    return item;
  }
}
function asChatItemIdentifier(extension, id) {
  return `${ExtensionIdentifier.toKey(extension)}.${id}`;
}
export {
  ExtHostChatStatus
};
