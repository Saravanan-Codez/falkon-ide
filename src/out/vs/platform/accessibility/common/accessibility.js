import { RawContextKey } from "../../contextkey/common/contextkey.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IAccessibilityService = createDecorator("accessibilityService");
var AccessibilitySupport = /* @__PURE__ */ ((AccessibilitySupport2) => {
  AccessibilitySupport2[AccessibilitySupport2["Unknown"] = 0] = "Unknown";
  AccessibilitySupport2[AccessibilitySupport2["Disabled"] = 1] = "Disabled";
  AccessibilitySupport2[AccessibilitySupport2["Enabled"] = 2] = "Enabled";
  return AccessibilitySupport2;
})(AccessibilitySupport || {});
const CONTEXT_ACCESSIBILITY_MODE_ENABLED = new RawContextKey("accessibilityModeEnabled", false);
function isAccessibilityInformation(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const candidate = obj;
  return typeof candidate.label === "string" && (typeof candidate.role === "undefined" || typeof candidate.role === "string");
}
const ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX = "ACCESSIBLE_VIEW_SHOWN_";
export {
  ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX,
  AccessibilitySupport,
  CONTEXT_ACCESSIBILITY_MODE_ENABLED,
  IAccessibilityService,
  isAccessibilityInformation
};
