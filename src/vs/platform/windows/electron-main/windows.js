import electron from "electron";
import { Color } from "../../../base/common/color.js";
import { join } from "../../../base/common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../../base/common/platform.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { IProductService } from "../../product/common/productService.js";
import { IThemeMainService } from "../../theme/electron-main/themeMainService.js";
import { TitlebarStyle, WindowMinimumSize, hasNativeTitlebar, useNativeFullScreen, useWindowControlsOverlay, zoomLevelToZoomFactor } from "../../window/common/window.js";
import { WindowMode, defaultWindowState } from "../../window/electron-main/window.js";
const IWindowsMainService = createDecorator("windowsMainService");
var OpenContext = /* @__PURE__ */ ((OpenContext2) => {
  OpenContext2[OpenContext2["CLI"] = 0] = "CLI";
  OpenContext2[OpenContext2["DOCK"] = 1] = "DOCK";
  OpenContext2[OpenContext2["MENU"] = 2] = "MENU";
  OpenContext2[OpenContext2["DIALOG"] = 3] = "DIALOG";
  OpenContext2[OpenContext2["DESKTOP"] = 4] = "DESKTOP";
  OpenContext2[OpenContext2["API"] = 5] = "API";
  OpenContext2[OpenContext2["LINK"] = 6] = "LINK";
  return OpenContext2;
})(OpenContext || {});
function defaultBrowserWindowOptions(accessor, windowState, overrides, webPreferences) {
  const themeMainService = accessor.get(IThemeMainService);
  const productService = accessor.get(IProductService);
  const configurationService = accessor.get(IConfigurationService);
  const environmentMainService = accessor.get(IEnvironmentMainService);
  const windowSettings = configurationService.getValue("window");
  const options = {
    backgroundColor: themeMainService.getBackgroundColor(),
    minWidth: WindowMinimumSize.WIDTH,
    minHeight: WindowMinimumSize.HEIGHT,
    title: productService.nameLong,
    show: windowState.mode !== WindowMode.Maximized && windowState.mode !== WindowMode.Fullscreen,
    // reduce flicker by showing later
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    webPreferences: {
      ...webPreferences,
      enableWebSQL: false,
      spellcheck: false,
      zoomFactor: zoomLevelToZoomFactor(windowState.zoomLevel ?? windowSettings?.zoomLevel),
      autoplayPolicy: "user-gesture-required",
      // Enable experimental css highlight api https://chromestatus.com/feature/5436441440026624
      // Refs https://github.com/microsoft/vscode/issues/140098
      enableBlinkFeatures: "HighlightAPI",
      sandbox: true,
      // TODO(deepak1556): Should be removed once migration is complete
      // https://github.com/microsoft/vscode/issues/239228
      enableDeprecatedPaste: true
    },
    experimentalDarkMode: true
  };
  if (isWindows) {
    let borderSetting = windowSettings?.border || "default";
    if (borderSetting === "system") {
      borderSetting = "default";
    }
    if (borderSetting !== "default") {
      if (borderSetting === "off") {
        options.accentColor = false;
      } else if (typeof borderSetting === "string") {
        options.accentColor = borderSetting;
      }
    }
  }
  if (isLinux) {
    options.icon = join(environmentMainService.appRoot, "resources/linux/code.png");
  } else if (isWindows) {
    if (!environmentMainService.isBuilt) {
      options.icon = join(environmentMainService.appRoot, "resources/win32/code_150x150.png");
    }
  }
  if (isMacintosh) {
    options.acceptFirstMouse = true;
    if (windowSettings?.clickThroughInactive === false) {
      options.acceptFirstMouse = false;
    }
  }
  if (overrides?.disableFullscreen) {
    options.fullscreen = false;
  } else if (isMacintosh && !useNativeFullScreen(configurationService)) {
    options.fullscreenable = false;
  }
  const useNativeTabs = isMacintosh && windowSettings?.nativeTabs === true;
  if (useNativeTabs) {
    options.tabbingIdentifier = productService.nameShort;
  }
  const hideNativeTitleBar = !hasNativeTitlebar(configurationService, overrides?.forceNativeTitlebar ? TitlebarStyle.NATIVE : void 0);
  if (hideNativeTitleBar) {
    options.titleBarStyle = "hidden";
    if (!isMacintosh) {
      options.frame = false;
    }
    if (useWindowControlsOverlay(configurationService)) {
      if (isMacintosh) {
        options.titleBarOverlay = true;
      } else {
        const titleBarColor = themeMainService.getWindowSplash(void 0)?.colorInfo.titleBarBackground ?? themeMainService.getBackgroundColor();
        const symbolColor = Color.fromHex(titleBarColor).isDarker() ? "#FFFFFF" : "#000000";
        options.titleBarOverlay = {
          height: 29,
          // the smallest size of the title bar on windows accounting for the border on windows 11
          color: titleBarColor,
          symbolColor
        };
      }
    }
  }
  if (overrides?.alwaysOnTop) {
    options.alwaysOnTop = true;
  }
  if (overrides?.frameless) {
    options.frame = false;
    options.titleBarStyle = void 0;
    options.titleBarOverlay = void 0;
    options.minWidth = 1;
    options.minHeight = 1;
  }
  if (overrides?.backgroundColor) {
    options.backgroundColor = overrides.backgroundColor;
  }
  if (overrides?.transparent) {
    options.transparent = true;
    options.backgroundColor = void 0;
  }
  if (overrides?.notResizable) {
    options.resizable = false;
  }
  if (overrides?.noBackgroundThrottling) {
    options.webPreferences = {
      ...options.webPreferences,
      backgroundThrottling: false
    };
  }
  return options;
}
function getLastFocused(windows) {
  let lastFocusedWindow = void 0;
  let maxLastFocusTime = Number.MIN_VALUE;
  for (const window of windows) {
    if (window.lastFocusTime > maxLastFocusTime) {
      maxLastFocusTime = window.lastFocusTime;
      lastFocusedWindow = window;
    }
  }
  return lastFocusedWindow;
}
var WindowStateValidator;
((WindowStateValidator2) => {
  function validateWindowState(logService, state, displays = electron.screen.getAllDisplays()) {
    logService.trace(`window#validateWindowState: validating window state on ${displays.length} display(s)`, state);
    if (typeof state.x !== "number" || typeof state.y !== "number" || typeof state.width !== "number" || typeof state.height !== "number") {
      logService.trace("window#validateWindowState: unexpected type of state values");
      return void 0;
    }
    if (state.width <= 0 || state.height <= 0) {
      logService.trace("window#validateWindowState: unexpected negative values");
      return void 0;
    }
    if (displays.length === 1) {
      const displayWorkingArea2 = getWorkingArea(displays[0]);
      logService.trace("window#validateWindowState: single monitor working area", displayWorkingArea2);
      if (displayWorkingArea2) {
        let ensureStateInDisplayWorkingArea = function() {
          if (!state || typeof state.x !== "number" || typeof state.y !== "number" || !displayWorkingArea2) {
            return;
          }
          if (state.x < displayWorkingArea2.x) {
            state.x = displayWorkingArea2.x;
          }
          if (state.y < displayWorkingArea2.y) {
            state.y = displayWorkingArea2.y;
          }
        };
        ensureStateInDisplayWorkingArea();
        if (state.width > displayWorkingArea2.width) {
          state.width = displayWorkingArea2.width;
        }
        if (state.height > displayWorkingArea2.height) {
          state.height = displayWorkingArea2.height;
        }
        if (state.x > displayWorkingArea2.x + displayWorkingArea2.width - 128) {
          state.x = displayWorkingArea2.x + displayWorkingArea2.width - state.width;
        }
        if (state.y > displayWorkingArea2.y + displayWorkingArea2.height - 128) {
          state.y = displayWorkingArea2.y + displayWorkingArea2.height - state.height;
        }
        ensureStateInDisplayWorkingArea();
      }
      return state;
    }
    if (state.display && state.mode === WindowMode.Fullscreen) {
      const display2 = displays.find((d) => d.id === state.display);
      if (display2 && typeof display2.bounds?.x === "number" && typeof display2.bounds?.y === "number") {
        logService.trace("window#validateWindowState: restoring fullscreen to previous display");
        const defaults = defaultWindowState(WindowMode.Fullscreen);
        defaults.x = display2.bounds.x;
        defaults.y = display2.bounds.y;
        return defaults;
      }
    }
    let display;
    let displayWorkingArea;
    try {
      display = electron.screen.getDisplayMatching({ x: state.x, y: state.y, width: state.width, height: state.height });
      displayWorkingArea = getWorkingArea(display);
      logService.trace("window#validateWindowState: multi-monitor working area", displayWorkingArea);
    } catch (error) {
      logService.error("window#validateWindowState: error finding display for window state", error);
    }
    if (display && validateWindowStateOnDisplay(state, display)) {
      return state;
    }
    logService.trace("window#validateWindowState: state is outside of the multi-monitor working area");
    return void 0;
  }
  WindowStateValidator2.validateWindowState = validateWindowState;
  function validateWindowStateOnDisplay(state, display) {
    if (typeof state.x !== "number" || typeof state.y !== "number" || typeof state.width !== "number" || typeof state.height !== "number" || state.width <= 0 || state.height <= 0) {
      return false;
    }
    const displayWorkingArea = getWorkingArea(display);
    return Boolean(
      displayWorkingArea && // we have valid working area bounds
      state.x + state.width > displayWorkingArea.x && // prevent window from falling out of the screen to the left
      state.y + state.height > displayWorkingArea.y && // prevent window from falling out of the screen to the top
      state.x < displayWorkingArea.x + displayWorkingArea.width && // prevent window from falling out of the screen to the right
      state.y < displayWorkingArea.y + displayWorkingArea.height
      // prevent window from falling out of the screen to the bottom
    );
  }
  WindowStateValidator2.validateWindowStateOnDisplay = validateWindowStateOnDisplay;
  function getWorkingArea(display) {
    if (display.workArea.width > 0 && display.workArea.height > 0) {
      return display.workArea;
    }
    if (display.bounds.width > 0 && display.bounds.height > 0) {
      return display.bounds;
    }
    return void 0;
  }
})(WindowStateValidator || (WindowStateValidator = {}));
function getAllWindowsExcludingOffscreen() {
  return electron.BrowserWindow.getAllWindows().filter((win) => !win.webContents.isOffscreen());
}
export {
  IWindowsMainService,
  OpenContext,
  WindowStateValidator,
  defaultBrowserWindowOptions,
  getAllWindowsExcludingOffscreen,
  getLastFocused
};
