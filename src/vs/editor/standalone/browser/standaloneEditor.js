import { mainWindow } from "../../../base/browser/window.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { splitLines } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import "./standalone-tokens.css";
import { FontMeasurements } from "../../browser/config/fontMeasurements.js";
import { EditorCommand } from "../../browser/editorExtensions.js";
import { ICodeEditorService } from "../../browser/services/codeEditorService.js";
import { createWebWorker as actualCreateWebWorker } from "./standaloneWebWorker.js";
import { ApplyUpdateResult, ConfigurationChangedEvent, EditorOptions } from "../../common/config/editorOptions.js";
import { EditorZoom } from "../../common/config/editorZoom.js";
import { BareFontInfo, FontInfo } from "../../common/config/fontInfo.js";
import { EditorType } from "../../common/editorCommon.js";
import * as languages from "../../common/languages.js";
import { ILanguageService } from "../../common/languages/language.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../common/languages/modesRegistry.js";
import { NullState, nullTokenize } from "../../common/languages/nullTokenize.js";
import { FindMatch, TextModelResolvedOptions } from "../../common/model.js";
import { IModelService } from "../../common/services/model.js";
import * as standaloneEnums from "../../common/standalone/standaloneEnums.js";
import { Colorizer } from "./colorizer.js";
import { StandaloneDiffEditor2, StandaloneEditor, createTextModel } from "./standaloneCodeEditor.js";
import { StandaloneKeybindingService, StandaloneServices } from "./standaloneServices.js";
import { IStandaloneThemeService } from "../common/standaloneTheme.js";
import { MenuId, MenuRegistry } from "../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { IMarkerService } from "../../../platform/markers/common/markers.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { MultiDiffEditorWidget } from "../../browser/widget/multiDiffEditor/multiDiffEditorWidget.js";
import { IWebWorkerService } from "../../../platform/webWorker/browser/webWorkerService.js";
function create(domElement, options, override) {
  const instantiationService = StandaloneServices.initialize(override || {});
  return instantiationService.createInstance(StandaloneEditor, domElement, options);
}
function onDidCreateEditor(listener) {
  const codeEditorService = StandaloneServices.get(ICodeEditorService);
  return codeEditorService.onCodeEditorAdd((editor) => {
    listener(editor);
  });
}
function onDidCreateDiffEditor(listener) {
  const codeEditorService = StandaloneServices.get(ICodeEditorService);
  return codeEditorService.onDiffEditorAdd((editor) => {
    listener(editor);
  });
}
function getEditors() {
  const codeEditorService = StandaloneServices.get(ICodeEditorService);
  return codeEditorService.listCodeEditors();
}
function getDiffEditors() {
  const codeEditorService = StandaloneServices.get(ICodeEditorService);
  return codeEditorService.listDiffEditors();
}
function createDiffEditor(domElement, options, override) {
  const instantiationService = StandaloneServices.initialize(override || {});
  return instantiationService.createInstance(StandaloneDiffEditor2, domElement, options);
}
function createMultiFileDiffEditor(domElement, override) {
  const instantiationService = StandaloneServices.initialize(override || {});
  return new MultiDiffEditorWidget(domElement, {}, void 0, instantiationService);
}
function addCommand(descriptor) {
  if (typeof descriptor.id !== "string" || typeof descriptor.run !== "function") {
    throw new Error("Invalid command descriptor, `id` and `run` are required properties!");
  }
  return CommandsRegistry.registerCommand(descriptor.id, descriptor.run);
}
function addEditorAction(descriptor) {
  if (typeof descriptor.id !== "string" || typeof descriptor.label !== "string" || typeof descriptor.run !== "function") {
    throw new Error("Invalid action descriptor, `id`, `label` and `run` are required properties!");
  }
  const precondition = ContextKeyExpr.deserialize(descriptor.precondition);
  const run = (accessor, ...args) => {
    return EditorCommand.runEditorCommand(accessor, args, precondition, (accessor2, editor, args2) => Promise.resolve(descriptor.run(editor, ...args2)));
  };
  const toDispose = new DisposableStore();
  toDispose.add(CommandsRegistry.registerCommand(descriptor.id, run));
  if (descriptor.contextMenuGroupId) {
    const menuItem = {
      command: {
        id: descriptor.id,
        title: descriptor.label
      },
      when: precondition,
      group: descriptor.contextMenuGroupId,
      order: descriptor.contextMenuOrder || 0
    };
    toDispose.add(MenuRegistry.appendMenuItem(MenuId.EditorContext, menuItem));
  }
  if (Array.isArray(descriptor.keybindings)) {
    const keybindingService = StandaloneServices.get(IKeybindingService);
    if (!(keybindingService instanceof StandaloneKeybindingService)) {
      console.warn("Cannot add keybinding because the editor is configured with an unrecognized KeybindingService");
    } else {
      const keybindingsWhen = ContextKeyExpr.and(precondition, ContextKeyExpr.deserialize(descriptor.keybindingContext));
      toDispose.add(keybindingService.addDynamicKeybindings(descriptor.keybindings.map((keybinding) => {
        return {
          keybinding,
          command: descriptor.id,
          when: keybindingsWhen
        };
      })));
    }
  }
  return toDispose;
}
function addKeybindingRule(rule) {
  return addKeybindingRules([rule]);
}
function addKeybindingRules(rules) {
  const keybindingService = StandaloneServices.get(IKeybindingService);
  if (!(keybindingService instanceof StandaloneKeybindingService)) {
    console.warn("Cannot add keybinding because the editor is configured with an unrecognized KeybindingService");
    return Disposable.None;
  }
  return keybindingService.addDynamicKeybindings(rules.map((rule) => {
    return {
      keybinding: rule.keybinding,
      command: rule.command,
      commandArgs: rule.commandArgs,
      when: ContextKeyExpr.deserialize(rule.when)
    };
  }));
}
function createModel(value, language, uri) {
  const languageService = StandaloneServices.get(ILanguageService);
  const languageId = languageService.getLanguageIdByMimeType(language) || language;
  return createTextModel(
    StandaloneServices.get(IModelService),
    languageService,
    value,
    languageId,
    uri
  );
}
function setModelLanguage(model, mimeTypeOrLanguageId) {
  const languageService = StandaloneServices.get(ILanguageService);
  const languageId = languageService.getLanguageIdByMimeType(mimeTypeOrLanguageId) || mimeTypeOrLanguageId || PLAINTEXT_LANGUAGE_ID;
  model.setLanguage(languageService.createById(languageId));
}
function setModelMarkers(model, owner, markers) {
  if (model) {
    const markerService = StandaloneServices.get(IMarkerService);
    markerService.changeOne(owner, model.uri, markers);
  }
}
function removeAllMarkers(owner) {
  const markerService = StandaloneServices.get(IMarkerService);
  markerService.changeAll(owner, []);
}
function getModelMarkers(filter) {
  const markerService = StandaloneServices.get(IMarkerService);
  return markerService.read(filter);
}
function onDidChangeMarkers(listener) {
  const markerService = StandaloneServices.get(IMarkerService);
  return markerService.onMarkerChanged(listener);
}
function getModel(uri) {
  const modelService = StandaloneServices.get(IModelService);
  return modelService.getModel(uri);
}
function getModels() {
  const modelService = StandaloneServices.get(IModelService);
  return modelService.getModels();
}
function onDidCreateModel(listener) {
  const modelService = StandaloneServices.get(IModelService);
  return modelService.onModelAdded(listener);
}
function onWillDisposeModel(listener) {
  const modelService = StandaloneServices.get(IModelService);
  return modelService.onModelRemoved(listener);
}
function onDidChangeModelLanguage(listener) {
  const modelService = StandaloneServices.get(IModelService);
  return modelService.onModelLanguageChanged((e) => {
    listener({
      model: e.model,
      oldLanguage: e.oldLanguageId
    });
  });
}
function createWebWorker(opts) {
  return actualCreateWebWorker(StandaloneServices.get(IModelService), StandaloneServices.get(IWebWorkerService), opts);
}
function colorizeElement(domNode, options) {
  const languageService = StandaloneServices.get(ILanguageService);
  const themeService = StandaloneServices.get(IStandaloneThemeService);
  return Colorizer.colorizeElement(themeService, languageService, domNode, options).then(() => {
    themeService.registerEditorContainer(domNode);
  });
}
function colorize(text, languageId, options) {
  const languageService = StandaloneServices.get(ILanguageService);
  const themeService = StandaloneServices.get(IStandaloneThemeService);
  themeService.registerEditorContainer(mainWindow.document.body);
  return Colorizer.colorize(languageService, text, languageId, options);
}
function colorizeModelLine(model, lineNumber, tabSize = 4) {
  const themeService = StandaloneServices.get(IStandaloneThemeService);
  themeService.registerEditorContainer(mainWindow.document.body);
  return Colorizer.colorizeModelLine(model, lineNumber, tabSize);
}
function getSafeTokenizationSupport(language) {
  const tokenizationSupport = languages.TokenizationRegistry.get(language);
  if (tokenizationSupport) {
    return tokenizationSupport;
  }
  return {
    getInitialState: () => NullState,
    tokenize: (line, hasEOL, state) => nullTokenize(language, state)
  };
}
function tokenize(text, languageId) {
  languages.TokenizationRegistry.getOrCreate(languageId);
  const tokenizationSupport = getSafeTokenizationSupport(languageId);
  const lines = splitLines(text);
  const result = [];
  let state = tokenizationSupport.getInitialState();
  for (let i = 0, len = lines.length; i < len; i++) {
    const line = lines[i];
    const tokenizationResult = tokenizationSupport.tokenize(line, true, state);
    result[i] = tokenizationResult.tokens;
    state = tokenizationResult.endState;
  }
  return result;
}
function defineTheme(themeName, themeData) {
  const standaloneThemeService = StandaloneServices.get(IStandaloneThemeService);
  standaloneThemeService.defineTheme(themeName, themeData);
}
function setTheme(themeName) {
  const standaloneThemeService = StandaloneServices.get(IStandaloneThemeService);
  standaloneThemeService.setTheme(themeName);
}
function remeasureFonts() {
  FontMeasurements.clearAllFontInfos();
}
function registerCommand(id, handler) {
  return CommandsRegistry.registerCommand({ id, handler });
}
function registerLinkOpener(opener) {
  const openerService = StandaloneServices.get(IOpenerService);
  return openerService.registerOpener({
    async open(resource) {
      if (typeof resource === "string") {
        resource = URI.parse(resource);
      }
      return opener.open(resource);
    }
  });
}
function registerEditorOpener(opener) {
  const codeEditorService = StandaloneServices.get(ICodeEditorService);
  return codeEditorService.registerCodeEditorOpenHandler(async (input, source, sideBySide) => {
    if (!source) {
      return null;
    }
    const selection = input.options?.selection;
    let selectionOrPosition;
    if (selection && typeof selection.endLineNumber === "number" && typeof selection.endColumn === "number") {
      selectionOrPosition = selection;
    } else if (selection) {
      selectionOrPosition = { lineNumber: selection.startLineNumber, column: selection.startColumn };
    }
    if (await opener.openCodeEditor(source, input.resource, selectionOrPosition)) {
      return source;
    }
    return null;
  });
}
function createMonacoEditorAPI() {
  return {
    // methods
    // eslint-disable-next-line local/code-no-any-casts
    create,
    // eslint-disable-next-line local/code-no-any-casts
    getEditors,
    // eslint-disable-next-line local/code-no-any-casts
    getDiffEditors,
    // eslint-disable-next-line local/code-no-any-casts
    onDidCreateEditor,
    // eslint-disable-next-line local/code-no-any-casts
    onDidCreateDiffEditor,
    // eslint-disable-next-line local/code-no-any-casts
    createDiffEditor,
    // eslint-disable-next-line local/code-no-any-casts
    addCommand,
    // eslint-disable-next-line local/code-no-any-casts
    addEditorAction,
    // eslint-disable-next-line local/code-no-any-casts
    addKeybindingRule,
    // eslint-disable-next-line local/code-no-any-casts
    addKeybindingRules,
    // eslint-disable-next-line local/code-no-any-casts
    createModel,
    // eslint-disable-next-line local/code-no-any-casts
    setModelLanguage,
    // eslint-disable-next-line local/code-no-any-casts
    setModelMarkers,
    // eslint-disable-next-line local/code-no-any-casts
    getModelMarkers,
    removeAllMarkers,
    // eslint-disable-next-line local/code-no-any-casts
    onDidChangeMarkers,
    // eslint-disable-next-line local/code-no-any-casts
    getModels,
    // eslint-disable-next-line local/code-no-any-casts
    getModel,
    // eslint-disable-next-line local/code-no-any-casts
    onDidCreateModel,
    // eslint-disable-next-line local/code-no-any-casts
    onWillDisposeModel,
    // eslint-disable-next-line local/code-no-any-casts
    onDidChangeModelLanguage,
    // eslint-disable-next-line local/code-no-any-casts
    createWebWorker,
    // eslint-disable-next-line local/code-no-any-casts
    colorizeElement,
    // eslint-disable-next-line local/code-no-any-casts
    colorize,
    // eslint-disable-next-line local/code-no-any-casts
    colorizeModelLine,
    // eslint-disable-next-line local/code-no-any-casts
    tokenize,
    // eslint-disable-next-line local/code-no-any-casts
    defineTheme,
    // eslint-disable-next-line local/code-no-any-casts
    setTheme,
    remeasureFonts,
    registerCommand,
    registerLinkOpener,
    // eslint-disable-next-line local/code-no-any-casts
    registerEditorOpener,
    // enums
    AccessibilitySupport: standaloneEnums.AccessibilitySupport,
    ContentWidgetPositionPreference: standaloneEnums.ContentWidgetPositionPreference,
    CursorChangeReason: standaloneEnums.CursorChangeReason,
    DefaultEndOfLine: standaloneEnums.DefaultEndOfLine,
    EditorAutoIndentStrategy: standaloneEnums.EditorAutoIndentStrategy,
    EditorOption: standaloneEnums.EditorOption,
    EndOfLinePreference: standaloneEnums.EndOfLinePreference,
    EndOfLineSequence: standaloneEnums.EndOfLineSequence,
    MinimapPosition: standaloneEnums.MinimapPosition,
    MinimapSectionHeaderStyle: standaloneEnums.MinimapSectionHeaderStyle,
    MouseTargetType: standaloneEnums.MouseTargetType,
    OverlayWidgetPositionPreference: standaloneEnums.OverlayWidgetPositionPreference,
    OverviewRulerLane: standaloneEnums.OverviewRulerLane,
    GlyphMarginLane: standaloneEnums.GlyphMarginLane,
    RenderLineNumbersType: standaloneEnums.RenderLineNumbersType,
    RenderMinimap: standaloneEnums.RenderMinimap,
    ScrollbarVisibility: standaloneEnums.ScrollbarVisibility,
    ScrollType: standaloneEnums.ScrollType,
    TextEditorCursorBlinkingStyle: standaloneEnums.TextEditorCursorBlinkingStyle,
    TextEditorCursorStyle: standaloneEnums.TextEditorCursorStyle,
    TrackedRangeStickiness: standaloneEnums.TrackedRangeStickiness,
    WrappingIndent: standaloneEnums.WrappingIndent,
    InjectedTextCursorStops: standaloneEnums.InjectedTextCursorStops,
    PositionAffinity: standaloneEnums.PositionAffinity,
    ShowLightbulbIconMode: standaloneEnums.ShowLightbulbIconMode,
    TextDirection: standaloneEnums.TextDirection,
    // classes
    // eslint-disable-next-line local/code-no-any-casts
    ConfigurationChangedEvent,
    // eslint-disable-next-line local/code-no-any-casts
    BareFontInfo,
    // eslint-disable-next-line local/code-no-any-casts
    FontInfo,
    // eslint-disable-next-line local/code-no-any-casts
    TextModelResolvedOptions,
    // eslint-disable-next-line local/code-no-any-casts
    FindMatch,
    // eslint-disable-next-line local/code-no-any-casts
    ApplyUpdateResult,
    // eslint-disable-next-line local/code-no-any-casts
    EditorZoom,
    // eslint-disable-next-line local/code-no-any-casts
    createMultiFileDiffEditor,
    // vars
    EditorType,
    // eslint-disable-next-line local/code-no-any-casts
    EditorOptions
  };
}
export {
  addCommand,
  addEditorAction,
  addKeybindingRule,
  addKeybindingRules,
  colorize,
  colorizeElement,
  colorizeModelLine,
  create,
  createDiffEditor,
  createModel,
  createMonacoEditorAPI,
  createMultiFileDiffEditor,
  createWebWorker,
  defineTheme,
  getDiffEditors,
  getEditors,
  getModel,
  getModelMarkers,
  getModels,
  onDidChangeMarkers,
  onDidChangeModelLanguage,
  onDidCreateDiffEditor,
  onDidCreateEditor,
  onDidCreateModel,
  onWillDisposeModel,
  registerCommand,
  registerEditorOpener,
  registerLinkOpener,
  remeasureFonts,
  removeAllMarkers,
  setModelLanguage,
  setModelMarkers,
  setTheme,
  tokenize
};
