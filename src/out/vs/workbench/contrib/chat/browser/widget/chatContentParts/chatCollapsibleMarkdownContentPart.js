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
import { $ } from "../../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
let ChatCollapsibleMarkdownContentPart = class extends ChatCollapsibleContentPart {
  constructor(title, markdownContent, context, chatContentMarkdownRenderer, hoverService, configurationService) {
    super(title, context, void 0, hoverService, configurationService);
    this.markdownContent = markdownContent;
    this.chatContentMarkdownRenderer = chatContentMarkdownRenderer;
    this.icon = Codicon.check;
  }
  initContent() {
    const wrapper = $(".chat-collapsible-markdown-content.chat-used-context-list");
    if (this.markdownContent) {
      this.contentElement = $(".chat-collapsible-markdown-body");
      const rendered = this._register(this.chatContentMarkdownRenderer.render(new MarkdownString(this.markdownContent)));
      this.contentElement.appendChild(rendered.element);
      wrapper.appendChild(this.contentElement);
    }
    return wrapper;
  }
  hasSameContent(other, _followingContent, _element) {
    return false;
  }
};
ChatCollapsibleMarkdownContentPart = __decorateClass([
  __decorateParam(4, IHoverService),
  __decorateParam(5, IConfigurationService)
], ChatCollapsibleMarkdownContentPart);
export {
  ChatCollapsibleMarkdownContentPart
};
