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
import * as dom from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import * as lifecycle from "../../../../base/common/lifecycle.js";
import { URI as uri } from "../../../../base/common/uri.js";
import { EditorCommand, registerEditorCommand } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { CompletionOptions, provideSuggestionItems } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { ZoneWidget } from "../../../../editor/contrib/zoneWidget/browser/zoneWidget.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService, createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { defaultButtonStyles, defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { editorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { hasNativeContextMenu } from "../../../../platform/window/common/window.js";
import { getSimpleCodeEditorWidgetOptions, getSimpleEditorOptions } from "../../codeEditor/browser/simpleEditorOptions.js";
import { BREAKPOINT_EDITOR_CONTRIBUTION_ID, CONTEXT_BREAKPOINT_WIDGET_VISIBLE, CONTEXT_IN_BREAKPOINT_WIDGET, BreakpointWidgetContext as Context, DEBUG_SCHEME, IDebugService } from "../common/debug.js";
import "./media/breakpointWidget.css";
const $ = dom.$;
const IPrivateBreakpointWidgetService = createDecorator("privateBreakpointWidgetService");
const DECORATION_KEY = "breakpointwidgetdecoration";
function isPositionInCurlyBracketBlock(input) {
  const model = input.getModel();
  const bracketPairs = model.bracketPairs.getBracketPairsInRange(Range.fromPositions(input.getPosition()));
  return bracketPairs.some((p) => p.openingBracketInfo.bracketText === "{");
}
function createDecorations(theme, placeHolder) {
  const transparentForeground = theme.getColor(editorForeground)?.transparent(0.4);
  return [{
    range: {
      startLineNumber: 0,
      endLineNumber: 0,
      startColumn: 0,
      endColumn: 1
    },
    renderOptions: {
      after: {
        contentText: placeHolder,
        color: transparentForeground ? transparentForeground.toString() : void 0
      }
    }
  }];
}
let BreakpointWidget = class extends ZoneWidget {
  constructor(editor, lineNumber, column, context, contextViewService, debugService, themeService, instantiationService, modelService, codeEditorService, _configurationService, languageFeaturesService, keybindingService, labelService, textModelService, hoverService) {
    super(editor, { showFrame: true, showArrow: false, frameWidth: 1, isAccessible: true });
    this.lineNumber = lineNumber;
    this.column = column;
    this.contextViewService = contextViewService;
    this.debugService = debugService;
    this.themeService = themeService;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.codeEditorService = codeEditorService;
    this._configurationService = _configurationService;
    this.languageFeaturesService = languageFeaturesService;
    this.keybindingService = keybindingService;
    this.labelService = labelService;
    this.textModelService = textModelService;
    this.hoverService = hoverService;
    this.conditionInput = "";
    this.hitCountInput = "";
    this.logMessageInput = "";
    this.availableBreakpoints = [];
    this.store = new lifecycle.DisposableStore();
    const model = this.editor.getModel();
    if (model) {
      const uri2 = model.uri;
      const breakpoints = this.debugService.getModel().getBreakpoints({ lineNumber: this.lineNumber, column: this.column, uri: uri2 });
      this.breakpoint = breakpoints.length ? breakpoints[0] : void 0;
    }
    if (context === void 0) {
      if (this.breakpoint && !this.breakpoint.condition && !this.breakpoint.hitCondition && this.breakpoint.logMessage) {
        this.context = Context.LOG_MESSAGE;
      } else if (this.breakpoint && !this.breakpoint.condition && this.breakpoint.hitCondition) {
        this.context = Context.HIT_COUNT;
      } else if (this.breakpoint && this.breakpoint.triggeredBy) {
        this.context = Context.TRIGGER_POINT;
      } else {
        this.context = Context.CONDITION;
      }
    } else {
      this.context = context;
    }
    this.store.add(this.debugService.getModel().onDidChangeBreakpoints((e) => {
      if (this.breakpoint && e && e.removed && e.removed.indexOf(this.breakpoint) >= 0) {
        this.dispose();
      }
      if (this.context === Context.TRIGGER_POINT && this.selectBreakpointBox) {
        this.updateTriggerBreakpointList();
      }
    }));
    this.store.add(this.codeEditorService.registerDecorationType("breakpoint-widget", DECORATION_KEY, {}));
    this.create();
  }
  get placeholder() {
    const acceptString = this.keybindingService.lookupKeybinding(AcceptBreakpointWidgetInputAction.ID)?.getLabel() || "Enter";
    const closeString = this.keybindingService.lookupKeybinding(CloseBreakpointWidgetCommand.ID)?.getLabel() || "Escape";
    switch (this.context) {
      case Context.LOG_MESSAGE:
        return nls.localize("breakpointWidgetLogMessagePlaceholder", "Message to log when breakpoint is hit. Expressions within {} are interpolated. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
      case Context.HIT_COUNT:
        return nls.localize("breakpointWidgetHitCountPlaceholder", "Break when hit count condition is met. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
      default:
        return nls.localize("breakpointWidgetExpressionPlaceholder", "Break when expression evaluates to true. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
    }
  }
  getInputValue(breakpoint) {
    switch (this.context) {
      case Context.LOG_MESSAGE:
        return breakpoint && breakpoint.logMessage ? breakpoint.logMessage : this.logMessageInput;
      case Context.HIT_COUNT:
        return breakpoint && breakpoint.hitCondition ? breakpoint.hitCondition : this.hitCountInput;
      default:
        return breakpoint && breakpoint.condition ? breakpoint.condition : this.conditionInput;
    }
  }
  rememberInput() {
    if (this.context !== Context.TRIGGER_POINT) {
      const value = this.input.getModel().getValue();
      switch (this.context) {
        case Context.LOG_MESSAGE:
          this.logMessageInput = value;
          break;
        case Context.HIT_COUNT:
          this.hitCountInput = value;
          break;
        default:
          this.conditionInput = value;
      }
    }
  }
  setInputMode() {
    if (this.editor.hasModel()) {
      const languageId = this.context === Context.LOG_MESSAGE ? PLAINTEXT_LANGUAGE_ID : this.editor.getModel().getLanguageId();
      this.input.getModel().setLanguage(languageId);
    }
  }
  show(rangeOrPos) {
    const lineNum = this.input.getModel().getLineCount();
    super.show(rangeOrPos, lineNum + 1);
  }
  fitHeightToContent() {
    const lineNum = this.input.getModel().getLineCount();
    this._relayout(lineNum + 1);
  }
  _fillContainer(container) {
    this.setCssClass("breakpoint-widget");
    const selectBox = this.store.add(new SelectBox([
      { text: nls.localize("expression", "Expression") },
      { text: nls.localize("hitCount", "Hit Count") },
      { text: nls.localize("logMessage", "Log Message") },
      { text: nls.localize("triggeredBy", "Wait for Breakpoint") }
    ], this.context, this.contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("breakpointType", "Breakpoint Type"), useCustomDrawn: !hasNativeContextMenu(this._configurationService) }));
    this.selectContainer = $(".breakpoint-select-container");
    selectBox.render(dom.append(container, this.selectContainer));
    this.store.add(selectBox.onDidSelect((e) => {
      this.rememberInput();
      this.context = e.index;
      this.updateContextInput();
    }));
    this.createModesInput(container);
    this.inputContainer = $(".inputContainer");
    this.store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.inputContainer, this.placeholder));
    this.createBreakpointInput(dom.append(container, this.inputContainer));
    this.input.getModel().setValue(this.getInputValue(this.breakpoint));
    this.store.add(this.input.getModel().onDidChangeContent(() => {
      this.fitHeightToContent();
    }));
    this.input.setPosition({ lineNumber: 1, column: this.input.getModel().getLineMaxColumn(1) });
    this.createTriggerBreakpointInput(container);
    this.updateContextInput();
    setTimeout(() => this.focusInput(), 150);
  }
  createModesInput(container) {
    const modes = this.debugService.getModel().getBreakpointModes("source");
    if (modes.length <= 1) {
      return;
    }
    const sb = this.selectModeBox = new SelectBox(
      [
        { text: nls.localize("bpMode", "Mode"), isDisabled: true },
        ...modes.map((mode) => ({ text: mode.label, description: mode.description }))
      ],
      modes.findIndex((m) => m.mode === this.breakpoint?.mode) + 1,
      this.contextViewService,
      defaultSelectBoxStyles,
      { useCustomDrawn: !hasNativeContextMenu(this._configurationService) }
    );
    this.store.add(sb);
    this.store.add(sb.onDidSelect((e) => {
      this.modeInput = modes[e.index - 1];
    }));
    const modeWrapper = $(".select-mode-container");
    const selectionWrapper = $(".select-box-container");
    dom.append(modeWrapper, selectionWrapper);
    sb.render(selectionWrapper);
    dom.append(container, modeWrapper);
  }
  createTriggerBreakpointInput(container) {
    this.availableBreakpoints = this.debugService.getModel().getBreakpoints().filter((bp) => bp !== this.breakpoint && !bp.logMessage);
    const breakpointOptions = this.buildBreakpointOptions();
    const index = this.availableBreakpoints.findIndex((bp) => this.breakpoint?.triggeredBy === bp.getId());
    let selectedIndex = 0;
    if (index !== -1) {
      this.triggeredByBreakpointInput = this.availableBreakpoints[index];
      selectedIndex = index + 1;
    } else if (!this.breakpoint?.triggeredBy && this.availableBreakpoints.length > 0) {
      this.triggeredByBreakpointInput = this.availableBreakpoints[0];
      selectedIndex = 1;
    } else {
      this.triggeredByBreakpointInput = void 0;
    }
    const selectBreakpointBox = this.selectBreakpointBox = this.store.add(new SelectBox(breakpointOptions, selectedIndex, this.contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("selectBreakpoint", "Select breakpoint"), useCustomDrawn: !hasNativeContextMenu(this._configurationService) }));
    this.store.add(selectBreakpointBox.onDidSelect((e) => {
      if (e.index === 0) {
        this.triggeredByBreakpointInput = void 0;
      } else {
        this.triggeredByBreakpointInput = this.availableBreakpoints[e.index - 1];
      }
    }));
    this.selectBreakpointContainer = $(".select-breakpoint-container");
    this.store.add(dom.addDisposableListener(this.selectBreakpointContainer, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Escape)) {
        this.close(false);
      }
    }));
    const selectionWrapper = $(".select-box-container");
    dom.append(this.selectBreakpointContainer, selectionWrapper);
    selectBreakpointBox.render(selectionWrapper);
    dom.append(container, this.selectBreakpointContainer);
    const closeButton = new Button(this.selectBreakpointContainer, defaultButtonStyles);
    closeButton.label = nls.localize("ok", "OK");
    this.store.add(closeButton.onDidClick(() => this.close(true)));
    this.store.add(closeButton);
  }
  buildBreakpointOptions() {
    const breakpointOptions = [
      { text: nls.localize("noTriggerByBreakpoint", "None"), isDisabled: true },
      ...this.availableBreakpoints.map((bp) => ({
        text: `${this.labelService.getUriLabel(bp.uri, { relative: true })}: ${bp.lineNumber}`,
        description: nls.localize("triggerByLoading", "Loading...")
      }))
    ];
    for (const [i, bp] of this.availableBreakpoints.entries()) {
      this.textModelService.createModelReference(bp.uri).then((ref) => {
        try {
          breakpointOptions[i + 1].description = ref.object.textEditorModel.getLineContent(bp.lineNumber).trim();
        } finally {
          ref.dispose();
        }
      }).catch(() => {
        breakpointOptions[i + 1].description = nls.localize("noBpSource", "Could not load source.");
      });
    }
    return breakpointOptions;
  }
  updateTriggerBreakpointList() {
    this.availableBreakpoints = this.debugService.getModel().getBreakpoints().filter((bp) => bp !== this.breakpoint && !bp.logMessage);
    let selectedIndex = 0;
    if (this.triggeredByBreakpointInput) {
      const newIndex = this.availableBreakpoints.findIndex((bp) => bp.getId() === this.triggeredByBreakpointInput?.getId());
      if (newIndex !== -1) {
        selectedIndex = newIndex + 1;
      } else {
        this.triggeredByBreakpointInput = void 0;
      }
    }
    const breakpointOptions = this.buildBreakpointOptions();
    this.selectBreakpointBox.setOptions(breakpointOptions, selectedIndex);
  }
  updateContextInput() {
    if (this.context === Context.TRIGGER_POINT) {
      this.inputContainer.hidden = true;
      this.selectBreakpointContainer.hidden = false;
      if (this.selectBreakpointBox) {
        this.updateTriggerBreakpointList();
      }
    } else {
      this.inputContainer.hidden = false;
      this.selectBreakpointContainer.hidden = true;
      this.setInputMode();
      const value = this.getInputValue(this.breakpoint);
      this.input.getModel().setValue(value);
      this.focusInput();
    }
  }
  _doLayout(heightInPixel, widthInPixel) {
    this.heightInPx = heightInPixel;
    this.input.layout({ height: heightInPixel, width: widthInPixel - 113 });
    this.centerInputVertically();
  }
  _onWidth(widthInPixel) {
    if (typeof this.heightInPx === "number") {
      this._doLayout(this.heightInPx, widthInPixel);
    }
  }
  createBreakpointInput(container) {
    const scopedInstatiationService = this.instantiationService.createChild(new ServiceCollection(
      [IPrivateBreakpointWidgetService, this]
    ));
    this.store.add(scopedInstatiationService);
    const options = this.createEditorOptions();
    const codeEditorWidgetOptions = getSimpleCodeEditorWidgetOptions();
    this.input = scopedInstatiationService.createInstance(CodeEditorWidget, container, options, codeEditorWidgetOptions);
    CONTEXT_IN_BREAKPOINT_WIDGET.bindTo(this.input.contextKeyService).set(true);
    const model = this.modelService.createModel("", null, uri.parse(`${DEBUG_SCHEME}:${this.editor.getId()}:breakpointinput`), true);
    if (this.editor.hasModel()) {
      model.setLanguage(this.editor.getModel().getLanguageId());
    }
    this.input.setModel(model);
    this.setInputMode();
    this.store.add(model);
    const setDecorations = () => {
      const value = this.input.getModel().getValue();
      const decorations = !!value ? [] : createDecorations(this.themeService.getColorTheme(), this.placeholder);
      this.input.setDecorationsByType("breakpoint-widget", DECORATION_KEY, decorations);
    };
    this.store.add(this.input.getModel().onDidChangeContent(() => setDecorations()));
    this.store.add(this.themeService.onDidColorThemeChange(() => setDecorations()));
    this.store.add(this.languageFeaturesService.completionProvider.register({ scheme: DEBUG_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "breakpointWidget",
      provideCompletionItems: (model2, position, _context, token) => {
        let suggestionsPromise;
        const underlyingModel = this.editor.getModel();
        if (underlyingModel && (this.context === Context.CONDITION || this.context === Context.LOG_MESSAGE && isPositionInCurlyBracketBlock(this.input))) {
          suggestionsPromise = provideSuggestionItems(this.languageFeaturesService.completionProvider, underlyingModel, new Position(this.lineNumber, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(CompletionItemKind.Snippet)), _context, token).then((suggestions) => {
            let overwriteBefore = 0;
            if (this.context === Context.CONDITION) {
              overwriteBefore = position.column - 1;
            } else {
              const value = this.input.getModel().getValue();
              while (position.column - 2 - overwriteBefore >= 0 && value[position.column - 2 - overwriteBefore] !== "{" && value[position.column - 2 - overwriteBefore] !== " ") {
                overwriteBefore++;
              }
            }
            return {
              suggestions: suggestions.items.map((s) => {
                s.completion.range = Range.fromPositions(position.delta(0, -overwriteBefore), position);
                return s.completion;
              })
            };
          });
        } else {
          suggestionsPromise = Promise.resolve({ suggestions: [] });
        }
        return suggestionsPromise;
      }
    }));
    this.store.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.fontSize") || e.affectsConfiguration("editor.lineHeight")) {
        this.input.updateOptions(this.createEditorOptions());
        this.centerInputVertically();
      }
    }));
  }
  createEditorOptions() {
    const editorConfig = this._configurationService.getValue("editor");
    const options = getSimpleEditorOptions(this._configurationService);
    options.fontSize = editorConfig.fontSize;
    options.fontFamily = editorConfig.fontFamily;
    options.lineHeight = editorConfig.lineHeight;
    options.fontLigatures = editorConfig.fontLigatures;
    options.ariaLabel = this.placeholder;
    return options;
  }
  centerInputVertically() {
    if (this.container && typeof this.heightInPx === "number") {
      const lineHeight = this.input.getOption(EditorOption.lineHeight);
      const lineNum = this.input.getModel().getLineCount();
      const newTopMargin = (this.heightInPx - lineNum * lineHeight) / 2;
      this.inputContainer.style.marginTop = newTopMargin + "px";
    }
  }
  close(success) {
    if (success) {
      let condition = void 0;
      let hitCondition = void 0;
      let logMessage = void 0;
      let triggeredBy = void 0;
      let mode = void 0;
      let modeLabel = void 0;
      this.rememberInput();
      if (this.conditionInput || this.context === Context.CONDITION) {
        condition = this.conditionInput;
      }
      if (this.hitCountInput || this.context === Context.HIT_COUNT) {
        hitCondition = this.hitCountInput;
      }
      if (this.logMessageInput || this.context === Context.LOG_MESSAGE) {
        logMessage = this.logMessageInput;
      }
      if (this.selectModeBox) {
        mode = this.modeInput?.mode;
        modeLabel = this.modeInput?.label;
      }
      if (this.context === Context.TRIGGER_POINT) {
        condition = void 0;
        hitCondition = void 0;
        logMessage = void 0;
        triggeredBy = this.triggeredByBreakpointInput?.getId();
      }
      if (this.breakpoint) {
        const data = /* @__PURE__ */ new Map();
        data.set(this.breakpoint.getId(), {
          condition,
          hitCondition,
          logMessage,
          triggeredBy,
          mode,
          modeLabel
        });
        this.debugService.updateBreakpoints(this.breakpoint.originalUri, data, false).then(void 0, onUnexpectedError);
      } else {
        const model = this.editor.getModel();
        if (model) {
          this.debugService.addBreakpoints(model.uri, [{
            lineNumber: this.lineNumber,
            column: this.column,
            enabled: true,
            condition,
            hitCondition,
            logMessage,
            triggeredBy,
            mode,
            modeLabel
          }]);
        }
      }
    }
    this.dispose();
  }
  focusInput() {
    if (this.context === Context.TRIGGER_POINT) {
      this.selectBreakpointBox.focus();
    } else {
      this.input.focus();
    }
  }
  dispose() {
    super.dispose();
    this.input.dispose();
    lifecycle.dispose(this.store);
    setTimeout(() => this.editor.focus(), 0);
  }
};
BreakpointWidget = __decorateClass([
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IDebugService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IModelService),
  __decorateParam(9, ICodeEditorService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, ILanguageFeaturesService),
  __decorateParam(12, IKeybindingService),
  __decorateParam(13, ILabelService),
  __decorateParam(14, ITextModelService),
  __decorateParam(15, IHoverService)
], BreakpointWidget);
class AcceptBreakpointWidgetInputAction extends EditorCommand {
  static {
    this.ID = "breakpointWidget.action.acceptInput";
  }
  constructor() {
    super({
      id: AcceptBreakpointWidgetInputAction.ID,
      precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
      kbOpts: {
        kbExpr: CONTEXT_IN_BREAKPOINT_WIDGET,
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  runEditorCommand(accessor, editor) {
    accessor.get(IPrivateBreakpointWidgetService).close(true);
  }
}
class CloseBreakpointWidgetCommand extends EditorCommand {
  static {
    this.ID = "closeBreakpointWidget";
  }
  constructor() {
    super({
      id: CloseBreakpointWidgetCommand.ID,
      precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyCode.Escape,
        secondary: [KeyMod.Shift | KeyCode.Escape],
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  runEditorCommand(accessor, editor, args) {
    const debugContribution = editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID);
    if (debugContribution) {
      return debugContribution.closeBreakpointWidget();
    }
    accessor.get(IPrivateBreakpointWidgetService).close(false);
  }
}
registerEditorCommand(new AcceptBreakpointWidgetInputAction());
registerEditorCommand(new CloseBreakpointWidgetCommand());
export {
  BreakpointWidget
};
