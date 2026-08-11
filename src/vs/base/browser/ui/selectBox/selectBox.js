import { isMacintosh } from "../../../common/platform.js";
import { unthemedListStyles } from "../list/listWidget.js";
import { Widget } from "../widget.js";
import "./selectBox.css";
import { SelectBoxList } from "./selectBoxCustom.js";
import { SelectBoxNative } from "./selectBoxNative.js";
const SeparatorSelectOption = Object.freeze({
  text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
  isDisabled: true,
  isSeparator: true
});
const unthemedSelectBoxStyles = {
  ...unthemedListStyles,
  selectBackground: "#3C3C3C",
  selectForeground: "#F0F0F0",
  selectBorder: "#3C3C3C",
  decoratorRightForeground: void 0,
  selectListBackground: void 0,
  selectListBorder: void 0,
  focusBorder: void 0
};
class SelectBox extends Widget {
  constructor(options, selected, contextViewProvider, styles, selectBoxOptions) {
    super();
    if (isMacintosh && !selectBoxOptions?.useCustomDrawn) {
      this.selectBoxDelegate = new SelectBoxNative(options, selected, styles, selectBoxOptions);
    } else {
      this.selectBoxDelegate = new SelectBoxList(options, selected, contextViewProvider, styles, selectBoxOptions);
    }
    this._register(this.selectBoxDelegate);
  }
  // Public SelectBox Methods - routed through delegate interface
  get onDidSelect() {
    return this.selectBoxDelegate.onDidSelect;
  }
  setOptions(options, selected) {
    this.selectBoxDelegate.setOptions(options, selected);
  }
  select(index) {
    this.selectBoxDelegate.select(index);
  }
  setAriaLabel(label) {
    this.selectBoxDelegate.setAriaLabel(label);
  }
  focus() {
    this.selectBoxDelegate.focus();
  }
  blur() {
    this.selectBoxDelegate.blur();
  }
  setFocusable(focusable) {
    this.selectBoxDelegate.setFocusable(focusable);
  }
  setEnabled(enabled) {
    this.selectBoxDelegate.setEnabled(enabled);
  }
  render(container) {
    this.selectBoxDelegate.render(container);
  }
}
export {
  SelectBox,
  SeparatorSelectOption,
  unthemedSelectBoxStyles
};
