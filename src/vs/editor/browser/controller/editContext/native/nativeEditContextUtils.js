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
import { addDisposableListener, getShadowRoot } from "../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
let FocusTracker = class extends Disposable {
  constructor(_logService, _domNode, _onFocusChange) {
    super();
    this._domNode = _domNode;
    this._onFocusChange = _onFocusChange;
    this._isFocused = false;
    this._isPaused = false;
    this._register(addDisposableListener(this._domNode, "focus", () => {
      _logService.trace("NativeEditContext.focus");
      if (this._isPaused) {
        return;
      }
      this.refreshFocusState();
    }));
    this._register(addDisposableListener(this._domNode, "blur", () => {
      _logService.trace("NativeEditContext.blur");
      if (this._isPaused) {
        return;
      }
      this._handleFocusedChanged(false);
    }));
  }
  pause() {
    this._isPaused = true;
  }
  resume() {
    this._isPaused = false;
    this.refreshFocusState();
  }
  _handleFocusedChanged(focused) {
    if (this._isFocused === focused) {
      return;
    }
    this._isFocused = focused;
    this._onFocusChange(this._isFocused);
  }
  focus() {
    this._domNode.focus();
    this.refreshFocusState();
  }
  refreshFocusState() {
    const shadowRoot = getShadowRoot(this._domNode);
    const activeElement = shadowRoot ? shadowRoot.activeElement : this._domNode.ownerDocument.activeElement;
    const focused = this._domNode === activeElement;
    this._handleFocusedChanged(focused);
  }
  get isFocused() {
    return this._isFocused;
  }
};
FocusTracker = __decorateClass([
  __decorateParam(0, ILogService)
], FocusTracker);
function editContextAddDisposableListener(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  return {
    dispose() {
      target.removeEventListener(type, listener);
    }
  };
}
export {
  FocusTracker,
  editContextAddDisposableListener
};
