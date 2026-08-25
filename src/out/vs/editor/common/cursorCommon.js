import { EditorOption } from "./config/editorOptions.js";
import { Position } from "./core/position.js";
import { Range } from "./core/range.js";
import { Selection } from "./core/selection.js";
import { createScopedLineTokens } from "./languages/supports.js";
import { CursorColumns } from "./core/cursorColumns.js";
import { normalizeIndentation } from "./core/misc/indentation.js";
import { InputMode } from "./inputMode.js";
var EditOperationType = /* @__PURE__ */ ((EditOperationType2) => {
  EditOperationType2[EditOperationType2["Other"] = 0] = "Other";
  EditOperationType2[EditOperationType2["DeletingLeft"] = 2] = "DeletingLeft";
  EditOperationType2[EditOperationType2["DeletingRight"] = 3] = "DeletingRight";
  EditOperationType2[EditOperationType2["TypingOther"] = 4] = "TypingOther";
  EditOperationType2[EditOperationType2["TypingFirstSpace"] = 5] = "TypingFirstSpace";
  EditOperationType2[EditOperationType2["TypingConsecutiveSpace"] = 6] = "TypingConsecutiveSpace";
  return EditOperationType2;
})(EditOperationType || {});
const autoCloseAlways = () => true;
const autoCloseNever = () => false;
const autoCloseBeforeWhitespace = (chr) => chr === " " || chr === "	";
class CursorConfiguration {
  constructor(languageId, modelOptions, configuration, languageConfigurationService) {
    this.languageConfigurationService = languageConfigurationService;
    this._cursorMoveConfigurationBrand = void 0;
    this._languageId = languageId;
    const options = configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    const fontInfo = options.get(EditorOption.fontInfo);
    this.readOnly = options.get(EditorOption.readOnly);
    this.tabSize = modelOptions.tabSize;
    this.indentSize = modelOptions.indentSize;
    this.insertSpaces = modelOptions.insertSpaces;
    this.stickyTabStops = options.get(EditorOption.stickyTabStops);
    this.lineHeight = fontInfo.lineHeight;
    this.typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
    this.pageSize = Math.max(1, Math.floor(layoutInfo.height / this.lineHeight) - 2);
    this.useTabStops = options.get(EditorOption.useTabStops);
    this.trimWhitespaceOnDelete = options.get(EditorOption.trimWhitespaceOnDelete);
    this.wordSeparators = options.get(EditorOption.wordSeparators);
    this.emptySelectionClipboard = options.get(EditorOption.emptySelectionClipboard);
    this.copyWithSyntaxHighlighting = options.get(EditorOption.copyWithSyntaxHighlighting);
    this.multiCursorMergeOverlapping = options.get(EditorOption.multiCursorMergeOverlapping);
    this.multiCursorPaste = options.get(EditorOption.multiCursorPaste);
    this.multiCursorLimit = options.get(EditorOption.multiCursorLimit);
    this.autoClosingBrackets = options.get(EditorOption.autoClosingBrackets);
    this.autoClosingComments = options.get(EditorOption.autoClosingComments);
    this.autoClosingQuotes = options.get(EditorOption.autoClosingQuotes);
    this.autoClosingDelete = options.get(EditorOption.autoClosingDelete);
    this.autoClosingOvertype = options.get(EditorOption.autoClosingOvertype);
    this.autoSurround = options.get(EditorOption.autoSurround);
    this.autoIndent = options.get(EditorOption.autoIndent);
    this.wordSegmenterLocales = options.get(EditorOption.wordSegmenterLocales);
    this.overtypeOnPaste = options.get(EditorOption.overtypeOnPaste);
    this.surroundingPairs = {};
    this._electricChars = null;
    this.shouldAutoCloseBefore = {
      quote: this._getShouldAutoClose(languageId, this.autoClosingQuotes, true),
      comment: this._getShouldAutoClose(languageId, this.autoClosingComments, false),
      bracket: this._getShouldAutoClose(languageId, this.autoClosingBrackets, false)
    };
    this.autoClosingPairs = this.languageConfigurationService.getLanguageConfiguration(languageId).getAutoClosingPairs();
    const surroundingPairs = this.languageConfigurationService.getLanguageConfiguration(languageId).getSurroundingPairs();
    if (surroundingPairs) {
      for (const pair of surroundingPairs) {
        this.surroundingPairs[pair.open] = pair.close;
      }
    }
    const commentsConfiguration = this.languageConfigurationService.getLanguageConfiguration(languageId).comments;
    this.blockCommentStartToken = commentsConfiguration?.blockCommentStartToken ?? null;
  }
  static shouldRecreate(e) {
    return e.hasChanged(EditorOption.layoutInfo) || e.hasChanged(EditorOption.wordSeparators) || e.hasChanged(EditorOption.emptySelectionClipboard) || e.hasChanged(EditorOption.multiCursorMergeOverlapping) || e.hasChanged(EditorOption.multiCursorPaste) || e.hasChanged(EditorOption.multiCursorLimit) || e.hasChanged(EditorOption.autoClosingBrackets) || e.hasChanged(EditorOption.autoClosingComments) || e.hasChanged(EditorOption.autoClosingQuotes) || e.hasChanged(EditorOption.autoClosingDelete) || e.hasChanged(EditorOption.autoClosingOvertype) || e.hasChanged(EditorOption.autoSurround) || e.hasChanged(EditorOption.useTabStops) || e.hasChanged(EditorOption.trimWhitespaceOnDelete) || e.hasChanged(EditorOption.fontInfo) || e.hasChanged(EditorOption.readOnly) || e.hasChanged(EditorOption.wordSegmenterLocales) || e.hasChanged(EditorOption.overtypeOnPaste);
  }
  get electricChars() {
    if (!this._electricChars) {
      this._electricChars = {};
      const electricChars = this.languageConfigurationService.getLanguageConfiguration(this._languageId).electricCharacter?.getElectricCharacters();
      if (electricChars) {
        for (const char of electricChars) {
          this._electricChars[char] = true;
        }
      }
    }
    return this._electricChars;
  }
  get inputMode() {
    return InputMode.getInputMode();
  }
  /**
   * Should return opening bracket type to match indentation with
   */
  onElectricCharacter(character, context, column) {
    const scopedLineTokens = createScopedLineTokens(context, column - 1);
    const electricCharacterSupport = this.languageConfigurationService.getLanguageConfiguration(scopedLineTokens.languageId).electricCharacter;
    if (!electricCharacterSupport) {
      return null;
    }
    return electricCharacterSupport.onElectricCharacter(character, scopedLineTokens, column - scopedLineTokens.firstCharOffset);
  }
  normalizeIndentation(str) {
    return normalizeIndentation(str, this.indentSize, this.insertSpaces);
  }
  _getShouldAutoClose(languageId, autoCloseConfig, forQuotes) {
    switch (autoCloseConfig) {
      case "beforeWhitespace":
        return autoCloseBeforeWhitespace;
      case "languageDefined":
        return this._getLanguageDefinedShouldAutoClose(languageId, forQuotes);
      case "always":
        return autoCloseAlways;
      case "never":
        return autoCloseNever;
    }
  }
  _getLanguageDefinedShouldAutoClose(languageId, forQuotes) {
    const autoCloseBeforeSet = this.languageConfigurationService.getLanguageConfiguration(languageId).getAutoCloseBeforeSet(forQuotes);
    return (c) => autoCloseBeforeSet.indexOf(c) !== -1;
  }
  /**
   * Returns a visible column from a column.
   * @see {@link CursorColumns}
   */
  visibleColumnFromColumn(model, position) {
    return CursorColumns.visibleColumnFromColumn(model.getLineContent(position.lineNumber), position.column, this.tabSize);
  }
  /**
   * Returns a visible column from a column.
   * @see {@link CursorColumns}
   */
  columnFromVisibleColumn(model, lineNumber, visibleColumn) {
    const result = CursorColumns.columnFromVisibleColumn(model.getLineContent(lineNumber), visibleColumn, this.tabSize);
    const minColumn = model.getLineMinColumn(lineNumber);
    if (result < minColumn) {
      return minColumn;
    }
    const maxColumn = model.getLineMaxColumn(lineNumber);
    if (result > maxColumn) {
      return maxColumn;
    }
    return result;
  }
}
class CursorState {
  constructor(modelState, viewState) {
    this._cursorStateBrand = void 0;
    this.modelState = modelState;
    this.viewState = viewState;
  }
  static fromModelState(modelState) {
    return new PartialModelCursorState(modelState);
  }
  static fromViewState(viewState) {
    return new PartialViewCursorState(viewState);
  }
  static fromModelSelection(modelSelection) {
    const selection = Selection.liftSelection(modelSelection);
    const modelState = new SingleCursorState(
      Range.fromPositions(selection.getSelectionStart()),
      0 /* Simple */,
      0,
      selection.getPosition(),
      0
    );
    return CursorState.fromModelState(modelState);
  }
  static fromModelSelections(modelSelections) {
    const states = [];
    for (let i = 0, len = modelSelections.length; i < len; i++) {
      states[i] = this.fromModelSelection(modelSelections[i]);
    }
    return states;
  }
  equals(other) {
    return this.viewState.equals(other.viewState) && this.modelState.equals(other.modelState);
  }
}
class PartialModelCursorState {
  constructor(modelState) {
    this.modelState = modelState;
    this.viewState = null;
  }
}
class PartialViewCursorState {
  constructor(viewState) {
    this.modelState = null;
    this.viewState = viewState;
  }
}
var SelectionStartKind = /* @__PURE__ */ ((SelectionStartKind2) => {
  SelectionStartKind2[SelectionStartKind2["Simple"] = 0] = "Simple";
  SelectionStartKind2[SelectionStartKind2["Word"] = 1] = "Word";
  SelectionStartKind2[SelectionStartKind2["Line"] = 2] = "Line";
  return SelectionStartKind2;
})(SelectionStartKind || {});
class SingleCursorState {
  constructor(selectionStart, selectionStartKind, selectionStartLeftoverVisibleColumns, position, leftoverVisibleColumns) {
    this.selectionStart = selectionStart;
    this.selectionStartKind = selectionStartKind;
    this.selectionStartLeftoverVisibleColumns = selectionStartLeftoverVisibleColumns;
    this.position = position;
    this.leftoverVisibleColumns = leftoverVisibleColumns;
    this._singleCursorStateBrand = void 0;
    this.selection = SingleCursorState._computeSelection(this.selectionStart, this.position);
  }
  equals(other) {
    return this.selectionStartLeftoverVisibleColumns === other.selectionStartLeftoverVisibleColumns && this.leftoverVisibleColumns === other.leftoverVisibleColumns && this.selectionStartKind === other.selectionStartKind && this.position.equals(other.position) && this.selectionStart.equalsRange(other.selectionStart);
  }
  hasSelection() {
    return !this.selection.isEmpty() || !this.selectionStart.isEmpty();
  }
  move(inSelectionMode, lineNumber, column, leftoverVisibleColumns) {
    if (inSelectionMode) {
      return new SingleCursorState(
        this.selectionStart,
        this.selectionStartKind,
        this.selectionStartLeftoverVisibleColumns,
        new Position(lineNumber, column),
        leftoverVisibleColumns
      );
    } else {
      return new SingleCursorState(
        new Range(lineNumber, column, lineNumber, column),
        0 /* Simple */,
        leftoverVisibleColumns,
        new Position(lineNumber, column),
        leftoverVisibleColumns
      );
    }
  }
  static _computeSelection(selectionStart, position) {
    if (selectionStart.isEmpty() || !position.isBeforeOrEqual(selectionStart.getStartPosition())) {
      return Selection.fromPositions(selectionStart.getStartPosition(), position);
    } else {
      return Selection.fromPositions(selectionStart.getEndPosition(), position);
    }
  }
}
class EditOperationResult {
  constructor(type, commands, opts) {
    this._editOperationResultBrand = void 0;
    this.type = type;
    this.commands = commands;
    this.shouldPushStackElementBefore = opts.shouldPushStackElementBefore;
    this.shouldPushStackElementAfter = opts.shouldPushStackElementAfter;
  }
}
function isQuote(ch) {
  return ch === "'" || ch === '"' || ch === "`";
}
export {
  CursorConfiguration,
  CursorState,
  EditOperationResult,
  EditOperationType,
  PartialModelCursorState,
  PartialViewCursorState,
  SelectionStartKind,
  SingleCursorState,
  isQuote
};
