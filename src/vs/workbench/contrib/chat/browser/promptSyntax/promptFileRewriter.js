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
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { ILanguageModelToolsService } from "../../common/tools/languageModelToolsService.js";
import { PromptHeaderAttributes } from "../../common/promptSyntax/promptFileParser.js";
import { IPromptsService } from "../../common/promptSyntax/service/promptsService.js";
import { formatArrayValue } from "../../common/promptSyntax/utils/promptEditHelper.js";
let PromptFileRewriter = class {
  constructor(_codeEditorService, _promptsService, _languageModelToolsService) {
    this._codeEditorService = _codeEditorService;
    this._promptsService = _promptsService;
    this._languageModelToolsService = _languageModelToolsService;
  }
  async openAndRewriteTools(uri, newTools, token) {
    const editor = await this._codeEditorService.openCodeEditor({ resource: uri }, this._codeEditorService.getFocusedCodeEditor());
    if (!editor || !editor.hasModel()) {
      return;
    }
    const model = editor.getModel();
    const promptAST = this._promptsService.getParsedPromptFile(model);
    if (!promptAST.header) {
      return void 0;
    }
    const toolsAttr = promptAST.header.getAttribute(PromptHeaderAttributes.tools);
    if (!toolsAttr) {
      return void 0;
    }
    editor.setSelection(toolsAttr.range);
    if (newTools === void 0) {
      this.rewriteAttribute(model, "", toolsAttr.range);
      return;
    } else {
      this.rewriteTools(model, newTools, toolsAttr.value.range, toolsAttr.value.type === "scalar");
    }
  }
  rewriteTools(model, newTools, range, isString) {
    const newToolNames = this._languageModelToolsService.toFullReferenceNames(newTools);
    const newEntries = newToolNames.map((toolName) => formatArrayValue(toolName)).join(", ");
    const newValue = isString ? newEntries : `[${newEntries}]`;
    this.rewriteAttribute(model, newValue, range);
  }
  rewriteAttribute(model, newValue, range) {
    model.pushStackElement();
    model.pushEditOperations(null, [EditOperation.replaceMove(range, newValue)], () => null);
    model.pushStackElement();
  }
  async openAndRewriteName(uri, newName, token) {
    const editor = await this._codeEditorService.openCodeEditor({ resource: uri }, this._codeEditorService.getFocusedCodeEditor());
    if (!editor || !editor.hasModel()) {
      return;
    }
    const model = editor.getModel();
    const promptAST = this._promptsService.getParsedPromptFile(model);
    if (!promptAST.header) {
      return;
    }
    const nameAttr = promptAST.header.getAttribute(PromptHeaderAttributes.name);
    if (!nameAttr) {
      return;
    }
    if (nameAttr.value.type === "scalar" && nameAttr.value.value === newName) {
      return;
    }
    editor.setSelection(nameAttr.range);
    this.rewriteAttribute(model, newName, nameAttr.value.range);
  }
};
PromptFileRewriter = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IPromptsService),
  __decorateParam(2, ILanguageModelToolsService)
], PromptFileRewriter);
export {
  PromptFileRewriter
};
