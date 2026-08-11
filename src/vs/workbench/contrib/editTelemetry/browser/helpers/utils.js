import { AsyncIterableProducer } from "../../../../../base/common/async.js";
import { toDisposable } from "../../../../../base/common/lifecycle.js";
import { observableValue, runOnChange, transaction } from "../../../../../base/common/observable.js";
function sumByCategory(items, getValue, getCategory) {
  return items.reduce((acc, item) => {
    const category = getCategory(item);
    acc[category] = (acc[category] || 0) + getValue(item);
    return acc;
  }, {});
}
function mapObservableDelta(obs, mapFn, store) {
  const obsResult = observableValue("mapped", obs.get());
  store.add(runOnChange(obs, (value, _prevValue, changes) => {
    transaction((tx) => {
      for (const c of changes) {
        obsResult.set(value, tx, mapFn(c));
      }
    });
  }));
  return obsResult;
}
function iterateObservableChanges(obs, store) {
  return new AsyncIterableProducer((e) => {
    if (store.isDisposed) {
      return;
    }
    store.add(runOnChange(obs, (value, prevValue, change) => {
      e.emitOne({ value, prevValue, change });
    }));
    return new Promise((res) => {
      store.add(toDisposable(() => {
        res(void 0);
      }));
    });
  });
}
export {
  iterateObservableChanges,
  mapObservableDelta,
  sumByCategory
};
