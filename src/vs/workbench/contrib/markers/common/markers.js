import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
var MarkersViewMode = /* @__PURE__ */ ((MarkersViewMode2) => {
  MarkersViewMode2["Table"] = "table";
  MarkersViewMode2["Tree"] = "tree";
  return MarkersViewMode2;
})(MarkersViewMode || {});
var Markers;
((Markers2) => {
  Markers2.MARKERS_CONTAINER_ID = "workbench.panel.markers";
  Markers2.MARKERS_VIEW_ID = "workbench.panel.markers.view";
  Markers2.MARKERS_VIEW_STORAGE_ID = "workbench.panel.markers";
  Markers2.MARKER_COPY_ACTION_ID = "problems.action.copy";
  Markers2.MARKER_COPY_MESSAGE_ACTION_ID = "problems.action.copyMessage";
  Markers2.RELATED_INFORMATION_COPY_MESSAGE_ACTION_ID = "problems.action.copyRelatedInformationMessage";
  Markers2.FOCUS_PROBLEMS_FROM_FILTER = "problems.action.focusProblemsFromFilter";
  Markers2.MARKERS_VIEW_FOCUS_FILTER = "problems.action.focusFilter";
  Markers2.MARKERS_VIEW_CLEAR_FILTER_TEXT = "problems.action.clearFilterText";
  Markers2.MARKERS_VIEW_SHOW_MULTILINE_MESSAGE = "problems.action.showMultilineMessage";
  Markers2.MARKERS_VIEW_SHOW_SINGLELINE_MESSAGE = "problems.action.showSinglelineMessage";
  Markers2.MARKER_OPEN_ACTION_ID = "problems.action.open";
  Markers2.MARKER_OPEN_SIDE_ACTION_ID = "problems.action.openToSide";
  Markers2.MARKER_SHOW_PANEL_ID = "workbench.action.showErrorsWarnings";
  Markers2.MARKER_SHOW_QUICK_FIX = "problems.action.showQuickFixes";
  Markers2.TOGGLE_MARKERS_VIEW_ACTION_ID = "workbench.actions.view.toggleProblems";
})(Markers || (Markers = {}));
var MarkersContextKeys;
((MarkersContextKeys2) => {
  MarkersContextKeys2.MarkersViewModeContextKey = new RawContextKey("problemsViewMode", "tree" /* Tree */);
  MarkersContextKeys2.MarkersTreeVisibilityContextKey = new RawContextKey("problemsVisibility", false);
  MarkersContextKeys2.MarkerFocusContextKey = new RawContextKey("problemFocus", false);
  MarkersContextKeys2.MarkerViewFilterFocusContextKey = new RawContextKey("problemsFilterFocus", false);
  MarkersContextKeys2.RelatedInformationFocusContextKey = new RawContextKey("relatedInformationFocus", false);
  MarkersContextKeys2.ShowErrorsFilterContextKey = new RawContextKey("problems.filter.errors", true);
  MarkersContextKeys2.ShowWarningsFilterContextKey = new RawContextKey("problems.filter.warnings", true);
  MarkersContextKeys2.ShowInfoFilterContextKey = new RawContextKey("problems.filter.info", true);
  MarkersContextKeys2.ShowActiveFileFilterContextKey = new RawContextKey("problems.filter.activeFile", false);
  MarkersContextKeys2.ShowExcludedFilesFilterContextKey = new RawContextKey("problems.filter.excludedFiles", true);
})(MarkersContextKeys || (MarkersContextKeys = {}));
export {
  Markers,
  MarkersContextKeys,
  MarkersViewMode
};
