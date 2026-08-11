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
import { FindInput } from "../../../base/browser/ui/findinput/findInput.js";
import { ReplaceInput } from "../../../base/browser/ui/findinput/replaceInput.js";
import { HistoryInputBox } from "../../../base/browser/ui/inputbox/inputBox.js";
import { KeyCode, KeyMod } from "../../../base/common/keyCodes.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../keybinding/common/keybindingsRegistry.js";
import { localize } from "../../../nls.js";
import { DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { isActiveElement } from "../../../base/browser/dom.js";
const historyNavigationVisible = new RawContextKey("suggestWidgetVisible", false, localize("suggestWidgetVisible", "Whether suggestion are visible"));
const HistoryNavigationWidgetFocusContext = "historyNavigationWidgetFocus";
const HistoryNavigationForwardsEnablementContext = "historyNavigationForwardsEnabled";
const HistoryNavigationBackwardsEnablementContext = "historyNavigationBackwardsEnabled";
let lastFocusedWidget = void 0;
const widgets = [];
function registerAndCreateHistoryNavigationContext(scopedContextKeyService, widget) {
  if (widgets.includes(widget)) {
    throw new Error("Cannot register the same widget multiple times");
  }
  widgets.push(widget);
  const disposableStore = new DisposableStore();
  const historyNavigationWidgetFocus = new RawContextKey(HistoryNavigationWidgetFocusContext, false).bindTo(scopedContextKeyService);
  const historyNavigationForwardsEnablement = new RawContextKey(HistoryNavigationForwardsEnablementContext, true).bindTo(scopedContextKeyService);
  const historyNavigationBackwardsEnablement = new RawContextKey(HistoryNavigationBackwardsEnablementContext, true).bindTo(scopedContextKeyService);
  const onDidFocus = () => {
    historyNavigationWidgetFocus.set(true);
    lastFocusedWidget = widget;
  };
  const onDidBlur = () => {
    historyNavigationWidgetFocus.set(false);
    if (lastFocusedWidget === widget) {
      lastFocusedWidget = void 0;
    }
  };
  if (isActiveElement(widget.element)) {
    onDidFocus();
  }
  disposableStore.add(widget.onDidFocus(() => onDidFocus()));
  disposableStore.add(widget.onDidBlur(() => onDidBlur()));
  disposableStore.add(toDisposable(() => {
    widgets.splice(widgets.indexOf(widget), 1);
    onDidBlur();
  }));
  return {
    historyNavigationForwardsEnablement,
    historyNavigationBackwardsEnablement,
    dispose() {
      disposableStore.dispose();
    }
  };
}
let ContextScopedHistoryInputBox = class extends HistoryInputBox {
  constructor(container, contextViewProvider, options, contextKeyService) {
    super(container, contextViewProvider, options);
    const scopedContextKeyService = this._register(contextKeyService.createScoped(this.element));
    this._register(registerAndCreateHistoryNavigationContext(scopedContextKeyService, this));
  }
};
ContextScopedHistoryInputBox = __decorateClass([
  __decorateParam(3, IContextKeyService)
], ContextScopedHistoryInputBox);
let ContextScopedFindInput = class extends FindInput {
  constructor(container, contextViewProvider, options, contextKeyService) {
    super(container, contextViewProvider, options);
    const scopedContextKeyService = this._register(contextKeyService.createScoped(this.inputBox.element));
    this._register(registerAndCreateHistoryNavigationContext(scopedContextKeyService, this.inputBox));
  }
};
ContextScopedFindInput = __decorateClass([
  __decorateParam(3, IContextKeyService)
], ContextScopedFindInput);
let ContextScopedReplaceInput = class extends ReplaceInput {
  constructor(container, contextViewProvider, options, contextKeyService, showReplaceOptions = false) {
    super(container, contextViewProvider, showReplaceOptions, options);
    const scopedContextKeyService = this._register(contextKeyService.createScoped(this.inputBox.element));
    this._register(registerAndCreateHistoryNavigationContext(scopedContextKeyService, this.inputBox));
  }
};
ContextScopedReplaceInput = __decorateClass([
  __decorateParam(3, IContextKeyService)
], ContextScopedReplaceInput);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "history.showPrevious",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(
    ContextKeyExpr.has(HistoryNavigationWidgetFocusContext),
    ContextKeyExpr.equals(HistoryNavigationBackwardsEnablementContext, true),
    historyNavigationVisible.isEqualTo(false)
  ),
  primary: KeyCode.UpArrow,
  secondary: [KeyMod.Alt | KeyCode.UpArrow],
  handler: (accessor) => {
    lastFocusedWidget?.showPreviousValue();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "history.showNext",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(
    ContextKeyExpr.has(HistoryNavigationWidgetFocusContext),
    ContextKeyExpr.equals(HistoryNavigationForwardsEnablementContext, true),
    historyNavigationVisible.isEqualTo(false)
  ),
  primary: KeyCode.DownArrow,
  secondary: [KeyMod.Alt | KeyCode.DownArrow],
  handler: (accessor) => {
    lastFocusedWidget?.showNextValue();
  }
});
export {
  ContextScopedFindInput,
  ContextScopedHistoryInputBox,
  ContextScopedReplaceInput,
  historyNavigationVisible,
  registerAndCreateHistoryNavigationContext
};
