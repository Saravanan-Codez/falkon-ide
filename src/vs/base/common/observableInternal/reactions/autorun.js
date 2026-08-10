import { DisposableStore, toDisposable } from "../commonFacade/deps.js";
import { DebugNameData } from "../debugName.js";
import { AutorunObserver } from "./autorunImpl.js";
import { DebugLocation } from "../debugLocation.js";
import { observableValue } from "../observables/observableValue.js";
import { transaction } from "../transaction.js";
function autorun(fn, debugLocation = DebugLocation.ofCaller()) {
  return new AutorunObserver(
    new DebugNameData(void 0, void 0, fn),
    fn,
    void 0,
    debugLocation
  );
}
function autorunOpts(options, fn, debugLocation = DebugLocation.ofCaller()) {
  return new AutorunObserver(
    new DebugNameData(options.owner, options.debugName, options.debugReferenceFn ?? fn),
    fn,
    void 0,
    debugLocation
  );
}
function autorunHandleChanges(options, fn, debugLocation = DebugLocation.ofCaller()) {
  return new AutorunObserver(
    new DebugNameData(options.owner, options.debugName, options.debugReferenceFn ?? fn),
    fn,
    options.changeTracker,
    debugLocation
  );
}
function autorunWithStoreHandleChanges(options, fn) {
  const store = new DisposableStore();
  const disposable = autorunHandleChanges(
    {
      owner: options.owner,
      debugName: options.debugName,
      debugReferenceFn: options.debugReferenceFn ?? fn,
      changeTracker: options.changeTracker
    },
    (reader, changeSummary) => {
      store.clear();
      fn(reader, changeSummary, store);
    }
  );
  return toDisposable(() => {
    disposable.dispose();
    store.dispose();
  });
}
function autorunWithStore(fn) {
  const store = new DisposableStore();
  const disposable = autorunOpts(
    {
      owner: void 0,
      debugName: void 0,
      debugReferenceFn: fn
    },
    (reader) => {
      store.clear();
      fn(reader, store);
    }
  );
  return toDisposable(() => {
    disposable.dispose();
    store.dispose();
  });
}
function autorunDelta(observable, handler) {
  let _lastValue;
  return autorunOpts({ debugReferenceFn: handler }, (reader) => {
    const newValue = observable.read(reader);
    const lastValue = _lastValue;
    _lastValue = newValue;
    handler({ lastValue, newValue });
  });
}
function autorunIterableDelta(getValue, handler, getUniqueIdentifier = (v) => v) {
  const lastValues = /* @__PURE__ */ new Map();
  return autorunOpts({ debugReferenceFn: getValue }, (reader) => {
    const newValues = /* @__PURE__ */ new Map();
    const removedValues = new Map(lastValues);
    for (const value of getValue(reader)) {
      const id = getUniqueIdentifier(value);
      if (lastValues.has(id)) {
        removedValues.delete(id);
      } else {
        newValues.set(id, value);
        lastValues.set(id, value);
      }
    }
    for (const id of removedValues.keys()) {
      lastValues.delete(id);
    }
    if (newValues.size || removedValues.size) {
      handler({ addedValues: [...newValues.values()], removedValues: [...removedValues.values()] });
    }
  });
}
function autorunPerKeyedItem(items, keyFn, setup, debugLocation = DebugLocation.ofCaller()) {
  const cells = /* @__PURE__ */ new Map();
  const ar = autorunOpts({ debugReferenceFn: setup }, (reader) => {
    const arr = items.read(reader);
    const seen = /* @__PURE__ */ new Set();
    const additions = [];
    transaction((tx) => {
      for (const item of arr) {
        const key = keyFn(item);
        seen.add(key);
        const existing = cells.get(key);
        if (existing) {
          existing.value.set(item, tx);
        } else {
          const store = new DisposableStore();
          const value = observableValue("keyedItem", item);
          const cell = { value, store };
          cells.set(key, cell);
          additions.push({ key, cell });
        }
      }
      for (const [k, cell] of cells) {
        if (!seen.has(k)) {
          cell.store.dispose();
          cells.delete(k);
        }
      }
    });
    for (const { key, cell } of additions) {
      setup(key, cell.value, cell.store);
    }
  }, debugLocation);
  return toDisposable(() => {
    ar.dispose();
    for (const cell of cells.values()) {
      cell.store.dispose();
    }
    cells.clear();
  });
}
function autorunSelfDisposable(fn, debugLocation = DebugLocation.ofCaller()) {
  let ar;
  let disposed = false;
  ar = autorun((reader) => {
    fn({
      delayedStore: reader.delayedStore,
      store: reader.store,
      readObservable: reader.readObservable.bind(reader),
      dispose: () => {
        ar?.dispose();
        disposed = true;
      }
    });
  }, debugLocation);
  if (disposed) {
    ar.dispose();
  }
  return ar;
}
function registerAutorunSelfDisposable(store, fn, debugLocation = DebugLocation.ofCaller()) {
  let ar;
  let disposeSync = false;
  ar = autorun((reader) => {
    fn({
      delayedStore: reader.delayedStore,
      store: reader.store,
      readObservable: reader.readObservable.bind(reader),
      dispose: () => {
        if (!ar) {
          disposeSync = true;
        } else {
          store.delete(ar);
        }
      }
    });
  }, debugLocation);
  if (disposeSync) {
    ar.dispose();
  } else {
    store.add(ar);
  }
}
export {
  autorun,
  autorunDelta,
  autorunHandleChanges,
  autorunIterableDelta,
  autorunOpts,
  autorunPerKeyedItem,
  autorunSelfDisposable,
  autorunWithStore,
  autorunWithStoreHandleChanges,
  registerAutorunSelfDisposable
};
