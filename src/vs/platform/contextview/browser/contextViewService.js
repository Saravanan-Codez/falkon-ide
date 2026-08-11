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
import { ContextView, ContextViewDOMPosition } from "../../../base/browser/ui/contextview/contextview.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILayoutService } from "../../layout/browser/layoutService.js";
import { getWindow } from "../../../base/browser/dom.js";
let ContextViewHandler = class extends Disposable {
  constructor(layoutService) {
    super();
    this.layoutService = layoutService;
    this.contextView = this._register(new ContextView(this.layoutService.mainContainer, ContextViewDOMPosition.ABSOLUTE));
    this.layout();
    this._register(layoutService.onDidLayoutContainer(() => this.layout()));
  }
  // ContextView
  showContextView(delegate, container, shadowRoot) {
    let domPosition;
    if (container) {
      if (container === this.layoutService.getContainer(getWindow(container))) {
        domPosition = ContextViewDOMPosition.ABSOLUTE;
      } else if (shadowRoot) {
        domPosition = ContextViewDOMPosition.FIXED_SHADOW;
      } else {
        domPosition = ContextViewDOMPosition.FIXED;
      }
    } else {
      domPosition = ContextViewDOMPosition.ABSOLUTE;
    }
    this.contextView.setContainer(container ?? this.layoutService.activeContainer, domPosition);
    this.contextView.show(delegate);
    const openContextView = {
      close: () => {
        if (this.openContextView === openContextView) {
          this.hideContextView();
        }
      }
    };
    this.openContextView = openContextView;
    return openContextView;
  }
  layout() {
    this.contextView.layout();
  }
  hideContextView(data) {
    this.contextView.hide(data);
    this.openContextView = void 0;
  }
};
ContextViewHandler = __decorateClass([
  __decorateParam(0, ILayoutService)
], ContextViewHandler);
class ContextViewService extends ContextViewHandler {
  getContextViewElement() {
    return this.contextView.getViewElement();
  }
}
export {
  ContextViewHandler,
  ContextViewService
};
