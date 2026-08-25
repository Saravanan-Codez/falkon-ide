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
import { getActiveElement, isHTMLElement } from "../../../base/browser/dom.js";
import { CONTEXT_VIEW_MENU_MOTION_ANCESTOR_CLASSES, CONTEXT_VIEW_MENU_MOTION_CLOSE_ANIMATION_DURATION } from "../../../base/browser/ui/contextview/contextview.js";
import { BaseDropdown } from "../../../base/browser/ui/dropdown/dropdown.js";
import { Codicon } from "../../../base/common/codicons.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { ActionListItemKind } from "./actionList.js";
import { IActionWidgetService } from "./actionWidget.js";
const ACTION_WIDGET_DROPDOWN_MOTION_CLASS = "action-widget-dropdown";
const ACTION_WIDGET_DROPDOWN_MOTION_CLOSING_CLASS = "action-widget-dropdown-closing";
const actionWidgetDropdownCloseAnimation = {
  className: ACTION_WIDGET_DROPDOWN_MOTION_CLOSING_CLASS,
  duration: CONTEXT_VIEW_MENU_MOTION_CLOSE_ANIMATION_DURATION,
  requiredAncestorClasses: CONTEXT_VIEW_MENU_MOTION_ANCESTOR_CLASSES
};
function withActionWidgetDropdownMotion(listOptions) {
  const classNames = listOptions?.className?.split(/\s+/).filter(Boolean) ?? [];
  if (!classNames.includes(ACTION_WIDGET_DROPDOWN_MOTION_CLASS)) {
    classNames.push(ACTION_WIDGET_DROPDOWN_MOTION_CLASS);
  }
  const widgetClassNames = listOptions?.widgetClassName?.split(/\s+/).filter(Boolean) ?? [];
  if (!widgetClassNames.includes(ACTION_WIDGET_DROPDOWN_MOTION_CLASS)) {
    widgetClassNames.push(ACTION_WIDGET_DROPDOWN_MOTION_CLASS);
  }
  return {
    ...listOptions,
    className: classNames.join(" "),
    widgetClassName: widgetClassNames.join(" "),
    closeAnimation: listOptions?.closeAnimation ?? actionWidgetDropdownCloseAnimation
  };
}
let ActionWidgetDropdown = class extends BaseDropdown {
  constructor(container, _options, actionWidgetService, keybindingService, telemetryService) {
    super(container, _options);
    this._options = _options;
    this.actionWidgetService = actionWidgetService;
    this.keybindingService = keybindingService;
    this.telemetryService = telemetryService;
    this._enabled = true;
  }
  show() {
    if (!this._enabled) {
      return;
    }
    const actionBarActions = this._options.actionBarActions ?? this._options.actionBarActionProvider?.getActions() ?? [];
    const actions = this._options.actions ?? this._options.actionProvider?.getActions() ?? [];
    const optionBeforeOpen = actions.find((a) => a.checked);
    let selectedOption = optionBeforeOpen;
    const actionWidgetItems = [];
    const actionsByCategory = /* @__PURE__ */ new Map();
    for (const action of actions) {
      let category = action.category;
      if (!category) {
        category = { label: "", order: Number.MIN_SAFE_INTEGER };
      }
      if (!actionsByCategory.has(category.label)) {
        actionsByCategory.set(category.label, []);
      }
      actionsByCategory.get(category.label).push(action);
    }
    const sortedCategories = Array.from(actionsByCategory.entries()).sort((a, b) => {
      const aOrder = a[1][0]?.category?.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b[1][0]?.category?.order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
    for (let i = 0; i < sortedCategories.length; i++) {
      const [categoryLabel, categoryActions] = sortedCategories[i];
      const showHeader = categoryActions[0]?.category?.showHeader ?? false;
      if (showHeader && categoryLabel) {
        actionWidgetItems.push({
          kind: ActionListItemKind.Header,
          label: categoryLabel,
          canPreview: false,
          disabled: false,
          hideIcon: false
        });
      }
      for (const action of categoryActions) {
        actionWidgetItems.push({
          item: action,
          tooltip: action.tooltip,
          description: action.description,
          ariaDescription: action.ariaDescription,
          detail: action.detail,
          hover: action.hover,
          toolbarActions: action.toolbarActions,
          className: action.className,
          inlineToggle: action.inlineToggle,
          kind: ActionListItemKind.Action,
          canPreview: false,
          group: { title: "", icon: action.icon ?? ThemeIcon.fromId(action.checked ? Codicon.check.id : Codicon.blank.id) },
          disabled: !action.enabled,
          hideIcon: false,
          label: action.label,
          keybinding: this._options.showItemKeybindings ? action.keybinding ?? this.keybindingService.lookupKeybinding(action.id) : void 0
        });
      }
      if (i < sortedCategories.length - 1) {
        actionWidgetItems.push({
          label: "",
          kind: ActionListItemKind.Separator,
          canPreview: false,
          disabled: false,
          hideIcon: false
        });
      }
    }
    const previouslyFocusedElement = getActiveElement();
    const auxiliaryActionIds = new Set(actionBarActions.map((action) => action.id));
    const actionWidgetDelegate = {
      onSelect: (action, preview) => {
        if (!auxiliaryActionIds.has(action.id)) {
          selectedOption = action;
        }
        this.actionWidgetService.hide();
        action.run();
      },
      onHide: () => {
        this.hide();
        if (isHTMLElement(previouslyFocusedElement)) {
          previouslyFocusedElement.focus();
        }
        this._emitCloseEvent(optionBeforeOpen, selectedOption);
      }
    };
    if (actionBarActions.length) {
      if (actionWidgetItems.length) {
        actionWidgetItems.push({
          label: "",
          kind: ActionListItemKind.Separator,
          canPreview: false,
          disabled: false,
          hideIcon: false
        });
      }
      for (const action of actionBarActions) {
        actionWidgetItems.push({
          item: action,
          tooltip: action.tooltip,
          kind: ActionListItemKind.Action,
          canPreview: false,
          group: { title: "", icon: ThemeIcon.fromId(Codicon.blank.id) },
          disabled: !action.enabled,
          hideIcon: false,
          label: action.label
        });
      }
    }
    const nonSeparatorItems = actionWidgetItems.filter((i) => i.kind === ActionListItemKind.Action);
    const accessibilityProvider = {
      isChecked(element) {
        return element.kind === ActionListItemKind.Action && !!element?.item?.checked;
      },
      getSetSize: () => nonSeparatorItems.length,
      getPosInSet: (_element, index) => {
        let pos = 0;
        for (let i = 0; i <= index && i < actionWidgetItems.length; i++) {
          if (actionWidgetItems[i].kind === ActionListItemKind.Action) {
            pos++;
          }
        }
        return Math.max(pos, 1);
      },
      getRole: (e) => {
        switch (e.kind) {
          case ActionListItemKind.Action:
            return e.item && auxiliaryActionIds.has(e.item.id) ? "menuitem" : "menuitemcheckbox";
          case ActionListItemKind.Separator:
            return "separator";
          default:
            return "separator";
        }
      },
      getWidgetRole: () => "menu"
    };
    super.show();
    this.actionWidgetService.show(
      this._options.label ?? "",
      false,
      actionWidgetItems,
      actionWidgetDelegate,
      this._options.getAnchor?.() ?? this.element,
      void 0,
      [],
      accessibilityProvider,
      withActionWidgetDropdownMotion(this._options.listOptions)
    );
  }
  hide() {
    const wasVisible = this.isVisible();
    super.hide();
    if (wasVisible) {
      this.actionWidgetService.hide(true);
    }
  }
  setEnabled(enabled) {
    this._enabled = enabled;
  }
  _emitCloseEvent(optionBeforeOpen, selectedOption) {
    const optionBefore = optionBeforeOpen;
    const optionAfter = selectedOption;
    if (this._options.reporter) {
      this.telemetryService.publicLog2(
        "actionWidgetDropdownClosed",
        {
          id: this._options.reporter.id,
          name: this._options.reporter.name,
          selectionChanged: optionBefore?.id !== optionAfter?.id,
          optionIdBefore: this._options.reporter.includeOptions ? optionBefore?.id : void 0,
          optionIdAfter: this._options.reporter.includeOptions ? optionAfter?.id : void 0,
          optionLabelBefore: this._options.reporter.includeOptions ? optionBefore?.label : void 0,
          optionLabelAfter: this._options.reporter.includeOptions ? optionAfter?.label : void 0
        }
      );
    }
  }
};
ActionWidgetDropdown = __decorateClass([
  __decorateParam(2, IActionWidgetService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, ITelemetryService)
], ActionWidgetDropdown);
export {
  ACTION_WIDGET_DROPDOWN_MOTION_CLASS,
  ACTION_WIDGET_DROPDOWN_MOTION_CLOSING_CLASS,
  ActionWidgetDropdown,
  actionWidgetDropdownCloseAnimation,
  withActionWidgetDropdownMotion
};
