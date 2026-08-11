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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IViewDescriptorService } from "../../../../common/views.js";
let ChatEditorOptions = class extends Disposable {
  constructor(viewId, foreground, inputEditorBackgroundColor, resultEditorBackgroundColor, configurationService, themeService, viewDescriptorService) {
    super();
    this.foreground = foreground;
    this.inputEditorBackgroundColor = inputEditorBackgroundColor;
    this.resultEditorBackgroundColor = resultEditorBackgroundColor;
    this.configurationService = configurationService;
    this.themeService = themeService;
    this.viewDescriptorService = viewDescriptorService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._register(this.themeService.onDidColorThemeChange((e) => this.update()));
    this._register(this.viewDescriptorService.onDidChangeLocation((e) => {
      if (e.views.some((v) => v.id === viewId)) {
        this.update();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (ChatEditorOptions.relevantSettingIds.some((id) => e.affectsConfiguration(id))) {
        this.update();
      }
    }));
    this.update();
  }
  static {
    this.lineHeightEm = 1.4;
  }
  get configuration() {
    return this._config;
  }
  static {
    this.relevantSettingIds = [
      "chat.editor.lineHeight",
      "chat.editor.fontSize",
      "chat.editor.fontFamily",
      "chat.editor.fontWeight",
      "chat.editor.wordWrap",
      "editor.cursorBlinking",
      "editor.fontLigatures",
      "editor.accessibilitySupport",
      "editor.bracketPairColorization.enabled",
      "editor.bracketPairColorization.independentColorPoolPerBracketType"
    ];
  }
  update() {
    const editorConfig = this.configurationService.getValue("editor");
    const chatEditorConfig = this.configurationService.getValue("chat")?.editor;
    const accessibilitySupport = this.configurationService.getValue("editor.accessibilitySupport");
    this._config = {
      foreground: this.themeService.getColorTheme().getColor(this.foreground),
      inputEditor: {
        backgroundColor: this.themeService.getColorTheme().getColor(this.inputEditorBackgroundColor),
        accessibilitySupport
      },
      resultEditor: {
        backgroundColor: this.themeService.getColorTheme().getColor(this.resultEditorBackgroundColor),
        fontSize: chatEditorConfig.fontSize,
        fontFamily: chatEditorConfig.fontFamily === "default" ? editorConfig.fontFamily : chatEditorConfig.fontFamily,
        fontWeight: chatEditorConfig.fontWeight,
        lineHeight: chatEditorConfig.lineHeight ? chatEditorConfig.lineHeight : ChatEditorOptions.lineHeightEm * chatEditorConfig.fontSize,
        bracketPairColorization: {
          enabled: this.configurationService.getValue("editor.bracketPairColorization.enabled"),
          independentColorPoolPerBracketType: this.configurationService.getValue("editor.bracketPairColorization.independentColorPoolPerBracketType")
        },
        wordWrap: chatEditorConfig.wordWrap,
        fontLigatures: editorConfig.fontLigatures
      }
    };
    this._onDidChange.fire();
  }
  setColors(foreground, inputEditorBackgroundColor, resultEditorBackgroundColor) {
    this.foreground = foreground;
    this.inputEditorBackgroundColor = inputEditorBackgroundColor;
    this.resultEditorBackgroundColor = resultEditorBackgroundColor;
    this.update();
  }
};
ChatEditorOptions = __decorateClass([
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IViewDescriptorService)
], ChatEditorOptions);
export {
  ChatEditorOptions
};
