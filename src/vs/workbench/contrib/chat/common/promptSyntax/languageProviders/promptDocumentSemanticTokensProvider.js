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
import { getPromptsTypeForLanguageId } from "../promptTypes.js";
import { IPromptsService } from "../service/promptsService.js";
import { getTarget, isVSCodeOrDefaultTarget } from "./promptFileAttributes.js";
let PromptDocumentSemanticTokensProvider = class {
  constructor(promptsService) {
    this.promptsService = promptsService;
    /**
     * Debug display name for this provider.
     */
    this._debugDisplayName = "PromptDocumentSemanticTokensProvider";
  }
  provideDocumentSemanticTokens(model, lastResultId, token) {
    const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
    if (!promptType) {
      return void 0;
    }
    const promptAST = this.promptsService.getParsedPromptFile(model);
    if (!promptAST.body) {
      return void 0;
    }
    const target = getTarget(promptType, promptAST.header ?? model.uri);
    if (!isVSCodeOrDefaultTarget(target)) {
      return void 0;
    }
    const variableReferences = promptAST.body.variableReferences;
    if (!variableReferences.length) {
      return void 0;
    }
    const data = [];
    let lastLine = 0;
    let lastChar = 0;
    const ordered = [...variableReferences].sort((a, b) => a.range.startLineNumber === b.range.startLineNumber ? a.range.startColumn - b.range.startColumn : a.range.startLineNumber - b.range.startLineNumber);
    for (const ref of ordered) {
      const extraCharCount = "#tool:".length;
      const line = ref.range.startLineNumber - 1;
      const char = ref.range.startColumn - extraCharCount - 1;
      const length = ref.range.endColumn - ref.range.startColumn + extraCharCount;
      const deltaLine = line - lastLine;
      const deltaChar = deltaLine === 0 ? char - lastChar : char;
      data.push(
        deltaLine,
        deltaChar,
        length,
        0,
        0
        /* no modifiers */
      );
      lastLine = line;
      lastChar = char;
      if (token.isCancellationRequested) {
        break;
      }
    }
    return { data: new Uint32Array(data) };
  }
  getLegend() {
    return { tokenTypes: ["variable"], tokenModifiers: [] };
  }
  releaseDocumentSemanticTokens(resultId) {
  }
};
PromptDocumentSemanticTokensProvider = __decorateClass([
  __decorateParam(0, IPromptsService)
], PromptDocumentSemanticTokensProvider);
export {
  PromptDocumentSemanticTokensProvider
};
