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
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { InputBox } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { Action } from "../../../../base/common/actions.js";
import { Delayer, disposableTimeout } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { CONTEXT_FIND_WIDGET_NOT_VISIBLE } from "../../../../editor/contrib/find/browser/findModel.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ContextScopedReplaceInput } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { isSearchViewFocused, getSearchView } from "./searchActionsBase.js";
import * as Constants from "../common/constants.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { Toggle } from "../../../../base/browser/ui/toggle/toggle.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { searchReplaceAllIcon, searchHideReplaceIcon, searchShowContextIcon, searchShowReplaceIcon } from "./searchIcons.js";
import { ToggleSearchEditorContextLinesCommandId } from "../../searchEditor/browser/constants.js";
import { showHistoryKeybindingHint } from "../../../../platform/history/browser/historyWidgetKeybindingHint.js";
import { defaultInputBoxStyles, defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { NotebookFindFilters } from "../../notebook/browser/contrib/find/findFilters.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { NotebookEditorInput } from "../../notebook/common/notebookEditorInput.js";
import { GroupModelChangeKind } from "../../../common/editor.js";
import { SearchFindInput } from "./searchFindInput.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { NotebookFindScopeType } from "../../notebook/common/notebookCommon.js";
const SingleLineInputHeight = 26;
class ReplaceAllAction extends Action {
  constructor(_searchWidget) {
    super(ReplaceAllAction.ID, "", ThemeIcon.asClassName(searchReplaceAllIcon), false);
    this._searchWidget = _searchWidget;
  }
  static {
    this.ID = "search.action.replaceAll";
  }
  set searchWidget(searchWidget) {
    this._searchWidget = searchWidget;
  }
  run() {
    if (this._searchWidget) {
      return this._searchWidget.triggerReplaceAll();
    }
    return Promise.resolve();
  }
}
const hoverLifecycleOptions = { groupId: "search-widget" };
const ctrlKeyMod = isMacintosh ? KeyMod.WinCtrl : KeyMod.CtrlCmd;
function stopPropagationForMultiLineUpwards(event, value, textarea) {
  const isMultiline = !!value.match(/\n/);
  if (textarea && (isMultiline || textarea.clientHeight > SingleLineInputHeight) && textarea.selectionStart > 0) {
    event.stopPropagation();
    return;
  }
}
function stopPropagationForMultiLineDownwards(event, value, textarea) {
  const isMultiline = !!value.match(/\n/);
  if (textarea && (isMultiline || textarea.clientHeight > SingleLineInputHeight) && textarea.selectionEnd < textarea.value.length) {
    event.stopPropagation();
    return;
  }
}
let SearchWidget = class extends Widget {
  constructor(container, options, contextViewService, contextKeyService, keybindingService, clipboardServce, configurationService, accessibilityService, contextMenuService, instantiationService, editorService) {
    super();
    this.contextViewService = contextViewService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this.clipboardServce = clipboardServce;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.ignoreGlobalFindBufferOnNextFocus = false;
    this.previousGlobalFindBufferValue = null;
    /**
     * Tracks whether the accessibility help hint has been announced in the ARIA label.
     * Reset when the widget loses focus, allowing the hint to be announced again
     * on the next focus.
     */
    this._accessibilityHelpHintAnnounced = false;
    this._onSearchSubmit = this._register(new Emitter());
    this.onSearchSubmit = this._onSearchSubmit.event;
    this._onSearchCancel = this._register(new Emitter());
    this.onSearchCancel = this._onSearchCancel.event;
    this._onReplaceToggled = this._register(new Emitter());
    this.onReplaceToggled = this._onReplaceToggled.event;
    this._onReplaceStateChange = this._register(new Emitter());
    this.onReplaceStateChange = this._onReplaceStateChange.event;
    this._onPreserveCaseChange = this._register(new Emitter());
    this.onPreserveCaseChange = this._onPreserveCaseChange.event;
    this._onReplaceValueChanged = this._register(new Emitter());
    this.onReplaceValueChanged = this._onReplaceValueChanged.event;
    this._onReplaceAll = this._register(new Emitter());
    this.onReplaceAll = this._onReplaceAll.event;
    this._onBlur = this._register(new Emitter());
    this.onBlur = this._onBlur.event;
    this._onDidHeightChange = this._register(new Emitter());
    this.onDidHeightChange = this._onDidHeightChange.event;
    this._onDidToggleContext = this._register(new Emitter());
    this.onDidToggleContext = this._onDidToggleContext.event;
    this.replaceActive = Constants.SearchContext.ReplaceActiveKey.bindTo(this.contextKeyService);
    this.searchInputBoxFocused = Constants.SearchContext.SearchInputBoxFocusedKey.bindTo(this.contextKeyService);
    this.replaceInputBoxFocused = Constants.SearchContext.ReplaceInputBoxFocusedKey.bindTo(this.contextKeyService);
    const notebookOptions = options.notebookOptions ?? {
      isInNotebookMarkdownInput: true,
      isInNotebookMarkdownPreview: true,
      isInNotebookCellInput: true,
      isInNotebookCellOutput: true
    };
    this._notebookFilters = this._register(
      new NotebookFindFilters(
        notebookOptions.isInNotebookMarkdownInput,
        notebookOptions.isInNotebookMarkdownPreview,
        notebookOptions.isInNotebookCellInput,
        notebookOptions.isInNotebookCellOutput,
        { findScopeType: NotebookFindScopeType.None }
      )
    );
    this._register(
      this._notebookFilters.onDidChange(() => {
        if (this.searchInput) {
          this.searchInput.updateFilterStyles();
        }
      })
    );
    this._register(this.editorService.onDidEditorsChange((e) => {
      if (this.searchInput && e.event.editor instanceof NotebookEditorInput && (e.event.kind === GroupModelChangeKind.EDITOR_OPEN || e.event.kind === GroupModelChangeKind.EDITOR_CLOSE)) {
        this.searchInput.filterVisible = this._hasNotebookOpen();
      }
    }));
    this._replaceHistoryDelayer = new Delayer(500);
    this._toggleReplaceButtonListener = this._register(new MutableDisposable());
    this.render(container, options);
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.accessibilitySupport")) {
        this.updateAccessibilitySupport();
      }
    }));
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this.updateAccessibilitySupport()));
    this.updateAccessibilitySupport();
  }
  static {
    this.INPUT_MAX_HEIGHT = 134;
  }
  static {
    this.REPLACE_ALL_DISABLED_LABEL = nls.localize("search.action.replaceAll.disabled.label", "Replace All (Submit Search to Enable)");
  }
  static {
    this.REPLACE_ALL_ENABLED_LABEL = (keyBindingService2) => {
      return keyBindingService2.appendKeybinding(nls.localize("search.action.replaceAll.enabled.label", "Replace All"), ReplaceAllAction.ID);
    };
  }
  _hasNotebookOpen() {
    const editors = this.editorService.editors;
    return editors.some((editor) => editor instanceof NotebookEditorInput);
  }
  getNotebookFilters() {
    return this._notebookFilters;
  }
  focus(select = true, focusReplace = false, suppressGlobalSearchBuffer = false) {
    this.ignoreGlobalFindBufferOnNextFocus = suppressGlobalSearchBuffer;
    if (focusReplace && this.isReplaceShown()) {
      if (this.replaceInput) {
        this._updateSearchInputAriaLabel(false);
        this.replaceInput.focus();
        if (select) {
          this.replaceInput.select();
        }
      }
    } else {
      if (this.searchInput) {
        this._updateSearchInputAriaLabel(true);
        this.searchInput.focus();
        if (select) {
          this.searchInput.select();
        }
      }
    }
  }
  /**
   * Updates the ARIA label of the search input box.
   * When a screen reader is active and the accessibility verbosity setting is enabled,
   * includes a hint about pressing Alt+F1 for accessibility help on first focus.
   * The hint is only announced once per focus cycle to prevent double-speak.
   * @param includeHint Whether to include the accessibility help hint in the label
   */
  _updateSearchInputAriaLabel(includeHint) {
    if (!this.searchInput) {
      return;
    }
    let searchLabel = nls.localize("label.Search", "Search: Type Search Term and press Enter to search");
    if (includeHint && !this._accessibilityHelpHintAnnounced && this.configurationService.getValue("accessibility.verbosity.find") && this.accessibilityService.isScreenReaderOptimized()) {
      const keybinding = this.keybindingService.lookupKeybinding("editor.action.accessibilityHelp")?.getAriaLabel();
      if (keybinding) {
        searchLabel += ", " + nls.localize("accessibilityHelpHintInLabel", "Press {0} for accessibility help", keybinding);
        this._accessibilityHelpHintAnnounced = true;
        this._labelResetTimeout?.dispose();
        this._labelResetTimeout = disposableTimeout(() => {
          if (this.searchInput) {
            this.searchInput.inputBox.setAriaLabel(nls.localize("label.Search", "Search: Type Search Term and press Enter to search"));
          }
        }, 1e3);
      }
    }
    this.searchInput.inputBox.setAriaLabel(searchLabel);
  }
  setWidth(width) {
    this.searchInput?.inputBox.layout();
    if (this.replaceInput) {
      this.replaceInput.width = width - 28;
      this.replaceInput.inputBox.layout();
    }
  }
  clear() {
    this.searchInput?.clear();
    this.replaceInput?.setValue("");
    this.setReplaceAllActionState(false);
  }
  isReplaceShown() {
    return this.replaceContainer ? !this.replaceContainer.classList.contains("disabled") : false;
  }
  isReplaceActive() {
    return !!this.replaceActive.get();
  }
  getReplaceValue() {
    return this.replaceInput?.getValue() ?? "";
  }
  toggleReplace(show) {
    if (show === void 0 || show !== this.isReplaceShown()) {
      this.onToggleReplaceButton();
    }
  }
  getSearchHistory() {
    return this.searchInput?.inputBox.getHistory() ?? [];
  }
  getReplaceHistory() {
    return this.replaceInput?.inputBox.getHistory() ?? [];
  }
  prependSearchHistory(history) {
    this.searchInput?.inputBox.prependHistory(history);
  }
  prependReplaceHistory(history) {
    this.replaceInput?.inputBox.prependHistory(history);
  }
  clearHistory() {
    this.searchInput?.inputBox.clearHistory();
    this.replaceInput?.inputBox.clearHistory();
  }
  showNextSearchTerm() {
    this.searchInput?.inputBox.showNextValue();
  }
  showPreviousSearchTerm() {
    this.searchInput?.inputBox.showPreviousValue();
  }
  showNextReplaceTerm() {
    this.replaceInput?.inputBox.showNextValue();
  }
  showPreviousReplaceTerm() {
    this.replaceInput?.inputBox.showPreviousValue();
  }
  searchInputHasFocus() {
    return !!this.searchInputBoxFocused.get();
  }
  replaceInputHasFocus() {
    return !!this.replaceInput?.inputBox.hasFocus();
  }
  focusReplaceAllAction() {
    this.replaceActionBar?.focus(true);
  }
  focusRegexAction() {
    this.searchInput?.focusOnRegex();
  }
  set replaceButtonVisibility(val) {
    if (this.toggleReplaceButton) {
      this.toggleReplaceButton.element.style.display = val ? "" : "none";
    }
  }
  render(container, options) {
    this.domNode = dom.append(container, dom.$(".search-widget"));
    this.domNode.style.position = "relative";
    if (!options._hideReplaceToggle) {
      this.renderToggleReplaceButton(this.domNode);
    }
    this.renderSearchInput(this.domNode, options);
    this.renderReplaceInput(this.domNode, options);
  }
  updateAccessibilitySupport() {
    this.searchInput?.setFocusInputOnOptionClick(!this.accessibilityService.isScreenReaderOptimized());
  }
  renderToggleReplaceButton(parent) {
    const opts = {
      buttonBackground: void 0,
      buttonBorder: void 0,
      buttonForeground: void 0,
      buttonHoverBackground: void 0,
      buttonSecondaryBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryHoverBackground: void 0,
      buttonSeparator: void 0,
      title: nls.localize("search.replace.toggle.button.title", "Toggle Replace"),
      hoverDelegate: getDefaultHoverDelegate("element")
    };
    this.toggleReplaceButton = this._register(new Button(parent, opts));
    this.toggleReplaceButton.element.setAttribute("aria-expanded", "false");
    this.toggleReplaceButton.element.classList.add("toggle-replace-button");
    this.toggleReplaceButton.icon = searchHideReplaceIcon;
    this._toggleReplaceButtonListener.value = this.toggleReplaceButton.onDidClick(() => this.onToggleReplaceButton());
  }
  renderSearchInput(parent, options) {
    const history = options.searchHistory || [];
    const inputOptions = {
      label: nls.localize("label.Search", "Search: Type Search Term and press Enter to search"),
      validation: (value) => this.validateSearchInput(value),
      placeholder: nls.localize("search.placeHolder", "Search"),
      appendCaseSensitiveLabel: this.keybindingService.appendKeybinding("", Constants.SearchCommandIds.ToggleCaseSensitiveCommandId),
      appendWholeWordsLabel: this.keybindingService.appendKeybinding("", Constants.SearchCommandIds.ToggleWholeWordCommandId),
      appendRegexLabel: this.keybindingService.appendKeybinding("", Constants.SearchCommandIds.ToggleRegexCommandId),
      history: new Set(history),
      showHistoryHint: () => showHistoryKeybindingHint(this.keybindingService),
      flexibleHeight: true,
      flexibleMaxHeight: SearchWidget.INPUT_MAX_HEIGHT,
      showCommonFindToggles: true,
      inputBoxStyles: options.inputBoxStyles,
      toggleStyles: options.toggleStyles,
      hoverLifecycleOptions
    };
    const searchInputContainer = dom.append(parent, dom.$(".search-container.input-box"));
    this.searchInput = this._register(
      new SearchFindInput(
        searchInputContainer,
        this.contextViewService,
        inputOptions,
        this.contextKeyService,
        this.contextMenuService,
        this.instantiationService,
        this._notebookFilters,
        this._hasNotebookOpen()
      )
    );
    this._register(this.searchInput.onKeyDown((keyboardEvent) => this.onSearchInputKeyDown(keyboardEvent)));
    this.searchInput.setValue(options.value || "");
    this.searchInput.setRegex(!!options.isRegex);
    this.searchInput.setCaseSensitive(!!options.isCaseSensitive);
    this.searchInput.setWholeWords(!!options.isWholeWords);
    this._register(this.searchInput.onCaseSensitiveKeyDown((keyboardEvent) => this.onCaseSensitiveKeyDown(keyboardEvent)));
    this._register(this.searchInput.onRegexKeyDown((keyboardEvent) => this.onRegexKeyDown(keyboardEvent)));
    this._register(this.searchInput.inputBox.onDidChange(() => this.onSearchInputChanged()));
    this._register(this.searchInput.inputBox.onDidHeightChange(() => this._onDidHeightChange.fire()));
    this._register(this.onReplaceValueChanged(() => {
      this._replaceHistoryDelayer.trigger(() => this.replaceInput?.inputBox.addToHistory());
    }));
    this.searchInputFocusTracker = this._register(dom.trackFocus(this.searchInput.inputBox.inputElement));
    this._register(this.searchInputFocusTracker.onDidFocus(async () => {
      this.searchInputBoxFocused.set(true);
      const useGlobalFindBuffer = this.searchConfiguration.globalFindClipboard;
      if (!this.ignoreGlobalFindBufferOnNextFocus && useGlobalFindBuffer) {
        const globalBufferText = await this.clipboardServce.readFindText();
        if (globalBufferText && this.previousGlobalFindBufferValue !== globalBufferText) {
          this.searchInput?.inputBox.addToHistory();
          this.searchInput?.setValue(globalBufferText);
          this.searchInput?.select();
        }
        this.previousGlobalFindBufferValue = globalBufferText;
      }
      this.ignoreGlobalFindBufferOnNextFocus = false;
    }));
    this._register(this.searchInputFocusTracker.onDidBlur(() => this.searchInputBoxFocused.set(false)));
    this.showContextToggle = new Toggle({
      isChecked: false,
      title: this.keybindingService.appendKeybinding(nls.localize("showContext", "Toggle Context Lines"), ToggleSearchEditorContextLinesCommandId),
      icon: searchShowContextIcon,
      hoverLifecycleOptions,
      ...defaultToggleStyles
    });
    this._register(this.showContextToggle.onChange(() => this.onContextLinesChanged()));
    if (options.showContextToggle) {
      this.contextLinesInput = new InputBox(searchInputContainer, this.contextViewService, { type: "number", inputBoxStyles: defaultInputBoxStyles });
      this.contextLinesInput.element.classList.add("context-lines-input");
      this.contextLinesInput.value = "" + (this.configurationService.getValue("search").searchEditor.defaultNumberOfContextLines ?? 1);
      this._register(this.contextLinesInput.onDidChange((value) => {
        if (value !== "0") {
          this.showContextToggle.checked = true;
        }
        this.onContextLinesChanged();
      }));
      dom.append(searchInputContainer, this.showContextToggle.domNode);
    }
  }
  onContextLinesChanged() {
    this._onDidToggleContext.fire();
    if (this.contextLinesInput.value.includes("-")) {
      this.contextLinesInput.value = "0";
    }
    this._onDidToggleContext.fire();
  }
  setContextLines(lines) {
    if (!this.contextLinesInput) {
      return;
    }
    if (lines === 0) {
      this.showContextToggle.checked = false;
    } else {
      this.showContextToggle.checked = true;
      this.contextLinesInput.value = "" + lines;
    }
  }
  renderReplaceInput(parent, options) {
    this.replaceContainer = dom.append(parent, dom.$(".replace-container.disabled"));
    const replaceBox = dom.append(this.replaceContainer, dom.$(".replace-input"));
    this.replaceInput = this._register(new ContextScopedReplaceInput(replaceBox, this.contextViewService, {
      label: nls.localize("label.Replace", "Replace: Type replace term and press Enter to preview"),
      placeholder: nls.localize("search.replace.placeHolder", "Replace"),
      appendPreserveCaseLabel: this.keybindingService.appendKeybinding("", Constants.SearchCommandIds.TogglePreserveCaseId),
      history: new Set(options.replaceHistory),
      showHistoryHint: () => showHistoryKeybindingHint(this.keybindingService),
      flexibleHeight: true,
      flexibleMaxHeight: SearchWidget.INPUT_MAX_HEIGHT,
      inputBoxStyles: options.inputBoxStyles,
      toggleStyles: options.toggleStyles,
      hoverLifecycleOptions
    }, this.contextKeyService, true));
    this._register(this.replaceInput.onDidOptionChange((viaKeyboard) => {
      if (!viaKeyboard) {
        if (this.replaceInput) {
          this._onPreserveCaseChange.fire(this.replaceInput.getPreserveCase());
        }
      }
    }));
    this._register(this.replaceInput.onKeyDown((keyboardEvent) => this.onReplaceInputKeyDown(keyboardEvent)));
    this.replaceInput.setValue(options.replaceValue || "");
    this._register(this.replaceInput.inputBox.onDidChange(() => this._onReplaceValueChanged.fire()));
    this._register(this.replaceInput.inputBox.onDidHeightChange(() => this._onDidHeightChange.fire()));
    this.replaceAllAction = new ReplaceAllAction(this);
    this.replaceAllAction.label = SearchWidget.REPLACE_ALL_DISABLED_LABEL;
    this.replaceActionBar = this._register(new ActionBar(this.replaceContainer));
    this.replaceActionBar.push([this.replaceAllAction], { icon: true, label: false });
    this.onkeydown(this.replaceActionBar.domNode, (keyboardEvent) => this.onReplaceActionbarKeyDown(keyboardEvent));
    this.replaceInputFocusTracker = this._register(dom.trackFocus(this.replaceInput.inputBox.inputElement));
    this._register(this.replaceInputFocusTracker.onDidFocus(() => this.replaceInputBoxFocused.set(true)));
    this._register(this.replaceInputFocusTracker.onDidBlur(() => this.replaceInputBoxFocused.set(false)));
    this._register(this.replaceInput.onPreserveCaseKeyDown((keyboardEvent) => this.onPreserveCaseKeyDown(keyboardEvent)));
  }
  triggerReplaceAll() {
    this._onReplaceAll.fire();
    return Promise.resolve();
  }
  onToggleReplaceButton() {
    this.replaceContainer?.classList.toggle("disabled");
    if (this.isReplaceShown()) {
      this.toggleReplaceButton?.element.classList.remove(...ThemeIcon.asClassNameArray(searchHideReplaceIcon));
      this.toggleReplaceButton?.element.classList.add(...ThemeIcon.asClassNameArray(searchShowReplaceIcon));
    } else {
      this.toggleReplaceButton?.element.classList.remove(...ThemeIcon.asClassNameArray(searchShowReplaceIcon));
      this.toggleReplaceButton?.element.classList.add(...ThemeIcon.asClassNameArray(searchHideReplaceIcon));
    }
    this.toggleReplaceButton?.element.setAttribute("aria-expanded", this.isReplaceShown() ? "true" : "false");
    this.updateReplaceActiveState();
    this._onReplaceToggled.fire();
  }
  setValue(value) {
    this.searchInput?.setValue(value);
  }
  setReplaceAllActionState(enabled) {
    if (this.replaceAllAction && this.replaceAllAction.enabled !== enabled) {
      this.replaceAllAction.enabled = enabled;
      this.replaceAllAction.label = enabled ? SearchWidget.REPLACE_ALL_ENABLED_LABEL(this.keybindingService) : SearchWidget.REPLACE_ALL_DISABLED_LABEL;
      this.updateReplaceActiveState();
    }
  }
  updateReplaceActiveState() {
    const currentState = this.isReplaceActive();
    const newState = this.isReplaceShown() && !!this.replaceAllAction?.enabled;
    if (currentState !== newState) {
      this.replaceActive.set(newState);
      this._onReplaceStateChange.fire(newState);
      this.replaceInput?.inputBox.layout();
    }
  }
  validateSearchInput(value) {
    if (value.length === 0) {
      return null;
    }
    if (!this.searchInput?.getRegex()) {
      return null;
    }
    try {
      new RegExp(value, "u");
    } catch (e) {
      return { content: e.message };
    }
    return null;
  }
  onSearchInputChanged() {
    this.searchInput?.clearMessage();
    this.setReplaceAllActionState(false);
    if (this.searchConfiguration.searchOnType) {
      if (this.searchInput?.getRegex()) {
        try {
          const regex = new RegExp(this.searchInput.getValue(), "ug");
          const matchienessHeuristic = `
								~!@#$%^&*()_+
								\`1234567890-=
								qwertyuiop[]\\
								QWERTYUIOP{}|
								asdfghjkl;'
								ASDFGHJKL:"
								zxcvbnm,./
								ZXCVBNM<>? `.match(regex)?.length ?? 0;
          const delayMultiplier = matchienessHeuristic < 50 ? 1 : matchienessHeuristic < 100 ? 5 : (
            // expressions like `.` or `\w`
            10
          );
          this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier);
        } catch {
        }
      } else {
        this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod);
      }
    }
  }
  onSearchInputKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(ctrlKeyMod | KeyCode.Enter)) {
      this.searchInput?.inputBox.insertAtCursor("\n");
      keyboardEvent.preventDefault();
    }
    if (keyboardEvent.equals(KeyCode.Enter)) {
      this.searchInput?.onSearchSubmit();
      this.submitSearch();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.Escape)) {
      this._onSearchCancel.fire({ focus: true });
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.Tab)) {
      if (this.isReplaceShown()) {
        this.replaceInput?.focus();
      } else {
        this.searchInput?.focusOnCaseSensitive();
      }
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.UpArrow)) {
      stopPropagationForMultiLineUpwards(keyboardEvent, this.searchInput?.getValue() ?? "", this.searchInput?.domNode.querySelector("textarea") ?? null);
    } else if (keyboardEvent.equals(KeyCode.DownArrow)) {
      stopPropagationForMultiLineDownwards(keyboardEvent, this.searchInput?.getValue() ?? "", this.searchInput?.domNode.querySelector("textarea") ?? null);
    } else if (keyboardEvent.equals(KeyCode.PageUp)) {
      const inputElement = this.searchInput?.inputBox.inputElement;
      if (inputElement) {
        inputElement.setSelectionRange(0, 0);
        inputElement.focus();
        keyboardEvent.preventDefault();
      }
    } else if (keyboardEvent.equals(KeyCode.PageDown)) {
      const inputElement = this.searchInput?.inputBox.inputElement;
      if (inputElement) {
        const endOfText = inputElement.value.length;
        inputElement.setSelectionRange(endOfText, endOfText);
        inputElement.focus();
        keyboardEvent.preventDefault();
      }
    }
  }
  onCaseSensitiveKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      if (this.isReplaceShown()) {
        this.replaceInput?.focus();
        keyboardEvent.preventDefault();
      }
    }
  }
  onRegexKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyCode.Tab)) {
      if (this.isReplaceShown()) {
        this.replaceInput?.focusOnPreserve();
        keyboardEvent.preventDefault();
      }
    }
  }
  onPreserveCaseKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyCode.Tab)) {
      if (this.isReplaceActive()) {
        this.focusReplaceAllAction();
      } else {
        this._onBlur.fire();
      }
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      this.focusRegexAction();
      keyboardEvent.preventDefault();
    }
  }
  onReplaceInputKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(ctrlKeyMod | KeyCode.Enter)) {
      this.replaceInput?.inputBox.insertAtCursor("\n");
      keyboardEvent.preventDefault();
    }
    if (keyboardEvent.equals(KeyCode.Enter)) {
      this.submitSearch();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.Tab)) {
      this.searchInput?.focusOnCaseSensitive();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      this.searchInput?.focus();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.UpArrow)) {
      stopPropagationForMultiLineUpwards(keyboardEvent, this.replaceInput?.getValue() ?? "", this.replaceInput?.domNode.querySelector("textarea") ?? null);
    } else if (keyboardEvent.equals(KeyCode.DownArrow)) {
      stopPropagationForMultiLineDownwards(keyboardEvent, this.replaceInput?.getValue() ?? "", this.replaceInput?.domNode.querySelector("textarea") ?? null);
    }
  }
  onReplaceActionbarKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      this.focusRegexAction();
      keyboardEvent.preventDefault();
    }
  }
  async submitSearch(triggeredOnType = false, delay = 0) {
    this.searchInput?.validate();
    if (!this.searchInput?.inputBox.isInputValid()) {
      return;
    }
    const value = this.searchInput.getValue();
    const useGlobalFindBuffer = this.searchConfiguration.globalFindClipboard;
    if (value && useGlobalFindBuffer) {
      await this.clipboardServce.writeFindText(value);
    }
    this._onSearchSubmit.fire({ triggeredOnType, delay });
  }
  getContextLines() {
    return this.showContextToggle.checked ? +this.contextLinesInput.value : 0;
  }
  modifyContextLines(increase) {
    const current = +this.contextLinesInput.value;
    const modified = current + (increase ? 1 : -1);
    this.showContextToggle.checked = modified !== 0;
    this.contextLinesInput.value = "" + modified;
  }
  toggleContextLines() {
    this.showContextToggle.checked = !this.showContextToggle.checked;
    this.onContextLinesChanged();
  }
  dispose() {
    this.setReplaceAllActionState(false);
    super.dispose();
  }
  get searchConfiguration() {
    return this.configurationService.getValue("search");
  }
};
SearchWidget = __decorateClass([
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IClipboardService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IAccessibilityService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IEditorService)
], SearchWidget);
function registerContributions() {
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: ReplaceAllAction.ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ReplaceActiveKey, CONTEXT_FIND_WIDGET_NOT_VISIBLE),
    primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.Enter,
    handler: (accessor) => {
      const viewsService = accessor.get(IViewsService);
      if (isSearchViewFocused(viewsService)) {
        const searchView = getSearchView(viewsService);
        if (searchView) {
          new ReplaceAllAction(searchView.searchAndReplaceWidget).run();
        }
      }
    }
  });
}
export {
  SearchWidget,
  registerContributions
};
