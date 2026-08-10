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
import { $, append } from "../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../base/browser/ui/actionbar/actionViewItems.js";
import { getBaseLayerHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegate2.js";
import { getDefaultHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IActionWidgetService } from "../../actionWidget/browser/actionWidget.js";
import { ActionWidgetDropdown } from "../../actionWidget/browser/actionWidgetDropdown.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
let ActionWidgetDropdownActionViewItem = class extends BaseActionViewItem {
  constructor(action, actionWidgetOptions, _actionWidgetService, _keybindingService, _contextKeyService, _telemetryService) {
    super(void 0, action);
    this.actionWidgetOptions = actionWidgetOptions;
    this._actionWidgetService = _actionWidgetService;
    this._keybindingService = _keybindingService;
    this._contextKeyService = _contextKeyService;
    this._telemetryService = _telemetryService;
    this.actionItem = null;
  }
  render(container) {
    this.actionItem = container;
    const labelRenderer = (el) => {
      this.element = append(el, $("a.action-label"));
      return this.renderLabel(this.element);
    };
    this.actionWidgetDropdown = this._register(new ActionWidgetDropdown(container, { ...this.actionWidgetOptions, labelRenderer }, this._actionWidgetService, this._keybindingService, this._telemetryService));
    this._register(this.actionWidgetDropdown.onDidChangeVisibility((visible) => {
      this.element?.setAttribute("aria-expanded", `${visible}`);
    }));
    this.updateTooltip();
    this.updateEnabled();
  }
  renderLabel(element) {
    element.classList.add("codicon");
    if (this._action.label) {
      this._register(getBaseLayerHoverDelegate().setupManagedHover(this.options.hoverDelegate ?? getDefaultHoverDelegate("mouse"), element, this._action.label));
    }
    return null;
  }
  updateAriaLabel() {
    if (this.element) {
      this.setAriaLabelAttributes(this.element);
    }
  }
  setAriaLabelAttributes(element) {
    element.setAttribute("role", "button");
    element.setAttribute("aria-haspopup", "true");
    element.setAttribute("aria-expanded", "false");
    element.ariaLabel = this.getTooltip() + " - " + (element.textContent || this._action.label) || "";
  }
  getTooltip() {
    const tooltip = this.action.tooltip ?? this.action.label;
    return this._keybindingService.appendKeybinding(tooltip, this.action.id, this._contextKeyService);
  }
  show() {
    this.actionWidgetDropdown?.show();
  }
  setDropdownEnabled(enabled) {
    this.actionWidgetDropdown?.setEnabled(enabled && this.action.enabled);
  }
  updateEnabled() {
    const disabled = !this.action.enabled;
    this.actionItem?.classList.toggle("disabled", disabled);
    this.element?.classList.toggle("disabled", disabled);
    this.setDropdownEnabled(true);
  }
};
ActionWidgetDropdownActionViewItem = __decorateClass([
  __decorateParam(2, IActionWidgetService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, ITelemetryService)
], ActionWidgetDropdownActionViewItem);
export {
  ActionWidgetDropdownActionViewItem
};
