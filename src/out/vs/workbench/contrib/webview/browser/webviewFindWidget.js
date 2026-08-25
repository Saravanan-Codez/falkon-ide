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
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { SimpleFindWidget } from "../../codeEditor/browser/find/simpleFindWidget.js";
import { KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED } from "./webview.js";
let WebviewFindWidget = class extends SimpleFindWidget {
  constructor(_delegate, contextViewService, contextKeyService, hoverService, keybindingService, configurationService, accessibilityService) {
    super({
      showCommonFindToggles: false,
      checkImeCompletionState: _delegate.checkImeCompletionState,
      enableSash: true
    }, contextViewService, contextKeyService, hoverService, keybindingService, configurationService, accessibilityService);
    this._delegate = _delegate;
    this._findWidgetFocused = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED.bindTo(contextKeyService);
    this._register(_delegate.hasFindResult((hasResult) => {
      this.updateButtons(hasResult);
      this.focusFindBox();
    }));
    this._register(_delegate.onDidStopFind(() => {
      this.updateButtons(false);
    }));
  }
  async _getResultCount(dataChanged) {
    return void 0;
  }
  find(previous) {
    const val = this.inputValue;
    if (val) {
      this._delegate.find(val, previous);
    }
  }
  hide(animated = true) {
    super.hide(animated);
    this._delegate.stopFind(true);
    this._delegate.focus();
  }
  _onInputChanged() {
    const val = this.inputValue;
    if (val) {
      this._delegate.updateFind(val);
    } else {
      this._delegate.stopFind(false);
    }
    return false;
  }
  _onFocusTrackerFocus() {
    this._findWidgetFocused.set(true);
  }
  _onFocusTrackerBlur() {
    this._findWidgetFocused.reset();
  }
  _onFindInputFocusTrackerFocus() {
  }
  _onFindInputFocusTrackerBlur() {
  }
  findFirst() {
  }
};
WebviewFindWidget = __decorateClass([
  __decorateParam(1, IContextViewService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IAccessibilityService)
], WebviewFindWidget);
export {
  WebviewFindWidget
};
