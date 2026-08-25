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
import { Delayer } from "../../../../../../base/common/async.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { debugIconBreakpointForeground } from "../../../../debug/browser/breakpointEditorContribution.js";
import { focusedStackFrameColor, topStackFrameColor } from "../../../../debug/browser/callStackEditorContribution.js";
import { IDebugService } from "../../../../debug/common/debug.js";
import { NotebookOverviewRulerLane } from "../../notebookBrowser.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { runningCellRulerDecorationColor } from "../../notebookEditorWidget.js";
import { CellUri, NotebookCellExecutionState } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
let PausedCellDecorationContribution = class extends Disposable {
  constructor(_notebookEditor, _debugService, _notebookExecutionStateService) {
    super();
    this._notebookEditor = _notebookEditor;
    this._debugService = _debugService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._currentTopDecorations = [];
    this._currentOtherDecorations = [];
    this._executingCellDecorations = [];
    const delayer = this._register(new Delayer(200));
    this._register(_debugService.getModel().onDidChangeCallStack(() => this.updateExecutionDecorations()));
    this._register(_debugService.getViewModel().onDidFocusStackFrame(() => this.updateExecutionDecorations()));
    this._register(_notebookExecutionStateService.onDidChangeExecution((e) => {
      if (e.type === NotebookExecutionType.cell && this._notebookEditor.textModel && e.affectsNotebook(this._notebookEditor.textModel.uri)) {
        delayer.trigger(() => this.updateExecutionDecorations());
      }
    }));
  }
  static {
    this.id = "workbench.notebook.debug.pausedCellDecorations";
  }
  updateExecutionDecorations() {
    const exes = this._notebookEditor.textModel ? this._notebookExecutionStateService.getCellExecutionsByHandleForNotebook(this._notebookEditor.textModel.uri) : void 0;
    const topFrameCellsAndRanges = [];
    let focusedFrameCellAndRange = void 0;
    const getNotebookCellAndRange = (sf) => {
      const parsed = CellUri.parse(sf.source.uri);
      if (parsed && parsed.notebook.toString() === this._notebookEditor.textModel?.uri.toString()) {
        return { handle: parsed.handle, range: sf.range };
      }
      return void 0;
    };
    for (const session of this._debugService.getModel().getSessions()) {
      for (const thread of session.getAllThreads()) {
        const topFrame = thread.getTopStackFrame();
        if (topFrame) {
          const notebookCellAndRange = getNotebookCellAndRange(topFrame);
          if (notebookCellAndRange) {
            topFrameCellsAndRanges.push(notebookCellAndRange);
            exes?.delete(notebookCellAndRange.handle);
          }
        }
      }
    }
    const focusedFrame = this._debugService.getViewModel().focusedStackFrame;
    if (focusedFrame && focusedFrame.thread.stopped) {
      const thisFocusedFrameCellAndRange = getNotebookCellAndRange(focusedFrame);
      if (thisFocusedFrameCellAndRange && !topFrameCellsAndRanges.some((topFrame) => topFrame.handle === thisFocusedFrameCellAndRange?.handle && Range.equalsRange(topFrame.range, thisFocusedFrameCellAndRange?.range))) {
        focusedFrameCellAndRange = thisFocusedFrameCellAndRange;
        exes?.delete(focusedFrameCellAndRange.handle);
      }
    }
    this.setTopFrameDecoration(topFrameCellsAndRanges);
    this.setFocusedFrameDecoration(focusedFrameCellAndRange);
    const exeHandles = exes ? Array.from(exes.entries()).filter(([_, exe]) => exe.state === NotebookCellExecutionState.Executing).map(([handle]) => handle) : [];
    this.setExecutingCellDecorations(exeHandles);
  }
  setTopFrameDecoration(handlesAndRanges) {
    const newDecorations = handlesAndRanges.map(({ handle, range }) => {
      const options = {
        overviewRuler: {
          color: topStackFrameColor,
          includeOutput: false,
          modelRanges: [range],
          position: NotebookOverviewRulerLane.Full
        }
      };
      return {
        handle,
        options
      };
    });
    this._currentTopDecorations = this._notebookEditor.deltaCellDecorations(this._currentTopDecorations, newDecorations);
  }
  setFocusedFrameDecoration(focusedFrameCellAndRange) {
    let newDecorations = [];
    if (focusedFrameCellAndRange) {
      const options = {
        overviewRuler: {
          color: focusedStackFrameColor,
          includeOutput: false,
          modelRanges: [focusedFrameCellAndRange.range],
          position: NotebookOverviewRulerLane.Full
        }
      };
      newDecorations = [{
        handle: focusedFrameCellAndRange.handle,
        options
      }];
    }
    this._currentOtherDecorations = this._notebookEditor.deltaCellDecorations(this._currentOtherDecorations, newDecorations);
  }
  setExecutingCellDecorations(handles) {
    const newDecorations = handles.map((handle) => {
      const options = {
        overviewRuler: {
          color: runningCellRulerDecorationColor,
          includeOutput: false,
          modelRanges: [new Range(0, 0, 0, 0)],
          position: NotebookOverviewRulerLane.Left
        }
      };
      return {
        handle,
        options
      };
    });
    this._executingCellDecorations = this._notebookEditor.deltaCellDecorations(this._executingCellDecorations, newDecorations);
  }
};
PausedCellDecorationContribution = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, INotebookExecutionStateService)
], PausedCellDecorationContribution);
registerNotebookContribution(PausedCellDecorationContribution.id, PausedCellDecorationContribution);
let NotebookBreakpointDecorations = class extends Disposable {
  constructor(_notebookEditor, _debugService, _configService) {
    super();
    this._notebookEditor = _notebookEditor;
    this._debugService = _debugService;
    this._configService = _configService;
    this._currentDecorations = [];
    this._register(_debugService.getModel().onDidChangeBreakpoints(() => this.updateDecorations()));
    this._register(_configService.onDidChangeConfiguration((e) => e.affectsConfiguration("debug.showBreakpointsInOverviewRuler") && this.updateDecorations()));
  }
  static {
    this.id = "workbench.notebook.debug.notebookBreakpointDecorations";
  }
  updateDecorations() {
    const enabled = this._configService.getValue("debug.showBreakpointsInOverviewRuler");
    const newDecorations = enabled ? this._debugService.getModel().getBreakpoints().map((breakpoint) => {
      const parsed = CellUri.parse(breakpoint.uri);
      if (!parsed || parsed.notebook.toString() !== this._notebookEditor.textModel.uri.toString()) {
        return null;
      }
      const options = {
        overviewRuler: {
          color: debugIconBreakpointForeground,
          includeOutput: false,
          modelRanges: [new Range(breakpoint.lineNumber, 0, breakpoint.lineNumber, 0)],
          position: NotebookOverviewRulerLane.Left
        }
      };
      return { handle: parsed.handle, options };
    }).filter((x) => !!x) : [];
    this._currentDecorations = this._notebookEditor.deltaCellDecorations(this._currentDecorations, newDecorations);
  }
};
NotebookBreakpointDecorations = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, IConfigurationService)
], NotebookBreakpointDecorations);
registerNotebookContribution(NotebookBreakpointDecorations.id, NotebookBreakpointDecorations);
export {
  NotebookBreakpointDecorations,
  PausedCellDecorationContribution
};
