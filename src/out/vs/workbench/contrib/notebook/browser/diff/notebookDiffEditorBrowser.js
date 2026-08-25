import { RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { localize } from "../../../../../nls.js";
var DiffSide = /* @__PURE__ */ ((DiffSide2) => {
  DiffSide2[DiffSide2["Original"] = 0] = "Original";
  DiffSide2[DiffSide2["Modified"] = 1] = "Modified";
  return DiffSide2;
})(DiffSide || {});
const DIFF_CELL_MARGIN = 16;
const NOTEBOOK_DIFF_CELL_INPUT = new RawContextKey("notebook.diffEditor.cell.inputChanged", false);
const NOTEBOOK_DIFF_METADATA = new RawContextKey("notebook.diffEditor.metadataChanged", false);
const NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE_KEY = "notebook.diffEditor.cell.ignoreWhitespace";
const NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE = new RawContextKey(NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE_KEY, false);
const NOTEBOOK_DIFF_CELL_PROPERTY = new RawContextKey("notebook.diffEditor.cell.property.changed", false);
const NOTEBOOK_DIFF_CELL_PROPERTY_EXPANDED = new RawContextKey("notebook.diffEditor.cell.property.expanded", false);
const NOTEBOOK_DIFF_CELLS_COLLAPSED = new RawContextKey("notebook.diffEditor.allCollapsed", void 0, localize("notebook.diffEditor.allCollapsed", "Whether all cells in notebook diff editor are collapsed"));
const NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS = new RawContextKey("notebook.diffEditor.hasUnchangedCells", void 0, localize("notebook.diffEditor.hasUnchangedCells", "Whether there are unchanged cells in the notebook diff editor"));
const NOTEBOOK_DIFF_UNCHANGED_CELLS_HIDDEN = new RawContextKey("notebook.diffEditor.unchangedCellsAreHidden", void 0, localize("notebook.diffEditor.unchangedCellsAreHidden", "Whether the unchanged cells in the notebook diff editor are hidden"));
const NOTEBOOK_DIFF_ITEM_KIND = new RawContextKey("notebook.diffEditor.item.kind", void 0, localize("notebook.diffEditor.item.kind", "The kind of item in the notebook diff editor, Cell, Metadata or Output"));
const NOTEBOOK_DIFF_ITEM_DIFF_STATE = new RawContextKey("notebook.diffEditor.item.state", void 0, localize("notebook.diffEditor.item.state", "The diff state of item in the notebook diff editor, delete, insert, modified or unchanged"));
export {
  DIFF_CELL_MARGIN,
  DiffSide,
  NOTEBOOK_DIFF_CELLS_COLLAPSED,
  NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE,
  NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE_KEY,
  NOTEBOOK_DIFF_CELL_INPUT,
  NOTEBOOK_DIFF_CELL_PROPERTY,
  NOTEBOOK_DIFF_CELL_PROPERTY_EXPANDED,
  NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS,
  NOTEBOOK_DIFF_ITEM_DIFF_STATE,
  NOTEBOOK_DIFF_ITEM_KIND,
  NOTEBOOK_DIFF_METADATA,
  NOTEBOOK_DIFF_UNCHANGED_CELLS_HIDDEN
};
