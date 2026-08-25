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
import { getRandomElement } from "../../../common/arrays.js";
import { createCancelablePromise, timeout } from "../../../common/async.js";
import { VSBuffer } from "../../../common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../common/cancellation.js";
import { memoize } from "../../../common/decorators.js";
import { CancellationError, ErrorNoTelemetry } from "../../../common/errors.js";
import { Emitter, Event, EventMultiplexer, Relay } from "../../../common/event.js";
import { createSingleCallFunction } from "../../../common/functional.js";
import { DisposableStore, dispose, toDisposable } from "../../../common/lifecycle.js";
import { revive } from "../../../common/marshalling.js";
import * as strings from "../../../common/strings.js";
import { isFunction, isUndefinedOrNull } from "../../../common/types.js";
var RequestType = /* @__PURE__ */ ((RequestType2) => {
  RequestType2[RequestType2["Promise"] = 100] = "Promise";
  RequestType2[RequestType2["PromiseCancel"] = 101] = "PromiseCancel";
  RequestType2[RequestType2["EventListen"] = 102] = "EventListen";
  RequestType2[RequestType2["EventDispose"] = 103] = "EventDispose";
  return RequestType2;
})(RequestType || {});
function requestTypeToStr(type) {
  switch (type) {
    case 100 /* Promise */:
      return "req";
    case 101 /* PromiseCancel */:
      return "cancel";
    case 102 /* EventListen */:
      return "subscribe";
    case 103 /* EventDispose */:
      return "unsubscribe";
  }
}
var ResponseType = /* @__PURE__ */ ((ResponseType2) => {
  ResponseType2[ResponseType2["Initialize"] = 200] = "Initialize";
  ResponseType2[ResponseType2["PromiseSuccess"] = 201] = "PromiseSuccess";
  ResponseType2[ResponseType2["PromiseError"] = 202] = "PromiseError";
  ResponseType2[ResponseType2["PromiseErrorObj"] = 203] = "PromiseErrorObj";
  ResponseType2[ResponseType2["EventFire"] = 204] = "EventFire";
  return ResponseType2;
})(ResponseType || {});
function responseTypeToStr(type) {
  switch (type) {
    case 200 /* Initialize */:
      return `init`;
    case 201 /* PromiseSuccess */:
      return `reply:`;
    case 202 /* PromiseError */:
    case 203 /* PromiseErrorObj */:
      return `replyErr:`;
    case 204 /* EventFire */:
      return `event:`;
  }
}
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Uninitialized"] = 0] = "Uninitialized";
  State2[State2["Idle"] = 1] = "Idle";
  return State2;
})(State || {});
function readIntVQL(reader) {
  let value = 0;
  for (let n = 0; ; n += 7) {
    const next = reader.read(1);
    value |= (next.buffer[0] & 127) << n;
    if (!(next.buffer[0] & 128)) {
      return value;
    }
  }
}
const vqlZero = createOneByteBuffer(0);
function writeInt32VQL(writer, value) {
  if (value === 0) {
    writer.write(vqlZero);
    return;
  }
  let len = 0;
  for (let v2 = value; v2 !== 0; v2 = v2 >>> 7) {
    len++;
  }
  const scratch = VSBuffer.alloc(len);
  for (let i = 0; value !== 0; i++) {
    scratch.buffer[i] = value & 127;
    value = value >>> 7;
    if (value > 0) {
      scratch.buffer[i] |= 128;
    }
  }
  writer.write(scratch);
}
class BufferReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.pos = 0;
  }
  read(bytes) {
    const result = this.buffer.slice(this.pos, this.pos + bytes);
    this.pos += result.byteLength;
    return result;
  }
}
class BufferWriter {
  constructor() {
    this.buffers = [];
  }
  get buffer() {
    return VSBuffer.concat(this.buffers);
  }
  write(buffer) {
    this.buffers.push(buffer);
  }
  dispose() {
    this.buffers.length = 0;
  }
}
var DataType = /* @__PURE__ */ ((DataType2) => {
  DataType2[DataType2["Undefined"] = 0] = "Undefined";
  DataType2[DataType2["String"] = 1] = "String";
  DataType2[DataType2["Buffer"] = 2] = "Buffer";
  DataType2[DataType2["VSBuffer"] = 3] = "VSBuffer";
  DataType2[DataType2["Array"] = 4] = "Array";
  DataType2[DataType2["Object"] = 5] = "Object";
  DataType2[DataType2["Int"] = 6] = "Int";
  return DataType2;
})(DataType || {});
function createOneByteBuffer(value) {
  const result = VSBuffer.alloc(1);
  result.writeUInt8(value, 0);
  return result;
}
const BufferPresets = {
  Undefined: createOneByteBuffer(0 /* Undefined */),
  String: createOneByteBuffer(1 /* String */),
  Buffer: createOneByteBuffer(2 /* Buffer */),
  VSBuffer: createOneByteBuffer(3 /* VSBuffer */),
  Array: createOneByteBuffer(4 /* Array */),
  Object: createOneByteBuffer(5 /* Object */),
  Uint: createOneByteBuffer(6 /* Int */)
};
function serialize(writer, data) {
  if (typeof data === "undefined") {
    writer.write(BufferPresets.Undefined);
  } else if (typeof data === "string") {
    const buffer = VSBuffer.fromString(data);
    writer.write(BufferPresets.String);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);
  } else if (VSBuffer.isNativeBuffer(data)) {
    const buffer = VSBuffer.wrap(data);
    writer.write(BufferPresets.Buffer);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);
  } else if (data instanceof VSBuffer) {
    writer.write(BufferPresets.VSBuffer);
    writeInt32VQL(writer, data.byteLength);
    writer.write(data);
  } else if (Array.isArray(data)) {
    writer.write(BufferPresets.Array);
    writeInt32VQL(writer, data.length);
    for (const el of data) {
      serialize(writer, el);
    }
  } else if (typeof data === "number" && (data | 0) === data) {
    writer.write(BufferPresets.Uint);
    writeInt32VQL(writer, data);
  } else {
    const buffer = VSBuffer.fromString(JSON.stringify(data));
    writer.write(BufferPresets.Object);
    writeInt32VQL(writer, buffer.byteLength);
    writer.write(buffer);
  }
}
function deserialize(reader) {
  const type = reader.read(1).readUInt8(0);
  switch (type) {
    case 0 /* Undefined */:
      return void 0;
    case 1 /* String */:
      return reader.read(readIntVQL(reader)).toString();
    case 2 /* Buffer */:
      return reader.read(readIntVQL(reader)).buffer;
    case 3 /* VSBuffer */:
      return reader.read(readIntVQL(reader));
    case 4 /* Array */: {
      const length = readIntVQL(reader);
      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(deserialize(reader));
      }
      return result;
    }
    case 5 /* Object */:
      return JSON.parse(reader.read(readIntVQL(reader)).toString());
    case 6 /* Int */:
      return readIntVQL(reader);
  }
}
class ChannelServer {
  constructor(protocol, ctx, logger = null, timeoutDelay = 1e3) {
    this.protocol = protocol;
    this.ctx = ctx;
    this.logger = logger;
    this.timeoutDelay = timeoutDelay;
    this.channels = /* @__PURE__ */ new Map();
    this.activeRequests = /* @__PURE__ */ new Map();
    // Requests might come in for channels which are not yet registered.
    // They will timeout after `timeoutDelay`.
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.protocolListener = this.protocol.onMessage((msg) => this.onRawMessage(msg));
    this.sendResponse({ type: 200 /* Initialize */ });
  }
  registerChannel(channelName, channel) {
    this.channels.set(channelName, channel);
    setTimeout(() => this.flushPendingRequests(channelName), 0);
  }
  sendResponse(response) {
    switch (response.type) {
      case 200 /* Initialize */: {
        const msgLength = this.send([response.type]);
        this.logger?.logOutgoing(msgLength, 0, 1 /* OtherSide */, responseTypeToStr(response.type));
        return;
      }
      case 201 /* PromiseSuccess */:
      case 202 /* PromiseError */:
      case 204 /* EventFire */:
      case 203 /* PromiseErrorObj */: {
        const msgLength = this.send([response.type, response.id], response.data);
        this.logger?.logOutgoing(msgLength, response.id, 1 /* OtherSide */, responseTypeToStr(response.type), response.data);
        return;
      }
    }
  }
  send(header, body = void 0) {
    const writer = new BufferWriter();
    try {
      serialize(writer, header);
      serialize(writer, body);
      return this.sendBuffer(writer.buffer);
    } finally {
      writer.dispose();
    }
  }
  sendBuffer(message) {
    try {
      this.protocol.send(message);
      return message.byteLength;
    } catch (err) {
      return 0;
    }
  }
  onRawMessage(message) {
    const reader = new BufferReader(message);
    const header = deserialize(reader);
    const body = deserialize(reader);
    const type = header[0];
    switch (type) {
      case 100 /* Promise */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`, body);
        return this.onPromise({ type, id: header[1], channelName: header[2], name: header[3], arg: body });
      case 102 /* EventListen */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`, body);
        return this.onEventListen({ type, id: header[1], channelName: header[2], name: header[3], arg: body });
      case 101 /* PromiseCancel */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}`);
        return this.disposeActiveRequest({ type, id: header[1] });
      case 103 /* EventDispose */:
        this.logger?.logIncoming(message.byteLength, header[1], 1 /* OtherSide */, `${requestTypeToStr(type)}`);
        return this.disposeActiveRequest({ type, id: header[1] });
    }
  }
  onPromise(request) {
    const channel = this.channels.get(request.channelName);
    if (!channel) {
      this.collectPendingRequest(request);
      return;
    }
    const cancellationTokenSource = new CancellationTokenSource();
    let promise;
    try {
      promise = channel.call(this.ctx, request.name, request.arg, cancellationTokenSource.token);
    } catch (err) {
      promise = Promise.reject(err);
    }
    const id = request.id;
    promise.then((data) => {
      this.sendResponse({ id, data, type: 201 /* PromiseSuccess */ });
    }, (err) => {
      if (err instanceof Error) {
        this.sendResponse({
          id,
          data: {
            message: err.message,
            name: err.name,
            stack: err.stack ? err.stack.split("\n") : void 0
          },
          type: 202 /* PromiseError */
        });
      } else {
        this.sendResponse({ id, data: err, type: 203 /* PromiseErrorObj */ });
      }
    }).finally(() => {
      disposable.dispose();
      this.activeRequests.delete(request.id);
    });
    const disposable = toDisposable(() => cancellationTokenSource.cancel());
    this.activeRequests.set(request.id, disposable);
  }
  onEventListen(request) {
    const channel = this.channels.get(request.channelName);
    if (!channel) {
      this.collectPendingRequest(request);
      return;
    }
    const id = request.id;
    const event = channel.listen(this.ctx, request.name, request.arg);
    const disposable = event((data) => this.sendResponse({ id, data, type: 204 /* EventFire */ }));
    this.activeRequests.set(request.id, disposable);
  }
  disposeActiveRequest(request) {
    const disposable = this.activeRequests.get(request.id);
    if (disposable) {
      disposable.dispose();
      this.activeRequests.delete(request.id);
    }
  }
  collectPendingRequest(request) {
    let pendingRequests = this.pendingRequests.get(request.channelName);
    if (!pendingRequests) {
      pendingRequests = [];
      this.pendingRequests.set(request.channelName, pendingRequests);
    }
    const timer = setTimeout(() => {
      console.error(`Unknown channel: ${request.channelName}`);
      if (request.type === 100 /* Promise */) {
        this.sendResponse({
          id: request.id,
          data: { name: "Unknown channel", message: `Channel name '${request.channelName}' timed out after ${this.timeoutDelay}ms`, stack: void 0 },
          type: 202 /* PromiseError */
        });
      }
    }, this.timeoutDelay);
    pendingRequests.push({ request, timeoutTimer: timer });
  }
  flushPendingRequests(channelName) {
    const requests = this.pendingRequests.get(channelName);
    if (requests) {
      for (const request of requests) {
        clearTimeout(request.timeoutTimer);
        switch (request.request.type) {
          case 100 /* Promise */:
            this.onPromise(request.request);
            break;
          case 102 /* EventListen */:
            this.onEventListen(request.request);
            break;
        }
      }
      this.pendingRequests.delete(channelName);
    }
  }
  dispose() {
    if (this.protocolListener) {
      this.protocolListener.dispose();
      this.protocolListener = null;
    }
    dispose(this.activeRequests.values());
    this.activeRequests.clear();
  }
}
var RequestInitiator = /* @__PURE__ */ ((RequestInitiator2) => {
  RequestInitiator2[RequestInitiator2["LocalSide"] = 0] = "LocalSide";
  RequestInitiator2[RequestInitiator2["OtherSide"] = 1] = "OtherSide";
  return RequestInitiator2;
})(RequestInitiator || {});
class ChannelClient {
  constructor(protocol, logger = null) {
    this.protocol = protocol;
    this.isDisposed = false;
    this.state = 0 /* Uninitialized */;
    this.activeRequests = /* @__PURE__ */ new Set();
    this.handlers = /* @__PURE__ */ new Map();
    this.lastRequestId = 0;
    this._onDidInitialize = new Emitter();
    this.onDidInitialize = this._onDidInitialize.event;
    this.protocolListener = this.protocol.onMessage((msg) => this.onBuffer(msg));
    this.logger = logger;
  }
  getChannel(channelName) {
    const that = this;
    return {
      call(command, arg, cancellationToken) {
        if (that.isDisposed) {
          return Promise.reject(new CancellationError());
        }
        return that.requestPromise(channelName, command, arg, cancellationToken);
      },
      listen(event, arg) {
        if (that.isDisposed) {
          return Event.None;
        }
        return that.requestEvent(channelName, event, arg);
      }
    };
  }
  requestPromise(channelName, name, arg, cancellationToken = CancellationToken.None) {
    const id = this.lastRequestId++;
    const type = 100 /* Promise */;
    const request = { id, type, channelName, name, arg };
    if (cancellationToken.isCancellationRequested) {
      return Promise.reject(new CancellationError());
    }
    let disposable;
    let disposableWithRequestCancel;
    const result = new Promise((c, e) => {
      if (cancellationToken.isCancellationRequested) {
        return e(new CancellationError());
      }
      const doRequest = () => {
        const handler = (response) => {
          switch (response.type) {
            case 201 /* PromiseSuccess */:
              this.handlers.delete(id);
              c(response.data);
              break;
            case 202 /* PromiseError */: {
              this.handlers.delete(id);
              const error = new Error(response.data.message);
              error.stack = Array.isArray(response.data.stack) ? response.data.stack.join("\n") : response.data.stack;
              error.name = response.data.name;
              e(error);
              break;
            }
            case 203 /* PromiseErrorObj */:
              this.handlers.delete(id);
              e(response.data);
              break;
          }
        };
        this.handlers.set(id, handler);
        try {
          this.sendRequest(request);
        } catch (err) {
          this.handlers.delete(id);
          e(err);
        }
      };
      let uninitializedPromise = null;
      if (this.state === 1 /* Idle */) {
        doRequest();
      } else {
        uninitializedPromise = createCancelablePromise((_) => this.whenInitialized());
        uninitializedPromise.then(() => {
          uninitializedPromise = null;
          doRequest();
        });
      }
      const cancel = () => {
        if (uninitializedPromise) {
          uninitializedPromise.cancel();
          uninitializedPromise = null;
        } else {
          this.sendRequest({ id, type: 101 /* PromiseCancel */ });
        }
        e(new CancellationError());
      };
      disposable = cancellationToken.onCancellationRequested(cancel);
      disposableWithRequestCancel = {
        dispose: createSingleCallFunction(() => {
          cancel();
          disposable.dispose();
        })
      };
      this.activeRequests.add(disposableWithRequestCancel);
    });
    return result.finally(() => {
      disposable?.dispose();
      this.activeRequests.delete(disposableWithRequestCancel);
    });
  }
  requestEvent(channelName, name, arg) {
    const id = this.lastRequestId++;
    const type = 102 /* EventListen */;
    const request = { id, type, channelName, name, arg };
    let uninitializedPromise = null;
    const emitter = new Emitter({
      onWillAddFirstListener: () => {
        const handler = (res) => emitter.fire(res.data);
        this.handlers.set(id, handler);
        const doRequest = () => {
          this.activeRequests.add(emitter);
          this.sendRequest(request);
        };
        if (this.state === 1 /* Idle */) {
          doRequest();
        } else {
          uninitializedPromise = createCancelablePromise((_) => this.whenInitialized());
          uninitializedPromise.then(() => {
            uninitializedPromise = null;
            doRequest();
          });
        }
      },
      onDidRemoveLastListener: () => {
        if (uninitializedPromise) {
          uninitializedPromise.cancel();
          uninitializedPromise = null;
        } else {
          this.activeRequests.delete(emitter);
          this.sendRequest({ id, type: 103 /* EventDispose */ });
        }
        this.handlers.delete(id);
      }
    });
    return emitter.event;
  }
  sendRequest(request) {
    switch (request.type) {
      case 100 /* Promise */:
      case 102 /* EventListen */: {
        const msgLength = this.send([request.type, request.id, request.channelName, request.name], request.arg);
        this.logger?.logOutgoing(msgLength, request.id, 0 /* LocalSide */, `${requestTypeToStr(request.type)}: ${request.channelName}.${request.name}`, request.arg);
        return;
      }
      case 101 /* PromiseCancel */:
      case 103 /* EventDispose */: {
        const msgLength = this.send([request.type, request.id]);
        this.logger?.logOutgoing(msgLength, request.id, 0 /* LocalSide */, requestTypeToStr(request.type));
        return;
      }
    }
  }
  send(header, body = void 0) {
    const writer = new BufferWriter();
    try {
      serialize(writer, header);
      serialize(writer, body);
      return this.sendBuffer(writer.buffer);
    } finally {
      writer.dispose();
    }
  }
  sendBuffer(message) {
    try {
      this.protocol.send(message);
      return message.byteLength;
    } catch (err) {
      return 0;
    }
  }
  onBuffer(message) {
    const reader = new BufferReader(message);
    const header = deserialize(reader);
    const body = deserialize(reader);
    const type = header[0];
    switch (type) {
      case 200 /* Initialize */:
        this.logger?.logIncoming(message.byteLength, 0, 0 /* LocalSide */, responseTypeToStr(type));
        return this.onResponse({ type: header[0] });
      case 201 /* PromiseSuccess */:
      case 202 /* PromiseError */:
      case 204 /* EventFire */:
      case 203 /* PromiseErrorObj */:
        this.logger?.logIncoming(message.byteLength, header[1], 0 /* LocalSide */, responseTypeToStr(type), body);
        return this.onResponse({ type: header[0], id: header[1], data: body });
    }
  }
  onResponse(response) {
    if (response.type === 200 /* Initialize */) {
      this.state = 1 /* Idle */;
      this._onDidInitialize.fire();
      return;
    }
    const handler = this.handlers.get(response.id);
    handler?.(response);
  }
  get onDidInitializePromise() {
    return Event.toPromise(this.onDidInitialize);
  }
  whenInitialized() {
    if (this.state === 1 /* Idle */) {
      return Promise.resolve();
    } else {
      return this.onDidInitializePromise;
    }
  }
  dispose() {
    this.isDisposed = true;
    if (this.protocolListener) {
      this.protocolListener.dispose();
      this.protocolListener = null;
    }
    dispose(this.activeRequests.values());
    this.activeRequests.clear();
    this._onDidInitialize.dispose();
  }
}
__decorateClass([
  memoize
], ChannelClient.prototype, "onDidInitializePromise", 1);
class IPCServer {
  constructor(onDidClientConnect, ipcLogger, timeoutDelay) {
    this.channels = /* @__PURE__ */ new Map();
    this._connections = /* @__PURE__ */ new Set();
    this._onDidAddConnection = new Emitter();
    this.onDidAddConnection = this._onDidAddConnection.event;
    this._onDidRemoveConnection = new Emitter();
    this.onDidRemoveConnection = this._onDidRemoveConnection.event;
    this.disposables = new DisposableStore();
    this.disposables.add(onDidClientConnect(({ protocol, onDidClientDisconnect }) => {
      const onFirstMessage = Event.once(protocol.onMessage);
      const connectionDisposables = new DisposableStore();
      const onFirstMessageDisposable = onFirstMessage((msg) => {
        const reader = new BufferReader(msg);
        const ctx = deserialize(reader);
        const channelServer = new ChannelServer(protocol, ctx, ipcLogger, timeoutDelay);
        const channelClient = new ChannelClient(protocol, ipcLogger);
        this.channels.forEach((channel, name) => channelServer.registerChannel(name, channel));
        const connection = { channelServer, channelClient, ctx };
        this._connections.add(connection);
        this._onDidAddConnection.fire(connection);
        connectionDisposables.add(onDidClientDisconnect(() => {
          channelServer.dispose();
          channelClient.dispose();
          this._connections.delete(connection);
          this._onDidRemoveConnection.fire(connection);
          this.disposables.delete(connectionDisposables);
          connectionDisposables.dispose();
        }));
      });
      connectionDisposables.add(onFirstMessageDisposable);
      this.disposables.add(connectionDisposables);
    }));
  }
  get connections() {
    const result = [];
    this._connections.forEach((ctx) => result.push(ctx));
    return result;
  }
  getChannel(channelName, routerOrClientFilter) {
    const that = this;
    return {
      call(command, arg, cancellationToken) {
        let connectionPromise;
        if (isFunction(routerOrClientFilter)) {
          const connection = getRandomElement(that.connections.filter(routerOrClientFilter));
          connectionPromise = connection ? Promise.resolve(connection) : Event.toPromise(Event.filter(that.onDidAddConnection, routerOrClientFilter));
        } else {
          connectionPromise = routerOrClientFilter.routeCall(that, command, arg);
        }
        const channelPromise = connectionPromise.then((connection) => connection.channelClient.getChannel(channelName));
        return getDelayedChannel(channelPromise).call(command, arg, cancellationToken);
      },
      listen(event, arg) {
        if (isFunction(routerOrClientFilter)) {
          return that.getMulticastEvent(channelName, routerOrClientFilter, event, arg);
        }
        const channelPromise = routerOrClientFilter.routeEvent(that, event, arg).then((connection) => connection.channelClient.getChannel(channelName));
        return getDelayedChannel(channelPromise).listen(event, arg);
      }
    };
  }
  getMulticastEvent(channelName, clientFilter, eventName, arg) {
    const that = this;
    let disposables;
    const emitter = new Emitter({
      onWillAddFirstListener: () => {
        disposables = new DisposableStore();
        const eventMultiplexer = new EventMultiplexer();
        const map = /* @__PURE__ */ new Map();
        const onDidAddConnection = (connection) => {
          const channel = connection.channelClient.getChannel(channelName);
          const event = channel.listen(eventName, arg);
          const disposable = eventMultiplexer.add(event);
          map.set(connection, disposable);
        };
        const onDidRemoveConnection = (connection) => {
          const disposable = map.get(connection);
          if (!disposable) {
            return;
          }
          disposable.dispose();
          map.delete(connection);
        };
        that.connections.filter(clientFilter).forEach(onDidAddConnection);
        Event.filter(that.onDidAddConnection, clientFilter)(onDidAddConnection, void 0, disposables);
        that.onDidRemoveConnection(onDidRemoveConnection, void 0, disposables);
        eventMultiplexer.event(emitter.fire, emitter, disposables);
        disposables.add(eventMultiplexer);
      },
      onDidRemoveLastListener: () => {
        disposables?.dispose();
        disposables = void 0;
      }
    });
    that.disposables.add(emitter);
    return emitter.event;
  }
  registerChannel(channelName, channel) {
    this.channels.set(channelName, channel);
    for (const connection of this._connections) {
      connection.channelServer.registerChannel(channelName, channel);
    }
  }
  dispose() {
    this.disposables.dispose();
    for (const connection of this._connections) {
      connection.channelClient.dispose();
      connection.channelServer.dispose();
    }
    this._connections.clear();
    this.channels.clear();
    this._onDidAddConnection.dispose();
    this._onDidRemoveConnection.dispose();
  }
}
class IPCClient {
  constructor(protocol, ctx, ipcLogger = null) {
    const writer = new BufferWriter();
    try {
      serialize(writer, ctx);
      protocol.send(writer.buffer);
    } finally {
      writer.dispose();
    }
    this.channelClient = new ChannelClient(protocol, ipcLogger);
    this.channelServer = new ChannelServer(protocol, ctx, ipcLogger);
  }
  getChannel(channelName) {
    return this.channelClient.getChannel(channelName);
  }
  registerChannel(channelName, channel) {
    this.channelServer.registerChannel(channelName, channel);
  }
  dispose() {
    this.channelClient.dispose();
    this.channelServer.dispose();
  }
}
function getDelayedChannel(promise) {
  return {
    call(command, arg, cancellationToken) {
      return promise.then((c) => c.call(command, arg, cancellationToken));
    },
    listen(event, arg) {
      const relay = new Relay();
      promise.then((c) => relay.input = c.listen(event, arg));
      return relay.event;
    }
  };
}
function getNextTickChannel(channel) {
  let didTick = false;
  return {
    call(command, arg, cancellationToken) {
      if (didTick) {
        return channel.call(command, arg, cancellationToken);
      }
      return timeout(0).then(() => didTick = true).then(() => channel.call(command, arg, cancellationToken));
    },
    listen(event, arg) {
      if (didTick) {
        return channel.listen(event, arg);
      }
      const relay = new Relay();
      timeout(0).then(() => didTick = true).then(() => relay.input = channel.listen(event, arg));
      return relay.event;
    }
  };
}
class StaticRouter {
  constructor(fn) {
    this.fn = fn;
  }
  routeCall(hub) {
    return this.route(hub);
  }
  routeEvent(hub) {
    return this.route(hub);
  }
  async route(hub) {
    for (const connection of hub.connections) {
      if (await Promise.resolve(this.fn(connection.ctx))) {
        return Promise.resolve(connection);
      }
    }
    await Event.toPromise(hub.onDidAddConnection);
    return await this.route(hub);
  }
}
var ProxyChannel;
((ProxyChannel2) => {
  function fromService(service, disposables, options) {
    const handler = service;
    const disableMarshalling = options?.disableMarshalling;
    const unbufferedEvents = options?.unbufferedEvents ? new Set(options.unbufferedEvents) : void 0;
    const mapEventNameToEvent = /* @__PURE__ */ new Map();
    for (const key in handler) {
      if (propertyIsEvent(key) && !unbufferedEvents?.has(key)) {
        mapEventNameToEvent.set(key, Event.buffer(handler[key], key, true, void 0, disposables));
      }
    }
    return new class {
      listen(_, event, arg) {
        const eventImpl = mapEventNameToEvent.get(event);
        if (eventImpl) {
          return eventImpl;
        }
        const target = handler[event];
        if (typeof target === "function") {
          if (propertyIsDynamicEvent(event)) {
            return target.call(handler, arg);
          }
          if (propertyIsEvent(event)) {
            if (unbufferedEvents?.has(event)) {
              return handler[event];
            }
            mapEventNameToEvent.set(event, Event.buffer(handler[event], event, true, void 0, disposables));
            return mapEventNameToEvent.get(event);
          }
        }
        throw new ErrorNoTelemetry(`Event not found: ${event}`);
      }
      call(_, command, args) {
        const target = handler[command];
        if (typeof target === "function") {
          if (!disableMarshalling && Array.isArray(args)) {
            for (let i = 0; i < args.length; i++) {
              args[i] = revive(args[i]);
            }
          }
          let res = target.apply(handler, args);
          if (!(res instanceof Promise)) {
            res = Promise.resolve(res);
          }
          return res;
        }
        throw new ErrorNoTelemetry(`Method not found: ${command}`);
      }
    }();
  }
  ProxyChannel2.fromService = fromService;
  function toService(channel, options) {
    const disableMarshalling = options?.disableMarshalling;
    return new Proxy({}, {
      get(_target, propKey) {
        if (typeof propKey === "string") {
          if (options?.properties?.has(propKey)) {
            return options.properties.get(propKey);
          }
          if (propertyIsDynamicEvent(propKey)) {
            return function(arg) {
              return channel.listen(propKey, arg);
            };
          }
          if (propertyIsEvent(propKey)) {
            return channel.listen(propKey);
          }
          return async function(...args) {
            let methodArgs;
            if (options && !isUndefinedOrNull(options.context)) {
              methodArgs = [options.context, ...args];
            } else {
              methodArgs = args;
            }
            const result = await channel.call(propKey, methodArgs);
            if (!disableMarshalling) {
              return revive(result);
            }
            return result;
          };
        }
        throw new ErrorNoTelemetry(`Property not found: ${String(propKey)}`);
      }
    });
  }
  ProxyChannel2.toService = toService;
  function propertyIsEvent(name) {
    return name[0] === "o" && name[1] === "n" && strings.isUpperAsciiLetter(name.charCodeAt(2));
  }
  function propertyIsDynamicEvent(name) {
    return /^onDynamic/.test(name) && strings.isUpperAsciiLetter(name.charCodeAt(9));
  }
})(ProxyChannel || (ProxyChannel = {}));
const colorTables = [
  ["#2977B1", "#FC802D", "#34A13A", "#D3282F", "#9366BA"],
  ["#8B564C", "#E177C0", "#7F7F7F", "#BBBE3D", "#2EBECD"]
];
function prettyWithoutArrays(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object" && typeof data.toString === "function") {
    const result = data.toString();
    if (result !== "[object Object]") {
      return result;
    }
  }
  return data;
}
function pretty(data) {
  if (Array.isArray(data)) {
    return data.map(prettyWithoutArrays);
  }
  return prettyWithoutArrays(data);
}
function logWithColors(direction, totalLength, msgLength, req, initiator, str, data) {
  data = pretty(data);
  const colorTable = colorTables[initiator];
  const color = colorTable[req % colorTable.length];
  let args = [`%c[${direction}]%c[${String(totalLength).padStart(7, " ")}]%c[len: ${String(msgLength).padStart(5, " ")}]%c${String(req).padStart(5, " ")} - ${str}`, "color: darkgreen", "color: grey", "color: grey", `color: ${color}`];
  if (/\($/.test(str)) {
    args = args.concat(data);
    args.push(")");
  } else {
    args.push(data);
  }
  console.log.apply(console, args);
}
class IPCLogger {
  constructor(_outgoingPrefix, _incomingPrefix) {
    this._outgoingPrefix = _outgoingPrefix;
    this._incomingPrefix = _incomingPrefix;
    this._totalIncoming = 0;
    this._totalOutgoing = 0;
  }
  logOutgoing(msgLength, requestId, initiator, str, data) {
    this._totalOutgoing += msgLength;
    logWithColors(this._outgoingPrefix, this._totalOutgoing, msgLength, requestId, initiator, str, data);
  }
  logIncoming(msgLength, requestId, initiator, str, data) {
    this._totalIncoming += msgLength;
    logWithColors(this._incomingPrefix, this._totalIncoming, msgLength, requestId, initiator, str, data);
  }
}
export {
  BufferReader,
  BufferWriter,
  ChannelClient,
  ChannelServer,
  IPCClient,
  IPCLogger,
  IPCServer,
  ProxyChannel,
  RequestInitiator,
  StaticRouter,
  deserialize,
  getDelayedChannel,
  getNextTickChannel,
  serialize
};
