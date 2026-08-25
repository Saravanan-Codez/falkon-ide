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
import { isCodeEditor, isDiffEditor, isCompositeEditor, getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { AbstractCodeEditorService } from "../../../../editor/browser/services/abstractCodeEditorService.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../common/editorService.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { applyTextEditorOptions } from "../../../common/editor/editorOptions.js";
let CodeEditorService = class extends AbstractCodeEditorService {
  constructor(editorService, themeService, configurationService) {
    super(themeService);
    this.editorService = editorService;
    this.configurationService = configurationService;
    this._register(this.registerCodeEditorOpenHandler(this.doOpenCodeEditor.bind(this)));
    this._register(this.registerCodeEditorOpenHandler(this.doOpenCodeEditorFromDiff.bind(this)));
  }
  getActiveCodeEditor() {
    const activeTextEditorControl = this.editorService.activeTextEditorControl;
    if (isCodeEditor(activeTextEditorControl)) {
      return activeTextEditorControl;
    }
    if (isDiffEditor(activeTextEditorControl)) {
      return activeTextEditorControl.getModifiedEditor();
    }
    const activeControl = this.editorService.activeEditorPane?.getControl();
    if (isCompositeEditor(activeControl) && isCodeEditor(activeControl.activeCodeEditor)) {
      return activeControl.activeCodeEditor;
    }
    return null;
  }
  async doOpenCodeEditorFromDiff(input, source, sideBySide) {
    const activeTextEditorControl = this.editorService.activeTextEditorControl;
    if (!sideBySide && // we need the current active group to be the target
    isDiffEditor(activeTextEditorControl) && // we only support this for active text diff editors
    input.options && // we need options to apply
    input.resource && // we need a request resource to compare with
    source === activeTextEditorControl.getModifiedEditor() && // we need the source of this request to be the modified side of the diff editor
    activeTextEditorControl.getModel() && // we need a target model to compare with
    isEqual(input.resource, activeTextEditorControl.getModel()?.modified.uri)) {
      const targetEditor = activeTextEditorControl.getModifiedEditor();
      applyTextEditorOptions(input.options, targetEditor, ScrollType.Smooth);
      return targetEditor;
    }
    return null;
  }
  // Open using our normal editor service
  async doOpenCodeEditor(input, source, sideBySide) {
    const enablePreviewFromCodeNavigation = this.configurationService.getValue().workbench?.editor?.enablePreviewFromCodeNavigation;
    if (!enablePreviewFromCodeNavigation && // we only need to do this if the configuration requires it
    source && // we need to know the origin of the navigation
    !input.options?.pinned && // we only need to look at preview editors that open
    !sideBySide && // we only need to care if editor opens in same group
    !isEqual(source.getModel()?.uri, input.resource)) {
      for (const visiblePane of this.editorService.visibleEditorPanes) {
        if (getCodeEditor(visiblePane.getControl()) === source) {
          visiblePane.group.pinEditor();
          break;
        }
      }
    }
    const control = await this.editorService.openEditor(input, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
    if (control) {
      const widget = control.getControl();
      if (isCodeEditor(widget)) {
        return widget;
      }
      if (isCompositeEditor(widget) && isCodeEditor(widget.activeCodeEditor)) {
        return widget.activeCodeEditor;
      }
    }
    return null;
  }
};
CodeEditorService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IThemeService),
  __decorateParam(2, IConfigurationService)
], CodeEditorService);
registerSingleton(ICodeEditorService, CodeEditorService, InstantiationType.Delayed);
export {
  CodeEditorService
};
