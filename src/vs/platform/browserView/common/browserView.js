import { localize } from "../../../nls.js";
const commandPrefix = "workbench.action.browser";
var BrowserViewCommandId = ((BrowserViewCommandId2) => {
  BrowserViewCommandId2["Open"] = `${commandPrefix}.open`;
  BrowserViewCommandId2["OpenFile"] = `${commandPrefix}.openFile`;
  BrowserViewCommandId2["NewTab"] = `${commandPrefix}.newTab`;
  BrowserViewCommandId2["QuickOpen"] = `${commandPrefix}.quickOpen`;
  BrowserViewCommandId2["OpenOrList"] = `${commandPrefix}.openOrList`;
  BrowserViewCommandId2["CloseAll"] = `${commandPrefix}.closeAll`;
  BrowserViewCommandId2["CloseAllInGroup"] = `${commandPrefix}.closeAllInGroup`;
  BrowserViewCommandId2["GoBack"] = `${commandPrefix}.goBack`;
  BrowserViewCommandId2["GoForward"] = `${commandPrefix}.goForward`;
  BrowserViewCommandId2["Reload"] = `${commandPrefix}.reload`;
  BrowserViewCommandId2["HardReload"] = `${commandPrefix}.hardReload`;
  BrowserViewCommandId2["FocusUrlInput"] = `${commandPrefix}.focusUrlInput`;
  BrowserViewCommandId2["OpenExternal"] = `${commandPrefix}.openExternal`;
  BrowserViewCommandId2["OpenSettings"] = `${commandPrefix}.openSettings`;
  BrowserViewCommandId2["ToggleFavorite"] = `${commandPrefix}.toggleFavorite`;
  BrowserViewCommandId2["ShowHistory"] = `${commandPrefix}.showHistory`;
  BrowserViewCommandId2["ManagePermissions"] = `${commandPrefix}.managePermissions`;
  BrowserViewCommandId2["AddElementToChat"] = `${commandPrefix}.addElementToChat`;
  BrowserViewCommandId2["AddElementCommentToChat"] = `${commandPrefix}.addElementCommentToChat`;
  BrowserViewCommandId2["AddConsoleLogsToChat"] = `${commandPrefix}.addConsoleLogsToChat`;
  BrowserViewCommandId2["AddScreenshotToChat"] = `${commandPrefix}.addScreenshotToChat`;
  BrowserViewCommandId2["AddAreaScreenshotToChat"] = `${commandPrefix}.addAreaScreenshotToChat`;
  BrowserViewCommandId2["AddFullPageScreenshotToChat"] = `${commandPrefix}.addFullPageScreenshotToChat`;
  BrowserViewCommandId2["ToggleDevTools"] = `${commandPrefix}.toggleDevTools`;
  BrowserViewCommandId2["ClearGlobalStorage"] = `${commandPrefix}.clearGlobalStorage`;
  BrowserViewCommandId2["ClearWorkspaceStorage"] = `${commandPrefix}.clearWorkspaceStorage`;
  BrowserViewCommandId2["ClearEphemeralStorage"] = `${commandPrefix}.clearEphemeralStorage`;
  BrowserViewCommandId2["ShowFind"] = `${commandPrefix}.showFind`;
  BrowserViewCommandId2["HideFind"] = `${commandPrefix}.hideFind`;
  BrowserViewCommandId2["FindNext"] = `${commandPrefix}.findNext`;
  BrowserViewCommandId2["FindPrevious"] = `${commandPrefix}.findPrevious`;
  return BrowserViewCommandId2;
})(BrowserViewCommandId || {});
var BrowserElementSelectionMode = /* @__PURE__ */ ((BrowserElementSelectionMode2) => {
  BrowserElementSelectionMode2["Select"] = "select";
  BrowserElementSelectionMode2["Comment"] = "comment";
  return BrowserElementSelectionMode2;
})(BrowserElementSelectionMode || {});
var BrowserViewStorageScope = /* @__PURE__ */ ((BrowserViewStorageScope2) => {
  BrowserViewStorageScope2["Global"] = "global";
  BrowserViewStorageScope2["Workspace"] = "workspace";
  BrowserViewStorageScope2["Ephemeral"] = "ephemeral";
  return BrowserViewStorageScope2;
})(BrowserViewStorageScope || {});
const ipcBrowserViewChannelName = "browserView";
const browserZoomFactors = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const browserZoomDefaultIndex = browserZoomFactors.indexOf(1);
function browserZoomLabel(zoomFactor) {
  return localize("browserZoomPercent", "{0}%", Math.round(zoomFactor * 100));
}
function browserZoomAccessibilityLabel(zoomFactor) {
  return localize("browserZoomAccessibilityLabel", "Page Zoom: {0}%", Math.round(zoomFactor * 100));
}
const browserViewIsolatedWorldId = 999;
export {
  BrowserElementSelectionMode,
  BrowserViewCommandId,
  BrowserViewStorageScope,
  browserViewIsolatedWorldId,
  browserZoomAccessibilityLabel,
  browserZoomDefaultIndex,
  browserZoomFactors,
  browserZoomLabel,
  ipcBrowserViewChannelName
};
