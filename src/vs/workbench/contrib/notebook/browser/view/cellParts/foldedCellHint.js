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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { FoldingController } from "../../controller/foldingController.js";
import { CellEditState, CellFoldingState } from "../../notebookBrowser.js";
import { CellContentPart } from "../cellPart.js";
import { executingStateIcon } from "../../notebookIcons.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
import { CellKind, NotebookCellExecutionState } from "../../../common/notebookCommon.js";
import { MutableDisposable } from "../../../../../../base/common/lifecycle.js";
let FoldedCellHint = class extends CellContentPart {
  constructor(_notebookEditor, _container, _notebookExecutionStateService) {
    super();
    this._notebookEditor = _notebookEditor;
    this._container = _container;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this._runButtonListener = this._register(new MutableDisposable());
    this._cellExecutionListener = this._register(new MutableDisposable());
  }
  didRenderCell(element) {
    this.update(element);
  }
  update(element) {
    if (!this._notebookEditor.hasModel()) {
      this._cellExecutionListener.clear();
      this._runButtonListener.clear();
      return;
    }
    if (element.isInputCollapsed || element.getEditState() === CellEditState.Editing) {
      this._cellExecutionListener.clear();
      this._runButtonListener.clear();
      DOM.hide(this._container);
    } else if (element.foldingState === CellFoldingState.Collapsed) {
      const idx = this._notebookEditor.getViewModel().getCellIndex(element);
      const length = this._notebookEditor.getViewModel().getFoldedLength(idx);
      const runSectionButton = this.getRunFoldedSectionButton({ start: idx, end: idx + length + 1 });
      if (!runSectionButton) {
        DOM.reset(this._container, this.getHiddenCellsLabel(length), this.getHiddenCellHintButton(element));
      } else {
        DOM.reset(this._container, runSectionButton, this.getHiddenCellsLabel(length), this.getHiddenCellHintButton(element));
      }
      DOM.show(this._container);
      const foldHintTop = element.layoutInfo.previewHeight;
      this._container.style.top = `${foldHintTop}px`;
    } else {
      this._cellExecutionListener.clear();
      this._runButtonListener.clear();
      DOM.hide(this._container);
    }
  }
  getHiddenCellsLabel(num) {
    const label = num === 1 ? localize("hiddenCellsLabel", "1 cell hidden") : localize("hiddenCellsLabelPlural", "{0} cells hidden", num);
    return DOM.$("span.notebook-folded-hint-label", void 0, label);
  }
  getHiddenCellHintButton(element) {
    const expandIcon = DOM.$("span.cell-expand-part-button");
    expandIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.more));
    this._register(DOM.addDisposableListener(expandIcon, DOM.EventType.CLICK, () => {
      const controller = this._notebookEditor.getContribution(FoldingController.id);
      const idx = this._notebookEditor.getCellIndex(element);
      if (typeof idx === "number") {
        controller.setFoldingStateDown(idx, CellFoldingState.Expanded, 1);
      }
    }));
    return expandIcon;
  }
  getRunFoldedSectionButton(range) {
    const runAllContainer = DOM.$("span.folded-cell-run-section-button");
    const cells = this._notebookEditor.getCellsInRange(range);
    const hasCodeCells = cells.some((cell) => cell.cellKind === CellKind.Code);
    if (!hasCodeCells) {
      return void 0;
    }
    const isRunning = cells.some((cell) => {
      const cellExecution = this._notebookExecutionStateService.getCellExecution(cell.uri);
      return cellExecution && cellExecution.state === NotebookCellExecutionState.Executing;
    });
    const runAllIcon = isRunning ? ThemeIcon.modify(executingStateIcon, "spin") : Codicon.play;
    runAllContainer.classList.add(...ThemeIcon.asClassNameArray(runAllIcon));
    this._runButtonListener.value = DOM.addDisposableListener(runAllContainer, DOM.EventType.CLICK, () => {
      this._notebookEditor.executeNotebookCells(cells);
    });
    this._cellExecutionListener.value = this._notebookExecutionStateService.onDidChangeExecution(() => {
      const isRunning2 = cells.some((cell) => {
        const cellExecution = this._notebookExecutionStateService.getCellExecution(cell.uri);
        return cellExecution && cellExecution.state === NotebookCellExecutionState.Executing;
      });
      const runAllIcon2 = isRunning2 ? ThemeIcon.modify(executingStateIcon, "spin") : Codicon.play;
      runAllContainer.className = "";
      runAllContainer.classList.add("folded-cell-run-section-button", ...ThemeIcon.asClassNameArray(runAllIcon2));
    });
    return runAllContainer;
  }
  updateInternalLayoutNow(element) {
    this.update(element);
  }
};
FoldedCellHint = __decorateClass([
  __decorateParam(2, INotebookExecutionStateService)
], FoldedCellHint);
export {
  FoldedCellHint
};
