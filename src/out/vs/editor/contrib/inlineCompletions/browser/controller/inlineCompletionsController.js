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
import { alert } from "../../../../../base/browser/ui/aria/aria.js";
import { timeout } from "../../../../../base/common/async.js";
import { cancelOnDispose } from "../../../../../base/common/cancellation.js";
import { createHotClass } from "../../../../../base/common/hotReloadHelpers.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, derivedDisposable, derivedObservableWithCache, observableFromEvent, observableSignal, observableValue, runOnChange, runOnChangeWithStore, transaction, waitForState } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { isUndefined } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { hotClassGetOriginalInstance } from "../../../../../platform/observable/common/wrapInHotClass.js";
import { CoreEditingCommands } from "../../../../browser/coreCommands.js";
import { observableCodeEditor } from "../../../../browser/observableCodeEditor.js";
import { TriggerInlineEditCommandsRegistry } from "../../../../browser/triggerInlineEditCommandsRegistry.js";
import { getOuterEditor } from "../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { Position } from "../../../../common/core/position.js";
import { CursorChangeReason } from "../../../../common/cursorEvents.js";
import { ILanguageFeatureDebounceService } from "../../../../common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { FIND_IDS } from "../../../find/browser/findModel.js";
import { NextMarkerAction, NextMarkerInFilesAction, PrevMarkerAction, PrevMarkerInFilesAction } from "../../../gotoError/browser/gotoError.js";
import { InsertLineAfterAction, InsertLineBeforeAction } from "../../../linesOperations/browser/linesOperations.js";
import { InlineSuggestionHintsContentWidget } from "../hintsWidget/inlineCompletionsHintsWidget.js";
import { TextModelChangeRecorder } from "../model/changeRecorder.js";
import { InlineCompletionsModel } from "../model/inlineCompletionsModel.js";
import { ObservableSuggestWidgetAdapter } from "../model/suggestWidgetAdapter.js";
import { ObservableContextKeyService } from "../utils.js";
import { InlineSuggestionsView } from "../view/inlineSuggestionsView.js";
import { inlineSuggestCommitId, jumpToNextInlineEditId } from "./commandIds.js";
import { setInlineCompletionsControllerGetter } from "./common.js";
import { InlineCompletionContextKeys } from "./inlineCompletionContextKeys.js";
setInlineCompletionsControllerGetter((editor) => InlineCompletionsController.get(editor));
let InlineCompletionsController = class extends Disposable {
  constructor(editor, _instantiationService, _contextKeyService, _configurationService, _commandService, _debounceService, _languageFeaturesService, _accessibilitySignalService, _keybindingService) {
    super();
    this.editor = editor;
    this._instantiationService = _instantiationService;
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._commandService = _commandService;
    this._debounceService = _debounceService;
    this._languageFeaturesService = _languageFeaturesService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._keybindingService = _keybindingService;
    this._focusIsInMenu = observableValue(this, false);
    this._focusIsInEditorOrMenu = derived(this, (reader) => {
      const editorHasFocus = this._editorObs.isFocused.read(reader);
      const menuHasFocus = this._focusIsInMenu.read(reader);
      return editorHasFocus || menuHasFocus;
    });
    this._cursorIsInIndentation = derived(this, (reader) => {
      const cursorPos = this._editorObs.cursorPosition.read(reader);
      if (cursorPos === null) {
        return false;
      }
      const model = this._editorObs.model.read(reader);
      if (!model) {
        return false;
      }
      this._editorObs.versionId.read(reader);
      const indentMaxColumn = model.getLineIndentColumn(cursorPos.lineNumber);
      return cursorPos.column <= indentMaxColumn;
    });
    this.model = derivedDisposable(this, (reader) => {
      if (this._editorObs.isReadonly.read(reader)) {
        return void 0;
      }
      const textModel = this._editorObs.model.read(reader);
      if (!textModel) {
        return void 0;
      }
      const model = this._instantiationService.createInstance(
        InlineCompletionsModel,
        textModel,
        this._suggestWidgetAdapter.selectedItem,
        this._editorObs.versionId,
        this._positions,
        this._debounceValue,
        this._enabledInConfig,
        () => this._isEditorDictationInProgress(),
        this.editor
      );
      return model;
    });
    this._playAccessibilitySignal = observableSignal(this);
    this._view = derived((reader) => reader.store.add(this._instantiationService.createInstance(InlineSuggestionsView.hot.read(reader), this.editor, this.model, this._focusIsInMenu)));
    this._editorObs = observableCodeEditor(this.editor);
    this._positions = derived(this, (reader) => this._editorObs.selections.read(reader)?.map((s) => s.getEndPosition()) ?? [new Position(1, 1)]);
    this._suggestWidgetAdapter = this._register(new ObservableSuggestWidgetAdapter(
      this._editorObs,
      (item) => this.model.get()?.handleSuggestAccepted(item),
      () => this.model.get()?.selectedInlineCompletion.get()?.getSingleTextEdit()
    ));
    this._enabledInConfig = observableFromEvent(this, this.editor.onDidChangeConfiguration, () => this.editor.getOption(EditorOption.inlineSuggest).enabled);
    this._register(this._contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(/* @__PURE__ */ new Set(["editorDictation.inProgress"])) && this._isEditorDictationInProgress()) {
        this.model.get()?.stop();
      }
    }));
    this._debounceValue = this._debounceService.for(
      this._languageFeaturesService.inlineCompletionsProvider,
      "InlineCompletionsDebounce",
      { min: 50, max: 50 }
    );
    this.model.recomputeInitiallyAndOnChange(this._store);
    this._hideInlineEditOnSelectionChange = this._editorObs.getOption(EditorOption.inlineSuggest).map((val) => true);
    this._view.recomputeInitiallyAndOnChange(this._store);
    InlineCompletionsController._instances.add(this);
    this._register(toDisposable(() => InlineCompletionsController._instances.delete(this)));
    this._register(autorun((reader) => {
      const model = this.model.read(reader);
      if (!model) {
        return;
      }
      const state = model.state.read(reader);
      if (!state) {
        return;
      }
      if (!this._focusIsInEditorOrMenu.read(void 0)) {
        return;
      }
      const nextEditUri = state.kind === "inlineEdit" ? state.nextEditUri : void 0;
      for (const ctrl of InlineCompletionsController._instances) {
        if (ctrl === this) {
          continue;
        } else if (nextEditUri && isEqual(nextEditUri, ctrl.editor.getModel()?.uri)) {
          ctrl.model.read(void 0)?.trigger();
        } else {
          ctrl.reject();
        }
      }
    }));
    this._register(autorun((reader) => {
      const model = this.model.read(reader);
      const uri = this.editor.getModel()?.uri;
      if (!model || !uri) {
        return;
      }
      reader.store.add(model.onDidAccept(() => {
        for (const ctrl of InlineCompletionsController._instances) {
          if (ctrl === this) {
            continue;
          }
          const state = ctrl.model.read(void 0)?.state.read(void 0);
          if (state?.kind === "inlineEdit" && isEqual(state.nextEditUri, uri)) {
            ctrl.model.read(void 0)?.stop("automatic");
          }
        }
      }));
    }));
    this._register(runOnChange(this._editorObs.onDidType, (_value, _changes) => {
      if (this._enabledInConfig.get() && !this._isEditorDictationInProgress()) {
        this.model.get()?.trigger();
      }
    }));
    this._register(runOnChange(this._editorObs.onDidPaste, (_value, _changes) => {
      if (this._enabledInConfig.get() && !this._isEditorDictationInProgress()) {
        this.model.get()?.trigger();
      }
    }));
    const triggerCommands = /* @__PURE__ */ new Set([
      CoreEditingCommands.Tab.id,
      CoreEditingCommands.DeleteLeft.id,
      CoreEditingCommands.DeleteRight.id,
      inlineSuggestCommitId,
      "acceptSelectedSuggestion",
      InsertLineAfterAction.ID,
      InsertLineBeforeAction.ID,
      FIND_IDS.NextMatchFindAction,
      NextMarkerAction.ID,
      PrevMarkerAction.ID,
      NextMarkerInFilesAction.ID,
      PrevMarkerInFilesAction.ID,
      ...TriggerInlineEditCommandsRegistry.getRegisteredCommands()
    ]);
    this._register(this._commandService.onDidExecuteCommand((e) => {
      if (triggerCommands.has(e.commandId) && editor.hasTextFocus() && this._enabledInConfig.get() && !this._isEditorDictationInProgress()) {
        let noDelay = false;
        if (e.commandId === inlineSuggestCommitId) {
          noDelay = true;
        }
        this._editorObs.forceUpdate((tx) => {
          this.model.get()?.trigger(tx, { noDelay });
        });
      }
    }));
    this._register(runOnChange(this._editorObs.selections, (_value, _, changes) => {
      if (changes.some((e) => e.reason === CursorChangeReason.Explicit || e.source === "api")) {
        if (!this._hideInlineEditOnSelectionChange.get() && this.model.get()?.state.get()?.kind === "inlineEdit") {
          return;
        }
        const m = this.model.get();
        if (!m) {
          return;
        }
        if (m.state.get()?.kind === "ghostText") {
          this.model.get()?.stop();
        }
      }
    }));
    this._register(autorun((reader) => {
      const isFocused = this._focusIsInEditorOrMenu.read(reader);
      const model = this.model.read(void 0);
      if (isFocused) {
        const state = model?.state.read(void 0);
        if (!state || state.kind !== "inlineEdit" || !state.nextEditUri) {
          transaction((tx) => {
            for (const ctrl of InlineCompletionsController._instances) {
              if (ctrl !== this) {
                ctrl.model.read(void 0)?.stop("automatic", tx);
              }
            }
          });
        }
        return;
      }
      if (this._contextKeyService.getContextKeyValue("accessibleViewIsShown") || this._configurationService.getValue("editor.inlineSuggest.keepOnBlur") || editor.getOption(EditorOption.inlineSuggest).keepOnBlur || InlineSuggestionHintsContentWidget.dropDownVisible) {
        return;
      }
      if (!model) {
        return;
      }
      if (model.state.read(void 0)?.inlineSuggestion?.isFromExplicitRequest && model.inlineEditAvailable.read(void 0)) {
        return;
      }
      transaction((tx) => {
        model.stop("automatic", tx);
      });
    }));
    this._register(autorun((reader) => {
      const state = this.model.read(reader)?.inlineCompletionState.read(reader);
      if (state?.suggestItem) {
        if (state.primaryGhostText.lineCount >= 2) {
          this._suggestWidgetAdapter.forceRenderingAbove();
        }
      } else {
        this._suggestWidgetAdapter.stopForceRenderingAbove();
      }
    }));
    this._register(toDisposable(() => {
      this._suggestWidgetAdapter.stopForceRenderingAbove();
    }));
    const currentInlineCompletionBySemanticId = derivedObservableWithCache(this, (reader, last) => {
      const model = this.model.read(reader);
      const state = model?.state.read(reader);
      if (this._suggestWidgetAdapter.selectedItem.get()) {
        return last;
      }
      return state?.inlineSuggestion?.semanticId;
    });
    this._register(runOnChangeWithStore(derived((reader) => {
      this._playAccessibilitySignal.read(reader);
      currentInlineCompletionBySemanticId.read(reader);
      return {};
    }), async (_value, _, _deltas, store) => {
      let model = this.model.get();
      let state = model?.state.get();
      if (!state || !model) {
        return;
      }
      await timeout(50, cancelOnDispose(store));
      await waitForState(this._suggestWidgetAdapter.selectedItem, isUndefined, () => false, cancelOnDispose(store));
      model = this.model.get();
      state = model?.state.get();
      if (!state || !model) {
        return;
      }
      const lineText = state.kind === "ghostText" ? model.textModel.getLineContent(state.primaryGhostText.lineNumber) : "";
      this._accessibilitySignalService.playSignal(state.kind === "ghostText" ? AccessibilitySignal.inlineSuggestion : AccessibilitySignal.nextEditSuggestion);
      if (this.editor.getOption(EditorOption.screenReaderAnnounceInlineSuggestion)) {
        if (state.kind === "ghostText") {
          this._provideScreenReaderUpdate(state.primaryGhostText.renderForScreenReader(lineText));
        } else {
          const lineNumber = state.inlineSuggestion.targetRange.startLineNumber;
          const tabShouldAccept = model.tabShouldAcceptInlineEdit.get();
          const tabShouldJump = model.tabShouldJumpToInlineEdit.get();
          let content;
          if (tabShouldAccept) {
            const kb = this._keybindingService.lookupKeybinding(inlineSuggestCommitId)?.getAriaLabel();
            content = kb ? localize("nextEditSuggestionAcceptWithKb", "Next edit suggestion available on line {0}, press {1} to accept", lineNumber, kb) : localize("nextEditSuggestionAcceptNoKb", "Next edit suggestion available on line {0}, accept it to apply", lineNumber);
          } else if (tabShouldJump) {
            const kb = this._keybindingService.lookupKeybinding(jumpToNextInlineEditId)?.getAriaLabel();
            content = kb ? localize("nextEditSuggestionJumpWithKb", "Next edit suggestion available on line {0}, press {1} to jump", lineNumber, kb) : localize("nextEditSuggestionJumpNoKb", "Next edit suggestion available on line {0}", lineNumber);
          } else {
            content = localize("nextEditSuggestionNoAction", "Next edit suggestion available on line {0}", lineNumber);
          }
          this._provideScreenReaderUpdate(content);
        }
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("accessibility.verbosity.inlineCompletions")) {
        this.editor.updateOptions({ inlineCompletionsAccessibilityVerbose: this._configurationService.getValue("accessibility.verbosity.inlineCompletions") });
      }
    }));
    this.editor.updateOptions({ inlineCompletionsAccessibilityVerbose: this._configurationService.getValue("accessibility.verbosity.inlineCompletions") });
    const contextKeySvcObs = new ObservableContextKeyService(this._contextKeyService);
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.cursorInIndentation, this._cursorIsInIndentation));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.hasSelection, (reader) => !this._editorObs.cursorSelection.read(reader)?.isEmpty()));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.cursorAtInlineEdit, this.model.map((m, reader) => m?.inlineEditState?.read(reader)?.cursorAtInlineEdit.read(reader))));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.tabShouldAcceptInlineEdit, this.model.map((m, r) => !!m?.tabShouldAcceptInlineEdit.read(r))));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.tabShouldJumpToInlineEdit, this.model.map((m, r) => !!m?.tabShouldJumpToInlineEdit.read(r))));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.inlineEditVisible, (reader) => this.model.read(reader)?.inlineEditState.read(reader) !== void 0));
    this._register(contextKeySvcObs.bind(
      InlineCompletionContextKeys.inlineSuggestionHasIndentation,
      (reader) => this.model.read(reader)?.getIndentationInfo(reader)?.startsWithIndentation
    ));
    this._register(contextKeySvcObs.bind(
      InlineCompletionContextKeys.inlineSuggestionHasIndentationLessThanTabSize,
      (reader) => this.model.read(reader)?.getIndentationInfo(reader)?.startsWithIndentationLessThanTabSize
    ));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.suppressSuggestions, (reader) => {
      const model = this.model.read(reader);
      const state = model?.inlineCompletionState.read(reader);
      return state?.primaryGhostText && state?.inlineSuggestion ? state.inlineSuggestion.source.inlineSuggestions.suppressSuggestions : void 0;
    }));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.inlineSuggestionAlternativeActionVisible, (reader) => {
      const model = this.model.read(reader);
      const state = model?.inlineEditState.read(reader);
      const action = state?.inlineSuggestion.action;
      return action && action.kind === "edit" && action.alternativeAction !== void 0;
    }));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.inlineSuggestionVisible, (reader) => {
      const model = this.model.read(reader);
      const state = model?.inlineCompletionState.read(reader);
      return !!state?.inlineSuggestion && state?.primaryGhostText !== void 0 && !state?.primaryGhostText.isEmpty();
    }));
    const firstGhostTextPos = derived(this, (reader) => {
      const model = this.model.read(reader);
      const state = model?.inlineCompletionState.read(reader);
      const primaryGhostText = state?.primaryGhostText;
      if (!primaryGhostText || primaryGhostText.isEmpty()) {
        return void 0;
      }
      const firstPartPos = new Position(primaryGhostText.lineNumber, primaryGhostText.parts[0].column);
      return firstPartPos;
    });
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.cursorBeforeGhostText, (reader) => {
      const firstPartPos = firstGhostTextPos.read(reader);
      if (!firstPartPos) {
        return false;
      }
      const cursorPos = this._editorObs.cursorPosition.read(reader);
      if (!cursorPos) {
        return false;
      }
      return firstPartPos.equals(cursorPos);
    }));
    this._register(this._instantiationService.createInstance(TextModelChangeRecorder, this.editor));
  }
  static {
    this._instances = /* @__PURE__ */ new Set();
  }
  static {
    this.hot = createHotClass(this);
  }
  static {
    this.ID = "editor.contrib.inlineCompletionsController";
  }
  /**
   * Find the controller in the focused editor or in the outer editor (if applicable)
   */
  static getInFocusedEditorOrParent(accessor) {
    const outerEditor = getOuterEditor(accessor);
    if (!outerEditor) {
      return null;
    }
    return InlineCompletionsController.get(outerEditor);
  }
  static get(editor) {
    return hotClassGetOriginalInstance(editor.getContribution(InlineCompletionsController.ID));
  }
  _isEditorDictationInProgress() {
    return this._contextKeyService.getContext(this.editor.getDomNode())?.getValue("editorDictation.inProgress") === true;
  }
  playAccessibilitySignal(tx) {
    this._playAccessibilitySignal.trigger(tx);
  }
  _provideScreenReaderUpdate(content) {
    const accessibleViewShowing = this._contextKeyService.getContextKeyValue("accessibleViewIsShown");
    const accessibleViewKeybinding = this._keybindingService.lookupKeybinding("editor.action.accessibleView");
    let hint;
    if (!accessibleViewShowing && accessibleViewKeybinding && this.editor.getOption(EditorOption.inlineCompletionsAccessibilityVerbose)) {
      hint = localize("showAccessibleViewHint", "Inspect this in the accessible view ({0})", accessibleViewKeybinding.getAriaLabel());
    }
    alert(hint ? content + ", " + hint : content);
  }
  shouldShowHoverAt(range) {
    const ghostText = this.model.get()?.primaryGhostText.get();
    if (!ghostText) {
      return false;
    }
    return ghostText.parts.some((p) => range.containsPosition(new Position(ghostText.lineNumber, p.column)));
  }
  shouldShowHoverAtViewZone(viewZoneId) {
    return this._view.get().shouldShowHoverAtViewZone(viewZoneId);
  }
  reject() {
    transaction((tx) => {
      const m = this.model.get();
      if (m) {
        m.stop("explicitCancel", tx);
        if (this._focusIsInEditorOrMenu.get()) {
          for (const ctrl of InlineCompletionsController._instances) {
            if (ctrl !== this && !ctrl._focusIsInEditorOrMenu.get()) {
              ctrl.model.get()?.stop("automatic", tx);
            }
          }
        }
      }
    });
  }
  jump() {
    const m = this.model.get();
    if (m) {
      m.jump();
    }
  }
};
InlineCompletionsController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, ILanguageFeatureDebounceService),
  __decorateParam(6, ILanguageFeaturesService),
  __decorateParam(7, IAccessibilitySignalService),
  __decorateParam(8, IKeybindingService)
], InlineCompletionsController);
export {
  InlineCompletionsController
};
