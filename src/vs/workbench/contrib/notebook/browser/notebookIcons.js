import { Codicon } from "../../../../base/common/codicons.js";
import { localize } from "../../../../nls.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
const selectKernelIcon = registerIcon("notebook-kernel-select", Codicon.serverEnvironment, localize("selectKernelIcon", "Configure icon to select a kernel in notebook editors."));
const executeIcon = registerIcon("notebook-execute", Codicon.play, localize("executeIcon", "Icon to execute in notebook editors."));
const executeAboveIcon = registerIcon("notebook-execute-above", Codicon.runAbove, localize("executeAboveIcon", "Icon to execute above cells in notebook editors."));
const executeBelowIcon = registerIcon("notebook-execute-below", Codicon.runBelow, localize("executeBelowIcon", "Icon to execute below cells in notebook editors."));
const stopIcon = registerIcon("notebook-stop", Codicon.primitiveSquare, localize("stopIcon", "Icon to stop an execution in notebook editors."));
const deleteCellIcon = registerIcon("notebook-delete-cell", Codicon.trash, localize("deleteCellIcon", "Icon to delete a cell in notebook editors."));
const executeAllIcon = registerIcon("notebook-execute-all", Codicon.runAll, localize("executeAllIcon", "Icon to execute all cells in notebook editors."));
const editIcon = registerIcon("notebook-edit", Codicon.pencil, localize("editIcon", "Icon to edit a cell in notebook editors."));
const stopEditIcon = registerIcon("notebook-stop-edit", Codicon.check, localize("stopEditIcon", "Icon to stop editing a cell in notebook editors."));
const moveUpIcon = registerIcon("notebook-move-up", Codicon.arrowUp, localize("moveUpIcon", "Icon to move up a cell in notebook editors."));
const moveDownIcon = registerIcon("notebook-move-down", Codicon.arrowDown, localize("moveDownIcon", "Icon to move down a cell in notebook editors."));
const clearIcon = registerIcon("notebook-clear", Codicon.clearAll, localize("clearIcon", "Icon to clear cell outputs in notebook editors."));
const splitCellIcon = registerIcon("notebook-split-cell", Codicon.splitVertical, localize("splitCellIcon", "Icon to split a cell in notebook editors."));
const successStateIcon = registerIcon("notebook-state-success", Codicon.check, localize("successStateIcon", "Icon to indicate a success state in notebook editors."));
const errorStateIcon = registerIcon("notebook-state-error", Codicon.error, localize("errorStateIcon", "Icon to indicate an error state in notebook editors."));
const pendingStateIcon = registerIcon("notebook-state-pending", Codicon.clock, localize("pendingStateIcon", "Icon to indicate a pending state in notebook editors."));
const executingStateIcon = registerIcon("notebook-state-executing", Codicon.sync, localize("executingStateIcon", "Icon to indicate an executing state in notebook editors."));
const collapsedIcon = registerIcon("notebook-collapsed", Codicon.chevronRight, localize("collapsedIcon", "Icon to annotate a collapsed section in notebook editors."));
const expandedIcon = registerIcon("notebook-expanded", Codicon.chevronDown, localize("expandedIcon", "Icon to annotate an expanded section in notebook editors."));
const openAsTextIcon = registerIcon("notebook-open-as-text", Codicon.fileCode, localize("openAsTextIcon", "Icon to open the notebook in a text editor."));
const revertIcon = registerIcon("notebook-revert", Codicon.discard, localize("revertIcon", "Icon to revert in notebook editors."));
const toggleWhitespace = registerIcon("notebook-diff-cell-toggle-whitespace", Codicon.whitespace, localize("toggleWhitespace", "Icon for the toggle whitespace action in the diff editor."));
const renderOutputIcon = registerIcon("notebook-render-output", Codicon.preview, localize("renderOutputIcon", "Icon to render output in diff editor."));
const mimetypeIcon = registerIcon("notebook-mimetype", Codicon.code, localize("mimetypeIcon", "Icon for a mime type in notebook editors."));
const copyIcon = registerIcon("notebook-copy", Codicon.copy, localize("copyIcon", "Icon to copy content to clipboard"));
const saveIcon = registerIcon("notebook-save", Codicon.save, localize("saveIcon", "Icon to save content to disk"));
const previousChangeIcon = registerIcon("notebook-diff-editor-previous-change", Codicon.arrowUp, localize("previousChangeIcon", "Icon for the previous change action in the diff editor."));
const nextChangeIcon = registerIcon("notebook-diff-editor-next-change", Codicon.arrowDown, localize("nextChangeIcon", "Icon for the next change action in the diff editor."));
const variablesViewIcon = registerIcon("variables-view-icon", Codicon.variableGroup, localize("variablesViewIcon", "View icon of the variables view."));
export {
  clearIcon,
  collapsedIcon,
  copyIcon,
  deleteCellIcon,
  editIcon,
  errorStateIcon,
  executeAboveIcon,
  executeAllIcon,
  executeBelowIcon,
  executeIcon,
  executingStateIcon,
  expandedIcon,
  mimetypeIcon,
  moveDownIcon,
  moveUpIcon,
  nextChangeIcon,
  openAsTextIcon,
  pendingStateIcon,
  previousChangeIcon,
  renderOutputIcon,
  revertIcon,
  saveIcon,
  selectKernelIcon,
  splitCellIcon,
  stopEditIcon,
  stopIcon,
  successStateIcon,
  toggleWhitespace,
  variablesViewIcon
};
