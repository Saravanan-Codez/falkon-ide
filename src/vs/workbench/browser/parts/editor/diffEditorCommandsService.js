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
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ActiveCustomEditorDiffCanToggleLayoutContext } from "../../../common/contextkeys.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { EditorResourceAccessor, isDiffEditorInput, SideBySideEditor } from "../../../common/editor.js";
import { TextDiffEditor } from "./textDiffEditor.js";
const IDiffEditorCommandsService = createDecorator("diffEditorCommandsService");
var FocusTextDiffEditorMode = /* @__PURE__ */ ((FocusTextDiffEditorMode2) => {
  FocusTextDiffEditorMode2[FocusTextDiffEditorMode2["Original"] = 0] = "Original";
  FocusTextDiffEditorMode2[FocusTextDiffEditorMode2["Modified"] = 1] = "Modified";
  FocusTextDiffEditorMode2[FocusTextDiffEditorMode2["Toggle"] = 2] = "Toggle";
  return FocusTextDiffEditorMode2;
})(FocusTextDiffEditorMode || {});
let DiffEditorCommandsService = class {
  constructor(editorService, textResourceConfigurationService, contextKeyService) {
    this.editorService = editorService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.contextKeyService = contextKeyService;
  }
  async toggleRenderSideBySide(args) {
    const modifiedResource = this.getActiveDiffModifiedResource(args);
    if (!modifiedResource) {
      return;
    }
    const key = "diffEditor.renderSideBySide";
    const value = this.textResourceConfigurationService.getValue(modifiedResource, key);
    await this.textResourceConfigurationService.updateValue(modifiedResource, key, !value);
  }
  async openActiveDiffSide() {
    const activeEditor = this.editorService.activeEditor;
    const activeTextEditorControl = this.editorService.activeTextEditorControl;
    if (!isDiffEditor(activeTextEditorControl) || !(activeEditor instanceof DiffEditorInput)) {
      return;
    }
    let editor;
    const originalEditor = activeTextEditorControl.getOriginalEditor();
    if (originalEditor.hasTextFocus()) {
      editor = activeEditor.original;
    } else {
      editor = activeEditor.modified;
    }
    await this.editorService.openEditor(editor);
  }
  navigateInDiffEditor(args, next) {
    const activeTextDiffEditor = this.getActiveTextDiffEditor(args);
    if (activeTextDiffEditor) {
      activeTextDiffEditor.getControl()?.goToDiff(next ? "next" : "previous");
    }
  }
  focusInDiffEditor(args, mode) {
    const activeTextDiffEditor = this.getActiveTextDiffEditor(args);
    if (activeTextDiffEditor) {
      switch (mode) {
        case 0 /* Original */:
          activeTextDiffEditor.getControl()?.getOriginalEditor().focus();
          break;
        case 1 /* Modified */:
          activeTextDiffEditor.getControl()?.getModifiedEditor().focus();
          break;
        case 2 /* Toggle */:
          if (activeTextDiffEditor.getControl()?.getModifiedEditor().hasWidgetFocus()) {
            return this.focusInDiffEditor(args, 0 /* Original */);
          } else {
            return this.focusInDiffEditor(args, 1 /* Modified */);
          }
      }
    }
  }
  async toggleDiffIgnoreTrimWhitespace(args) {
    const activeTextDiffEditor = this.getActiveTextDiffEditor(args);
    const model = activeTextDiffEditor?.getControl()?.getModifiedEditor()?.getModel();
    if (!model) {
      return;
    }
    const key = "diffEditor.ignoreTrimWhitespace";
    const value = this.textResourceConfigurationService.getValue(model.uri, key);
    await this.textResourceConfigurationService.updateValue(model.uri, key, !value);
  }
  async swapDiffSides(args) {
    const diffEditor = this.getActiveTextDiffEditor(args);
    const activeGroup = diffEditor?.group;
    const diffInput = diffEditor?.input;
    if (!diffEditor || typeof activeGroup === "undefined" || !(diffInput instanceof DiffEditorInput) || !diffInput.modified.resource) {
      return;
    }
    const untypedDiffInput = diffInput.toUntyped({ preserveViewState: activeGroup.id, preserveResource: true });
    if (!untypedDiffInput) {
      return;
    }
    if (diffInput.modified.isModified() && this.editorService.findEditors({ resource: diffInput.modified.resource, typeId: diffInput.modified.typeId, editorId: diffInput.modified.editorId }).length === 0) {
      const editorToOpen = { ...untypedDiffInput.modified };
      if (!editorToOpen.options) {
        editorToOpen.options = {};
      }
      editorToOpen.options.pinned = true;
      editorToOpen.options.inactive = true;
      await this.editorService.openEditor(editorToOpen, activeGroup);
    }
    await this.editorService.replaceEditors([
      {
        editor: diffInput,
        replacement: {
          ...untypedDiffInput,
          original: untypedDiffInput.modified,
          modified: untypedDiffInput.original,
          options: {
            ...untypedDiffInput.options,
            pinned: true
          }
        }
      }
    ], activeGroup);
  }
  getActiveTextDiffEditor(args) {
    const resource = args.length > 0 && args[0] instanceof URI ? args[0] : void 0;
    for (const editor of [this.editorService.activeEditorPane, ...this.editorService.visibleEditorPanes]) {
      if (editor instanceof TextDiffEditor && (!resource || editor.input instanceof DiffEditorInput && isEqual(editor.input.primary.resource, resource))) {
        return editor;
      }
    }
    return void 0;
  }
  getActiveDiffModifiedResource(args) {
    const activeTextDiffEditor = this.getActiveTextDiffEditor(args);
    const model = activeTextDiffEditor?.getControl()?.getModifiedEditor()?.getModel();
    if (model) {
      return model.uri;
    }
    const resource = args.length > 0 && args[0] instanceof URI ? args[0] : void 0;
    if (ActiveCustomEditorDiffCanToggleLayoutContext.getValue(this.contextKeyService)) {
      const activeCustomDiffModifiedResource = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
      if (activeCustomDiffModifiedResource && (!resource || isEqual(activeCustomDiffModifiedResource, resource))) {
        return activeCustomDiffModifiedResource;
      }
    }
    for (const editor of [this.editorService.activeEditor, ...this.editorService.visibleEditors]) {
      if (isDiffEditorInput(editor) && editor.modified.resource && (!resource || isEqual(editor.modified.resource, resource))) {
        return editor.modified.resource;
      }
    }
    return void 0;
  }
};
DiffEditorCommandsService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ITextResourceConfigurationService),
  __decorateParam(2, IContextKeyService)
], DiffEditorCommandsService);
export {
  DiffEditorCommandsService,
  FocusTextDiffEditorMode,
  IDiffEditorCommandsService
};
