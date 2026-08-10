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
import { ProgressBar } from "../../../../../../base/browser/ui/progressbar/progressbar.js";
import { defaultProgressBarStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { CellContentPart } from "../cellPart.js";
import { NotebookCellExecutionState } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
let CellProgressBar = class extends CellContentPart {
  constructor(editorContainer, collapsedInputContainer, _notebookExecutionStateService) {
    super();
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._progressBar = this._register(new ProgressBar(editorContainer, defaultProgressBarStyles));
    this._progressBar.hide();
    this._collapsedProgressBar = this._register(new ProgressBar(collapsedInputContainer, defaultProgressBarStyles));
    this._collapsedProgressBar.hide();
  }
  didRenderCell(element) {
    this._updateForExecutionState(element);
  }
  updateForExecutionState(element, e) {
    this._updateForExecutionState(element, e);
  }
  updateState(element, e) {
    if (e.metadataChanged || e.internalMetadataChanged) {
      this._updateForExecutionState(element);
    }
    if (e.inputCollapsedChanged) {
      const exeState = this._notebookExecutionStateService.getCellExecution(element.uri);
      if (element.isInputCollapsed) {
        this._progressBar.hide();
        if (exeState?.state === NotebookCellExecutionState.Executing) {
          this._updateForExecutionState(element);
        }
      } else {
        this._collapsedProgressBar.hide();
        if (exeState?.state === NotebookCellExecutionState.Executing) {
          this._updateForExecutionState(element);
        }
      }
    }
  }
  _updateForExecutionState(element, e) {
    const exeState = e?.changed ?? this._notebookExecutionStateService.getCellExecution(element.uri);
    const progressBar = element.isInputCollapsed ? this._collapsedProgressBar : this._progressBar;
    if (exeState?.state === NotebookCellExecutionState.Executing && (!exeState.didPause || element.isInputCollapsed)) {
      showProgressBar(progressBar);
    } else {
      progressBar.hide();
    }
  }
};
CellProgressBar = __decorateClass([
  __decorateParam(2, INotebookExecutionStateService)
], CellProgressBar);
function showProgressBar(progressBar) {
  progressBar.infinite().show(500);
}
export {
  CellProgressBar
};
