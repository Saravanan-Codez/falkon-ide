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
import { DropdownMenuActionViewItem } from "../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
let DropdownMenuActionViewItemWithKeybinding = class extends DropdownMenuActionViewItem {
  constructor(action, menuActionsOrProvider, contextMenuProvider, options = /* @__PURE__ */ Object.create(null), keybindingService, contextKeyService) {
    super(action, menuActionsOrProvider, contextMenuProvider, options);
    this.keybindingService = keybindingService;
    this.contextKeyService = contextKeyService;
  }
  getTooltip() {
    const tooltip = this.action.tooltip ?? this.action.label;
    return this.keybindingService.appendKeybinding(tooltip, this.action.id, this.contextKeyService);
  }
};
DropdownMenuActionViewItemWithKeybinding = __decorateClass([
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService)
], DropdownMenuActionViewItemWithKeybinding);
export {
  DropdownMenuActionViewItemWithKeybinding
};
