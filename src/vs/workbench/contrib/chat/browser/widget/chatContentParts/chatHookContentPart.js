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
import { localize } from "../../../../../../nls.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { HookType, HOOK_METADATA } from "../../../common/promptSyntax/hookTypes.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
import "./media/chatHookContentPart.css";
function getHookTypeLabel(hookType) {
  return HOOK_METADATA[hookType]?.label ?? hookType;
}
let ChatHookContentPart = class extends ChatCollapsibleContentPart {
  constructor(hookPart, context, hoverService, configurationService) {
    const hookTypeLabel = getHookTypeLabel(hookPart.hookType);
    const isStopped = !!hookPart.stopReason;
    const isWarning = !!hookPart.systemMessage;
    const toolName = hookPart.toolDisplayName;
    const title = isStopped ? toolName ? localize("hook.title.stoppedWithTool", "Blocked {0} - {1} hook", toolName, hookTypeLabel) : localize("hook.title.stopped", "Blocked by {0} hook", hookTypeLabel) : toolName ? localize("hook.title.warningWithTool", "Warning for {0} - {1} hook", toolName, hookTypeLabel) : localize("hook.title.warning", "Warning from {0} hook", hookTypeLabel);
    super(title, context, void 0, hoverService, configurationService);
    this.hookPart = hookPart;
    this.icon = isStopped ? Codicon.error : isWarning ? Codicon.warning : Codicon.check;
    if (isStopped) {
      this.domNode.classList.add("chat-hook-outcome-blocked");
    } else if (isWarning) {
      this.domNode.classList.add("chat-hook-outcome-warning");
    }
    this.setExpanded(false);
  }
  initContent() {
    const content = $(".chat-hook-details.chat-used-context-list");
    if (this.hookPart.stopReason) {
      const reasonElement = $(".chat-hook-reason", void 0, this.hookPart.stopReason);
      content.appendChild(reasonElement);
    }
    const isToolHook = this.hookPart.hookType === HookType.PreToolUse || this.hookPart.hookType === HookType.PostToolUse;
    if (this.hookPart.systemMessage && (isToolHook || !this.hookPart.stopReason)) {
      const messageElement = $(".chat-hook-message", void 0, this.hookPart.systemMessage);
      content.appendChild(messageElement);
    }
    return content;
  }
  hasSameContent(other, _followingContent, _element) {
    if (other.kind !== "hook") {
      return false;
    }
    return other.hookType === this.hookPart.hookType && other.stopReason === this.hookPart.stopReason && other.systemMessage === this.hookPart.systemMessage && other.toolDisplayName === this.hookPart.toolDisplayName;
  }
};
ChatHookContentPart = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IConfigurationService)
], ChatHookContentPart);
export {
  ChatHookContentPart
};
