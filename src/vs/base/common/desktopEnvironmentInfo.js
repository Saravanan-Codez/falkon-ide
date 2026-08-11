import { env } from "./process.js";
var DesktopEnvironment = /* @__PURE__ */ ((DesktopEnvironment2) => {
  DesktopEnvironment2["UNKNOWN"] = "UNKNOWN";
  DesktopEnvironment2["CINNAMON"] = "CINNAMON";
  DesktopEnvironment2["DEEPIN"] = "DEEPIN";
  DesktopEnvironment2["GNOME"] = "GNOME";
  DesktopEnvironment2["KDE3"] = "KDE3";
  DesktopEnvironment2["KDE4"] = "KDE4";
  DesktopEnvironment2["KDE5"] = "KDE5";
  DesktopEnvironment2["KDE6"] = "KDE6";
  DesktopEnvironment2["PANTHEON"] = "PANTHEON";
  DesktopEnvironment2["UNITY"] = "UNITY";
  DesktopEnvironment2["XFCE"] = "XFCE";
  DesktopEnvironment2["UKUI"] = "UKUI";
  DesktopEnvironment2["LXQT"] = "LXQT";
  return DesktopEnvironment2;
})(DesktopEnvironment || {});
const kXdgCurrentDesktopEnvVar = "XDG_CURRENT_DESKTOP";
const kKDESessionEnvVar = "KDE_SESSION_VERSION";
function getDesktopEnvironment() {
  const xdgCurrentDesktop = env[kXdgCurrentDesktopEnvVar];
  if (xdgCurrentDesktop) {
    const values = xdgCurrentDesktop.split(":").map((value) => value.trim()).filter((value) => value.length > 0);
    for (const value of values) {
      switch (value) {
        case "Unity": {
          const desktopSessionUnity = env["DESKTOP_SESSION"];
          if (desktopSessionUnity && desktopSessionUnity.includes("gnome-fallback")) {
            return "GNOME" /* GNOME */;
          }
          return "UNITY" /* UNITY */;
        }
        case "Deepin":
          return "DEEPIN" /* DEEPIN */;
        case "GNOME":
          return "GNOME" /* GNOME */;
        case "X-Cinnamon":
          return "CINNAMON" /* CINNAMON */;
        case "KDE": {
          const kdeSession = env[kKDESessionEnvVar];
          if (kdeSession === "5") {
            return "KDE5" /* KDE5 */;
          }
          if (kdeSession === "6") {
            return "KDE6" /* KDE6 */;
          }
          return "KDE4" /* KDE4 */;
        }
        case "Pantheon":
          return "PANTHEON" /* PANTHEON */;
        case "XFCE":
          return "XFCE" /* XFCE */;
        case "UKUI":
          return "UKUI" /* UKUI */;
        case "LXQt":
          return "LXQT" /* LXQT */;
      }
    }
  }
  const desktopSession = env["DESKTOP_SESSION"];
  if (desktopSession) {
    switch (desktopSession) {
      case "deepin":
        return "DEEPIN" /* DEEPIN */;
      case "gnome":
      case "mate":
        return "GNOME" /* GNOME */;
      case "kde4":
      case "kde-plasma":
        return "KDE4" /* KDE4 */;
      case "kde":
        if (kKDESessionEnvVar in env) {
          return "KDE4" /* KDE4 */;
        }
        return "KDE3" /* KDE3 */;
      case "xfce":
      case "xubuntu":
        return "XFCE" /* XFCE */;
      case "ukui":
        return "UKUI" /* UKUI */;
    }
  }
  if ("GNOME_DESKTOP_SESSION_ID" in env) {
    return "GNOME" /* GNOME */;
  }
  if ("KDE_FULL_SESSION" in env) {
    if (kKDESessionEnvVar in env) {
      return "KDE4" /* KDE4 */;
    }
    return "KDE3" /* KDE3 */;
  }
  return "UNKNOWN" /* UNKNOWN */;
}
export {
  getDesktopEnvironment
};
