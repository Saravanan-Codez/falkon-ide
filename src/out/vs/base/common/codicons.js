import { register } from "./codiconsUtil.js";
import { codiconsLibrary } from "./codiconsLibrary.js";
function getAllCodicons() {
  return Object.values(Codicon);
}
const codiconsDerived = {
  dialogError: register("dialog-error", "error"),
  dialogWarning: register("dialog-warning", "warning"),
  dialogInfo: register("dialog-info", "info"),
  dialogClose: register("dialog-close", "close"),
  treeItemExpanded: register("tree-item-expanded", "chevron-down"),
  // collapsed is done with rotation
  treeFilterOnTypeOn: register("tree-filter-on-type-on", "list-filter"),
  treeFilterOnTypeOff: register("tree-filter-on-type-off", "list-selection"),
  treeFilterClear: register("tree-filter-clear", "close"),
  treeItemLoading: register("tree-item-loading", "loading"),
  menuSelection: register("menu-selection", "check"),
  menuSubmenu: register("menu-submenu", "chevron-right"),
  menuBarMore: register("menubar-more", "more"),
  scrollbarButtonLeft: register("scrollbar-button-left", "triangle-left"),
  scrollbarButtonRight: register("scrollbar-button-right", "triangle-right"),
  scrollbarButtonUp: register("scrollbar-button-up", "triangle-up"),
  scrollbarButtonDown: register("scrollbar-button-down", "triangle-down"),
  toolBarMore: register("toolbar-more", "more"),
  quickInputBack: register("quick-input-back", "arrow-left"),
  dropDownButton: register("drop-down-button", 60084),
  symbolCustomColor: register("symbol-customcolor", 60252),
  exportIcon: register("export", 60332),
  workspaceUnspecified: register("workspace-unspecified", 60355),
  newLine: register("newline", 60394),
  thumbsDownFilled: register("thumbsdown-filled", 60435),
  thumbsUpFilled: register("thumbsup-filled", 60436),
  gitFetch: register("git-fetch", 60445),
  lightbulbSparkleAutofix: register("lightbulb-sparkle-autofix", 60447),
  debugBreakpointPending: register("debug-breakpoint-pending", 60377),
  chatImport: register("chat-import", 60550),
  chatExport: register("chat-export", 60551)
};
const Codicon = {
  ...codiconsLibrary,
  ...codiconsDerived
};
export {
  Codicon,
  codiconsDerived,
  getAllCodicons
};
