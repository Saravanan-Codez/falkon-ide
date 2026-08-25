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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { SimpleButton } from "../../find/browser/findWidget.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
let HoverCopyButton = class extends Disposable {
  constructor(_container, _getContent, _clipboardService, _hoverService) {
    super();
    this._container = _container;
    this._getContent = _getContent;
    this._clipboardService = _clipboardService;
    this._hoverService = _hoverService;
    this._container.classList.add("hover-row-with-copy");
    this._button = this._register(new SimpleButton({
      label: localize("hover.copy", "Copy"),
      icon: Codicon.copy,
      onTrigger: () => this._copyContent(),
      className: "hover-copy-button"
    }, this._hoverService));
    this._container.appendChild(this._button.domNode);
  }
  async _copyContent() {
    const content = this._getContent();
    if (content) {
      await this._clipboardService.writeText(content);
      status(localize("hover.copied", "Copied to clipboard"));
    }
  }
};
HoverCopyButton = __decorateClass([
  __decorateParam(2, IClipboardService),
  __decorateParam(3, IHoverService)
], HoverCopyButton);
export {
  HoverCopyButton
};
