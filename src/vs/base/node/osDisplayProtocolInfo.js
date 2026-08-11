import { constants as FSConstants, promises as FSPromises } from "fs";
import { join } from "../common/path.js";
import { env } from "../common/process.js";
const XDG_SESSION_TYPE = "XDG_SESSION_TYPE";
const WAYLAND_DISPLAY = "WAYLAND_DISPLAY";
const XDG_RUNTIME_DIR = "XDG_RUNTIME_DIR";
var DisplayProtocolType = /* @__PURE__ */ ((DisplayProtocolType2) => {
  DisplayProtocolType2["Wayland"] = "wayland";
  DisplayProtocolType2["XWayland"] = "xwayland";
  DisplayProtocolType2["X11"] = "x11";
  DisplayProtocolType2["Unknown"] = "unknown";
  return DisplayProtocolType2;
})(DisplayProtocolType || {});
async function getDisplayProtocol(errorLogger) {
  const xdgSessionType = env[XDG_SESSION_TYPE];
  if (xdgSessionType) {
    return xdgSessionType === "wayland" /* Wayland */ || xdgSessionType === "x11" /* X11 */ ? xdgSessionType : "unknown" /* Unknown */;
  } else {
    const waylandDisplay = env[WAYLAND_DISPLAY];
    if (!waylandDisplay) {
      return "x11" /* X11 */;
    } else {
      const xdgRuntimeDir = env[XDG_RUNTIME_DIR];
      if (!xdgRuntimeDir) {
        return "unknown" /* Unknown */;
      } else {
        const waylandServerPipe = join(xdgRuntimeDir, "wayland-0");
        try {
          await FSPromises.access(waylandServerPipe, FSConstants.R_OK);
          return "wayland" /* Wayland */;
        } catch (err) {
          errorLogger(err);
          return "unknown" /* Unknown */;
        }
      }
    }
  }
}
function getCodeDisplayProtocol(displayProtocol, ozonePlatform) {
  if (!ozonePlatform) {
    return displayProtocol === "wayland" /* Wayland */ ? "xwayland" /* XWayland */ : "x11" /* X11 */;
  } else {
    switch (ozonePlatform) {
      case "auto":
        return displayProtocol;
      case "x11":
        return displayProtocol === "wayland" /* Wayland */ ? "xwayland" /* XWayland */ : "x11" /* X11 */;
      case "wayland":
        return "wayland" /* Wayland */;
      default:
        return "unknown" /* Unknown */;
    }
  }
}
export {
  getCodeDisplayProtocol,
  getDisplayProtocol
};
