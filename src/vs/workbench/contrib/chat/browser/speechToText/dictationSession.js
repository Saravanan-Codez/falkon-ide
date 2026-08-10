import "./media/dictationSession.css";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { EditorOption } from "../../../../../editor/common/config/editorOptions.js";
import { TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { localize } from "../../../../../nls.js";
import { ChatSpeechToTextState } from "./chatSpeechToTextService.js";
const INTERIM_PROCESSING_CLASS = "dictation-interim-processing";
const LOG_PREFIX = "[chat-stt-dictation]";
class LiveTranscriptInserter {
  constructor(_editor, _logService) {
    this._editor = _editor;
    this._logService = _logService;
    this._needsLeadingSpace = false;
    this._finalized = false;
    this._isApplyingEdit = false;
    this._userModified = false;
    /**
     * The last cumulative transcript this inserter rendered. Captured when the
     * user manually edits the dictated text so everything spoken up to that
     * point can be treated as committed and left untouched.
     */
    this._lastCumulativeText = "";
    /**
     * The leading portion of the cumulative transcript the user has taken
     * ownership of (by editing the inserted text). Later transcript updates only
     * insert the portion of the cumulative transcript that follows this prefix,
     * so dictation keeps working after a manual edit instead of stopping.
     */
    this._committedText = "";
  }
  /**
   * Render the cumulative transcript. While `interim` is true the text is not
   * yet final, so it is rendered in the placeholder color to read as
   * provisional. The final update (`interim === false`) clears the decoration,
   * leaving solid text.
   *
   * Once a final update has been applied, later interim updates are ignored:
   * the transcription service can emit a trailing interim transcript as it
   * shuts down (after `stopAndTranscribe` resolves), which would otherwise
   * overwrite the final text and re-apply the interim styling.
   *
   * If the user has manually edited previously-dictated text, that text is
   * committed and this inserter no longer manages it: only the portion of the
   * cumulative transcript that follows the committed prefix is inserted, into a
   * fresh region at the caret, so dictation keeps working after an edit.
   */
  update(fullText, interim = true) {
    this._logService.trace(`${LOG_PREFIX} inserter.update interim=${interim} finalized=${this._finalized} userModified=${this._userModified} len=${fullText.length}`);
    if (this._finalized && interim) {
      this._logService.trace(`${LOG_PREFIX} inserter.update ignored (already finalized)`);
      return;
    }
    if (!interim) {
      this._finalized = true;
    }
    const model = this._editor.getModel();
    if (!model) {
      this._logService.trace(`${LOG_PREFIX} inserter.update no model`);
      return;
    }
    this._lastCumulativeText = fullText;
    let renderText = fullText;
    if (this._committedText) {
      const committedLength = this._committedText.length;
      renderText = fullText.slice(committedLength);
      renderText = renderText.replace(/^\s+/, "");
      if (renderText.length === 0) {
        this._logService.trace(`${LOG_PREFIX} inserter.update nothing new after user edit`);
        return;
      }
    }
    if (!this._anchor) {
      const selection = this._editor.getSelection() ?? model.getFullModelRange().collapseToEnd();
      const start = selection.getStartPosition();
      this._anchor = start;
      this._end = start;
      this._revertAnchor ??= start;
      this._needsLeadingSpace = start.column > 1 && !/\s$/.test(model.getValueInRange(new Range(
        start.lineNumber,
        Math.max(1, start.column - 1),
        start.lineNumber,
        start.column
      )));
    }
    const text = (this._needsLeadingSpace ? " " : "") + renderText;
    const replaceRange = Range.fromPositions(this._anchor, this._end ?? this._anchor);
    const lines = text.split("\n");
    const endLine = this._anchor.lineNumber + lines.length - 1;
    const endColumn = lines.length === 1 ? this._anchor.column + lines[0].length : lines[lines.length - 1].length + 1;
    this._end = new Position(endLine, endColumn);
    const caret = this._end;
    this._isApplyingEdit = true;
    try {
      this._editor.executeEdits(
        "chatSpeechToText",
        [{ range: replaceRange, text, forceMoveMarkers: true }],
        [Selection.fromPositions(caret)]
      );
    } finally {
      this._isApplyingEdit = false;
    }
    this._updateInterimDecorations(interim);
  }
  onDidChangeModelContent(event) {
    if (this._isApplyingEdit || !this._anchor || !this._end) {
      return;
    }
    const affectsTranscript = event.changes.some((change) => Position.isBeforeOrEqual(
      new Position(change.range.startLineNumber, change.range.startColumn),
      this._end
    ));
    if (!affectsTranscript) {
      return;
    }
    this._logService.trace(`${LOG_PREFIX} transcript invalidated by user edit`);
    this._userModified = true;
    this._committedText = this._lastCumulativeText;
    this._revertAnchor ??= this._anchor;
    this._revertEnd = this._end;
    this._anchor = void 0;
    this._end = void 0;
    this.clearInterimDecorations();
  }
  /**
   * Render the whole not-yet-final transcript in the placeholder color, so it
   * reads as provisional while the user is still speaking. The decoration is
   * cleared once the transcript is finalized, leaving solid text.
   */
  _updateInterimDecorations(interim) {
    if (!interim || !this._anchor || !this._end || Position.equals(this._anchor, this._end)) {
      this._logService.trace(`${LOG_PREFIX} interim decorations clear (interim=${interim})`);
      this._processingDecorations?.clear();
      return;
    }
    this._processingDecorations ??= this._editor.createDecorationsCollection();
    this._logService.trace(`${LOG_PREFIX} interim decorations ${this._anchor.lineNumber}:${this._anchor.column} -> ${this._end.lineNumber}:${this._end.column}`);
    this._processingDecorations.set([{
      range: Range.fromPositions(this._anchor, this._end),
      options: { description: "chatSpeechToText-interim", inlineClassName: INTERIM_PROCESSING_CLASS }
    }]);
  }
  /** Drop the interim styling, leaving whatever text is currently inserted as solid. */
  clearInterimDecorations() {
    this._logService.trace(`${LOG_PREFIX} clearInterimDecorations`);
    this._processingDecorations?.clear();
  }
  /**
   * Lock out further interim updates and drop the interim styling immediately.
   * Called when the user stops talking, before the (async) final transcription
   * resolves, so a trailing interim transcript can neither overwrite the text
   * nor re-apply the styling. The subsequent final `update(text, false)` still
   * applies because it is not an interim update.
   */
  beginFinalize() {
    this._logService.trace(`${LOG_PREFIX} beginFinalize`);
    this._finalized = true;
    this._processingDecorations?.clear();
  }
  /**
   * Range covering the finalized transcript text this inserter wrote,
   * excluding any leading space it prepended, so its content equals the
   * transcript exactly. `undefined` before anything is inserted. Used to track
   * the dictated span for accuracy telemetry after the session ends.
   */
  finalizedRange() {
    if (this._userModified || !this._anchor || !this._end) {
      return void 0;
    }
    const start = this._needsLeadingSpace ? new Position(this._anchor.lineNumber, this._anchor.column + 1) : this._anchor;
    return Range.fromPositions(start, this._end);
  }
  /**
   * Remove everything this inserter has written (including any leading space it
   * added) and restore the caret to where dictation began. Used when dictation
   * is cancelled so no dictated text is left behind.
   *
   * Falls back to `_revertAnchor`/`_revertEnd` when `_anchor`/`_end` have been
   * reset after a user edit, so cancelling dictation after a manual edit still
   * removes the originally-dictated text.
   */
  revert() {
    this._processingDecorations?.clear();
    const model = this._editor.getModel();
    const anchor = this._revertAnchor ?? this._anchor;
    const end = this._end ?? this._revertEnd;
    if (!model || !anchor || !end) {
      return;
    }
    this._editor.executeEdits("chatSpeechToText", [{
      range: Range.fromPositions(anchor, end),
      text: "",
      forceMoveMarkers: true
    }]);
    this._editor.setPosition(anchor);
    this._anchor = void 0;
    this._end = void 0;
    this._revertAnchor = void 0;
    this._revertEnd = void 0;
  }
}
let _active;
let _finalizing;
function isDictating() {
  return !!_active;
}
function activeDictationEditor() {
  return _active?.editor;
}
async function startDictation(service, editor, window, logService, surface = "chat") {
  if (_active?.editor === editor) {
    return;
  }
  if (_active || service.isBusy) {
    await service.cancel();
  }
  if (service.state !== ChatSpeechToTextState.Idle) {
    return;
  }
  const inserter = new LiveTranscriptInserter(editor, logService);
  const disposables = new DisposableStore();
  const HIDE_CURSOR_CLASS = "dictation-hide-cursor";
  editor.getDomNode()?.classList.add(HIDE_CURSOR_CLASS);
  disposables.add(toDisposable(() => editor.getDomNode()?.classList.remove(HIDE_CURSOR_CLASS)));
  const previousPlaceholder = editor.getOption(EditorOption.placeholder);
  const listeningPlaceholder = localize("chatStt.listening", "Listening\u2026");
  let appliedPlaceholder;
  const applyPlaceholder = () => {
    if (!editor.getModel()) {
      return;
    }
    const recording = service.state === ChatSpeechToTextState.Recording;
    const desired = recording && !service.isPreparingModel ? listeningPlaceholder : void 0;
    if (desired !== void 0) {
      if (appliedPlaceholder !== desired) {
        editor.updateOptions({ placeholder: desired });
        appliedPlaceholder = desired;
      }
    } else if (appliedPlaceholder !== void 0) {
      editor.updateOptions({ placeholder: previousPlaceholder });
      appliedPlaceholder = void 0;
    }
  };
  disposables.add(toDisposable(() => {
    inserter.clearInterimDecorations();
    if (!editor.getModel() || appliedPlaceholder === void 0) {
      return;
    }
    editor.updateOptions({ placeholder: previousPlaceholder });
    appliedPlaceholder = void 0;
  }));
  disposables.add(service.onDidUpdateTranscript((update) => {
    logService.trace(`${LOG_PREFIX} onDidUpdateTranscript len=${update.text.length} finalized=${update.finalizedText.length} state=${service.state}`);
    if (!service.showTranscriptWhileDictating) {
      inserter.clearInterimDecorations();
      return;
    }
    inserter.update(update.text);
  }));
  disposables.add(editor.onDidChangeModelContent((event) => inserter.onDidChangeModelContent(event)));
  disposables.add(service.onDidChangePreparingModel(() => applyPlaceholder()));
  disposables.add(service.onDidChangeState((state) => {
    logService.trace(`${LOG_PREFIX} onDidChangeState ${state}`);
    if (state === ChatSpeechToTextState.Idle && _active?.service === service) {
      _active = void 0;
      disposables.dispose();
      return;
    }
    applyPlaceholder();
  }));
  disposables.add(editor.onDidDispose(() => cancelDictation()));
  _active = { service, editor, inserter, disposables, logService, surface };
  try {
    await service.start(window, surface);
  } catch {
    if (_active?.service === service) {
      _active = void 0;
    }
    disposables.dispose();
  }
}
async function stopDictation() {
  const active = _active;
  if (!active) {
    await _finalizing?.promise;
    return;
  }
  _active = void 0;
  const promise = finalizeDictation(active);
  _finalizing = { editor: active.editor, promise };
  try {
    await promise;
  } finally {
    if (_finalizing?.promise === promise) {
      _finalizing = void 0;
    }
  }
}
async function finalizeDictation(active) {
  active.logService.trace(`${LOG_PREFIX} stopDictation begin, state=${active.service.state}`);
  active.inserter.beginFinalize();
  try {
    const text = await active.service.stopAndTranscribe();
    active.logService.trace(`${LOG_PREFIX} stopAndTranscribe resolved text=${text === void 0 ? "undefined" : `len=${text.length}`}`);
    if (text !== void 0) {
      active.inserter.update(text, false);
      trackDictationAccuracy(active, text);
    } else {
      active.inserter.clearInterimDecorations();
    }
  } finally {
    active.logService.trace(`${LOG_PREFIX} stopDictation dispose`);
    active.disposables.dispose();
    active.editor.focus();
  }
}
async function stopDictationForEditor(editor) {
  if (_active?.editor === editor) {
    await stopDictation();
  } else if (_finalizing?.editor === editor) {
    await _finalizing.promise;
  }
}
function cancelDictation() {
  const active = _active;
  if (!active) {
    return;
  }
  _active = void 0;
  active.inserter.revert();
  active.disposables.dispose();
  void active.service.cancel();
}
const _accuracyTrackers = /* @__PURE__ */ new Set();
function notifyDictationSubmitted(editor) {
  for (const tracker of [..._accuracyTrackers]) {
    if (tracker.editor === editor) {
      tracker.measure(true);
    }
  }
}
function trackDictationAccuracy(active, dictatedText) {
  const { editor, inserter, service, surface } = active;
  const model = editor.getModel();
  const range = inserter.finalizedRange();
  if (!model || !range || !dictatedText) {
    return;
  }
  const backend = service.currentBackend;
  const collection = editor.createDecorationsCollection([{
    range,
    options: {
      description: "chatSpeechToText-accuracy",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    }
  }]);
  const store = new DisposableStore();
  let measured = false;
  const tracker = {
    editor,
    measure(submitted) {
      if (measured) {
        return;
      }
      measured = true;
      const current = collection.getRange(0);
      const submittedText = current ? model.getValueInRange(current) : "";
      service.logDictationAccuracy({ dictatedText, submittedText, backend, surface, submitted });
      collection.clear();
      store.dispose();
      _accuracyTrackers.delete(tracker);
    }
  };
  store.add(model.onDidChangeContent(() => {
    if (model.getValueLength() === 0) {
      tracker.measure(false);
    }
  }));
  store.add(model.onWillDispose(() => tracker.measure(false)));
  store.add(editor.onDidDispose(() => tracker.measure(false)));
  _accuracyTrackers.add(tracker);
}
export {
  activeDictationEditor,
  cancelDictation,
  isDictating,
  notifyDictationSubmitted,
  startDictation,
  stopDictation,
  stopDictationForEditor
};
