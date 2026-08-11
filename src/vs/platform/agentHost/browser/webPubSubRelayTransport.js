import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { IntervalTimer, disposableTimeout } from "../../../base/common/async.js";
import { AgentHostClientConnectionKind } from "../common/agentHostTelemetry.js";
import { Reassembler } from "../common/webPubSub/chunking.js";
import { RELIABLE_JSON_SUBPROTOCOL, buildPublish, parseInbound } from "../common/webPubSub/framing.js";
const REASSEMBLY_SWEEP_INTERVAL_MS = 15e3;
const WPS_HANDSHAKE_TIMEOUT_MS = 3e4;
const defaultWebSocketFactory = (url, subprotocol) => new WebSocket(url, subprotocol);
const inboundDecoder = new TextDecoder("utf-8");
function frameDataToString(data) {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return inboundDecoder.decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return inboundDecoder.decode(data);
  }
  return String(data);
}
class WebPubSubRelayTransport extends Disposable {
  constructor(_options) {
    super();
    this._options = _options;
    this.clientConnectionKind = AgentHostClientConnectionKind.WebPubSub;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._reassembler = new Reassembler();
    this._sweepTimer = this._register(new IntervalTimer());
    this._ackId = 0;
    this._pendingJoinAcks = /* @__PURE__ */ new Map();
    /** Guards against firing onClose / resolving connect more than once. */
    this._closed = false;
    this._connectResolved = false;
  }
  get isOpen() {
    return this._ws !== void 0 && !this._closed && this._connectResolved;
  }
  /**
   * Open a WPS WebSocket connection with the reliable JSON subprotocol and
   * complete the join handshake. Resolves once connected, rejects on
   * error/timeout/early-close.
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this._store.isDisposed) {
        reject(new Error("Transport is disposed"));
        return;
      }
      const factory = this._options.webSocketFactory ?? defaultWebSocketFactory;
      const ws = factory(this._options.url, RELIABLE_JSON_SUBPROTOCOL);
      this._ws = ws;
      const handshakeStore = new DisposableStore();
      const settleReject = (err) => {
        handshakeStore.dispose();
        this._failConnect();
        reject(err);
      };
      const settleResolve = () => {
        handshakeStore.dispose();
        this._connectResolved = true;
        this._startObserving();
        resolve();
      };
      handshakeStore.add(disposableTimeout(() => {
        settleReject(new Error("WPS handshake timed out"));
      }, WPS_HANDSHAKE_TIMEOUT_MS));
      ws.onopen = () => {
      };
      ws.onmessage = (event) => {
        let frame;
        try {
          frame = JSON.parse(frameDataToString(event.data));
        } catch (err) {
          this._options.onProtocolError?.(err);
          return;
        }
        this._handleHandshakeFrame(frame, settleResolve, settleReject);
      };
      ws.onerror = () => {
        settleReject(new Error("WebSocket error during WPS connect"));
      };
      ws.onclose = (ev) => {
        settleReject(new Error(`WebSocket closed before connection was established: ${ev.code} ${ev.reason}`));
      };
    });
  }
  /**
   * Handle a frame received during the connect handshake: the WPS `connected`
   * system event, joinGroup acks, or (defensively) early payload frames.
   */
  _handleHandshakeFrame(frame, onConnected, onFail) {
    if (frame["type"] === "system" && frame["event"] === "connected") {
      for (const group of this._options.joinGroups) {
        const ackId = ++this._ackId;
        this._pendingJoinAcks.set(ackId, group);
        this._sendRaw({ type: "joinGroup", group, ackId });
      }
      if (this._pendingJoinAcks.size === 0) {
        onConnected();
      }
      return;
    }
    if (frame["type"] === "ack") {
      const ackId = typeof frame["ackId"] === "number" ? frame["ackId"] : void 0;
      if (ackId === void 0 || !this._pendingJoinAcks.has(ackId)) {
        return;
      }
      const group = this._pendingJoinAcks.get(ackId);
      this._pendingJoinAcks.delete(ackId);
      if (frame["success"] === false) {
        onFail(new Error(`WPS joinGroup failed for group '${group}'`));
        return;
      }
      if (this._pendingJoinAcks.size === 0) {
        onConnected();
      }
      return;
    }
    this._ingestGroupFrame(frame);
  }
  /** Switch the socket handlers over to steady-state observation. */
  _startObserving() {
    const ws = this._ws;
    if (!ws) {
      return;
    }
    this._sweepTimer.cancelAndSet(() => this._reassembler.sweepExpired(), REASSEMBLY_SWEEP_INTERVAL_MS);
    ws.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(frameDataToString(event.data));
      } catch (err) {
        this._options.onProtocolError?.(err);
        return;
      }
      this._ingestGroupFrame(frame);
    };
    ws.onclose = () => this._fireClose();
    ws.onerror = () => this._fireClose();
  }
  /** Reassemble and surface a group-fanout frame as a {@link ProtocolMessage}. */
  _ingestGroupFrame(frame) {
    let result;
    try {
      result = parseInbound(frame, { reassembler: this._reassembler, groupValidation: this._options.groupValidation });
    } catch (err) {
      this._options.onProtocolError?.(err);
      return;
    }
    if (result.kind === "payload") {
      this._onMessage.fire(result.payload);
    }
  }
  /**
   * TODO: publish acks are requested but not tracked — a `success: false` ack is dropped by
   * {@link _ingestGroupFrame}, so the message never reaches the host, no JSON-RPC reply can
   * arrive, and the request stays pending forever while the transport still looks open. The
   * symptom is a session that stops responding mid-turn with no error. Fixing it means tracking
   * publish ack ids here and failing the transport on a rejected ack — kept as-is for now to stay
   * in sync with github-ui `ahp-relay/webpubsub/wps-transport.ts`, which behaves the same way.
   */
  send(message) {
    if (this._closed || !this._ws) {
      throw new Error("WebPubSubRelayTransport is closed");
    }
    const frames = buildPublish({
      group: this._options.toHostGroup,
      nextAckId: () => ++this._ackId,
      payload: message
    });
    for (const frame of frames) {
      this._sendRaw(frame);
    }
  }
  _sendRaw(obj) {
    this._ws?.send(JSON.stringify(obj));
  }
  /** Fire onClose exactly once and stop background work. */
  _fireClose() {
    if (this._closed) {
      return;
    }
    this._closed = true;
    this._sweepTimer.cancel();
    this._onClose.fire();
  }
  /** Tear down a failed/incomplete connect without firing onClose to observers. */
  _failConnect() {
    this._closed = true;
    this._sweepTimer.cancel();
    try {
      this._ws?.close();
    } catch {
    }
  }
  dispose() {
    if (!this._closed) {
      this._closed = true;
      this._sweepTimer.cancel();
      try {
        this._ws?.close();
      } catch {
      }
    }
    super.dispose();
  }
}
export {
  WebPubSubRelayTransport
};
