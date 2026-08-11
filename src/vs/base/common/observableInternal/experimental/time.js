import { Disposable } from "../../lifecycle.js";
import { DisposableStore, toDisposable } from "../commonFacade/deps.js";
import { observableValue } from "../observables/observableValue.js";
import { autorun } from "../reactions/autorun.js";
class TotalTrueTimeObservable extends Disposable {
  constructor(value) {
    super();
    this.value = value;
    this._totalTime = 0;
    this._startTime = void 0;
    this._register(autorun((reader) => {
      const isTrue = this.value.read(reader);
      if (isTrue) {
        this._startTime = Date.now();
      } else {
        if (this._startTime !== void 0) {
          const delta = Date.now() - this._startTime;
          this._totalTime += delta;
          this._startTime = void 0;
        }
      }
    }));
  }
  /**
   * Reports the total time the observable has been true in milliseconds.
   * E.g. `true` for 100ms, then `false` for 50ms, then `true` for 200ms results in 300ms.
  */
  totalTimeMs() {
    if (this._startTime !== void 0) {
      return this._totalTime + (Date.now() - this._startTime);
    }
    return this._totalTime;
  }
  /**
   * Runs the callback when the total time the observable has been true increased by the given delta in milliseconds.
  */
  fireWhenTimeIncreasedBy(deltaTimeMs, callback) {
    const store = new DisposableStore();
    let accumulatedTime = 0;
    let startTime = void 0;
    store.add(autorun((reader) => {
      const isTrue = this.value.read(reader);
      if (isTrue) {
        startTime = Date.now();
        const remainingTime = deltaTimeMs - accumulatedTime;
        if (remainingTime <= 0) {
          callback();
          store.dispose();
          return;
        }
        const handle = setTimeout(() => {
          accumulatedTime += Date.now() - startTime;
          startTime = void 0;
          callback();
          store.dispose();
        }, remainingTime);
        reader.store.add(toDisposable(() => {
          clearTimeout(handle);
          if (startTime !== void 0) {
            accumulatedTime += Date.now() - startTime;
            startTime = void 0;
          }
        }));
      }
    }));
    return store;
  }
}
function wasTrueRecently(obs, timeMs, store) {
  const result = observableValue("wasTrueRecently", false);
  let timeout;
  store.add(autorun((reader) => {
    const value = obs.read(reader);
    if (value) {
      result.set(true, void 0);
      if (timeout !== void 0) {
        clearTimeout(timeout);
        timeout = void 0;
      }
    } else {
      timeout = setTimeout(() => {
        result.set(false, void 0);
        timeout = void 0;
      }, timeMs);
    }
  }));
  store.add(toDisposable(() => {
    if (timeout !== void 0) {
      clearTimeout(timeout);
    }
  }));
  return result;
}
export {
  TotalTrueTimeObservable,
  wasTrueRecently
};
