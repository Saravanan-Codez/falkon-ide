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
import { renderAsPlaintext } from "../../../../../../../base/browser/markdownRenderer.js";
import { status } from "../../../../../../../base/browser/ui/aria/aria.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { localize } from "../../../../../../../nls.js";
import { AccessibilityWorkbenchSettingId } from "../../../../../accessibility/browser/accessibilityConfiguration.js";
import { ChatProgressSubPart } from "../chatProgressContentPart.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
const skipHref = "#skip";
let ChatOtherClientToolProgressPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, renderer, announcedToolProgressKeys, instantiationService, configurationService) {
    super(toolInvocation);
    this.codeblocks = [];
    const invocationMessage = typeof toolInvocation.invocationMessage === "string" ? toolInvocation.invocationMessage : renderAsPlaintext(toolInvocation.invocationMessage);
    const content = localize(
      "agentHost.otherClientTool.runningWithSkip",
      "{0} [Skip?](#skip)",
      escapeMarkdownSyntaxTokens(invocationMessage)
    );
    let cancelled = false;
    const rendered = this._register(renderer.render(new MarkdownString(content, { isTrusted: true }), {
      actionHandler: (href) => {
        if (href === skipHref && !cancelled) {
          cancelled = true;
          toolInvocation.otherClientToolCall?.cancel();
        }
      }
    }));
    const skipLink = rendered.element.querySelector(`a[data-href="${skipHref}"]`);
    if (skipLink) {
      skipLink.setAttribute("role", "button");
      skipLink.href = "";
    }
    const announcementKey = `progress:${toolInvocation.toolCallId}`;
    if (announcedToolProgressKeys && configurationService.getValue(AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates) && !announcedToolProgressKeys.has(announcementKey)) {
      announcedToolProgressKeys.add(announcementKey);
      status(localize("agentHost.otherClientTool.runningWithSkip.a11y", "{0} Skip?", invocationMessage));
    }
    this.domNode = this._register(instantiationService.createInstance(
      ChatProgressSubPart,
      rendered.element,
      Codicon.check,
      void 0
    )).domNode;
  }
};
ChatOtherClientToolProgressPart = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IConfigurationService)
], ChatOtherClientToolProgressPart);
export {
  ChatOtherClientToolProgressPart
};
