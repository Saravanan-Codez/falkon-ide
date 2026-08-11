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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
const defaultSerialization = {
  deserialize: (d) => JSON.parse(d),
  serialize: (d) => JSON.stringify(d)
};
let StoredValue = class extends Disposable {
  constructor(options, storage) {
    super();
    this.storage = storage;
    this.key = options.key;
    this.scope = options.scope;
    this.target = options.target;
    this.serialization = options.serialization ?? defaultSerialization;
    this.onDidChange = this.storage.onDidChangeValue(this.scope, this.key, this._store);
  }
  get(defaultValue) {
    if (this.value === void 0) {
      const value = this.storage.get(this.key, this.scope);
      this.value = value === void 0 ? defaultValue : this.serialization.deserialize(value);
    }
    return this.value;
  }
  /**
   * Persists changes to the value.
   * @param value
   */
  store(value) {
    this.value = value;
    this.storage.store(this.key, this.serialization.serialize(value), this.scope, this.target);
  }
  /**
   * Delete an element stored under the provided key from storage.
   */
  delete() {
    this.storage.remove(this.key, this.scope);
  }
};
StoredValue = __decorateClass([
  __decorateParam(1, IStorageService)
], StoredValue);
export {
  StoredValue
};
