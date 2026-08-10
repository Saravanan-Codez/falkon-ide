import "./media/notebookFind.css";
import { KeyCode, KeyMod } from "../../../../../../base/common/keyCodes.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { ICodeEditorService } from "../../../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../../../editor/common/config/editorOptions.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { FindStartFocusAction, getSelectionSearchString, NextMatchFindAction, PreviousMatchFindAction, StartFindAction, StartFindReplaceAction } from "../../../../../../editor/contrib/find/browser/findController.js";
import { localize2 } from "../../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { NotebookFindContrib } from "./notebookFindWidget.js";
import { NotebookMultiCellAction } from "../../controller/coreActions.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { CellUri, NotebookFindScopeType } from "../../../common/notebookCommon.js";
import { INTERACTIVE_WINDOW_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from "../../../common/notebookContextKeys.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { CONTEXT_FIND_WIDGET_VISIBLE } from "../../../../../../editor/contrib/find/browser/findModel.js";
registerNotebookContribution(NotebookFindContrib.id, NotebookFindContrib);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.hideFind",
      title: localize2("notebookActions.hideFind", "Hide Find in Notebook"),
      keybinding: {
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_FIND_WIDGET_VISIBLE),
        primary: KeyCode.Escape,
        weight: KeybindingWeight.EditorContrib + 5
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    const controller = editor.getContribution(NotebookFindContrib.id);
    controller.hide();
    editor.focus();
  }
});
registerAction2(class extends NotebookMultiCellAction {
  constructor() {
    super({
      id: "notebook.find",
      title: localize2("notebookActions.findInNotebook", "Find in Notebook"),
      keybinding: {
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.or(NOTEBOOK_IS_ACTIVE_EDITOR, INTERACTIVE_WINDOW_IS_ACTIVE_EDITOR), EditorContextKeys.focus.toNegated()),
        primary: KeyCode.KeyF | KeyMod.CtrlCmd,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    const controller = editor.getContribution(NotebookFindContrib.id);
    controller.show(void 0, { findScope: { findScopeType: NotebookFindScopeType.None } });
  }
});
function notebookContainsTextModel(uri, textModel) {
  if (textModel.uri.scheme === Schemas.vscodeNotebookCell) {
    const cellUri = CellUri.parse(textModel.uri);
    if (cellUri && isEqual(cellUri.notebook, uri)) {
      return true;
    }
  }
  return false;
}
function getSearchStringOptions(editor, opts) {
  if (opts.seedSearchStringFromSelection === "single") {
    const selectionSearchString = getSelectionSearchString(editor, opts.seedSearchStringFromSelection, opts.seedSearchStringFromNonEmptySelection);
    if (selectionSearchString) {
      return {
        searchString: selectionSearchString,
        selection: editor.getSelection()
      };
    }
  } else if (opts.seedSearchStringFromSelection === "multiple" && !opts.updateSearchScope) {
    const selectionSearchString = getSelectionSearchString(editor, opts.seedSearchStringFromSelection);
    if (selectionSearchString) {
      return {
        searchString: selectionSearchString,
        selection: editor.getSelection()
      };
    }
  }
  return void 0;
}
function isNotebookEditorValidForSearch(accessor, editor, codeEditor) {
  if (!editor) {
    return false;
  }
  if (!codeEditor.hasModel()) {
    return false;
  }
  if (!editor.hasEditorFocus() && !editor.hasWebviewFocus()) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const textEditor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
    if (editor.hasModel() && textEditor && textEditor.hasModel() && notebookContainsTextModel(editor.textModel.uri, textEditor.getModel())) {
      return true;
    } else {
      return false;
    }
  }
  return true;
}
function openFindWidget(controller, editor, codeEditor, focusWidget = true) {
  if (!editor || !codeEditor || !controller) {
    return false;
  }
  if (!codeEditor.hasModel()) {
    return false;
  }
  const searchStringOptions = getSearchStringOptions(codeEditor, {
    forceRevealReplace: false,
    seedSearchStringFromSelection: codeEditor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
    seedSearchStringFromNonEmptySelection: codeEditor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
    seedSearchStringFromGlobalClipboard: codeEditor.getOption(EditorOption.find).globalFindClipboard,
    shouldFocus: FindStartFocusAction.FocusFindInput,
    shouldAnimate: true,
    updateSearchScope: false,
    loop: codeEditor.getOption(EditorOption.find).loop
  });
  let options = void 0;
  const uri = codeEditor.getModel().uri;
  const data = CellUri.parse(uri);
  if (searchStringOptions?.selection && data) {
    const cell = editor.getCellByHandle(data.handle);
    if (cell) {
      options = {
        searchStringSeededFrom: { cell, range: searchStringOptions.selection },
        focus: focusWidget
      };
    }
  } else {
    options = { focus: focusWidget };
  }
  controller.show(searchStringOptions?.searchString, options);
  return true;
}
function findWidgetAction(accessor, codeEditor, next) {
  const editorService = accessor.get(IEditorService);
  const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  if (!isNotebookEditorValidForSearch(accessor, editor, codeEditor)) {
    return false;
  }
  const controller = editor?.getContribution(NotebookFindContrib.id);
  if (!controller) {
    return false;
  }
  if (controller.isVisible()) {
    next ? controller.findNext() : controller.findPrevious();
    return true;
  } else {
    return openFindWidget(controller, editor, codeEditor, false);
  }
}
async function runFind(accessor, next) {
  const editorService = accessor.get(IEditorService);
  const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  if (!editor) {
    return;
  }
  const controller = editor.getContribution(NotebookFindContrib.id);
  if (controller && controller.isVisible()) {
    next ? controller.findNext() : controller.findPrevious();
  }
}
StartFindAction.addImplementation(100, (accessor, codeEditor, args) => {
  const editorService = accessor.get(IEditorService);
  const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  if (!isNotebookEditorValidForSearch(accessor, editor, codeEditor)) {
    return false;
  }
  const controller = editor?.getContribution(NotebookFindContrib.id);
  return openFindWidget(controller, editor, codeEditor, true);
});
StartFindReplaceAction.addImplementation(100, (accessor, codeEditor, args) => {
  const editorService = accessor.get(IEditorService);
  const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  if (!editor) {
    return false;
  }
  if (!codeEditor.hasModel()) {
    return false;
  }
  const controller = editor.getContribution(NotebookFindContrib.id);
  const searchStringOptions = getSearchStringOptions(codeEditor, {
    forceRevealReplace: false,
    seedSearchStringFromSelection: codeEditor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
    seedSearchStringFromNonEmptySelection: codeEditor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
    seedSearchStringFromGlobalClipboard: codeEditor.getOption(EditorOption.find).globalFindClipboard,
    shouldFocus: FindStartFocusAction.FocusFindInput,
    shouldAnimate: true,
    updateSearchScope: false,
    loop: codeEditor.getOption(EditorOption.find).loop
  });
  if (controller) {
    controller.replace(searchStringOptions?.searchString);
    return true;
  }
  return false;
});
NextMatchFindAction.addImplementation(100, (accessor, codeEditor, args) => {
  return findWidgetAction(accessor, codeEditor, true);
});
PreviousMatchFindAction.addImplementation(100, (accessor, codeEditor, args) => {
  return findWidgetAction(accessor, codeEditor, false);
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.findNext.fromWidget",
      title: localize2("notebook.findNext.fromWidget", "Find Next"),
      keybinding: {
        when: ContextKeyExpr.and(
          NOTEBOOK_EDITOR_FOCUSED,
          CONTEXT_FIND_WIDGET_VISIBLE
        ),
        primary: KeyCode.F3,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyG, secondary: [KeyCode.F3] },
        weight: KeybindingWeight.WorkbenchContrib + 1
      }
    });
  }
  async run(accessor) {
    return runFind(accessor, true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.findPrevious.fromWidget",
      title: localize2("notebook.findPrevious.fromWidget", "Find Previous"),
      keybinding: {
        when: ContextKeyExpr.and(
          NOTEBOOK_EDITOR_FOCUSED,
          CONTEXT_FIND_WIDGET_VISIBLE
        ),
        primary: KeyMod.Shift | KeyCode.F3,
        mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG, secondary: [KeyMod.Shift | KeyCode.F3] },
        weight: KeybindingWeight.WorkbenchContrib + 1
      }
    });
  }
  async run(accessor) {
    return runFind(accessor, false);
  }
});
