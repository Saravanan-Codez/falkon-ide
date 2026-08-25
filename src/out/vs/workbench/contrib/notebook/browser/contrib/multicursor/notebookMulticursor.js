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
import { localize } from "../../../../../../nls.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { EditorConfiguration } from "../../../../../../editor/browser/config/editorConfiguration.js";
import { CoreEditingCommands } from "../../../../../../editor/browser/coreCommands.js";
import { RedoCommand, UndoCommand } from "../../../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { cursorBlinkingStyleFromString, cursorStyleFromString, TextEditorCursorBlinkingStyle, TextEditorCursorStyle } from "../../../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../../../editor/common/core/position.js";
import { Selection, SelectionDirection } from "../../../../../../editor/common/core/selection.js";
import { USUAL_WORD_SEPARATORS } from "../../../../../../editor/common/core/wordHelper.js";
import { CommandExecutor, CursorsController } from "../../../../../../editor/common/cursor/cursor.js";
import { DeleteOperations } from "../../../../../../editor/common/cursor/cursorDeleteOperations.js";
import { CursorConfiguration } from "../../../../../../editor/common/cursorCommon.js";
import { CursorChangeReason } from "../../../../../../editor/common/cursorEvents.js";
import { Handler } from "../../../../../../editor/common/editorCommon.js";
import { ILanguageConfigurationService } from "../../../../../../editor/common/languages/languageConfigurationRegistry.js";
import { indentOfLine } from "../../../../../../editor/common/model/textModel.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { ViewModelEventsCollector } from "../../../../../../editor/common/viewModelEventDispatcher.js";
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../../../platform/undoRedo/common/undoRedo.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../common/contributions.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED, NOTEBOOK_CELL_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from "../../../common/notebookContextKeys.js";
import { NotebookAction } from "../../controller/coreActions.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { CellEditorOptions } from "../../view/cellParts/cellEditorOptions.js";
import { NotebookFindContrib } from "../find/notebookFindWidget.js";
import { NotebookCellTextModel } from "../../../common/model/notebookCellTextModel.js";
const NOTEBOOK_ADD_FIND_MATCH_TO_SELECTION_ID = "notebook.addFindMatchToSelection";
const NOTEBOOK_SELECT_ALL_FIND_MATCHES_ID = "notebook.selectAllFindMatches";
var NotebookMultiCursorState = /* @__PURE__ */ ((NotebookMultiCursorState2) => {
  NotebookMultiCursorState2[NotebookMultiCursorState2["Idle"] = 0] = "Idle";
  NotebookMultiCursorState2[NotebookMultiCursorState2["Selecting"] = 1] = "Selecting";
  NotebookMultiCursorState2[NotebookMultiCursorState2["Editing"] = 2] = "Editing";
  return NotebookMultiCursorState2;
})(NotebookMultiCursorState || {});
const NOTEBOOK_MULTI_CURSOR_CONTEXT = {
  IsNotebookMultiCursor: new RawContextKey("isNotebookMultiSelect", false),
  NotebookMultiSelectCursorState: new RawContextKey("notebookMultiSelectCursorState", 0 /* Idle */)
};
let NotebookMultiCursorController = class extends Disposable {
  constructor(notebookEditor, contextKeyService, textModelService, languageConfigurationService, accessibilityService, configurationService, undoRedoService) {
    super();
    this.notebookEditor = notebookEditor;
    this.contextKeyService = contextKeyService;
    this.textModelService = textModelService;
    this.languageConfigurationService = languageConfigurationService;
    this.accessibilityService = accessibilityService;
    this.configurationService = configurationService;
    this.undoRedoService = undoRedoService;
    this.word = "";
    this.trackedCells = [];
    this.totalMatchesCount = 0;
    this._onDidChangeAnchorCell = this._register(new Emitter());
    this.onDidChangeAnchorCell = this._onDidChangeAnchorCell.event;
    this.anchorDisposables = this._register(new DisposableStore());
    this.cursorsDisposables = this._register(new DisposableStore());
    this.cursorsControllers = new ResourceMap();
    this.state = 0 /* Idle */;
    this._nbIsMultiSelectSession = NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor.bindTo(this.contextKeyService);
    this._nbMultiSelectState = NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.bindTo(this.contextKeyService);
    this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
    this._register(this.onDidChangeAnchorCell(async () => {
      await this.syncCursorsControllers();
      this.syncAnchorListeners();
    }));
  }
  static {
    this.id = "notebook.multiCursorController";
  }
  getState() {
    return this.state;
  }
  syncAnchorListeners() {
    this.anchorDisposables.clear();
    if (!this.anchorCell) {
      throw new Error("Anchor cell is undefined");
    }
    this.anchorDisposables.add(this.anchorCell[1].onWillType((input) => {
      const collector = new ViewModelEventsCollector();
      this.trackedCells.forEach((cell) => {
        const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
        if (!controller) {
          return;
        }
        if (cell.cellViewModel.handle !== this.anchorCell?.[0].handle) {
          controller.type(collector, input, "keyboard");
        }
      });
    }));
    this.anchorDisposables.add(this.anchorCell[1].onDidType(() => {
      this.state = 2 /* Editing */;
      this._nbMultiSelectState.set(2 /* Editing */);
      const anchorController = this.cursorsControllers.get(this.anchorCell[0].uri);
      if (!anchorController) {
        return;
      }
      const activeSelections = this.notebookEditor.activeCodeEditor?.getSelections();
      if (!activeSelections) {
        return;
      }
      anchorController.setSelections(new ViewModelEventsCollector(), "keyboard", activeSelections, CursorChangeReason.Explicit);
      this.trackedCells.forEach((cell) => {
        const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
        if (!controller) {
          return;
        }
        cell.initialSelection = controller.getSelection();
        cell.matchSelections = [];
      });
      this.updateLazyDecorations();
    }));
    this.anchorDisposables.add(this.anchorCell[1].onDidChangeCursorSelection((e) => {
      if (e.source === "mouse") {
        this.resetToIdleState();
        return;
      }
      if (!e.oldSelections || e.reason === CursorChangeReason.NotSet || e.reason === CursorChangeReason.RecoverFromMarkers) {
        return;
      }
      const translation = {
        deltaStartCol: e.selection.startColumn - e.oldSelections[0].startColumn,
        deltaStartLine: e.selection.startLineNumber - e.oldSelections[0].startLineNumber,
        deltaEndCol: e.selection.endColumn - e.oldSelections[0].endColumn,
        deltaEndLine: e.selection.endLineNumber - e.oldSelections[0].endLineNumber
      };
      const translationDir = e.selection.getDirection();
      this.trackedCells.forEach((cell) => {
        const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
        if (!controller) {
          return;
        }
        const newSelections = controller.getSelections().map((selection) => {
          const newStartCol = selection.startColumn + translation.deltaStartCol;
          const newStartLine = selection.startLineNumber + translation.deltaStartLine;
          const newEndCol = selection.endColumn + translation.deltaEndCol;
          const newEndLine = selection.endLineNumber + translation.deltaEndLine;
          return Selection.createWithDirection(newStartLine, newStartCol, newEndLine, newEndCol, translationDir);
        });
        controller.setSelections(new ViewModelEventsCollector(), e.source, newSelections, CursorChangeReason.Explicit);
      });
      this.updateLazyDecorations();
    }));
    this.anchorDisposables.add(this.anchorCell[1].onWillTriggerEditorOperationEvent((e) => {
      this.handleEditorOperationEvent(e);
    }));
    this.anchorDisposables.add(this.anchorCell[1].onDidBlurEditorWidget(() => {
      if (this.state === 1 /* Selecting */ || this.state === 2 /* Editing */) {
        this.resetToIdleState();
      }
    }));
  }
  async syncCursorsControllers() {
    this.cursorsDisposables.clear();
    await Promise.all(this.trackedCells.map(async (cell) => {
      const controller = await this.createCursorController(cell);
      if (!controller) {
        return;
      }
      this.cursorsControllers.set(cell.cellViewModel.uri, controller);
      const selections = cell.matchSelections;
      controller.setSelections(new ViewModelEventsCollector(), void 0, selections, CursorChangeReason.Explicit);
    }));
    this.updateLazyDecorations();
  }
  async createCursorController(cell) {
    const textModelRef = await this.textModelService.createModelReference(cell.cellViewModel.uri);
    const textModel = textModelRef.object.textEditorModel;
    if (!textModel) {
      textModelRef.dispose();
      return void 0;
    }
    this.cursorsDisposables.add(textModelRef);
    const cursorSimpleModel = this.constructCursorSimpleModel(cell.cellViewModel);
    const converter = this.constructCoordinatesConverter();
    const editorConfig = cell.editorConfig;
    const controller = this.cursorsDisposables.add(new CursorsController(
      textModel,
      cursorSimpleModel,
      converter,
      new CursorConfiguration(textModel.getLanguageId(), textModel.getOptions(), editorConfig, this.languageConfigurationService)
    ));
    controller.setSelections(new ViewModelEventsCollector(), void 0, cell.matchSelections, CursorChangeReason.Explicit);
    return controller;
  }
  constructCoordinatesConverter() {
    return {
      convertViewPositionToModelPosition(viewPosition) {
        return viewPosition;
      },
      convertViewRangeToModelRange(viewRange) {
        return viewRange;
      },
      validateViewPosition(viewPosition, expectedModelPosition) {
        return viewPosition;
      },
      validateViewRange(viewRange, expectedModelRange) {
        return viewRange;
      },
      convertModelPositionToViewPosition(modelPosition, affinity, allowZeroLineNumber, belowHiddenRanges) {
        return modelPosition;
      },
      convertModelRangeToViewRange(modelRange, affinity) {
        return modelRange;
      },
      modelPositionIsVisible(modelPosition) {
        return true;
      },
      getModelLineViewLineCount(modelLineNumber) {
        return 1;
      },
      getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
        return modelLineNumber;
      }
    };
  }
  constructCursorSimpleModel(cell) {
    return {
      getLineCount() {
        return cell.textBuffer.getLineCount();
      },
      getLineContent(lineNumber) {
        return cell.textBuffer.getLineContent(lineNumber);
      },
      getLineMinColumn(lineNumber) {
        return cell.textBuffer.getLineMinColumn(lineNumber);
      },
      getLineMaxColumn(lineNumber) {
        return cell.textBuffer.getLineMaxColumn(lineNumber);
      },
      getLineFirstNonWhitespaceColumn(lineNumber) {
        return cell.textBuffer.getLineFirstNonWhitespaceColumn(lineNumber);
      },
      getLineLastNonWhitespaceColumn(lineNumber) {
        return cell.textBuffer.getLineLastNonWhitespaceColumn(lineNumber);
      },
      normalizePosition(position, affinity) {
        return position;
      },
      getLineIndentColumn(lineNumber) {
        return indentOfLine(cell.textBuffer.getLineContent(lineNumber)) + 1;
      }
    };
  }
  handleEditorOperationEvent(e) {
    this.trackedCells.forEach((cell) => {
      if (cell.cellViewModel.handle === this.anchorCell?.[0].handle) {
        return;
      }
      const eventsCollector = new ViewModelEventsCollector();
      const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
      if (!controller) {
        return;
      }
      this.executeEditorOperation(controller, eventsCollector, e);
    });
  }
  executeEditorOperation(controller, eventsCollector, e) {
    switch (e.handlerId) {
      case Handler.CompositionStart:
        controller.startComposition(eventsCollector);
        break;
      case Handler.CompositionEnd:
        controller.endComposition(eventsCollector, e.source);
        break;
      case Handler.ReplacePreviousChar: {
        const args = e.payload;
        controller.compositionType(eventsCollector, args.text || "", args.replaceCharCnt || 0, 0, 0, e.source);
        break;
      }
      case Handler.CompositionType: {
        const args = e.payload;
        controller.compositionType(eventsCollector, args.text || "", args.replacePrevCharCnt || 0, args.replaceNextCharCnt || 0, args.positionDelta || 0, e.source);
        break;
      }
      case Handler.Paste: {
        const args = e.payload;
        controller.paste(eventsCollector, args.text || "", args.pasteOnNewLine || false, args.multicursorText || null, e.source);
        break;
      }
      case Handler.Cut:
        controller.cut(eventsCollector, e.source);
        break;
    }
  }
  updateViewModelSelections() {
    for (const cell of this.trackedCells) {
      const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
      if (!controller) {
        return;
      }
      cell.cellViewModel.setSelections(controller.getSelections());
    }
  }
  updateFinalUndoRedo() {
    const anchorCellModel = this.anchorCell?.[1].getModel();
    if (!anchorCellModel) {
      return;
    }
    const newElementsMap = new ResourceMap();
    const resources = [];
    this.trackedCells.forEach((trackedMatch) => {
      const undoRedoState = trackedMatch.undoRedoHistory;
      if (!undoRedoState) {
        return;
      }
      resources.push(trackedMatch.cellViewModel.uri);
      const currentPastElements = this.undoRedoService.getElements(trackedMatch.cellViewModel.uri).past.slice();
      const oldPastElements = trackedMatch.undoRedoHistory.past.slice();
      const newElements = currentPastElements.slice(oldPastElements.length);
      if (newElements.length === 0) {
        return;
      }
      newElementsMap.set(trackedMatch.cellViewModel.uri, newElements);
      this.undoRedoService.removeElements(trackedMatch.cellViewModel.uri);
      oldPastElements.forEach((element) => {
        this.undoRedoService.pushElement(element);
      });
    });
    this.undoRedoService.pushElement({
      type: UndoRedoElementType.Workspace,
      resources,
      label: "Multi Cursor Edit",
      code: "multiCursorEdit",
      confirmBeforeUndo: false,
      undo: async () => {
        newElementsMap.forEach(async (value) => {
          value.reverse().forEach(async (element) => {
            await element.undo();
          });
        });
      },
      redo: async () => {
        newElementsMap.forEach(async (value) => {
          value.forEach(async (element) => {
            await element.redo();
          });
        });
      }
    });
  }
  resetToIdleState() {
    this.state = 0 /* Idle */;
    this._nbMultiSelectState.set(0 /* Idle */);
    this._nbIsMultiSelectSession.set(false);
    this.updateFinalUndoRedo();
    this.trackedCells.forEach((cell) => {
      this.clearDecorations(cell);
      cell.cellViewModel.setSelections([cell.initialSelection]);
    });
    this.anchorDisposables.clear();
    this.anchorCell = void 0;
    this.cursorsDisposables.clear();
    this.cursorsControllers.clear();
    this.trackedCells = [];
    this.totalMatchesCount = 0;
    this.startPosition = void 0;
    this.word = "";
  }
  async findAndTrackNextSelection(focusedCell) {
    if (this.state === 0 /* Idle */) {
      const textModel = focusedCell.textModel;
      if (!textModel) {
        return;
      }
      const inputSelection = focusedCell.getSelections()[0];
      const word = this.getWord(inputSelection, textModel);
      if (!word) {
        return;
      }
      this.word = word.word;
      const notebookTextModel = this.notebookEditor.textModel;
      if (notebookTextModel) {
        const allMatches = notebookTextModel.findMatches(this.word, false, true, USUAL_WORD_SEPARATORS);
        this.totalMatchesCount = allMatches.reduce((sum, cellMatch) => sum + cellMatch.matches.length, 0);
      }
      const index = this.notebookEditor.getCellIndex(focusedCell);
      if (index === void 0) {
        return;
      }
      this.startPosition = {
        cellIndex: index,
        position: new Position(inputSelection.startLineNumber, word.startColumn)
      };
      const newSelection = new Selection(
        inputSelection.startLineNumber,
        word.startColumn,
        inputSelection.startLineNumber,
        word.endColumn
      );
      focusedCell.setSelections([newSelection]);
      this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
      if (!this.anchorCell || this.anchorCell[0].handle !== focusedCell.handle) {
        throw new Error("Active cell is not the same as the cell passed as context");
      }
      if (!(this.anchorCell[1] instanceof CodeEditorWidget)) {
        throw new Error("Active cell is not an instance of CodeEditorWidget");
      }
      await this.updateTrackedCell(focusedCell, [newSelection]);
      this._nbIsMultiSelectSession.set(true);
      this.state = 1 /* Selecting */;
      this._nbMultiSelectState.set(1 /* Selecting */);
      this._onDidChangeAnchorCell.fire();
    } else if (this.state === 1 /* Selecting */) {
      const notebookTextModel = this.notebookEditor.textModel;
      if (!notebookTextModel) {
        return;
      }
      const index = this.notebookEditor.getCellIndex(focusedCell);
      if (index === void 0) {
        return;
      }
      if (!this.startPosition) {
        return;
      }
      const totalSelections = this.trackedCells.reduce((sum, trackedCell) => sum + trackedCell.matchSelections.length, 0);
      if (totalSelections >= this.totalMatchesCount) {
        return;
      }
      const findResult = notebookTextModel.findNextMatch(
        this.word,
        { cellIndex: index, position: focusedCell.getSelections()[focusedCell.getSelections().length - 1].getEndPosition() },
        false,
        true,
        USUAL_WORD_SEPARATORS,
        this.startPosition
      );
      if (!findResult) {
        return;
      }
      const findResultCellViewModel = this.notebookEditor.getCellByHandle(findResult.cell.handle);
      if (!findResultCellViewModel) {
        return;
      }
      if (findResult.cell.handle === focusedCell.handle) {
        const selections = [...focusedCell.getSelections(), Selection.fromRange(findResult.match.range, SelectionDirection.LTR)];
        const trackedCell = await this.updateTrackedCell(focusedCell, selections);
        findResultCellViewModel.setSelections(trackedCell.matchSelections);
      } else if (findResult.cell.handle !== focusedCell.handle) {
        await this.notebookEditor.revealRangeInViewAsync(findResultCellViewModel, findResult.match.range);
        await this.notebookEditor.focusNotebookCell(findResultCellViewModel, "editor");
        const trackedCell = await this.updateTrackedCell(findResultCellViewModel, [Selection.fromRange(findResult.match.range, SelectionDirection.LTR)]);
        findResultCellViewModel.setSelections(trackedCell.matchSelections);
        this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
        if (!this.anchorCell || !(this.anchorCell[1] instanceof CodeEditorWidget)) {
          throw new Error("Active cell is not an instance of CodeEditorWidget");
        }
        this._onDidChangeAnchorCell.fire();
        this.initializeMultiSelectDecorations(this.trackedCells.find((trackedCell2) => trackedCell2.cellViewModel.handle === focusedCell.handle));
      }
    }
  }
  async selectAllMatches(focusedCell, matches) {
    const notebookTextModel = this.notebookEditor.textModel;
    if (!notebookTextModel) {
      return;
    }
    if (matches) {
      await this.handleFindWidgetSelectAllMatches(matches);
    } else {
      await this.handleCellEditorSelectAllMatches(notebookTextModel, focusedCell);
    }
    await this.syncCursorsControllers();
    this.syncAnchorListeners();
    this.updateLazyDecorations();
  }
  async handleFindWidgetSelectAllMatches(matches) {
    if (this.state !== 0 /* Idle */) {
      return;
    }
    if (!matches.length) {
      return;
    }
    await this.notebookEditor.focusNotebookCell(matches[0].cell, "editor");
    this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
    this.trackedCells = [];
    for (const match of matches) {
      this.updateTrackedCell(match.cell, match.contentMatches.map((match2) => Selection.fromRange(match2.range, SelectionDirection.LTR)));
      if (this.anchorCell && match.cell.handle === this.anchorCell[0].handle) {
        match.cell.setSelections(match.contentMatches.map((match2) => Selection.fromRange(match2.range, SelectionDirection.LTR)));
      }
    }
    this._nbIsMultiSelectSession.set(true);
    this.state = 1 /* Selecting */;
    this._nbMultiSelectState.set(1 /* Selecting */);
  }
  async handleCellEditorSelectAllMatches(notebookTextModel, focusedCell) {
    if (this.state === 0 /* Idle */) {
      const textModel = focusedCell.textModel;
      if (!textModel) {
        return;
      }
      const inputSelection = focusedCell.getSelections()[0];
      const word = this.getWord(inputSelection, textModel);
      if (!word) {
        return;
      }
      this.word = word.word;
      const index = this.notebookEditor.getCellIndex(focusedCell);
      if (index === void 0) {
        return;
      }
      this.startPosition = {
        cellIndex: index,
        position: new Position(inputSelection.startLineNumber, word.startColumn)
      };
      this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
      if (!this.anchorCell || this.anchorCell[0].handle !== focusedCell.handle) {
        throw new Error("Active cell is not the same as the cell passed as context");
      }
      if (!(this.anchorCell[1] instanceof CodeEditorWidget)) {
        throw new Error("Active cell is not an instance of CodeEditorWidget");
      }
      const findResults = notebookTextModel.findMatches(this.word, false, true, USUAL_WORD_SEPARATORS);
      this.trackedCells = [];
      for (const res of findResults) {
        await this.updateTrackedCell(res.cell, res.matches.map((match) => Selection.fromRange(match.range, SelectionDirection.LTR)));
        if (res.cell.handle === focusedCell.handle) {
          const cellViewModel = this.notebookEditor.getCellByHandle(res.cell.handle);
          if (cellViewModel) {
            cellViewModel.setSelections(res.matches.map((match) => Selection.fromRange(match.range, SelectionDirection.LTR)));
          }
        }
      }
      this._nbIsMultiSelectSession.set(true);
      this.state = 1 /* Selecting */;
      this._nbMultiSelectState.set(1 /* Selecting */);
    } else if (this.state === 1 /* Selecting */) {
      const findResults = notebookTextModel.findMatches(this.word, false, true, USUAL_WORD_SEPARATORS);
      for (const res of findResults) {
        await this.updateTrackedCell(res.cell, res.matches.map((match) => Selection.fromRange(match.range, SelectionDirection.LTR)));
      }
    }
  }
  async updateTrackedCell(cell, selections) {
    const cellViewModel = cell instanceof NotebookCellTextModel ? this.notebookEditor.getCellByHandle(cell.handle) : cell;
    if (!cellViewModel) {
      throw new Error("Cell not found");
    }
    let trackedMatch = this.trackedCells.find((trackedCell) => trackedCell.cellViewModel.handle === cellViewModel.handle);
    if (trackedMatch) {
      this.clearDecorations(trackedMatch);
      trackedMatch.matchSelections = selections;
    } else {
      const initialSelection = cellViewModel.getSelections()[0];
      const textModel = await cellViewModel.resolveTextModel();
      textModel.pushStackElement();
      const editorConfig = this.constructCellEditorOptions(cellViewModel);
      const rawEditorOptions = editorConfig.getRawOptions();
      const cursorConfig = {
        cursorStyle: cursorStyleFromString(rawEditorOptions.cursorStyle),
        cursorBlinking: cursorBlinkingStyleFromString(rawEditorOptions.cursorBlinking),
        cursorSmoothCaretAnimation: rawEditorOptions.cursorSmoothCaretAnimation
      };
      trackedMatch = {
        cellViewModel,
        initialSelection,
        matchSelections: selections,
        editorConfig,
        cursorConfig,
        decorationIds: [],
        undoRedoHistory: this.undoRedoService.getElements(cellViewModel.uri)
      };
      this.trackedCells.push(trackedMatch);
    }
    return trackedMatch;
  }
  async deleteLeft() {
    this.trackedCells.forEach((cell) => {
      const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
      if (!controller) {
        return;
      }
      const [, commands] = DeleteOperations.deleteLeft(
        controller.getPrevEditOperationType(),
        controller.context.cursorConfig,
        controller.context.model,
        controller.getSelections(),
        controller.getAutoClosedCharacters()
      );
      const delSelections = CommandExecutor.executeCommands(controller.context.model, controller.getSelections(), commands);
      if (!delSelections) {
        return;
      }
      controller.setSelections(new ViewModelEventsCollector(), void 0, delSelections, CursorChangeReason.Explicit);
    });
    this.updateLazyDecorations();
  }
  async deleteRight() {
    this.trackedCells.forEach((cell) => {
      const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
      if (!controller) {
        return;
      }
      const [, commands] = DeleteOperations.deleteRight(
        controller.getPrevEditOperationType(),
        controller.context.cursorConfig,
        controller.context.model,
        controller.getSelections()
      );
      if (cell.cellViewModel.handle !== this.anchorCell?.[0].handle) {
        const delSelections = CommandExecutor.executeCommands(controller.context.model, controller.getSelections(), commands);
        if (!delSelections) {
          return;
        }
        controller.setSelections(new ViewModelEventsCollector(), void 0, delSelections, CursorChangeReason.Explicit);
      } else {
        controller.setSelections(new ViewModelEventsCollector(), void 0, cell.cellViewModel.getSelections(), CursorChangeReason.Explicit);
      }
    });
    this.updateLazyDecorations();
  }
  async undo() {
    const models = [];
    for (const cell of this.trackedCells) {
      const model = await cell.cellViewModel.resolveTextModel();
      if (model) {
        models.push(model);
      }
    }
    await Promise.all(models.map((model) => model.undo()));
    this.updateViewModelSelections();
    this.updateLazyDecorations();
  }
  async redo() {
    const models = [];
    for (const cell of this.trackedCells) {
      const model = await cell.cellViewModel.resolveTextModel();
      if (model) {
        models.push(model);
      }
    }
    await Promise.all(models.map((model) => model.redo()));
    this.updateViewModelSelections();
    this.updateLazyDecorations();
  }
  constructCellEditorOptions(cell) {
    const cellEditorOptions = new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(cell.language), this.notebookEditor.notebookOptions, this.configurationService);
    const options = cellEditorOptions.getUpdatedValue(cell.internalMetadata, cell.uri);
    cellEditorOptions.dispose();
    return new EditorConfiguration(false, MenuId.EditorContent, options, null, this.accessibilityService);
  }
  /**
   * Updates the multicursor selection decorations for a specific matched cell
   *
   * @param cell -- match object containing the viewmodel + selections
   */
  initializeMultiSelectDecorations(cell) {
    if (!cell) {
      return;
    }
    const decorations = [];
    cell.matchSelections.forEach((selection) => {
      decorations.push({
        range: Selection.fromPositions(selection.getEndPosition()),
        options: {
          description: "",
          className: this.getClassName(cell.cursorConfig, true)
        }
      });
    });
    cell.decorationIds = cell.cellViewModel.deltaModelDecorations(
      cell.decorationIds,
      decorations
    );
  }
  updateLazyDecorations() {
    this.trackedCells.forEach((cell) => {
      if (cell.cellViewModel.handle === this.anchorCell?.[0].handle) {
        return;
      }
      const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
      if (!controller) {
        return;
      }
      const selections = controller.getSelections();
      const newDecorations = [];
      selections?.map((selection) => {
        const isEmpty = selection.isEmpty();
        if (!isEmpty) {
          newDecorations.push({
            range: selection,
            options: {
              description: "",
              className: this.getClassName(cell.cursorConfig, false)
            }
          });
        }
        newDecorations.push({
          range: Selection.fromPositions(selection.getPosition()),
          options: {
            description: "",
            zIndex: 1e4,
            className: this.getClassName(cell.cursorConfig, true)
          }
        });
      });
      cell.decorationIds = cell.cellViewModel.deltaModelDecorations(
        cell.decorationIds,
        newDecorations
      );
    });
  }
  clearDecorations(cell) {
    cell.decorationIds = cell.cellViewModel.deltaModelDecorations(
      cell.decorationIds,
      []
    );
  }
  getWord(selection, model) {
    const lineNumber = selection.startLineNumber;
    const startColumn = selection.startColumn;
    if (model.isDisposed()) {
      return null;
    }
    return model.getWordAtPosition({
      lineNumber,
      column: startColumn
    });
  }
  getClassName(cursorConfig, isCursor) {
    let result = isCursor ? ".nb-multicursor-cursor" : ".nb-multicursor-selection";
    if (isCursor) {
      switch (cursorConfig.cursorStyle) {
        case TextEditorCursorStyle.Line:
          break;
        // default style, no additional class needed (handled by base css style)
        case TextEditorCursorStyle.Block:
          result += ".nb-cursor-block-style";
          break;
        case TextEditorCursorStyle.Underline:
          result += ".nb-cursor-underline-style";
          break;
        case TextEditorCursorStyle.LineThin:
          result += ".nb-cursor-line-thin-style";
          break;
        case TextEditorCursorStyle.BlockOutline:
          result += ".nb-cursor-block-outline-style";
          break;
        case TextEditorCursorStyle.UnderlineThin:
          result += ".nb-cursor-underline-thin-style";
          break;
        default:
          break;
      }
      switch (cursorConfig.cursorBlinking) {
        case TextEditorCursorBlinkingStyle.Blink:
          result += ".nb-blink";
          break;
        case TextEditorCursorBlinkingStyle.Smooth:
          result += ".nb-smooth";
          break;
        case TextEditorCursorBlinkingStyle.Phase:
          result += ".nb-phase";
          break;
        case TextEditorCursorBlinkingStyle.Expand:
          result += ".nb-expand";
          break;
        case TextEditorCursorBlinkingStyle.Solid:
          result += ".nb-solid";
          break;
        default:
          result += ".nb-solid";
          break;
      }
      if (cursorConfig.cursorSmoothCaretAnimation === "on" || cursorConfig.cursorSmoothCaretAnimation === "explicit") {
        result += ".nb-smooth-caret-animation";
      }
    }
    return result;
  }
  dispose() {
    super.dispose();
    this.anchorDisposables.dispose();
    this.cursorsDisposables.dispose();
    this.trackedCells.forEach((cell) => {
      this.clearDecorations(cell);
    });
    this.trackedCells = [];
  }
};
NotebookMultiCursorController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ILanguageConfigurationService),
  __decorateParam(4, IAccessibilityService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IUndoRedoService)
], NotebookMultiCursorController);
class NotebookSelectAllFindMatches extends NotebookAction {
  constructor() {
    super({
      id: NOTEBOOK_SELECT_ALL_FIND_MATCHES_ID,
      title: localize("selectAllFindMatches", "Select All Occurrences of Find Match"),
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true)
      ),
      keybinding: {
        when: ContextKeyExpr.or(
          ContextKeyExpr.and(
            ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
            NOTEBOOK_IS_ACTIVE_EDITOR,
            NOTEBOOK_CELL_EDITOR_FOCUSED
          ),
          ContextKeyExpr.and(
            ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
            KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED
          )
        ),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    if (!context.cell) {
      return;
    }
    const cursorController = editor.getContribution(NotebookMultiCursorController.id);
    const findController = editor.getContribution(NotebookFindContrib.id);
    if (findController.widget.isFocused) {
      const findModel = findController.widget.findModel;
      cursorController.selectAllMatches(context.cell, findModel.findMatches);
    } else {
      cursorController.selectAllMatches(context.cell);
    }
  }
}
class NotebookAddMatchToMultiSelectionAction extends NotebookAction {
  constructor() {
    super({
      id: NOTEBOOK_ADD_FIND_MATCH_TO_SELECTION_ID,
      title: localize("addFindMatchToSelection", "Add Selection to Next Find Match"),
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
        NOTEBOOK_IS_ACTIVE_EDITOR,
        NOTEBOOK_CELL_EDITOR_FOCUSED
      ),
      keybinding: {
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
          NOTEBOOK_IS_ACTIVE_EDITOR,
          NOTEBOOK_CELL_EDITOR_FOCUSED
        ),
        primary: KeyMod.CtrlCmd | KeyCode.KeyD,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    if (!context.cell) {
      return;
    }
    const controller = editor.getContribution(NotebookMultiCursorController.id);
    controller.findAndTrackNextSelection(context.cell);
  }
}
class NotebookExitMultiSelectionAction extends NotebookAction {
  constructor() {
    super({
      id: "noteMultiCursor.exit",
      title: localize("exitMultiSelection", "Exit Multi Cursor Mode"),
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
        NOTEBOOK_IS_ACTIVE_EDITOR,
        NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor
      ),
      keybinding: {
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
          NOTEBOOK_IS_ACTIVE_EDITOR,
          NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor
        ),
        primary: KeyCode.Escape,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    const controller = editor.getContribution(NotebookMultiCursorController.id);
    controller.resetToIdleState();
  }
}
class NotebookDeleteLeftMultiSelectionAction extends NotebookAction {
  constructor() {
    super({
      id: "noteMultiCursor.deleteLeft",
      title: localize("deleteLeftMultiSelection", "Delete Left"),
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
        NOTEBOOK_IS_ACTIVE_EDITOR,
        NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor,
        ContextKeyExpr.or(
          NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(1 /* Selecting */),
          NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(2 /* Editing */)
        )
      ),
      keybinding: {
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
          NOTEBOOK_IS_ACTIVE_EDITOR,
          NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor,
          ContextKeyExpr.or(
            NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(1 /* Selecting */),
            NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(2 /* Editing */)
          )
        ),
        primary: KeyCode.Backspace,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    const controller = editor.getContribution(NotebookMultiCursorController.id);
    controller.deleteLeft();
  }
}
class NotebookDeleteRightMultiSelectionAction extends NotebookAction {
  constructor() {
    super({
      id: "noteMultiCursor.deleteRight",
      title: localize("deleteRightMultiSelection", "Delete Right"),
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
        NOTEBOOK_IS_ACTIVE_EDITOR,
        NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor,
        ContextKeyExpr.or(
          NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(1 /* Selecting */),
          NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(2 /* Editing */)
        )
      ),
      keybinding: {
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
          NOTEBOOK_IS_ACTIVE_EDITOR,
          NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor,
          ContextKeyExpr.or(
            NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(1 /* Selecting */),
            NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(2 /* Editing */)
          )
        ),
        primary: KeyCode.Delete,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const nbEditor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!nbEditor) {
      return;
    }
    const cellEditor = nbEditor.activeCodeEditor;
    if (!cellEditor) {
      return;
    }
    CoreEditingCommands.DeleteRight.runEditorCommand(accessor, cellEditor, null);
    const controller = nbEditor.getContribution(NotebookMultiCursorController.id);
    controller.deleteRight();
  }
}
let NotebookMultiCursorUndoRedoContribution = class extends Disposable {
  constructor(_editorService, configurationService) {
    super();
    this._editorService = _editorService;
    this.configurationService = configurationService;
    if (!this.configurationService.getValue("notebook.multiCursor.enabled")) {
      return;
    }
    const PRIORITY = 10005;
    this._register(UndoCommand.addImplementation(PRIORITY, "notebook-multicursor-undo-redo", () => {
      const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
      if (!editor) {
        return false;
      }
      if (!editor.hasModel()) {
        return false;
      }
      const controller = editor.getContribution(NotebookMultiCursorController.id);
      return controller.undo();
    }, ContextKeyExpr.and(
      ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
      NOTEBOOK_IS_ACTIVE_EDITOR,
      NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor
    )));
    this._register(RedoCommand.addImplementation(PRIORITY, "notebook-multicursor-undo-redo", () => {
      const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
      if (!editor) {
        return false;
      }
      if (!editor.hasModel()) {
        return false;
      }
      const controller = editor.getContribution(NotebookMultiCursorController.id);
      return controller.redo();
    }, ContextKeyExpr.and(
      ContextKeyExpr.equals("config.notebook.multiCursor.enabled", true),
      NOTEBOOK_IS_ACTIVE_EDITOR,
      NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor
    )));
  }
  static {
    this.ID = "workbench.contrib.notebook.multiCursorUndoRedo";
  }
};
NotebookMultiCursorUndoRedoContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IConfigurationService)
], NotebookMultiCursorUndoRedoContribution);
registerNotebookContribution(NotebookMultiCursorController.id, NotebookMultiCursorController);
registerWorkbenchContribution2(NotebookMultiCursorUndoRedoContribution.ID, NotebookMultiCursorUndoRedoContribution, WorkbenchPhase.BlockRestore);
registerAction2(NotebookSelectAllFindMatches);
registerAction2(NotebookAddMatchToMultiSelectionAction);
registerAction2(NotebookExitMultiSelectionAction);
registerAction2(NotebookDeleteLeftMultiSelectionAction);
registerAction2(NotebookDeleteRightMultiSelectionAction);
export {
  NOTEBOOK_MULTI_CURSOR_CONTEXT,
  NotebookMultiCursorController,
  NotebookMultiCursorState
};
