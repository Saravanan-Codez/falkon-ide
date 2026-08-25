import { addDisposableListener, isActiveElement } from "../../../../../../base/browser/dom.js";
import { Disposable, combinedDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
const IChatMarkdownAnchorService = createDecorator("chatMarkdownAnchorService");
class ChatMarkdownAnchorService extends Disposable {
  constructor() {
    super(...arguments);
    this._widgets = [];
    this._lastFocusedWidget = void 0;
  }
  get lastFocusedAnchor() {
    return this._lastFocusedWidget;
  }
  setLastFocusedList(widget) {
    this._lastFocusedWidget = widget;
  }
  register(widget) {
    if (this._widgets.some((other) => other === widget)) {
      throw new Error("Cannot register the same widget multiple times");
    }
    this._widgets.push(widget);
    const element = widget.getHTMLElement();
    if (isActiveElement(element)) {
      this.setLastFocusedList(widget);
    }
    return combinedDisposable(
      addDisposableListener(element, "focus", () => this.setLastFocusedList(widget)),
      toDisposable(() => this._widgets.splice(this._widgets.indexOf(widget), 1)),
      addDisposableListener(element, "blur", () => {
        if (this._lastFocusedWidget === widget) {
          this.setLastFocusedList(void 0);
        }
      })
    );
  }
}
export {
  ChatMarkdownAnchorService,
  IChatMarkdownAnchorService
};
