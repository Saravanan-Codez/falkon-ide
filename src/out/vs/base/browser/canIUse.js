import * as browser from "./browser.js";
import { mainWindow } from "./window.js";
import * as platform from "../common/platform.js";
var KeyboardSupport = /* @__PURE__ */ ((KeyboardSupport2) => {
  KeyboardSupport2[KeyboardSupport2["Always"] = 0] = "Always";
  KeyboardSupport2[KeyboardSupport2["FullScreen"] = 1] = "FullScreen";
  KeyboardSupport2[KeyboardSupport2["None"] = 2] = "None";
  return KeyboardSupport2;
})(KeyboardSupport || {});
const BrowserFeatures = {
  clipboard: {
    writeText: platform.isNative || document.queryCommandSupported && document.queryCommandSupported("copy") || !!(navigator && navigator.clipboard && navigator.clipboard.writeText),
    readText: platform.isNative || !!(navigator && navigator.clipboard && navigator.clipboard.readText)
  },
  keyboard: (() => {
    if (platform.isNative || browser.isStandalone()) {
      return 0 /* Always */;
    }
    if (navigator.keyboard || browser.isSafari) {
      return 1 /* FullScreen */;
    }
    return 2 /* None */;
  })(),
  // 'ontouchstart' in window always evaluates to true with typescript's modern typings. This causes `window` to be
  // `never` later in `window.navigator`. That's why we need the explicit `window as Window` cast
  touch: "ontouchstart" in mainWindow || navigator.maxTouchPoints > 0,
  pointerEvents: mainWindow.PointerEvent && ("ontouchstart" in mainWindow || navigator.maxTouchPoints > 0)
};
export {
  BrowserFeatures,
  KeyboardSupport
};
