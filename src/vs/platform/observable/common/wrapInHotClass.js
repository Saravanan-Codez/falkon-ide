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
import { isHotReloadEnabled } from "../../../base/common/hotReload.js";
import { autorunWithStore } from "../../../base/common/observable.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
function hotClassGetOriginalInstance(value) {
  if (value instanceof BaseClass) {
    return value._instance;
  }
  return value;
}
function wrapInHotClass0(clazz) {
  return !isHotReloadEnabled() ? clazz.get() : createWrapper(clazz, BaseClass0);
}
class BaseClass {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
  }
  init(...params) {
  }
}
function createWrapper(clazz, B) {
  return class ReloadableWrapper extends B {
    constructor() {
      super(...arguments);
      this._autorun = void 0;
    }
    init(...params) {
      this._autorun = autorunWithStore((reader, store) => {
        const clazz_ = clazz.read(reader);
        this._instance = store.add(this.instantiationService.createInstance(clazz_, ...params));
      });
    }
    dispose() {
      this._autorun?.dispose();
    }
  };
}
let BaseClass0 = class extends BaseClass {
  constructor(i) {
    super(i);
    this.init();
  }
};
BaseClass0 = __decorateClass([
  __decorateParam(0, IInstantiationService)
], BaseClass0);
function wrapInHotClass1(clazz) {
  return !isHotReloadEnabled() ? clazz.get() : createWrapper(clazz, BaseClass1);
}
let BaseClass1 = class extends BaseClass {
  constructor(param1, i) {
    super(i);
    this.init(param1);
  }
};
BaseClass1 = __decorateClass([
  __decorateParam(1, IInstantiationService)
], BaseClass1);
export {
  hotClassGetOriginalInstance,
  wrapInHotClass0,
  wrapInHotClass1
};
