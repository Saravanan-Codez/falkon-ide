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
import { ActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, debouncedObservable, observableFromEvent, observableValue } from "../../../../../../base/common/observable.js";
import { basename } from "../../../../../../base/common/resources.js";
import { assertType } from "../../../../../../base/common/types.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { LineRange } from "../../../../../../editor/common/core/ranges/lineRange.js";
import { nullDocumentDiff } from "../../../../../../editor/common/diff/documentDiffProvider.js";
import { PrefixSumComputer } from "../../../../../../editor/common/model/prefixSumComputer.js";
import { localize } from "../../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { NotebookDeletedCellDecorator } from "../../../../notebook/browser/diff/inlineDiff/notebookDeletedCellDecorator.js";
import { NotebookInsertedCellDecorator } from "../../../../notebook/browser/diff/inlineDiff/notebookInsertedCellDecorator.js";
import { NotebookModifiedCellDecorator } from "../../../../notebook/browser/diff/inlineDiff/notebookModifiedCellDecorator.js";
import { CellEditState, getNotebookEditorFromEditorPane } from "../../../../notebook/browser/notebookBrowser.js";
import { INotebookEditorService } from "../../../../notebook/browser/services/notebookEditorService.js";
import { CellKind } from "../../../../notebook/common/notebookCommon.js";
import { ChatEditingCodeEditorIntegration } from "../chatEditingCodeEditorIntegration.js";
import { countChanges, sortCellChanges } from "./notebookCellChanges.js";
import { OverlayToolbarDecorator } from "./overlayToolbarDecorator.js";
let ChatEditingNotebookEditorIntegration = class extends Disposable {
  constructor(_entry, editor, notebookModel, originalModel, cellChanges, instantiationService) {
    super();
    this.instantiationService = instantiationService;
    const notebookEditor = getNotebookEditorFromEditorPane(editor);
    assertType(notebookEditor);
    this.notebookEditor = notebookEditor;
    this.integration = this.instantiationService.createInstance(ChatEditingNotebookEditorWidgetIntegration, _entry, notebookEditor, notebookModel, originalModel, cellChanges);
    this._register(editor.onDidChangeControl(() => {
      const notebookEditor2 = getNotebookEditorFromEditorPane(editor);
      if (notebookEditor2 && notebookEditor2 !== this.notebookEditor) {
        this.notebookEditor = notebookEditor2;
        this.integration.dispose();
        this.integration = this.instantiationService.createInstance(ChatEditingNotebookEditorWidgetIntegration, _entry, notebookEditor2, notebookModel, originalModel, cellChanges);
      }
    }));
  }
  get currentIndex() {
    return this.integration.currentIndex;
  }
  reveal(firstOrLast) {
    return this.integration.reveal(firstOrLast);
  }
  next(wrap) {
    return this.integration.next(wrap);
  }
  previous(wrap) {
    return this.integration.previous(wrap);
  }
  enableAccessibleDiffView() {
    this.integration.enableAccessibleDiffView();
  }
  acceptNearestChange(change) {
    return this.integration.acceptNearestChange(change);
  }
  rejectNearestChange(change) {
    return this.integration.rejectNearestChange(change);
  }
  toggleDiff(change, show) {
    return this.integration.toggleDiff(change, show);
  }
  dispose() {
    this.integration.dispose();
    super.dispose();
  }
};
ChatEditingNotebookEditorIntegration = __decorateClass([
  __decorateParam(5, IInstantiationService)
], ChatEditingNotebookEditorIntegration);
let ChatEditingNotebookEditorWidgetIntegration = class extends Disposable {
  constructor(_entry, notebookEditor, notebookModel, originalModel, cellChanges, instantiationService, _editorService, notebookEditorService, accessibilitySignalService, logService) {
    super();
    this._entry = _entry;
    this.notebookEditor = notebookEditor;
    this.notebookModel = notebookModel;
    this.cellChanges = cellChanges;
    this.instantiationService = instantiationService;
    this._editorService = _editorService;
    this.accessibilitySignalService = accessibilitySignalService;
    this.logService = logService;
    this._currentIndex = observableValue(this, -1);
    this.currentIndex = this._currentIndex;
    this.cellEditorIntegrations = /* @__PURE__ */ new Map();
    this.markdownEditState = observableValue(this, "");
    this.markupCellListeners = /* @__PURE__ */ new Map();
    this.sortedCellChanges = [];
    this.changeIndexComputer = new PrefixSumComputer(new Uint32Array(0));
    const onDidChangeVisibleRanges = debouncedObservable(observableFromEvent(notebookEditor.onDidChangeVisibleRanges, () => notebookEditor.visibleRanges), 50);
    this._register(toDisposable(() => {
      this.markupCellListeners.forEach((v) => v.dispose());
    }));
    let originalReadonly = void 0;
    const shouldBeReadonly = _entry.isCurrentlyBeingModifiedBy.map((value) => !!value);
    this._register(autorun((r) => {
      const isReadOnly = shouldBeReadonly.read(r);
      const notebookEditor2 = notebookEditorService.retrieveExistingWidgetFromURI(_entry.modifiedURI)?.value;
      if (!notebookEditor2) {
        return;
      }
      if (isReadOnly) {
        originalReadonly ??= notebookEditor2.isReadOnly;
        notebookEditor2.setOptions({ isReadOnly: true });
      } else if (originalReadonly === false) {
        notebookEditor2.setOptions({ isReadOnly: false });
        const timeout = setTimeout(() => {
          notebookEditor2.setOptions({ isReadOnly: true });
          notebookEditor2.setOptions({ isReadOnly: false });
          disposable.dispose();
        }, 100);
        const disposable = toDisposable(() => clearTimeout(timeout));
        r.store.add(disposable);
      }
    }));
    let lastModifyingRequestId;
    this._store.add(autorun((r) => {
      if (!_entry.isCurrentlyBeingModifiedBy.read(r) && !_entry.isProcessingResponse.read(r) && lastModifyingRequestId !== _entry.lastModifyingRequestId && cellChanges.read(r).some((c) => c.type !== "unchanged" && !c.diff.read(r).identical)) {
        lastModifyingRequestId = _entry.lastModifyingRequestId;
        const visibleChange = this.sortedCellChanges.find((c) => {
          if (c.type === "unchanged") {
            return false;
          }
          const index = c.modifiedCellIndex ?? c.originalCellIndex;
          return this.notebookEditor.visibleRanges.some((range) => index >= range.start && index < range.end);
        });
        if (!visibleChange) {
          this.reveal(true);
        }
      }
    }));
    this._register(autorun((r) => {
      this.sortedCellChanges = sortCellChanges(cellChanges.read(r));
      const indexes = [];
      for (const change of this.sortedCellChanges) {
        indexes.push(change.type === "insert" || change.type === "delete" ? 1 : change.type === "modified" ? change.diff.read(r).changes.length : 0);
      }
      this.changeIndexComputer = new PrefixSumComputer(new Uint32Array(indexes));
      if (this.changeIndexComputer.getTotalSum() === 0) {
        this.revertMarkupCellState();
      }
    }));
    this._register(autorun((r) => {
      if (this.notebookEditor.textModel !== this.notebookModel) {
        return;
      }
      const sortedCellChanges = sortCellChanges(cellChanges.read(r));
      const changes = sortedCellChanges.filter((c) => c.type !== "delete");
      onDidChangeVisibleRanges.read(r);
      if (!changes.length) {
        this.cellEditorIntegrations.forEach(({ diff }) => {
          diff.set({ ...diff.read(void 0), ...nullDocumentDiff }, void 0);
        });
        return;
      }
      this.markdownEditState.read(r);
      const validCells = /* @__PURE__ */ new Set();
      changes.forEach((change) => {
        if (change.modifiedCellIndex === void 0 || change.modifiedCellIndex >= notebookModel.cells.length) {
          return;
        }
        const cell = notebookModel.cells[change.modifiedCellIndex];
        const editor = notebookEditor.codeEditors.find(([vm]) => vm.handle === notebookModel.cells[change.modifiedCellIndex].handle)?.[1];
        const modifiedModel = change.modifiedModel.promiseResult.read(r)?.data;
        const originalModel2 = change.originalModel.promiseResult.read(r)?.data;
        if (!cell || !originalModel2 || !modifiedModel) {
          return;
        }
        if (cell.cellKind === CellKind.Markup && !this.markupCellListeners.has(cell.handle)) {
          const cellModel = this.notebookEditor.getViewModel()?.viewCells.find((c) => c.handle === cell.handle);
          if (cellModel) {
            const listener = cellModel.onDidChangeState((e) => {
              if (e.editStateChanged) {
                setTimeout(() => this.markdownEditState.set(cellModel.handle + "-" + cellModel.getEditState(), void 0), 0);
              }
            });
            this.markupCellListeners.set(cell.handle, listener);
          }
        }
        if (!editor) {
          return;
        }
        const diff = {
          ...change.diff.read(r),
          modifiedModel,
          originalModel: originalModel2,
          keep: change.keep,
          undo: change.undo
        };
        validCells.add(cell);
        const currentDiff = this.cellEditorIntegrations.get(cell);
        if (currentDiff) {
          if (!areDocumentDiff2Equal(currentDiff.diff.read(void 0), diff)) {
            currentDiff.diff.set(diff, void 0);
          }
        } else {
          const diff2 = observableValue(`diff${cell.handle}`, diff);
          const integration = this.instantiationService.createInstance(ChatEditingCodeEditorIntegration, _entry, editor, diff2, true);
          this.cellEditorIntegrations.set(cell, { integration, diff: diff2 });
          this._register(integration);
          this._register(editor.onDidDispose(() => {
            this.cellEditorIntegrations.get(cell)?.integration.dispose();
            this.cellEditorIntegrations.delete(cell);
          }));
          this._register(editor.onDidChangeModel(() => {
            if (editor.getModel() !== cell.textModel) {
              this.cellEditorIntegrations.get(cell)?.integration.dispose();
              this.cellEditorIntegrations.delete(cell);
            }
          }));
        }
      });
      this.cellEditorIntegrations.forEach((v, cell) => {
        if (!validCells.has(cell)) {
          v.integration.dispose();
          this.cellEditorIntegrations.delete(cell);
        }
      });
    }));
    const cellsAreVisible = onDidChangeVisibleRanges.map((v) => v.length > 0);
    const debouncedChanges = debouncedObservable(cellChanges, 10);
    this._register(autorun((r) => {
      if (this.notebookEditor.textModel !== this.notebookModel || !cellsAreVisible.read(r) || !this.notebookEditor.getViewModel()) {
        return;
      }
      const changes = debouncedChanges.read(r).filter((c) => c.type === "insert" ? !c.diff.read(r).identical : true);
      const modifiedChanges = changes.filter((c) => c.type === "modified");
      this.createDecorators();
      if (changes.every((c) => c.type === "insert")) {
        this.insertedCellDecorator?.apply([]);
        this.modifiedCellDecorator?.apply([]);
        this.deletedCellDecorator?.apply([], originalModel);
        this.overlayToolbarDecorator?.decorate([]);
      } else {
        this.insertedCellDecorator?.apply(changes);
        this.modifiedCellDecorator?.apply(modifiedChanges);
        this.deletedCellDecorator?.apply(changes, originalModel);
        this.overlayToolbarDecorator?.decorate(changes.filter((c) => c.type === "insert" || c.type === "modified"));
      }
    }));
  }
  getCurrentChange() {
    const currentIndex = Math.min(this._currentIndex.get(), this.changeIndexComputer.getTotalSum() - 1);
    const index = this.changeIndexComputer.getIndexOf(currentIndex);
    const change = this.sortedCellChanges[index.index];
    return change ? { change, index: index.remainder } : void 0;
  }
  updateCurrentIndex(change, indexInCell = 0) {
    const index = this.sortedCellChanges.indexOf(change);
    const changeIndex = this.changeIndexComputer.getPrefixSum(index - 1);
    const currentIndex = Math.min(changeIndex + indexInCell, this.changeIndexComputer.getTotalSum() - 1);
    this._currentIndex.set(currentIndex, void 0);
  }
  createDecorators() {
    const cellChanges = this.cellChanges.get();
    const accessibilitySignalService = this.accessibilitySignalService;
    this.insertedCellDecorator ??= this._register(this.instantiationService.createInstance(NotebookInsertedCellDecorator, this.notebookEditor));
    this.modifiedCellDecorator ??= this._register(this.instantiationService.createInstance(NotebookModifiedCellDecorator, this.notebookEditor));
    this.overlayToolbarDecorator ??= this._register(this.instantiationService.createInstance(OverlayToolbarDecorator, this.notebookEditor, this.notebookModel));
    if (this.deletedCellDecorator) {
      this._store.delete(this.deletedCellDecorator);
      this.deletedCellDecorator.dispose();
    }
    this.deletedCellDecorator = this._register(this.instantiationService.createInstance(NotebookDeletedCellDecorator, this.notebookEditor, {
      className: "chat-diff-change-content-widget",
      telemetrySource: "chatEditingNotebookHunk",
      menuId: MenuId.ChatEditingEditorHunk,
      actionViewItemProvider: (action, options) => {
        if (!action.class) {
          return new class extends ActionViewItem {
            constructor() {
              super(void 0, action, { ...options, keybindingNotRenderedWithLabel: true, icon: false, label: true });
            }
          }();
        }
        return void 0;
      },
      argFactory: (deletedCellIndex) => {
        return {
          accept() {
            const entry = cellChanges.find((c) => c.type === "delete" && c.originalCellIndex === deletedCellIndex);
            if (entry) {
              return entry.keep(entry.diff.get().changes[0]);
            }
            accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
            return Promise.resolve(true);
          },
          reject() {
            const entry = cellChanges.find((c) => c.type === "delete" && c.originalCellIndex === deletedCellIndex);
            if (entry) {
              return entry.undo(entry.diff.get().changes[0]);
            }
            accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
            return Promise.resolve(true);
          }
        };
      }
    }));
  }
  getCell(modifiedCellIndex) {
    const cell = this.notebookModel.cells[modifiedCellIndex];
    const integration = this.cellEditorIntegrations.get(cell)?.integration;
    return integration;
  }
  reveal(firstOrLast) {
    const changes = this.sortedCellChanges.filter((c) => c.type !== "unchanged");
    if (!changes.length) {
      return;
    }
    const change = firstOrLast ? changes[0] : changes[changes.length - 1];
    this._revealFirstOrLast(change, firstOrLast);
  }
  _revealFirstOrLast(change, firstOrLast = true) {
    switch (change.type) {
      case "insert":
      case "modified": {
        this.blur(this.getCurrentChange()?.change);
        const index = firstOrLast || change.type === "insert" ? 0 : change.diff.get().changes.length - 1;
        return this._revealChange(change, index);
      }
      case "delete":
        this.blur(this.getCurrentChange()?.change);
        this.deletedCellDecorator?.reveal(change.originalCellIndex);
        this.updateCurrentIndex(change);
        return true;
      default:
        break;
    }
    return false;
  }
  _revealChange(change, indexInCell) {
    switch (change.type) {
      case "insert":
      case "modified": {
        const textChange = change.diff.get().changes[indexInCell];
        const cellViewModel = this.getCellViewModel(change);
        if (cellViewModel) {
          this.updateCurrentIndex(change, indexInCell);
          this.revealChangeInView(cellViewModel, textChange?.modified, change).catch((err) => {
            this.logService.warn(`Error revealing change in view: ${err}`);
          });
          return true;
        }
        break;
      }
      case "delete":
        this.updateCurrentIndex(change);
        this.deletedCellDecorator?.reveal(change.originalCellIndex);
        return true;
      default:
        break;
    }
    return false;
  }
  getCellViewModel(change) {
    if (change.type === "delete" || change.modifiedCellIndex === void 0 || change.modifiedCellIndex >= this.notebookModel.cells.length) {
      return void 0;
    }
    const cell = this.notebookModel.cells[change.modifiedCellIndex];
    const cellViewModel = this.notebookEditor.getViewModel()?.viewCells.find((c) => c.handle === cell.handle);
    return cellViewModel;
  }
  async revealChangeInView(cell, lines, change) {
    const targetLines = lines ?? new LineRange(0, 0);
    if (change.type === "modified" && cell.cellKind === CellKind.Markup && cell.getEditState() === CellEditState.Preview) {
      cell.updateEditState(CellEditState.Editing, "chatEditNavigation");
    }
    const focusTarget = cell.cellKind === CellKind.Code || change.type === "modified" ? "editor" : "container";
    await this.notebookEditor.focusNotebookCell(cell, focusTarget, { focusEditorLine: targetLines.startLineNumber });
    await this.notebookEditor.revealRangeInCenterAsync(cell, new Range(targetLines.startLineNumber, 0, targetLines.endLineNumberExclusive, 0));
  }
  revertMarkupCellState() {
    for (const change of this.sortedCellChanges) {
      const cellViewModel = this.getCellViewModel(change);
      if (cellViewModel?.cellKind === CellKind.Markup && cellViewModel.getEditState() === CellEditState.Editing && (cellViewModel.editStateSource === "chatEditNavigation" || cellViewModel.editStateSource === "chatEdit")) {
        cellViewModel.updateEditState(CellEditState.Preview, "chatEdit");
      }
    }
  }
  blur(change) {
    if (!change) {
      return;
    }
    const cellViewModel = this.getCellViewModel(change);
    if (cellViewModel?.cellKind === CellKind.Markup && cellViewModel.getEditState() === CellEditState.Editing && cellViewModel.editStateSource === "chatEditNavigation") {
      cellViewModel.updateEditState(CellEditState.Preview, "chatEditNavigation");
    }
  }
  next(wrap) {
    const changes = this.sortedCellChanges.filter((c) => c.type !== "unchanged");
    const currentChange = this.getCurrentChange();
    if (!currentChange) {
      const firstChange = changes[0];
      if (firstChange) {
        return this._revealFirstOrLast(firstChange);
      }
      return false;
    }
    switch (currentChange.change.type) {
      case "modified":
        {
          const cellIntegration = this.getCell(currentChange.change.modifiedCellIndex);
          if (cellIntegration) {
            if (cellIntegration.next(false)) {
              this.updateCurrentIndex(currentChange.change, cellIntegration.currentIndex.get());
              return true;
            }
          }
          const isLastChangeInCell = currentChange.index >= lastChangeIndex(currentChange.change);
          const index = isLastChangeInCell ? 0 : currentChange.index + 1;
          const change = isLastChangeInCell ? changes[changes.indexOf(currentChange.change) + 1] : currentChange.change;
          if (change) {
            if (isLastChangeInCell) {
              this.blur(currentChange.change);
            }
            if (this._revealChange(change, index)) {
              return true;
            }
          }
        }
        break;
      case "insert":
      case "delete":
        {
          this.blur(currentChange.change);
          const nextChange = changes[changes.indexOf(currentChange.change) + 1];
          if (nextChange && this._revealFirstOrLast(nextChange, true)) {
            return true;
          }
        }
        break;
      default:
        break;
    }
    if (wrap) {
      const firstChange = changes[0];
      if (firstChange) {
        return this._revealFirstOrLast(firstChange, true);
      }
    }
    return false;
  }
  previous(wrap) {
    const changes = this.sortedCellChanges.filter((c) => c.type !== "unchanged");
    const currentChange = this.getCurrentChange();
    if (!currentChange) {
      const lastChange = changes[changes.length - 1];
      if (lastChange) {
        return this._revealFirstOrLast(lastChange, false);
      }
      return false;
    }
    switch (currentChange.change.type) {
      case "modified":
        {
          const cellIntegration = this.getCell(currentChange.change.modifiedCellIndex);
          if (cellIntegration) {
            if (cellIntegration.previous(false)) {
              this.updateCurrentIndex(currentChange.change, cellIntegration.currentIndex.get());
              return true;
            }
          }
          const isFirstChangeInCell = currentChange.index <= 0;
          const change = isFirstChangeInCell ? changes[changes.indexOf(currentChange.change) - 1] : currentChange.change;
          if (change) {
            const index = isFirstChangeInCell ? lastChangeIndex(change) : currentChange.index - 1;
            if (isFirstChangeInCell) {
              this.blur(currentChange.change);
            }
            if (this._revealChange(change, index)) {
              return true;
            }
          }
        }
        break;
      case "insert":
      case "delete":
        {
          this.blur(currentChange.change);
          const prevChange = changes[changes.indexOf(currentChange.change) - 1];
          if (prevChange && this._revealFirstOrLast(prevChange, false)) {
            return true;
          }
        }
        break;
      default:
        break;
    }
    if (wrap) {
      const lastChange = changes[changes.length - 1];
      if (lastChange) {
        return this._revealFirstOrLast(lastChange, false);
      }
    }
    return false;
  }
  enableAccessibleDiffView() {
    const cell = this.notebookEditor.getActiveCell()?.model;
    if (cell) {
      const integration = this.cellEditorIntegrations.get(cell)?.integration;
      integration?.enableAccessibleDiffView();
    }
  }
  getfocusedIntegration() {
    const first = this.notebookEditor.getSelectionViewModels()[0];
    if (first) {
      return this.cellEditorIntegrations.get(first.model)?.integration;
    }
    return void 0;
  }
  async acceptNearestChange(hunk) {
    if (hunk) {
      await hunk.accept();
    } else {
      const current = this.getCurrentChange();
      const focused = this.getfocusedIntegration();
      if (current && !focused || current?.change.type === "delete") {
        current.change.keep(current?.change.diff.get().changes[current.index]);
      } else if (focused) {
        await focused.acceptNearestChange();
      }
      this._currentIndex.set(this._currentIndex.get() - 1, void 0);
      this.next(true);
    }
  }
  async rejectNearestChange(hunk) {
    if (hunk) {
      await hunk.reject();
    } else {
      const current = this.getCurrentChange();
      const focused = this.getfocusedIntegration();
      if (current && !focused || current?.change.type === "delete") {
        current.change.undo(current.change.diff.get().changes[current.index]);
      } else if (focused) {
        await focused.rejectNearestChange();
      }
      this._currentIndex.set(this._currentIndex.get() - 1, void 0);
      this.next(true);
    }
  }
  async toggleDiff(_change, _show) {
    const diffInput = {
      original: { resource: this._entry.originalURI },
      modified: { resource: this._entry.modifiedURI },
      label: localize("diff.generic", "{0} (changes from chat)", basename(this._entry.modifiedURI))
    };
    await this._editorService.openEditor(diffInput);
  }
};
ChatEditingNotebookEditorWidgetIntegration = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, INotebookEditorService),
  __decorateParam(8, IAccessibilitySignalService),
  __decorateParam(9, ILogService)
], ChatEditingNotebookEditorWidgetIntegration);
class ChatEditingNotebookDiffEditorIntegration extends Disposable {
  constructor(notebookDiffEditor, cellChanges) {
    super();
    this.notebookDiffEditor = notebookDiffEditor;
    this.cellChanges = cellChanges;
    this._currentIndex = observableValue(this, -1);
    this.currentIndex = this._currentIndex;
    this._store.add(autorun((r) => {
      const index = notebookDiffEditor.currentChangedIndex.read(r);
      const numberOfCellChanges = cellChanges.read(r).filter((c) => !c.diff.read(r).identical);
      if (numberOfCellChanges.length && index >= 0 && index < numberOfCellChanges.length) {
        const changesSoFar = countChanges(numberOfCellChanges.slice(0, index + 1));
        this._currentIndex.set(changesSoFar - 1, void 0);
      } else {
        this._currentIndex.set(-1, void 0);
      }
    }));
  }
  reveal(firstOrLast) {
    const changes = sortCellChanges(this.cellChanges.get().filter((c) => c.type !== "unchanged"));
    if (!changes.length) {
      return void 0;
    }
    if (firstOrLast) {
      this.notebookDiffEditor.firstChange();
    } else {
      this.notebookDiffEditor.lastChange();
    }
  }
  next(_wrap) {
    const changes = this.cellChanges.get().filter((c) => !c.diff.get().identical).length;
    if (this.notebookDiffEditor.currentChangedIndex.get() === changes - 1) {
      return false;
    }
    this.notebookDiffEditor.nextChange();
    return true;
  }
  previous(_wrap) {
    const changes = this.cellChanges.get().filter((c) => !c.diff.get().identical).length;
    if (this.notebookDiffEditor.currentChangedIndex.get() === changes - 1) {
      return false;
    }
    this.notebookDiffEditor.nextChange();
    return true;
  }
  enableAccessibleDiffView() {
  }
  async acceptNearestChange(change) {
    await change.accept();
    this.next(true);
  }
  async rejectNearestChange(change) {
    await change.reject();
    this.next(true);
  }
  async toggleDiff(_change, _show) {
  }
}
function areDocumentDiff2Equal(diff1, diff2) {
  if (diff1.changes !== diff2.changes) {
    return false;
  }
  if (diff1.identical !== diff2.identical) {
    return false;
  }
  if (diff1.moves !== diff2.moves) {
    return false;
  }
  if (diff1.originalModel !== diff2.originalModel) {
    return false;
  }
  if (diff1.modifiedModel !== diff2.modifiedModel) {
    return false;
  }
  if (diff1.keep !== diff2.keep) {
    return false;
  }
  if (diff1.undo !== diff2.undo) {
    return false;
  }
  if (diff1.quitEarly !== diff2.quitEarly) {
    return false;
  }
  return true;
}
function lastChangeIndex(change) {
  if (change.type === "modified") {
    return change.diff.get().changes.length - 1;
  }
  return 0;
}
export {
  ChatEditingNotebookDiffEditorIntegration,
  ChatEditingNotebookEditorIntegration
};
