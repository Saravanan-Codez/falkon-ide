import { getZoomLevel, setZoomFactor, setZoomLevel } from "../../../base/browser/browser.js";
import { getActiveWindow, getWindows } from "../../../base/browser/dom.js";
import { mainWindow } from "../../../base/browser/window.js";
import { ipcRenderer, webFrame } from "../../../base/parts/sandbox/electron-browser/globals.js";
import { zoomLevelToZoomFactor } from "../common/window.js";
var ApplyZoomTarget = /* @__PURE__ */ ((ApplyZoomTarget2) => {
  ApplyZoomTarget2[ApplyZoomTarget2["ACTIVE_WINDOW"] = 1] = "ACTIVE_WINDOW";
  ApplyZoomTarget2[ApplyZoomTarget2["ALL_WINDOWS"] = 2] = "ALL_WINDOWS";
  return ApplyZoomTarget2;
})(ApplyZoomTarget || {});
const MAX_ZOOM_LEVEL = 8;
const MIN_ZOOM_LEVEL = -8;
function applyZoom(zoomLevel, target) {
  zoomLevel = Math.min(Math.max(zoomLevel, MIN_ZOOM_LEVEL), MAX_ZOOM_LEVEL);
  const targetWindows = [];
  if (target === 1 /* ACTIVE_WINDOW */) {
    targetWindows.push(getActiveWindow());
  } else if (target === 2 /* ALL_WINDOWS */) {
    targetWindows.push(...Array.from(getWindows()).map(({ window }) => window));
  } else {
    targetWindows.push(target);
  }
  for (const targetWindow of targetWindows) {
    getGlobals(targetWindow)?.webFrame?.setZoomLevel(zoomLevel);
    setZoomFactor(zoomLevelToZoomFactor(zoomLevel), targetWindow);
    setZoomLevel(zoomLevel, targetWindow);
  }
}
function getGlobals(win) {
  if (win === mainWindow) {
    return { ipcRenderer, webFrame };
  } else {
    const auxiliaryWindow = win;
    if (auxiliaryWindow?.vscode?.ipcRenderer && auxiliaryWindow?.vscode?.webFrame) {
      return auxiliaryWindow.vscode;
    }
  }
  return void 0;
}
function zoomIn(target) {
  applyZoom(getZoomLevel(typeof target === "number" ? getActiveWindow() : target) + 1, target);
}
function zoomOut(target) {
  applyZoom(getZoomLevel(typeof target === "number" ? getActiveWindow() : target) - 1, target);
}
export {
  ApplyZoomTarget,
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  applyZoom,
  zoomIn,
  zoomOut
};
