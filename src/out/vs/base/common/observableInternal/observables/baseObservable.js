import { DebugLocation } from "../debugLocation.js";
import { getFunctionName } from "../debugName.js";
import { getLogger, logObservable } from "../logging/logging.js";
let _derived;
function _setDerivedOpts(derived) {
  _derived = derived;
}
let _recomputeInitiallyAndOnChange;
function _setRecomputeInitiallyAndOnChange(recomputeInitiallyAndOnChange) {
  _recomputeInitiallyAndOnChange = recomputeInitiallyAndOnChange;
}
let _keepObserved;
function _setKeepObserved(keepObserved) {
  _keepObserved = keepObserved;
}
let _debugGetObservableGraph;
function _setDebugGetObservableGraph(debugGetObservableGraph2) {
  _debugGetObservableGraph = debugGetObservableGraph2;
}
class ConvenientObservable {
  get TChange() {
    return null;
  }
  reportChanges() {
    this.get();
  }
  /** @sealed */
  read(reader) {
    if (reader) {
      return reader.readObservable(this);
    } else {
      return this.get();
    }
  }
  map(fnOrOwner, fnOrUndefined, debugLocation = DebugLocation.ofCaller()) {
    const owner = fnOrUndefined === void 0 ? void 0 : fnOrOwner;
    const fn = fnOrUndefined === void 0 ? fnOrOwner : fnOrUndefined;
    return _derived(
      {
        owner,
        debugName: () => {
          const name = getFunctionName(fn);
          if (name !== void 0) {
            return name;
          }
          const regexp = /^\s*\(?\s*([a-zA-Z_$][a-zA-Z_$0-9]*)\s*\)?\s*=>\s*\1(?:\??)\.([a-zA-Z_$][a-zA-Z_$0-9]*)\s*$/;
          const match = regexp.exec(fn.toString());
          if (match) {
            return `${this.debugName}.${match[2]}`;
          }
          if (!owner) {
            return `${this.debugName} (mapped)`;
          }
          return void 0;
        },
        debugReferenceFn: fn
      },
      (reader) => fn(this.read(reader), reader),
      debugLocation
    );
  }
  /**
   * @sealed
   * Converts an observable of an observable value into a direct observable of the value.
  */
  flatten() {
    return _derived(
      {
        owner: void 0,
        debugName: () => `${this.debugName} (flattened)`
      },
      (reader) => this.read(reader).read(reader)
    );
  }
  recomputeInitiallyAndOnChange(store, handleValue) {
    store.add(_recomputeInitiallyAndOnChange(this, handleValue));
    return this;
  }
  /**
   * Ensures that this observable is observed. This keeps the cache alive.
   * However, in case of deriveds, it does not force eager evaluation (only when the value is read/get).
   * Use `recomputeInitiallyAndOnChange` for eager evaluation.
   */
  keepObserved(store) {
    store.add(_keepObserved(this));
    return this;
  }
  get debugValue() {
    return this.get();
  }
  get debug() {
    return new DebugHelper(this);
  }
}
class DebugHelper {
  constructor(observable) {
    this.observable = observable;
  }
  getDependencyGraph() {
    return _debugGetObservableGraph(this.observable, { type: "dependencies" });
  }
  getObserverGraph() {
    return _debugGetObservableGraph(this.observable, { type: "observers" });
  }
}
class BaseObservable extends ConvenientObservable {
  constructor(debugLocation) {
    super();
    this._observers = /* @__PURE__ */ new Set();
    getLogger()?.handleObservableCreated(this, debugLocation);
  }
  addObserver(observer) {
    const len = this._observers.size;
    this._observers.add(observer);
    if (len === 0) {
      this.onFirstObserverAdded();
    }
    if (len !== this._observers.size) {
      getLogger()?.handleOnListenerCountChanged(this, this._observers.size);
    }
  }
  removeObserver(observer) {
    const deleted = this._observers.delete(observer);
    if (deleted && this._observers.size === 0) {
      this.onLastObserverRemoved();
    }
    if (deleted) {
      getLogger()?.handleOnListenerCountChanged(this, this._observers.size);
    }
  }
  onFirstObserverAdded() {
  }
  onLastObserverRemoved() {
  }
  log() {
    const hadLogger = !!getLogger();
    logObservable(this);
    if (!hadLogger) {
      getLogger()?.handleObservableCreated(this, DebugLocation.ofCaller());
    }
    return this;
  }
  debugGetObservers() {
    return this._observers;
  }
}
export {
  BaseObservable,
  ConvenientObservable,
  _setDebugGetObservableGraph,
  _setDerivedOpts,
  _setKeepObserved,
  _setRecomputeInitiallyAndOnChange
};
