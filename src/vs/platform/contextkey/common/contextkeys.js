import { isIOS, isLinux, isMacintosh, isMobile, isWeb, isWindows } from "../../../base/common/platform.js";
import { localize } from "../../../nls.js";
import { RawContextKey } from "./contextkey.js";
const IsMacContext = new RawContextKey("isMac", isMacintosh, localize("isMac", "Whether the operating system is macOS"));
const IsLinuxContext = new RawContextKey("isLinux", isLinux, localize("isLinux", "Whether the operating system is Linux"));
const IsWindowsContext = new RawContextKey("isWindows", isWindows, localize("isWindows", "Whether the operating system is Windows"));
const IsWebContext = new RawContextKey("isWeb", isWeb, localize("isWeb", "Whether the platform is a web browser"));
const IsMacNativeContext = new RawContextKey("isMacNative", isMacintosh && !isWeb, localize("isMacNative", "Whether the operating system is macOS on a non-browser platform"));
const IsIOSContext = new RawContextKey("isIOS", isIOS, localize("isIOS", "Whether the operating system is iOS"));
const IsMobileContext = new RawContextKey("isMobile", isMobile, localize("isMobile", "Whether the platform is a mobile web browser"));
const IsDevelopmentContext = new RawContextKey("isDevelopment", false, true);
const ProductQualityContext = new RawContextKey("productQualityType", "", localize("productQualityType", "Quality type of VS Code"));
const InputFocusedContextKey = "inputFocus";
const InputFocusedContext = new RawContextKey(InputFocusedContextKey, false, localize("inputFocus", "Whether keyboard focus is inside an input box"));
export {
  InputFocusedContext,
  InputFocusedContextKey,
  IsDevelopmentContext,
  IsIOSContext,
  IsLinuxContext,
  IsMacContext,
  IsMacNativeContext,
  IsMobileContext,
  IsWebContext,
  IsWindowsContext,
  ProductQualityContext
};
