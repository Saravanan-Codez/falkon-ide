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
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Event } from "../../../../../../base/common/event.js";
import { Disposable, RefCountedDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { assertType } from "../../../../../../base/common/types.js";
import { URI } from "../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { TextEdit } from "../../../../../../editor/common/languages.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../../../editor/common/model/textModel.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { DefaultModelSHA1Computer } from "../../../../../../editor/common/services/modelService.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../../nls.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { isResponseVM } from "../../../common/model/chatViewModel.js";
const $ = dom.$;
const ICodeCompareModelService = createDecorator("ICodeCompareModelService");
let ChatTextEditContentPart = class extends Disposable {
  constructor(chatTextEdit, context, rendererOptions, diffEditorPool, currentWidth, codeCompareModelService) {
    super();
    this.codeCompareModelService = codeCompareModelService;
    const element = context.element;
    assertType(isResponseVM(element));
    if (rendererOptions.renderTextEditsAsSummary?.(chatTextEdit.uri)) {
      if (element.response.value.every((item) => item.kind === "textEditGroup")) {
        this.domNode = $(".interactive-edits-summary", void 0, !element.isComplete ? "" : element.isCanceled ? localize("edits0", "Making changes was aborted.") : localize("editsSummary", "Made changes."));
      } else {
        this.domNode = $("div");
      }
    } else {
      const cts = new CancellationTokenSource();
      let isDisposed = false;
      this._register(toDisposable(() => {
        isDisposed = true;
        cts.dispose(true);
      }));
      this.comparePart = this._register(diffEditorPool.get());
      const data = {
        element,
        edit: chatTextEdit,
        diffData: (async () => {
          const ref = await this.codeCompareModelService.createModel(element, chatTextEdit);
          if (isDisposed) {
            ref.dispose();
            return;
          }
          this._register(ref);
          return {
            modified: ref.object.modified.textEditorModel,
            original: ref.object.original.textEditorModel,
            originalSha1: ref.object.originalSha1
          };
        })()
      };
      this.comparePart.object.render(data, currentWidth, cts.token);
      this.domNode = this.comparePart.object.element;
    }
  }
  layout(width) {
    this.comparePart?.object.layout(width);
  }
  hasSameContent(other) {
    return other.kind === "textEditGroup";
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatTextEditContentPart = __decorateClass([
  __decorateParam(5, ICodeCompareModelService)
], ChatTextEditContentPart);
let CodeCompareModelService = class {
  constructor(textModelService, modelService, chatService) {
    this.textModelService = textModelService;
    this.modelService = modelService;
    this.chatService = chatService;
  }
  async createModel(element, chatTextEdit) {
    const original = await this.textModelService.createModelReference(chatTextEdit.uri);
    const modified = await this.textModelService.createModelReference(this.modelService.createModel(
      createTextBufferFactoryFromSnapshot(original.object.textEditorModel.createSnapshot()),
      { languageId: original.object.textEditorModel.getLanguageId(), onDidChange: Event.None },
      URI.from({ scheme: Schemas.vscodeChatCodeBlock, path: chatTextEdit.uri.path, query: generateUuid() }),
      false
    ).uri);
    const d = new RefCountedDisposable(toDisposable(() => {
      original.dispose();
      modified.dispose();
    }));
    let originalSha1 = "";
    if (chatTextEdit.state) {
      originalSha1 = chatTextEdit.state.sha1;
    } else {
      const sha1 = new DefaultModelSHA1Computer();
      if (sha1.canComputeSHA1(original.object.textEditorModel)) {
        originalSha1 = sha1.computeSHA1(original.object.textEditorModel);
        chatTextEdit.state = { sha1: originalSha1, applied: 0 };
      }
    }
    const chatModel = this.chatService.getSession(element.sessionResource);
    const editGroups = [];
    for (const request of chatModel.getRequests()) {
      if (!request.response) {
        continue;
      }
      for (const item of request.response.response.value) {
        if (item.kind !== "textEditGroup" || item.state?.applied || !isEqual(item.uri, chatTextEdit.uri)) {
          continue;
        }
        for (const group of item.edits) {
          const edits = group.map(TextEdit.asEditOperation);
          editGroups.push(edits);
        }
      }
      if (request.response === element.model) {
        break;
      }
    }
    for (const edits of editGroups) {
      modified.object.textEditorModel.pushEditOperations(null, edits, () => null);
    }
    d.acquire();
    setTimeout(() => d.release(), 5e3);
    return {
      object: {
        originalSha1,
        original: original.object,
        modified: modified.object
      },
      dispose() {
        d.release();
      }
    };
  }
};
CodeCompareModelService = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService),
  __decorateParam(2, IChatService)
], CodeCompareModelService);
registerSingleton(ICodeCompareModelService, CodeCompareModelService, InstantiationType.Delayed);
export {
  ChatTextEditContentPart
};
