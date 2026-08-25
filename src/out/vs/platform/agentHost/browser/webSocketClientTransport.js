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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { connectionTokenQueryName } from "../../../base/common/network.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { AhpJsonlLogger, getAhpLogByteLength } from "../common/ahpJsonlLogger.js";
import { AgentHostClientConnectionKind } from "../common/agentHostTelemetry.js";
import { MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD, MALFORMED_FRAMES_LOG_CAP } from "../common/transportConstants.js";
let WebSocketClientTransport = class extends Disposable {
  constructor(_address, _connectionToken, ahpLogOptions, instantiationService) {
    super();
    this._address = _address;
    this._connectionToken = _connectionToken;
    this.clientConnectionKind = AgentHostClientConnectionKind.DirectWebSocket;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._onOpen = this._register(new Emitter());
    this.onOpen = this._onOpen.event;
    this._malformedFrames = 0;
    /** Guards against firing onClose more than once. */
    this._closeFired = false;
    if (ahpLogOptions) {
      this._ahpLogger = this._register(instantiationService.createInstance(AhpJsonlLogger, ahpLogOptions));
    }
  }
  get isOpen() {
    return this._ws?.readyState === WebSocket.OPEN;
  }
  /**
   * Initiate the WebSocket connection. Resolves when the connection
   * is open, or rejects on error/timeout.
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this._store.isDisposed) {
        reject(new Error("Transport is disposed"));
        return;
      }
      let url = this._address.startsWith("ws://") || this._address.startsWith("wss://") ? this._address : `ws://${this._address}`;
      if (this._connectionToken) {
        const separator = url.includes("?") ? "&" : "?";
        url += `${separator}${connectionTokenQueryName}=${encodeURIComponent(this._connectionToken)}`;
      }
      const ws = new WebSocket(url);
      this._ws = ws;
      const onOpen = () => {
        cleanup();
        this._onOpen.fire();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`WebSocket connection failed: ${this._address}`));
      };
      const onClose = () => {
        cleanup();
        reject(new Error(`WebSocket closed before connection was established: ${this._address}`));
      };
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        ws.removeEventListener("close", onClose);
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      ws.addEventListener("close", onClose);
      ws.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          this._malformedFrames++;
          if (this._malformedFrames <= MALFORMED_FRAMES_LOG_CAP) {
            const dataType = event.data instanceof ArrayBuffer ? "ArrayBuffer" : event.data instanceof Blob ? "Blob" : typeof event.data;
            const byteLen = event.data instanceof ArrayBuffer ? event.data.byteLength : event.data instanceof Blob ? event.data.size : 0;
            console.warn(
              `[WebSocketClientTransport] Non-string frame #${this._malformedFrames} (type=${dataType}, bytes=${byteLen})`
            );
          }
          if (this._malformedFrames > MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD) {
            console.warn(
              `[WebSocketClientTransport] Malformed frame threshold exceeded; forcing close of ${this._address}.`
            );
            this._ws?.close(4002, "malformed-frames");
          }
          return;
        }
        const text = event.data;
        let message;
        try {
          message = JSON.parse(text);
        } catch (err) {
          this._malformedFrames++;
          if (this._malformedFrames <= MALFORMED_FRAMES_LOG_CAP) {
            const preview = text.length > 80 ? text.slice(0, 80) + "\u2026" : text;
            console.warn(
              `[WebSocketClientTransport] Malformed frame #${this._malformedFrames} (len=${text.length}): ${preview}`,
              err instanceof Error ? err.message : String(err)
            );
          }
          if (this._malformedFrames > MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD) {
            console.warn(
              `[WebSocketClientTransport] Malformed frame threshold exceeded; forcing close of ${this._address}.`
            );
            this._ws?.close(4002, "malformed-frames");
          }
          return;
        }
        this._ahpLogger?.log(message, "s2c", getAhpLogByteLength(text));
        this._onMessage.fire(message);
      });
      ws.addEventListener("close", () => {
        if (!this._closeFired) {
          this._closeFired = true;
          this._onClose.fire();
        }
      });
      ws.addEventListener("error", () => {
        if (!this._closeFired) {
          this._closeFired = true;
          this._onClose.fire();
        }
      });
    });
  }
  /**
   * Send a message to the remote end. Returns `true` if the message was
   * sent, `false` if it was dropped (socket not open). On failure, the
   * transport is force-closed so reconnection is triggered immediately
   * rather than silently losing messages.
   */
  send(message) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      const text = JSON.stringify(message);
      this._ahpLogger?.log(message, "c2s", getAhpLogByteLength(text));
      this._ws.send(text);
      return true;
    }
    console.warn(
      `[WebSocketClientTransport] Message dropped: readyState=${this._ws?.readyState ?? "no-socket"}`
    );
    this._ws?.close(4001, "send-on-dead-socket");
    if (!this._closeFired) {
      this._closeFired = true;
      this._onClose.fire();
    }
    return false;
  }
  dispose() {
    this._ws?.close();
    super.dispose();
  }
};
WebSocketClientTransport = __decorateClass([
  __decorateParam(3, IInstantiationService)
], WebSocketClientTransport);
export {
  WebSocketClientTransport
};
