import { VSBuffer } from "../../../common/buffer.js";
import { Event } from "../../../common/event.js";
import { IPCClient } from "./ipc.js";
class Protocol {
  constructor(port) {
    this.port = port;
    const onMessage = Event.fromDOMEventEmitter(this.port, "message", (e) => e.data ? VSBuffer.wrap(e.data) : VSBuffer.alloc(0));
    this.onMessage = Event.filter(onMessage, (data) => data.byteLength > 0);
    port.start();
  }
  send(message) {
    this.port.postMessage(message.buffer);
  }
  disconnect() {
    this.port.close();
  }
}
class Client extends IPCClient {
  constructor(port, clientId) {
    const protocol = new Protocol(port);
    super(protocol, clientId);
    this.protocol = protocol;
  }
  dispose() {
    this.protocol.disconnect();
    super.dispose();
  }
}
export {
  Client,
  Protocol
};
