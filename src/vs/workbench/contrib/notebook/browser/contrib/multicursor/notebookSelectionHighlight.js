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
import { Event } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { Selection, SelectionDirection } from "../../../../../../editor/common/core/selection.js";
import { CursorChangeReason } from "../../../../../../editor/common/cursorEvents.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
let NotebookSelectionHighlighter = class extends Disposable {
  // right now this lets us mimic the more performant cache implementation of the text editor (doesn't need to be a delayer)
  // todo: in the future, implement caching and change to a 250ms delay upon recompute
  // private readonly runDelayer: Delayer<void> = this._register(new Delayer<void>(0));
  constructor(notebookEditor, configurationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.configurationService = configurationService;
    this.isEnabled = false;
    this.cellDecorationIds = /* @__PURE__ */ new Map();
    this.anchorDisposables = new DisposableStore();
    this.isEnabled = this.configurationService.getValue("editor.selectionHighlight");
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.selectionHighlight")) {
        this.isEnabled = this.configurationService.getValue("editor.selectionHighlight");
      }
    }));
    this._register(this.notebookEditor.onDidChangeActiveCell(async () => {
      if (!this.isEnabled) {
        return;
      }
      this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
      if (!this.anchorCell) {
        return;
      }
      const activeCell = this.notebookEditor.getActiveCell();
      if (!activeCell) {
        return;
      }
      if (!activeCell.editorAttached) {
        await Event.toPromise(activeCell.onDidChangeEditorAttachState);
      }
      this.clearNotebookSelectionDecorations();
      this.anchorDisposables.clear();
      this.anchorDisposables.add(this.anchorCell[1].onDidChangeCursorPosition((e) => {
        if (e.reason !== CursorChangeReason.Explicit) {
          this.clearNotebookSelectionDecorations();
          return;
        }
        if (!this.anchorCell) {
          return;
        }
        if (this.notebookEditor.hasModel()) {
          this.clearNotebookSelectionDecorations();
          this._update(this.notebookEditor);
        }
      }));
      if (this.notebookEditor.getEditorViewState().editorFocused && this.notebookEditor.hasModel()) {
        this._update(this.notebookEditor);
      }
    }));
  }
  static {
    this.id = "notebook.selectionHighlighter";
  }
  _update(editor) {
    if (!this.anchorCell || !this.isEnabled) {
      return;
    }
    const textModel = this.anchorCell[0].textModel;
    if (!textModel || textModel.isTooLargeForTokenization()) {
      return;
    }
    const s = this.anchorCell[0].getSelections()[0];
    if (s.startLineNumber !== s.endLineNumber || s.isEmpty()) {
      return;
    }
    const searchText = this.getSearchText(s, textModel);
    if (!searchText) {
      return;
    }
    const results = editor.textModel.findMatches(
      searchText,
      false,
      true,
      null
    );
    for (const res of results) {
      const cell = editor.getCellByHandle(res.cell.handle);
      if (!cell) {
        continue;
      }
      this.updateCellDecorations(cell, res.matches);
    }
  }
  updateCellDecorations(cell, matches) {
    const selections = matches.map((m) => {
      return Selection.fromRange(m.range, SelectionDirection.LTR);
    });
    const newDecorations = [];
    selections?.map((selection) => {
      const isEmpty = selection.isEmpty();
      if (!isEmpty) {
        newDecorations.push({
          range: selection,
          options: {
            description: "",
            className: ".nb-selection-highlight"
          }
        });
      }
    });
    const oldDecorations = this.cellDecorationIds.get(cell) ?? [];
    this.cellDecorationIds.set(cell, cell.deltaModelDecorations(
      oldDecorations,
      newDecorations
    ));
  }
  clearNotebookSelectionDecorations() {
    this.cellDecorationIds.forEach((_, cell) => {
      const cellDecorations = this.cellDecorationIds.get(cell) ?? [];
      if (cellDecorations) {
        cell.deltaModelDecorations(cellDecorations, []);
        this.cellDecorationIds.delete(cell);
      }
    });
  }
  getSearchText(selection, model) {
    return model.getValueInRange(selection).replace(/\r\n/g, "\n");
  }
  dispose() {
    super.dispose();
    this.anchorDisposables.dispose();
  }
};
NotebookSelectionHighlighter = __decorateClass([
  __decorateParam(1, IConfigurationService)
], NotebookSelectionHighlighter);
registerNotebookContribution(NotebookSelectionHighlighter.id, NotebookSelectionHighlighter);
