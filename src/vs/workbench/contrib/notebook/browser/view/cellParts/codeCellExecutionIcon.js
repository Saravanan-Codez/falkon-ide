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
import * as DOM from "../../../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { errorStateIcon, executingStateIcon, pendingStateIcon, successStateIcon } from "../../notebookIcons.js";
import { NotebookCellExecutionState } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
let CollapsedCodeCellExecutionIcon = class extends Disposable {
  constructor(_notebookEditor, _cell, _element, _executionStateService) {
    super();
    this._cell = _cell;
    this._element = _element;
    this._executionStateService = _executionStateService;
    this._visible = false;
    this._update();
    this._register(this._executionStateService.onDidChangeExecution((e) => {
      if (e.type === NotebookExecutionType.cell && e.affectsCell(this._cell.uri)) {
        this._update();
      }
    }));
    this._register(this._cell.model.onDidChangeInternalMetadata(() => this._update()));
  }
  setVisibility(visible) {
    this._visible = visible;
    this._update();
  }
  _update() {
    if (!this._visible) {
      return;
    }
    const runState = this._executionStateService.getCellExecution(this._cell.uri);
    const item = this._getItemForState(runState, this._cell.model.internalMetadata);
    if (item) {
      this._element.style.display = "";
      DOM.reset(this._element, ...renderLabelWithIcons(item.text));
      this._element.title = item.tooltip ?? "";
    } else {
      this._element.style.display = "none";
      DOM.reset(this._element);
    }
  }
  _getItemForState(runState, internalMetadata) {
    const state = runState?.state;
    const { lastRunSuccess } = internalMetadata;
    if (!state && lastRunSuccess) {
      return {
        text: `$(${successStateIcon.id})`,
        tooltip: localize("notebook.cell.status.success", "Success")
      };
    } else if (!state && lastRunSuccess === false) {
      return {
        text: `$(${errorStateIcon.id})`,
        tooltip: localize("notebook.cell.status.failure", "Failure")
      };
    } else if (state === NotebookCellExecutionState.Pending || state === NotebookCellExecutionState.Unconfirmed) {
      return {
        text: `$(${pendingStateIcon.id})`,
        tooltip: localize("notebook.cell.status.pending", "Pending")
      };
    } else if (state === NotebookCellExecutionState.Executing) {
      const icon = ThemeIcon.modify(executingStateIcon, "spin");
      return {
        text: `$(${icon.id})`,
        tooltip: localize("notebook.cell.status.executing", "Executing")
      };
    }
    return;
  }
};
CollapsedCodeCellExecutionIcon = __decorateClass([
  __decorateParam(3, INotebookExecutionStateService)
], CollapsedCodeCellExecutionIcon);
export {
  CollapsedCodeCellExecutionIcon
};
