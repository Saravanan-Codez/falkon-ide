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
import * as objects from "../../../../base/common/objects.js";
import { ICodeEditorService } from "../../services/codeEditorService.js";
import { DiffEditorWidget } from "./diffEditorWidget.js";
import { IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
let EmbeddedDiffEditorWidget = class extends DiffEditorWidget {
  constructor(domElement, options, codeEditorWidgetOptions, parentEditor, contextKeyService, instantiationService, codeEditorService, accessibilitySignalService, editorProgressService) {
    super(domElement, parentEditor.getRawOptions(), codeEditorWidgetOptions, contextKeyService, instantiationService, codeEditorService, accessibilitySignalService, editorProgressService);
    this._parentEditor = parentEditor;
    this._overwriteOptions = options;
    super.updateOptions(this._overwriteOptions);
    this._register(parentEditor.onDidChangeConfiguration((e) => this._onParentConfigurationChanged(e)));
  }
  getParentEditor() {
    return this._parentEditor;
  }
  _onParentConfigurationChanged(e) {
    super.updateOptions(this._parentEditor.getRawOptions());
    super.updateOptions(this._overwriteOptions);
  }
  updateOptions(newOptions) {
    objects.mixin(this._overwriteOptions, newOptions, true);
    super.updateOptions(this._overwriteOptions);
  }
};
EmbeddedDiffEditorWidget = __decorateClass([
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ICodeEditorService),
  __decorateParam(7, IAccessibilitySignalService),
  __decorateParam(8, IEditorProgressService)
], EmbeddedDiffEditorWidget);
export {
  EmbeddedDiffEditorWidget
};
