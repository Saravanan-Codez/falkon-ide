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
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
const ICustomViewService = createDecorator("customViewService");
let CustomViewService = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._descriptors = /* @__PURE__ */ new Map();
    this._activeCustomView = observableValue(this, void 0);
    this.activeCustomView = this._activeCustomView;
  }
  registerCustomView(descriptor) {
    if (this._descriptors.has(descriptor.id)) {
      throw new Error(`A custom view with id '${descriptor.id}' is already registered`);
    }
    this._descriptors.set(descriptor.id, descriptor);
    return toDisposable(() => {
      this._descriptors.delete(descriptor.id);
      if (this._activeCustomView.get() === descriptor) {
        this._activeCustomView.set(void 0, void 0);
      }
    });
  }
  showCustomView(id) {
    const descriptor = this._descriptors.get(id);
    if (!descriptor) {
      this._logService.warn(`[CustomViewService] showCustomView: no custom view registered with id '${id}'`);
      return;
    }
    this._activeCustomView.set(descriptor, void 0);
  }
  hideCustomView() {
    this._activeCustomView.set(void 0, void 0);
  }
};
CustomViewService = __decorateClass([
  __decorateParam(0, ILogService)
], CustomViewService);
registerSingleton(ICustomViewService, CustomViewService, InstantiationType.Delayed);
export {
  CustomViewService,
  ICustomViewService
};
