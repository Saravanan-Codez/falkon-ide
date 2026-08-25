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
import { asCSSUrl } from "../../../base/browser/cssValue.js";
import { $, addDisposableListener, append, EventType, ModifierKeyEmitter, prepend } from "../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { ActionViewItem, BaseActionViewItem, SelectActionViewItem } from "../../../base/browser/ui/actionbar/actionViewItems.js";
import { DropdownMenuActionViewItem } from "../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { SeparatorSelectOption } from "../../../base/browser/ui/selectBox/selectBox.js";
import { ActionRunner, Separator, SubmenuAction } from "../../../base/common/actions.js";
import { UILabelProvider } from "../../../base/common/keybindingLabels.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { combinedDisposable, DisposableStore, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { isLinux, isWindows, OS } from "../../../base/common/platform.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { assertType } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
import { IAccessibilityService } from "../../accessibility/common/accessibility.js";
import { isICommandActionToggleInfo } from "../../action/common/action.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { ICommandService } from "../../commands/common/commands.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../contextview/browser/contextView.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { INotificationService } from "../../notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { defaultSelectBoxStyles } from "../../theme/browser/defaultStyles.js";
import { asCssVariable, selectBorder } from "../../theme/common/colorRegistry.js";
import { triggerClickAnimation } from "../../../base/browser/ui/animations/animations.js";
import { isDark } from "../../theme/common/theme.js";
import { IThemeService } from "../../theme/common/themeService.js";
import { hasNativeContextMenu } from "../../window/common/window.js";
import { IMenuService, MenuItemAction, SubmenuItemAction } from "../common/actions.js";
import "./menuEntryActionViewItem.css";
function getContextMenuActions(groups, primaryGroup) {
  const target = { primary: [], secondary: [] };
  getContextMenuActionsImpl(groups, target, primaryGroup);
  return target;
}
function getFlatContextMenuActions(groups, primaryGroup) {
  const target = [];
  getContextMenuActionsImpl(groups, target, primaryGroup);
  return target;
}
function getContextMenuActionsImpl(groups, target, primaryGroup) {
  const modifierKeyEmitter = ModifierKeyEmitter.getInstance();
  const useAlternativeActions = modifierKeyEmitter.keyStatus.altKey || (isWindows || isLinux) && modifierKeyEmitter.keyStatus.shiftKey;
  fillInActions(groups, target, useAlternativeActions, primaryGroup ? (actionGroup) => actionGroup === primaryGroup : (actionGroup) => actionGroup === "navigation");
}
function getActionBarActions(groups, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
  const target = { primary: [], secondary: [] };
  fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
  return target;
}
function getFlatActionBarActions(groups, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
  const target = [];
  fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
  return target;
}
function fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
  const isPrimaryAction = typeof primaryGroup === "string" ? (actionGroup) => actionGroup === primaryGroup : primaryGroup;
  fillInActions(groups, target, false, isPrimaryAction, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
}
function fillInActions(groups, target, useAlternativeActions, isPrimaryAction = (actionGroup) => actionGroup === "navigation", shouldInlineSubmenu = () => false, useSeparatorsInPrimaryActions = false) {
  let primaryBucket;
  let secondaryBucket;
  if (Array.isArray(target)) {
    primaryBucket = target;
    secondaryBucket = target;
  } else {
    primaryBucket = target.primary;
    secondaryBucket = target.secondary;
  }
  const submenuInfo = /* @__PURE__ */ new Set();
  for (const [group, actions] of groups) {
    let target2;
    if (isPrimaryAction(group)) {
      target2 = primaryBucket;
      if (target2.length > 0 && useSeparatorsInPrimaryActions) {
        target2.push(new Separator());
      }
    } else {
      target2 = secondaryBucket;
      if (target2.length > 0) {
        target2.push(new Separator());
      }
    }
    for (let action of actions) {
      if (useAlternativeActions) {
        action = action instanceof MenuItemAction && action.alt ? action.alt : action;
      }
      const newLen = target2.push(action);
      if (action instanceof SubmenuAction) {
        submenuInfo.add({ group, action, index: newLen - 1 });
      }
    }
  }
  for (const { group, action, index } of submenuInfo) {
    const target2 = isPrimaryAction(group) ? primaryBucket : secondaryBucket;
    const submenuActions = action.actions;
    if (shouldInlineSubmenu(action, group, target2.length)) {
      target2.splice(index, 1, ...submenuActions);
    }
  }
}
let MenuEntryActionViewItem = class extends ActionViewItem {
  constructor(action, _options, _keybindingService, _notificationService, _contextKeyService, _themeService, _contextMenuService, _accessibilityService) {
    super(void 0, action, { icon: !!(action.class || action.item.icon), label: !action.class && !action.item.icon, draggable: _options?.draggable, keybinding: _options?.keybinding, hoverDelegate: _options?.hoverDelegate, keybindingNotRenderedWithLabel: _options?.keybindingNotRenderedWithLabel });
    this._options = _options;
    this._keybindingService = _keybindingService;
    this._notificationService = _notificationService;
    this._contextKeyService = _contextKeyService;
    this._themeService = _themeService;
    this._contextMenuService = _contextMenuService;
    this._accessibilityService = _accessibilityService;
    this._wantsAltCommand = false;
    this._itemClassDispose = this._register(new MutableDisposable());
    this._altKey = ModifierKeyEmitter.getInstance();
  }
  get _menuItemAction() {
    return this._action;
  }
  get _commandAction() {
    return this._wantsAltCommand && this._menuItemAction.alt || this._menuItemAction;
  }
  async onClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (this._options?.onClickAnimation && this.element && !this._accessibilityService.isMotionReduced()) {
      const icon = this._menuItemAction.item.icon;
      triggerClickAnimation(this.element, this._options.onClickAnimation, ThemeIcon.isThemeIcon(icon) ? icon : void 0);
    }
    try {
      await this.actionRunner.run(this._commandAction, this._context);
    } catch (err) {
      this._notificationService.error(err);
    }
  }
  render(container) {
    super.render(container);
    container.classList.add("menu-entry");
    if (this.options.icon) {
      this._updateItemClass(this._menuItemAction.item);
    }
    if (this._menuItemAction.alt) {
      let isMouseOver = false;
      const updateAltState = () => {
        const wantsAltCommand = !!this._menuItemAction.alt?.enabled && (!this._accessibilityService.isMotionReduced() || isMouseOver) && (this._altKey.keyStatus.altKey || this._altKey.keyStatus.shiftKey && isMouseOver);
        if (wantsAltCommand !== this._wantsAltCommand) {
          this._wantsAltCommand = wantsAltCommand;
          this.updateLabel();
          this.updateTooltip();
          this.updateClass();
        }
      };
      this._register(this._altKey.event(updateAltState));
      this._register(addDisposableListener(container, "mouseleave", (_) => {
        isMouseOver = false;
        updateAltState();
      }));
      this._register(addDisposableListener(container, "mouseenter", (_) => {
        isMouseOver = true;
        updateAltState();
      }));
      updateAltState();
    }
  }
  updateLabel() {
    if (this.options.label && this.label) {
      this.label.textContent = this._commandAction.label;
    }
  }
  getTooltip() {
    const tooltip = this._commandAction.tooltip || this._commandAction.label;
    let title = this._keybindingService.appendKeybinding(tooltip, this._commandAction.id, this._contextKeyService);
    if (!this._wantsAltCommand && this._menuItemAction.alt?.enabled) {
      const altTooltip = this._menuItemAction.alt.tooltip || this._menuItemAction.alt.label;
      const altTitleSection = this._keybindingService.appendKeybinding(altTooltip, this._menuItemAction.alt.id, this._contextKeyService);
      title = localize("titleAndKbAndAlt", "{0}\n[{1}] {2}", title, UILabelProvider.modifierLabels[OS].altKey, altTitleSection);
    }
    return title;
  }
  updateClass() {
    if (this.options.icon) {
      if (this._commandAction !== this._menuItemAction) {
        if (this._menuItemAction.alt) {
          this._updateItemClass(this._menuItemAction.alt.item);
        }
      } else {
        this._updateItemClass(this._menuItemAction.item);
      }
    }
  }
  _updateItemClass(item) {
    this._itemClassDispose.value = void 0;
    const { element, label } = this;
    if (!element || !label) {
      return;
    }
    const icon = this._commandAction.checked && isICommandActionToggleInfo(item.toggled) && item.toggled.icon ? item.toggled.icon : item.icon;
    if (!icon) {
      return;
    }
    if (ThemeIcon.isThemeIcon(icon)) {
      const iconClasses = ThemeIcon.asClassNameArray(icon);
      label.classList.add(...iconClasses);
      this._itemClassDispose.value = toDisposable(() => {
        label.classList.remove(...iconClasses);
      });
    } else {
      label.style.backgroundImage = isDark(this._themeService.getColorTheme().type) ? asCSSUrl(icon.dark) : asCSSUrl(icon.light);
      label.classList.add("icon");
      this._itemClassDispose.value = combinedDisposable(
        toDisposable(() => {
          label.style.backgroundImage = "";
          label.classList.remove("icon");
        }),
        this._themeService.onDidColorThemeChange(() => {
          this.updateClass();
        })
      );
    }
  }
};
MenuEntryActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IAccessibilityService)
], MenuEntryActionViewItem);
class TextOnlyMenuEntryActionViewItem extends MenuEntryActionViewItem {
  render(container) {
    this.options.label = true;
    this.options.icon = false;
    super.render(container);
    container.classList.add("text-only");
    container.classList.toggle("use-comma", this._options?.useComma ?? false);
  }
  updateLabel() {
    const kb = this._keybindingService.lookupKeybinding(this._action.id, this._contextKeyService);
    if (!kb) {
      return super.updateLabel();
    }
    if (this.label) {
      const kb2 = TextOnlyMenuEntryActionViewItem._symbolPrintEnter(kb);
      if (this._options?.conversational) {
        this.label.textContent = localize({ key: "content2", comment: ['A label with keybindg like "ESC to dismiss"'] }, "{1} to {0}", this._action.label, kb2);
      } else {
        this.label.textContent = localize({ key: "content", comment: ["A label", "A keybinding"] }, "{0} ({1})", this._action.label, kb2);
      }
    }
  }
  static _symbolPrintEnter(kb) {
    return kb.getLabel()?.replace(/\benter\b/gi, "\u23CE").replace(/\bEscape\b/gi, "Esc");
  }
}
let SubmenuEntryActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(action, options, _keybindingService, _contextMenuService, _themeService) {
    const dropdownOptions = {
      ...options,
      menuAsChild: options?.menuAsChild ?? false,
      classNames: options?.classNames ?? (ThemeIcon.isThemeIcon(action.item.icon) ? ThemeIcon.asClassName(action.item.icon) : void 0),
      keybindingProvider: options?.keybindingProvider ?? ((action2) => _keybindingService.lookupKeybinding(action2.id))
    };
    super(action, { getActions: () => action.actions }, _contextMenuService, dropdownOptions);
    this._keybindingService = _keybindingService;
    this._contextMenuService = _contextMenuService;
    this._themeService = _themeService;
  }
  render(container) {
    super.render(container);
    assertType(this.element);
    container.classList.add("menu-entry");
    const action = this._action;
    const { icon } = action.item;
    if (icon && !ThemeIcon.isThemeIcon(icon)) {
      this.element.classList.add("icon");
      const setBackgroundImage = () => {
        if (this.element) {
          this.element.style.backgroundImage = isDark(this._themeService.getColorTheme().type) ? asCSSUrl(icon.dark) : asCSSUrl(icon.light);
        }
      };
      setBackgroundImage();
      this._register(this._themeService.onDidColorThemeChange(() => {
        setBackgroundImage();
      }));
    }
  }
};
SubmenuEntryActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IThemeService)
], SubmenuEntryActionViewItem);
let DropdownWithDefaultActionViewItem = class extends BaseActionViewItem {
  constructor(submenuAction, options, _keybindingService, _notificationService, _contextMenuService, _menuService, _instaService, _storageService, _commandService) {
    super(null, submenuAction);
    this._keybindingService = _keybindingService;
    this._notificationService = _notificationService;
    this._contextMenuService = _contextMenuService;
    this._menuService = _menuService;
    this._instaService = _instaService;
    this._storageService = _storageService;
    this._commandService = _commandService;
    this._defaultActionDisposables = this._register(new DisposableStore());
    this._container = null;
    this._primaryActionListener = this._register(new MutableDisposable());
    this._options = options;
    this._storageKey = `${submenuAction.item.submenu.id}_lastActionId`;
    let defaultAction;
    const defaultActionId = options?.togglePrimaryAction ? _storageService.get(this._storageKey, StorageScope.WORKSPACE) : void 0;
    if (defaultActionId) {
      defaultAction = submenuAction.actions.find((a) => defaultActionId === a.id && this._canBePrimaryAction(a));
    }
    if (!defaultAction) {
      defaultAction = submenuAction.actions.find((action) => this._canBePrimaryAction(action)) ?? submenuAction.actions[0];
    }
    this._defaultAction = this._defaultActionDisposables.add(this._instaService.createInstance(MenuEntryActionViewItem, defaultAction, { keybinding: this._getDefaultActionKeybindingLabel(defaultAction), hoverDelegate: options?.hoverDelegate }));
    const dropdownOptions = {
      keybindingProvider: (action) => this._keybindingService.lookupKeybinding(action.id),
      ...options,
      menuAsChild: options?.menuAsChild ?? true,
      classNames: options?.classNames ?? ["codicon", "codicon-chevron-down"],
      actionRunner: options?.actionRunner ?? this._register(new ActionRunner())
    };
    this._dropdown = this._register(new DropdownMenuActionViewItem(submenuAction, submenuAction.actions, this._contextMenuService, dropdownOptions));
    if (options?.togglePrimaryAction) {
      this.registerTogglePrimaryActionListener();
    }
  }
  get onDidChangeDropdownVisibility() {
    return this._dropdown.onDidChangeVisibility;
  }
  registerTogglePrimaryActionListener() {
    this._primaryActionListener.value = this._options?.primaryActionIds?.length ? this._commandService.onDidExecuteCommand((event) => {
      const action = this._action.actions.find((action2) => action2.id === event.commandId);
      if (action instanceof MenuItemAction && this._canBePrimaryAction(action)) {
        this.update(action);
      }
    }) : this._dropdown.actionRunner.onDidRun((e) => {
      if (e.action instanceof MenuItemAction) {
        this.update(e.action);
      }
    });
  }
  update(lastAction) {
    if (!this._canBePrimaryAction(lastAction)) {
      return;
    }
    if (this._options?.togglePrimaryAction) {
      if (this._storageService.get(this._storageKey, StorageScope.WORKSPACE) !== lastAction.id) {
        this._storageService.store(this._storageKey, lastAction.id, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    }
    if (this._defaultAction.action.id === lastAction.id) {
      return;
    }
    this._defaultActionDisposables.clear();
    this._defaultAction = this._defaultActionDisposables.add(this._instaService.createInstance(MenuEntryActionViewItem, lastAction, { keybinding: this._getDefaultActionKeybindingLabel(lastAction), hoverDelegate: this._options?.hoverDelegate }));
    this._defaultAction.actionRunner = this._defaultActionDisposables.add(new class extends ActionRunner {
      async runAction(action, context) {
        await action.run(void 0);
      }
    }());
    if (this._container) {
      this._defaultAction.render(prepend(this._container, $(".action-container")));
    }
  }
  _canBePrimaryAction(action) {
    return !this._options?.primaryActionIds?.length || this._options.primaryActionIds.includes(action.id);
  }
  _getDefaultActionKeybindingLabel(defaultAction) {
    let defaultActionKeybinding;
    if (this._options?.renderKeybindingWithDefaultActionLabel) {
      const kb = this._keybindingService.lookupKeybinding(defaultAction.id);
      if (kb) {
        defaultActionKeybinding = `(${kb.getLabel()})`;
      }
    }
    return defaultActionKeybinding;
  }
  setActionContext(newContext) {
    super.setActionContext(newContext);
    this._defaultAction.setActionContext(newContext);
    this._dropdown.setActionContext(newContext);
  }
  set actionRunner(actionRunner) {
    super.actionRunner = actionRunner;
    this._defaultAction.actionRunner = actionRunner;
    if (!this._options?.togglePrimaryAction || this._options.primaryActionIds?.length) {
      this._dropdown.actionRunner = actionRunner;
    }
  }
  get actionRunner() {
    return super.actionRunner;
  }
  render(container) {
    this._container = container;
    super.render(this._container);
    this._container.classList.add("monaco-dropdown-with-default");
    const primaryContainer = $(".action-container");
    this._defaultAction.render(append(this._container, primaryContainer));
    this._register(addDisposableListener(primaryContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow)) {
        this._defaultAction.element.tabIndex = -1;
        this._dropdown.focus();
        event.stopPropagation();
      }
    }));
    const dropdownContainer = $(".dropdown-action-container");
    this._dropdown.render(append(this._container, dropdownContainer));
    this._register(addDisposableListener(dropdownContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.LeftArrow)) {
        this._defaultAction.element.tabIndex = 0;
        this._dropdown.setFocusable(false);
        this._defaultAction.element?.focus();
        event.stopPropagation();
      }
    }));
  }
  focus(fromRight) {
    if (fromRight) {
      this._dropdown.focus();
    } else {
      this._defaultAction.element.tabIndex = 0;
      this._defaultAction.element.focus();
    }
  }
  blur() {
    this._defaultAction.element.tabIndex = -1;
    this._dropdown.blur();
    this._container.blur();
  }
  setFocusable(focusable) {
    if (focusable) {
      this._defaultAction.element.tabIndex = 0;
    } else {
      this._defaultAction.element.tabIndex = -1;
      this._dropdown.setFocusable(false);
    }
  }
};
DropdownWithDefaultActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, ICommandService)
], DropdownWithDefaultActionViewItem);
let SubmenuEntrySelectActionViewItem = class extends SelectActionViewItem {
  constructor(action, contextViewService, configurationService) {
    super(null, action, action.actions.map((a) => a.id === Separator.ID ? SeparatorSelectOption : { text: a.label, isDisabled: !a.enabled }), 0, contextViewService, defaultSelectBoxStyles, { ariaLabel: action.tooltip || action.label, optionsAsChildren: true, useCustomDrawn: !hasNativeContextMenu(configurationService) });
    this.select(Math.max(0, action.actions.findIndex((a) => a.checked)));
  }
  render(container) {
    super.render(container);
    container.style.borderColor = asCssVariable(selectBorder);
  }
  runAction(option, index) {
    const action = this.action.actions[index];
    if (action) {
      this.actionRunner.run(action);
    }
  }
};
SubmenuEntrySelectActionViewItem = __decorateClass([
  __decorateParam(1, IContextViewService),
  __decorateParam(2, IConfigurationService)
], SubmenuEntrySelectActionViewItem);
function createActionViewItem(instaService, action, options) {
  if (action instanceof MenuItemAction) {
    return instaService.createInstance(MenuEntryActionViewItem, action, options);
  } else if (action instanceof SubmenuItemAction) {
    if (action.item.isSelection) {
      return instaService.createInstance(SubmenuEntrySelectActionViewItem, action);
    } else if (action.item.isSplitButton) {
      return instaService.createInstance(DropdownWithDefaultActionViewItem, action, {
        ...options,
        togglePrimaryAction: typeof action.item.isSplitButton !== "boolean" ? action.item.isSplitButton.togglePrimaryAction : false,
        primaryActionIds: typeof action.item.isSplitButton !== "boolean" ? action.item.isSplitButton.primaryActionIds : void 0
      });
    } else {
      return instaService.createInstance(SubmenuEntryActionViewItem, action, options);
    }
  } else {
    return void 0;
  }
}
export {
  DropdownWithDefaultActionViewItem,
  MenuEntryActionViewItem,
  SubmenuEntryActionViewItem,
  TextOnlyMenuEntryActionViewItem,
  createActionViewItem,
  fillInActionBarActions,
  getActionBarActions,
  getContextMenuActions,
  getFlatActionBarActions,
  getFlatContextMenuActions
};
