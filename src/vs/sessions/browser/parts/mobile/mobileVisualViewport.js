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
import * as DOM from "../../../../base/browser/dom.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { derived, observableValue } from "../../../../base/common/observable.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { KeyboardVisibleContext } from "../../../common/contextkeys.js";
const KEYBOARD_VISIBLE_THRESHOLD_PX = 50;
const KEYBOARD_HEIGHT_CSS_VAR = "--vscode-keyboard-height";
const IMobileVisualViewport = createDecorator("mobileVisualViewport");
let MobileVisualViewport = class extends Disposable {
  constructor(contextKeyService, layoutService) {
    super();
    this._keyboardHeight = observableValue(this, 0);
    this.keyboardHeight = this._keyboardHeight;
    this.isKeyboardVisible = derived(
      this,
      (reader) => this._keyboardHeight.read(reader) > KEYBOARD_VISIBLE_THRESHOLD_PX
    );
    this.mainContainer = layoutService.mainContainer;
    this._keyboardVisibleCtx = KeyboardVisibleContext.bindTo(contextKeyService);
    const targetWindow = DOM.getWindow(this.mainContainer);
    const visualViewport = targetWindow.visualViewport;
    if (!visualViewport) {
      return;
    }
    const update = () => {
      const height = Math.max(0, targetWindow.innerHeight - visualViewport.height);
      if (this._keyboardHeight.get() !== height) {
        this._keyboardHeight.set(height, void 0);
      }
      this.mainContainer.style.setProperty(KEYBOARD_HEIGHT_CSS_VAR, `${height}px`);
      this._keyboardVisibleCtx.set(height > KEYBOARD_VISIBLE_THRESHOLD_PX);
    };
    this._register(DOM.addDisposableListener(visualViewport, "resize", update));
    this._register(DOM.addDisposableListener(visualViewport, "scroll", update));
    update();
  }
  dispose() {
    this.mainContainer.style.removeProperty(KEYBOARD_HEIGHT_CSS_VAR);
    this._keyboardVisibleCtx.reset();
    super.dispose();
  }
};
MobileVisualViewport = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ILayoutService)
], MobileVisualViewport);
registerSingleton(IMobileVisualViewport, MobileVisualViewport, InstantiationType.Eager);
export {
  IMobileVisualViewport,
  KEYBOARD_VISIBLE_THRESHOLD_PX,
  MobileVisualViewport
};
