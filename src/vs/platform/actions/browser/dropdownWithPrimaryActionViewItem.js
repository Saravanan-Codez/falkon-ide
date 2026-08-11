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
import * as DOM from "../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { BaseActionViewItem } from "../../../base/browser/ui/actionbar/actionViewItems.js";
import { DropdownMenuActionViewItem } from "../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { MenuEntryActionViewItem } from "./menuEntryActionViewItem.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { INotificationService } from "../../notification/common/notification.js";
import { IThemeService } from "../../theme/common/themeService.js";
import { IContextMenuService } from "../../contextview/browser/contextView.js";
import { IAccessibilityService } from "../../accessibility/common/accessibility.js";
let DropdownWithPrimaryActionViewItem = class extends BaseActionViewItem {
  constructor(primaryAction, dropdownAction, dropdownMenuActions, className, _options, _contextMenuProvider, _keybindingService, _notificationService, _contextKeyService, _themeService, _accessibilityService) {
    super(null, primaryAction, { hoverDelegate: _options?.hoverDelegate });
    this._options = _options;
    this._contextMenuProvider = _contextMenuProvider;
    this._container = null;
    this._dropdownContainer = null;
    this._primaryAction = new MenuEntryActionViewItem(primaryAction, { hoverDelegate: _options?.hoverDelegate }, _keybindingService, _notificationService, _contextKeyService, _themeService, _contextMenuProvider, _accessibilityService);
    if (_options?.actionRunner) {
      this._primaryAction.actionRunner = _options.actionRunner;
    }
    this._dropdown = new DropdownMenuActionViewItem(dropdownAction, dropdownMenuActions, this._contextMenuProvider, {
      menuAsChild: _options?.menuAsChild ?? true,
      classNames: className ? ["codicon", "codicon-chevron-down", className] : ["codicon", "codicon-chevron-down"],
      menuClassName: _options?.menuClassName,
      closeAnimation: _options?.closeAnimation,
      getAnchor: _options?.getAnchor,
      actionRunner: this._options?.actionRunner,
      keybindingProvider: this._options?.getKeyBinding ?? ((action) => _keybindingService.lookupKeybinding(action.id)),
      hoverDelegate: _options?.hoverDelegate,
      skipTelemetry: _options?.skipTelemetry
    });
  }
  get onDidChangeDropdownVisibility() {
    return this._dropdown.onDidChangeVisibility;
  }
  set actionRunner(actionRunner) {
    super.actionRunner = actionRunner;
    this._primaryAction.actionRunner = actionRunner;
    this._dropdown.actionRunner = actionRunner;
  }
  get actionRunner() {
    return super.actionRunner;
  }
  setActionContext(newContext) {
    super.setActionContext(newContext);
    this._primaryAction.setActionContext(newContext);
    this._dropdown.setActionContext(newContext);
  }
  render(container) {
    this._container = container;
    super.render(this._container);
    this._container.classList.add("monaco-dropdown-with-primary");
    const primaryContainer = DOM.$(".action-container");
    primaryContainer.role = "button";
    primaryContainer.ariaDisabled = String(!this.action.enabled);
    this._primaryAction.render(DOM.append(this._container, primaryContainer));
    this._dropdownContainer = DOM.$(".dropdown-action-container");
    this._dropdown.render(DOM.append(this._container, this._dropdownContainer));
    this._register(DOM.addDisposableListener(primaryContainer, DOM.EventType.KEY_DOWN, (e) => {
      if (!this.action.enabled) {
        return;
      }
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow)) {
        this._primaryAction.element.tabIndex = -1;
        this._dropdown.focus();
        event.stopPropagation();
      }
    }));
    this._register(DOM.addDisposableListener(this._dropdownContainer, DOM.EventType.KEY_DOWN, (e) => {
      if (!this.action.enabled) {
        return;
      }
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.LeftArrow)) {
        this._primaryAction.element.tabIndex = 0;
        this._dropdown.setFocusable(false);
        this._primaryAction.element?.focus();
        event.stopPropagation();
      }
    }));
    this.updateEnabled();
  }
  focus(fromRight) {
    if (fromRight) {
      this._dropdown.focus();
    } else {
      this._primaryAction.element.tabIndex = 0;
      this._primaryAction.element.focus();
    }
  }
  blur() {
    this._primaryAction.element.tabIndex = -1;
    this._dropdown.blur();
    this._container.blur();
  }
  setFocusable(focusable) {
    if (focusable) {
      this._primaryAction.element.tabIndex = 0;
    } else {
      this._primaryAction.element.tabIndex = -1;
      this._dropdown.setFocusable(false);
    }
  }
  updateEnabled() {
    const disabled = !this.action.enabled;
    this.element?.classList.toggle("disabled", disabled);
  }
  update(dropdownAction, dropdownMenuActions, dropdownIcon) {
    this._dropdown.dispose();
    this._dropdown = new DropdownMenuActionViewItem(dropdownAction, dropdownMenuActions, this._contextMenuProvider, {
      menuAsChild: this._options?.menuAsChild ?? true,
      classNames: ["codicon", dropdownIcon || "codicon-chevron-down"],
      menuClassName: this._options?.menuClassName,
      closeAnimation: this._options?.closeAnimation,
      getAnchor: this._options?.getAnchor,
      actionRunner: this._options?.actionRunner,
      hoverDelegate: this._options?.hoverDelegate,
      keybindingProvider: this._options?.getKeyBinding
    });
    if (this._dropdownContainer) {
      this._dropdown.render(this._dropdownContainer);
    }
  }
  showDropdown() {
    this._dropdown.show();
  }
  dispose() {
    this._primaryAction.dispose();
    this._dropdown.dispose();
    super.dispose();
  }
};
DropdownWithPrimaryActionViewItem = __decorateClass([
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IAccessibilityService)
], DropdownWithPrimaryActionViewItem);
export {
  DropdownWithPrimaryActionViewItem
};
