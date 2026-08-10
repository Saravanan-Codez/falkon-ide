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
import { RunOnceScheduler } from "../../../../../../base/common/async.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../base/common/uri.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../../../common/contributions.js";
import { IDebugService } from "../../../../debug/common/debug.js";
import { CellUri } from "../../../common/notebookCommon.js";
import { CellExecutionUpdateType } from "../../../common/notebookExecutionService.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
let NotebookCellPausing = class extends Disposable {
  constructor(_debugService, _notebookExecutionStateService) {
    super();
    this._debugService = _debugService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._pausedCells = /* @__PURE__ */ new Set();
    this._register(_debugService.getModel().onDidChangeCallStack(() => {
      this.onDidChangeCallStack(true);
      this._scheduler.schedule();
    }));
    this._scheduler = this._register(new RunOnceScheduler(() => this.onDidChangeCallStack(false), 2e3));
  }
  async onDidChangeCallStack(fallBackOnStaleCallstack) {
    const newPausedCells = /* @__PURE__ */ new Set();
    for (const session of this._debugService.getModel().getSessions()) {
      for (const thread of session.getAllThreads()) {
        let callStack = thread.getCallStack();
        if (fallBackOnStaleCallstack && !callStack.length) {
          callStack = thread.getStaleCallStack();
        }
        callStack.forEach((sf) => {
          const parsed = CellUri.parse(sf.source.uri);
          if (parsed) {
            newPausedCells.add(sf.source.uri.toString());
            this.editIsPaused(sf.source.uri, true);
          }
        });
      }
    }
    for (const uri of this._pausedCells) {
      if (!newPausedCells.has(uri)) {
        this.editIsPaused(URI.parse(uri), false);
        this._pausedCells.delete(uri);
      }
    }
    newPausedCells.forEach((cell) => this._pausedCells.add(cell));
  }
  editIsPaused(cellUri, isPaused) {
    const parsed = CellUri.parse(cellUri);
    if (parsed) {
      const exeState = this._notebookExecutionStateService.getCellExecution(cellUri);
      if (exeState && (exeState.isPaused !== isPaused || !exeState.didPause)) {
        exeState.update([{
          editType: CellExecutionUpdateType.ExecutionState,
          didPause: true,
          isPaused
        }]);
      }
    }
  }
};
NotebookCellPausing = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, INotebookExecutionStateService)
], NotebookCellPausing);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookCellPausing, LifecyclePhase.Restored);
