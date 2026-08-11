import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { AgentHostTransportKind } from "../common/agentHostTelemetry.js";
import { JSON_RPC_PARSE_ERROR } from "../common/state/sessionProtocol.js";
class MessagePortProtocolServer extends Disposable {
  constructor() {
    super(...arguments);
    this._onConnection = this._register(new Emitter());
    this.onConnection = this._onConnection.event;
    this.address = void 0;
    this._transports = /* @__PURE__ */ new Map();
  }
  listen(ctx, event) {
    switch (event) {
      case "frame":
        return this._getOrCreateTransport(ctx).onFrame;
      case "close":
        return this._getOrCreateTransport(ctx).onClose;
    }
    throw new Error(`Invalid listen: ${event}`);
  }
  async call(ctx, command, arg) {
    switch (command) {
      case "connect": {
        const transport = this._getOrCreateTransport(ctx);
        if (transport.connect()) {
          this._onConnection.fire(transport);
        }
        return void 0;
      }
      case "send": {
        if (typeof arg !== "string") {
          throw new Error("send: arg must be a string frame");
        }
        const transport = this._transports.get(ctx);
        if (!transport?.isConnected) {
          throw new Error("send: client is not connected");
        }
        transport.acceptFrame(arg);
        return void 0;
      }
      case "close":
        this.closeClient(ctx);
        return void 0;
    }
    throw new Error(`Invalid call: ${command}`);
  }
  /**
   * Closes a client's transport after its owning IPC connection disappears.
   */
  closeClient(ctx) {
    const transport = this._transports.get(ctx);
    if (!transport) {
      return;
    }
    this._transports.delete(ctx);
    transport.dispose();
  }
  dispose() {
    const transports = [...this._transports.values()];
    this._transports.clear();
    for (const transport of transports) {
      transport.dispose();
    }
    super.dispose();
  }
  _getOrCreateTransport(ctx) {
    if (this._store.isDisposed) {
      throw new Error("MessagePortProtocolServer is disposed");
    }
    let transport = this._transports.get(ctx);
    if (!transport) {
      transport = new MessagePortProtocolTransport();
      this._transports.set(ctx, transport);
      const onClose = transport.onClose(() => {
        onClose.dispose();
        if (this._transports.get(ctx) === transport) {
          this._transports.delete(ctx);
        }
      });
    }
    return transport;
  }
}
class MessagePortProtocolTransport extends Disposable {
  constructor() {
    super(...arguments);
    this.transportKind = AgentHostTransportKind.MessagePort;
    this._onFrame = this._register(new Emitter());
    this.onFrame = this._onFrame.event;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._isConnected = false;
    this._isClosed = false;
  }
  get isConnected() {
    return this._isConnected && !this._isClosed;
  }
  connect() {
    if (this._isClosed || this._isConnected) {
      return false;
    }
    this._isConnected = true;
    return true;
  }
  acceptFrame(frame) {
    try {
      this._onMessage.fire(JSON.parse(frame));
    } catch {
      this.send({ jsonrpc: "2.0", id: null, error: { code: JSON_RPC_PARSE_ERROR, message: "Parse error" } });
    }
  }
  send(message) {
    if (!this.isConnected) {
      return;
    }
    this._onFrame.fire(JSON.stringify(message));
  }
  dispose() {
    if (this._isClosed) {
      return;
    }
    this._isClosed = true;
    this._isConnected = false;
    this._onClose.fire();
    super.dispose();
  }
}
export {
  MessagePortProtocolServer
};
