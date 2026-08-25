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
import { renderAsPlaintext } from "../../../../../../../base/browser/markdownRenderer.js";
import { status } from "../../../../../../../base/browser/ui/aria/aria.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { stripIcons } from "../../../../../../../base/common/iconLabels.js";
import { autorun } from "../../../../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
import { AccessibilityWorkbenchSettingId } from "../../../../../accessibility/browser/accessibilityConfiguration.js";
import { ChatProgressContentPart } from "../chatProgressContentPart.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import { shouldShimmerForTool } from "./chatToolPartUtilities.js";
let ChatToolProgressSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, context, renderer, announcedToolProgressKeys, instantiationService, configurationService) {
    super(toolInvocation);
    this.context = context;
    this.renderer = renderer;
    this.announcedToolProgressKeys = announcedToolProgressKeys;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.codeblocks = [];
    this.domNode = this.createProgressPart();
  }
  createProgressPart() {
    const isComplete = IChatToolInvocation.isComplete(this.toolInvocation);
    if (isComplete && this.toolIsConfirmed && (this.toolInvocation.pastTenseMessage || this.toolInvocation.invocationMessage)) {
      const key = this.getAnnouncementKey("complete");
      const completionContent = this.toolInvocation.pastTenseMessage ?? this.toolInvocation.invocationMessage;
      if (!this.hasMeaningfulContent(completionContent)) {
        return document.createElement("div");
      }
      const shouldAnnounce = this.toolInvocation.kind === "toolInvocation" && this.hasMeaningfulContent(completionContent) ? this.computeShouldAnnounce(key) : false;
      const part = this.renderProgressContent(completionContent, shouldAnnounce);
      this._register(part);
      return part.domNode;
    } else {
      const container = document.createElement("div");
      this._register(autorun((reader) => {
        let progressContent;
        const key = this.getAnnouncementKey("progress");
        if (this.toolInvocation.kind === "toolInvocation") {
          const state = this.toolInvocation.state.read(reader);
          if (state.type === IChatToolInvocation.StateKind.Cancelled && state.reasonMessage) {
            progressContent = state.reasonMessage;
          } else if (state.type === IChatToolInvocation.StateKind.Executing) {
            const progressMessage = state.progress.read(reader)?.message;
            progressContent = this.hasMeaningfulContent(progressMessage) ? progressMessage : this.toolInvocation.invocationMessage;
          } else {
            progressContent = this.toolInvocation.invocationMessage;
          }
        } else {
          progressContent = this.toolInvocation.invocationMessage;
        }
        if (!this.hasMeaningfulContent(progressContent)) {
          dom.clearNode(container);
          return;
        }
        const shouldAnnounce = this.toolInvocation.kind === "toolInvocation" && this.hasMeaningfulContent(progressContent) ? this.computeShouldAnnounce(key) : false;
        const part = reader.store.add(this.renderProgressContent(progressContent, shouldAnnounce));
        dom.reset(container, part.domNode);
      }));
      return container;
    }
  }
  get toolIsConfirmed() {
    const c = IChatToolInvocation.executionConfirmedOrDenied(this.toolInvocation);
    return !!c && c.type !== ToolConfirmKind.Denied;
  }
  renderProgressContent(content, shouldAnnounce) {
    if (typeof content === "string") {
      content = new MarkdownString().appendText(content);
    }
    const progressMessage = {
      kind: "progressMessage",
      content
    };
    if (shouldAnnounce) {
      this.provideScreenReaderStatus(content);
    }
    const shouldShimmer = shouldShimmerForTool(this.toolInvocation, content);
    return this.instantiationService.createInstance(ChatProgressContentPart, progressMessage, this.renderer, this.context, shouldShimmer ? true : void 0, true, this.getProgressIcon(), this.toolInvocation, shouldShimmer);
  }
  getAnnouncementKey(kind) {
    return `${kind}:${this.toolInvocation.toolCallId}`;
  }
  computeShouldAnnounce(key) {
    if (!this.announcedToolProgressKeys) {
      return false;
    }
    if (!this.configurationService.getValue(AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates)) {
      return false;
    }
    if (this.announcedToolProgressKeys.has(key)) {
      return false;
    }
    this.announcedToolProgressKeys.add(key);
    return true;
  }
  provideScreenReaderStatus(content) {
    const message = typeof content === "string" ? content : stripIcons(renderAsPlaintext(content, { useLinkFormatter: true }));
    status(message);
  }
  hasMeaningfulContent(content) {
    if (!content) {
      return false;
    }
    const text = typeof content === "string" ? content : content.value;
    return text.trim().length > 0;
  }
};
ChatToolProgressSubPart = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService)
], ChatToolProgressSubPart);
export {
  ChatToolProgressSubPart
};
