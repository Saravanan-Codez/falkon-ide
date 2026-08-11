import { strictEquals, BugIndicatingError } from "../commonFacade/deps.js";
import { subtransaction } from "../transaction.js";
import { DebugNameData } from "../debugName.js";
import { DerivedWithSetter } from "../observables/derivedImpl.js";
import { DebugLocation } from "../debugLocation.js";
function observableReducer(owner, options) {
  return observableReducerSettable(owner, options);
}
function observableReducerSettable(owner, options) {
  let prevValue = void 0;
  let hasValue = false;
  const d = new DerivedWithSetter(
    new DebugNameData(owner, void 0, options.update),
    (reader, changeSummary) => {
      if (!hasValue) {
        prevValue = options.initial instanceof Function ? options.initial() : options.initial;
        hasValue = true;
      }
      const newValue = options.update(reader, prevValue, changeSummary);
      prevValue = newValue;
      return newValue;
    },
    options.changeTracker,
    () => {
      if (hasValue) {
        options.disposeFinal?.(prevValue);
        hasValue = false;
      }
    },
    options.equalityComparer ?? strictEquals,
    (value, tx, change) => {
      if (!hasValue) {
        throw new BugIndicatingError("Can only set when there is a listener! This is to prevent leaks.");
      }
      subtransaction(tx, (tx2) => {
        prevValue = value;
        d.setValue(value, tx2, change);
      });
    },
    DebugLocation.ofCaller()
  );
  return d;
}
export {
  observableReducer,
  observableReducerSettable
};
