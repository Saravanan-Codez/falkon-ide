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
import { IconSelectBox } from "../../../../base/browser/ui/icons/iconSelectBox.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import * as dom from "../../../../base/browser/dom.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
const WorkbenchIconSelectBoxFocusContextKey = new RawContextKey("iconSelectBoxFocus", true);
const WorkbenchIconSelectBoxInputFocusContextKey = new RawContextKey("iconSelectBoxInputFocus", true);
const WorkbenchIconSelectBoxInputEmptyContextKey = new RawContextKey("iconSelectBoxInputEmpty", true);
let WorkbenchIconSelectBox = class extends IconSelectBox {
  static getFocusedWidget() {
    return WorkbenchIconSelectBox.focusedWidget;
  }
  constructor(options, contextKeyService) {
    super(options);
    this.contextKeyService = this._register(contextKeyService.createScoped(this.domNode));
    WorkbenchIconSelectBoxFocusContextKey.bindTo(this.contextKeyService);
    this.inputFocusContextKey = WorkbenchIconSelectBoxInputFocusContextKey.bindTo(this.contextKeyService);
    this.inputEmptyContextKey = WorkbenchIconSelectBoxInputEmptyContextKey.bindTo(this.contextKeyService);
    if (this.inputBox) {
      const focusTracker = this._register(dom.trackFocus(this.inputBox.inputElement));
      this._register(focusTracker.onDidFocus(() => this.inputFocusContextKey.set(true)));
      this._register(focusTracker.onDidBlur(() => this.inputFocusContextKey.set(false)));
      this._register(this.inputBox.onDidChange(() => this.inputEmptyContextKey.set(this.inputBox?.value.length === 0)));
    }
  }
  focus() {
    super.focus();
    WorkbenchIconSelectBox.focusedWidget = this;
  }
};
WorkbenchIconSelectBox = __decorateClass([
  __decorateParam(1, IContextKeyService)
], WorkbenchIconSelectBox);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "iconSelectBox.focusUp",
  weight: KeybindingWeight.WorkbenchContrib,
  when: WorkbenchIconSelectBoxFocusContextKey,
  primary: KeyCode.UpArrow,
  handler: () => {
    const selectBox = WorkbenchIconSelectBox.getFocusedWidget();
    if (selectBox) {
      selectBox.focusPreviousRow();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "iconSelectBox.focusDown",
  weight: KeybindingWeight.WorkbenchContrib,
  when: WorkbenchIconSelectBoxFocusContextKey,
  primary: KeyCode.DownArrow,
  handler: () => {
    const selectBox = WorkbenchIconSelectBox.getFocusedWidget();
    if (selectBox) {
      selectBox.focusNextRow();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "iconSelectBox.focusNext",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(WorkbenchIconSelectBoxFocusContextKey, ContextKeyExpr.or(WorkbenchIconSelectBoxInputEmptyContextKey, WorkbenchIconSelectBoxInputFocusContextKey.toNegated())),
  primary: KeyCode.RightArrow,
  handler: () => {
    const selectBox = WorkbenchIconSelectBox.getFocusedWidget();
    if (selectBox) {
      selectBox.focusNext();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "iconSelectBox.focusPrevious",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(WorkbenchIconSelectBoxFocusContextKey, ContextKeyExpr.or(WorkbenchIconSelectBoxInputEmptyContextKey, WorkbenchIconSelectBoxInputFocusContextKey.toNegated())),
  primary: KeyCode.LeftArrow,
  handler: () => {
    const selectBox = WorkbenchIconSelectBox.getFocusedWidget();
    if (selectBox) {
      selectBox.focusPrevious();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "iconSelectBox.selectFocused",
  weight: KeybindingWeight.WorkbenchContrib,
  when: WorkbenchIconSelectBoxFocusContextKey,
  primary: KeyCode.Enter,
  handler: () => {
    const selectBox = WorkbenchIconSelectBox.getFocusedWidget();
    if (selectBox) {
      selectBox.setSelection(selectBox.getFocus()[0]);
    }
  }
});
export {
  WorkbenchIconSelectBox,
  WorkbenchIconSelectBoxFocusContextKey,
  WorkbenchIconSelectBoxInputEmptyContextKey,
  WorkbenchIconSelectBoxInputFocusContextKey
};
