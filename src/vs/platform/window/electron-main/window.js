import electron from "electron";
import { DEFAULT_AUX_WINDOW_SIZE, DEFAULT_EMPTY_WINDOW_SIZE, DEFAULT_WORKSPACE_WINDOW_SIZE } from "../common/window.js";
var LoadReason = /* @__PURE__ */ ((LoadReason2) => {
  LoadReason2[LoadReason2["INITIAL"] = 1] = "INITIAL";
  LoadReason2[LoadReason2["LOAD"] = 2] = "LOAD";
  LoadReason2[LoadReason2["RELOAD"] = 3] = "RELOAD";
  return LoadReason2;
})(LoadReason || {});
var UnloadReason = /* @__PURE__ */ ((UnloadReason2) => {
  UnloadReason2[UnloadReason2["CLOSE"] = 1] = "CLOSE";
  UnloadReason2[UnloadReason2["QUIT"] = 2] = "QUIT";
  UnloadReason2[UnloadReason2["RELOAD"] = 3] = "RELOAD";
  UnloadReason2[UnloadReason2["LOAD"] = 4] = "LOAD";
  return UnloadReason2;
})(UnloadReason || {});
const defaultWindowState = function(mode = 1 /* Normal */, hasWorkspace = false) {
  const size = hasWorkspace ? DEFAULT_WORKSPACE_WINDOW_SIZE : DEFAULT_EMPTY_WINDOW_SIZE;
  return {
    width: size.width,
    height: size.height,
    mode
  };
};
const defaultAuxWindowState = function() {
  const width = DEFAULT_AUX_WINDOW_SIZE.width;
  const height = DEFAULT_AUX_WINDOW_SIZE.height;
  const workArea = electron.screen.getPrimaryDisplay().workArea;
  const x = Math.max(workArea.x + workArea.width / 2 - width / 2, 0);
  const y = Math.max(workArea.y + workArea.height / 2 - height / 2, 0);
  return {
    x,
    y,
    width,
    height,
    mode: 1 /* Normal */
  };
};
var WindowMode = /* @__PURE__ */ ((WindowMode2) => {
  WindowMode2[WindowMode2["Maximized"] = 0] = "Maximized";
  WindowMode2[WindowMode2["Normal"] = 1] = "Normal";
  WindowMode2[WindowMode2["Minimized"] = 2] = "Minimized";
  WindowMode2[WindowMode2["Fullscreen"] = 3] = "Fullscreen";
  return WindowMode2;
})(WindowMode || {});
var WindowError = /* @__PURE__ */ ((WindowError2) => {
  WindowError2[WindowError2["UNRESPONSIVE"] = 1] = "UNRESPONSIVE";
  WindowError2[WindowError2["PROCESS_GONE"] = 2] = "PROCESS_GONE";
  WindowError2[WindowError2["LOAD"] = 3] = "LOAD";
  WindowError2[WindowError2["RESPONSIVE"] = 4] = "RESPONSIVE";
  return WindowError2;
})(WindowError || {});
export {
  LoadReason,
  UnloadReason,
  WindowError,
  WindowMode,
  defaultAuxWindowState,
  defaultWindowState
};
