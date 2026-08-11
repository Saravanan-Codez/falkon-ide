var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { MainContext } from "./extHost.protocol.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { VSBuffer } from "../../../base/common/buffer.js";
const IExtHostManagedSockets = createDecorator("IExtHostManagedSockets");
let ExtHostManagedSockets = class {
  constructor(extHostRpc) {
    this._remoteSocketIdCounter = 0;
    this._factory = null;
    this._managedRemoteSockets = /* @__PURE__ */ new Map();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadManagedSockets);
  }
  setFactory(socketFactoryId, makeConnection) {
    for (const socket of this._managedRemoteSockets.values()) {
      socket.dispose();
    }
    if (this._factory) {
      this._proxy.$unregisterSocketFactory(this._factory.socketFactoryId);
    }
    this._factory = new ManagedSocketFactory(socketFactoryId, makeConnection);
    this._proxy.$registerSocketFactory(this._factory.socketFactoryId);
  }
  makeConnection() {
    if (!this._factory) {
      throw new Error("No managed socket factory registered");
    }
    return Promise.resolve(this._factory.makeConnection());
  }
  async $openRemoteSocket(socketFactoryId) {
    if (!this._factory || this._factory.socketFactoryId !== socketFactoryId) {
      throw new Error(`No socket factory with id ${socketFactoryId}`);
    }
    const id = ++this._remoteSocketIdCounter;
    const socket = await this._factory.makeConnection();
    const disposable = new DisposableStore();
    this._managedRemoteSockets.set(id, new ManagedSocket(id, socket, disposable));
    disposable.add(toDisposable(() => this._managedRemoteSockets.delete(id)));
    disposable.add(socket.onDidEnd(() => {
      this._proxy.$onDidManagedSocketEnd(id);
      disposable.dispose();
    }));
    disposable.add(socket.onDidClose((e) => {
      this._proxy.$onDidManagedSocketClose(id, e?.stack ?? e?.message);
      disposable.dispose();
    }));
    disposable.add(socket.onDidReceiveMessage((e) => this._proxy.$onDidManagedSocketHaveData(id, VSBuffer.wrap(e))));
    return id;
  }
  $remoteSocketWrite(socketId, buffer) {
    this._managedRemoteSockets.get(socketId)?.actual.send(buffer.buffer);
  }
  $remoteSocketEnd(socketId) {
    const socket = this._managedRemoteSockets.get(socketId);
    if (socket) {
      socket.actual.end();
      socket.dispose();
    }
  }
  async $remoteSocketDrain(socketId) {
    await this._managedRemoteSockets.get(socketId)?.actual.drain?.();
  }
};
ExtHostManagedSockets = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostManagedSockets);
class ManagedSocketFactory {
  constructor(socketFactoryId, makeConnection) {
    this.socketFactoryId = socketFactoryId;
    this.makeConnection = makeConnection;
  }
}
class ManagedSocket extends Disposable {
  constructor(socketId, actual, disposer) {
    super();
    this.socketId = socketId;
    this.actual = actual;
    this._register(disposer);
  }
}
export {
  ExtHostManagedSockets,
  IExtHostManagedSockets
};
