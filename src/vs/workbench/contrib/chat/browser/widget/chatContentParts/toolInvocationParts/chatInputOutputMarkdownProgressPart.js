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
import { ProgressBar } from "../../../../../../../base/browser/ui/progressbar/progressbar.js";
import { Lazy } from "../../../../../../../base/common/lazy.js";
import { toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { getExtensionForMimeType } from "../../../../../../../base/common/mime.js";
import { autorun } from "../../../../../../../base/common/observable.js";
import { basename } from "../../../../../../../base/common/resources.js";
import { ILanguageService } from "../../../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../../../editor/common/services/model.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { ChatResponseResource } from "../../../../common/model/chatModel.js";
import { IChatToolInvocation } from "../../../../common/chatService/chatService.js";
import { ChatCollapsibleInputOutputContentPart } from "../chatToolInputOutputContentPart.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import { getToolApprovalMessage, shouldShimmerForTool } from "./chatToolPartUtilities.js";
let ChatInputOutputMarkdownProgressPart = class extends BaseChatToolInvocationSubPart {
  static {
    /** Remembers expanded tool parts on re-render */
    this._expandedByDefault = /* @__PURE__ */ new WeakMap();
  }
  get codeblocks() {
    return this.collapsibleListPart.codeblocks;
  }
  constructor(toolInvocation, context, codeBlockStartIndex, message, subtitle, input, inputLanguage, output, isError, instantiationService, modelService, languageService) {
    super(toolInvocation);
    let codeBlockIndex = codeBlockStartIndex;
    const createCodePart = (data, languageId = "json") => ({
      kind: "code",
      data,
      languageId,
      codeBlockIndex: codeBlockIndex++,
      ownerMarkdownPartId: this.codeblocksPartId,
      options: {
        hideToolbar: true,
        reserveWidth: 19,
        maxHeightInLines: 13,
        verticalPadding: 5,
        editorOptions: {
          wordWrap: "on"
        }
      }
    });
    let processedOutput = output;
    if (typeof output === "string") {
      processedOutput = [{ type: "embed", value: output, isText: true }];
    }
    const collapsibleListPart = this.collapsibleListPart = this._register(instantiationService.createInstance(
      ChatCollapsibleInputOutputContentPart,
      message,
      subtitle,
      this.getAutoApproveMessageContent(),
      context,
      createCodePart(input, inputLanguage),
      processedOutput && processedOutput.length > 0 ? {
        parts: processedOutput.map((o, i) => {
          const permalinkBasename = o.type === "ref" || o.uri ? basename(o.uri) : o.mimeType && getExtensionForMimeType(o.mimeType) ? `file${getExtensionForMimeType(o.mimeType)}` : "file" + (o.isText ? ".txt" : ".bin");
          if (o.type === "ref") {
            return { kind: "data", uri: o.uri, mimeType: o.mimeType };
          } else if (o.isText && !o.asResource) {
            return createCodePart(o.value);
          } else {
            const permalinkUri = ChatResponseResource.createUri(context.element.sessionResource, toolInvocation.toolCallId, i, permalinkBasename);
            if (!o.isText) {
              return { kind: "data", base64Value: o.value, mimeType: o.mimeType, uri: permalinkUri, audience: o.audience };
            } else {
              return { kind: "data", value: new TextEncoder().encode(o.value), mimeType: o.mimeType, uri: permalinkUri, audience: o.audience };
            }
          }
        })
      } : void 0,
      isError,
      ChatInputOutputMarkdownProgressPart._expandedByDefault.get(toolInvocation) ?? false,
      shouldShimmerForTool(toolInvocation, message)
    ));
    this._register(toDisposable(() => ChatInputOutputMarkdownProgressPart._expandedByDefault.set(toolInvocation, collapsibleListPart.expanded)));
    const progressObservable = toolInvocation.kind === "toolInvocation" ? toolInvocation.state.map((s, r) => s.type === IChatToolInvocation.StateKind.Executing ? s.progress.read(r) : void 0) : void 0;
    const progressBar = new Lazy(() => this._register(new ProgressBar(collapsibleListPart.domNode)));
    if (progressObservable) {
      this._register(autorun((reader) => {
        const progress = progressObservable?.read(reader);
        if (progress?.message) {
          collapsibleListPart.title = progress.message;
        }
        if (progress?.progress && !IChatToolInvocation.isComplete(toolInvocation, reader)) {
          progressBar.value.setWorked(progress.progress * 100);
        }
      }));
    }
    this.domNode = collapsibleListPart.domNode;
  }
  getAutoApproveMessageContent() {
    return getToolApprovalMessage(this.toolInvocation);
  }
};
ChatInputOutputMarkdownProgressPart = __decorateClass([
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IModelService),
  __decorateParam(11, ILanguageService)
], ChatInputOutputMarkdownProgressPart);
export {
  ChatInputOutputMarkdownProgressPart
};
