import { autorun } from "../reactions/autorun.js";
import { transaction } from "../transaction.js";
import { derived } from "../observables/derived.js";
import { observableValue } from "../observables/observableValue.js";
class ObservableLazy {
  constructor(_computeValue) {
    this._computeValue = _computeValue;
    this._value = observableValue(this, void 0);
  }
  /**
   * The cached value.
   * Does not force a computation of the value.
   */
  get cachedValue() {
    return this._value;
  }
  /**
   * Returns the cached value.
   * Computes the value if the value has not been cached yet.
   */
  getValue() {
    let v = this._value.get();
    if (!v) {
      v = this._computeValue();
      this._value.set(v, void 0);
    }
    return v;
  }
}
class ObservablePromise {
  constructor(promise) {
    this._value = observableValue(this, void 0);
    /**
     * The current state of the promise.
     * Is `undefined` if the promise didn't resolve yet.
     */
    this.promiseResult = this._value;
    this.resolvedValue = derived(this, (reader) => {
      const result = this.promiseResult.read(reader);
      if (!result) {
        return void 0;
      }
      return result.getDataOrThrow();
    });
    this.promise = promise.then((value) => {
      transaction((tx) => {
        this._value.set(new PromiseResult(value, void 0), tx);
      });
      return value;
    }, (error) => {
      transaction((tx) => {
        this._value.set(new PromiseResult(void 0, error), tx);
      });
      throw error;
    });
  }
  static fromFn(fn) {
    return new ObservablePromise(fn());
  }
  static resolved(value) {
    return new ObservablePromise(Promise.resolve(value));
  }
}
class PromiseResult {
  constructor(data, error) {
    this.data = data;
    this.error = error;
  }
  /**
   * Returns the value if the promise resolved, otherwise throws the error.
   */
  getDataOrThrow() {
    if (this.error) {
      throw this.error;
    }
    return this.data;
  }
}
class ObservableResolvedPromise {
  constructor(source, initialValue, store) {
    this._isResolving = observableValue(this, false);
    this.isResolving = this._isResolving;
    this._lastResolved = observableValue(this, initialValue);
    this.lastResolved = this._lastResolved;
    store.add(autorun((reader) => {
      const current = source.read(reader);
      this._runningPromise = current;
      const result = current.promiseResult.read(reader);
      if (result) {
        if (current === this._runningPromise) {
          this._isResolving.set(false, void 0);
          this._lastResolved.set(result.getDataOrThrow(), void 0);
        }
      } else {
        this._isResolving.set(true, void 0);
      }
    }));
  }
}
class ObservableLazyPromise {
  constructor(_computePromise) {
    this._computePromise = _computePromise;
    this._lazyValue = new ObservableLazy(() => new ObservablePromise(this._computePromise()));
    /**
     * Does not enforce evaluation of the promise compute function.
     * Is undefined if the promise has not been computed yet.
     */
    this.cachedPromiseResult = derived(this, (reader) => this._lazyValue.cachedValue.read(reader)?.promiseResult.read(reader));
  }
  getPromise() {
    return this._lazyValue.getValue().promise;
  }
}
export {
  ObservableLazy,
  ObservableLazyPromise,
  ObservablePromise,
  ObservableResolvedPromise,
  PromiseResult
};
