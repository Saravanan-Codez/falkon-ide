import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { getAhpLogByteLength } from "./ahpJsonlLogger.js";
class RelayTransport extends Disposable {
  constructor(_connectionId, _channel, _ahpLogger, _logService, _logPrefix, clientConnectionKind) {
    super();
    this._connectionId = _connectionId;
    this._channel = _channel;
    this._ahpLogger = _ahpLogger;
    this._logService = _logService;
    this._logPrefix = _logPrefix;
    this.clientConnectionKind = clientConnectionKind;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    if (this._ahpLogger) {
      this._register(this._ahpLogger);
    }
    this._register(this._channel.onDidRelayMessage((msg) => {
      if (msg.connectionId === this._connectionId) {
        try {
          const parsed = JSON.parse(msg.data);
          this._ahpLogger?.log(parsed, "s2c", getAhpLogByteLength(msg.data));
          this._onMessage.fire(parsed);
        } catch {
        }
      }
    }));
    this._register(this._channel.onDidRelayClose((closedId) => {
      if (closedId === this._connectionId) {
        this._logService.info(`${this._logPrefix} onDidRelayClose`);
        this._onClose.fire();
      }
    }));
  }
  send(message) {
    const text = JSON.stringify(message);
    this._ahpLogger?.log(message, "c2s", getAhpLogByteLength(text));
    this._channel.relaySend(this._connectionId, text).catch((err) => {
      this._logService.error(`${this._logPrefix} relaySend failed`, err);
    });
  }
}
export {
  RelayTransport
};
