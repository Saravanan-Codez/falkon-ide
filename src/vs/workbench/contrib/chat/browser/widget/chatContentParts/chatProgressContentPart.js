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
import { $, append, isHTMLElement } from "../../../../../../base/browser/dom.js";
import { renderAsPlaintext } from "../../../../../../base/browser/markdownRenderer.js";
import { alert } from "../../../../../../base/browser/ui/aria/aria.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { stripIcons } from "../../../../../../base/common/iconLabels.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { localize } from "../../../../../../nls.js";
import { IChatToolInvocation } from "../../../common/chatService/chatService.js";
import { isResponseVM } from "../../../common/model/chatViewModel.js";
import { renderFileWidgets } from "./chatInlineAnchorWidget.js";
import { getToolApprovalMessage, isAskQuestionsToolInvocation } from "./toolInvocationParts/chatToolPartUtilities.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { AccessibilityWorkbenchSettingId } from "../../../../accessibility/browser/accessibilityConfiguration.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { HoverStyle } from "../../../../../../base/browser/ui/hover/hover.js";
import { ILanguageModelToolsService } from "../../../common/tools/languageModelToolsService.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { buildPhrasePool, defaultThinkingMessages, maybePickFunWorkingMessage } from "./chatThinkingContentPart.js";
let ChatProgressContentPart = class extends Disposable {
  constructor(progress, chatContentMarkdownRenderer, context, forceShowSpinner, forceShowMessage, icon, toolInvocation, shimmer, instantiationService, chatMarkdownAnchorService, configurationService) {
    super();
    this.chatContentMarkdownRenderer = chatContentMarkdownRenderer;
    this.toolInvocation = toolInvocation;
    this.instantiationService = instantiationService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this.configurationService = configurationService;
    this.renderedMessage = this._register(new MutableDisposable());
    this._fileWidgetStore = this._register(new DisposableStore());
    this.currentContent = progress.content;
    const followingContent = context.content.slice(context.contentIndex + 1);
    this.showSpinner = forceShowSpinner ?? shouldShowSpinner(followingContent, context.element);
    this.isHidden = forceShowMessage !== true && followingContent.some((part) => part.kind !== "progressMessage");
    if (this.isHidden) {
      this.domNode = $("");
      return;
    }
    if (this.showSpinner && this.configurationService.getValue(AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates)) {
      alert(stripIcons(renderAsPlaintext(progress.content)));
    }
    const isLoadingIcon = icon && ThemeIcon.isEqual(icon, ThemeIcon.modify(Codicon.loading, "spin"));
    const useShimmer = (shimmer ?? (!icon || isLoadingIcon)) && this.showSpinner;
    const codicon = useShimmer ? Codicon.check : icon ?? (this.showSpinner ? ThemeIcon.modify(Codicon.loading, "spin") : Codicon.check);
    const result = this.chatContentMarkdownRenderer.render(progress.content);
    result.element.classList.add("progress-step");
    renderFileWidgets(result.element, this.instantiationService, this.chatMarkdownAnchorService, this._fileWidgetStore);
    if (useShimmer) {
      syncShimmerPhase(this.applyShimmer(result.element));
    }
    const tooltip = this.createApprovalMessage();
    const progressPart = this._register(instantiationService.createInstance(ChatProgressSubPart, result.element, codicon, tooltip));
    this.domNode = progressPart.domNode;
    if (useShimmer) {
      this.domNode.classList.add("shimmer-progress");
    }
    this.renderedMessage.value = result;
  }
  /**
   * Applies the shimmer treatment and returns the elements that actually animate, so their
   * animation phase can be synced. A partial shimmer wraps only the leading verb in spans;
   * otherwise the whole message paragraph shimmers.
   */
  applyShimmer(element) {
    const firstChild = element.firstElementChild;
    const messageElement = isHTMLElement(firstChild) && firstChild.tagName === "P" ? firstChild : element;
    const boundary = this.toolInvocation ? this.computeShimmerBoundary(messageElement) : -1;
    if (boundary <= 0) {
      return [messageElement];
    }
    element.classList.add("chat-progress-partial-shimmer");
    return this.wrapLeadingText(messageElement, boundary);
  }
  /**
   * How many leading characters of the progress message should shimmer. Ask-question rows
   * shimmer everything before the ` (` summary; streaming rows shimmer only the stable leading
   * verb so moving parts (line counts, file names) stay still. Non-positive skips partial shimmer.
   */
  computeShimmerBoundary(messageElement) {
    if (isAskQuestionsToolInvocation(this.toolInvocation)) {
      return messageElement.textContent?.indexOf(" (") ?? -1;
    }
    if (IChatToolInvocation.isStreaming(this.toolInvocation)) {
      return leadingStableTextLength(messageElement);
    }
    return -1;
  }
  wrapLeadingText(element, length) {
    const spans = [];
    let remaining = length;
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (remaining > 0) {
      const node = walker.nextNode();
      if (!node) {
        return spans;
      }
      const text = node.nodeValue ?? "";
      if (!text) {
        continue;
      }
      const shimmerText = text.slice(0, remaining);
      const suffixText = text.slice(remaining);
      const span = element.ownerDocument.createElement("span");
      span.classList.add("chat-progress-shimmer-text");
      span.textContent = shimmerText;
      node.parentNode?.insertBefore(span, node);
      if (suffixText) {
        node.nodeValue = suffixText;
      } else {
        node.parentNode?.removeChild(node);
      }
      spans.push(span);
      remaining -= shimmerText.length;
    }
    return spans;
  }
  updateMessage(content) {
    if (this.isHidden) {
      return;
    }
    const result = this._register(this.chatContentMarkdownRenderer.render(content));
    result.element.classList.add("progress-step");
    this._fileWidgetStore.clear();
    renderFileWidgets(result.element, this.instantiationService, this.chatMarkdownAnchorService, this._fileWidgetStore);
    if (this.renderedMessage.value) {
      this.renderedMessage.value.element.replaceWith(result.element);
    } else {
      this.domNode.appendChild(result.element);
    }
    this.renderedMessage.value = result;
  }
  hasSameContent(other, followingContent, element) {
    if (followingContent.some((part) => part.kind !== "progressMessage") && !this.isHidden) {
      return false;
    }
    const showSpinner = shouldShowSpinner(followingContent, element);
    if (other.kind === "progressMessage" && other.content.value !== this.currentContent.value) {
      return false;
    }
    return other.kind === "progressMessage" && this.showSpinner === showSpinner;
  }
  createApprovalMessage() {
    return this.toolInvocation && getToolApprovalMessage(this.toolInvocation);
  }
};
ChatProgressContentPart = __decorateClass([
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IChatMarkdownAnchorService),
  __decorateParam(10, IConfigurationService)
], ChatProgressContentPart);
function shouldShowSpinner(followingContent, element) {
  return isResponseVM(element) && !element.isComplete && followingContent.length === 0;
}
function leadingStableTextLength(messageElement) {
  const fullText = messageElement.textContent ?? "";
  let length = 0;
  for (const node of messageElement.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue ?? "";
      const movingPart = /[(\d]/.exec(nodeText);
      if (movingPart) {
        length += movingPart.index;
        break;
      }
      length += nodeText.length;
    } else {
      break;
    }
  }
  while (length > 0 && /\s/.test(fullText[length - 1])) {
    length--;
  }
  return length;
}
const SHIMMER_ANIMATION_DURATION_MS = 2e3;
const shimmerEpochMs = Date.now();
function syncShimmerPhase(animatedElements) {
  const animationDelay = `-${(Date.now() - shimmerEpochMs) % SHIMMER_ANIMATION_DURATION_MS}ms`;
  for (const element of animatedElements) {
    element.style.animationDelay = animationDelay;
  }
}
let ChatProgressSubPart = class extends Disposable {
  constructor(messageElement, icon, tooltip, hoverService) {
    super();
    this.domNode = $(".progress-container");
    const iconElement = $("div");
    iconElement.classList.add(...ThemeIcon.asClassNameArray(icon));
    if (tooltip) {
      this._register(hoverService.setupDelayedHover(iconElement, {
        content: tooltip,
        style: HoverStyle.Pointer
      }));
      this._register(hoverService.setupDelayedHover(messageElement, {
        content: tooltip,
        style: HoverStyle.Pointer
      }));
    }
    append(this.domNode, iconElement);
    messageElement.classList.add("progress-step");
    append(this.domNode, messageElement);
  }
};
ChatProgressSubPart = __decorateClass([
  __decorateParam(3, IHoverService)
], ChatProgressSubPart);
const WORKING_LABEL_MIN_DWELL_MS = 1200;
const lastPickedWorkingLabelByElement = /* @__PURE__ */ new Map();
function pickWorkingLabel(elementId, configurationService) {
  const now = Date.now();
  for (const [id, entry] of lastPickedWorkingLabelByElement) {
    if (now - entry.pickedAt >= WORKING_LABEL_MIN_DWELL_MS) {
      lastPickedWorkingLabelByElement.delete(id);
    }
  }
  const existing = lastPickedWorkingLabelByElement.get(elementId);
  if (existing && now - existing.pickedAt < WORKING_LABEL_MIN_DWELL_MS) {
    existing.pickedAt = now;
    return existing.label;
  }
  const fun = maybePickFunWorkingMessage(configurationService);
  const label = fun ?? (() => {
    const pool = buildPhrasePool(defaultThinkingMessages, configurationService);
    return pool[Math.floor(Math.random() * pool.length)];
  })();
  lastPickedWorkingLabelByElement.set(elementId, { label, pickedAt: now });
  return label;
}
let ChatWorkingProgressContentPart = class extends ChatProgressContentPart {
  constructor(workingProgress, chatContentMarkdownRenderer, context, instantiationService, chatMarkdownAnchorService, configurationService, languageModelToolsService) {
    const explicitContent = workingProgress.content;
    const progressMessage = {
      kind: "progressMessage",
      content: explicitContent ?? new MarkdownString().appendText(pickWorkingLabel(context.element.id, configurationService))
    };
    super(progressMessage, chatContentMarkdownRenderer, context, void 0, void 0, void 0, void 0, true, instantiationService, chatMarkdownAnchorService, configurationService);
    this.explicitContent = explicitContent;
    this._register(languageModelToolsService.onDidPrepareToolCallBecomeUnresponsive((e) => {
      if (isEqual(context.element.sessionResource, e.sessionResource)) {
        this.updateMessage(new MarkdownString(localize("toolCallUnresponsive", "Waiting for tool '{0}' to respond...", e.toolData.displayName)));
      }
    }));
  }
  updateWorkingContent(content) {
    this.explicitContent = content;
    this.updateMessage(content);
  }
  hasSameContent(other, followingContent, element) {
    return other.kind === "working" && other.content?.value === this.explicitContent?.value;
  }
};
ChatWorkingProgressContentPart = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IChatMarkdownAnchorService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILanguageModelToolsService)
], ChatWorkingProgressContentPart);
export {
  ChatProgressContentPart,
  ChatProgressSubPart,
  ChatWorkingProgressContentPart
};
