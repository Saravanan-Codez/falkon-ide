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
import { alert as alertFn } from "../../../../base/browser/ui/aria/aria.js";
import { Delayer } from "../../../../base/common/async.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as strings from "../../../../base/common/strings.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, MultiEditorAction, registerEditorAction, registerEditorCommand, registerEditorContribution, registerMultiEditorAction } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { overviewRulerRangeHighlight } from "../../../common/core/editorColorRegistry.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { OverviewRulerLane } from "../../../common/model.js";
import { CONTEXT_FIND_INPUT_FOCUSED, CONTEXT_FIND_WIDGET_VISIBLE, CONTEXT_REPLACE_INPUT_FOCUSED, FindModelBoundToEditorModel, FIND_IDS, ToggleCaseSensitiveKeybinding, TogglePreserveCaseKeybinding, ToggleRegexKeybinding, ToggleSearchScopeKeybinding, ToggleWholeWordKeybinding } from "./findModel.js";
import { FindOptionsWidget } from "./findOptionsWidget.js";
import { FindReplaceState } from "./findState.js";
import { FindWidget, NLS_NO_RESULTS } from "./findWidget.js";
import * as nls from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { FindWidgetSearchHistory } from "./findWidgetSearchHistory.js";
import { ReplaceWidgetHistory } from "./replaceWidgetHistory.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
const SEARCH_STRING_MAX_LENGTH = 524288;
function getSelectionSearchString(editor, seedSearchStringFromSelection = "single", seedSearchStringFromNonEmptySelection = false) {
  if (!editor.hasModel()) {
    return null;
  }
  const selection = editor.getSelection();
  if (seedSearchStringFromSelection === "single" && selection.startLineNumber === selection.endLineNumber || seedSearchStringFromSelection === "multiple") {
    if (selection.isEmpty()) {
      const wordAtPosition = editor.getConfiguredWordAtPosition(selection.getStartPosition());
      if (wordAtPosition && false === seedSearchStringFromNonEmptySelection) {
        return wordAtPosition.word;
      }
    } else {
      if (editor.getModel().getValueLengthInRange(selection) < SEARCH_STRING_MAX_LENGTH) {
        return editor.getModel().getValueInRange(selection);
      }
    }
  }
  return null;
}
var FindStartFocusAction = /* @__PURE__ */ ((FindStartFocusAction2) => {
  FindStartFocusAction2[FindStartFocusAction2["NoFocusChange"] = 0] = "NoFocusChange";
  FindStartFocusAction2[FindStartFocusAction2["FocusFindInput"] = 1] = "FocusFindInput";
  FindStartFocusAction2[FindStartFocusAction2["FocusReplaceInput"] = 2] = "FocusReplaceInput";
  return FindStartFocusAction2;
})(FindStartFocusAction || {});
let CommonFindController = class extends Disposable {
  static {
    this.ID = "editor.contrib.findController";
  }
  get editor() {
    return this._editor;
  }
  static get(editor) {
    return editor.getContribution(CommonFindController.ID);
  }
  constructor(editor, contextKeyService, storageService, clipboardService, notificationService, hoverService) {
    super();
    this._editor = editor;
    this._findWidgetVisible = CONTEXT_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);
    this._contextKeyService = contextKeyService;
    this._storageService = storageService;
    this._clipboardService = clipboardService;
    this._notificationService = notificationService;
    this._hoverService = hoverService;
    this._updateHistoryDelayer = this._register(new Delayer(500));
    this._state = this._register(new FindReplaceState());
    this.loadQueryState();
    this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
    this._model = null;
    this._register(this._editor.onDidChangeModel(() => {
      const shouldRestartFind = this._editor.getModel() && this._state.isRevealed;
      this.disposeModel();
      this._state.change({
        searchScope: null,
        matchCase: this._storageService.getBoolean("editor.matchCase", StorageScope.WORKSPACE, false),
        wholeWord: this._storageService.getBoolean("editor.wholeWord", StorageScope.WORKSPACE, false),
        isRegex: this._storageService.getBoolean("editor.isRegex", StorageScope.WORKSPACE, false),
        preserveCase: this._storageService.getBoolean("editor.preserveCase", StorageScope.WORKSPACE, false)
      }, false);
      if (shouldRestartFind) {
        this._start({
          forceRevealReplace: false,
          seedSearchStringFromSelection: "none",
          seedSearchStringFromNonEmptySelection: false,
          seedSearchStringFromGlobalClipboard: false,
          shouldFocus: 0 /* NoFocusChange */,
          shouldAnimate: false,
          updateSearchScope: false,
          loop: this._editor.getOption(EditorOption.find).loop
        });
      }
    }));
  }
  dispose() {
    this.disposeModel();
    super.dispose();
  }
  disposeModel() {
    if (this._model) {
      this._model.dispose();
      this._model = null;
    }
  }
  _onStateChanged(e) {
    this.saveQueryState(e);
    if (e.isRevealed) {
      if (this._state.isRevealed) {
        this._findWidgetVisible.set(true);
      } else {
        this._findWidgetVisible.reset();
        this.disposeModel();
      }
    }
    if (e.searchString) {
      this.setGlobalBufferTerm(this._state.searchString);
    }
  }
  saveQueryState(e) {
    if (e.isRegex) {
      this._storageService.store("editor.isRegex", this._state.actualIsRegex, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    if (e.wholeWord) {
      this._storageService.store("editor.wholeWord", this._state.actualWholeWord, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    if (e.matchCase) {
      this._storageService.store("editor.matchCase", this._state.actualMatchCase, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    if (e.preserveCase) {
      this._storageService.store("editor.preserveCase", this._state.actualPreserveCase, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
  }
  loadQueryState() {
    this._state.change({
      matchCase: this._storageService.getBoolean("editor.matchCase", StorageScope.WORKSPACE, this._state.matchCase),
      wholeWord: this._storageService.getBoolean("editor.wholeWord", StorageScope.WORKSPACE, this._state.wholeWord),
      isRegex: this._storageService.getBoolean("editor.isRegex", StorageScope.WORKSPACE, this._state.isRegex),
      preserveCase: this._storageService.getBoolean("editor.preserveCase", StorageScope.WORKSPACE, this._state.preserveCase)
    }, false);
  }
  isFindInputFocused() {
    return !!CONTEXT_FIND_INPUT_FOCUSED.getValue(this._contextKeyService);
  }
  /**
   * Returns whether the Replace input was the last focused input in the find widget.
   * Returns false by default; overridden in FindController.
   */
  wasReplaceInputLastFocused() {
    return false;
  }
  /**
   * Focuses the last focused element in the find widget.
   * Implemented by FindController; base implementation does nothing.
   */
  focusLastElement() {
  }
  getState() {
    return this._state;
  }
  closeFindWidget() {
    this._state.change({
      isRevealed: false,
      searchScope: null
    }, false);
    this._editor.focus();
  }
  toggleCaseSensitive() {
    this._state.change({ matchCase: !this._state.matchCase }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  toggleWholeWords() {
    this._state.change({ wholeWord: !this._state.wholeWord }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  toggleRegex() {
    this._state.change({ isRegex: !this._state.isRegex }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  togglePreserveCase() {
    this._state.change({ preserveCase: !this._state.preserveCase }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  toggleSearchScope() {
    if (this._state.searchScope) {
      this._state.change({ searchScope: null }, true);
    } else {
      if (this._editor.hasModel()) {
        let selections = this._editor.getSelections();
        selections = selections.map((selection) => {
          if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
            selection = selection.setEndPosition(
              selection.endLineNumber - 1,
              this._editor.getModel().getLineMaxColumn(selection.endLineNumber - 1)
            );
          }
          if (!selection.isEmpty()) {
            return selection;
          }
          return null;
        }).filter((element) => !!element);
        if (selections.length) {
          this._state.change({ searchScope: selections }, true);
        }
      }
    }
  }
  setSearchString(searchString) {
    if (this._state.isRegex) {
      searchString = strings.escapeRegExpCharacters(searchString);
    }
    this._state.change({ searchString }, false);
  }
  highlightFindOptions(ignoreWhenVisible = false) {
  }
  async _start(opts, newState) {
    this.disposeModel();
    if (!this._editor.hasModel()) {
      return;
    }
    const stateChanges = {
      ...newState,
      isRevealed: true
    };
    if (opts.seedSearchStringFromSelection === "single") {
      const selectionSearchString = getSelectionSearchString(this._editor, opts.seedSearchStringFromSelection, opts.seedSearchStringFromNonEmptySelection);
      if (selectionSearchString) {
        if (this._state.isRegex) {
          stateChanges.searchString = strings.escapeRegExpCharacters(selectionSearchString);
        } else {
          stateChanges.searchString = selectionSearchString;
        }
      }
    } else if (opts.seedSearchStringFromSelection === "multiple" && !opts.updateSearchScope) {
      const selectionSearchString = getSelectionSearchString(this._editor, opts.seedSearchStringFromSelection);
      if (selectionSearchString) {
        stateChanges.searchString = selectionSearchString;
      }
    }
    if (!stateChanges.searchString && opts.seedSearchStringFromGlobalClipboard) {
      const selectionSearchString = await this.getGlobalBufferTerm();
      if (!this._editor.hasModel()) {
        return;
      }
      if (selectionSearchString) {
        stateChanges.searchString = selectionSearchString;
      }
    }
    if (opts.forceRevealReplace || stateChanges.isReplaceRevealed) {
      stateChanges.isReplaceRevealed = true;
    } else if (!this._findWidgetVisible.get()) {
      stateChanges.isReplaceRevealed = false;
    }
    if (opts.updateSearchScope) {
      const currentSelections = this._editor.getSelections();
      if (currentSelections.some((selection) => !selection.isEmpty())) {
        stateChanges.searchScope = currentSelections;
      }
    }
    stateChanges.loop = opts.loop;
    this._state.change(stateChanges, false);
    if (!this._model) {
      this._model = new FindModelBoundToEditorModel(this._editor, this._state);
    }
  }
  start(opts, newState) {
    return this._start(opts, newState);
  }
  moveToNextMatch() {
    if (this._model) {
      this._model.moveToNextMatch();
      return true;
    }
    return false;
  }
  moveToPrevMatch() {
    if (this._model) {
      this._model.moveToPrevMatch();
      return true;
    }
    return false;
  }
  goToMatch(index) {
    if (this._model) {
      this._model.moveToMatch(index);
      return true;
    }
    return false;
  }
  replace() {
    if (this._model) {
      this._model.replace();
      return true;
    }
    return false;
  }
  replaceAll() {
    if (this._model) {
      if (this._editor.getModel()?.isTooLargeForHeapOperation()) {
        this._notificationService.warn(nls.localize("too.large.for.replaceall", "The file is too large to perform a replace all operation."));
        return false;
      }
      this._model.replaceAll();
      return true;
    }
    return false;
  }
  selectAllMatches() {
    if (this._model) {
      this._model.selectAllMatches();
      this._editor.focus();
      return true;
    }
    return false;
  }
  async getGlobalBufferTerm() {
    if (this._editor.getOption(EditorOption.find).globalFindClipboard && this._editor.hasModel() && !this._editor.getModel().isTooLargeForSyncing()) {
      return this._clipboardService.readFindText();
    }
    return "";
  }
  setGlobalBufferTerm(text) {
    if (this._editor.getOption(EditorOption.find).globalFindClipboard && this._editor.hasModel() && !this._editor.getModel().isTooLargeForSyncing()) {
      this._clipboardService.writeFindText(text);
    }
  }
};
CommonFindController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IHoverService)
], CommonFindController);
let FindController = class extends CommonFindController {
  constructor(editor, _contextViewService, _contextKeyService, _keybindingService, notificationService, _storageService, clipboardService, hoverService, _configurationService, _accessibilityService) {
    super(editor, _contextKeyService, _storageService, clipboardService, notificationService, hoverService);
    this._contextViewService = _contextViewService;
    this._keybindingService = _keybindingService;
    this._configurationService = _configurationService;
    this._accessibilityService = _accessibilityService;
    this._widget = null;
    this._findOptionsWidget = null;
    this._findWidgetSearchHistory = FindWidgetSearchHistory.getOrCreate(_storageService);
    this._replaceWidgetHistory = ReplaceWidgetHistory.getOrCreate(_storageService);
  }
  async _start(opts, newState) {
    if (!this._widget) {
      this._createFindWidget();
    }
    const selection = this._editor.getSelection();
    let updateSearchScope = false;
    switch (this._editor.getOption(EditorOption.find).autoFindInSelection) {
      case "always":
        updateSearchScope = true;
        break;
      case "never":
        updateSearchScope = false;
        break;
      case "multiline": {
        const isSelectionMultipleLine = !!selection && selection.startLineNumber !== selection.endLineNumber;
        updateSearchScope = isSelectionMultipleLine;
        break;
      }
      default:
        break;
    }
    opts.updateSearchScope = opts.updateSearchScope || updateSearchScope;
    await super._start(opts, newState);
    if (this._widget) {
      if (opts.shouldFocus === 2 /* FocusReplaceInput */) {
        this._widget.focusReplaceInput();
      } else if (opts.shouldFocus === 1 /* FocusFindInput */) {
        this._widget.focusFindInput();
      }
    }
  }
  highlightFindOptions(ignoreWhenVisible = false) {
    if (!this._widget) {
      this._createFindWidget();
    }
    if (this._state.isRevealed && !ignoreWhenVisible) {
      this._widget.highlightFindOptions();
    } else {
      this._findOptionsWidget.highlightFindOptions();
    }
  }
  _createFindWidget() {
    this._widget = this._register(new FindWidget(this._editor, this, this._state, this._contextViewService, this._keybindingService, this._contextKeyService, this._hoverService, this._findWidgetSearchHistory, this._replaceWidgetHistory, this._configurationService, this._accessibilityService));
    this._findOptionsWidget = this._register(new FindOptionsWidget(this._editor, this._state, this._keybindingService));
  }
  /**
   * Returns whether the Replace input was the last focused input in the find widget.
   */
  wasReplaceInputLastFocused() {
    return this._widget?.lastFocusedInputWasReplace ?? false;
  }
  /**
   * Focuses the last focused element in the find widget.
   * This is more precise than just focusing the Find or Replace input,
   * as it can restore focus to checkboxes, buttons, etc.
   */
  focusLastElement() {
    this._widget?.focusLastElement();
  }
  saveViewState() {
    return this._widget?.getViewState();
  }
  restoreViewState(state) {
    this._widget?.setViewState(state);
  }
};
FindController = __decorateClass([
  __decorateParam(1, IContextViewService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IClipboardService),
  __decorateParam(7, IHoverService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IAccessibilityService)
], FindController);
const StartFindAction = registerMultiEditorAction(new MultiEditorAction({
  id: FIND_IDS.StartFindAction,
  label: nls.localize2("startFindAction", "Find"),
  precondition: ContextKeyExpr.or(EditorContextKeys.focus, ContextKeyExpr.has("editorIsOpen")),
  kbOpts: {
    kbExpr: null,
    primary: KeyMod.CtrlCmd | KeyCode.KeyF,
    weight: KeybindingWeight.EditorContrib
  },
  menuOpts: {
    menuId: MenuId.MenubarEditMenu,
    group: "3_find",
    title: nls.localize({ key: "miFind", comment: ["&& denotes a mnemonic"] }, "&&Find"),
    order: 1
  }
}));
StartFindAction.addImplementation(0, (accessor, editor, args) => {
  const controller = CommonFindController.get(editor);
  if (!controller) {
    return false;
  }
  return controller.start({
    forceRevealReplace: false,
    seedSearchStringFromSelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
    seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
    seedSearchStringFromGlobalClipboard: editor.getOption(EditorOption.find).globalFindClipboard,
    shouldFocus: 1 /* FocusFindInput */,
    shouldAnimate: true,
    updateSearchScope: false,
    loop: editor.getOption(EditorOption.find).loop
  });
});
const findArgDescription = {
  description: "Open a new In-Editor Find Widget.",
  args: [{
    name: "Open a new In-Editor Find Widget args",
    schema: {
      properties: {
        searchString: { type: "string" },
        replaceString: { type: "string" },
        isRegex: { type: "boolean" },
        matchWholeWord: { type: "boolean" },
        isCaseSensitive: { type: "boolean" },
        preserveCase: { type: "boolean" },
        findInSelection: { type: "boolean" }
      }
    }
  }]
};
class StartFindWithArgsAction extends EditorAction {
  constructor() {
    super({
      id: FIND_IDS.StartFindWithArgs,
      label: nls.localize2("startFindWithArgsAction", "Find with Arguments"),
      precondition: void 0,
      kbOpts: {
        kbExpr: null,
        primary: 0,
        weight: KeybindingWeight.EditorContrib
      },
      metadata: findArgDescription
    });
  }
  async run(accessor, editor, args) {
    const controller = CommonFindController.get(editor);
    if (controller) {
      const newState = args ? {
        searchString: args.searchString,
        replaceString: args.replaceString,
        isReplaceRevealed: args.replaceString !== void 0,
        isRegex: args.isRegex,
        // isRegexOverride: args.regexOverride,
        wholeWord: args.matchWholeWord,
        // wholeWordOverride: args.wholeWordOverride,
        matchCase: args.isCaseSensitive,
        // matchCaseOverride: args.matchCaseOverride,
        preserveCase: args.preserveCase
        // preserveCaseOverride: args.preserveCaseOverride,
      } : {};
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: controller.getState().searchString.length === 0 && editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
        seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
        seedSearchStringFromGlobalClipboard: true,
        shouldFocus: 1 /* FocusFindInput */,
        shouldAnimate: true,
        updateSearchScope: args?.findInSelection || false,
        loop: editor.getOption(EditorOption.find).loop
      }, newState);
      controller.setGlobalBufferTerm(controller.getState().searchString);
    }
  }
}
class StartFindWithSelectionAction extends EditorAction {
  constructor() {
    super({
      id: FIND_IDS.StartFindWithSelection,
      label: nls.localize2("startFindWithSelectionAction", "Find with Selection"),
      precondition: void 0,
      kbOpts: {
        kbExpr: null,
        primary: 0,
        mac: {
          primary: KeyMod.CtrlCmd | KeyCode.KeyE
        },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(accessor, editor) {
    const controller = CommonFindController.get(editor);
    if (controller) {
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "multiple",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: 0 /* NoFocusChange */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(EditorOption.find).loop
      });
      controller.setGlobalBufferTerm(controller.getState().searchString);
    }
  }
}
class MatchFindAction extends EditorAction {
  async run(accessor, editor) {
    const controller = CommonFindController.get(editor);
    if (controller && !this._run(controller)) {
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: controller.getState().searchString.length === 0 && editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
        seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
        seedSearchStringFromGlobalClipboard: true,
        shouldFocus: 0 /* NoFocusChange */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(EditorOption.find).loop
      });
      this._run(controller);
    }
  }
}
async function matchFindAction(editor, next) {
  const controller = CommonFindController.get(editor);
  if (!controller) {
    return;
  }
  const shouldCloseOnResult = editor.getOption(EditorOption.find).closeOnResult;
  const wasFindWidgetVisible = controller.getState().isRevealed;
  const runMatch = () => {
    const previousSelection = controller.editor.getSelection();
    const result = next ? controller.moveToNextMatch() : controller.moveToPrevMatch();
    let landedOnMatch = false;
    if (result) {
      const currentSelection = controller.editor.getSelection();
      if (!previousSelection && currentSelection) {
        landedOnMatch = true;
      } else if (previousSelection && currentSelection && !previousSelection.equalsSelection(currentSelection)) {
        landedOnMatch = true;
      }
    }
    if (landedOnMatch) {
      controller.editor.pushUndoStop();
      if (shouldCloseOnResult && wasFindWidgetVisible && controller.isFindInputFocused()) {
        controller.closeFindWidget();
      }
      return true;
    }
    return false;
  };
  if (!runMatch()) {
    await controller.start({
      forceRevealReplace: false,
      seedSearchStringFromSelection: controller.getState().searchString.length === 0 && editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
      seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
      seedSearchStringFromGlobalClipboard: true,
      shouldFocus: 0 /* NoFocusChange */,
      shouldAnimate: true,
      updateSearchScope: false,
      loop: editor.getOption(EditorOption.find).loop
    });
    if (!runMatch()) {
      const state = controller.getState();
      if (wasFindWidgetVisible && state.matchesCount === 0 && state.searchString) {
        alertFn(nls.localize("ariaSearchNoResult", "{0} found for '{1}'", NLS_NO_RESULTS, state.searchString));
      }
    }
  }
}
const NextMatchFindAction = registerMultiEditorAction(new MultiEditorAction({
  id: FIND_IDS.NextMatchFindAction,
  label: nls.localize2("findNextMatchAction", "Find Next"),
  precondition: void 0,
  kbOpts: [{
    kbExpr: EditorContextKeys.focus,
    primary: KeyCode.F3,
    mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyG, secondary: [KeyCode.F3] },
    weight: KeybindingWeight.EditorContrib
  }, {
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_FIND_INPUT_FOCUSED),
    primary: KeyCode.Enter,
    weight: KeybindingWeight.EditorContrib
  }]
}));
NextMatchFindAction.addImplementation(0, async (accessor, editor, args) => {
  return matchFindAction(editor, true);
});
const PreviousMatchFindAction = registerMultiEditorAction(new MultiEditorAction({
  id: FIND_IDS.PreviousMatchFindAction,
  label: nls.localize2("findPreviousMatchAction", "Find Previous"),
  precondition: void 0,
  kbOpts: [{
    kbExpr: EditorContextKeys.focus,
    primary: KeyMod.Shift | KeyCode.F3,
    mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG, secondary: [KeyMod.Shift | KeyCode.F3] },
    weight: KeybindingWeight.EditorContrib
  }, {
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_FIND_INPUT_FOCUSED),
    primary: KeyMod.Shift | KeyCode.Enter,
    weight: KeybindingWeight.EditorContrib
  }]
}));
PreviousMatchFindAction.addImplementation(0, async (accessor, editor, args) => {
  return matchFindAction(editor, false);
});
class MoveToMatchFindAction extends EditorAction {
  constructor() {
    super({
      id: FIND_IDS.GoToMatchFindAction,
      label: nls.localize2("findMatchAction.goToMatch", "Go to Match..."),
      precondition: CONTEXT_FIND_WIDGET_VISIBLE
    });
    this._highlightDecorations = [];
  }
  run(accessor, editor) {
    const controller = CommonFindController.get(editor);
    if (!controller) {
      return;
    }
    const matchesCount = controller.getState().matchesCount;
    if (matchesCount < 1) {
      const notificationService = accessor.get(INotificationService);
      notificationService.notify({
        severity: Severity.Warning,
        message: nls.localize("findMatchAction.noResults", "No matches. Try searching for something else.")
      });
      return;
    }
    const quickInputService = accessor.get(IQuickInputService);
    const disposables = new DisposableStore();
    const inputBox = disposables.add(quickInputService.createInputBox());
    inputBox.placeholder = nls.localize("findMatchAction.inputPlaceHolder", "Type a number to go to a specific match (between 1 and {0})", matchesCount);
    const toFindMatchIndex = (value) => {
      const index = parseInt(value);
      if (isNaN(index)) {
        return void 0;
      }
      const matchCount = controller.getState().matchesCount;
      if (index > 0 && index <= matchCount) {
        return index - 1;
      } else if (index < 0 && index >= -matchCount) {
        return matchCount + index;
      }
      return void 0;
    };
    const updatePickerAndEditor = (value) => {
      const index = toFindMatchIndex(value);
      if (typeof index === "number") {
        inputBox.validationMessage = void 0;
        controller.goToMatch(index);
        const currentMatch = controller.getState().currentMatch;
        if (currentMatch) {
          this.addDecorations(editor, currentMatch);
        }
      } else {
        inputBox.validationMessage = nls.localize("findMatchAction.inputValidationMessage", "Please type a number between 1 and {0}", controller.getState().matchesCount);
        this.clearDecorations(editor);
      }
    };
    disposables.add(inputBox.onDidChangeValue((value) => {
      updatePickerAndEditor(value);
    }));
    disposables.add(inputBox.onDidAccept(() => {
      const index = toFindMatchIndex(inputBox.value);
      if (typeof index === "number") {
        controller.goToMatch(index);
        inputBox.hide();
      } else {
        inputBox.validationMessage = nls.localize("findMatchAction.inputValidationMessage", "Please type a number between 1 and {0}", controller.getState().matchesCount);
      }
    }));
    disposables.add(inputBox.onDidHide(() => {
      this.clearDecorations(editor);
      disposables.dispose();
    }));
    inputBox.show();
  }
  clearDecorations(editor) {
    editor.changeDecorations((changeAccessor) => {
      this._highlightDecorations = changeAccessor.deltaDecorations(this._highlightDecorations, []);
    });
  }
  addDecorations(editor, range) {
    editor.changeDecorations((changeAccessor) => {
      this._highlightDecorations = changeAccessor.deltaDecorations(this._highlightDecorations, [
        {
          range,
          options: {
            description: "find-match-quick-access-range-highlight",
            className: "rangeHighlight",
            isWholeLine: true
          }
        },
        {
          range,
          options: {
            description: "find-match-quick-access-range-highlight-overview",
            overviewRuler: {
              color: themeColorFromId(overviewRulerRangeHighlight),
              position: OverviewRulerLane.Full
            }
          }
        }
      ]);
    });
  }
}
class SelectionMatchFindAction extends EditorAction {
  async run(accessor, editor) {
    const controller = CommonFindController.get(editor);
    if (!controller) {
      return;
    }
    const selectionSearchString = getSelectionSearchString(editor, "single", false);
    if (selectionSearchString) {
      controller.setSearchString(selectionSearchString);
    }
    if (!this._run(controller)) {
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: 0 /* NoFocusChange */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(EditorOption.find).loop
      });
      this._run(controller);
    }
  }
}
class NextSelectionMatchFindAction extends SelectionMatchFindAction {
  constructor() {
    super({
      id: FIND_IDS.NextSelectionMatchFindAction,
      label: nls.localize2("nextSelectionMatchFindAction", "Find Next Selection"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyCode.F3,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  _run(controller) {
    return controller.moveToNextMatch();
  }
}
class PreviousSelectionMatchFindAction extends SelectionMatchFindAction {
  constructor() {
    super({
      id: FIND_IDS.PreviousSelectionMatchFindAction,
      label: nls.localize2("previousSelectionMatchFindAction", "Find Previous Selection"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F3,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  _run(controller) {
    return controller.moveToPrevMatch();
  }
}
const StartFindReplaceAction = registerMultiEditorAction(new MultiEditorAction({
  id: FIND_IDS.StartFindReplaceAction,
  label: nls.localize2("startReplace", "Replace"),
  precondition: ContextKeyExpr.or(EditorContextKeys.focus, ContextKeyExpr.has("editorIsOpen")),
  kbOpts: {
    kbExpr: null,
    primary: KeyMod.CtrlCmd | KeyCode.KeyH,
    mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyF },
    weight: KeybindingWeight.EditorContrib
  },
  menuOpts: {
    menuId: MenuId.MenubarEditMenu,
    group: "3_find",
    title: nls.localize({ key: "miReplace", comment: ["&& denotes a mnemonic"] }, "&&Replace"),
    order: 2
  }
}));
StartFindReplaceAction.addImplementation(0, (accessor, editor, args) => {
  if (!editor.hasModel() || editor.getOption(EditorOption.readOnly)) {
    return false;
  }
  const controller = CommonFindController.get(editor);
  if (!controller) {
    return false;
  }
  const currentSelection = editor.getSelection();
  const findInputFocused = controller.isFindInputFocused();
  const seedSearchStringFromSelection = !currentSelection.isEmpty() && currentSelection.startLineNumber === currentSelection.endLineNumber && editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" && !findInputFocused;
  const shouldFocus = findInputFocused || seedSearchStringFromSelection ? 2 /* FocusReplaceInput */ : 1 /* FocusFindInput */;
  return controller.start({
    forceRevealReplace: true,
    seedSearchStringFromSelection: seedSearchStringFromSelection ? "single" : "none",
    seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
    seedSearchStringFromGlobalClipboard: editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never",
    shouldFocus,
    shouldAnimate: true,
    updateSearchScope: false,
    loop: editor.getOption(EditorOption.find).loop
  });
});
registerEditorContribution(CommonFindController.ID, FindController, EditorContributionInstantiation.Eager);
registerEditorAction(StartFindWithArgsAction);
registerEditorAction(StartFindWithSelectionAction);
registerEditorAction(MoveToMatchFindAction);
registerEditorAction(NextSelectionMatchFindAction);
registerEditorAction(PreviousSelectionMatchFindAction);
const FindCommand = EditorCommand.bindToContribution(CommonFindController.get);
registerEditorCommand(new FindCommand({
  id: FIND_IDS.CloseFindWidgetCommand,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.closeFindWidget(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleCaseSensitiveCommand,
  precondition: void 0,
  handler: (x) => x.toggleCaseSensitive(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleCaseSensitiveKeybinding.primary,
    mac: ToggleCaseSensitiveKeybinding.mac,
    win: ToggleCaseSensitiveKeybinding.win,
    linux: ToggleCaseSensitiveKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleWholeWordCommand,
  precondition: void 0,
  handler: (x) => x.toggleWholeWords(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleWholeWordKeybinding.primary,
    mac: ToggleWholeWordKeybinding.mac,
    win: ToggleWholeWordKeybinding.win,
    linux: ToggleWholeWordKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleRegexCommand,
  precondition: void 0,
  handler: (x) => x.toggleRegex(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleRegexKeybinding.primary,
    mac: ToggleRegexKeybinding.mac,
    win: ToggleRegexKeybinding.win,
    linux: ToggleRegexKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleSearchScopeCommand,
  precondition: void 0,
  handler: (x) => x.toggleSearchScope(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleSearchScopeKeybinding.primary,
    mac: ToggleSearchScopeKeybinding.mac,
    win: ToggleSearchScopeKeybinding.win,
    linux: ToggleSearchScopeKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.TogglePreserveCaseCommand,
  precondition: void 0,
  handler: (x) => x.togglePreserveCase(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: TogglePreserveCaseKeybinding.primary,
    mac: TogglePreserveCaseKeybinding.mac,
    win: TogglePreserveCaseKeybinding.win,
    linux: TogglePreserveCaseKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceOneAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replace(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Digit1
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceOneAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replace(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_REPLACE_INPUT_FOCUSED),
    primary: KeyCode.Enter
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceAllAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replaceAll(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceAllAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replaceAll(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_REPLACE_INPUT_FOCUSED),
    primary: void 0,
    mac: {
      primary: KeyMod.CtrlCmd | KeyCode.Enter
    }
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.SelectAllMatchesAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.selectAllMatches(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: KeyMod.Alt | KeyCode.Enter
  }
}));
export {
  CommonFindController,
  FindController,
  FindStartFocusAction,
  MatchFindAction,
  MoveToMatchFindAction,
  NextMatchFindAction,
  NextSelectionMatchFindAction,
  PreviousMatchFindAction,
  PreviousSelectionMatchFindAction,
  SelectionMatchFindAction,
  StartFindAction,
  StartFindReplaceAction,
  StartFindWithArgsAction,
  StartFindWithSelectionAction,
  getSelectionSearchString
};
