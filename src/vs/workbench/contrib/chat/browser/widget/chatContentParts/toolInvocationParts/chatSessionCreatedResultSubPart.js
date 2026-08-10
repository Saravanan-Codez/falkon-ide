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
import * as dom from "../../../../../../../base/browser/dom.js";
import { Button } from "../../../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { IOpenerService } from "../../../../../../../platform/opener/common/opener.js";
import { defaultButtonStyles } from "../../../../../../../platform/theme/browser/defaultStyles.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import "../media/chatSessionCreatedResult.css";
let ChatSessionCreatedResultSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, data, _context, _renderer, openerService) {
    super(toolInvocation);
    this.data = data;
    this.openerService = openerService;
    this.codeblocks = [];
    this.domNode = dom.$(".chat-open-session-result");
    const button = this._register(new Button(this.domNode, {
      ...defaultButtonStyles,
      secondary: true,
      supportIcons: true,
      title: this.data.label
    }));
    button.element.classList.add("chat-open-session-button");
    button.label = `$(${this.getIcon().id}) ${this.data.label}`;
    this._register(button.onDidClick(() => {
      this.openerService.open(URI.parse(this.data.openLink), { fromUserGesture: true, allowContributedOpeners: true });
    }));
  }
  getIcon() {
    return this.data.isChat ? Codicon.commentDiscussion : Codicon.agent;
  }
};
ChatSessionCreatedResultSubPart = __decorateClass([
  __decorateParam(4, IOpenerService)
], ChatSessionCreatedResultSubPart);
export {
  ChatSessionCreatedResultSubPart
};
