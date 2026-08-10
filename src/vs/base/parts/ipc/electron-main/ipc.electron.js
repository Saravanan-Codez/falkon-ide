import { validatedIpcMain } from "./ipcMain.js";
import { VSBuffer } from "../../../common/buffer.js";
import { Emitter, Event } from "../../../common/event.js";
import { toDisposable } from "../../../common/lifecycle.js";
import { IPCServer } from "../common/ipc.js";
import { Protocol as ElectronProtocol } from "../common/ipc.electron.js";
function createScopedOnMessageEvent(senderId, eventName) {
  const onMessage = Event.fromNodeEventEmitter(validatedIpcMain, eventName, (event, message) => ({ event, message }));
  const onMessageFromSender = Event.filter(onMessage, ({ event }) => event.sender.id === senderId);
  return Event.map(onMessageFromSender, ({ message }) => message ? VSBuffer.wrap(message) : message);
}
class Server extends IPCServer {
  static {
    this.Clients = /* @__PURE__ */ new Map();
  }
  static getOnDidClientConnect() {
    const onHello = Event.fromNodeEventEmitter(validatedIpcMain, "vscode:hello", ({ sender }) => sender);
    return Event.map(onHello, (webContents) => {
      const id = webContents.id;
      const client = Server.Clients.get(id);
      client?.dispose();
      const onDidClientReconnect = new Emitter();
      const reconnectDisposable = toDisposable(() => {
        onDidClientReconnect.fire();
      });
      Server.Clients.set(id, reconnectDisposable);
      const onMessage = createScopedOnMessageEvent(id, "vscode:message");
      const onDidClientDisconnect = Event.any(Event.signal(createScopedOnMessageEvent(id, "vscode:disconnect")), onDidClientReconnect.event);
      Event.once(onDidClientDisconnect)(() => {
        if (Server.Clients.get(id) === reconnectDisposable) {
          Server.Clients.delete(id);
        }
        onDidClientReconnect.dispose();
      });
      const protocol = new ElectronProtocol(webContents, onMessage);
      return { protocol, onDidClientDisconnect };
    });
  }
  constructor() {
    super(Server.getOnDidClientConnect());
  }
}
export {
  Server
};
