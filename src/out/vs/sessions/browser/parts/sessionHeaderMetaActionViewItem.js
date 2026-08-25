import { $, reset } from "../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../base/browser/ui/actionbar/actionViewItems.js";
import { Button } from "../../../base/browser/ui/button/button.js";
import { defaultButtonStyles } from "../../../platform/theme/browser/defaultStyles.js";
class SessionHeaderMetaActionViewItem extends BaseActionViewItem {
  constructor(context, action, options) {
    super(context, action, options);
  }
  render(container) {
    this.element = container;
    container.classList.add("chat-composite-bar-meta-item");
    const button = this.button = this._register(new Button(container, { secondary: true, small: true, ...defaultButtonStyles }));
    button.element.classList.add("monaco-text-button", "chat-composite-bar-meta-item-button");
    this._register(button.onDidClick(() => {
      if (this._action.enabled) {
        this.onDidClickButton();
      }
    }));
    this.updateLabel();
    this.updateEnabled();
    this.updateTooltip();
  }
  /**
   * Invoked when the pill is activated. Runs the action by default; subclasses can
   * override to present their own affordance (e.g. a picker when the pill stands
   * for several items).
   */
  onDidClickButton() {
    this.actionRunner.run(this._action, this._context);
  }
  focus() {
    this.button?.focus();
  }
  blur() {
    if (this.button) {
      this.button.element.tabIndex = -1;
      this.button.element.blur();
    }
  }
  setFocusable(focusable) {
    if (this.button) {
      this.button.element.tabIndex = focusable ? 0 : -1;
    }
  }
  isFocused() {
    return !!this.button?.hasFocus();
  }
  updateClass() {
    this.updateLabel();
  }
  updateEnabled() {
    if (this.button) {
      this.button.enabled = this._action.enabled;
    }
  }
  updateLabel() {
    if (!this.button) {
      return;
    }
    reset(this.button.element, ...this.getLabelContent());
  }
  updateAriaLabel() {
    const ariaLabel = this.getAriaLabel();
    if (ariaLabel) {
      this.button?.element.setAttribute("aria-label", ariaLabel);
    } else {
      this.button?.element.removeAttribute("aria-label");
    }
  }
  /**
   * The button's accessible name. Defaults to {@link getTooltip}. Subclasses that render
   * meaningful state in the visible label (e.g. the workspace name, or diff counts) should
   * override this so screen readers announce the same information that is shown visually.
   */
  getAriaLabel() {
    return this.getTooltip();
  }
  getTooltip() {
    return this._action.tooltip || this._action.label || void 0;
  }
  getLabelContent() {
    const content = [];
    const iconElement = this.getIconElement();
    if (iconElement) {
      content.push(iconElement);
    }
    const labelText = this.getLabelText();
    if (labelText) {
      content.push($("span.chat-composite-bar-meta-item-label", void 0, labelText));
    }
    content.push(...this.getAdditionalLabelContent());
    return content;
  }
  /**
   * The leading icon element. Defaults to the action's icon (without color).
   */
  getIconElement() {
    const iconClasses = this._action.class?.split(" ").filter((cssClass) => !!cssClass);
    if (!iconClasses?.length) {
      return void 0;
    }
    return $(`span.chat-composite-bar-meta-item-icon${iconClasses.map((cssClass) => `.${cssClass}`).join("")}`);
  }
  /**
   * The button's title text. Defaults to the action label.
   */
  getLabelText() {
    return this._action.label;
  }
  /**
   * Additional label content rendered after the title. Defaults to none.
   */
  getAdditionalLabelContent() {
    return [];
  }
}
export {
  SessionHeaderMetaActionViewItem
};
