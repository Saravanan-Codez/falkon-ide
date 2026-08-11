import { transaction } from "../transaction.js";
import { DebugNameData } from "../debugName.js";
import { BaseObservable } from "./baseObservable.js";
import { DebugLocation } from "../debugLocation.js";
function observableSignal(debugNameOrOwner, debugLocation = DebugLocation.ofCaller()) {
  if (typeof debugNameOrOwner === "string") {
    return new ObservableSignal(debugNameOrOwner, void 0, debugLocation);
  } else {
    return new ObservableSignal(void 0, debugNameOrOwner, debugLocation);
  }
}
class ObservableSignal extends BaseObservable {
  constructor(_debugName, _owner, debugLocation) {
    super(debugLocation);
    this._debugName = _debugName;
    this._owner = _owner;
  }
  get debugName() {
    return new DebugNameData(this._owner, this._debugName, void 0).getDebugName(this) ?? "Observable Signal";
  }
  toString() {
    return this.debugName;
  }
  trigger(tx, change) {
    if (!tx) {
      transaction((tx2) => {
        this.trigger(tx2, change);
      }, () => `Trigger signal ${this.debugName}`);
      return;
    }
    for (const o of this._observers) {
      tx.updateObserver(o, this);
      o.handleChange(this, change);
    }
  }
  get() {
  }
}
export {
  observableSignal
};
