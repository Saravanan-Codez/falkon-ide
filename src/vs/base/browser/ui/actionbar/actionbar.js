import * as DOM from "../../dom.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { ActionViewItem, BaseActionViewItem } from "./actionViewItems.js";
import { createInstantHoverDelegate } from "../hover/hoverDelegateFactory.js";
import { ActionRunner, Separator } from "../../../common/actions.js";
import { Emitter } from "../../../common/event.js";
import { KeyCode, KeyMod } from "../../../common/keyCodes.js";
import { Disposable, DisposableMap, DisposableStore, dispose } from "../../../common/lifecycle.js";
import * as types from "../../../common/types.js";
import "./actionbar.css";
var ActionsOrientation = /* @__PURE__ */ ((ActionsOrientation2) => {
  ActionsOrientation2[ActionsOrientation2["HORIZONTAL"] = 0] = "HORIZONTAL";
  ActionsOrientation2[ActionsOrientation2["VERTICAL"] = 1] = "VERTICAL";
  return ActionsOrientation2;
})(ActionsOrientation || {});
class ActionBar extends Disposable {
  constructor(container, options = {}) {
    super();
    this._actionRunnerDisposables = this._register(new DisposableStore());
    this.viewItemDisposables = this._register(new DisposableMap());
    // Trigger Key Tracking
    this.triggerKeyDown = false;
    this.focusable = true;
    this._onDidBlur = this._register(new Emitter());
    this._onDidCancel = this._register(new Emitter({ onWillAddFirstListener: () => this.cancelHasListener = true }));
    this.cancelHasListener = false;
    this._onDidRun = this._register(new Emitter());
    this._onWillRun = this._register(new Emitter());
    this.options = options;
    this._context = options.context ?? null;
    this._orientation = this.options.orientation ?? 0 /* HORIZONTAL */;
    this._triggerKeys = {
      keyDown: this.options.triggerKeys?.keyDown ?? false,
      keys: this.options.triggerKeys?.keys ?? [KeyCode.Enter, KeyCode.Space]
    };
    this._hoverDelegate = options.hoverDelegate ?? this._register(createInstantHoverDelegate());
    if (this.options.actionRunner) {
      this._actionRunner = this.options.actionRunner;
    } else {
      this._actionRunner = new ActionRunner();
      this._actionRunnerDisposables.add(this._actionRunner);
    }
    this._actionRunnerDisposables.add(this._actionRunner.onDidRun((e) => this._onDidRun.fire(e)));
    this._actionRunnerDisposables.add(this._actionRunner.onWillRun((e) => this._onWillRun.fire(e)));
    this._viewItems = [];
    this.focusedItem = void 0;
    this.domNode = document.createElement("div");
    this.domNode.className = "monaco-action-bar";
    let previousKeys;
    let nextKeys;
    switch (this._orientation) {
      case 0 /* HORIZONTAL */:
        previousKeys = [KeyCode.LeftArrow];
        nextKeys = [KeyCode.RightArrow];
        break;
      case 1 /* VERTICAL */:
        previousKeys = [KeyCode.UpArrow];
        nextKeys = [KeyCode.DownArrow];
        this.domNode.className += " vertical";
        break;
    }
    this._register(DOM.addDisposableListener(this.domNode, DOM.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      let eventHandled = true;
      const focusedItem = typeof this.focusedItem === "number" ? this.viewItems[this.focusedItem] : void 0;
      if (previousKeys && (event.equals(previousKeys[0]) || event.equals(previousKeys[1]))) {
        eventHandled = this.focusPrevious();
      } else if (nextKeys && (event.equals(nextKeys[0]) || event.equals(nextKeys[1]))) {
        eventHandled = this.focusNext();
      } else if (event.equals(KeyCode.Escape) && this.cancelHasListener) {
        this._onDidCancel.fire();
      } else if (event.equals(KeyCode.Home)) {
        eventHandled = this.focusFirst();
      } else if (event.equals(KeyCode.End)) {
        eventHandled = this.focusLast();
      } else if (event.equals(KeyCode.Tab) && focusedItem instanceof BaseActionViewItem && focusedItem.trapsArrowNavigation) {
        eventHandled = this.focusNext(void 0, true);
      } else if (this.isTriggerKeyEvent(event)) {
        if (this._triggerKeys.keyDown) {
          this.doTrigger(event);
        } else {
          this.triggerKeyDown = true;
        }
      } else {
        eventHandled = false;
      }
      if (eventHandled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }));
    this._register(DOM.addDisposableListener(this.domNode, DOM.EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (this.isTriggerKeyEvent(event)) {
        if (!this._triggerKeys.keyDown && this.triggerKeyDown) {
          this.triggerKeyDown = false;
          this.doTrigger(event);
        }
        event.preventDefault();
        event.stopPropagation();
      } else if (event.equals(KeyCode.Tab) || event.equals(KeyMod.Shift | KeyCode.Tab) || event.equals(KeyCode.UpArrow) || event.equals(KeyCode.DownArrow) || event.equals(KeyCode.LeftArrow) || event.equals(KeyCode.RightArrow)) {
        this.updateFocusedItem();
      }
    }));
    this.focusTracker = this._register(DOM.trackFocus(this.domNode));
    this._register(this.focusTracker.onDidBlur(() => {
      if (DOM.getActiveElement() === this.domNode || !DOM.isAncestor(DOM.getActiveElement(), this.domNode)) {
        this._onDidBlur.fire();
        this.previouslyFocusedItem = this.focusedItem;
        this.focusedItem = void 0;
        this.triggerKeyDown = false;
      }
    }));
    this._register(this.focusTracker.onDidFocus(() => this.updateFocusedItem()));
    this.actionsList = document.createElement("ul");
    this.actionsList.className = "actions-container";
    if (this.options.highlightToggledItems) {
      this.actionsList.classList.add("highlight-toggled");
    }
    this.actionsList.setAttribute("role", this.options.ariaRole || "toolbar");
    if (this.options.ariaLabel) {
      this.actionsList.setAttribute("aria-label", this.options.ariaLabel);
    }
    this.domNode.appendChild(this.actionsList);
    container.appendChild(this.domNode);
  }
  get viewItems() {
    return this._viewItems;
  }
  get onDidBlur() {
    return this._onDidBlur.event;
  }
  get onDidCancel() {
    return this._onDidCancel.event;
  }
  get onDidRun() {
    return this._onDidRun.event;
  }
  get onWillRun() {
    return this._onWillRun.event;
  }
  refreshRole() {
    if (this.length() >= 1) {
      this.actionsList.setAttribute("role", this.options.ariaRole || "toolbar");
    } else {
      this.actionsList.setAttribute("role", "presentation");
    }
  }
  setAriaLabel(label) {
    if (label) {
      this.actionsList.setAttribute("aria-label", label);
    } else {
      this.actionsList.removeAttribute("aria-label");
    }
  }
  // Some action bars should not be focusable at times
  // When an action bar is not focusable make sure to make all the elements inside it not focusable
  // When an action bar is focusable again, make sure the first item can be focused
  setFocusable(focusable) {
    this.focusable = focusable;
    if (this.focusable) {
      const firstEnabled = this.viewItems.find((vi) => vi instanceof BaseActionViewItem && vi.isEnabled());
      if (firstEnabled instanceof BaseActionViewItem) {
        firstEnabled.setFocusable(true);
      }
    } else {
      this.viewItems.forEach((vi) => {
        if (vi instanceof BaseActionViewItem) {
          vi.setFocusable(false);
        }
      });
    }
  }
  isTriggerKeyEvent(event) {
    let ret = false;
    this._triggerKeys.keys.forEach((keyCode) => {
      ret = ret || event.equals(keyCode);
    });
    return ret;
  }
  updateFocusedItem() {
    for (let i = 0; i < this.actionsList.children.length; i++) {
      const elem = this.actionsList.children[i];
      if (DOM.isAncestor(DOM.getActiveElement(), elem)) {
        this.focusedItem = i;
        this.viewItems[this.focusedItem]?.showHover?.();
        break;
      }
    }
  }
  get context() {
    return this._context;
  }
  set context(context) {
    this._context = context;
    this.viewItems.forEach((i) => i.setActionContext(context));
  }
  get actionRunner() {
    return this._actionRunner;
  }
  set actionRunner(actionRunner) {
    this._actionRunner = actionRunner;
    this._actionRunnerDisposables.clear();
    this._actionRunnerDisposables.add(this._actionRunner.onDidRun((e) => this._onDidRun.fire(e)));
    this._actionRunnerDisposables.add(this._actionRunner.onWillRun((e) => this._onWillRun.fire(e)));
    this.viewItems.forEach((item) => item.actionRunner = actionRunner);
  }
  getContainer() {
    return this.domNode;
  }
  hasAction(action) {
    return this.viewItems.findIndex((candidate) => candidate.action.id === action.id) !== -1;
  }
  getAction(indexOrElement) {
    if (typeof indexOrElement === "number") {
      return this.viewItems[indexOrElement]?.action;
    }
    if (DOM.isHTMLElement(indexOrElement)) {
      while (indexOrElement.parentElement !== this.actionsList) {
        if (!indexOrElement.parentElement) {
          return void 0;
        }
        indexOrElement = indexOrElement.parentElement;
      }
      for (let i = 0; i < this.actionsList.childNodes.length; i++) {
        if (this.actionsList.childNodes[i] === indexOrElement) {
          return this.viewItems[i].action;
        }
      }
    }
    return void 0;
  }
  push(arg, options = {}) {
    const actions = Array.isArray(arg) ? arg : [arg];
    let index = types.isNumber(options.index) ? options.index : null;
    actions.forEach((action) => {
      const actionViewItemElement = document.createElement("li");
      actionViewItemElement.className = "action-item";
      actionViewItemElement.setAttribute("role", "presentation");
      let item;
      const viewItemOptions = { hoverDelegate: this._hoverDelegate, ...options, isTabList: this.options.ariaRole === "tablist" };
      if (this.options.actionViewItemProvider) {
        item = this.options.actionViewItemProvider(action, viewItemOptions);
      }
      if (!item) {
        item = new ActionViewItem(this.context, action, viewItemOptions);
      }
      if (!this.options.allowContextMenu) {
        this.viewItemDisposables.set(item, DOM.addDisposableListener(actionViewItemElement, DOM.EventType.CONTEXT_MENU, (e) => {
          DOM.EventHelper.stop(e, true);
        }));
      }
      item.actionRunner = this._actionRunner;
      item.setActionContext(this.context);
      item.render(actionViewItemElement);
      if (index === null || index < 0 || index >= this.actionsList.children.length) {
        this.actionsList.appendChild(actionViewItemElement);
        this._viewItems.push(item);
      } else {
        this.actionsList.insertBefore(actionViewItemElement, this.actionsList.children[index]);
        this._viewItems.splice(index, 0, item);
        index++;
      }
    });
    if (this.focusable) {
      let didFocus = false;
      for (const item of this.viewItems) {
        if (!(item instanceof BaseActionViewItem)) {
          continue;
        }
        let focus;
        if (didFocus) {
          focus = false;
        } else if (item.action.id === Separator.ID) {
          focus = false;
        } else if (!item.isEnabled() && this.options.focusOnlyEnabledItems) {
          focus = false;
        } else {
          focus = true;
        }
        if (focus) {
          item.setFocusable(true);
          didFocus = true;
        } else {
          item.setFocusable(false);
        }
      }
    }
    if (typeof this.focusedItem === "number") {
      this.focus(this.focusedItem);
    }
    this.refreshRole();
  }
  getWidth(index) {
    return this.actionsList.children.item(index)?.clientWidth ?? 0;
  }
  getHeight(index) {
    return this.actionsList.children.item(index)?.clientHeight ?? 0;
  }
  pull(index) {
    if (index >= 0 && index < this.viewItems.length) {
      this.actionsList.childNodes[index].remove();
      this.viewItemDisposables.deleteAndDispose(this.viewItems[index]);
      dispose(this._viewItems.splice(index, 1));
      this.refreshRole();
    }
  }
  clear() {
    if (this.isEmpty()) {
      return;
    }
    this._viewItems = dispose(this._viewItems);
    this.viewItemDisposables.clearAndDisposeAll();
    DOM.clearNode(this.actionsList);
    this.refreshRole();
  }
  length() {
    return this.viewItems.length;
  }
  isEmpty() {
    return this.viewItems.length === 0;
  }
  isFocused(index) {
    return index === void 0 ? DOM.isAncestor(DOM.getActiveElement(), this.domNode) : DOM.isAncestor(DOM.getActiveElement(), this.actionsList.children[index]);
  }
  focus(arg) {
    let selectFirst = false;
    let index = void 0;
    if (arg === void 0) {
      selectFirst = true;
    } else if (typeof arg === "number") {
      index = arg;
    } else if (typeof arg === "boolean") {
      selectFirst = arg;
    }
    if (selectFirst && typeof this.focusedItem === "undefined") {
      const firstEnabled = this.viewItems.findIndex((item) => item.isEnabled());
      this.focusedItem = firstEnabled === -1 ? void 0 : firstEnabled;
      this.updateFocus(void 0, void 0, true);
    } else {
      if (index !== void 0) {
        this.focusedItem = index;
      }
      this.updateFocus(void 0, void 0, true);
    }
  }
  focusFirst() {
    this.focusedItem = this.length() - 1;
    return this.focusNext(true);
  }
  focusLast() {
    this.focusedItem = 0;
    return this.focusPrevious(true);
  }
  focusNext(forceLoop, forceFocus) {
    if (typeof this.focusedItem === "undefined") {
      this.focusedItem = this.viewItems.length - 1;
    } else if (this.viewItems.length <= 1) {
      return false;
    }
    const startIndex = this.focusedItem;
    let item;
    do {
      if (!forceLoop && this.options.preventLoopNavigation && this.focusedItem + 1 >= this.viewItems.length) {
        this.focusedItem = startIndex;
        return false;
      }
      this.focusedItem = (this.focusedItem + 1) % this.viewItems.length;
      item = this.viewItems[this.focusedItem];
    } while (this.focusedItem !== startIndex && (this.options.focusOnlyEnabledItems && !item.isEnabled() || item.action.id === Separator.ID));
    this.updateFocus(void 0, void 0, forceFocus);
    return true;
  }
  focusPrevious(forceLoop) {
    if (typeof this.focusedItem === "undefined") {
      this.focusedItem = 0;
    } else if (this.viewItems.length <= 1) {
      return false;
    }
    const startIndex = this.focusedItem;
    let item;
    do {
      this.focusedItem = this.focusedItem - 1;
      if (this.focusedItem < 0) {
        if (!forceLoop && this.options.preventLoopNavigation) {
          this.focusedItem = startIndex;
          return false;
        }
        this.focusedItem = this.viewItems.length - 1;
      }
      item = this.viewItems[this.focusedItem];
    } while (this.focusedItem !== startIndex && (this.options.focusOnlyEnabledItems && !item.isEnabled() || item.action.id === Separator.ID));
    this.updateFocus(true);
    return true;
  }
  updateFocus(fromRight, preventScroll, forceFocus = false) {
    if (typeof this.focusedItem === "undefined") {
      this.actionsList.focus({ preventScroll });
    }
    if (this.previouslyFocusedItem !== void 0 && this.previouslyFocusedItem !== this.focusedItem) {
      this.viewItems[this.previouslyFocusedItem]?.blur();
    }
    const actionViewItem = this.focusedItem !== void 0 ? this.viewItems[this.focusedItem] : void 0;
    if (actionViewItem) {
      let focusItem = true;
      if (!types.isFunction(actionViewItem.focus)) {
        focusItem = false;
      }
      if (this.options.focusOnlyEnabledItems && types.isFunction(actionViewItem.isEnabled) && !actionViewItem.isEnabled()) {
        focusItem = false;
      }
      if (actionViewItem.action.id === Separator.ID) {
        focusItem = false;
      }
      if (!focusItem) {
        this.actionsList.focus({ preventScroll });
        this.previouslyFocusedItem = void 0;
      } else if (forceFocus || this.previouslyFocusedItem !== this.focusedItem) {
        actionViewItem.focus(fromRight);
        this.previouslyFocusedItem = this.focusedItem;
      }
      if (focusItem) {
        actionViewItem.showHover?.();
      }
    }
  }
  doTrigger(event) {
    if (typeof this.focusedItem === "undefined") {
      return;
    }
    const actionViewItem = this.viewItems[this.focusedItem];
    if (actionViewItem instanceof BaseActionViewItem) {
      const context = actionViewItem._context === null || actionViewItem._context === void 0 ? event : actionViewItem._context;
      this.run(actionViewItem._action, context);
    }
  }
  async run(action, context) {
    await this._actionRunner.run(action, context);
  }
  dispose() {
    this._context = void 0;
    this._viewItems = dispose(this._viewItems);
    this.getContainer().remove();
    super.dispose();
  }
}
function prepareActions(actions) {
  if (!actions.length) {
    return actions;
  }
  let firstIndexOfAction = -1;
  for (let i = 0; i < actions.length; i++) {
    if (actions[i].id === Separator.ID) {
      continue;
    }
    firstIndexOfAction = i;
    break;
  }
  if (firstIndexOfAction === -1) {
    return [];
  }
  actions = actions.slice(firstIndexOfAction);
  for (let h = actions.length - 1; h >= 0; h--) {
    const isSeparator = actions[h].id === Separator.ID;
    if (isSeparator) {
      actions.splice(h, 1);
    } else {
      break;
    }
  }
  let foundAction = false;
  for (let k = actions.length - 1; k >= 0; k--) {
    const isSeparator = actions[k].id === Separator.ID;
    if (isSeparator && !foundAction) {
      actions.splice(k, 1);
    } else if (!isSeparator) {
      foundAction = true;
    } else if (isSeparator) {
      foundAction = false;
    }
  }
  return actions;
}
export {
  ActionBar,
  ActionsOrientation,
  prepareActions
};
