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
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { CellEditState, RenderOutputType } from "../../notebookBrowser.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { outputDisplayLimit } from "../../viewModel/codeCellViewModel.js";
import { CellKind } from "../../../common/notebookCommon.js";
import { cellRangesToIndexes } from "../../../common/notebookRange.js";
import { INotebookService } from "../../../common/notebookService.js";
let NotebookViewportContribution = class extends Disposable {
  constructor(_notebookEditor, _notebookService, accessibilityService) {
    super();
    this._notebookEditor = _notebookEditor;
    this._notebookService = _notebookService;
    this._warmupDocument = null;
    this._warmupViewport = new RunOnceScheduler(() => this._warmupViewportNow(), 200);
    this._register(this._warmupViewport);
    this._register(this._notebookEditor.onDidScroll(() => {
      this._warmupViewport.schedule();
    }));
    this._warmupDocument = new RunOnceScheduler(() => this._warmupDocumentNow(), 200);
    this._register(this._warmupDocument);
    this._register(this._notebookEditor.onDidAttachViewModel(() => {
      if (this._notebookEditor.hasModel()) {
        this._warmupDocument?.schedule();
      }
    }));
    if (this._notebookEditor.hasModel()) {
      this._warmupDocument?.schedule();
    }
  }
  static {
    this.id = "workbench.notebook.viewportWarmup";
  }
  _warmupDocumentNow() {
    if (this._notebookEditor.hasModel()) {
      for (let i = 0; i < this._notebookEditor.getLength(); i++) {
        const cell = this._notebookEditor.cellAt(i);
        if (cell?.cellKind === CellKind.Markup && cell?.getEditState() === CellEditState.Preview && !cell.isInputCollapsed) {
        } else if (cell?.cellKind === CellKind.Code) {
          this._warmupCodeCell(cell);
        }
      }
    }
  }
  _warmupViewportNow() {
    if (this._notebookEditor.isDisposed) {
      return;
    }
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    const visibleRanges = this._notebookEditor.getVisibleRangesPlusViewportAboveAndBelow();
    cellRangesToIndexes(visibleRanges).forEach((index) => {
      const cell = this._notebookEditor.cellAt(index);
      if (cell?.cellKind === CellKind.Markup && cell?.getEditState() === CellEditState.Preview && !cell.isInputCollapsed) {
        this._notebookEditor.createMarkupPreview(cell);
      } else if (cell?.cellKind === CellKind.Code) {
        this._warmupCodeCell(cell);
      }
    });
  }
  _warmupCodeCell(viewCell) {
    if (viewCell.isOutputCollapsed) {
      return;
    }
    const outputs = viewCell.outputsViewModels;
    for (const output of outputs.slice(0, outputDisplayLimit)) {
      const [mimeTypes, pick] = output.resolveMimeTypes(this._notebookEditor.textModel, void 0);
      if (!mimeTypes.find((mimeType) => mimeType.isTrusted) || mimeTypes.length === 0) {
        continue;
      }
      const pickedMimeTypeRenderer = mimeTypes[pick];
      if (!pickedMimeTypeRenderer) {
        return;
      }
      if (!this._notebookEditor.hasModel()) {
        return;
      }
      const renderer = this._notebookService.getRendererInfo(pickedMimeTypeRenderer.rendererId);
      if (!renderer) {
        return;
      }
      const result = { type: RenderOutputType.Extension, renderer, source: output, mimeType: pickedMimeTypeRenderer.mimeType };
      this._notebookEditor.createOutput(viewCell, result, 0, true);
    }
  }
};
NotebookViewportContribution = __decorateClass([
  __decorateParam(1, INotebookService),
  __decorateParam(2, IAccessibilityService)
], NotebookViewportContribution);
registerNotebookContribution(NotebookViewportContribution.id, NotebookViewportContribution);
