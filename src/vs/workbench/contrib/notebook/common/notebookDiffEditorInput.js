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
import { isResourceDiffEditorInput } from "../../../common/editor.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { NotebookEditorInput } from "./notebookEditorInput.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
class NotebookDiffEditorModel extends EditorModel {
  constructor(original, modified) {
    super();
    this.original = original;
    this.modified = modified;
  }
}
let NotebookDiffEditorInput = class extends DiffEditorInput {
  constructor(name, description, original, modified, viewType, editorService) {
    super(
      name,
      description,
      original,
      modified,
      void 0,
      editorService
    );
    this.original = original;
    this.modified = modified;
    this.viewType = viewType;
    this._modifiedTextModel = null;
    this._originalTextModel = null;
    this._cachedModel = void 0;
  }
  static create(instantiationService, resource, name, description, originalResource, viewType) {
    const original = NotebookEditorInput.getOrCreate(instantiationService, originalResource, void 0, viewType);
    const modified = NotebookEditorInput.getOrCreate(instantiationService, resource, void 0, viewType);
    return instantiationService.createInstance(NotebookDiffEditorInput, name, description, original, modified, viewType);
  }
  static {
    this.ID = "workbench.input.diffNotebookInput";
  }
  get resource() {
    return this.modified.resource;
  }
  get editorId() {
    return this.viewType;
  }
  get typeId() {
    return NotebookDiffEditorInput.ID;
  }
  async resolve() {
    const [originalEditorModel, modifiedEditorModel] = await Promise.all([
      this.original.resolve(),
      this.modified.resolve()
    ]);
    this._cachedModel?.dispose();
    if (!modifiedEditorModel) {
      throw new Error(`Fail to resolve modified editor model for resource ${this.modified.resource} with notebookType ${this.viewType}`);
    }
    if (!originalEditorModel) {
      throw new Error(`Fail to resolve original editor model for resource ${this.original.resource} with notebookType ${this.viewType}`);
    }
    this._originalTextModel = originalEditorModel;
    this._modifiedTextModel = modifiedEditorModel;
    this._cachedModel = new NotebookDiffEditorModel(this._originalTextModel, this._modifiedTextModel);
    return this._cachedModel;
  }
  toUntyped() {
    const original = { resource: this.original.resource };
    const modified = { resource: this.resource };
    return {
      original,
      modified,
      primary: modified,
      secondary: original,
      options: {
        override: this.viewType
      }
    };
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    if (otherInput instanceof NotebookDiffEditorInput) {
      return this.modified.matches(otherInput.modified) && this.original.matches(otherInput.original) && this.viewType === otherInput.viewType;
    }
    if (isResourceDiffEditorInput(otherInput)) {
      return this.modified.matches(otherInput.modified) && this.original.matches(otherInput.original) && this.editorId !== void 0 && (this.editorId === otherInput.options?.override || otherInput.options?.override === void 0);
    }
    return false;
  }
  dispose() {
    super.dispose();
    this._cachedModel?.dispose();
    this._cachedModel = void 0;
    this.original.dispose();
    this.modified.dispose();
    this._originalTextModel = null;
    this._modifiedTextModel = null;
  }
};
NotebookDiffEditorInput = __decorateClass([
  __decorateParam(5, IEditorService)
], NotebookDiffEditorInput);
export {
  NotebookDiffEditorInput
};
