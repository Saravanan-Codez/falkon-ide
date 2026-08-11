import electron from "electron";
import { onUnexpectedError } from "../../../common/errors.js";
import { VSCODE_AUTHORITY } from "../../../common/network.js";
class ValidatedIpcMain {
  constructor() {
    // We need to keep a map of original listener to the wrapped variant in order
    // to properly implement `removeListener`. We use a `WeakMap` because we do
    // not want to prevent the `key` of the map to get garbage collected.
    this.mapListenerToWrapper = /* @__PURE__ */ new WeakMap();
  }
  /**
   * Listens to `channel`, when a new message arrives `listener` would be called with
   * `listener(event, args...)`.
   */
  on(channel, listener) {
    const wrappedListener = (event, ...args) => {
      if (this.validateEvent(channel, event)) {
        listener(event, ...args);
      }
    };
    this.mapListenerToWrapper.set(listener, wrappedListener);
    electron.ipcMain.on(channel, wrappedListener);
    return this;
  }
  /**
   * Adds a one time `listener` function for the event. This `listener` is invoked
   * only the next time a message is sent to `channel`, after which it is removed.
   */
  once(channel, listener) {
    electron.ipcMain.once(channel, (event, ...args) => {
      if (this.validateEvent(channel, event)) {
        listener(event, ...args);
      }
    });
    return this;
  }
  /**
   * Adds a handler for an `invoke`able IPC. This handler will be called whenever a
   * renderer calls `ipcRenderer.invoke(channel, ...args)`.
   *
   * If `listener` returns a Promise, the eventual result of the promise will be
   * returned as a reply to the remote caller. Otherwise, the return value of the
   * listener will be used as the value of the reply.
   *
   * The `event` that is passed as the first argument to the handler is the same as
   * that passed to a regular event listener. It includes information about which
   * WebContents is the source of the invoke request.
   *
   * Errors thrown through `handle` in the main process are not transparent as they
   * are serialized and only the `message` property from the original error is
   * provided to the renderer process. Please refer to #24427 for details.
   */
  handle(channel, listener) {
    electron.ipcMain.handle(channel, (event, ...args) => {
      if (this.validateEvent(channel, event)) {
        return listener(event, ...args);
      }
      return Promise.reject(`Invalid channel '${channel}' or sender for ipcMain.handle() usage.`);
    });
    return this;
  }
  /**
   * Removes any handler for `channel`, if present.
   */
  removeHandler(channel) {
    electron.ipcMain.removeHandler(channel);
    return this;
  }
  /**
   * Removes the specified `listener` from the listener array for the specified
   * `channel`.
   */
  removeListener(channel, listener) {
    const wrappedListener = this.mapListenerToWrapper.get(listener);
    if (wrappedListener) {
      electron.ipcMain.removeListener(channel, wrappedListener);
      this.mapListenerToWrapper.delete(listener);
    }
    return this;
  }
  validateEvent(channel, event) {
    if (!channel?.startsWith("vscode:")) {
      onUnexpectedError(`Refused to handle ipcMain event for channel '${channel}' because the channel is unknown.`);
      return false;
    }
    const sender = event.senderFrame;
    const url = sender?.url;
    if (!url || url === "about:blank") {
      return true;
    }
    let host = "unknown";
    try {
      host = new URL(url).host;
    } catch (error) {
      onUnexpectedError(`Refused to handle ipcMain event for channel '${channel}' because of a malformed URL '${url}'.`);
      return false;
    }
    if (process.env.VSCODE_DEV) {
      if (url === process.env.DEV_WINDOW_SRC && (host === "localhost" || host.startsWith("localhost:"))) {
        return true;
      }
    }
    if (host !== VSCODE_AUTHORITY) {
      onUnexpectedError(`Refused to handle ipcMain event for channel '${channel}' because of a bad origin of '${host}'.`);
      return false;
    }
    if (sender?.parent !== null) {
      onUnexpectedError(`Refused to handle ipcMain event for channel '${channel}' because sender of origin '${host}' is not a main frame.`);
      return false;
    }
    return true;
  }
}
const validatedIpcMain = new ValidatedIpcMain();
export {
  validatedIpcMain
};
