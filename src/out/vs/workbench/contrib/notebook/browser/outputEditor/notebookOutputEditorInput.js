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
import * as nls from "../../../../../nls.js";
import { EditorInputCapabilities } from "../../../../common/editor.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
import { INotebookEditorModelResolverService } from "../../common/notebookEditorModelResolverService.js";
import { isEqual } from "../../../../../base/common/resources.js";
class ResolvedNotebookOutputEditorInputModel {
  constructor(resolvedNotebookEditorModel, notebookUri, cell, outputId) {
    this.resolvedNotebookEditorModel = resolvedNotebookEditorModel;
    this.notebookUri = notebookUri;
    this.cell = cell;
    this.outputId = outputId;
  }
  dispose() {
    this.resolvedNotebookEditorModel.dispose();
  }
}
let NotebookOutputEditorInput = class extends EditorInput {
  constructor(notebookUri, cellIndex, outputId, outputIndex, notebookEditorModelResolverService) {
    super();
    this.notebookEditorModelResolverService = notebookEditorModelResolverService;
    this._notebookUri = notebookUri;
    this.cellUri = void 0;
    this.cellIndex = cellIndex;
    this.outputId = outputId;
    this.outputIndex = outputIndex;
  }
  static {
    this.ID = "workbench.input.notebookOutputEditorInput";
  }
  get typeId() {
    return NotebookOutputEditorInput.ID;
  }
  async resolve() {
    if (!this._notebookRef) {
      this._notebookRef = await this.notebookEditorModelResolverService.resolve(this._notebookUri);
    }
    const cell = this._notebookRef.object.notebook.cells[this.cellIndex];
    if (!cell) {
      throw new Error("Cell not found");
    }
    this.cellUri = cell.uri;
    const resolvedOutputId = cell.outputs[this.outputIndex]?.outputId;
    if (!resolvedOutputId) {
      throw new Error("Output not found");
    }
    if (!this.outputId) {
      this.outputId = resolvedOutputId;
    }
    return new ResolvedNotebookOutputEditorInputModel(
      this._notebookRef.object,
      this._notebookUri,
      cell,
      resolvedOutputId
    );
  }
  getSerializedData() {
    if (!this._notebookRef) {
      return;
    }
    const cellIndex = this._notebookRef.object.notebook.cells.findIndex((c) => isEqual(c.uri, this.cellUri));
    const cell = this._notebookRef.object.notebook.cells[cellIndex];
    if (!cell) {
      return;
    }
    const outputIndex = cell.outputs.findIndex((o) => o.outputId === this.outputId);
    if (outputIndex === -1) {
      return;
    }
    return {
      notebookUri: this._notebookUri,
      cellIndex,
      outputIndex
    };
  }
  getName() {
    return nls.localize("notebookOutputEditorInput", "Notebook Output Preview");
  }
  get editorId() {
    return "notebookOutputEditor";
  }
  get resource() {
    return;
  }
  get capabilities() {
    return EditorInputCapabilities.Readonly;
  }
  dispose() {
    super.dispose();
  }
};
NotebookOutputEditorInput = __decorateClass([
  __decorateParam(4, INotebookEditorModelResolverService)
], NotebookOutputEditorInput);
export {
  NotebookOutputEditorInput
};
