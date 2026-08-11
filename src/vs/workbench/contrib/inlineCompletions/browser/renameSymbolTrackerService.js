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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../base/common/observable.js";
import { observableCodeEditor } from "../../../../editor/browser/observableCodeEditor.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { IRenameSymbolTrackerService } from "../../../../editor/browser/services/renameSymbolTrackerService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { StandardTokenType } from "../../../../editor/common/encodedTokenAttributes.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
function isUserEdit(event) {
  if (event.isUndoing || event.isRedoing || event.isFlush) {
    return false;
  }
  for (const source of event.detailedReasons) {
    if (!isUserEditSource(source)) {
      return false;
    }
  }
  return event.detailedReasons.length > 0;
}
const userEditKinds = /* @__PURE__ */ new Set(["type", "paste", "cut", "executeCommands", "executeCommand", "compositionType", "compositionEnd"]);
function isUserEditSource(source) {
  const metadata = source.metadata;
  if (metadata.source !== "cursor") {
    return false;
  }
  const kind = metadata.kind;
  return userEditKinds.has(kind);
}
class ModelSymbolRenameTracker extends Disposable {
  constructor(_model) {
    super();
    this._model = _model;
    this._trackedWord = observableValue(this, void 0);
    this.trackedWord = this._trackedWord;
    this._capturedWord = void 0;
    this._lastWordBeforeEdit = void 0;
    this._pendingContentChange = false;
    this._lastCursorPosition = void 0;
    this._register(this._model.onDidChangeContent((e) => {
      if (!isUserEdit(e)) {
        const position = this._lastCursorPosition;
        this.reset();
        if (position !== void 0 && position.lineNumber <= this._model.getLineCount()) {
          this.updateCursorPosition(position);
        }
        return;
      }
      this._pendingContentChange = true;
    }));
  }
  /**
   * Called by the service when the cursor position changes in an editor showing this model.
   * Updates tracking based on the word under cursor and whether content has changed.
   */
  updateCursorPosition(position) {
    this._lastCursorPosition = position;
    const wordAtPosition = this._model.getWordAtPosition(position);
    if (!wordAtPosition) {
      this._lastWordBeforeEdit = void 0;
      this._pendingContentChange = false;
      return;
    }
    if (this._isPositionInComment(position)) {
      this._lastWordBeforeEdit = void 0;
      this._pendingContentChange = false;
      return;
    }
    const currentWord = {
      word: wordAtPosition.word,
      range: new Range(
        position.lineNumber,
        wordAtPosition.startColumn,
        position.lineNumber,
        wordAtPosition.endColumn
      ),
      position
    };
    const contentChanged = this._pendingContentChange;
    this._pendingContentChange = false;
    if (!contentChanged) {
      this._lastWordBeforeEdit = currentWord;
      return;
    }
    if (!this._capturedWord) {
      const originalWord = this._lastWordBeforeEdit ?? currentWord;
      this._capturedWord = { ...originalWord };
      this._trackedWord.set({
        model: this._model,
        originalWord: originalWord.word,
        originalPosition: originalWord.position,
        originalRange: originalWord.range,
        currentWord: currentWord.word,
        currentRange: currentWord.range
      }, void 0);
      this._lastWordBeforeEdit = currentWord;
      return;
    }
    const capturedWord = this._capturedWord;
    const isOnSameWord = this._rangesOverlap(capturedWord.range, currentWord.range) || this._isAdjacent(capturedWord.range, currentWord.range);
    if (isOnSameWord) {
      this._trackedWord.set({
        model: this._model,
        originalWord: capturedWord.word,
        originalPosition: capturedWord.position,
        originalRange: capturedWord.range,
        currentWord: currentWord.word,
        currentRange: currentWord.range
      }, void 0);
    } else {
      const originalWord = this._lastWordBeforeEdit ?? currentWord;
      this._capturedWord = { ...originalWord };
      this._trackedWord.set({
        model: this._model,
        originalWord: originalWord.word,
        originalPosition: originalWord.position,
        originalRange: originalWord.range,
        currentWord: currentWord.word,
        currentRange: currentWord.range
      }, void 0);
    }
    this._lastWordBeforeEdit = currentWord;
  }
  reset() {
    this._trackedWord.set(void 0, void 0);
    this._capturedWord = void 0;
    this._lastWordBeforeEdit = void 0;
    this._pendingContentChange = false;
    this._lastCursorPosition = void 0;
  }
  _isPositionInComment(position) {
    this._model.tokenization.tokenizeIfCheap(position.lineNumber);
    const tokens = this._model.tokenization.getLineTokens(position.lineNumber);
    const tokenIndex = tokens.findTokenIndexAtOffset(position.column - 1);
    const tokenType = tokens.getStandardTokenType(tokenIndex);
    return tokenType === StandardTokenType.Comment;
  }
  _rangesOverlap(a, b) {
    if (a.startLineNumber !== b.startLineNumber) {
      return false;
    }
    return !(a.endColumn < b.startColumn || b.endColumn < a.startColumn);
  }
  _isAdjacent(a, b) {
    if (a.startLineNumber !== b.startLineNumber) {
      return false;
    }
    return a.endColumn === b.startColumn || b.endColumn === a.startColumn;
  }
}
let RenameSymbolTrackerService = class extends Disposable {
  constructor(_codeEditorService, _modelService) {
    super();
    this._codeEditorService = _codeEditorService;
    this._modelService = _modelService;
    this._modelTrackers = /* @__PURE__ */ new Map();
    this._editorFocusTrackingDisposables = /* @__PURE__ */ new Map();
    this._focusedModelTracker = observableValue(this, void 0);
    this.trackedWord = derived(this, (reader) => {
      const tracker = this._focusedModelTracker.read(reader);
      return tracker?.trackedWord.read(reader);
    });
    for (const editor of this._codeEditorService.listCodeEditors()) {
      this._setupEditorTracking(editor);
    }
    this._register(this._codeEditorService.onCodeEditorAdd((editor) => {
      this._setupEditorTracking(editor);
    }));
    this._register(this._codeEditorService.onCodeEditorRemove((editor) => {
      const focusDisposable = this._editorFocusTrackingDisposables.get(editor);
      if (focusDisposable) {
        focusDisposable.dispose();
        this._editorFocusTrackingDisposables.delete(editor);
      }
    }));
    this._register(this._modelService.onModelRemoved((model) => {
      const tracker = this._modelTrackers.get(model);
      if (tracker) {
        tracker.dispose();
        this._modelTrackers.delete(model);
      }
    }));
  }
  _setupEditorTracking(editor) {
    if (editor.isSimpleWidget) {
      return;
    }
    if (!this._editorFocusTrackingDisposables.has(editor)) {
      const obsEditor = observableCodeEditor(editor);
      const focusDisposable = autorun((reader) => {
        const isFocused = obsEditor.isFocused.read(reader);
        const model = obsEditor.model.read(reader);
        const cursorPosition = obsEditor.cursorPosition.read(reader);
        if (!isFocused || !model) {
          return;
        }
        let tracker = this._modelTrackers.get(model);
        if (!tracker) {
          tracker = new ModelSymbolRenameTracker(model);
          this._modelTrackers.set(model, tracker);
        }
        if (this._focusedModelTracker.read(void 0) !== tracker) {
          this._focusedModelTracker.set(tracker, void 0);
        }
        if (cursorPosition) {
          tracker.updateCursorPosition(cursorPosition);
        }
      });
      this._editorFocusTrackingDisposables.set(editor, focusDisposable);
    }
  }
  dispose() {
    for (const tracker of this._modelTrackers.values()) {
      tracker.dispose();
    }
    this._modelTrackers.clear();
    for (const disposable of this._editorFocusTrackingDisposables.values()) {
      disposable.dispose();
    }
    this._editorFocusTrackingDisposables.clear();
    super.dispose();
  }
};
RenameSymbolTrackerService = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IModelService)
], RenameSymbolTrackerService);
registerSingleton(IRenameSymbolTrackerService, RenameSymbolTrackerService, InstantiationType.Delayed);
