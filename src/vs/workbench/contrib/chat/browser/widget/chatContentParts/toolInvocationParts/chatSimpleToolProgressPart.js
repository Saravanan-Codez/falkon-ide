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
import { autorun } from "../../../../../../../base/common/observable.js";
import { ILanguageService } from "../../../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../../../editor/common/services/model.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IChatToolInvocation } from "../../../../common/chatService/chatService.js";
import { ChatCollapsibleInputOutputContentPart } from "../chatToolInputOutputContentPart.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import { getToolApprovalMessage, shouldShimmerForTool } from "./chatToolPartUtilities.js";
let ChatSimpleToolProgressPart = class extends BaseChatToolInvocationSubPart {
  static {
    /** Remembers expanded tool parts on re-render */
    this._expandedByDefault = /* @__PURE__ */ new WeakMap();
  }
  get codeblocks() {
    return this.collapsibleListPart.codeblocks;
  }
  constructor(toolInvocation, context, codeBlockStartIndex, message, subtitle, data, isError, instantiationService, modelService, languageService) {
    super(toolInvocation);
    let codeBlockIndex = codeBlockStartIndex;
    const createIOPart = (content, label) => {
      return {
        kind: "code",
        data: content,
        languageId: "plaintext",
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
      };
    };
    const inputPart = createIOPart(data.input, "Input");
    const outputParts = data.output ? [createIOPart(data.output, "Output")] : void 0;
    const collapsibleListPart = this.collapsibleListPart = this._register(instantiationService.createInstance(
      ChatCollapsibleInputOutputContentPart,
      message,
      subtitle,
      this.getAutoApprovalMessageContent(),
      context,
      inputPart,
      outputParts ? { parts: outputParts } : void 0,
      isError,
      ChatSimpleToolProgressPart._expandedByDefault.get(toolInvocation) ?? false,
      shouldShimmerForTool(toolInvocation, message)
    ));
    this._register(toDisposable(() => ChatSimpleToolProgressPart._expandedByDefault.set(toolInvocation, collapsibleListPart.expanded)));
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
  getAutoApprovalMessageContent() {
    return getToolApprovalMessage(this.toolInvocation);
  }
};
ChatSimpleToolProgressPart = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IModelService),
  __decorateParam(9, ILanguageService)
], ChatSimpleToolProgressPart);
export {
  ChatSimpleToolProgressPart
};
