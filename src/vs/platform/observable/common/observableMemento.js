var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { strictEquals } from "../../../base/common/equals.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { DebugLocation } from "../../../base/common/observable.js";
import { DebugNameData } from "../../../base/common/observableInternal/debugName.js";
import { ObservableValue } from "../../../base/common/observableInternal/observables/observableValue.js";
import { IStorageService } from "../../storage/common/storage.js";
function observableMemento(opts) {
  return (scope, target, storageService) => {
    return new ObservableMemento(opts, scope, target, storageService);
  };
}
let ObservableMemento = class extends ObservableValue {
  constructor(opts, storageScope, storageTarget, storageService) {
    const getStorageValue = () => {
      const fromStorage = storageService.get(opts.key, storageScope);
      if (fromStorage !== void 0) {
        try {
          return opts.fromStorage(fromStorage);
        } catch {
          return opts.defaultValue;
        }
      }
      return opts.defaultValue;
    };
    const initialValue = getStorageValue();
    super(new DebugNameData(void 0, `storage/${opts.key}`, void 0), initialValue, strictEquals, DebugLocation.ofCaller());
    this.opts = opts;
    this.storageScope = storageScope;
    this.storageTarget = storageTarget;
    this.storageService = storageService;
    this._store = new DisposableStore();
    this._noStorageUpdateNeeded = false;
    const didChange = storageService.onDidChangeValue(storageScope, opts.key, this._store);
    this._store.add(didChange((e) => {
      if (e.external && e.key === opts.key) {
        this._noStorageUpdateNeeded = true;
        try {
          this.set(getStorageValue(), void 0);
        } finally {
          this._noStorageUpdateNeeded = false;
        }
      }
    }));
  }
  _setValue(newValue) {
    super._setValue(newValue);
    if (this._noStorageUpdateNeeded) {
      return;
    }
    const valueToStore = this.opts.toStorage(this.get());
    this.storageService.store(this.opts.key, valueToStore, this.storageScope, this.storageTarget);
  }
  dispose() {
    this._store.dispose();
  }
};
ObservableMemento = __decorateClass([
  __decorateParam(3, IStorageService)
], ObservableMemento);
export {
  ObservableMemento,
  observableMemento
};
