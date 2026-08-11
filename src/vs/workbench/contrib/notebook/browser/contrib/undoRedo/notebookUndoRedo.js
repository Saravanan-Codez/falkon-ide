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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../../../common/contributions.js";
import { CellKind } from "../../../common/notebookCommon.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { CellEditState, getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { RedoCommand, UndoCommand } from "../../../../../../editor/browser/editorExtensions.js";
let NotebookUndoRedoContribution = class extends Disposable {
  constructor(_editorService) {
    super();
    this._editorService = _editorService;
    const PRIORITY = 105;
    this._register(UndoCommand.addImplementation(PRIORITY, "notebook-undo-redo", () => {
      const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
      const viewModel = editor?.getViewModel();
      if (editor && editor.hasEditorFocus() && editor.hasModel() && viewModel) {
        return viewModel.undo().then((cellResources) => {
          if (cellResources?.length) {
            for (let i = 0; i < editor.getLength(); i++) {
              const cell = editor.cellAt(i);
              if (cell.cellKind === CellKind.Markup && cellResources.find((resource) => resource.fragment === cell.model.uri.fragment)) {
                cell.updateEditState(CellEditState.Editing, "undo");
              }
            }
            editor?.setOptions({ cellOptions: { resource: cellResources[0] }, preserveFocus: true });
          }
        });
      }
      return false;
    }));
    this._register(RedoCommand.addImplementation(PRIORITY, "notebook-undo-redo", () => {
      const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
      const viewModel = editor?.getViewModel();
      if (editor && editor.hasEditorFocus() && editor.hasModel() && viewModel) {
        return viewModel.redo().then((cellResources) => {
          if (cellResources?.length) {
            for (let i = 0; i < editor.getLength(); i++) {
              const cell = editor.cellAt(i);
              if (cell.cellKind === CellKind.Markup && cellResources.find((resource) => resource.fragment === cell.model.uri.fragment)) {
                cell.updateEditState(CellEditState.Editing, "redo");
              }
            }
            editor?.setOptions({ cellOptions: { resource: cellResources[0] }, preserveFocus: true });
          }
        });
      }
      return false;
    }));
  }
  static {
    this.ID = "workbench.contrib.notebookUndoRedo";
  }
};
NotebookUndoRedoContribution = __decorateClass([
  __decorateParam(0, IEditorService)
], NotebookUndoRedoContribution);
registerWorkbenchContribution2(NotebookUndoRedoContribution.ID, NotebookUndoRedoContribution, WorkbenchPhase.BlockRestore);
