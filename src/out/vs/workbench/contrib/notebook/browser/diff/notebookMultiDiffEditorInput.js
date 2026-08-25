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
import { URI } from "../../../../../base/common/uri.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { MultiDiffEditorInput } from "../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { IMultiDiffSourceResolverService } from "../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { NotebookDiffEditorInput } from "../../common/notebookDiffEditorInput.js";
import { NotebookEditorInput } from "../../common/notebookEditorInput.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
const NotebookMultiDiffEditorScheme = "multi-cell-notebook-diff-editor";
class NotebookMultiDiffEditorInput extends NotebookDiffEditorInput {
  static {
    this.ID = "workbench.input.multiDiffNotebookInput";
  }
  static create(instantiationService, resource, name, description, originalResource, viewType) {
    const original = NotebookEditorInput.getOrCreate(instantiationService, originalResource, void 0, viewType);
    const modified = NotebookEditorInput.getOrCreate(instantiationService, resource, void 0, viewType);
    return instantiationService.createInstance(NotebookMultiDiffEditorInput, name, description, original, modified, viewType);
  }
}
let NotebookMultiDiffEditorWidgetInput = class extends MultiDiffEditorInput {
  constructor(multiDiffSource, notebookDiffViewModel, _textModelService, _textResourceConfigurationService, _instantiationService, _multiDiffSourceResolverService, _textFileService) {
    super(multiDiffSource, void 0, void 0, true, _textModelService, _textResourceConfigurationService, _instantiationService, _multiDiffSourceResolverService, _textFileService);
    this.notebookDiffViewModel = notebookDiffViewModel;
    this._register(_multiDiffSourceResolverService.registerResolver(this));
  }
  static createInput(notebookDiffViewModel, instantiationService) {
    const multiDiffSource = URI.parse(`${NotebookMultiDiffEditorScheme}:${(/* @__PURE__ */ new Date()).getMilliseconds().toString() + Math.random().toString()}`);
    return instantiationService.createInstance(
      NotebookMultiDiffEditorWidgetInput,
      multiDiffSource,
      notebookDiffViewModel
    );
  }
  canHandleUri(uri) {
    return uri.toString() === this.multiDiffSource.toString();
  }
  async resolveDiffSource(_) {
    return { resources: this.notebookDiffViewModel };
  }
};
NotebookMultiDiffEditorWidgetInput = __decorateClass([
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ITextResourceConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IMultiDiffSourceResolverService),
  __decorateParam(6, ITextFileService)
], NotebookMultiDiffEditorWidgetInput);
export {
  NotebookMultiDiffEditorInput,
  NotebookMultiDiffEditorScheme,
  NotebookMultiDiffEditorWidgetInput
};
