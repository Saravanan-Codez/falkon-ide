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
import { Emitter } from "../../../../../base/common/event.js";
import { DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IMarkerService } from "../../../../../platform/markers/common/markers.js";
import { CellKind } from "../../common/notebookCommon.js";
import { OutlineConfigKeys } from "../../../../services/outline/browser/outline.js";
import { INotebookOutlineEntryFactory } from "./notebookOutlineEntryFactory.js";
let NotebookCellOutlineDataSource = class {
  constructor(_editor, _markerService, _configurationService, _outlineEntryFactory) {
    this._editor = _editor;
    this._markerService = _markerService;
    this._configurationService = _configurationService;
    this._outlineEntryFactory = _outlineEntryFactory;
    this._disposables = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._entries = [];
    this.recomputeState();
  }
  get activeElement() {
    return this._activeEntry;
  }
  get entries() {
    return this._entries;
  }
  get isEmpty() {
    return this._entries.length === 0;
  }
  get uri() {
    return this._uri;
  }
  async computeFullSymbols(cancelToken) {
    try {
      const notebookEditorWidget = this._editor;
      const notebookCells = notebookEditorWidget?.getViewModel()?.viewCells.filter((cell) => cell.cellKind === CellKind.Code);
      if (notebookCells) {
        const promises = [];
        for (const cell of notebookCells.slice(0, 50)) {
          promises.push(this._outlineEntryFactory.cacheSymbols(cell, cancelToken));
        }
        await Promise.allSettled(promises);
      }
      this.recomputeState();
    } catch (err) {
      console.error("Failed to compute notebook outline symbols:", err);
      this.recomputeState();
    }
  }
  recomputeState() {
    this._disposables.clear();
    this._activeEntry = void 0;
    this._uri = void 0;
    if (!this._editor.hasModel()) {
      return;
    }
    this._uri = this._editor.textModel.uri;
    const notebookEditorWidget = this._editor;
    if (notebookEditorWidget.getLength() === 0) {
      return;
    }
    const notebookCells = notebookEditorWidget.getViewModel().viewCells;
    const entries = [];
    for (const cell of notebookCells) {
      entries.push(...this._outlineEntryFactory.getOutlineEntries(cell, entries.length));
    }
    if (entries.length > 0) {
      const result = [entries[0]];
      const parentStack = [entries[0]];
      for (let i = 1; i < entries.length; i++) {
        const entry = entries[i];
        while (true) {
          const len = parentStack.length;
          if (len === 0) {
            result.push(entry);
            parentStack.push(entry);
            break;
          } else {
            const parentCandidate = parentStack[len - 1];
            if (parentCandidate.level < entry.level) {
              parentCandidate.addChild(entry);
              parentStack.push(entry);
              break;
            } else {
              parentStack.pop();
            }
          }
        }
      }
      this._entries = result;
    }
    const markerServiceListener = new MutableDisposable();
    this._disposables.add(markerServiceListener);
    const updateMarkerUpdater = () => {
      if (notebookEditorWidget.isDisposed) {
        return;
      }
      const doUpdateMarker = (clear) => {
        for (const entry of this._entries) {
          if (clear) {
            entry.clearMarkers();
          } else {
            entry.updateMarkers(this._markerService);
          }
        }
      };
      const problem = this._configurationService.getValue("problems.visibility");
      if (problem === void 0) {
        return;
      }
      const config = this._configurationService.getValue(OutlineConfigKeys.problemsEnabled);
      if (problem && config) {
        markerServiceListener.value = this._markerService.onMarkerChanged((e) => {
          if (notebookEditorWidget.isDisposed) {
            console.error("notebook editor is disposed");
            return;
          }
          if (e.some((uri) => notebookEditorWidget.getCellsInRange().some((cell) => isEqual(cell.uri, uri)))) {
            doUpdateMarker(false);
            this._onDidChange.fire({});
          }
        });
        doUpdateMarker(false);
      } else {
        markerServiceListener.clear();
        doUpdateMarker(true);
      }
    };
    updateMarkerUpdater();
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("problems.visibility") || e.affectsConfiguration(OutlineConfigKeys.problemsEnabled)) {
        updateMarkerUpdater();
        this._onDidChange.fire({});
      }
    }));
    const { changeEventTriggered } = this.recomputeActive();
    if (!changeEventTriggered) {
      this._onDidChange.fire({});
    }
  }
  recomputeActive() {
    let newActive;
    const notebookEditorWidget = this._editor;
    if (notebookEditorWidget) {
      if (notebookEditorWidget.hasModel() && notebookEditorWidget.getLength() > 0) {
        const cell = notebookEditorWidget.cellAt(notebookEditorWidget.getFocus().start);
        if (cell) {
          for (const entry of this._entries) {
            newActive = entry.find(cell, []);
            if (newActive) {
              break;
            }
          }
        }
      }
    }
    if (newActive !== this._activeEntry) {
      this._activeEntry = newActive;
      this._onDidChange.fire({ affectOnlyActiveElement: true });
      return { changeEventTriggered: true };
    }
    return { changeEventTriggered: false };
  }
  dispose() {
    this._entries.length = 0;
    this._activeEntry = void 0;
    this._disposables.dispose();
    this._onDidChange.dispose();
  }
};
NotebookCellOutlineDataSource = __decorateClass([
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, INotebookOutlineEntryFactory)
], NotebookCellOutlineDataSource);
export {
  NotebookCellOutlineDataSource
};
