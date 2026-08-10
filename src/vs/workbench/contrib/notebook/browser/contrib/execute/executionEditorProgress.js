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
import { throttle } from "../../../../../../base/common/decorators.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { NotebookCellExecutionState } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
import { IUserActivityService } from "../../../../../services/userActivity/common/userActivityService.js";
let ExecutionEditorProgressController = class extends Disposable {
  constructor(_notebookEditor, _notebookExecutionStateService, _userActivity) {
    super();
    this._notebookEditor = _notebookEditor;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._userActivity = _userActivity;
    this._activityMutex = this._register(new MutableDisposable());
    this._register(_notebookEditor.onDidScroll(() => this._update()));
    this._register(_notebookExecutionStateService.onDidChangeExecution((e) => {
      if (e.notebook.toString() !== this._notebookEditor.textModel?.uri.toString()) {
        return;
      }
      this._update();
    }));
    this._register(_notebookEditor.onDidChangeModel(() => this._update()));
  }
  static {
    this.id = "workbench.notebook.executionEditorProgress";
  }
  _update() {
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    const cellExecutions = this._notebookExecutionStateService.getCellExecutionsForNotebook(this._notebookEditor.textModel?.uri).filter((exe) => exe.state === NotebookCellExecutionState.Executing);
    const notebookExecution = this._notebookExecutionStateService.getExecution(this._notebookEditor.textModel?.uri);
    const executionIsVisible = (exe) => {
      for (const range of this._notebookEditor.visibleRanges) {
        for (const cell of this._notebookEditor.getCellsInRange(range)) {
          if (cell.handle === exe.cellHandle) {
            const top = this._notebookEditor.getAbsoluteTopOfElement(cell);
            if (this._notebookEditor.scrollTop < top + 5) {
              return true;
            }
          }
        }
      }
      return false;
    };
    const hasAnyExecution = cellExecutions.length || notebookExecution;
    if (hasAnyExecution && !this._activityMutex.value) {
      this._activityMutex.value = this._userActivity.markActive();
    } else if (!hasAnyExecution && this._activityMutex.value) {
      this._activityMutex.clear();
    }
    const shouldShowEditorProgressbarForCellExecutions = cellExecutions.length && !cellExecutions.some(executionIsVisible) && !cellExecutions.some((e) => e.isPaused);
    const showEditorProgressBar = !!notebookExecution || shouldShowEditorProgressbarForCellExecutions;
    if (showEditorProgressBar) {
      this._notebookEditor.showProgress();
    } else {
      this._notebookEditor.hideProgress();
    }
  }
};
__decorateClass([
  throttle(100)
], ExecutionEditorProgressController.prototype, "_update", 1);
ExecutionEditorProgressController = __decorateClass([
  __decorateParam(1, INotebookExecutionStateService),
  __decorateParam(2, IUserActivityService)
], ExecutionEditorProgressController);
registerNotebookContribution(ExecutionEditorProgressController.id, ExecutionEditorProgressController);
export {
  ExecutionEditorProgressController
};
