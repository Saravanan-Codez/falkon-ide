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
import { toDisposable } from "../../../../../base/common/lifecycle.js";
import * as nls from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IWorkspaceTrustRequestService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { KernelPickerMRUStrategy } from "../viewParts/notebookKernelQuickPickStrategy.js";
import { CellKind, NotebookCellExecutionState } from "../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { INotebookKernelHistoryService, INotebookKernelService } from "../../common/notebookKernelService.js";
import { INotebookLoggingService } from "../../common/notebookLoggingService.js";
let NotebookExecutionService = class {
  constructor(_commandService, _notebookKernelService, _notebookKernelHistoryService, _workspaceTrustRequestService, _logService, _notebookExecutionStateService) {
    this._commandService = _commandService;
    this._notebookKernelService = _notebookKernelService;
    this._notebookKernelHistoryService = _notebookKernelHistoryService;
    this._workspaceTrustRequestService = _workspaceTrustRequestService;
    this._logService = _logService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this.cellExecutionParticipants = /* @__PURE__ */ new Set();
  }
  async executeNotebookCells(notebook, cells, contextKeyService) {
    const cellsArr = Array.from(cells).filter((c) => c.cellKind === CellKind.Code);
    if (!cellsArr.length) {
      return;
    }
    this._logService.debug(`Execution`, `${JSON.stringify(cellsArr.map((c) => c.handle))}`);
    const message = nls.localize("notebookRunTrust", "Executing a notebook cell will run code from this workspace.");
    const trust = await this._workspaceTrustRequestService.requestWorkspaceTrust({ message });
    if (!trust) {
      return;
    }
    const cellExecutions = [];
    for (const cell of cellsArr) {
      const cellExe = this._notebookExecutionStateService.getCellExecution(cell.uri);
      if (!!cellExe) {
        continue;
      }
      cellExecutions.push([cell, this._notebookExecutionStateService.createCellExecution(notebook.uri, cell.handle)]);
    }
    const kernel = await KernelPickerMRUStrategy.resolveKernel(notebook, this._notebookKernelService, this._notebookKernelHistoryService, this._commandService);
    if (!kernel) {
      cellExecutions.forEach((cellExe) => cellExe[1].complete({}));
      return;
    }
    this._notebookKernelHistoryService.addMostRecentKernel(kernel);
    const validCellExecutions = [];
    for (const [cell, cellExecution] of cellExecutions) {
      if (!kernel.supportedLanguages.includes(cell.language)) {
        cellExecution.complete({});
      } else {
        validCellExecutions.push(cellExecution);
      }
    }
    if (validCellExecutions.length > 0) {
      await this.runExecutionParticipants(validCellExecutions);
      this._notebookKernelService.selectKernelForNotebook(kernel, notebook);
      await kernel.executeNotebookCellsRequest(notebook.uri, validCellExecutions.map((c) => c.cellHandle));
      const unconfirmed = validCellExecutions.filter((exe) => exe.state === NotebookCellExecutionState.Unconfirmed);
      if (unconfirmed.length) {
        this._logService.debug(`Execution`, `Completing unconfirmed executions ${JSON.stringify(unconfirmed.map((exe) => exe.cellHandle))}`);
        unconfirmed.forEach((exe) => exe.complete({}));
      }
      this._logService.debug(`Execution`, `Completed executions ${JSON.stringify(validCellExecutions.map((exe) => exe.cellHandle))}`);
    }
  }
  async cancelNotebookCellHandles(notebook, cells) {
    const cellsArr = Array.from(cells);
    this._logService.debug(`Execution`, `CancelNotebookCellHandles ${JSON.stringify(cellsArr)}`);
    const kernel = this._notebookKernelService.getSelectedOrSuggestedKernel(notebook);
    if (kernel) {
      await kernel.cancelNotebookCellExecution(notebook.uri, cellsArr);
    }
  }
  async cancelNotebookCells(notebook, cells) {
    this.cancelNotebookCellHandles(notebook, Array.from(cells, (cell) => cell.handle));
  }
  registerExecutionParticipant(participant) {
    this.cellExecutionParticipants.add(participant);
    return toDisposable(() => this.cellExecutionParticipants.delete(participant));
  }
  async runExecutionParticipants(executions) {
    for (const participant of this.cellExecutionParticipants) {
      await participant.onWillExecuteCell(executions);
    }
    return;
  }
  dispose() {
    this._activeProxyKernelExecutionToken?.dispose(true);
  }
};
NotebookExecutionService = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, INotebookKernelService),
  __decorateParam(2, INotebookKernelHistoryService),
  __decorateParam(3, IWorkspaceTrustRequestService),
  __decorateParam(4, INotebookLoggingService),
  __decorateParam(5, INotebookExecutionStateService)
], NotebookExecutionService);
export {
  NotebookExecutionService
};
