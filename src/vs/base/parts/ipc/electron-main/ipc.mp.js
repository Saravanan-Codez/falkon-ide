import { validatedIpcMain } from "./ipcMain.js";
import { Event } from "../../../common/event.js";
import { generateUuid } from "../../../common/uuid.js";
import { Client as MessagePortClient } from "../common/ipc.mp.js";
class Client extends MessagePortClient {
  /**
   * @param clientId a way to uniquely identify this client among
   * other clients. this is important for routing because every
   * client can also be a server
   */
  constructor(port, clientId) {
    super({
      addEventListener: (type, listener) => port.addListener(type, listener),
      removeEventListener: (type, listener) => port.removeListener(type, listener),
      postMessage: (message) => port.postMessage(message),
      start: () => port.start(),
      close: () => port.close()
    }, clientId);
  }
}
async function connect(window) {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    throw new Error("ipc.mp#connect: Cannot talk to window because it is closed or destroyed");
  }
  const nonce = generateUuid();
  window.webContents.send("vscode:createMessageChannel", nonce);
  const onMessageChannelResult = Event.fromNodeEventEmitter(validatedIpcMain, "vscode:createMessageChannelResult", (e, nonce2) => ({ nonce: nonce2, port: e.ports[0] }));
  const { port } = await Event.toPromise(Event.once(Event.filter(onMessageChannelResult, (e) => e.nonce === nonce)));
  return port;
}
export {
  Client,
  connect
};
