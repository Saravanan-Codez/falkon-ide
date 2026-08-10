import * as extHostProtocol from "./extHost.protocol.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
class ExtHostChatInputNotification {
  constructor(mainContext) {
    this._items = /* @__PURE__ */ new Map();
    this._proxy = mainContext.getProxy(extHostProtocol.MainContext.MainThreadChatInputNotification);
  }
  createInputNotification(extension, id) {
    const internalId = asNotificationIdentifier(extension.identifier, id);
    if (this._items.has(internalId)) {
      throw new Error(`Chat input notification '${id}' already exists`);
    }
    const state = {
      id: internalId,
      severity: extHostProtocol.ChatInputNotificationSeverityDto.Info,
      message: "",
      description: void 0,
      actions: [],
      dismissible: true,
      autoDismissOnMessage: false
    };
    let disposed = false;
    let visible = false;
    const syncState = () => {
      if (disposed) {
        throw new Error("Chat input notification is disposed");
      }
      if (!visible) {
        return;
      }
      this._proxy.$setNotification({ ...state });
    };
    const item = Object.freeze({
      id,
      get severity() {
        return state.severity;
      },
      set severity(value) {
        state.severity = value;
        syncState();
      },
      get message() {
        return state.message;
      },
      set message(value) {
        state.message = value;
        syncState();
      },
      get description() {
        return state.description;
      },
      set description(value) {
        state.description = value;
        syncState();
      },
      get actions() {
        return state.actions;
      },
      set actions(value) {
        state.actions = value.map((a) => ({ label: a.label, commandId: a.commandId, commandArgs: a.commandArgs }));
        syncState();
      },
      get dismissible() {
        return state.dismissible;
      },
      set dismissible(value) {
        state.dismissible = value;
        syncState();
      },
      get autoDismissOnMessage() {
        return state.autoDismissOnMessage;
      },
      set autoDismissOnMessage(value) {
        state.autoDismissOnMessage = value;
        syncState();
      },
      show: () => {
        visible = true;
        syncState();
      },
      hide: () => {
        if (disposed) {
          return;
        }
        visible = false;
        this._proxy.$disposeNotification(internalId);
      },
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        visible = false;
        this._proxy.$disposeNotification(internalId);
        this._items.delete(internalId);
      }
    });
    this._items.set(internalId, item);
    return item;
  }
}
function asNotificationIdentifier(extension, id) {
  return `${ExtensionIdentifier.toKey(extension)}.${id}`;
}
export {
  ExtHostChatInputNotification
};
