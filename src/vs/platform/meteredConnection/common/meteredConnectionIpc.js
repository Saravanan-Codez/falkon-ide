import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
const METERED_CONNECTION_CHANNEL = "meteredConnection";
var MeteredConnectionCommand = /* @__PURE__ */ ((MeteredConnectionCommand2) => {
  MeteredConnectionCommand2["OnDidChangeIsConnectionMetered"] = "OnDidChangeIsConnectionMetered";
  MeteredConnectionCommand2["IsConnectionMetered"] = "IsConnectionMetered";
  MeteredConnectionCommand2["SetIsBrowserConnectionMetered"] = "SetIsBrowserConnectionMetered";
  return MeteredConnectionCommand2;
})(MeteredConnectionCommand || {});
class MeteredConnectionChannelClient extends Disposable {
  constructor(channel) {
    super();
    this._onDidChangeIsConnectionMetered = this._register(new Emitter());
    this.onDidChangeIsConnectionMetered = this._onDidChangeIsConnectionMetered.event;
    this._isConnectionMetered = false;
    channel.call("IsConnectionMetered" /* IsConnectionMetered */).then((value) => {
      this._isConnectionMetered = value;
      if (value) {
        this._onDidChangeIsConnectionMetered.fire(value);
      }
    });
    this._register(channel.listen("OnDidChangeIsConnectionMetered" /* OnDidChangeIsConnectionMetered */)((value) => {
      if (this._isConnectionMetered !== value) {
        this._isConnectionMetered = value;
        this._onDidChangeIsConnectionMetered.fire(value);
      }
    }));
  }
  get isConnectionMetered() {
    return this._isConnectionMetered;
  }
}
export {
  METERED_CONNECTION_CHANNEL,
  MeteredConnectionChannelClient,
  MeteredConnectionCommand
};
