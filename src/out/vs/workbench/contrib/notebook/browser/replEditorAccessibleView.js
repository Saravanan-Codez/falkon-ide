import { AccessibleViewType, AccessibleContentProvider, AccessibleViewProviderId } from "../../../../platform/accessibility/browser/accessibleView.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { isReplEditorControl } from "../../replNotebook/browser/replEditor.js";
import { IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_LIST_FOCUSED } from "../common/notebookContextKeys.js";
import { getAllOutputsText } from "./viewModel/cellOutputTextHelper.js";
class ReplEditorAccessibleView {
  constructor() {
    this.priority = 100;
    this.name = "replEditorInput";
    this.type = AccessibleViewType.View;
    this.when = ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_LIST_FOCUSED.negate());
  }
  getProvider(accessor) {
    const editorService = accessor.get(IEditorService);
    return getAccessibleOutputProvider(editorService);
  }
}
function getAccessibleOutputProvider(editorService) {
  const editorControl = editorService.activeEditorPane?.getControl();
  if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
    const notebookEditor = editorControl.notebookEditor;
    const viewModel = notebookEditor?.getViewModel();
    if (notebookEditor && viewModel) {
      const lastCellIndex = viewModel.length - 1;
      if (lastCellIndex >= 0) {
        const cell = viewModel.viewCells[lastCellIndex];
        const outputContent = getAllOutputsText(viewModel.notebookDocument, cell);
        if (outputContent) {
          return new AccessibleContentProvider(
            AccessibleViewProviderId.Notebook,
            { type: AccessibleViewType.View },
            () => {
              return outputContent;
            },
            () => {
              editorControl.activeCodeEditor?.focus();
            },
            AccessibilityVerbositySettingId.ReplEditor
          );
        }
      }
    }
  }
  return;
}
export {
  ReplEditorAccessibleView,
  getAccessibleOutputProvider
};
