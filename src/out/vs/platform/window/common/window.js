import { isMacintosh, isNative, isWeb } from "../../../base/common/platform.js";
const WindowMinimumSize = {
  WIDTH: 400,
  WIDTH_WITH_VERTICAL_PANEL: 600,
  HEIGHT: 270
};
function isOpenedAuxiliaryWindow(candidate) {
  return typeof candidate.parentId === "number";
}
var AgentsWindowOpenSource = /* @__PURE__ */ ((AgentsWindowOpenSource2) => {
  AgentsWindowOpenSource2["CommandPalette"] = "commandPalette";
  AgentsWindowOpenSource2["KeyboardShortcut"] = "keyboardShortcut";
  AgentsWindowOpenSource2["TitleBar"] = "titleBar";
  AgentsWindowOpenSource2["ChatTitleBar"] = "chatTitleBar";
  AgentsWindowOpenSource2["ChatHandoff"] = "chatHandoff";
  AgentsWindowOpenSource2["Banner"] = "banner";
  AgentsWindowOpenSource2["CommandLine"] = "commandLine";
  AgentsWindowOpenSource2["Unknown"] = "unknown";
  return AgentsWindowOpenSource2;
})(AgentsWindowOpenSource || {});
function isAgentsWindowOpenSource(value) {
  switch (value) {
    case "commandPalette" /* CommandPalette */:
    case "keyboardShortcut" /* KeyboardShortcut */:
    case "titleBar" /* TitleBar */:
    case "chatTitleBar" /* ChatTitleBar */:
    case "chatHandoff" /* ChatHandoff */:
    case "banner" /* Banner */:
    case "commandLine" /* CommandLine */:
    case "unknown" /* Unknown */:
      return true;
    default:
      return false;
  }
}
function isWorkspaceToOpen(uriToOpen) {
  return !!uriToOpen.workspaceUri;
}
function isFolderToOpen(uriToOpen) {
  return !!uriToOpen.folderUri;
}
function isFileToOpen(uriToOpen) {
  return !!uriToOpen.fileUri;
}
var MenuSettings = /* @__PURE__ */ ((MenuSettings2) => {
  MenuSettings2["MenuStyle"] = "window.menuStyle";
  MenuSettings2["MenuBarVisibility"] = "window.menuBarVisibility";
  return MenuSettings2;
})(MenuSettings || {});
var MenuStyleConfiguration = /* @__PURE__ */ ((MenuStyleConfiguration2) => {
  MenuStyleConfiguration2["CUSTOM"] = "custom";
  MenuStyleConfiguration2["NATIVE"] = "native";
  MenuStyleConfiguration2["INHERIT"] = "inherit";
  return MenuStyleConfiguration2;
})(MenuStyleConfiguration || {});
function hasNativeContextMenu(configurationService, titleBarStyle) {
  if (isWeb) {
    return false;
  }
  const nativeTitle = hasNativeTitlebar(configurationService, titleBarStyle);
  const windowConfigurations = configurationService.getValue("window");
  if (windowConfigurations?.menuStyle === "native" /* NATIVE */) {
    if (!isMacintosh && !nativeTitle) {
      return false;
    }
    return true;
  }
  if (windowConfigurations?.menuStyle === "custom" /* CUSTOM */) {
    return false;
  }
  return nativeTitle;
}
function hasNativeMenu(configurationService, titleBarStyle) {
  if (isWeb) {
    return false;
  }
  if (isMacintosh) {
    return true;
  }
  return hasNativeContextMenu(configurationService, titleBarStyle);
}
function getMenuBarVisibility(configurationService) {
  const menuBarVisibility = configurationService.getValue("window.menuBarVisibility" /* MenuBarVisibility */);
  if (menuBarVisibility === "default" || menuBarVisibility === "compact" && hasNativeMenu(configurationService) || isMacintosh && isNative) {
    return "classic";
  } else {
    return menuBarVisibility;
  }
}
var TitleBarSetting = /* @__PURE__ */ ((TitleBarSetting2) => {
  TitleBarSetting2["TITLE_BAR_STYLE"] = "window.titleBarStyle";
  TitleBarSetting2["CUSTOM_TITLE_BAR_VISIBILITY"] = "window.customTitleBarVisibility";
  return TitleBarSetting2;
})(TitleBarSetting || {});
var TitlebarStyle = /* @__PURE__ */ ((TitlebarStyle2) => {
  TitlebarStyle2["NATIVE"] = "native";
  TitlebarStyle2["CUSTOM"] = "custom";
  return TitlebarStyle2;
})(TitlebarStyle || {});
var WindowControlsStyle = /* @__PURE__ */ ((WindowControlsStyle2) => {
  WindowControlsStyle2["NATIVE"] = "native";
  WindowControlsStyle2["CUSTOM"] = "custom";
  WindowControlsStyle2["HIDDEN"] = "hidden";
  return WindowControlsStyle2;
})(WindowControlsStyle || {});
var CustomTitleBarVisibility = /* @__PURE__ */ ((CustomTitleBarVisibility2) => {
  CustomTitleBarVisibility2["AUTO"] = "auto";
  CustomTitleBarVisibility2["WINDOWED"] = "windowed";
  CustomTitleBarVisibility2["NEVER"] = "never";
  return CustomTitleBarVisibility2;
})(CustomTitleBarVisibility || {});
function hasCustomTitlebar(configurationService, titleBarStyle) {
  return true;
}
function hasNativeTitlebar(configurationService, titleBarStyle) {
  if (!titleBarStyle) {
    titleBarStyle = getTitleBarStyle(configurationService);
  }
  return titleBarStyle === "native" /* NATIVE */;
}
function getTitleBarStyle(configurationService) {
  if (isWeb) {
    return "custom" /* CUSTOM */;
  }
  const configuration = configurationService.getValue("window");
  if (configuration) {
    const useNativeTabs = isMacintosh && configuration.nativeTabs === true;
    if (useNativeTabs) {
      return "native" /* NATIVE */;
    }
    const useSimpleFullScreen = isMacintosh && configuration.nativeFullScreen === false;
    if (useSimpleFullScreen) {
      return "native" /* NATIVE */;
    }
    const style = configuration.titleBarStyle;
    if (style === "native" /* NATIVE */ || style === "custom" /* CUSTOM */) {
      return style;
    }
  }
  return "custom" /* CUSTOM */;
}
function getWindowControlsStyle(configurationService) {
  if (isWeb || isMacintosh || getTitleBarStyle(configurationService) === "native" /* NATIVE */) {
    return "native" /* NATIVE */;
  }
  const configuration = configurationService.getValue("window");
  const style = configuration?.controlsStyle;
  if (style === "custom" /* CUSTOM */ || style === "hidden" /* HIDDEN */) {
    return style;
  }
  return "native" /* NATIVE */;
}
const DEFAULT_CUSTOM_TITLEBAR_HEIGHT = 35;
function useWindowControlsOverlay(configurationService) {
  if (isWeb) {
    return false;
  }
  if (hasNativeTitlebar(configurationService)) {
    return false;
  }
  if (!isMacintosh) {
    const setting = getWindowControlsStyle(configurationService);
    if (setting === "custom" /* CUSTOM */ || setting === "hidden" /* HIDDEN */) {
      return false;
    }
  }
  return true;
}
function useNativeFullScreen(configurationService) {
  const windowConfig = configurationService.getValue("window");
  if (!windowConfig || typeof windowConfig.nativeFullScreen !== "boolean") {
    return true;
  }
  if (windowConfig.nativeTabs) {
    return true;
  }
  return windowConfig.nativeFullScreen !== false;
}
function zoomLevelToZoomFactor(zoomLevel = 0) {
  return 1.2 ** zoomLevel;
}
const DEFAULT_EMPTY_WINDOW_SIZE = { width: 1200, height: 800 };
const DEFAULT_WORKSPACE_WINDOW_SIZE = { width: 1440, height: 900 };
const DEFAULT_AUX_WINDOW_SIZE = { width: 1024, height: 768 };
export {
  AgentsWindowOpenSource,
  CustomTitleBarVisibility,
  DEFAULT_AUX_WINDOW_SIZE,
  DEFAULT_CUSTOM_TITLEBAR_HEIGHT,
  DEFAULT_EMPTY_WINDOW_SIZE,
  DEFAULT_WORKSPACE_WINDOW_SIZE,
  MenuSettings,
  MenuStyleConfiguration,
  TitleBarSetting,
  TitlebarStyle,
  WindowControlsStyle,
  WindowMinimumSize,
  getMenuBarVisibility,
  getTitleBarStyle,
  getWindowControlsStyle,
  hasCustomTitlebar,
  hasNativeContextMenu,
  hasNativeMenu,
  hasNativeTitlebar,
  isAgentsWindowOpenSource,
  isFileToOpen,
  isFolderToOpen,
  isOpenedAuxiliaryWindow,
  isWorkspaceToOpen,
  useNativeFullScreen,
  useWindowControlsOverlay,
  zoomLevelToZoomFactor
};
