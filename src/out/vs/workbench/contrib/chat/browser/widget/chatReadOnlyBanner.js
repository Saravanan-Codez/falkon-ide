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
import "./media/chatReadOnlyBanner.css";
import * as dom from "../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
const CHAT_READ_ONLY_BANNER_HEIGHT = 26;
let ChatReadOnlyBanner = class extends Disposable {
  constructor(message = localize("chatReadOnlyBanner.archivedMessage", "Archived sessions are read-only."), hoverService) {
    super();
    this._visible = false;
    this.domNode = dom.$(".chat-readonly-banner");
    this.domNode.setAttribute("role", "status");
    const icon = dom.append(this.domNode, dom.$(".chat-readonly-banner-icon"));
    const renderedIcon = renderIcon(Codicon.lock);
    renderedIcon.setAttribute("aria-hidden", "true");
    icon.appendChild(renderedIcon);
    const text = dom.append(this.domNode, dom.$("span.chat-readonly-banner-text"));
    text.textContent = message;
    this._register(hoverService.setupDelayedHover(text, { content: message }));
    this.setVisible(false);
  }
  get visible() {
    return this._visible;
  }
  setVisible(visible) {
    this._visible = visible;
    this.domNode.classList.toggle("hidden", !visible);
  }
};
ChatReadOnlyBanner = __decorateClass([
  __decorateParam(1, IHoverService)
], ChatReadOnlyBanner);
export {
  CHAT_READ_ONLY_BANNER_HEIGHT,
  ChatReadOnlyBanner
};
