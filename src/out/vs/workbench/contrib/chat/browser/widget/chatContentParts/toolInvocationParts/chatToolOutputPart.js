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
import { renderMarkdown } from "../../../../../../../base/browser/markdownRenderer.js";
import { decodeBase64 } from "../../../../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { isCancellationError } from "../../../../../../../base/common/errors.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { localize } from "../../../../../../../nls.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IChatToolInvocation } from "../../../../common/chatService/chatService.js";
import { IChatOutputRendererService } from "../../../chatOutputItemRenderer.js";
import { ChatProgressSubPart } from "../chatProgressContentPart.js";
import { IChatOutputPartStateCache } from "../chatOutputPartStateCache.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
let ChatToolOutputSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, context, onDidRemount, chatOutputItemRendererService, instantiationService, stateCache) {
    super(toolInvocation);
    this.context = context;
    this.onDidRemount = onDidRemount;
    this.chatOutputItemRendererService = chatOutputItemRendererService;
    this.instantiationService = instantiationService;
    this.stateCache = stateCache;
    this.codeblocks = [];
    this._disposeCts = this._register(new CancellationTokenSource());
    const details = toolInvocation.kind === "toolInvocation" ? IChatToolInvocation.resultDetails(toolInvocation) : {
      output: {
        type: "data",
        mimeType: toolInvocation.resultDetails.output.mimeType,
        value: decodeBase64(toolInvocation.resultDetails.output.base64Data)
      }
    };
    this.domNode = dom.$("div.tool-output-part");
    if (toolInvocation.invocationMessage) {
      const titleEl = dom.$(".output-title");
      this.domNode.appendChild(titleEl);
      if (typeof toolInvocation.invocationMessage === "string") {
        titleEl.textContent = toolInvocation.invocationMessage;
      } else {
        const md = this._register(renderMarkdown(toolInvocation.invocationMessage));
        titleEl.appendChild(md.element);
      }
    }
    this.domNode.appendChild(this.createOutputPart(toolInvocation, details));
  }
  dispose() {
    this._disposeCts.dispose(true);
    super.dispose();
  }
  createOutputPart(toolInvocation, details) {
    const parent = dom.$("div.webview-output");
    parent.style.maxHeight = "80vh";
    const partState = this.stateCache.get(toolInvocation.toolCallId) ?? { height: 0 };
    this.stateCache.set(toolInvocation.toolCallId, partState);
    if (partState.height) {
      parent.style.height = `${partState.height}px`;
    }
    const progressMessage = dom.$("span");
    progressMessage.textContent = localize("loading", "Rendering tool output...");
    const progressPart = this._register(this.instantiationService.createInstance(ChatProgressSubPart, progressMessage, ThemeIcon.modify(Codicon.loading, "spin"), void 0));
    parent.appendChild(progressPart.domNode);
    this.chatOutputItemRendererService.renderOutputPart(details.output.mimeType, details.output.value.buffer, parent, {
      webviewState: partState.webviewState,
      chatSessionResource: this.context.element.sessionResource
    }, this._disposeCts.token).then((renderedItem) => {
      if (this._disposeCts.token.isCancellationRequested) {
        return;
      }
      this._register(renderedItem);
      progressPart.domNode.remove();
      this._register(renderedItem.webview.onDidUpdateState((e) => {
        partState.webviewState = e;
      }));
      this._register(renderedItem.onDidChangeHeight((newHeight) => {
        partState.height = newHeight;
      }));
      this._register(this.context.onDidChangeVisibility((visible) => {
        if (visible) {
          renderedItem.reinitialize();
        }
      }));
      this._register(this.onDidRemount(() => {
        renderedItem.reinitialize();
      }));
    }, (error) => {
      if (isCancellationError(error)) {
        return;
      }
      console.error("Error rendering tool output:", error);
      const errorNode = dom.$(".output-error");
      const errorHeaderNode = dom.$(".output-error-header");
      dom.append(errorNode, errorHeaderNode);
      const iconElement = dom.$("div");
      iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.error));
      errorHeaderNode.append(iconElement);
      const errorTitleNode = dom.$(".output-error-title");
      errorTitleNode.textContent = localize("chat.toolOutputError", "Error rendering the tool output");
      errorHeaderNode.append(errorTitleNode);
      const errorMessageNode = dom.$(".output-error-details");
      errorMessageNode.textContent = error?.message || String(error);
      errorNode.append(errorMessageNode);
      progressPart.domNode.replaceWith(errorNode);
    });
    return parent;
  }
};
ChatToolOutputSubPart = __decorateClass([
  __decorateParam(3, IChatOutputRendererService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IChatOutputPartStateCache)
], ChatToolOutputSubPart);
export {
  ChatToolOutputSubPart
};
