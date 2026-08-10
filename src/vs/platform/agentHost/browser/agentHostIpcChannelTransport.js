import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { getAhpLogByteLength } from "../common/ahpJsonlLogger.js";
import { AgentHostClientConnectionKind } from "../common/agentHostTelemetry.js";
import { MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD, MALFORMED_FRAMES_LOG_CAP } from "../common/transportConstants.js";
const REDACTED_TOKEN = "<redacted>";
class AgentHostIpcChannelTransport extends Disposable {
  constructor(_channel, _ahpLogger, clientConnectionKind = AgentHostClientConnectionKind.Unknown) {
    super();
    this._channel = _channel;
    this._ahpLogger = _ahpLogger;
    this.clientConnectionKind = clientConnectionKind;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._isOpen = false;
    this._closeFired = false;
    this._malformedFrames = 0;
  }
  get isOpen() {
    return this._isOpen && !this._closeFired;
  }
  async connect() {
    if (this._store.isDisposed) {
      throw new Error("Transport is disposed");
    }
    this._register(this._channel.listen("frame")((text) => this._handleFrame(text)));
    this._register(this._channel.listen("close")(() => this._fireClose()));
    await this._channel.call("connect");
    this._isOpen = true;
  }
  send(message) {
    if (!this._isOpen || this._closeFired) {
      this._fireClose();
      return;
    }
    const text = JSON.stringify(message);
    this._logFrame(message, "c2s", text);
    this._channel.call("send", text).catch(() => this._fireClose());
  }
  dispose() {
    if (this._isOpen && !this._closeFired) {
      this._channel.call("close").catch(() => {
      });
    }
    this._fireClose();
    super.dispose();
  }
  _handleFrame(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch (err) {
      this._malformedFrames++;
      if (this._malformedFrames <= MALFORMED_FRAMES_LOG_CAP) {
        const preview = text.length > 80 ? text.slice(0, 80) + "\u2026" : text;
        console.warn(
          `[AgentHostIpcChannelTransport] Malformed frame #${this._malformedFrames} (len=${text.length}): ${preview}`,
          err instanceof Error ? err.message : String(err)
        );
      }
      if (this._malformedFrames > MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD) {
        console.warn("[AgentHostIpcChannelTransport] Malformed frame threshold exceeded; closing transport.");
        this._fireClose();
      }
      return;
    }
    this._logFrame(message, "s2c", text);
    this._onMessage.fire(message);
  }
  _logFrame(message, direction, text) {
    this._ahpLogger?.log(redactAuthenticationToken(message), direction, getAhpLogByteLength(text));
  }
  _fireClose() {
    if (this._closeFired) {
      return;
    }
    this._closeFired = true;
    this._isOpen = false;
    this._onClose.fire();
  }
}
function redactAuthenticationToken(message) {
  const candidate = message;
  if (candidate.method !== "authenticate" || typeof candidate.params !== "object" || candidate.params === null) {
    return message;
  }
  const params = candidate.params;
  if (typeof params.token !== "string") {
    return message;
  }
  return { ...candidate, params: { ...params, token: REDACTED_TOKEN } };
}
export {
  AgentHostIpcChannelTransport
};
