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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { PrefixSumComputer } from "../../../../../editor/common/model/prefixSumComputer.js";
import { CellOutputViewModel } from "../viewModel/cellOutputViewModel.js";
import { INotebookService } from "../../common/notebookService.js";
let DiffNestedCellViewModel = class extends Disposable {
  constructor(textModel, _notebookService) {
    super();
    this.textModel = textModel;
    this._notebookService = _notebookService;
    this._onDidChangeState = this._register(new Emitter());
    this._hoveringOutput = false;
    this._focusOnOutput = false;
    this._focusInputInOutput = false;
    this._outputCollection = [];
    this._outputsTop = null;
    this._onDidChangeOutputLayout = this._register(new Emitter());
    this.onDidChangeOutputLayout = this._onDidChangeOutputLayout.event;
    this._id = generateUuid();
    this._outputViewModels = this.textModel.outputs.map((output) => new CellOutputViewModel(this, output, this._notebookService));
    this._register(this.textModel.onDidChangeOutputs((splice) => {
      this._outputCollection.splice(splice.start, splice.deleteCount, ...splice.newOutputs.map(() => 0));
      const removed = this._outputViewModels.splice(splice.start, splice.deleteCount, ...splice.newOutputs.map((output) => new CellOutputViewModel(this, output, this._notebookService)));
      removed.forEach((vm) => vm.dispose());
      this._outputsTop = null;
      this._onDidChangeOutputLayout.fire();
    }));
    this._outputCollection = new Array(this.textModel.outputs.length);
  }
  get id() {
    return this._id;
  }
  get outputs() {
    return this.textModel.outputs;
  }
  get language() {
    return this.textModel.language;
  }
  get metadata() {
    return this.textModel.metadata;
  }
  get uri() {
    return this.textModel.uri;
  }
  get handle() {
    return this.textModel.handle;
  }
  get outputIsHovered() {
    return this._hoveringOutput;
  }
  set outputIsHovered(v) {
    this._hoveringOutput = v;
    this._onDidChangeState.fire({ outputIsHoveredChanged: true });
  }
  get outputIsFocused() {
    return this._focusOnOutput;
  }
  set outputIsFocused(v) {
    this._focusOnOutput = v;
    this._onDidChangeState.fire({ outputIsFocusedChanged: true });
  }
  get inputInOutputIsFocused() {
    return this._focusInputInOutput;
  }
  set inputInOutputIsFocused(v) {
    this._focusInputInOutput = v;
  }
  get outputsViewModels() {
    return this._outputViewModels;
  }
  _ensureOutputsTop() {
    if (!this._outputsTop) {
      const values = new Uint32Array(this._outputCollection.length);
      for (let i = 0; i < this._outputCollection.length; i++) {
        values[i] = this._outputCollection[i];
      }
      this._outputsTop = new PrefixSumComputer(values);
    }
  }
  getOutputOffset(index) {
    this._ensureOutputsTop();
    if (index >= this._outputCollection.length) {
      throw new Error("Output index out of range!");
    }
    return this._outputsTop.getPrefixSum(index - 1);
  }
  updateOutputHeight(index, height) {
    if (index >= this._outputCollection.length) {
      throw new Error("Output index out of range!");
    }
    this._ensureOutputsTop();
    this._outputCollection[index] = height;
    if (this._outputsTop.setValue(index, height)) {
      this._onDidChangeOutputLayout.fire();
    }
  }
  getOutputTotalHeight() {
    this._ensureOutputsTop();
    return this._outputsTop?.getTotalSum() ?? 0;
  }
  dispose() {
    super.dispose();
    this._outputViewModels.forEach((output) => {
      output.dispose();
    });
  }
};
DiffNestedCellViewModel = __decorateClass([
  __decorateParam(1, INotebookService)
], DiffNestedCellViewModel);
export {
  DiffNestedCellViewModel
};
