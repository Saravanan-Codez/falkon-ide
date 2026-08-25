import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider } from "../../../../platform/accessibility/browser/accessibleView.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { getNotebookEditorFromEditorPane } from "./notebookBrowser.js";
import { NOTEBOOK_CELL_LIST_FOCUSED } from "../common/notebookContextKeys.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { InputFocusedContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { getAllOutputsText } from "./viewModel/cellOutputTextHelper.js";
class NotebookAccessibleView {
  constructor() {
    this.priority = 100;
    this.name = "notebook";
    this.type = AccessibleViewType.View;
    this.when = ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, InputFocusedContext.toNegated());
  }
  getProvider(accessor) {
    const editorService = accessor.get(IEditorService);
    return getAccessibleOutputProvider(editorService);
  }
}
function getAccessibleOutputProvider(editorService) {
  const activePane = editorService.activeEditorPane;
  const notebookEditor = getNotebookEditorFromEditorPane(activePane);
  const notebookViewModel = notebookEditor?.getViewModel();
  const selections = notebookViewModel?.getSelections();
  const notebookDocument = notebookViewModel?.notebookDocument;
  if (!selections || !notebookDocument || !notebookEditor?.textModel) {
    return;
  }
  const viewCell = notebookViewModel.viewCells[selections[0].start];
  const outputContent = getAllOutputsText(notebookDocument, viewCell);
  if (!outputContent) {
    return;
  }
  return new AccessibleContentProvider(
    AccessibleViewProviderId.Notebook,
    { type: AccessibleViewType.View },
    () => {
      return outputContent;
    },
    () => {
      notebookEditor?.setFocus(selections[0]);
      notebookEditor.focus();
    },
    AccessibilityVerbositySettingId.Notebook
  );
}
export {
  NotebookAccessibleView,
  getAccessibleOutputProvider
};
