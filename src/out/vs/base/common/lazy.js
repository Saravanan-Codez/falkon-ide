var LazyValueState = /* @__PURE__ */ ((LazyValueState2) => {
  LazyValueState2[LazyValueState2["Uninitialized"] = 0] = "Uninitialized";
  LazyValueState2[LazyValueState2["Running"] = 1] = "Running";
  LazyValueState2[LazyValueState2["Completed"] = 2] = "Completed";
  return LazyValueState2;
})(LazyValueState || {});
class Lazy {
  constructor(executor) {
    this.executor = executor;
    this._state = 0 /* Uninitialized */;
  }
  /**
   * True if the lazy value has been resolved.
   */
  get hasValue() {
    return this._state === 2 /* Completed */;
  }
  /**
   * Get the wrapped value.
   *
   * This will force evaluation of the lazy value if it has not been resolved yet. Lazy values are only
   * resolved once. `getValue` will re-throw exceptions that are hit while resolving the value
   */
  get value() {
    if (this._state === 0 /* Uninitialized */) {
      this._state = 1 /* Running */;
      try {
        this._value = this.executor();
      } catch (err) {
        this._error = err;
      } finally {
        this._state = 2 /* Completed */;
      }
    } else if (this._state === 1 /* Running */) {
      throw new Error("Cannot read the value of a lazy that is being initialized");
    }
    if (this._error) {
      throw this._error;
    }
    return this._value;
  }
  /**
   * Get the wrapped value without forcing evaluation.
   */
  get rawValue() {
    return this._value;
  }
}
export {
  Lazy
};
