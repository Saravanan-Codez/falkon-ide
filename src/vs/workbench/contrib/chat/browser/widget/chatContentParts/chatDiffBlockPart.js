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
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { hashAsync } from "../../../../../../base/common/hash.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { URI } from "../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { EditorModel } from "../../../../../common/editor/editorModel.js";
function parseUnifiedDiff(diffText) {
  const lines = diffText.split("\n");
  const beforeLines = [];
  const afterLines = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      beforeLines.push(line.substring(2));
    } else if (line.startsWith("-")) {
      beforeLines.push(line.substring(1));
    } else if (line.startsWith("+ ")) {
      afterLines.push(line.substring(2));
    } else if (line.startsWith("+")) {
      afterLines.push(line.substring(1));
    } else if (line.startsWith(" ")) {
      const content = line.substring(1);
      beforeLines.push(content);
      afterLines.push(content);
    } else if (!line.startsWith("@@") && !line.startsWith("---") && !line.startsWith("+++") && !line.startsWith("diff ")) {
      beforeLines.push(line);
      afterLines.push(line);
    }
  }
  return {
    before: beforeLines.join("\n"),
    after: afterLines.join("\n")
  };
}
class SimpleDiffEditorModel extends EditorModel {
  constructor(_original, _modified) {
    super();
    this._original = _original;
    this._modified = _modified;
    this.original = this._original.object.textEditorModel;
    this.modified = this._modified.object.textEditorModel;
  }
  dispose() {
    super.dispose();
    this._original.dispose();
    this._modified.dispose();
  }
}
let MarkdownDiffBlockPart = class extends Disposable {
  constructor(data, diffEditorPool, currentWidth, modelService, textModelService, languageService) {
    super();
    this.modelService = modelService;
    this.textModelService = textModelService;
    this.languageService = languageService;
    this.modelRef = this._register(new MutableDisposable());
    this.comparePart = this._register(diffEditorPool.get());
    const originalUri = URI.from({
      scheme: Schemas.vscodeChatCodeBlock,
      path: `/chat-diff-original-${data.codeBlockIndex}-${generateUuid()}`
    });
    const modifiedUri = URI.from({
      scheme: Schemas.vscodeChatCodeBlock,
      path: `/chat-diff-modified-${data.codeBlockIndex}-${generateUuid()}`
    });
    const languageSelection = this.languageService.createById(data.languageId);
    const originalModel = this.modelService.createModel(data.beforeContent, languageSelection, originalUri, false);
    const modifiedModel = this.modelService.createModel(data.afterContent, languageSelection, modifiedUri, false);
    const cts = new CancellationTokenSource();
    let referencesSettled = false;
    let disposeRequested = false;
    let didDisposeModels = false;
    const disposeModels = () => {
      if (didDisposeModels) {
        return;
      }
      didDisposeModels = true;
      originalModel.dispose();
      modifiedModel.dispose();
    };
    this._register(toDisposable(() => {
      disposeRequested = true;
      cts.dispose(true);
      if (referencesSettled) {
        disposeModels();
      }
    }));
    const modelsPromise = Promise.all([
      this.textModelService.createModelReference(originalUri),
      this.textModelService.createModelReference(modifiedUri)
    ]).then(([originalRef, modifiedRef]) => {
      referencesSettled = true;
      const model = new SimpleDiffEditorModel(originalRef, modifiedRef);
      if (disposeRequested) {
        model.dispose();
        disposeModels();
        return void 0;
      }
      return model;
    }, (error) => {
      referencesSettled = true;
      disposeModels();
      if (disposeRequested) {
        return void 0;
      }
      throw error;
    });
    const compareData = {
      element: data.element,
      isReadOnly: data.isReadOnly,
      horizontalPadding: data.horizontalPadding,
      edit: {
        uri: data.codeBlockResource || modifiedUri,
        edits: [],
        kind: "textEditGroup",
        done: true
      },
      diffData: modelsPromise.then(async (model) => {
        if (!model) {
          return void 0;
        }
        this.modelRef.value = model;
        const diffData = {
          original: model.original,
          modified: model.modified,
          originalSha1: await hashAsync(model.original.getValue())
        };
        return diffData;
      })
    };
    this.comparePart.object.render(compareData, currentWidth, cts.token);
    this.element = this.comparePart.object.element;
  }
  layout(width) {
    this.comparePart.object.layout(width);
  }
  reset() {
    this.modelRef.clear();
  }
};
MarkdownDiffBlockPart = __decorateClass([
  __decorateParam(3, IModelService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, ILanguageService)
], MarkdownDiffBlockPart);
export {
  MarkdownDiffBlockPart,
  parseUnifiedDiff
};
