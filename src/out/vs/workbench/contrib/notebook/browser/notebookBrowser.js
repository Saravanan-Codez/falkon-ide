import { NOTEBOOK_EDITOR_ID, NOTEBOOK_DIFF_EDITOR_ID } from "../common/notebookCommon.js";
import { isCompositeNotebookEditorInput } from "../common/notebookEditorInput.js";
import { cellRangesToIndexes, reduceCellRanges } from "../common/notebookRange.js";
const EXPAND_CELL_INPUT_COMMAND_ID = "notebook.cell.expandCellInput";
const EXECUTE_CELL_COMMAND_ID = "notebook.cell.execute";
const DETECT_CELL_LANGUAGE = "notebook.cell.detectLanguage";
const CHANGE_CELL_LANGUAGE = "notebook.cell.changeLanguage";
const QUIT_EDIT_CELL_COMMAND_ID = "notebook.cell.quitEdit";
const EXPAND_CELL_OUTPUT_COMMAND_ID = "notebook.cell.expandCellOutput";
const IPYNB_VIEW_TYPE = "jupyter-notebook";
const JUPYTER_EXTENSION_ID = "ms-toolsai.jupyter";
const KERNEL_EXTENSIONS = /* @__PURE__ */ new Map([
  [IPYNB_VIEW_TYPE, JUPYTER_EXTENSION_ID]
]);
const KERNEL_RECOMMENDATIONS = /* @__PURE__ */ new Map();
KERNEL_RECOMMENDATIONS.set(IPYNB_VIEW_TYPE, /* @__PURE__ */ new Map());
KERNEL_RECOMMENDATIONS.get(IPYNB_VIEW_TYPE)?.set("python", {
  extensionIds: [
    "ms-python.python",
    JUPYTER_EXTENSION_ID
  ],
  displayName: "Python + Jupyter"
});
var RenderOutputType = /* @__PURE__ */ ((RenderOutputType2) => {
  RenderOutputType2[RenderOutputType2["Html"] = 0] = "Html";
  RenderOutputType2[RenderOutputType2["Extension"] = 1] = "Extension";
  return RenderOutputType2;
})(RenderOutputType || {});
var ScrollToRevealBehavior = /* @__PURE__ */ ((ScrollToRevealBehavior2) => {
  ScrollToRevealBehavior2[ScrollToRevealBehavior2["fullCell"] = 0] = "fullCell";
  ScrollToRevealBehavior2[ScrollToRevealBehavior2["firstLine"] = 1] = "firstLine";
  return ScrollToRevealBehavior2;
})(ScrollToRevealBehavior || {});
var CellLayoutState = /* @__PURE__ */ ((CellLayoutState2) => {
  CellLayoutState2[CellLayoutState2["Uninitialized"] = 0] = "Uninitialized";
  CellLayoutState2[CellLayoutState2["Estimated"] = 1] = "Estimated";
  CellLayoutState2[CellLayoutState2["FromCache"] = 2] = "FromCache";
  CellLayoutState2[CellLayoutState2["Measured"] = 3] = "Measured";
  return CellLayoutState2;
})(CellLayoutState || {});
var CellLayoutContext = /* @__PURE__ */ ((CellLayoutContext2) => {
  CellLayoutContext2[CellLayoutContext2["Fold"] = 0] = "Fold";
  return CellLayoutContext2;
})(CellLayoutContext || {});
var NotebookOverviewRulerLane = /* @__PURE__ */ ((NotebookOverviewRulerLane2) => {
  NotebookOverviewRulerLane2[NotebookOverviewRulerLane2["Left"] = 1] = "Left";
  NotebookOverviewRulerLane2[NotebookOverviewRulerLane2["Center"] = 2] = "Center";
  NotebookOverviewRulerLane2[NotebookOverviewRulerLane2["Right"] = 4] = "Right";
  NotebookOverviewRulerLane2[NotebookOverviewRulerLane2["Full"] = 7] = "Full";
  return NotebookOverviewRulerLane2;
})(NotebookOverviewRulerLane || {});
function isNotebookCellDecoration(obj) {
  return !!obj && typeof obj.handle === "number";
}
function isNotebookViewZoneDecoration(obj) {
  return !!obj && typeof obj.viewZoneId === "string";
}
var CellRevealType = /* @__PURE__ */ ((CellRevealType2) => {
  CellRevealType2[CellRevealType2["Default"] = 1] = "Default";
  CellRevealType2[CellRevealType2["Top"] = 2] = "Top";
  CellRevealType2[CellRevealType2["Center"] = 3] = "Center";
  CellRevealType2[CellRevealType2["CenterIfOutsideViewport"] = 4] = "CenterIfOutsideViewport";
  CellRevealType2[CellRevealType2["NearTopIfOutsideViewport"] = 5] = "NearTopIfOutsideViewport";
  CellRevealType2[CellRevealType2["FirstLineIfOutsideViewport"] = 6] = "FirstLineIfOutsideViewport";
  return CellRevealType2;
})(CellRevealType || {});
var CellRevealRangeType = /* @__PURE__ */ ((CellRevealRangeType2) => {
  CellRevealRangeType2[CellRevealRangeType2["Default"] = 1] = "Default";
  CellRevealRangeType2[CellRevealRangeType2["Center"] = 2] = "Center";
  CellRevealRangeType2[CellRevealRangeType2["CenterIfOutsideViewport"] = 3] = "CenterIfOutsideViewport";
  return CellRevealRangeType2;
})(CellRevealRangeType || {});
var CellEditState = /* @__PURE__ */ ((CellEditState2) => {
  CellEditState2[CellEditState2["Preview"] = 0] = "Preview";
  CellEditState2[CellEditState2["Editing"] = 1] = "Editing";
  return CellEditState2;
})(CellEditState || {});
var CellFocusMode = /* @__PURE__ */ ((CellFocusMode2) => {
  CellFocusMode2[CellFocusMode2["Container"] = 0] = "Container";
  CellFocusMode2[CellFocusMode2["Editor"] = 1] = "Editor";
  CellFocusMode2[CellFocusMode2["Output"] = 2] = "Output";
  CellFocusMode2[CellFocusMode2["ChatInput"] = 3] = "ChatInput";
  return CellFocusMode2;
})(CellFocusMode || {});
var CursorAtBoundary = /* @__PURE__ */ ((CursorAtBoundary2) => {
  CursorAtBoundary2[CursorAtBoundary2["None"] = 0] = "None";
  CursorAtBoundary2[CursorAtBoundary2["Top"] = 1] = "Top";
  CursorAtBoundary2[CursorAtBoundary2["Bottom"] = 2] = "Bottom";
  CursorAtBoundary2[CursorAtBoundary2["Both"] = 3] = "Both";
  return CursorAtBoundary2;
})(CursorAtBoundary || {});
var CursorAtLineBoundary = /* @__PURE__ */ ((CursorAtLineBoundary2) => {
  CursorAtLineBoundary2[CursorAtLineBoundary2["None"] = 0] = "None";
  CursorAtLineBoundary2[CursorAtLineBoundary2["Start"] = 1] = "Start";
  CursorAtLineBoundary2[CursorAtLineBoundary2["End"] = 2] = "End";
  CursorAtLineBoundary2[CursorAtLineBoundary2["Both"] = 3] = "Both";
  return CursorAtLineBoundary2;
})(CursorAtLineBoundary || {});
function getNotebookEditorFromEditorPane(editorPane) {
  if (!editorPane) {
    return;
  }
  if (editorPane.getId() === NOTEBOOK_EDITOR_ID) {
    return editorPane.getControl();
  }
  if (editorPane.getId() === NOTEBOOK_DIFF_EDITOR_ID) {
    return editorPane.getControl().inlineNotebookEditor;
  }
  const input = editorPane.input;
  const isCompositeNotebook = input && isCompositeNotebookEditorInput(input);
  if (isCompositeNotebook) {
    return editorPane.getControl()?.notebookEditor;
  }
  return void 0;
}
function expandCellRangesWithHiddenCells(editor, ranges) {
  const indexes = cellRangesToIndexes(ranges);
  const modelRanges = [];
  indexes.forEach((index) => {
    const viewCell = editor.cellAt(index);
    if (!viewCell) {
      return;
    }
    const viewIndex = editor.getViewIndexByModelIndex(index);
    if (viewIndex < 0) {
      return;
    }
    const nextViewIndex = viewIndex + 1;
    const range = editor.getCellRangeFromViewRange(viewIndex, nextViewIndex);
    if (range) {
      modelRanges.push(range);
    }
  });
  return reduceCellRanges(modelRanges);
}
function cellRangeToViewCells(editor, ranges) {
  const cells = [];
  reduceCellRanges(ranges).forEach((range) => {
    cells.push(...editor.getCellsInRange(range));
  });
  return cells;
}
var CellFoldingState = /* @__PURE__ */ ((CellFoldingState2) => {
  CellFoldingState2[CellFoldingState2["None"] = 0] = "None";
  CellFoldingState2[CellFoldingState2["Expanded"] = 1] = "Expanded";
  CellFoldingState2[CellFoldingState2["Collapsed"] = 2] = "Collapsed";
  return CellFoldingState2;
})(CellFoldingState || {});
export {
  CHANGE_CELL_LANGUAGE,
  CellEditState,
  CellFocusMode,
  CellFoldingState,
  CellLayoutContext,
  CellLayoutState,
  CellRevealRangeType,
  CellRevealType,
  CursorAtBoundary,
  CursorAtLineBoundary,
  DETECT_CELL_LANGUAGE,
  EXECUTE_CELL_COMMAND_ID,
  EXPAND_CELL_INPUT_COMMAND_ID,
  EXPAND_CELL_OUTPUT_COMMAND_ID,
  IPYNB_VIEW_TYPE,
  JUPYTER_EXTENSION_ID,
  KERNEL_EXTENSIONS,
  KERNEL_RECOMMENDATIONS,
  NotebookOverviewRulerLane,
  QUIT_EDIT_CELL_COMMAND_ID,
  RenderOutputType,
  ScrollToRevealBehavior,
  cellRangeToViewCells,
  expandCellRangesWithHiddenCells,
  getNotebookEditorFromEditorPane,
  isNotebookCellDecoration,
  isNotebookViewZoneDecoration
};
