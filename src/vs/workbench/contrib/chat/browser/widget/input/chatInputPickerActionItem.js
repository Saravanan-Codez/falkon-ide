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
import { getActiveWindow } from "../../../../../../base/browser/dom.js";
import { AnchorPosition } from "../../../../../../base/common/layout.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { ActionWidgetDropdownActionViewItem } from "../../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js";
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { withActionWidgetDropdownMotion } from "../../../../../../platform/actionWidget/browser/actionWidgetDropdown.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
function withChatInputPickerMotion(listOptions) {
  return {
    anchorPosition: AnchorPosition.ABOVE,
    ...withActionWidgetDropdownMotion(listOptions)
  };
}
let ChatInputPickerActionViewItem = class extends ActionWidgetDropdownActionViewItem {
  constructor(action, actionWidgetOptions, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService) {
    const optionsWithAnchor = {
      ...actionWidgetOptions,
      getAnchor: () => this.getAnchorElement(),
      listOptions: withChatInputPickerMotion(actionWidgetOptions.listOptions)
    };
    super(action, optionsWithAnchor, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this.pickerOptions = pickerOptions;
    this._register(autorun((reader) => {
      const compact = this.pickerOptions.compact.read(reader);
      if (this.element) {
        this.element.classList.toggle("compact", compact);
        this.renderLabel(this.element);
      }
    }));
  }
  /**
   * Returns the anchor element for the dropdown.
   * Falls back to the overflow anchor if this element is not in the DOM.
   */
  getAnchorElement() {
    if (this.element && getActiveWindow().document.contains(this.element)) {
      return this.element;
    }
    return this.pickerOptions.getOverflowAnchor?.() ?? this.element;
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-input-picker-item");
    const compact = this.pickerOptions.compact.get();
    if (this.element) {
      this.element.classList.toggle("compact", compact);
      this.renderLabel(this.element);
    }
  }
};
ChatInputPickerActionViewItem = __decorateClass([
  __decorateParam(3, IActionWidgetService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, ITelemetryService)
], ChatInputPickerActionViewItem);
export {
  ChatInputPickerActionViewItem,
  withChatInputPickerMotion
};
