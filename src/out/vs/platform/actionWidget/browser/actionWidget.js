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
import * as dom from "../../../base/browser/dom.js";
import { ActionBar } from "../../../base/browser/ui/actionbar/actionbar.js";
import { disposableTimeout } from "../../../base/common/async.js";
import { KeyCode, KeyMod } from "../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import "./actionWidget.css";
import { localize, localize2 } from "../../../nls.js";
import { acceptSelectedActionCommand, ActionList, previewSelectedActionCommand } from "./actionList.js";
import { Action2, registerAction2 } from "../../actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../contextkey/common/contextkey.js";
import { IContextViewService } from "../../contextview/browser/contextView.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../keybinding/common/keybindingsRegistry.js";
import { inputActiveOptionBackground, registerColor } from "../../theme/common/colorRegistry.js";
registerColor(
  "actionBar.toggledBackground",
  inputActiveOptionBackground,
  localize("actionBar.toggledBackground", "Background color for toggled action items in action bar.")
);
const ACTION_WIDGET_CLOSE_START_OPACITY_VARIABLE = "--action-widget-close-start-opacity";
const ACTION_WIDGET_CLOSE_START_TRANSFORM_VARIABLE = "--action-widget-close-start-transform";
const ActionWidgetContextKeys = {
  Visible: new RawContextKey("codeActionMenuVisible", false, localize("codeActionMenuVisible", "Whether the action widget list is visible")),
  FilterFocused: new RawContextKey("codeActionMenuFilterFocused", false, localize("codeActionMenuFilterFocused", "Whether the action widget filter input is focused"))
};
const IActionWidgetService = createDecorator("actionWidgetService");
let ActionWidgetService = class extends Disposable {
  constructor(_contextViewService, _contextKeyService, _instantiationService) {
    super();
    this._contextViewService = _contextViewService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._list = this._register(new MutableDisposable());
    this._closeAnimation = this._register(new MutableDisposable());
  }
  get isVisible() {
    return ActionWidgetContextKeys.Visible.getValue(this._contextKeyService) || false;
  }
  show(user, supportsPreview, items, delegate, anchor, container, actionBarActions, accessibilityProvider, listOptions) {
    const visibleContext = ActionWidgetContextKeys.Visible.bindTo(this._contextKeyService);
    const list = this._instantiationService.createInstance(ActionList, user, supportsPreview, items, delegate, accessibilityProvider, listOptions, anchor);
    this._contextViewService.showContextView({
      getAnchor: () => anchor,
      render: (container2) => {
        visibleContext.set(true);
        return this._renderWidget(container2, list, actionBarActions ?? []);
      },
      onHide: (didCancel) => {
        visibleContext.reset();
        this._onWidgetClosed(didCancel);
      },
      get anchorPosition() {
        return list.anchorPosition;
      }
    }, container, false);
  }
  acceptSelected(preview) {
    this._list.value?.acceptSelected(preview);
  }
  updateItems(items, focusItemId) {
    this._list.value?.updateItems(items, focusItemId);
  }
  focusItemById(itemId) {
    this._list.value?.focusItemById(itemId);
  }
  focusPrevious() {
    this._list?.value?.focusPrevious();
  }
  focusNext() {
    this._list?.value?.focusNext();
  }
  collapseSection() {
    this._list?.value?.collapseFocusedSection();
  }
  expandSection() {
    this._list?.value?.expandFocusedSection();
  }
  toggleSection() {
    return this._list?.value?.toggleFocusedSection() ?? false;
  }
  clearFilter() {
    return this._list?.value?.clearFilter() ?? false;
  }
  hide(didCancel) {
    const list = this._list.value;
    const widget = this._widgetElement;
    if (!list || this._closingList === list) {
      return;
    }
    const closeAnimation = list.closeAnimation;
    if (!widget || !closeAnimation || closeAnimation.duration <= 0 || !this._hasRequiredAncestorClasses(widget, closeAnimation.requiredAncestorClasses)) {
      this._closingList = list;
      list.hide(didCancel);
      return;
    }
    this._closingList = list;
    const computedStyle = dom.getWindow(widget).getComputedStyle(widget);
    widget.style.setProperty(ACTION_WIDGET_CLOSE_START_OPACITY_VARIABLE, computedStyle.opacity);
    widget.style.setProperty(ACTION_WIDGET_CLOSE_START_TRANSFORM_VARIABLE, computedStyle.transform);
    widget.classList.add(closeAnimation.className);
    list.hide(didCancel, false);
    this._closeAnimation.value = disposableTimeout(() => {
      if (this._list.value === list) {
        this._contextViewService.hideContextView(didCancel);
      }
    }, closeAnimation.duration);
  }
  clear() {
    this._closeAnimation.clear();
    this._closingList = void 0;
    this._widgetElement?.style.removeProperty(ACTION_WIDGET_CLOSE_START_OPACITY_VARIABLE);
    this._widgetElement?.style.removeProperty(ACTION_WIDGET_CLOSE_START_TRANSFORM_VARIABLE);
    this._widgetElement = void 0;
    this._list.clear();
  }
  _renderWidget(element, list, actionBarActions) {
    const widget = document.createElement("div");
    widget.classList.add("action-widget");
    const widgetClassNames = list.widgetClassName?.split(/\s+/).filter(Boolean);
    if (widgetClassNames?.length) {
      widget.classList.add(...widgetClassNames);
    }
    element.appendChild(widget);
    this._widgetElement = widget;
    this._list.value = list;
    if (this._list.value) {
      if (this._list.value.headerContainer) {
        widget.appendChild(this._list.value.headerContainer);
      }
      if (this._list.value.filterContainer) {
        widget.appendChild(this._list.value.filterContainer);
      }
      widget.appendChild(this._list.value.domNode);
      if (this._list.value.footerContainer) {
        widget.appendChild(this._list.value.footerContainer);
      }
    } else {
      throw new Error("List has no value");
    }
    const renderDisposables = new DisposableStore();
    const headerContainer = this._list.value.headerContainer;
    if (headerContainer) {
      renderDisposables.add(dom.addDisposableGenericMouseDownListener(headerContainer, (e) => e.preventDefault()));
    }
    const menuBlock = document.createElement("div");
    const block = element.appendChild(menuBlock);
    block.classList.add("context-view-block");
    renderDisposables.add(dom.addDisposableGenericMouseDownListener(block, (e) => e.stopPropagation()));
    const pointerBlockDiv = document.createElement("div");
    const pointerBlock = element.appendChild(pointerBlockDiv);
    pointerBlock.classList.add("context-view-pointerBlock");
    renderDisposables.add(dom.addDisposableListener(pointerBlock, dom.EventType.POINTER_MOVE, () => pointerBlock.remove()));
    renderDisposables.add(dom.addDisposableGenericMouseDownListener(pointerBlock, () => pointerBlock.remove()));
    let actionBarWidth = 0;
    if (actionBarActions.length) {
      const actionBar = this._createActionBar(".action-widget-action-bar", actionBarActions);
      if (actionBar) {
        widget.appendChild(actionBar.getContainer().parentElement);
        renderDisposables.add(actionBar);
        actionBarWidth = actionBar.getContainer().offsetWidth;
      }
    }
    const width = this._list.value?.layout(actionBarWidth);
    widget.style.width = `${width}px`;
    this._list.value?.focus();
    const filterFocusedContext = ActionWidgetContextKeys.FilterFocused.bindTo(this._contextKeyService);
    renderDisposables.add({ dispose: () => filterFocusedContext.reset() });
    if (this._list.value?.filterInput) {
      const filterInput = this._list.value.filterInput;
      renderDisposables.add(dom.addDisposableListener(filterInput, "focus", () => filterFocusedContext.set(true)));
      renderDisposables.add(dom.addDisposableListener(filterInput, "blur", () => filterFocusedContext.set(false)));
    }
    const focusTracker = renderDisposables.add(dom.trackFocus(element));
    renderDisposables.add(focusTracker.onDidBlur(() => {
      const activeElement = dom.getActiveElement();
      if (activeElement?.closest(".action-widget-hover") || activeElement?.closest(".action-list-submenu-panel")) {
        return;
      }
      this.hide(true);
    }));
    return renderDisposables;
  }
  _createActionBar(className, actions) {
    if (!actions.length) {
      return void 0;
    }
    const container = dom.$(className);
    const actionBar = new ActionBar(container);
    actionBar.push(actions, { icon: false, label: true });
    return actionBar;
  }
  _hasRequiredAncestorClasses(element, classNames) {
    if (!classNames?.length) {
      return true;
    }
    for (let candidate = element; candidate; candidate = candidate.parentElement) {
      if (classNames.every((className) => candidate.classList.contains(className))) {
        return true;
      }
    }
    return false;
  }
  _onWidgetClosed(didCancel) {
    if (this._closingList === this._list.value) {
      this.clear();
      return;
    }
    this._closeAnimation.clear();
    this._closingList = void 0;
    this._widgetElement = void 0;
    this._list.value?.hide(didCancel);
  }
};
ActionWidgetService = __decorateClass([
  __decorateParam(0, IContextViewService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IInstantiationService)
], ActionWidgetService);
registerSingleton(IActionWidgetService, ActionWidgetService, InstantiationType.Delayed);
const weight = KeybindingWeight.EditorContrib + 1e3;
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "hideCodeActionWidget",
      title: localize2("hideCodeActionWidget.title", "Hide action widget"),
      precondition: ActionWidgetContextKeys.Visible,
      keybinding: {
        weight,
        primary: KeyCode.Escape,
        secondary: [KeyMod.Shift | KeyCode.Escape]
      }
    });
  }
  run(accessor) {
    accessor.get(IActionWidgetService).hide(true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "clearFilterCodeActionWidget",
      title: localize2("clearFilterCodeActionWidget.title", "Clear action widget filter"),
      precondition: ContextKeyExpr.and(ActionWidgetContextKeys.Visible, ActionWidgetContextKeys.FilterFocused),
      keybinding: {
        weight: weight + 1,
        primary: KeyCode.Escape
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      if (!widgetService.clearFilter()) {
        widgetService.hide(true);
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "selectPrevCodeAction",
      title: localize2("selectPrevCodeAction.title", "Select previous action"),
      precondition: ActionWidgetContextKeys.Visible,
      keybinding: {
        weight,
        primary: KeyCode.UpArrow,
        secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow],
        mac: { primary: KeyCode.UpArrow, secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow, KeyMod.WinCtrl | KeyCode.KeyP] }
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      widgetService.focusPrevious();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "selectNextCodeAction",
      title: localize2("selectNextCodeAction.title", "Select next action"),
      precondition: ActionWidgetContextKeys.Visible,
      keybinding: {
        weight,
        primary: KeyCode.DownArrow,
        secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow],
        mac: { primary: KeyCode.DownArrow, secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow, KeyMod.WinCtrl | KeyCode.KeyN] }
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      widgetService.focusNext();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "collapseSectionCodeAction",
      title: localize2("collapseSectionCodeAction.title", "Collapse section"),
      precondition: ContextKeyExpr.and(ActionWidgetContextKeys.Visible, ActionWidgetContextKeys.FilterFocused.negate()),
      keybinding: {
        weight,
        primary: KeyCode.LeftArrow
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      widgetService.collapseSection();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "expandSectionCodeAction",
      title: localize2("expandSectionCodeAction.title", "Expand section"),
      precondition: ContextKeyExpr.and(ActionWidgetContextKeys.Visible, ActionWidgetContextKeys.FilterFocused.negate()),
      keybinding: {
        weight,
        primary: KeyCode.RightArrow
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      widgetService.expandSection();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "toggleSectionCodeAction",
      title: localize2("toggleSectionCodeAction.title", "Toggle section"),
      precondition: ContextKeyExpr.and(ActionWidgetContextKeys.Visible, ActionWidgetContextKeys.FilterFocused.negate()),
      keybinding: {
        weight,
        primary: KeyCode.Space
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      if (!widgetService.toggleSection()) {
        widgetService.acceptSelected();
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: acceptSelectedActionCommand,
      title: localize2("acceptSelected.title", "Accept selected action"),
      precondition: ActionWidgetContextKeys.Visible,
      keybinding: {
        weight,
        primary: KeyCode.Enter,
        secondary: [KeyMod.CtrlCmd | KeyCode.Period]
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      widgetService.acceptSelected();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: previewSelectedActionCommand,
      title: localize2("previewSelected.title", "Preview selected action"),
      precondition: ActionWidgetContextKeys.Visible,
      keybinding: {
        weight,
        primary: KeyMod.CtrlCmd | KeyCode.Enter
      }
    });
  }
  run(accessor) {
    const widgetService = accessor.get(IActionWidgetService);
    if (widgetService instanceof ActionWidgetService) {
      widgetService.acceptSelected(true);
    }
  }
});
export {
  IActionWidgetService
};
