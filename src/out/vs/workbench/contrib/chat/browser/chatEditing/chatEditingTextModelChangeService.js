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
import { addDisposableListener, getWindow } from "../../../../../base/browser/dom.js";
import { assert } from "../../../../../base/common/assert.js";
import { DeferredPromise, RunOnceScheduler, timeout } from "../../../../../base/common/async.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { themeColorFromId } from "../../../../../base/common/themables.js";
import { assertType } from "../../../../../base/common/types.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { StringEdit } from "../../../../../editor/common/core/edits/stringEdit.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { LineRange } from "../../../../../editor/common/core/ranges/lineRange.js";
import { nullDocumentDiff } from "../../../../../editor/common/diff/documentDiffProvider.js";
import { TextEdit, VersionedExtensionId } from "../../../../../editor/common/languages.js";
import { MinimapPosition, OverviewRulerLane } from "../../../../../editor/common/model.js";
import { ModelDecorationOptions } from "../../../../../editor/common/model/textModel.js";
import { offsetEditFromContentChanges, offsetEditFromLineRangeMapping, offsetEditToEditOperations } from "../../../../../editor/common/model/textModelStringEdit.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { EditSources } from "../../../../../editor/common/textModelEditSource.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { editorSelectionBackground } from "../../../../../platform/theme/common/colorRegistry.js";
import { ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { pendingRewriteMinimap } from "./chatEditingModifiedFileEntry.js";
import { chatSessionResourceToId } from "../../common/model/chatUri.js";
let ChatEditingTextModelChangeService = class extends Disposable {
  constructor(originalModel, modifiedModel, state, isExternalEditInProgress, _editorWorkerService, _accessibilitySignalService) {
    super();
    this.originalModel = originalModel;
    this.modifiedModel = modifiedModel;
    this.state = state;
    this._editorWorkerService = _editorWorkerService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._isEditFromUs = false;
    this._allEditsAreFromUs = true;
    this._diffOperationIds = 0;
    this._diffInfo = observableValue(this, nullDocumentDiff);
    this._editDecorationClear = this._register(new RunOnceScheduler(() => {
      this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, []);
    }, 500));
    this._editDecorations = [];
    this._didAcceptOrRejectAllHunks = this._register(new Emitter());
    this.onDidAcceptOrRejectAllHunks = this._didAcceptOrRejectAllHunks.event;
    this._didAcceptOrRejectLines = this._register(new Emitter());
    this.onDidAcceptOrRejectLines = this._didAcceptOrRejectLines.event;
    this._didUserEditModelFired = false;
    this._didUserEditModel = this._register(new Emitter());
    this.onDidUserEditModel = this._didUserEditModel.event;
    this._originalToModifiedEdit = StringEdit.empty;
    this.lineChangeCount = 0;
    this.linesAdded = 0;
    this.linesRemoved = 0;
    this._isExternalEditInProgress = isExternalEditInProgress;
    this._register(this.modifiedModel.onDidChangeContent((e) => {
      this._mirrorEdits(e);
    }));
    this._register(toDisposable(() => {
      this.clearCurrentEditLineDecoration();
    }));
    this._register(autorun((r) => this.updateLineChangeCount(this._diffInfo.read(r))));
    if (!originalModel.equalsTextBuffer(modifiedModel.getTextBuffer())) {
      this._updateDiffInfoSeq();
    }
  }
  static {
    this._lastEditDecorationOptions = ModelDecorationOptions.register({
      isWholeLine: true,
      description: "chat-last-edit",
      className: "chat-editing-last-edit-line",
      marginClassName: "chat-editing-last-edit",
      overviewRuler: {
        position: OverviewRulerLane.Full,
        color: themeColorFromId(editorSelectionBackground)
      }
    });
  }
  static {
    this._pendingEditDecorationOptions = ModelDecorationOptions.register({
      isWholeLine: true,
      description: "chat-pending-edit",
      className: "chat-editing-pending-edit",
      minimap: {
        position: MinimapPosition.Inline,
        color: themeColorFromId(pendingRewriteMinimap)
      }
    });
  }
  static {
    this._atomicEditDecorationOptions = ModelDecorationOptions.register({
      isWholeLine: true,
      description: "chat-atomic-edit",
      className: "chat-editing-atomic-edit",
      minimap: {
        position: MinimapPosition.Inline,
        color: themeColorFromId(pendingRewriteMinimap)
      }
    });
  }
  get isEditFromUs() {
    return this._isEditFromUs;
  }
  get allEditsAreFromUs() {
    return this._allEditsAreFromUs;
  }
  get diffInfo() {
    return this._diffInfo.map((value) => {
      return {
        ...value,
        originalModel: this.originalModel,
        modifiedModel: this.modifiedModel,
        keep: (changes) => this._keepHunk(changes),
        undo: (changes) => this._undoHunk(changes)
      };
    });
  }
  notifyHunkAction(state, affectedLines) {
    if (affectedLines.lineCount > 0) {
      this._didAcceptOrRejectLines.fire({ state, ...affectedLines });
    }
  }
  updateLineChangeCount(diff) {
    this.lineChangeCount = 0;
    this.linesAdded = 0;
    this.linesRemoved = 0;
    for (const change of diff.changes) {
      const modifiedRange = change.modified.endLineNumberExclusive - change.modified.startLineNumber;
      this.linesAdded += Math.max(0, modifiedRange);
      const originalRange = change.original.endLineNumberExclusive - change.original.startLineNumber;
      this.linesRemoved += Math.max(0, originalRange);
      this.lineChangeCount += Math.max(modifiedRange, originalRange);
    }
  }
  clearCurrentEditLineDecoration() {
    if (!this.modifiedModel.isDisposed()) {
      this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, []);
    }
  }
  async areOriginalAndModifiedIdentical() {
    const diff = await this._diffOperation;
    return diff ? diff.identical : false;
  }
  async acceptAgentEdits(resource, textEdits, isLastEdits, responseModel) {
    assertType(textEdits.every(TextEdit.isTextEdit), "INVALID args, can only handle text edits");
    assert(isEqual(resource, this.modifiedModel.uri), " INVALID args, can only edit THIS document");
    const isAtomicEdits = textEdits.length > 0 && isLastEdits;
    let maxLineNumber = 0;
    let rewriteRatio = 0;
    const source = this._createEditSource(responseModel);
    if (isAtomicEdits) {
      const minimalEdits = await this._editorWorkerService.computeMoreMinimalEdits(this.modifiedModel.uri, textEdits) ?? textEdits;
      const ops = minimalEdits.map(TextEdit.asEditOperation);
      const undoEdits = this._applyEdits(ops, source);
      if (undoEdits.length > 0) {
        let range;
        for (let i = 0; i < undoEdits.length; i++) {
          const op = undoEdits[i];
          if (!range) {
            range = Range.lift(op.range);
          } else {
            range = Range.plusRange(range, op.range);
          }
        }
        if (range) {
          const defer = new DeferredPromise();
          const listener = addDisposableListener(getWindow(void 0), "animationend", (e) => {
            if (e.animationName === "kf-chat-editing-atomic-edit") {
              defer.complete();
              listener.dispose();
            }
          });
          this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, [{
            options: ChatEditingTextModelChangeService._atomicEditDecorationOptions,
            range
          }]);
          await Promise.any([defer.p, timeout(500)]);
          listener.dispose();
        }
      }
    } else {
      const ops = textEdits.map(TextEdit.asEditOperation);
      const undoEdits = this._applyEdits(ops, source);
      maxLineNumber = undoEdits.reduce((max, op) => Math.max(max, op.range.startLineNumber), 0);
      rewriteRatio = Math.min(1, maxLineNumber / this.modifiedModel.getLineCount());
      const newDecorations = [
        // decorate pending edit (region)
        {
          options: ChatEditingTextModelChangeService._pendingEditDecorationOptions,
          range: new Range(maxLineNumber + 1, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
        }
      ];
      if (maxLineNumber > 0) {
        newDecorations.push({
          options: ChatEditingTextModelChangeService._lastEditDecorationOptions,
          range: new Range(maxLineNumber, 1, maxLineNumber, Number.MAX_SAFE_INTEGER)
        });
      }
      this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, newDecorations);
    }
    if (isLastEdits) {
      this._updateDiffInfoSeq();
      this._editDecorationClear.schedule();
    }
    return { rewriteRatio, maxLineNumber };
  }
  _createEditSource(responseModel) {
    if (!responseModel) {
      return EditSources.unknown({ name: "editSessionUndoRedo" });
    }
    const sessionId = chatSessionResourceToId(responseModel.session.sessionResource);
    const request = responseModel.session.getRequests().at(-1);
    const languageId = this.modifiedModel.getLanguageId();
    const agent = responseModel.agent;
    const extensionId = VersionedExtensionId.tryCreate(agent?.extensionId.value, agent?.extensionVersion);
    if (responseModel.request?.locationData?.type === ChatAgentLocation.EditorInline) {
      return EditSources.inlineChatApplyEdit({
        modelId: request?.modelId,
        requestId: request?.id,
        sessionId,
        languageId,
        extensionId
      });
    }
    return EditSources.chatApplyEdits({
      modelId: request?.modelId,
      requestId: request?.id,
      sessionId,
      languageId,
      mode: request?.modeInfo?.telemetryModeId,
      extensionId,
      codeBlockSuggestionId: request?.modeInfo?.applyCodeBlockSuggestionId
    });
  }
  _applyEdits(edits, source) {
    if (edits.length === 0) {
      return [];
    }
    try {
      this._isEditFromUs = true;
      let result = [];
      this.modifiedModel.pushEditOperations(null, edits, (undoEdits) => {
        result = undoEdits;
        return null;
      }, void 0, source);
      return result;
    } finally {
      this._isEditFromUs = false;
    }
  }
  /**
   * Keeps the current modified document as the final contents.
   */
  keep() {
    this.notifyHunkAction("accepted", { linesAdded: this.linesAdded, linesRemoved: this.linesRemoved, lineCount: this.lineChangeCount, hasRemainingEdits: false });
    this.originalModel.setValue(this.modifiedModel.createSnapshot());
    this._reset();
  }
  /**
   * Undoes the current modified document as the final contents.
   */
  undo() {
    this.notifyHunkAction("rejected", { linesAdded: this.linesAdded, linesRemoved: this.linesRemoved, lineCount: this.lineChangeCount, hasRemainingEdits: false });
    this.modifiedModel.pushStackElement();
    this._applyEdits([EditOperation.replace(this.modifiedModel.getFullModelRange(), this.originalModel.getValue())], EditSources.chatUndoEdits());
    this.modifiedModel.pushStackElement();
    this._reset();
  }
  _reset() {
    this._originalToModifiedEdit = StringEdit.empty;
    this._diffInfo.set(nullDocumentDiff, void 0);
    this._didUserEditModelFired = false;
  }
  async resetDocumentValues(newOriginal, newModified) {
    let didChange = false;
    if (newOriginal !== void 0) {
      this.originalModel.setValue(newOriginal);
      didChange = true;
    }
    if (newModified !== void 0 && this.modifiedModel.getValue() !== newModified) {
      this.modifiedModel.pushStackElement();
      this._applyEdits([EditOperation.replace(this.modifiedModel.getFullModelRange(), newModified)], EditSources.chatReset());
      this.modifiedModel.pushStackElement();
      didChange = true;
    }
    if (didChange) {
      await this._updateDiffInfoSeq();
    }
  }
  _mirrorEdits(event) {
    const edit = offsetEditFromContentChanges(event.changes);
    const isExternalEdit = this._isExternalEditInProgress?.();
    if (this._isEditFromUs || isExternalEdit) {
      const e_sum = this._originalToModifiedEdit;
      const e_ai = edit;
      this._originalToModifiedEdit = e_sum.compose(e_ai);
      if (isExternalEdit) {
        this._updateDiffInfoSeq();
      }
    } else {
      const e_ai = this._originalToModifiedEdit;
      const e_user = edit;
      const e_user_r = e_user.tryRebase(e_ai.inverse(this.originalModel.getValue()));
      if (e_user_r === void 0) {
        this._originalToModifiedEdit = e_ai.compose(e_user);
      } else {
        const edits = offsetEditToEditOperations(e_user_r, this.originalModel);
        this.originalModel.applyEdits(edits);
        this._originalToModifiedEdit = e_ai.rebaseSkipConflicting(e_user_r);
      }
      this._allEditsAreFromUs = false;
      this._updateDiffInfoSeq();
      if (!this._didUserEditModelFired) {
        this._didUserEditModelFired = true;
        this._didUserEditModel.fire();
      }
    }
  }
  async _keepHunk(change) {
    if (!this._diffInfo.get().changes.includes(change)) {
      return false;
    }
    const edits = [];
    for (const edit of change.innerChanges ?? []) {
      const newText = this.modifiedModel.getValueInRange(edit.modifiedRange);
      edits.push(EditOperation.replace(edit.originalRange, newText));
    }
    this.originalModel.pushEditOperations(null, edits, (_) => null);
    await this._updateDiffInfoSeq("accepted");
    if (this._diffInfo.get().identical) {
      this._didAcceptOrRejectAllHunks.fire(ModifiedFileEntryState.Accepted);
    }
    this._accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
    return true;
  }
  async _undoHunk(change) {
    if (!this._diffInfo.get().changes.includes(change)) {
      return false;
    }
    const edits = [];
    for (const edit of change.innerChanges ?? []) {
      const newText = this.originalModel.getValueInRange(edit.originalRange);
      edits.push(EditOperation.replace(edit.modifiedRange, newText));
    }
    this.modifiedModel.pushEditOperations(null, edits, (_) => null);
    await this._updateDiffInfoSeq("rejected");
    if (this._diffInfo.get().identical) {
      this._didAcceptOrRejectAllHunks.fire(ModifiedFileEntryState.Rejected);
    }
    this._accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
    return true;
  }
  async getDiffInfo() {
    if (!this._diffOperation) {
      this._updateDiffInfoSeq();
    }
    await this._diffOperation;
    return this._diffInfo.get();
  }
  async _updateDiffInfoSeq(notifyAction = void 0) {
    const myDiffOperationId = ++this._diffOperationIds;
    await Promise.resolve(this._diffOperation);
    const previousCount = this.lineChangeCount;
    const previousAdded = this.linesAdded;
    const previousRemoved = this.linesRemoved;
    if (this._diffOperationIds === myDiffOperationId) {
      const thisDiffOperation = this._updateDiffInfo();
      this._diffOperation = thisDiffOperation;
      await thisDiffOperation;
      if (notifyAction) {
        const affectedLines = {
          linesAdded: previousAdded - this.linesAdded,
          linesRemoved: previousRemoved - this.linesRemoved,
          lineCount: previousCount - this.lineChangeCount,
          hasRemainingEdits: this.lineChangeCount > 0
        };
        this.notifyHunkAction(notifyAction, affectedLines);
      }
    }
  }
  hasHunkAt(range) {
    return this._diffInfo.get().changes.some((c) => c.modified.intersectsStrict(LineRange.fromRangeInclusive(range)));
  }
  async _updateDiffInfo() {
    if (this.originalModel.isDisposed() || this.modifiedModel.isDisposed() || this._store.isDisposed) {
      return void 0;
    }
    if (this.state.get() !== ModifiedFileEntryState.Modified) {
      this._diffInfo.set(nullDocumentDiff, void 0);
      this._originalToModifiedEdit = StringEdit.empty;
      return nullDocumentDiff;
    }
    const docVersionNow = this.modifiedModel.getVersionId();
    const snapshotVersionNow = this.originalModel.getVersionId();
    const diff = await this._editorWorkerService.computeDiff(
      this.originalModel.uri,
      this.modifiedModel.uri,
      {
        ignoreTrimWhitespace: false,
        // NEVER ignore whitespace so that undo/accept edits are correct and so that all changes (1 of 2) are spelled out
        computeMoves: false,
        maxComputationTimeMs: 3e3
      },
      "advanced"
    );
    if (this.originalModel.isDisposed() || this.modifiedModel.isDisposed() || this._store.isDisposed) {
      return void 0;
    }
    if (this.modifiedModel.getVersionId() === docVersionNow && this.originalModel.getVersionId() === snapshotVersionNow) {
      const diff2 = diff ?? nullDocumentDiff;
      this._diffInfo.set(diff2, void 0);
      this._originalToModifiedEdit = offsetEditFromLineRangeMapping(this.originalModel, this.modifiedModel, diff2.changes);
      return diff2;
    }
    return void 0;
  }
};
ChatEditingTextModelChangeService = __decorateClass([
  __decorateParam(4, IEditorWorkerService),
  __decorateParam(5, IAccessibilitySignalService)
], ChatEditingTextModelChangeService);
export {
  ChatEditingTextModelChangeService
};
