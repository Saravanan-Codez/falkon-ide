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
import { $, append } from "../../../../../base/browser/dom.js";
import { DEFAULT_FONT_FAMILY } from "../../../../../base/browser/fonts.js";
import { Widget } from "../../../../../base/browser/ui/widget.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { HistoryNavigator } from "../../../../../base/common/history.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { mixin } from "../../../../../base/common/objects.js";
import { isMacintosh } from "../../../../../base/common/platform.js";
import { URI as uri } from "../../../../../base/common/uri.js";
import "./suggestEnabledInput.css";
import { EditorExtensionsRegistry } from "../../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ensureValidWordDefinition, getWordAtText } from "../../../../../editor/common/core/wordHelper.js";
import * as languages from "../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ContextMenuController } from "../../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import { SnippetController2 } from "../../../../../editor/contrib/snippet/browser/snippetController2.js";
import { SuggestController } from "../../../../../editor/contrib/suggest/browser/suggestController.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { registerAndCreateHistoryNavigationContext } from "../../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { asCssVariable, asCssVariableWithDefault, inputBackground, inputBorder, inputForeground, inputPlaceholderForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { MenuPreventer } from "../menuPreventer.js";
import { SelectionClipboardContributionID } from "../selectionClipboard.js";
import { getSimpleEditorOptions, setupSimpleEditorSelectionStyling } from "../simpleEditorOptions.js";
let SuggestEnabledInput = class extends Widget {
  constructor(id, parent, suggestionProvider, ariaLabel, resourceHandle, options, defaultInstantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
    super();
    this._onShouldFocusResults = this._register(new Emitter());
    this.onShouldFocusResults = this._onShouldFocusResults.event;
    this._onInputDidChange = this._register(new Emitter());
    this.onInputDidChange = this._onInputDidChange.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this.stylingContainer = append(parent, $(".suggest-input-container"));
    this.element = parent;
    this.placeholderText = append(this.stylingContainer, $(".suggest-input-placeholder", void 0, options.placeholderText || ""));
    const editorOptions = mixin(
      getSimpleEditorOptions(configurationService),
      getSuggestEnabledInputOptions(ariaLabel)
    );
    editorOptions.overflowWidgetsDomNode = options.overflowWidgetsDomNode;
    const scopedContextKeyService = this.getScopedContextKeyService(contextKeyService);
    const instantiationService = scopedContextKeyService ? this._register(defaultInstantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService]))) : defaultInstantiationService;
    this.inputWidget = this._register(instantiationService.createInstance(
      CodeEditorWidget,
      this.stylingContainer,
      editorOptions,
      {
        contributions: EditorExtensionsRegistry.getSomeEditorContributions([
          SuggestController.ID,
          SnippetController2.ID,
          ContextMenuController.ID,
          MenuPreventer.ID,
          SelectionClipboardContributionID
        ]),
        isSimpleWidget: true
      }
    ));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.accessibilitySupport") || e.affectsConfiguration("editor.cursorBlinking")) {
        const accessibilitySupport = configurationService.getValue("editor.accessibilitySupport");
        const cursorBlinking = configurationService.getValue("editor.cursorBlinking");
        this.inputWidget.updateOptions({
          accessibilitySupport,
          cursorBlinking
        });
      }
    }));
    this._register(this.inputWidget.onDidFocusEditorText(() => this._onDidFocus.fire()));
    this._register(this.inputWidget.onDidBlurEditorText(() => this._onDidBlur.fire()));
    const scopeHandle = uri.parse(resourceHandle);
    this.inputModel = modelService.createModel("", null, scopeHandle, true);
    this._register(this.inputModel);
    this.inputWidget.setModel(this.inputModel);
    this._register(this.inputWidget.onDidPaste(() => this.setValue(this.getValue())));
    this._register(this.inputWidget.onDidFocusEditorText(() => {
      if (options.focusContextKey) {
        options.focusContextKey.set(true);
      }
      this.stylingContainer.classList.add("synthetic-focus");
    }));
    this._register(this.inputWidget.onDidBlurEditorText(() => {
      if (options.focusContextKey) {
        options.focusContextKey.set(false);
      }
      this.stylingContainer.classList.remove("synthetic-focus");
    }));
    this._register(Event.chain(this.inputWidget.onKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.Enter))((e) => {
      e.preventDefault();
    }, this));
    this._register(Event.chain(this.inputWidget.onKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.DownArrow && (isMacintosh ? e.metaKey : e.ctrlKey)))(() => this._onShouldFocusResults.fire(), this));
    let preexistingContent = this.getValue();
    const inputWidgetModel = this.inputWidget.getModel();
    if (inputWidgetModel) {
      this._register(inputWidgetModel.onDidChangeContent(() => {
        const content = this.getValue();
        this.placeholderText.style.visibility = content ? "hidden" : "visible";
        if (preexistingContent.trim() === content.trim()) {
          return;
        }
        this._onInputDidChange.fire(void 0);
        preexistingContent = content;
      }));
    }
    const validatedSuggestProvider = {
      provideResults: suggestionProvider.provideResults,
      sortKey: suggestionProvider.sortKey || ((a) => a),
      triggerCharacters: suggestionProvider.triggerCharacters || [],
      wordDefinition: suggestionProvider.wordDefinition ? ensureValidWordDefinition(suggestionProvider.wordDefinition) : void 0,
      alwaysShowSuggestions: !!suggestionProvider.alwaysShowSuggestions
    };
    this.setValue(options.value || "");
    this._register(languageFeaturesService.completionProvider.register({ scheme: scopeHandle.scheme, pattern: "**/" + scopeHandle.path, hasAccessToAllModels: true }, {
      _debugDisplayName: `suggestEnabledInput/${id}`,
      triggerCharacters: validatedSuggestProvider.triggerCharacters,
      provideCompletionItems: (model, position, _context) => {
        const query = model.getValue();
        const zeroIndexedColumn = position.column - 1;
        let alreadyTypedCount = 0, zeroIndexedWordStart = 0;
        if (validatedSuggestProvider.wordDefinition) {
          const wordAtText = getWordAtText(position.column, validatedSuggestProvider.wordDefinition, query, 0);
          alreadyTypedCount = wordAtText?.word.length ?? 0;
          zeroIndexedWordStart = wordAtText ? wordAtText.startColumn - 1 : 0;
        } else {
          zeroIndexedWordStart = query.lastIndexOf(" ", zeroIndexedColumn - 1) + 1;
          alreadyTypedCount = zeroIndexedColumn - zeroIndexedWordStart;
        }
        if (!validatedSuggestProvider.alwaysShowSuggestions && alreadyTypedCount > 0 && validatedSuggestProvider.triggerCharacters?.indexOf(query[zeroIndexedWordStart]) === -1) {
          return { suggestions: [] };
        }
        return {
          suggestions: suggestionProvider.provideResults(query).map((result) => {
            let label;
            let rest;
            if (typeof result === "string") {
              label = result;
            } else {
              label = result.label;
              rest = result;
            }
            return {
              label,
              insertText: label,
              range: Range.fromPositions(position.delta(0, -alreadyTypedCount), position),
              sortText: validatedSuggestProvider.sortKey(label),
              kind: languages.CompletionItemKind.Keyword,
              ...rest
            };
          })
        };
      }
    }));
    this.style(options.styleOverrides || {});
  }
  getScopedContextKeyService(_contextKeyService) {
    return void 0;
  }
  updateAriaLabel(label) {
    this.inputWidget.updateOptions({ ariaLabel: label });
  }
  setPlaceHolder(placeholder) {
    this.placeholderText.textContent = placeholder;
  }
  setValue(val) {
    val = val.replace(/\s/g, " ");
    const fullRange = this.inputModel.getFullModelRange();
    this.inputWidget.executeEdits("suggestEnabledInput.setValue", [EditOperation.replace(fullRange, val)]);
    this.inputWidget.setScrollTop(0);
    this.inputWidget.setPosition(new Position(1, val.length + 1));
  }
  getValue() {
    return this.inputWidget.getValue();
  }
  style(styleOverrides) {
    this.stylingContainer.style.backgroundColor = asCssVariable(styleOverrides.inputBackground ?? inputBackground);
    this.stylingContainer.style.color = asCssVariable(styleOverrides.inputForeground ?? inputForeground);
    this.placeholderText.style.color = asCssVariable(styleOverrides.inputPlaceholderForeground ?? inputPlaceholderForeground);
    this.stylingContainer.style.borderWidth = "1px";
    this.stylingContainer.style.borderStyle = "solid";
    this.stylingContainer.style.borderColor = asCssVariableWithDefault(styleOverrides.inputBorder ?? inputBorder, "transparent");
    const cursor = this.stylingContainer.getElementsByClassName("cursor")[0];
    if (cursor) {
      cursor.style.backgroundColor = asCssVariable(styleOverrides.inputForeground ?? inputForeground);
    }
  }
  focus(selectAll) {
    this.inputWidget.focus();
    if (selectAll && this.inputWidget.getValue()) {
      this.selectAll();
    }
  }
  onHide() {
    this.inputWidget.onHide();
  }
  layout(dimension) {
    this.inputWidget.layout(dimension);
    this.placeholderText.style.width = `${dimension.width - 2}px`;
  }
  selectAll() {
    this.inputWidget.setSelection(new Range(1, 1, 1, this.getValue().length + 1));
  }
};
SuggestEnabledInput = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IModelService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, ILanguageFeaturesService),
  __decorateParam(10, IConfigurationService)
], SuggestEnabledInput);
let SuggestEnabledInputWithHistory = class extends SuggestEnabledInput {
  constructor({ id, parent, ariaLabel, suggestionProvider, resourceHandle, suggestOptions, history }, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
    super(id, parent, suggestionProvider, ariaLabel, resourceHandle, suggestOptions, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService);
    this.history = this._register(new HistoryNavigator(new Set(history), 100));
  }
  addToHistory() {
    const value = this.getValue();
    if (value && value !== this.getCurrentValue()) {
      this.history.add(value);
    }
  }
  getHistory() {
    return this.history.getHistory();
  }
  /**
   * Whether the input is currently showing a value from the history (as opposed to a freshly
   * typed query). While navigating, {@link showNextValue} advances toward more recent entries and,
   * once past the most recent one, clears the input back to an empty value.
   */
  isNavigatingHistory() {
    return !this.history.isNowhere();
  }
  showNextValue() {
    if (!this.history.has(this.getValue())) {
      this.addToHistory();
    }
    let next = this.getNextValue();
    if (next) {
      next = next === this.getValue() ? this.getNextValue() : next;
    }
    this.setValue(next ?? "");
  }
  showPreviousValue() {
    if (!this.history.has(this.getValue())) {
      this.addToHistory();
    }
    let previous = this.getPreviousValue();
    if (previous) {
      previous = previous === this.getValue() ? this.getPreviousValue() : previous;
    }
    if (previous) {
      this.setValue(previous);
      this.inputWidget.setPosition({ lineNumber: 0, column: 0 });
    }
  }
  clearHistory() {
    this.history.clear();
  }
  getCurrentValue() {
    let currentValue = this.history.current();
    if (!currentValue) {
      currentValue = this.history.last();
      this.history.next();
    }
    return currentValue;
  }
  getPreviousValue() {
    return this.history.previous() || this.history.first();
  }
  getNextValue() {
    return this.history.next();
  }
};
SuggestEnabledInputWithHistory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IConfigurationService)
], SuggestEnabledInputWithHistory);
let ContextScopedSuggestEnabledInputWithHistory = class extends SuggestEnabledInputWithHistory {
  constructor(options, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
    super(options, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService);
    const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this.historyContext;
    this._register(this.inputWidget.onDidChangeCursorPosition(({ position }) => {
      const viewModel = this.inputWidget._getViewModel();
      const lastLineNumber = viewModel.getLineCount();
      const lastLineCol = viewModel.getLineLength(lastLineNumber) + 1;
      const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(position);
      historyNavigationBackwardsEnablement.set(viewPosition.lineNumber === 1 && viewPosition.column === 1);
      historyNavigationForwardsEnablement.set(viewPosition.lineNumber === lastLineNumber && viewPosition.column === lastLineCol);
    }));
  }
  getScopedContextKeyService(contextKeyService) {
    const scopedContextKeyService = this._register(contextKeyService.createScoped(this.element));
    this.historyContext = this._register(registerAndCreateHistoryNavigationContext(
      scopedContextKeyService,
      this
    ));
    return scopedContextKeyService;
  }
};
ContextScopedSuggestEnabledInputWithHistory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IConfigurationService)
], ContextScopedSuggestEnabledInputWithHistory);
setupSimpleEditorSelectionStyling(".suggest-input-container");
function getSuggestEnabledInputOptions(ariaLabel) {
  return {
    fontSize: 13,
    lineHeight: 20,
    wordWrap: "off",
    scrollbar: { vertical: "hidden" },
    roundedSelection: false,
    guides: {
      indentation: false
    },
    cursorWidth: 1,
    fontFamily: DEFAULT_FONT_FAMILY,
    ariaLabel: ariaLabel || "",
    snippetSuggestions: "none",
    suggest: { filterGraceful: false, showIcons: false },
    autoClosingBrackets: "never"
  };
}
export {
  ContextScopedSuggestEnabledInputWithHistory,
  SuggestEnabledInput,
  SuggestEnabledInputWithHistory
};
