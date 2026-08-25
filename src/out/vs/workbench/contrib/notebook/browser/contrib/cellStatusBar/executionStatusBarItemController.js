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
import { disposableTimeout, RunOnceScheduler } from "../../../../../../base/common/async.js";
import { Disposable, dispose, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { language } from "../../../../../../base/common/platform.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { themeColorFromId } from "../../../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { NotebookVisibleCellObserver } from "./notebookVisibleCellObserver.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { cellStatusIconError, cellStatusIconSuccess } from "../../notebookEditorWidget.js";
import { errorStateIcon, executingStateIcon, pendingStateIcon, successStateIcon } from "../../notebookIcons.js";
import { CellStatusbarAlignment, NotebookCellExecutionState, NotebookSetting } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
import { INotebookService } from "../../../common/notebookService.js";
function formatCellDuration(duration, showMilliseconds = true) {
  if (showMilliseconds && duration < 1e3) {
    return `${duration}ms`;
  }
  const minutes = Math.floor(duration / 1e3 / 60);
  const seconds = Math.floor(duration / 1e3) % 60;
  const tenths = Math.floor(duration % 1e3 / 100);
  if (minutes > 0) {
    return `${minutes}m ${seconds}.${tenths}s`;
  } else {
    return `${seconds}.${tenths}s`;
  }
}
class NotebookStatusBarController extends Disposable {
  constructor(_notebookEditor, _itemFactory) {
    super();
    this._notebookEditor = _notebookEditor;
    this._itemFactory = _itemFactory;
    this._visibleCells = /* @__PURE__ */ new Map();
    this._observer = this._register(new NotebookVisibleCellObserver(this._notebookEditor));
    this._register(this._observer.onDidChangeVisibleCells(this._updateVisibleCells, this));
    this._updateEverything();
  }
  _updateEverything() {
    this._visibleCells.forEach(dispose);
    this._visibleCells.clear();
    this._updateVisibleCells({ added: this._observer.visibleCells, removed: [] });
  }
  _updateVisibleCells(e) {
    const vm = this._notebookEditor.getViewModel();
    if (!vm) {
      return;
    }
    for (const oldCell of e.removed) {
      this._visibleCells.get(oldCell.handle)?.dispose();
      this._visibleCells.delete(oldCell.handle);
    }
    for (const newCell of e.added) {
      this._visibleCells.set(newCell.handle, this._itemFactory(vm, newCell));
    }
  }
  dispose() {
    super.dispose();
    this._visibleCells.forEach(dispose);
    this._visibleCells.clear();
  }
}
let ExecutionStateCellStatusBarContrib = class extends Disposable {
  static {
    this.id = "workbench.notebook.statusBar.execState";
  }
  constructor(notebookEditor, instantiationService) {
    super();
    this._register(new NotebookStatusBarController(notebookEditor, (vm, cell) => instantiationService.createInstance(ExecutionStateCellStatusBarItem, vm, cell)));
  }
};
ExecutionStateCellStatusBarContrib = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ExecutionStateCellStatusBarContrib);
registerNotebookContribution(ExecutionStateCellStatusBarContrib.id, ExecutionStateCellStatusBarContrib);
let ExecutionStateCellStatusBarItem = class extends Disposable {
  constructor(_notebookViewModel, _cell, _executionStateService) {
    super();
    this._notebookViewModel = _notebookViewModel;
    this._cell = _cell;
    this._executionStateService = _executionStateService;
    this._currentItemIds = [];
    this._clearExecutingStateTimer = this._register(new MutableDisposable());
    this._update();
    this._register(this._executionStateService.onDidChangeExecution((e) => {
      if (e.type === NotebookExecutionType.cell && e.affectsCell(this._cell.uri)) {
        this._update();
      }
    }));
    this._register(this._cell.model.onDidChangeInternalMetadata(() => this._update()));
  }
  static {
    this.MIN_SPINNER_TIME = 500;
  }
  async _update() {
    const items = this._getItemsForCell();
    if (Array.isArray(items)) {
      this._currentItemIds = this._notebookViewModel.deltaCellStatusBarItems(this._currentItemIds, [{ handle: this._cell.handle, items }]);
    }
  }
  /**
   *	Returns undefined if there should be no change, and an empty array if all items should be removed.
   */
  _getItemsForCell() {
    const runState = this._executionStateService.getCellExecution(this._cell.uri);
    if (runState?.state === NotebookCellExecutionState.Executing && typeof this._showedExecutingStateTime !== "number") {
      this._showedExecutingStateTime = Date.now();
    } else if (runState?.state !== NotebookCellExecutionState.Executing && typeof this._showedExecutingStateTime === "number") {
      const timeUntilMin = ExecutionStateCellStatusBarItem.MIN_SPINNER_TIME - (Date.now() - this._showedExecutingStateTime);
      if (timeUntilMin > 0) {
        if (!this._clearExecutingStateTimer.value) {
          this._clearExecutingStateTimer.value = disposableTimeout(() => {
            this._showedExecutingStateTime = void 0;
            this._clearExecutingStateTimer.clear();
            this._update();
          }, timeUntilMin);
        }
        return void 0;
      } else {
        this._showedExecutingStateTime = void 0;
      }
    }
    const items = this._getItemForState(runState, this._cell.internalMetadata);
    return items;
  }
  _getItemForState(runState, internalMetadata) {
    const state = runState?.state;
    const { lastRunSuccess } = internalMetadata;
    if (!state && lastRunSuccess) {
      return [{
        text: `$(${successStateIcon.id})`,
        color: themeColorFromId(cellStatusIconSuccess),
        tooltip: localize("notebook.cell.status.success", "Success"),
        alignment: CellStatusbarAlignment.Left,
        priority: Number.MAX_SAFE_INTEGER
      }];
    } else if (!state && lastRunSuccess === false) {
      return [{
        text: `$(${errorStateIcon.id})`,
        color: themeColorFromId(cellStatusIconError),
        tooltip: localize("notebook.cell.status.failed", "Failed"),
        alignment: CellStatusbarAlignment.Left,
        priority: Number.MAX_SAFE_INTEGER
      }];
    } else if (state === NotebookCellExecutionState.Pending || state === NotebookCellExecutionState.Unconfirmed) {
      return [{
        text: `$(${pendingStateIcon.id})`,
        tooltip: localize("notebook.cell.status.pending", "Pending"),
        alignment: CellStatusbarAlignment.Left,
        priority: Number.MAX_SAFE_INTEGER
      }];
    } else if (state === NotebookCellExecutionState.Executing) {
      const icon = runState?.didPause ? executingStateIcon : ThemeIcon.modify(executingStateIcon, "spin");
      return [{
        text: `$(${icon.id})`,
        tooltip: localize("notebook.cell.status.executing", "Executing"),
        alignment: CellStatusbarAlignment.Left,
        priority: Number.MAX_SAFE_INTEGER
      }];
    }
    return [];
  }
  dispose() {
    super.dispose();
    this._notebookViewModel.deltaCellStatusBarItems(this._currentItemIds, [{ handle: this._cell.handle, items: [] }]);
  }
};
ExecutionStateCellStatusBarItem = __decorateClass([
  __decorateParam(2, INotebookExecutionStateService)
], ExecutionStateCellStatusBarItem);
let TimerCellStatusBarContrib = class extends Disposable {
  static {
    this.id = "workbench.notebook.statusBar.execTimer";
  }
  constructor(notebookEditor, instantiationService) {
    super();
    this._register(new NotebookStatusBarController(notebookEditor, (vm, cell) => instantiationService.createInstance(TimerCellStatusBarItem, vm, cell)));
  }
};
TimerCellStatusBarContrib = __decorateClass([
  __decorateParam(1, IInstantiationService)
], TimerCellStatusBarContrib);
registerNotebookContribution(TimerCellStatusBarContrib.id, TimerCellStatusBarContrib);
const UPDATE_TIMER_GRACE_PERIOD = 200;
let TimerCellStatusBarItem = class extends Disposable {
  constructor(_notebookViewModel, _cell, _executionStateService, _notebookService, _configurationService) {
    super();
    this._notebookViewModel = _notebookViewModel;
    this._cell = _cell;
    this._executionStateService = _executionStateService;
    this._notebookService = _notebookService;
    this._configurationService = _configurationService;
    this._currentItemIds = [];
    this._isVerbose = this._configurationService.getValue(NotebookSetting.cellExecutionTimeVerbosity) === "verbose";
    this._scheduler = this._register(new RunOnceScheduler(() => this._update(), TimerCellStatusBarItem.UPDATE_INTERVAL));
    this._update();
    this._register(this._cell.model.onDidChangeInternalMetadata(() => this._update()));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.cellExecutionTimeVerbosity)) {
        this._isVerbose = this._configurationService.getValue(NotebookSetting.cellExecutionTimeVerbosity) === "verbose";
        this._update();
      }
    }));
  }
  static {
    this.UPDATE_INTERVAL = 100;
  }
  async _update() {
    let timerItem;
    const runState = this._executionStateService.getCellExecution(this._cell.uri);
    const state = runState?.state;
    const startTime = this._cell.internalMetadata.runStartTime;
    const adjustment = this._cell.internalMetadata.runStartTimeAdjustment ?? 0;
    const endTime = this._cell.internalMetadata.runEndTime;
    if (runState?.didPause) {
      timerItem = void 0;
    } else if (state === NotebookCellExecutionState.Executing) {
      if (typeof startTime === "number") {
        timerItem = this._getTimeItem(startTime, Date.now(), adjustment);
        this._scheduler.schedule();
      }
    } else if (!state) {
      if (typeof startTime === "number" && typeof endTime === "number") {
        const timerDuration = Date.now() - startTime + adjustment;
        const executionDuration = endTime - startTime;
        const renderDuration = this._cell.internalMetadata.renderDuration ?? {};
        timerItem = this._getTimeItem(startTime, endTime, void 0, {
          timerDuration,
          executionDuration,
          renderDuration
        });
      }
    }
    const items = timerItem ? [timerItem] : [];
    if (!items.length && !!runState) {
      if (!this._deferredUpdate) {
        this._deferredUpdate = disposableTimeout(() => {
          this._deferredUpdate = void 0;
          this._currentItemIds = this._notebookViewModel.deltaCellStatusBarItems(this._currentItemIds, [{ handle: this._cell.handle, items }]);
        }, UPDATE_TIMER_GRACE_PERIOD, this._store);
      }
    } else {
      this._deferredUpdate?.dispose();
      this._deferredUpdate = void 0;
      this._currentItemIds = this._notebookViewModel.deltaCellStatusBarItems(this._currentItemIds, [{ handle: this._cell.handle, items }]);
    }
  }
  _getTimeItem(startTime, endTime, adjustment = 0, runtimeInformation) {
    const duration = endTime - startTime + adjustment;
    let tooltip;
    const lastExecution = new Date(endTime).toLocaleTimeString(language);
    if (runtimeInformation) {
      const { renderDuration, executionDuration, timerDuration } = runtimeInformation;
      let renderTimes = "";
      for (const key in renderDuration) {
        const rendererInfo = this._notebookService.getRendererInfo(key);
        const args = encodeURIComponent(JSON.stringify({
          extensionId: rendererInfo?.extensionId.value ?? "",
          issueBody: `Auto-generated text from notebook cell performance - Please add an explanation for the performance issue, including cell content if possible.
The duration for the renderer, ${rendererInfo?.displayName ?? key}, is slower than expected.
Execution Time: ${formatCellDuration(executionDuration)}
Renderer Duration: ${formatCellDuration(renderDuration[key])}
`
        }));
        const renderIssueLink = renderDuration[key] > 200 && executionDuration < 2e3 || renderDuration[key] > 1e3;
        const linkText = rendererInfo?.displayName ?? key;
        const rendererTitle = renderIssueLink ? `[${linkText}](command:workbench.action.openIssueReporter?${args})` : `**${linkText}**`;
        renderTimes += `- ${rendererTitle} ${formatCellDuration(renderDuration[key])}
`;
      }
      renderTimes += `
*${localize("notebook.cell.statusBar.timerTooltip.reportIssueFootnote", "Use the links above to file an issue using the issue reporter.")}*
`;
      tooltip = {
        value: localize("notebook.cell.statusBar.timerTooltip", "**Last Execution** {0}\n\n**Execution Time** {1}\n\n**Overhead Time** {2}\n\n**Render Times**\n\n{3}", lastExecution, formatCellDuration(executionDuration), formatCellDuration(timerDuration - executionDuration), renderTimes),
        isTrusted: true
      };
    }
    const executionText = this._isVerbose ? localize("notebook.cell.statusBar.timerVerbose", "Last Execution: {0}, Duration: {1}", lastExecution, formatCellDuration(duration, false)) : formatCellDuration(duration, false);
    return {
      text: executionText,
      alignment: CellStatusbarAlignment.Left,
      priority: Number.MAX_SAFE_INTEGER - 5,
      tooltip
    };
  }
  dispose() {
    super.dispose();
    this._deferredUpdate?.dispose();
    this._notebookViewModel.deltaCellStatusBarItems(this._currentItemIds, [{ handle: this._cell.handle, items: [] }]);
  }
};
TimerCellStatusBarItem = __decorateClass([
  __decorateParam(2, INotebookExecutionStateService),
  __decorateParam(3, INotebookService),
  __decorateParam(4, IConfigurationService)
], TimerCellStatusBarItem);
export {
  ExecutionStateCellStatusBarContrib,
  NotebookStatusBarController,
  TimerCellStatusBarContrib,
  formatCellDuration
};
