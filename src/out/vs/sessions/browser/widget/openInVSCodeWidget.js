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
import "../media/openInVSCode.css";
import { $, append, EventHelper } from "../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { BaseActionViewItem } from "../../../base/browser/ui/actionbar/actionViewItems.js";
import { localize } from "../../../nls.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { IProductService } from "../../../platform/product/common/productService.js";
let OpenInVSCodeTitleBarWidget = class extends BaseActionViewItem {
  constructor(action, options, keybindingCommandId, productService, hoverService, keybindingService) {
    super(void 0, action, options);
    this.keybindingCommandId = keybindingCommandId;
    this.productService = productService;
    this.hoverService = hoverService;
    this.keybindingService = keybindingService;
  }
  render(container) {
    super.render(container);
    container.classList.add("open-in-vscode-titlebar-widget");
    container.setAttribute("role", "button");
    const quality = this.productService.quality;
    if (quality) {
      container.setAttribute("data-product-quality", quality);
    }
    const label = this.action.label;
    const hoverText = this.keybindingService.appendKeybinding(localize("openInVSCodeHover", "Open in VS Code Editor Window"), this.keybindingCommandId);
    container.setAttribute("aria-label", hoverText);
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), container, hoverText));
    const icon = append(container, $("span.open-in-vscode-titlebar-widget-icon"));
    icon.setAttribute("aria-hidden", "true");
    const labelEl = append(container, $("span.open-in-vscode-titlebar-widget-label"));
    labelEl.textContent = label;
  }
  onClick(event) {
    EventHelper.stop(event, true);
    this.action.run();
  }
};
OpenInVSCodeTitleBarWidget = __decorateClass([
  __decorateParam(3, IProductService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IKeybindingService)
], OpenInVSCodeTitleBarWidget);
export {
  OpenInVSCodeTitleBarWidget
};
