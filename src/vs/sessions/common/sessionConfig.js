const DOCK_DETAIL_PANEL_SETTING = "sessions.layout.singlePaneDetailPanel";
function isSessionConfigComplete(config) {
  return (config.schema.required ?? []).every((property) => config.values[property] !== void 0);
}
export {
  DOCK_DETAIL_PANEL_SETTING,
  isSessionConfigComplete
};
