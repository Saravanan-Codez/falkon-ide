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
import { addDisposableListener, onDidRegisterWindow } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorAction, EditorContributionInstantiation, registerDiffEditorContribution, registerEditorAction, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { findDiffEditorContainingCodeEditor } from "../../../../editor/browser/widget/diffEditor/commands.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import * as nls from "../../../../nls.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
const transientWordWrapState = "transientWordWrapState";
const isWordWrapMinifiedKey = "isWordWrapMinified";
const isDominatedByLongLinesKey = "isDominatedByLongLines";
const CAN_TOGGLE_WORD_WRAP = new RawContextKey("canToggleWordWrap", false, true);
const EDITOR_WORD_WRAP = new RawContextKey("editorWordWrap", false, nls.localize("editorWordWrap", "Whether the editor is currently using word wrapping."));
function writeTransientState(model, state, codeEditorService) {
  codeEditorService.setTransientModelProperty(model, transientWordWrapState, state);
}
function readTransientState(model, codeEditorService) {
  return codeEditorService.getTransientModelProperty(model, transientWordWrapState);
}
const TOGGLE_WORD_WRAP_ID = "editor.action.toggleWordWrap";
class ToggleWordWrapAction extends EditorAction {
  constructor() {
    super({
      id: TOGGLE_WORD_WRAP_ID,
      label: nls.localize2("toggle.wordwrap", "View: Toggle Word Wrap"),
      precondition: void 0,
      kbOpts: {
        kbExpr: null,
        primary: KeyMod.Alt | KeyCode.KeyZ,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const instaService = accessor.get(IInstantiationService);
    if (!canToggleWordWrap(codeEditorService, editor)) {
      return;
    }
    const model = editor.getModel();
    const transientState = readTransientState(model, codeEditorService);
    let newState;
    if (transientState) {
      newState = null;
    } else {
      const actualWrappingInfo = editor.getOption(EditorOption.wrappingInfo);
      const wordWrapOverride = actualWrappingInfo.wrappingColumn === -1 ? "on" : "off";
      newState = { wordWrapOverride };
    }
    writeTransientState(model, newState, codeEditorService);
    const diffEditor = instaService.invokeFunction(findDiffEditorContainingCodeEditor, editor);
    if (diffEditor) {
      const originalEditor = diffEditor.getOriginalEditor();
      const modifiedEditor = diffEditor.getModifiedEditor();
      const otherEditor = originalEditor === editor ? modifiedEditor : originalEditor;
      if (canToggleWordWrap(codeEditorService, otherEditor)) {
        writeTransientState(otherEditor.getModel(), newState, codeEditorService);
        diffEditor.updateOptions({});
      }
    }
  }
}
let ToggleWordWrapController = class extends Disposable {
  constructor(_editor, _contextKeyService, _codeEditorService) {
    super();
    this._editor = _editor;
    this._contextKeyService = _contextKeyService;
    this._codeEditorService = _codeEditorService;
    const options = this._editor.getOptions();
    const wrappingInfo = options.get(EditorOption.wrappingInfo);
    const isWordWrapMinified = this._contextKeyService.createKey(isWordWrapMinifiedKey, wrappingInfo.isWordWrapMinified);
    const isDominatedByLongLines = this._contextKeyService.createKey(isDominatedByLongLinesKey, wrappingInfo.isDominatedByLongLines);
    let currentlyApplyingEditorConfig = false;
    this._register(_editor.onDidChangeConfiguration((e) => {
      if (!e.hasChanged(EditorOption.wrappingInfo)) {
        return;
      }
      const options2 = this._editor.getOptions();
      const wrappingInfo2 = options2.get(EditorOption.wrappingInfo);
      isWordWrapMinified.set(wrappingInfo2.isWordWrapMinified);
      isDominatedByLongLines.set(wrappingInfo2.isDominatedByLongLines);
      if (!currentlyApplyingEditorConfig) {
        ensureWordWrapSettings();
      }
    }));
    this._register(_editor.onDidChangeModel((e) => {
      ensureWordWrapSettings();
    }));
    this._register(_codeEditorService.onDidChangeTransientModelProperty(() => {
      ensureWordWrapSettings();
    }));
    const ensureWordWrapSettings = () => {
      if (!canToggleWordWrap(this._codeEditorService, this._editor)) {
        return;
      }
      const transientState = readTransientState(this._editor.getModel(), this._codeEditorService);
      try {
        currentlyApplyingEditorConfig = true;
        this._applyWordWrapState(transientState);
      } finally {
        currentlyApplyingEditorConfig = false;
      }
    };
  }
  static {
    this.ID = "editor.contrib.toggleWordWrapController";
  }
  _applyWordWrapState(state) {
    const wordWrapOverride2 = state ? state.wordWrapOverride : "inherit";
    this._editor.updateOptions({
      wordWrapOverride2
    });
  }
};
ToggleWordWrapController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ICodeEditorService)
], ToggleWordWrapController);
let DiffToggleWordWrapController = class extends Disposable {
  constructor(_diffEditor, _codeEditorService) {
    super();
    this._diffEditor = _diffEditor;
    this._codeEditorService = _codeEditorService;
    this._register(this._diffEditor.onDidChangeModel(() => {
      this._ensureSyncedWordWrapToggle();
    }));
  }
  static {
    this.ID = "diffeditor.contrib.toggleWordWrapController";
  }
  _ensureSyncedWordWrapToggle() {
    const originalEditor = this._diffEditor.getOriginalEditor();
    const modifiedEditor = this._diffEditor.getModifiedEditor();
    if (!originalEditor.hasModel() || !modifiedEditor.hasModel()) {
      return;
    }
    const originalTransientState = readTransientState(originalEditor.getModel(), this._codeEditorService);
    const modifiedTransientState = readTransientState(modifiedEditor.getModel(), this._codeEditorService);
    if (originalTransientState && !modifiedTransientState && canToggleWordWrap(this._codeEditorService, originalEditor)) {
      writeTransientState(modifiedEditor.getModel(), originalTransientState, this._codeEditorService);
      this._diffEditor.updateOptions({});
    }
    if (!originalTransientState && modifiedTransientState && canToggleWordWrap(this._codeEditorService, modifiedEditor)) {
      writeTransientState(originalEditor.getModel(), modifiedTransientState, this._codeEditorService);
      this._diffEditor.updateOptions({});
    }
  }
};
DiffToggleWordWrapController = __decorateClass([
  __decorateParam(1, ICodeEditorService)
], DiffToggleWordWrapController);
function canToggleWordWrap(codeEditorService, editor) {
  if (!editor) {
    return false;
  }
  if (editor.isSimpleWidget) {
    return false;
  }
  const model = editor.getModel();
  if (!model) {
    return false;
  }
  if (editor.getOption(EditorOption.inDiffEditor)) {
    for (const diffEditor of codeEditorService.listDiffEditors()) {
      if (diffEditor.getOriginalEditor() === editor && !diffEditor.renderSideBySide) {
        return false;
      }
    }
  }
  return true;
}
let EditorWordWrapContextKeyTracker = class extends Disposable {
  constructor(_editorService, _codeEditorService, _contextService) {
    super();
    this._editorService = _editorService;
    this._codeEditorService = _codeEditorService;
    this._contextService = _contextService;
    this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
      disposables.add(addDisposableListener(window, "focus", () => this._update(), true));
      disposables.add(addDisposableListener(window, "blur", () => this._update(), true));
    }, { window: mainWindow, disposables: this._store }));
    this._register(this._editorService.onDidActiveEditorChange(() => this._update()));
    this._canToggleWordWrap = CAN_TOGGLE_WORD_WRAP.bindTo(this._contextService);
    this._editorWordWrap = EDITOR_WORD_WRAP.bindTo(this._contextService);
    this._activeEditor = null;
    this._activeEditorListener = this._register(new DisposableStore());
    this._update();
  }
  static {
    this.ID = "workbench.contrib.editorWordWrapContextKeyTracker";
  }
  _update() {
    const activeEditor = this._codeEditorService.getFocusedCodeEditor() || this._codeEditorService.getActiveCodeEditor();
    if (this._activeEditor === activeEditor) {
      return;
    }
    this._activeEditorListener.clear();
    this._activeEditor = activeEditor;
    if (activeEditor) {
      this._activeEditorListener.add(activeEditor.onDidChangeModel(() => this._updateFromCodeEditor()));
      this._activeEditorListener.add(activeEditor.onDidChangeConfiguration((e) => {
        if (e.hasChanged(EditorOption.wrappingInfo)) {
          this._updateFromCodeEditor();
        }
      }));
      this._updateFromCodeEditor();
    }
  }
  _updateFromCodeEditor() {
    if (!canToggleWordWrap(this._codeEditorService, this._activeEditor)) {
      return this._setValues(false, false);
    } else {
      const wrappingInfo = this._activeEditor.getOption(EditorOption.wrappingInfo);
      this._setValues(true, wrappingInfo.wrappingColumn !== -1);
    }
  }
  _setValues(canToggleWordWrap2, isWordWrap) {
    this._canToggleWordWrap.set(canToggleWordWrap2);
    this._editorWordWrap.set(isWordWrap);
  }
};
EditorWordWrapContextKeyTracker = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, IContextKeyService)
], EditorWordWrapContextKeyTracker);
registerWorkbenchContribution2(EditorWordWrapContextKeyTracker.ID, EditorWordWrapContextKeyTracker, WorkbenchPhase.AfterRestored);
registerEditorContribution(ToggleWordWrapController.ID, ToggleWordWrapController, EditorContributionInstantiation.Eager);
registerDiffEditorContribution(DiffToggleWordWrapController.ID, DiffToggleWordWrapController);
registerEditorAction(ToggleWordWrapAction);
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
  command: {
    id: TOGGLE_WORD_WRAP_ID,
    title: nls.localize("unwrapMinified", "Disable wrapping for this file"),
    icon: Codicon.wordWrap
  },
  group: "navigation",
  order: 1,
  when: ContextKeyExpr.and(
    ContextKeyExpr.has(isDominatedByLongLinesKey),
    ContextKeyExpr.has(isWordWrapMinifiedKey)
  )
});
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
  command: {
    id: TOGGLE_WORD_WRAP_ID,
    title: nls.localize("wrapMinified", "Enable wrapping for this file"),
    icon: Codicon.wordWrap
  },
  group: "navigation",
  order: 1,
  when: ContextKeyExpr.and(
    EditorContextKeys.inDiffEditor.negate(),
    ContextKeyExpr.has(isDominatedByLongLinesKey),
    ContextKeyExpr.not(isWordWrapMinifiedKey)
  )
});
MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
  command: {
    id: TOGGLE_WORD_WRAP_ID,
    title: nls.localize({ key: "miToggleWordWrap", comment: ["&& denotes a mnemonic"] }, "&&Word Wrap"),
    toggled: EDITOR_WORD_WRAP,
    precondition: CAN_TOGGLE_WORD_WRAP
  },
  order: 1,
  group: "6_editor"
});
export {
  readTransientState,
  writeTransientState
};
