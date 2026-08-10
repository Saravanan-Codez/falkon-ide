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
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { onUnexpectedError, onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore, dispose, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { assertType, isObject } from "../../../../base/common/types.js";
import { StableEditorScrollState } from "../../../browser/stableEditorScroll.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, registerEditorAction, registerEditorCommand, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { CompletionItemInsertTextRule, CompletionTriggerKind, ProviderId } from "../../../common/languages.js";
import { SnippetController2 } from "../../snippet/browser/snippetController2.js";
import { SnippetParser } from "../../snippet/browser/snippetParser.js";
import { ISuggestMemoryService } from "./suggestMemory.js";
import { WordContextKey } from "./wordContextKey.js";
import * as nls from "../../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Context as SuggestContext, suggestWidgetStatusbarMenu } from "./suggest.js";
import { SuggestAlternatives } from "./suggestAlternatives.js";
import { CommitCharacterController } from "./suggestCommitCharacters.js";
import { State, SuggestModel } from "./suggestModel.js";
import { OvertypingCapturer } from "./suggestOvertypingCapturer.js";
import { SuggestWidget } from "./suggestWidget.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { basename, extname } from "../../../../base/common/resources.js";
import { hash } from "../../../../base/common/hash.js";
import { WindowIdleValue, getWindow } from "../../../../base/browser/dom.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { EditSources } from "../../../common/textModelEditSource.js";
const _sticky = false;
class LineSuffix {
  constructor(_model, _position) {
    this._model = _model;
    this._position = _position;
    this._decorationOptions = ModelDecorationOptions.register({
      description: "suggest-line-suffix",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    const maxColumn = _model.getLineMaxColumn(_position.lineNumber);
    if (maxColumn !== _position.column) {
      const offset = _model.getOffsetAt(_position);
      const end = _model.getPositionAt(offset + 1);
      _model.changeDecorations((accessor) => {
        if (this._marker) {
          accessor.removeDecoration(this._marker);
        }
        this._marker = accessor.addDecoration(Range.fromPositions(_position, end), this._decorationOptions);
      });
    }
  }
  dispose() {
    if (this._marker && !this._model.isDisposed()) {
      this._model.changeDecorations((accessor) => {
        accessor.removeDecoration(this._marker);
        this._marker = void 0;
      });
    }
  }
  delta(position) {
    if (this._model.isDisposed() || this._position.lineNumber !== position.lineNumber) {
      return 0;
    }
    if (this._marker) {
      const range = this._model.getDecorationRange(this._marker);
      const end = this._model.getOffsetAt(range.getStartPosition());
      return end - this._model.getOffsetAt(position);
    } else {
      return this._model.getLineMaxColumn(position.lineNumber) - position.column;
    }
  }
}
var InsertFlags = /* @__PURE__ */ ((InsertFlags2) => {
  InsertFlags2[InsertFlags2["None"] = 0] = "None";
  InsertFlags2[InsertFlags2["NoBeforeUndoStop"] = 1] = "NoBeforeUndoStop";
  InsertFlags2[InsertFlags2["NoAfterUndoStop"] = 2] = "NoAfterUndoStop";
  InsertFlags2[InsertFlags2["KeepAlternativeSuggestions"] = 4] = "KeepAlternativeSuggestions";
  InsertFlags2[InsertFlags2["AlternativeOverwriteConfig"] = 8] = "AlternativeOverwriteConfig";
  return InsertFlags2;
})(InsertFlags || {});
let SuggestController = class {
  constructor(editor, _memoryService, _commandService, _contextKeyService, _instantiationService, _logService, _telemetryService) {
    this._memoryService = _memoryService;
    this._commandService = _commandService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._telemetryService = _telemetryService;
    this._lineSuffix = new MutableDisposable();
    this._toDispose = new DisposableStore();
    this._selectors = new PriorityRegistry((s) => s.priority);
    this._onWillInsertSuggestItem = new Emitter();
    this._wantsForceRenderingAbove = false;
    this.editor = editor;
    this.model = _instantiationService.createInstance(SuggestModel, this.editor);
    this._selectors.register({
      priority: 0,
      select: (model, pos, items) => this._memoryService.select(model, pos, items)
    });
    const ctxInsertMode = SuggestContext.InsertMode.bindTo(_contextKeyService);
    ctxInsertMode.set(editor.getOption(EditorOption.suggest).insertMode);
    this._toDispose.add(this.model.onDidTrigger(() => ctxInsertMode.set(editor.getOption(EditorOption.suggest).insertMode)));
    this.widget = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
      const widget = this._instantiationService.createInstance(SuggestWidget, this.editor);
      this._toDispose.add(widget);
      this._toDispose.add(widget.onDidSelect((item) => this._insertSuggestion(item, 0 /* None */), this));
      const commitCharacterController = new CommitCharacterController(this.editor, widget, this.model, (item) => this._insertSuggestion(item, 2 /* NoAfterUndoStop */));
      this._toDispose.add(commitCharacterController);
      const ctxMakesTextEdit = SuggestContext.MakesTextEdit.bindTo(this._contextKeyService);
      const ctxHasInsertAndReplace = SuggestContext.HasInsertAndReplaceRange.bindTo(this._contextKeyService);
      const ctxCanResolve = SuggestContext.CanResolve.bindTo(this._contextKeyService);
      this._toDispose.add(toDisposable(() => {
        ctxMakesTextEdit.reset();
        ctxHasInsertAndReplace.reset();
        ctxCanResolve.reset();
      }));
      this._toDispose.add(widget.onDidFocus(({ item }) => {
        const position = this.editor.getPosition();
        const startColumn = item.editStart.column;
        const endColumn = position.column;
        let value = true;
        if (this.editor.getOption(EditorOption.acceptSuggestionOnEnter) === "smart" && this.model.state === State.Auto && !item.completion.additionalTextEdits && !(item.completion.insertTextRules & CompletionItemInsertTextRule.InsertAsSnippet) && endColumn - startColumn === item.completion.insertText.length) {
          const oldText = this.editor.getModel().getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn,
            endLineNumber: position.lineNumber,
            endColumn
          });
          value = oldText !== item.completion.insertText;
        }
        ctxMakesTextEdit.set(value);
        ctxHasInsertAndReplace.set(!Position.equals(item.editInsertEnd, item.editReplaceEnd));
        ctxCanResolve.set(Boolean(item.provider.resolveCompletionItem) || Boolean(item.completion.documentation) || item.completion.detail !== item.completion.label);
      }));
      if (this._wantsForceRenderingAbove) {
        widget.forceRenderingAbove();
      }
      return widget;
    }));
    this._overtypingCapturer = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
      return this._toDispose.add(new OvertypingCapturer(this.editor, this.model));
    }));
    this._alternatives = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
      return this._toDispose.add(new SuggestAlternatives(this.editor, this._contextKeyService));
    }));
    this._toDispose.add(_instantiationService.createInstance(WordContextKey, editor));
    this._toDispose.add(this.model.onDidTrigger((e) => {
      this.widget.value.showTriggered(e.auto, e.shy ? 250 : 50);
      this._lineSuffix.value = new LineSuffix(this.editor.getModel(), e.position);
    }));
    this._toDispose.add(this.model.onDidSuggest((e) => {
      if (e.triggerOptions.shy) {
        return;
      }
      let index = -1;
      for (const selector of this._selectors.itemsOrderedByPriorityDesc) {
        index = selector.select(this.editor.getModel(), this.editor.getPosition(), e.completionModel.items);
        if (index !== -1) {
          break;
        }
      }
      if (index === -1) {
        index = 0;
      }
      if (this.model.state === State.Idle) {
        return;
      }
      let noFocus = false;
      if (e.triggerOptions.auto) {
        const options = this.editor.getOption(EditorOption.suggest);
        if (options.selectionMode === "never" || options.selectionMode === "always") {
          noFocus = options.selectionMode === "never";
        } else if (options.selectionMode === "whenTriggerCharacter") {
          noFocus = e.triggerOptions.triggerKind !== CompletionTriggerKind.TriggerCharacter;
        } else if (options.selectionMode === "whenQuickSuggestion") {
          noFocus = e.triggerOptions.triggerKind === CompletionTriggerKind.TriggerCharacter && !e.triggerOptions.refilter;
        }
      }
      this.widget.value.showSuggestions(e.completionModel, index, e.isFrozen, e.triggerOptions.auto, noFocus);
    }));
    this._toDispose.add(this.model.onDidCancel((e) => {
      if (!e.retrigger) {
        this.widget.value.hideWidget();
      }
    }));
    this._toDispose.add(this.editor.onDidBlurEditorWidget(() => {
      if (!_sticky) {
        this.model.cancel();
        this.model.clear();
      }
    }));
    const acceptSuggestionsOnEnter = SuggestContext.AcceptSuggestionsOnEnter.bindTo(_contextKeyService);
    const updateFromConfig = () => {
      const acceptSuggestionOnEnter = this.editor.getOption(EditorOption.acceptSuggestionOnEnter);
      acceptSuggestionsOnEnter.set(acceptSuggestionOnEnter === "on" || acceptSuggestionOnEnter === "smart");
    };
    this._toDispose.add(this.editor.onDidChangeConfiguration(() => updateFromConfig()));
    updateFromConfig();
  }
  static {
    this.ID = "editor.contrib.suggestController";
  }
  static get(editor) {
    return editor.getContribution(SuggestController.ID);
  }
  get onWillInsertSuggestItem() {
    return this._onWillInsertSuggestItem.event;
  }
  dispose() {
    this._alternatives.dispose();
    this._toDispose.dispose();
    this.widget.dispose();
    this.model.dispose();
    this._lineSuffix.dispose();
    this._onWillInsertSuggestItem.dispose();
  }
  _insertSuggestion(event, flags) {
    if (!event || !event.item) {
      this._alternatives.value.reset();
      this.model.cancel();
      this.model.clear();
      return;
    }
    if (!this.editor.hasModel()) {
      return;
    }
    const snippetController = SnippetController2.get(this.editor);
    if (!snippetController) {
      return;
    }
    this._onWillInsertSuggestItem.fire({ item: event.item });
    const model = this.editor.getModel();
    const modelVersionNow = model.getAlternativeVersionId();
    const { item } = event;
    const tasks = [];
    const cts = new CancellationTokenSource();
    if (!(flags & 1 /* NoBeforeUndoStop */)) {
      this.editor.pushUndoStop();
    }
    const info = this.getOverwriteInfo(item, Boolean(flags & 8 /* AlternativeOverwriteConfig */));
    this._memoryService.memorize(model, this.editor.getPosition(), item);
    const isResolved = item.isResolved;
    let _commandExectionDuration = -1;
    let _additionalEditsAppliedAsync = -1;
    if (Array.isArray(item.completion.additionalTextEdits)) {
      this.model.cancel();
      const scrollState = StableEditorScrollState.capture(this.editor);
      this.editor.executeEdits(
        "suggestController.additionalTextEdits.sync",
        item.completion.additionalTextEdits.map((edit) => {
          let range = Range.lift(edit.range);
          if (range.startLineNumber === item.position.lineNumber && range.startColumn > item.position.column) {
            const columnDelta = this.editor.getPosition().column - item.position.column;
            const startColumnDelta = columnDelta;
            const endColumnDelta = Range.spansMultipleLines(range) ? 0 : columnDelta;
            range = new Range(range.startLineNumber, range.startColumn + startColumnDelta, range.endLineNumber, range.endColumn + endColumnDelta);
          }
          return EditOperation.replaceMove(range, edit.text);
        })
      );
      scrollState.restoreRelativeVerticalPositionOfCursor(this.editor);
    } else if (!isResolved) {
      const sw = new StopWatch();
      let position;
      const docListener = model.onDidChangeContent((e) => {
        if (e.isFlush) {
          cts.cancel();
          docListener.dispose();
          return;
        }
        for (const change of e.changes) {
          const thisPosition = Range.getEndPosition(change.range);
          if (!position || Position.isBefore(thisPosition, position)) {
            position = thisPosition;
          }
        }
      });
      const oldFlags = flags;
      flags |= 2 /* NoAfterUndoStop */;
      let didType = false;
      const typeListener = this.editor.onWillType(() => {
        typeListener.dispose();
        didType = true;
        if (!(oldFlags & 2 /* NoAfterUndoStop */)) {
          this.editor.pushUndoStop();
        }
      });
      tasks.push(item.resolve(cts.token).then(() => {
        if (!item.completion.additionalTextEdits || cts.token.isCancellationRequested) {
          return void 0;
        }
        if (position && item.completion.additionalTextEdits.some((edit) => Position.isBefore(position, Range.getStartPosition(edit.range)))) {
          return false;
        }
        if (didType) {
          this.editor.pushUndoStop();
        }
        const scrollState = StableEditorScrollState.capture(this.editor);
        this.editor.executeEdits(
          "suggestController.additionalTextEdits.async",
          item.completion.additionalTextEdits.map((edit) => EditOperation.replaceMove(Range.lift(edit.range), edit.text))
        );
        scrollState.restoreRelativeVerticalPositionOfCursor(this.editor);
        if (didType || !(oldFlags & 2 /* NoAfterUndoStop */)) {
          this.editor.pushUndoStop();
        }
        return true;
      }).then((applied) => {
        this._logService.trace("[suggest] async resolving of edits DONE (ms, applied?)", sw.elapsed(), applied);
        _additionalEditsAppliedAsync = applied === true ? 1 : applied === false ? 0 : -2;
      }).finally(() => {
        docListener.dispose();
        typeListener.dispose();
      }));
    }
    let { insertText } = item.completion;
    if (!(item.completion.insertTextRules & CompletionItemInsertTextRule.InsertAsSnippet)) {
      insertText = SnippetParser.escape(insertText);
    }
    this.model.cancel();
    snippetController.insert(insertText, {
      overwriteBefore: info.overwriteBefore,
      overwriteAfter: info.overwriteAfter,
      undoStopBefore: false,
      undoStopAfter: false,
      adjustWhitespace: !(item.completion.insertTextRules & CompletionItemInsertTextRule.KeepWhitespace),
      clipboardText: event.model.clipboardText,
      overtypingCapturer: this._overtypingCapturer.value,
      reason: EditSources.suggest({ providerId: ProviderId.fromExtensionId(item.extensionId?.value) })
    });
    if (!(flags & 2 /* NoAfterUndoStop */)) {
      this.editor.pushUndoStop();
    }
    if (item.completion.command) {
      if (item.completion.command.id === TriggerSuggestAction.id) {
        this.model.trigger({ auto: true, retrigger: true });
      } else {
        const sw = new StopWatch();
        tasks.push(this._commandService.executeCommand(item.completion.command.id, ...item.completion.command.arguments ? [...item.completion.command.arguments] : []).catch((e) => {
          if (item.completion.extensionId) {
            onUnexpectedExternalError(e);
          } else {
            onUnexpectedError(e);
          }
        }).finally(() => {
          _commandExectionDuration = sw.elapsed();
        }));
      }
    }
    if (flags & 4 /* KeepAlternativeSuggestions */) {
      this._alternatives.value.set(event, (next) => {
        cts.cancel();
        while (model.canUndo()) {
          if (modelVersionNow !== model.getAlternativeVersionId()) {
            model.undo();
          }
          this._insertSuggestion(
            next,
            1 /* NoBeforeUndoStop */ | 2 /* NoAfterUndoStop */ | (flags & 8 /* AlternativeOverwriteConfig */ ? 8 /* AlternativeOverwriteConfig */ : 0)
          );
          break;
        }
      });
    }
    this._alertCompletionItem(item);
    Promise.all(tasks).finally(() => {
      this._reportSuggestionAcceptedTelemetry(item, model, isResolved, _commandExectionDuration, _additionalEditsAppliedAsync, event.index, event.model.items);
      this.model.clear();
      cts.dispose();
    });
  }
  _reportSuggestionAcceptedTelemetry(item, model, itemResolved, commandExectionDuration, additionalEditsAppliedAsync, index, completionItems) {
    if (Math.random() > 1e-4) {
      return;
    }
    const labelMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < Math.min(30, completionItems.length); i++) {
      const label = completionItems[i].textLabel;
      if (labelMap.has(label)) {
        labelMap.get(label).push(i);
      } else {
        labelMap.set(label, [i]);
      }
    }
    const firstIndexArray = labelMap.get(item.textLabel);
    const hasDuplicates = firstIndexArray && firstIndexArray.length > 1;
    const firstIndex = hasDuplicates ? firstIndexArray[0] : -1;
    this._telemetryService.publicLog2("suggest.acceptedSuggestion", {
      extensionId: item.extensionId?.value ?? "unknown",
      providerId: item.provider._debugDisplayName ?? "unknown",
      kind: item.completion.kind,
      basenameHash: hash(basename(model.uri)).toString(16),
      languageId: model.getLanguageId(),
      fileExtension: extname(model.uri),
      resolveInfo: !item.provider.resolveCompletionItem ? -1 : itemResolved ? 1 : 0,
      resolveDuration: item.resolveDuration,
      commandDuration: commandExectionDuration,
      additionalEditsAsync: additionalEditsAppliedAsync,
      index,
      firstIndex
    });
  }
  getOverwriteInfo(item, toggleMode) {
    assertType(this.editor.hasModel());
    let replace = this.editor.getOption(EditorOption.suggest).insertMode === "replace";
    if (toggleMode) {
      replace = !replace;
    }
    const overwriteBefore = item.position.column - item.editStart.column;
    const overwriteAfter = (replace ? item.editReplaceEnd.column : item.editInsertEnd.column) - item.position.column;
    const columnDelta = this.editor.getPosition().column - item.position.column;
    const suffixDelta = this._lineSuffix.value ? this._lineSuffix.value.delta(this.editor.getPosition()) : 0;
    return {
      overwriteBefore: overwriteBefore + columnDelta,
      overwriteAfter: overwriteAfter + suffixDelta
    };
  }
  _alertCompletionItem(item) {
    if (isNonEmptyArray(item.completion.additionalTextEdits)) {
      const msg = nls.localize("aria.alert.snippet", "Accepting '{0}' made {1} additional edits", item.textLabel, item.completion.additionalTextEdits.length);
      alert(msg);
    }
  }
  triggerSuggest(onlyFrom, auto, noFilter) {
    if (this.editor.hasModel()) {
      this.model.trigger({
        auto: auto ?? false,
        completionOptions: { providerFilter: onlyFrom, kindFilter: noFilter ? /* @__PURE__ */ new Set() : void 0 }
      });
      this.editor.revealPosition(this.editor.getPosition(), ScrollType.Smooth);
      this.editor.focus();
    }
  }
  triggerSuggestAndAcceptBest(arg) {
    if (!this.editor.hasModel()) {
      return;
    }
    const positionNow = this.editor.getPosition();
    const fallback = () => {
      if (positionNow.equals(this.editor.getPosition())) {
        this._commandService.executeCommand(arg.fallback);
      }
    };
    const makesTextEdit = (item) => {
      if (item.completion.insertTextRules & CompletionItemInsertTextRule.InsertAsSnippet || item.completion.additionalTextEdits) {
        return true;
      }
      const position = this.editor.getPosition();
      const startColumn = item.editStart.column;
      const endColumn = position.column;
      if (endColumn - startColumn !== item.completion.insertText.length) {
        return true;
      }
      const textNow = this.editor.getModel().getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn,
        endLineNumber: position.lineNumber,
        endColumn
      });
      return textNow !== item.completion.insertText;
    };
    Event.once(this.model.onDidTrigger)((_) => {
      const listener = [];
      Event.any(this.model.onDidTrigger, this.model.onDidCancel)(() => {
        dispose(listener);
        fallback();
      }, void 0, listener);
      this.model.onDidSuggest(({ completionModel }) => {
        dispose(listener);
        if (completionModel.items.length === 0) {
          fallback();
          return;
        }
        const index = this._memoryService.select(this.editor.getModel(), this.editor.getPosition(), completionModel.items);
        const item = completionModel.items[index];
        if (!makesTextEdit(item)) {
          fallback();
          return;
        }
        this.editor.pushUndoStop();
        this._insertSuggestion({ index, item, model: completionModel }, 4 /* KeepAlternativeSuggestions */ | 1 /* NoBeforeUndoStop */ | 2 /* NoAfterUndoStop */);
      }, void 0, listener);
    });
    this.model.trigger({ auto: false, shy: true });
    this.editor.revealPosition(positionNow, ScrollType.Smooth);
    this.editor.focus();
  }
  acceptSelectedSuggestion(keepAlternativeSuggestions, alternativeOverwriteConfig) {
    const item = this.widget.value.getFocusedItem();
    let flags = 0;
    if (keepAlternativeSuggestions) {
      flags |= 4 /* KeepAlternativeSuggestions */;
    }
    if (alternativeOverwriteConfig) {
      flags |= 8 /* AlternativeOverwriteConfig */;
    }
    this._insertSuggestion(item, flags);
  }
  acceptNextSuggestion() {
    this._alternatives.value.next();
  }
  acceptPrevSuggestion() {
    this._alternatives.value.prev();
  }
  cancelSuggestWidget() {
    this.model.cancel();
    this.model.clear();
    this.widget.value.hideWidget();
  }
  focusSuggestion() {
    this.widget.value.focusSelected();
  }
  selectNextSuggestion() {
    this.widget.value.selectNext();
  }
  selectNextPageSuggestion() {
    this.widget.value.selectNextPage();
  }
  selectLastSuggestion() {
    this.widget.value.selectLast();
  }
  selectPrevSuggestion() {
    this.widget.value.selectPrevious();
  }
  selectPrevPageSuggestion() {
    this.widget.value.selectPreviousPage();
  }
  selectFirstSuggestion() {
    this.widget.value.selectFirst();
  }
  toggleSuggestionDetails() {
    this.widget.value.toggleDetails();
  }
  toggleExplainMode() {
    this.widget.value.toggleExplainMode();
  }
  toggleSuggestionFocus() {
    this.widget.value.toggleDetailsFocus();
  }
  resetWidgetSize() {
    this.widget.value.resetPersistedSize();
  }
  forceRenderingAbove() {
    if (this.widget.isInitialized) {
      this.widget.value.forceRenderingAbove();
    } else {
      this._wantsForceRenderingAbove = true;
    }
  }
  stopForceRenderingAbove() {
    if (this.widget.isInitialized) {
      this.widget.value.stopForceRenderingAbove();
    } else {
      this._wantsForceRenderingAbove = false;
    }
  }
  registerSelector(selector) {
    return this._selectors.register(selector);
  }
};
SuggestController = __decorateClass([
  __decorateParam(1, ISuggestMemoryService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, ITelemetryService)
], SuggestController);
class PriorityRegistry {
  constructor(prioritySelector) {
    this.prioritySelector = prioritySelector;
    this._items = new Array();
  }
  register(value) {
    if (this._items.indexOf(value) !== -1) {
      throw new Error("Value is already registered");
    }
    this._items.push(value);
    this._items.sort((s1, s2) => this.prioritySelector(s2) - this.prioritySelector(s1));
    return {
      dispose: () => {
        const idx = this._items.indexOf(value);
        if (idx >= 0) {
          this._items.splice(idx, 1);
        }
      }
    };
  }
  get itemsOrderedByPriorityDesc() {
    return this._items;
  }
}
class TriggerSuggestAction extends EditorAction {
  static {
    this.id = "editor.action.triggerSuggest";
  }
  constructor() {
    super({
      id: TriggerSuggestAction.id,
      label: nls.localize2("suggest.trigger.label", "Trigger Suggest"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasCompletionItemProvider, SuggestContext.Visible.toNegated()),
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyMod.CtrlCmd | KeyCode.Space,
        secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
        mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.Alt | KeyCode.Escape, KeyMod.CtrlCmd | KeyCode.KeyI] },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor, args) {
    const controller = SuggestController.get(editor);
    if (!controller) {
      return;
    }
    let auto;
    if (args && typeof args === "object") {
      if (args.auto === true) {
        auto = true;
      }
    }
    controller.triggerSuggest(void 0, auto, void 0);
  }
}
registerEditorContribution(SuggestController.ID, SuggestController, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(TriggerSuggestAction);
const weight = KeybindingWeight.EditorContrib + 90;
const SuggestCommand = EditorCommand.bindToContribution(SuggestController.get);
registerEditorCommand(new SuggestCommand({
  id: "acceptSelectedSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion),
  handler(x) {
    x.acceptSelectedSuggestion(true, false);
  },
  kbOpts: [{
    // normal tab
    primary: KeyCode.Tab,
    kbExpr: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus),
    weight
  }, {
    // accept on enter has special rules
    primary: KeyCode.Enter,
    kbExpr: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus, SuggestContext.AcceptSuggestionsOnEnter, SuggestContext.MakesTextEdit),
    weight
  }],
  menuOpts: [{
    menuId: suggestWidgetStatusbarMenu,
    title: nls.localize("accept.insert", "Insert"),
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.HasFocusedSuggestion, SuggestContext.HasInsertAndReplaceRange.toNegated())
  }, {
    menuId: suggestWidgetStatusbarMenu,
    title: nls.localize("accept.insert", "Insert"),
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.HasFocusedSuggestion, SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("insert"))
  }, {
    menuId: suggestWidgetStatusbarMenu,
    title: nls.localize("accept.replace", "Replace"),
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.HasFocusedSuggestion, SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("replace"))
  }]
}));
registerEditorCommand(new SuggestCommand({
  id: "acceptAlternativeSelectedSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus, SuggestContext.HasFocusedSuggestion),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.Shift | KeyCode.Enter,
    secondary: [KeyMod.Shift | KeyCode.Tab]
  },
  handler(x) {
    x.acceptSelectedSuggestion(false, true);
  },
  menuOpts: [{
    menuId: suggestWidgetStatusbarMenu,
    group: "left",
    order: 2,
    when: ContextKeyExpr.and(SuggestContext.HasFocusedSuggestion, SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("insert")),
    title: nls.localize("accept.replace", "Replace")
  }, {
    menuId: suggestWidgetStatusbarMenu,
    group: "left",
    order: 2,
    when: ContextKeyExpr.and(SuggestContext.HasFocusedSuggestion, SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("replace")),
    title: nls.localize("accept.insert", "Insert")
  }]
}));
CommandsRegistry.registerCommandAlias("acceptSelectedSuggestionOnEnter", "acceptSelectedSuggestion");
registerEditorCommand(new SuggestCommand({
  id: "hideSuggestWidget",
  precondition: SuggestContext.Visible,
  handler: (x) => x.cancelSuggestWidget(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectNextSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectNextSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.DownArrow,
    secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow],
    mac: { primary: KeyCode.DownArrow, secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow, KeyMod.WinCtrl | KeyCode.KeyN] }
  },
  menuOpts: {
    menuId: suggestWidgetStatusbarMenu,
    group: "left",
    order: 0,
    when: SuggestContext.HasFocusedSuggestion.toNegated(),
    title: nls.localize("focus.suggestion", "Select")
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectNextPageSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectNextPageSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.PageDown,
    secondary: [KeyMod.CtrlCmd | KeyCode.PageDown]
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectLastSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectLastSuggestion()
}));
registerEditorCommand(new SuggestCommand({
  id: "selectPrevSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectPrevSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.UpArrow,
    secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow],
    mac: { primary: KeyCode.UpArrow, secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow, KeyMod.WinCtrl | KeyCode.KeyP] }
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectPrevPageSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectPrevPageSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.PageUp,
    secondary: [KeyMod.CtrlCmd | KeyCode.PageUp]
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectFirstSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectFirstSuggestion()
}));
registerEditorCommand(new SuggestCommand({
  id: "focusSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion.negate()),
  handler: (x) => x.focusSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.CtrlCmd | KeyCode.KeyI] }
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "focusAndAcceptSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion.negate()),
  handler: (c) => {
    c.focusSuggestion();
    c.acceptSelectedSuggestion(true, false);
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "toggleSuggestionDetails",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion),
  handler: (x) => x.toggleSuggestionDetails(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.CtrlCmd | KeyCode.KeyI] }
  },
  menuOpts: [{
    menuId: suggestWidgetStatusbarMenu,
    group: "right",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.DetailsVisible, SuggestContext.CanResolve),
    title: nls.localize("detail.more", "Show Less")
  }, {
    menuId: suggestWidgetStatusbarMenu,
    group: "right",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.DetailsVisible.toNegated(), SuggestContext.CanResolve),
    title: nls.localize("detail.less", "Show More")
  }]
}));
registerEditorCommand(new SuggestCommand({
  id: "toggleExplainMode",
  precondition: SuggestContext.Visible,
  handler: (x) => x.toggleExplainMode(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib,
    primary: KeyMod.CtrlCmd | KeyCode.Slash
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "toggleSuggestionFocus",
  precondition: SuggestContext.Visible,
  handler: (x) => x.toggleSuggestionFocus(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Space,
    mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Space }
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "insertBestCompletion",
  precondition: ContextKeyExpr.and(
    EditorContextKeys.textInputFocus,
    ContextKeyExpr.equals("config.editor.tabCompletion", "on"),
    WordContextKey.AtEnd,
    SuggestContext.Visible.toNegated(),
    SuggestAlternatives.OtherSuggestions.toNegated(),
    SnippetController2.InSnippetMode.toNegated()
  ),
  handler: (x, arg) => {
    x.triggerSuggestAndAcceptBest(isObject(arg) ? { fallback: "tab", ...arg } : { fallback: "tab" });
  },
  kbOpts: {
    weight,
    primary: KeyCode.Tab
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "insertNextSuggestion",
  precondition: ContextKeyExpr.and(
    EditorContextKeys.textInputFocus,
    ContextKeyExpr.equals("config.editor.tabCompletion", "on"),
    SuggestAlternatives.OtherSuggestions,
    SuggestContext.Visible.toNegated(),
    SnippetController2.InSnippetMode.toNegated()
  ),
  handler: (x) => x.acceptNextSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.Tab
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "insertPrevSuggestion",
  precondition: ContextKeyExpr.and(
    EditorContextKeys.textInputFocus,
    ContextKeyExpr.equals("config.editor.tabCompletion", "on"),
    SuggestAlternatives.OtherSuggestions,
    SuggestContext.Visible.toNegated(),
    SnippetController2.InSnippetMode.toNegated()
  ),
  handler: (x) => x.acceptPrevSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.Shift | KeyCode.Tab
  }
}));
registerEditorCommand(new class extends EditorCommand {
  constructor() {
    super({
      id: "suggestWidgetCopy",
      precondition: SuggestContext.DetailsFocused,
      kbOpts: {
        weight: weight + 10,
        kbExpr: SuggestContext.DetailsFocused,
        primary: KeyMod.CtrlCmd | KeyCode.KeyC,
        win: { primary: KeyMod.CtrlCmd | KeyCode.KeyC, secondary: [KeyMod.CtrlCmd | KeyCode.Insert] }
      }
    });
  }
  runEditorCommand(_accessor, editor) {
    getWindow(editor.getDomNode()).document.execCommand("copy");
  }
}());
registerEditorAction(class extends EditorAction {
  constructor() {
    super({
      id: "editor.action.resetSuggestSize",
      label: nls.localize2("suggest.reset.label", "Reset Suggest Widget Size"),
      precondition: void 0
    });
  }
  run(_accessor, editor) {
    SuggestController.get(editor)?.resetWidgetSize();
  }
});
export {
  SuggestController,
  TriggerSuggestAction
};
