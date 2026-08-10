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
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { autorun } from "../../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IChatToolInvocation } from "../../../../common/chatService/chatService.js";
import { ChatProgressContentPart } from "../chatProgressContentPart.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
let ChatToolStreamingSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, context, renderer, instantiationService) {
    super(toolInvocation);
    this.context = context;
    this.renderer = renderer;
    this.instantiationService = instantiationService;
    this.codeblocks = [];
    this.domNode = this.createStreamingPart();
  }
  createStreamingPart() {
    const container = document.createElement("div");
    if (this.toolInvocation.kind !== "toolInvocation") {
      return container;
    }
    const toolInvocation = this.toolInvocation;
    const state = toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.Streaming) {
      return container;
    }
    this._register(autorun((reader) => {
      const currentState = toolInvocation.state.read(reader);
      if (currentState.type !== IChatToolInvocation.StateKind.Streaming) {
        dom.clearNode(container);
        this._onNeedsRerender.fire();
        return;
      }
      const streamingMessage = currentState.streamingMessage.read(reader);
      const displayMessage = streamingMessage ?? toolInvocation.invocationMessage;
      const messageText = typeof displayMessage === "string" ? displayMessage : displayMessage.value;
      if (!messageText || messageText.trim().length === 0) {
        dom.clearNode(container);
        return;
      }
      const content = typeof displayMessage === "string" ? new MarkdownString().appendText(displayMessage) : displayMessage;
      const progressMessage = {
        kind: "progressMessage",
        content
      };
      const shimmer = !toolInvocation.isAttachedToThinking;
      const part = reader.store.add(this.instantiationService.createInstance(
        ChatProgressContentPart,
        progressMessage,
        this.renderer,
        this.context,
        shimmer ? true : void 0,
        true,
        this.getProgressIcon(),
        toolInvocation,
        shimmer
      ));
      dom.reset(container, part.domNode);
    }));
    return container;
  }
};
ChatToolStreamingSubPart = __decorateClass([
  __decorateParam(3, IInstantiationService)
], ChatToolStreamingSubPart);
export {
  ChatToolStreamingSubPart
};
