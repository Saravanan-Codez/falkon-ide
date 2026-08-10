import { DebugNameData } from "../debugName.js";
import { strictEquals } from "../commonFacade/deps.js";
import { ObservableValue } from "./observableValue.js";
import { LazyObservableValue } from "./lazyObservableValue.js";
import { DebugLocation } from "../debugLocation.js";
function observableValueOpts(options, initialValue, debugLocation = DebugLocation.ofCaller()) {
  if (options.lazy) {
    return new LazyObservableValue(
      new DebugNameData(options.owner, options.debugName, void 0),
      initialValue,
      options.equalsFn ?? strictEquals,
      debugLocation
    );
  }
  return new ObservableValue(
    new DebugNameData(options.owner, options.debugName, void 0),
    initialValue,
    options.equalsFn ?? strictEquals,
    debugLocation
  );
}
export {
  observableValueOpts
};
