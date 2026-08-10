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
import * as dom from "../../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { createMarkdownCommandLink, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { IMarkdownRendererService, openLinkFromMarkdown } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { localize } from "../../../../../../nls.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { PromptsConfig } from "../../../common/promptSyntax/config/config.js";
import "./media/chatDisabledClaudeHooksContent.css";
let ChatDisabledClaudeHooksContentPart = class extends Disposable {
  constructor(_context, _openerService, _markdownRendererService) {
    super();
    this._openerService = _openerService;
    this._markdownRendererService = _markdownRendererService;
    this.domNode = dom.$(".chat-disabled-claude-hooks");
    const messageContainer = dom.$(".chat-disabled-claude-hooks-message");
    const icon = dom.$(".chat-disabled-claude-hooks-icon");
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));
    const enableLink = createMarkdownCommandLink({
      text: localize("chat.disabledClaudeHooks.enableLink", "Enable"),
      id: "workbench.action.openSettings",
      arguments: [PromptsConfig.USE_CLAUDE_HOOKS],
      tooltip: localize("chat.disabledClaudeHooks.enableLink.tooltip", "Open settings to enable Claude Code hooks")
    });
    const message = localize("chat.disabledClaudeHooks.message", "Claude Code hooks are available for this workspace. {0}", enableLink);
    const content = new MarkdownString(message, { isTrusted: true });
    const rendered = this._register(this._markdownRendererService.render(content, {
      actionHandler: (href) => openLinkFromMarkdown(this._openerService, href, true)
    }));
    messageContainer.appendChild(icon);
    messageContainer.appendChild(rendered.element);
    this.domNode.appendChild(messageContainer);
  }
  hasSameContent(other) {
    return other.kind === "disabledClaudeHooks";
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatDisabledClaudeHooksContentPart = __decorateClass([
  __decorateParam(1, IOpenerService),
  __decorateParam(2, IMarkdownRendererService)
], ChatDisabledClaudeHooksContentPart);
export {
  ChatDisabledClaudeHooksContentPart
};
