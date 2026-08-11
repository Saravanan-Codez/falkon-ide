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
import * as objects from "../../../../base/common/objects.js";
import { ICodeEditorService } from "../../services/codeEditorService.js";
import { CodeEditorWidget } from "./codeEditorWidget.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUserInteractionService } from "../../../../platform/userInteraction/browser/userInteractionService.js";
let EmbeddedCodeEditorWidget = class extends CodeEditorWidget {
  constructor(domElement, options, codeEditorWidgetOptions, parentEditor, instantiationService, codeEditorService, commandService, contextKeyService, themeService, notificationService, accessibilityService, languageConfigurationService, languageFeaturesService, userInteractionService) {
    super(domElement, { ...parentEditor.getRawOptions(), overflowWidgetsDomNode: parentEditor.getOverflowWidgetsDomNode() }, codeEditorWidgetOptions, instantiationService, codeEditorService, commandService, contextKeyService, themeService, notificationService, accessibilityService, languageConfigurationService, languageFeaturesService, userInteractionService);
    this._parentEditor = parentEditor;
    this._overwriteOptions = options;
    super.updateOptions(this._overwriteOptions);
    this._register(parentEditor.onDidChangeConfiguration((e) => this._onParentConfigurationChanged(e)));
  }
  getParentEditor() {
    return this._parentEditor;
  }
  _onParentConfigurationChanged(e) {
    super.updateOptions(this._parentEditor.getRawOptions());
    super.updateOptions(this._overwriteOptions);
  }
  updateOptions(newOptions) {
    objects.mixin(this._overwriteOptions, newOptions, true);
    super.updateOptions(this._overwriteOptions);
  }
};
EmbeddedCodeEditorWidget = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICodeEditorService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IAccessibilityService),
  __decorateParam(11, ILanguageConfigurationService),
  __decorateParam(12, ILanguageFeaturesService),
  __decorateParam(13, IUserInteractionService)
], EmbeddedCodeEditorWidget);
function getOuterEditor(accessor) {
  const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
  if (editor instanceof EmbeddedCodeEditorWidget) {
    return editor.getParentEditor();
  }
  return editor;
}
export {
  EmbeddedCodeEditorWidget,
  getOuterEditor
};
