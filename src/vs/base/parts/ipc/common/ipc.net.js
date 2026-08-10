import { VSBuffer } from "../../../common/buffer.js";
import { Emitter } from "../../../common/event.js";
import { Disposable, DisposableStore } from "../../../common/lifecycle.js";
import { IPCClient } from "./ipc.js";
var SocketDiagnosticsEventType = /* @__PURE__ */ ((SocketDiagnosticsEventType2) => {
  SocketDiagnosticsEventType2["Created"] = "created";
  SocketDiagnosticsEventType2["Read"] = "read";
  SocketDiagnosticsEventType2["Write"] = "write";
  SocketDiagnosticsEventType2["Open"] = "open";
  SocketDiagnosticsEventType2["Error"] = "error";
  SocketDiagnosticsEventType2["Close"] = "close";
  SocketDiagnosticsEventType2["BrowserWebSocketBlobReceived"] = "browserWebSocketBlobReceived";
  SocketDiagnosticsEventType2["NodeEndReceived"] = "nodeEndReceived";
  SocketDiagnosticsEventType2["NodeEndSent"] = "nodeEndSent";
  SocketDiagnosticsEventType2["NodeDrainBegin"] = "nodeDrainBegin";
  SocketDiagnosticsEventType2["NodeDrainEnd"] = "nodeDrainEnd";
  SocketDiagnosticsEventType2["zlibInflateError"] = "zlibInflateError";
  SocketDiagnosticsEventType2["zlibInflateData"] = "zlibInflateData";
  SocketDiagnosticsEventType2["zlibInflateInitialWrite"] = "zlibInflateInitialWrite";
  SocketDiagnosticsEventType2["zlibInflateInitialFlushFired"] = "zlibInflateInitialFlushFired";
  SocketDiagnosticsEventType2["zlibInflateWrite"] = "zlibInflateWrite";
  SocketDiagnosticsEventType2["zlibInflateFlushFired"] = "zlibInflateFlushFired";
  SocketDiagnosticsEventType2["zlibDeflateError"] = "zlibDeflateError";
  SocketDiagnosticsEventType2["zlibDeflateData"] = "zlibDeflateData";
  SocketDiagnosticsEventType2["zlibDeflateWrite"] = "zlibDeflateWrite";
  SocketDiagnosticsEventType2["zlibDeflateFlushFired"] = "zlibDeflateFlushFired";
  SocketDiagnosticsEventType2["WebSocketNodeSocketWrite"] = "webSocketNodeSocketWrite";
  SocketDiagnosticsEventType2["WebSocketNodeSocketPeekedHeader"] = "webSocketNodeSocketPeekedHeader";
  SocketDiagnosticsEventType2["WebSocketNodeSocketReadHeader"] = "webSocketNodeSocketReadHeader";
  SocketDiagnosticsEventType2["WebSocketNodeSocketReadData"] = "webSocketNodeSocketReadData";
  SocketDiagnosticsEventType2["WebSocketNodeSocketUnmaskedData"] = "webSocketNodeSocketUnmaskedData";
  SocketDiagnosticsEventType2["WebSocketNodeSocketDrainBegin"] = "webSocketNodeSocketDrainBegin";
  SocketDiagnosticsEventType2["WebSocketNodeSocketDrainEnd"] = "webSocketNodeSocketDrainEnd";
  SocketDiagnosticsEventType2["ProtocolHeaderRead"] = "protocolHeaderRead";
  SocketDiagnosticsEventType2["ProtocolMessageRead"] = "protocolMessageRead";
  SocketDiagnosticsEventType2["ProtocolHeaderWrite"] = "protocolHeaderWrite";
  SocketDiagnosticsEventType2["ProtocolMessageWrite"] = "protocolMessageWrite";
  SocketDiagnosticsEventType2["ProtocolWrite"] = "protocolWrite";
  return SocketDiagnosticsEventType2;
})(SocketDiagnosticsEventType || {});
var SocketDiagnostics;
((SocketDiagnostics2) => {
  SocketDiagnostics2.enableDiagnostics = false;
  SocketDiagnostics2.records = [];
  const socketIds = /* @__PURE__ */ new WeakMap();
  let lastUsedSocketId = 0;
  function getSocketId(nativeObject, label) {
    if (!socketIds.has(nativeObject)) {
      const id = String(++lastUsedSocketId);
      socketIds.set(nativeObject, id);
    }
    return socketIds.get(nativeObject);
  }
  function traceSocketEvent(nativeObject, socketDebugLabel, type, data) {
    if (!SocketDiagnostics2.enableDiagnostics) {
      return;
    }
    const id = getSocketId(nativeObject, socketDebugLabel);
    if (data instanceof VSBuffer || data instanceof Uint8Array || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const copiedData = VSBuffer.alloc(data.byteLength);
      copiedData.set(data);
      SocketDiagnostics2.records.push({ timestamp: Date.now(), id, label: socketDebugLabel, type, buff: copiedData });
    } else {
      SocketDiagnostics2.records.push({ timestamp: Date.now(), id, label: socketDebugLabel, type, data });
    }
  }
  SocketDiagnostics2.traceSocketEvent = traceSocketEvent;
})(SocketDiagnostics || (SocketDiagnostics = {}));
var SocketCloseEventType = /* @__PURE__ */ ((SocketCloseEventType2) => {
  SocketCloseEventType2[SocketCloseEventType2["NodeSocketCloseEvent"] = 0] = "NodeSocketCloseEvent";
  SocketCloseEventType2[SocketCloseEventType2["WebSocketCloseEvent"] = 1] = "WebSocketCloseEvent";
  return SocketCloseEventType2;
})(SocketCloseEventType || {});
var SocketTimeoutReason = /* @__PURE__ */ ((SocketTimeoutReason2) => {
  SocketTimeoutReason2["UNACKNOWLEDGED_MESSAGE"] = "unacknowledgedMessage";
  SocketTimeoutReason2["KEEP_ALIVE"] = "keepAlive";
  return SocketTimeoutReason2;
})(SocketTimeoutReason || {});
let emptyBuffer = null;
function getEmptyBuffer() {
  if (!emptyBuffer) {
    emptyBuffer = VSBuffer.alloc(0);
  }
  return emptyBuffer;
}
class ChunkStream {
  get byteLength() {
    return this._totalLength;
  }
  constructor() {
    this._chunks = [];
    this._totalLength = 0;
  }
  acceptChunk(buff) {
    this._chunks.push(buff);
    this._totalLength += buff.byteLength;
  }
  read(byteCount) {
    return this._read(byteCount, true);
  }
  peek(byteCount) {
    return this._read(byteCount, false);
  }
  _read(byteCount, advance) {
    if (byteCount === 0) {
      return getEmptyBuffer();
    }
    if (byteCount > this._totalLength) {
      throw new Error(`Cannot read so many bytes!`);
    }
    if (this._chunks[0].byteLength === byteCount) {
      const result2 = this._chunks[0];
      if (advance) {
        this._chunks.shift();
        this._totalLength -= byteCount;
      }
      return result2;
    }
    if (this._chunks[0].byteLength > byteCount) {
      const result2 = this._chunks[0].slice(0, byteCount);
      if (advance) {
        this._chunks[0] = this._chunks[0].slice(byteCount);
        this._totalLength -= byteCount;
      }
      return result2;
    }
    const result = VSBuffer.alloc(byteCount);
    let resultOffset = 0;
    let chunkIndex = 0;
    while (byteCount > 0) {
      const chunk = this._chunks[chunkIndex];
      if (chunk.byteLength > byteCount) {
        const chunkPart = chunk.slice(0, byteCount);
        result.set(chunkPart, resultOffset);
        resultOffset += byteCount;
        if (advance) {
          this._chunks[chunkIndex] = chunk.slice(byteCount);
          this._totalLength -= byteCount;
        }
        byteCount -= byteCount;
      } else {
        result.set(chunk, resultOffset);
        resultOffset += chunk.byteLength;
        if (advance) {
          this._chunks.shift();
          this._totalLength -= chunk.byteLength;
        } else {
          chunkIndex++;
        }
        byteCount -= chunk.byteLength;
      }
    }
    return result;
  }
}
var ProtocolMessageType = /* @__PURE__ */ ((ProtocolMessageType2) => {
  ProtocolMessageType2[ProtocolMessageType2["None"] = 0] = "None";
  ProtocolMessageType2[ProtocolMessageType2["Regular"] = 1] = "Regular";
  ProtocolMessageType2[ProtocolMessageType2["Control"] = 2] = "Control";
  ProtocolMessageType2[ProtocolMessageType2["Ack"] = 3] = "Ack";
  ProtocolMessageType2[ProtocolMessageType2["Disconnect"] = 5] = "Disconnect";
  ProtocolMessageType2[ProtocolMessageType2["ReplayRequest"] = 6] = "ReplayRequest";
  ProtocolMessageType2[ProtocolMessageType2["Pause"] = 7] = "Pause";
  ProtocolMessageType2[ProtocolMessageType2["Resume"] = 8] = "Resume";
  ProtocolMessageType2[ProtocolMessageType2["KeepAlive"] = 9] = "KeepAlive";
  return ProtocolMessageType2;
})(ProtocolMessageType || {});
function protocolMessageTypeToString(messageType) {
  switch (messageType) {
    case 0 /* None */:
      return "None";
    case 1 /* Regular */:
      return "Regular";
    case 2 /* Control */:
      return "Control";
    case 3 /* Ack */:
      return "Ack";
    case 5 /* Disconnect */:
      return "Disconnect";
    case 6 /* ReplayRequest */:
      return "ReplayRequest";
    case 7 /* Pause */:
      return "PauseWriting";
    case 8 /* Resume */:
      return "ResumeWriting";
    case 9 /* KeepAlive */:
      return "KeepAlive";
  }
}
var ProtocolConstants = /* @__PURE__ */ ((ProtocolConstants2) => {
  ProtocolConstants2[ProtocolConstants2["HeaderLength"] = 13] = "HeaderLength";
  ProtocolConstants2[ProtocolConstants2["AcknowledgeTime"] = 2e3] = "AcknowledgeTime";
  ProtocolConstants2[ProtocolConstants2["TimeoutTime"] = 2e4] = "TimeoutTime";
  ProtocolConstants2[ProtocolConstants2["ReconnectionGraceTime"] = 108e5] = "ReconnectionGraceTime";
  ProtocolConstants2[ProtocolConstants2["ReconnectionShortGraceTime"] = 3e5] = "ReconnectionShortGraceTime";
  ProtocolConstants2[ProtocolConstants2["KeepAliveSendTime"] = 5e3] = "KeepAliveSendTime";
  return ProtocolConstants2;
})(ProtocolConstants || {});
class ProtocolMessage {
  constructor(type, id, ack, data) {
    this.type = type;
    this.id = id;
    this.ack = ack;
    this.data = data;
    this.writtenTime = 0;
  }
  get size() {
    return this.data.byteLength;
  }
}
class ProtocolReader extends Disposable {
  constructor(socket) {
    super();
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._state = {
      readHead: true,
      readLen: 13 /* HeaderLength */,
      messageType: 0 /* None */,
      id: 0,
      ack: 0
    };
    this._socket = socket;
    this._isDisposed = false;
    this._incomingData = new ChunkStream();
    this._register(this._socket.onData((data) => this.acceptChunk(data)));
    this.lastReadTime = Date.now();
  }
  acceptChunk(data) {
    if (!data || data.byteLength === 0) {
      return;
    }
    this.lastReadTime = Date.now();
    this._incomingData.acceptChunk(data);
    while (this._incomingData.byteLength >= this._state.readLen) {
      const buff = this._incomingData.read(this._state.readLen);
      if (this._state.readHead) {
        this._state.readHead = false;
        this._state.readLen = buff.readUInt32BE(9);
        this._state.messageType = buff.readUInt8(0);
        this._state.id = buff.readUInt32BE(1);
        this._state.ack = buff.readUInt32BE(5);
        this._socket.traceSocketEvent("protocolHeaderRead" /* ProtocolHeaderRead */, { messageType: protocolMessageTypeToString(this._state.messageType), id: this._state.id, ack: this._state.ack, messageSize: this._state.readLen });
      } else {
        const messageType = this._state.messageType;
        const id = this._state.id;
        const ack = this._state.ack;
        this._state.readHead = true;
        this._state.readLen = 13 /* HeaderLength */;
        this._state.messageType = 0 /* None */;
        this._state.id = 0;
        this._state.ack = 0;
        this._socket.traceSocketEvent("protocolMessageRead" /* ProtocolMessageRead */, buff);
        this._onMessage.fire(new ProtocolMessage(messageType, id, ack, buff));
        if (this._isDisposed) {
          break;
        }
      }
    }
  }
  readEntireBuffer() {
    return this._incomingData.read(this._incomingData.byteLength);
  }
  dispose() {
    this._isDisposed = true;
    super.dispose();
  }
}
class ProtocolWriter {
  constructor(socket) {
    this._writeNowTimeout = null;
    this._isDisposed = false;
    this._isPaused = false;
    this._socket = socket;
    this._data = [];
    this._totalLength = 0;
    this.lastWriteTime = 0;
  }
  dispose() {
    try {
      this.flush();
    } catch (err) {
    }
    this._isDisposed = true;
  }
  drain() {
    this.flush();
    return this._socket.drain();
  }
  flush() {
    this._writeNow();
  }
  pause() {
    this._isPaused = true;
  }
  resume() {
    this._isPaused = false;
    this._scheduleWriting();
  }
  write(msg) {
    if (this._isDisposed) {
      return;
    }
    msg.writtenTime = Date.now();
    this.lastWriteTime = Date.now();
    const header = VSBuffer.alloc(13 /* HeaderLength */);
    header.writeUInt8(msg.type, 0);
    header.writeUInt32BE(msg.id, 1);
    header.writeUInt32BE(msg.ack, 5);
    header.writeUInt32BE(msg.data.byteLength, 9);
    this._socket.traceSocketEvent("protocolHeaderWrite" /* ProtocolHeaderWrite */, { messageType: protocolMessageTypeToString(msg.type), id: msg.id, ack: msg.ack, messageSize: msg.data.byteLength });
    this._socket.traceSocketEvent("protocolMessageWrite" /* ProtocolMessageWrite */, msg.data);
    this._writeSoon(header, msg.data);
  }
  _bufferAdd(head, body) {
    const wasEmpty = this._totalLength === 0;
    this._data.push(head, body);
    this._totalLength += head.byteLength + body.byteLength;
    return wasEmpty;
  }
  _bufferTake() {
    const ret = VSBuffer.concat(this._data, this._totalLength);
    this._data.length = 0;
    this._totalLength = 0;
    return ret;
  }
  _writeSoon(header, data) {
    if (this._bufferAdd(header, data)) {
      this._scheduleWriting();
    }
  }
  _scheduleWriting() {
    if (this._writeNowTimeout) {
      return;
    }
    this._writeNowTimeout = setTimeout(() => {
      this._writeNowTimeout = null;
      this._writeNow();
    });
  }
  _writeNow() {
    if (this._totalLength === 0) {
      return;
    }
    if (this._isPaused) {
      return;
    }
    const data = this._bufferTake();
    this._socket.traceSocketEvent("protocolWrite" /* ProtocolWrite */, { byteLength: data.byteLength });
    this._socket.write(data);
  }
}
class Protocol extends Disposable {
  constructor(socket) {
    super();
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._socket = socket;
    this._socketWriter = this._register(new ProtocolWriter(this._socket));
    this._socketReader = this._register(new ProtocolReader(this._socket));
    this._register(this._socketReader.onMessage((msg) => {
      if (msg.type === 1 /* Regular */) {
        this._onMessage.fire(msg.data);
      }
    }));
    this._register(this._socket.onClose(() => this._onDidDispose.fire()));
  }
  drain() {
    return this._socketWriter.drain();
  }
  getSocket() {
    return this._socket;
  }
  sendDisconnect() {
  }
  send(buffer) {
    this._socketWriter.write(new ProtocolMessage(1 /* Regular */, 0, 0, buffer));
  }
}
class Client extends IPCClient {
  constructor(protocol, id, ipcLogger = null) {
    super(protocol, id, ipcLogger);
    this.protocol = protocol;
  }
  static fromSocket(socket, id) {
    return new Client(new Protocol(socket), id);
  }
  get onDidDispose() {
    return this.protocol.onDidDispose;
  }
  dispose() {
    super.dispose();
    const socket = this.protocol.getSocket();
    this.protocol.sendDisconnect();
    this.protocol.dispose();
    socket.end();
  }
}
class BufferedEmitter {
  constructor() {
    this._hasListeners = false;
    this._isDeliveringMessages = false;
    this._bufferedMessages = [];
    this._emitter = new Emitter({
      onWillAddFirstListener: () => {
        this._hasListeners = true;
        queueMicrotask(() => this._deliverMessages());
      },
      onDidRemoveLastListener: () => {
        this._hasListeners = false;
      }
    });
    this.event = this._emitter.event;
  }
  _deliverMessages() {
    if (this._isDeliveringMessages) {
      return;
    }
    this._isDeliveringMessages = true;
    while (this._hasListeners && this._bufferedMessages.length > 0) {
      this._emitter.fire(this._bufferedMessages.shift());
    }
    this._isDeliveringMessages = false;
  }
  fire(event) {
    if (this._hasListeners) {
      if (this._bufferedMessages.length > 0) {
        this._bufferedMessages.push(event);
      } else {
        this._emitter.fire(event);
      }
    } else {
      this._bufferedMessages.push(event);
    }
  }
  flushBuffer() {
    this._bufferedMessages = [];
  }
}
class QueueElement {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}
class Queue {
  constructor() {
    this._first = null;
    this._last = null;
  }
  length() {
    let result = 0;
    let current = this._first;
    while (current) {
      current = current.next;
      result++;
    }
    return result;
  }
  peek() {
    if (!this._first) {
      return null;
    }
    return this._first.data;
  }
  toArray() {
    const result = [];
    let resultLen = 0;
    let it = this._first;
    while (it) {
      result[resultLen++] = it.data;
      it = it.next;
    }
    return result;
  }
  pop() {
    if (!this._first) {
      return;
    }
    if (this._first === this._last) {
      this._first = null;
      this._last = null;
      return;
    }
    this._first = this._first.next;
  }
  push(item) {
    const element = new QueueElement(item);
    if (!this._first) {
      this._first = element;
      this._last = element;
      return;
    }
    this._last.next = element;
    this._last = element;
  }
}
class LoadEstimator {
  static {
    this._HISTORY_LENGTH = 10;
  }
  static {
    this._INSTANCE = null;
  }
  static getInstance() {
    if (!LoadEstimator._INSTANCE) {
      LoadEstimator._INSTANCE = new LoadEstimator();
    }
    return LoadEstimator._INSTANCE;
  }
  constructor() {
    this.lastRuns = [];
    const now = Date.now();
    for (let i = 0; i < LoadEstimator._HISTORY_LENGTH; i++) {
      this.lastRuns[i] = now - 1e3 * i;
    }
    setInterval(() => {
      for (let i = LoadEstimator._HISTORY_LENGTH; i >= 1; i--) {
        this.lastRuns[i] = this.lastRuns[i - 1];
      }
      this.lastRuns[0] = Date.now();
    }, 1e3);
  }
  /**
   * returns an estimative number, from 0 (low load) to 1 (high load)
   */
  load() {
    const now = Date.now();
    const historyLimit = (1 + LoadEstimator._HISTORY_LENGTH) * 1e3;
    let score = 0;
    for (let i = 0; i < LoadEstimator._HISTORY_LENGTH; i++) {
      if (now - this.lastRuns[i] <= historyLimit) {
        score++;
      }
    }
    return 1 - score / LoadEstimator._HISTORY_LENGTH;
  }
  hasHighLoad() {
    return this.load() >= 0.5;
  }
}
class PersistentProtocol {
  constructor(opts) {
    this._onControlMessage = new BufferedEmitter();
    this.onControlMessage = this._onControlMessage.event;
    this._onMessage = new BufferedEmitter();
    this.onMessage = this._onMessage.event;
    this._onDidDispose = new BufferedEmitter();
    this.onDidDispose = this._onDidDispose.event;
    this._onSocketClose = new BufferedEmitter();
    this.onSocketClose = this._onSocketClose.event;
    this._onSocketTimeout = new BufferedEmitter();
    this.onSocketTimeout = this._onSocketTimeout.event;
    this._loadEstimator = opts.loadEstimator ?? LoadEstimator.getInstance();
    this._shouldSendKeepAlive = opts.sendKeepAlive ?? true;
    this._isReconnecting = false;
    this._outgoingUnackMsg = new Queue();
    this._outgoingMsgId = 0;
    this._outgoingAckId = 0;
    this._outgoingAckTimeout = null;
    this._incomingMsgId = 0;
    this._incomingAckId = 0;
    this._incomingMsgLastTime = 0;
    this._incomingAckTimeout = null;
    this._lastReplayRequestTime = 0;
    this._lastSocketTimeoutTime = Date.now();
    this._socketDisposables = new DisposableStore();
    this._socket = opts.socket;
    this._socketWriter = this._socketDisposables.add(new ProtocolWriter(this._socket));
    this._socketReader = this._socketDisposables.add(new ProtocolReader(this._socket));
    this._socketDisposables.add(this._socketReader.onMessage((msg) => this._receiveMessage(msg)));
    this._socketDisposables.add(this._socket.onClose((e) => this._onSocketClose.fire(e)));
    if (opts.initialChunk) {
      this._socketReader.acceptChunk(opts.initialChunk);
    }
    if (this._shouldSendKeepAlive) {
      this._keepAliveInterval = setInterval(() => {
        this._sendKeepAlive();
      }, 5e3 /* KeepAliveSendTime */);
    } else {
      this._keepAliveInterval = null;
    }
  }
  get unacknowledgedCount() {
    return this._outgoingMsgId - this._outgoingAckId;
  }
  dispose() {
    if (this._outgoingAckTimeout) {
      clearTimeout(this._outgoingAckTimeout);
      this._outgoingAckTimeout = null;
    }
    if (this._incomingAckTimeout) {
      clearTimeout(this._incomingAckTimeout);
      this._incomingAckTimeout = null;
    }
    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
      this._keepAliveInterval = null;
    }
    this._socketDisposables.dispose();
  }
  drain() {
    return this._socketWriter.drain();
  }
  sendDisconnect() {
    if (!this._didSendDisconnect) {
      this._didSendDisconnect = true;
      const msg = new ProtocolMessage(5 /* Disconnect */, 0, 0, getEmptyBuffer());
      this._socketWriter.write(msg);
      this._socketWriter.flush();
    }
  }
  sendPause() {
    const msg = new ProtocolMessage(7 /* Pause */, 0, 0, getEmptyBuffer());
    this._socketWriter.write(msg);
  }
  sendResume() {
    const msg = new ProtocolMessage(8 /* Resume */, 0, 0, getEmptyBuffer());
    this._socketWriter.write(msg);
  }
  pauseSocketWriting() {
    this._socketWriter.pause();
  }
  getSocket() {
    return this._socket;
  }
  getMillisSinceLastIncomingData() {
    return Date.now() - this._socketReader.lastReadTime;
  }
  beginAcceptReconnection(socket, initialDataChunk) {
    this._isReconnecting = true;
    this._socketDisposables.dispose();
    this._socketDisposables = new DisposableStore();
    this._onControlMessage.flushBuffer();
    this._onSocketClose.flushBuffer();
    this._onSocketTimeout.flushBuffer();
    this._socket.dispose();
    this._lastReplayRequestTime = 0;
    this._lastSocketTimeoutTime = Date.now();
    this._socket = socket;
    this._socketWriter = this._socketDisposables.add(new ProtocolWriter(this._socket));
    this._socketReader = this._socketDisposables.add(new ProtocolReader(this._socket));
    this._socketDisposables.add(this._socketReader.onMessage((msg) => this._receiveMessage(msg)));
    this._socketDisposables.add(this._socket.onClose((e) => this._onSocketClose.fire(e)));
    this._socketReader.acceptChunk(initialDataChunk);
  }
  endAcceptReconnection() {
    this._isReconnecting = false;
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(3 /* Ack */, 0, this._incomingAckId, getEmptyBuffer());
    this._socketWriter.write(msg);
    const toSend = this._outgoingUnackMsg.toArray();
    for (let i = 0, len = toSend.length; i < len; i++) {
      this._socketWriter.write(toSend[i]);
    }
    this._recvAckCheck();
  }
  acceptDisconnect() {
    this._onDidDispose.fire();
  }
  _receiveMessage(msg) {
    if (msg.ack > this._outgoingAckId) {
      this._outgoingAckId = msg.ack;
      do {
        const first = this._outgoingUnackMsg.peek();
        if (first && first.id <= msg.ack) {
          this._outgoingUnackMsg.pop();
        } else {
          break;
        }
      } while (true);
    }
    switch (msg.type) {
      case 0 /* None */: {
        break;
      }
      case 1 /* Regular */: {
        if (msg.id > this._incomingMsgId) {
          if (msg.id !== this._incomingMsgId + 1) {
            const now = Date.now();
            if (now - this._lastReplayRequestTime > 1e4) {
              this._lastReplayRequestTime = now;
              this._socketWriter.write(new ProtocolMessage(6 /* ReplayRequest */, 0, 0, getEmptyBuffer()));
            }
          } else {
            this._incomingMsgId = msg.id;
            this._incomingMsgLastTime = Date.now();
            this._sendAckCheck();
            this._onMessage.fire(msg.data);
          }
        }
        break;
      }
      case 2 /* Control */: {
        this._onControlMessage.fire(msg.data);
        break;
      }
      case 3 /* Ack */: {
        break;
      }
      case 5 /* Disconnect */: {
        this._onDidDispose.fire();
        break;
      }
      case 6 /* ReplayRequest */: {
        const toSend = this._outgoingUnackMsg.toArray();
        for (let i = 0, len = toSend.length; i < len; i++) {
          this._socketWriter.write(toSend[i]);
        }
        this._recvAckCheck();
        break;
      }
      case 7 /* Pause */: {
        this._socketWriter.pause();
        break;
      }
      case 8 /* Resume */: {
        this._socketWriter.resume();
        break;
      }
      case 9 /* KeepAlive */: {
        break;
      }
    }
  }
  readEntireBuffer() {
    return this._socketReader.readEntireBuffer();
  }
  flush() {
    this._socketWriter.flush();
  }
  send(buffer) {
    const myId = ++this._outgoingMsgId;
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(1 /* Regular */, myId, this._incomingAckId, buffer);
    this._outgoingUnackMsg.push(msg);
    if (!this._isReconnecting) {
      this._socketWriter.write(msg);
      this._recvAckCheck();
    }
  }
  /**
   * Send a message which will not be part of the regular acknowledge flow.
   * Use this for early control messages which are repeated in case of reconnection.
   */
  sendControl(buffer) {
    const msg = new ProtocolMessage(2 /* Control */, 0, 0, buffer);
    this._socketWriter.write(msg);
  }
  _sendAckCheck() {
    if (this._incomingMsgId <= this._incomingAckId) {
      return;
    }
    if (this._incomingAckTimeout) {
      return;
    }
    const timeSinceLastIncomingMsg = Date.now() - this._incomingMsgLastTime;
    if (timeSinceLastIncomingMsg >= 2e3 /* AcknowledgeTime */) {
      this._sendAck();
      return;
    }
    this._incomingAckTimeout = setTimeout(() => {
      this._incomingAckTimeout = null;
      this._sendAckCheck();
    }, 2e3 /* AcknowledgeTime */ - timeSinceLastIncomingMsg + 5);
  }
  _recvAckCheck() {
    if (this._outgoingMsgId <= this._outgoingAckId) {
      return;
    }
    if (this._outgoingAckTimeout) {
      return;
    }
    if (this._isReconnecting) {
      return;
    }
    const oldestUnacknowledgedMsg = this._outgoingUnackMsg.peek();
    const timeSinceOldestUnacknowledgedMsg = Date.now() - oldestUnacknowledgedMsg.writtenTime;
    const timeSinceLastReceivedSomeData = Date.now() - this._socketReader.lastReadTime;
    const timeSinceLastTimeout = Date.now() - this._lastSocketTimeoutTime;
    if (timeSinceOldestUnacknowledgedMsg >= 2e4 /* TimeoutTime */ && timeSinceLastReceivedSomeData >= 2e4 /* TimeoutTime */ && timeSinceLastTimeout >= 2e4 /* TimeoutTime */) {
      if (!this._loadEstimator.hasHighLoad()) {
        this._lastSocketTimeoutTime = Date.now();
        this._onSocketTimeout.fire({
          reason: "unacknowledgedMessage" /* UNACKNOWLEDGED_MESSAGE */,
          unacknowledgedMsgCount: this._outgoingUnackMsg.length(),
          timeSinceOldestUnacknowledgedMsg,
          timeSinceLastReceivedSomeData
        });
        return;
      }
    }
    const minimumTimeUntilTimeout = Math.max(
      2e4 /* TimeoutTime */ - timeSinceOldestUnacknowledgedMsg,
      2e4 /* TimeoutTime */ - timeSinceLastReceivedSomeData,
      2e4 /* TimeoutTime */ - timeSinceLastTimeout,
      500
    );
    this._outgoingAckTimeout = setTimeout(() => {
      this._outgoingAckTimeout = null;
      this._recvAckCheck();
    }, minimumTimeUntilTimeout);
  }
  /**
   * Called after sending a keepalive. Both sides of this protocol send
   * keepalives every KeepAliveSendTime (5s), so receiving no data for
   * TimeoutTime (20s) means the connection is dead. This catches silent
   * connection deaths that _recvAckCheck cannot detect because there are
   * no unacknowledged regular messages.
   */
  _keepAliveTimeoutCheck() {
    if (this._isReconnecting) {
      return;
    }
    const now = Date.now();
    const timeSinceLastReceivedSomeData = now - this._socketReader.lastReadTime;
    const timeSinceLastTimeout = now - this._lastSocketTimeoutTime;
    if (timeSinceLastReceivedSomeData >= 2e4 /* TimeoutTime */ && timeSinceLastTimeout >= 2e4 /* TimeoutTime */) {
      if (!this._loadEstimator.hasHighLoad()) {
        this._lastSocketTimeoutTime = now;
        const unacknowledgedMsgCount = this._outgoingUnackMsg.length();
        const oldestUnacknowledgedMsg = this._outgoingUnackMsg.peek();
        this._onSocketTimeout.fire({
          reason: "keepAlive" /* KEEP_ALIVE */,
          unacknowledgedMsgCount,
          timeSinceOldestUnacknowledgedMsg: oldestUnacknowledgedMsg ? now - oldestUnacknowledgedMsg.writtenTime : void 0,
          timeSinceLastReceivedSomeData
        });
      }
    }
  }
  _sendAck() {
    if (this._incomingMsgId <= this._incomingAckId) {
      return;
    }
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(3 /* Ack */, 0, this._incomingAckId, getEmptyBuffer());
    this._socketWriter.write(msg);
  }
  _sendKeepAlive() {
    this._incomingAckId = this._incomingMsgId;
    const msg = new ProtocolMessage(9 /* KeepAlive */, 0, this._incomingAckId, getEmptyBuffer());
    this._socketWriter.write(msg);
    this._keepAliveTimeoutCheck();
  }
}
export {
  BufferedEmitter,
  ChunkStream,
  Client,
  LoadEstimator,
  PersistentProtocol,
  Protocol,
  ProtocolConstants,
  SocketCloseEventType,
  SocketDiagnostics,
  SocketDiagnosticsEventType,
  SocketTimeoutReason
};
