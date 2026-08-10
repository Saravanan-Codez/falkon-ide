import * as dom from "../../../base/browser/dom.js";
import { FindInput } from "../../../base/browser/ui/findinput/findInput.js";
import { MessageType } from "../../../base/browser/ui/inputbox/inputBox.js";
import { createToggleActionViewItemProvider } from "../../../base/browser/ui/toggle/toggle.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import Severity from "../../../base/common/severity.js";
import "./media/quickInput.css";
const $ = dom.$;
class QuickInputBox extends Disposable {
  constructor(parent, inputBoxStyles, toggleStyles) {
    super();
    this.parent = parent;
    this._listFocusMode = false;
    this.onDidChange = (handler) => {
      return this.findInput.onDidChange(handler);
    };
    this.container = dom.append(this.parent, $(".quick-input-box"));
    this.findInput = this._register(new FindInput(
      this.container,
      void 0,
      {
        label: "",
        inputBoxStyles,
        toggleStyles,
        actionViewItemProvider: createToggleActionViewItemProvider(toggleStyles),
        hideHoverOnValueChange: true
      }
    ));
  }
  get onKeyDown() {
    return this.findInput.onKeyDown;
  }
  get onMouseDown() {
    return this.findInput.onMouseDown;
  }
  get value() {
    return this.findInput.getValue();
  }
  set value(value) {
    this.findInput.setValue(value);
  }
  select(range = null) {
    this.findInput.inputBox.select(range);
  }
  getSelection() {
    return this.findInput.inputBox.getSelection();
  }
  isSelectionAtEnd() {
    return this.findInput.inputBox.isSelectionAtEnd();
  }
  setPlaceholder(placeholder) {
    this.findInput.inputBox.setPlaceHolder(placeholder);
  }
  get placeholder() {
    return this.findInput.inputBox.inputElement.getAttribute("placeholder") || "";
  }
  set placeholder(placeholder) {
    this.findInput.inputBox.setPlaceHolder(placeholder);
  }
  get password() {
    return this.findInput.inputBox.inputElement.type === "password";
  }
  set password(password) {
    this.findInput.inputBox.inputElement.type = password ? "password" : "text";
  }
  set enabled(enabled) {
    this.findInput.inputBox.inputElement.toggleAttribute("readonly", !enabled);
  }
  set toggles(toggles) {
    this.findInput.setAdditionalToggles(toggles);
  }
  set actions(actions) {
    this.setActions(actions);
  }
  setActions(actions, actionViewItemProvider) {
    this.findInput.setActions(actions, actionViewItemProvider);
  }
  get ariaLabel() {
    return this.findInput.inputBox.inputElement.getAttribute("aria-label") || "";
  }
  set ariaLabel(ariaLabel) {
    this.findInput.inputBox.inputElement.setAttribute("aria-label", ariaLabel);
  }
  hasFocus() {
    return this.findInput.inputBox.hasFocus();
  }
  setAttribute(name, value) {
    this.findInput.inputBox.inputElement.setAttribute(name, value);
  }
  removeAttribute(name) {
    this.findInput.inputBox.inputElement.removeAttribute(name);
  }
  /**
   * Controls the ARIA popup mode for screen readers.
   * When enabled (hasActiveDescendant=true), indicates a list popup is active.
   * When disabled, removes ARIA attributes to allow normal text input behavior.
   * Only updates attributes when the state actually changes to avoid
   * unnecessary screen reader re-announcements.
   */
  setListFocusMode(hasActiveDescendant) {
    if (this._listFocusMode === hasActiveDescendant) {
      return;
    }
    this._listFocusMode = hasActiveDescendant;
    const input = this.findInput.inputBox.inputElement;
    if (hasActiveDescendant) {
      input.setAttribute("aria-haspopup", "listbox");
      input.setAttribute("aria-autocomplete", "list");
    } else {
      input.removeAttribute("aria-haspopup");
      input.removeAttribute("aria-autocomplete");
    }
  }
  showDecoration(decoration) {
    if (decoration === Severity.Ignore) {
      this.findInput.clearMessage();
    } else {
      this.findInput.showMessage({ type: decoration === Severity.Info ? MessageType.INFO : decoration === Severity.Warning ? MessageType.WARNING : MessageType.ERROR, content: "" });
    }
  }
  stylesForType(decoration) {
    return this.findInput.inputBox.stylesForType(decoration === Severity.Info ? MessageType.INFO : decoration === Severity.Warning ? MessageType.WARNING : MessageType.ERROR);
  }
  setFocus() {
    this.findInput.focus();
  }
  layout() {
    this.findInput.inputBox.layout();
  }
  setHeight(height) {
    this.findInput.inputBox.element.style.height = height === void 0 ? "" : `${height}px`;
  }
}
export {
  QuickInputBox
};
