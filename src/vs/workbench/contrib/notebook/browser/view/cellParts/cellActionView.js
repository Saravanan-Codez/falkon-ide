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
import * as DOM from "../../../../../../base/browser/dom.js";
import * as types from "../../../../../../base/common/types.js";
import { EventType as TouchEventType } from "../../../../../../base/browser/touch.js";
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { MenuEntryActionViewItem, SubmenuEntryActionViewItem } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuItemAction } from "../../../../../../platform/actions/common/actions.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
class CodiconActionViewItem extends MenuEntryActionViewItem {
  updateLabel() {
    if (this.options.label && this.label) {
      DOM.reset(this.label, ...renderLabelWithIcons(this._commandAction.label ?? ""));
    }
  }
}
class ActionViewWithLabel extends MenuEntryActionViewItem {
  render(container) {
    super.render(container);
    container.classList.add("notebook-action-view-item");
    this._actionLabel = document.createElement("a");
    container.appendChild(this._actionLabel);
    this.updateLabel();
  }
  updateLabel() {
    if (this._actionLabel) {
      this._actionLabel.classList.add("notebook-label");
      this._actionLabel.innerText = this._action.label;
    }
  }
}
let UnifiedSubmenuActionView = class extends SubmenuEntryActionViewItem {
  constructor(action, options, _renderLabel, subActionProvider, subActionViewItemProvider, _keybindingService, _contextMenuService, _themeService, _hoverService) {
    super(action, { ...options, hoverDelegate: options?.hoverDelegate ?? getDefaultHoverDelegate("element") }, _keybindingService, _contextMenuService, _themeService);
    this._renderLabel = _renderLabel;
    this.subActionProvider = subActionProvider;
    this.subActionViewItemProvider = subActionViewItemProvider;
    this._hoverService = _hoverService;
  }
  render(container) {
    super.render(container);
    container.classList.add("notebook-action-view-item");
    container.classList.add("notebook-action-view-item-unified");
    this._actionLabel = document.createElement("a");
    container.appendChild(this._actionLabel);
    this._hover = this._register(this._hoverService.setupManagedHover(this.options.hoverDelegate ?? getDefaultHoverDelegate("element"), this._actionLabel, ""));
    this.updateLabel();
    for (const event of [DOM.EventType.CLICK, DOM.EventType.MOUSE_DOWN, TouchEventType.Tap]) {
      this._register(DOM.addDisposableListener(container, event, (e) => this.onClick(e, true)));
    }
  }
  onClick(event, preserveFocus = false) {
    DOM.EventHelper.stop(event, true);
    const context = types.isUndefinedOrNull(this._context) ? this.options?.useEventAsContext ? event : { preserveFocus } : this._context;
    this.actionRunner.run(this._primaryAction ?? this._action, context);
  }
  updateLabel() {
    const actions = this.subActionProvider.getActions();
    if (this._actionLabel) {
      const primaryAction = actions[0];
      this._primaryAction = primaryAction;
      if (primaryAction && primaryAction instanceof MenuItemAction) {
        const element = this.element;
        if (element && primaryAction.item.icon && ThemeIcon.isThemeIcon(primaryAction.item.icon)) {
          const iconClasses = ThemeIcon.asClassNameArray(primaryAction.item.icon);
          element.classList.forEach((cl) => {
            if (cl.startsWith("codicon-")) {
              element.classList.remove(cl);
            }
          });
          element.classList.add(...iconClasses);
        }
        if (this._renderLabel) {
          this._actionLabel.classList.add("notebook-label");
          this._actionLabel.innerText = this._action.label;
          this._hover?.update(primaryAction.tooltip.length ? primaryAction.tooltip : primaryAction.label);
        }
      } else {
        if (this._renderLabel) {
          this._actionLabel.classList.add("notebook-label");
          this._actionLabel.innerText = this._action.label;
          this._hover?.update(this._action.tooltip.length ? this._action.tooltip : this._action.label);
        }
      }
    }
  }
};
UnifiedSubmenuActionView = __decorateClass([
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IHoverService)
], UnifiedSubmenuActionView);
export {
  ActionViewWithLabel,
  CodiconActionViewItem,
  UnifiedSubmenuActionView
};
