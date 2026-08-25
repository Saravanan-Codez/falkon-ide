import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { getAhpLogByteLength } from "../common/ahpJsonlLogger.js";
import { AgentHostClientConnectionKind } from "../common/agentHostTelemetry.js";
import { MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD, MALFORMED_FRAMES_LOG_CAP } from "../common/transportConstants.js";
class TunnelRelayTransport extends Disposable {
  constructor(_connectionId, _tunnelService, _ahpLogger) {
    super();
    this._connectionId = _connectionId;
    this._tunnelService = _tunnelService;
    this._ahpLogger = _ahpLogger;
    this.clientConnectionKind = AgentHostClientConnectionKind.DevTunnel;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._malformedFrames = 0;
    if (this._ahpLogger) {
      this._register(this._ahpLogger);
    }
    this._register(this._tunnelService.onDidRelayMessage((msg) => {
      if (msg.connectionId !== this._connectionId) {
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(msg.data);
      } catch (err) {
        this._malformedFrames++;
        if (this._malformedFrames <= MALFORMED_FRAMES_LOG_CAP) {
          const preview = msg.data.length > 80 ? msg.data.slice(0, 80) + "\u2026" : msg.data;
          console.warn(
            `[TunnelRelayTransport] Malformed frame #${this._malformedFrames} (len=${msg.data.length}): ${preview}`,
            err instanceof Error ? err.message : String(err)
          );
        }
        if (this._malformedFrames > MALFORMED_FRAMES_FORCE_CLOSE_THRESHOLD) {
          console.warn("[TunnelRelayTransport] Malformed frame threshold exceeded; closing relay.");
          this._tunnelService.disconnect(this._connectionId).catch(() => {
          });
        }
        return;
      }
      this._ahpLogger?.log(parsed, "s2c", getAhpLogByteLength(msg.data));
      this._onMessage.fire(parsed);
    }));
    this._register(this._tunnelService.onDidRelayClose((closedId) => {
      if (closedId === this._connectionId) {
        this._onClose.fire();
      }
    }));
  }
  dispose() {
    this._tunnelService.disconnect(this._connectionId).catch(() => {
    });
    super.dispose();
  }
  send(message) {
    const text = JSON.stringify(message);
    this._ahpLogger?.log(message, "c2s", getAhpLogByteLength(text));
    this._tunnelService.relaySend(this._connectionId, text).catch(() => {
    });
  }
}
export {
  TunnelRelayTransport
};
