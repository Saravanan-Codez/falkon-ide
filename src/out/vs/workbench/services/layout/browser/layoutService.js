import { refineServiceDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { isMacintosh, isNative, isWeb } from "../../../../base/common/platform.js";
import { isAuxiliaryWindow, mainWindow } from "../../../../base/browser/window.js";
import { CustomTitleBarVisibility, TitleBarSetting, getMenuBarVisibility, hasCustomTitlebar, hasNativeMenu, hasNativeTitlebar } from "../../../../platform/window/common/window.js";
import { isFullscreen, isWCOEnabled } from "../../../../base/browser/browser.js";
const IWorkbenchLayoutService = refineServiceDecorator(ILayoutService);
var Parts = /* @__PURE__ */ ((Parts2) => {
  Parts2["TITLEBAR_PART"] = "workbench.parts.titlebar";
  Parts2["BANNER_PART"] = "workbench.parts.banner";
  Parts2["ACTIVITYBAR_PART"] = "workbench.parts.activitybar";
  Parts2["SIDEBAR_PART"] = "workbench.parts.sidebar";
  Parts2["PANEL_PART"] = "workbench.parts.panel";
  Parts2["AUXILIARYBAR_PART"] = "workbench.parts.auxiliarybar";
  Parts2["SESSIONS_PART"] = "workbench.parts.sessions";
  Parts2["CUSTOM_VIEW_GRID_PART"] = "workbench.parts.customViewGrid";
  Parts2["EDITOR_PART"] = "workbench.parts.editor";
  Parts2["STATUSBAR_PART"] = "workbench.parts.statusbar";
  return Parts2;
})(Parts || {});
var ZenModeSettings = /* @__PURE__ */ ((ZenModeSettings2) => {
  ZenModeSettings2["SHOW_TABS"] = "zenMode.showTabs";
  ZenModeSettings2["HIDE_LINENUMBERS"] = "zenMode.hideLineNumbers";
  ZenModeSettings2["HIDE_STATUSBAR"] = "zenMode.hideStatusBar";
  ZenModeSettings2["HIDE_ACTIVITYBAR"] = "zenMode.hideActivityBar";
  ZenModeSettings2["CENTER_LAYOUT"] = "zenMode.centerLayout";
  ZenModeSettings2["FULLSCREEN"] = "zenMode.fullScreen";
  ZenModeSettings2["RESTORE"] = "zenMode.restore";
  ZenModeSettings2["SILENT_NOTIFICATIONS"] = "zenMode.silentNotifications";
  return ZenModeSettings2;
})(ZenModeSettings || {});
var LayoutSettings = /* @__PURE__ */ ((LayoutSettings2) => {
  LayoutSettings2["ACTIVITY_BAR_LOCATION"] = "workbench.activityBar.location";
  LayoutSettings2["ACTIVITY_BAR_AUTO_HIDE"] = "workbench.activityBar.autoHide";
  LayoutSettings2["ACTIVITY_BAR_COMPACT"] = "workbench.activityBar.compact";
  LayoutSettings2["EDITOR_TABS_MODE"] = "workbench.editor.showTabs";
  LayoutSettings2["EDITOR_ACTIONS_LOCATION"] = "workbench.editor.editorActionsLocation";
  LayoutSettings2["COMMAND_CENTER"] = "window.commandCenter";
  LayoutSettings2["LAYOUT_ACTIONS"] = "workbench.layoutControl.enabled";
  LayoutSettings2["SHADOWS"] = "workbench.shadows";
  LayoutSettings2["MODERN_UI"] = "workbench.experimental.modernUI";
  return LayoutSettings2;
})(LayoutSettings || {});
const FLOATING_PANEL_MARGIN = 4;
const FLOATING_PANEL_INNER_MARGIN = 2;
var ActivityBarPosition = /* @__PURE__ */ ((ActivityBarPosition2) => {
  ActivityBarPosition2["DEFAULT"] = "default";
  ActivityBarPosition2["TOP"] = "top";
  ActivityBarPosition2["BOTTOM"] = "bottom";
  ActivityBarPosition2["HIDDEN"] = "hidden";
  return ActivityBarPosition2;
})(ActivityBarPosition || {});
var EditorTabsMode = /* @__PURE__ */ ((EditorTabsMode2) => {
  EditorTabsMode2["MULTIPLE"] = "multiple";
  EditorTabsMode2["SINGLE"] = "single";
  EditorTabsMode2["NONE"] = "none";
  return EditorTabsMode2;
})(EditorTabsMode || {});
var EditorActionsLocation = /* @__PURE__ */ ((EditorActionsLocation2) => {
  EditorActionsLocation2["DEFAULT"] = "default";
  EditorActionsLocation2["TITLEBAR"] = "titleBar";
  EditorActionsLocation2["HIDDEN"] = "hidden";
  return EditorActionsLocation2;
})(EditorActionsLocation || {});
var Position = /* @__PURE__ */ ((Position2) => {
  Position2[Position2["LEFT"] = 0] = "LEFT";
  Position2[Position2["RIGHT"] = 1] = "RIGHT";
  Position2[Position2["BOTTOM"] = 2] = "BOTTOM";
  Position2[Position2["TOP"] = 3] = "TOP";
  return Position2;
})(Position || {});
function isHorizontal(position) {
  return position === 2 /* BOTTOM */ || position === 3 /* TOP */;
}
var PartOpensMaximizedOptions = /* @__PURE__ */ ((PartOpensMaximizedOptions2) => {
  PartOpensMaximizedOptions2[PartOpensMaximizedOptions2["ALWAYS"] = 0] = "ALWAYS";
  PartOpensMaximizedOptions2[PartOpensMaximizedOptions2["NEVER"] = 1] = "NEVER";
  PartOpensMaximizedOptions2[PartOpensMaximizedOptions2["REMEMBER_LAST"] = 2] = "REMEMBER_LAST";
  return PartOpensMaximizedOptions2;
})(PartOpensMaximizedOptions || {});
function positionToString(position) {
  switch (position) {
    case 0 /* LEFT */:
      return "left";
    case 1 /* RIGHT */:
      return "right";
    case 2 /* BOTTOM */:
      return "bottom";
    case 3 /* TOP */:
      return "top";
    default:
      return "bottom";
  }
}
function isFloatingTopEdgeExposed(layoutService, targetWindow) {
  return !layoutService.isVisible("workbench.parts.titlebar" /* TITLEBAR_PART */, targetWindow) && !layoutService.isVisible("workbench.parts.banner" /* BANNER_PART */);
}
function getFloatingOuterEdgeOwners(layoutService) {
  if (!layoutService.isFloatingPanelsEnabled()) {
    return { left: void 0, right: void 0 };
  }
  const sideBarLeft = layoutService.getSideBarPosition() === 0 /* LEFT */;
  const panelPosition = layoutService.getPanelPosition();
  const verticalPanelVisible = !isHorizontal(panelPosition) && layoutService.isVisible("workbench.parts.panel" /* PANEL_PART */);
  const panelInLeftSequence = verticalPanelVisible && panelPosition === 0 /* LEFT */;
  const panelInRightSequence = verticalPanelVisible && panelPosition === 1 /* RIGHT */;
  const sideBarGroup = ["workbench.parts.activitybar" /* ACTIVITYBAR_PART */, "workbench.parts.sidebar" /* SIDEBAR_PART */];
  const panelGroup = ["workbench.parts.panel" /* PANEL_PART */];
  const fullOrder = sideBarLeft ? [
    ...sideBarGroup,
    ...panelInLeftSequence ? panelGroup : [],
    "workbench.parts.editor" /* EDITOR_PART */,
    ...panelInRightSequence ? panelGroup : [],
    "workbench.parts.auxiliarybar" /* AUXILIARYBAR_PART */
  ] : [
    "workbench.parts.auxiliarybar" /* AUXILIARYBAR_PART */,
    ...panelInLeftSequence ? panelGroup : [],
    "workbench.parts.editor" /* EDITOR_PART */,
    ...panelInRightSequence ? panelGroup : [],
    ...[...sideBarGroup].reverse()
    // activity bar is outermost on the right edge
  ];
  return {
    left: resolveFloatingOuterOwner(layoutService, fullOrder),
    right: resolveFloatingOuterOwner(layoutService, [...fullOrder].reverse())
  };
}
function resolveFloatingOuterOwner(layoutService, orderedParts) {
  for (const part of orderedParts) {
    const visible = part === "workbench.parts.editor" /* EDITOR_PART */ ? layoutService.isVisible("workbench.parts.editor" /* EDITOR_PART */, mainWindow) : layoutService.isVisible(part);
    if (!visible) {
      continue;
    }
    return part === "workbench.parts.activitybar" /* ACTIVITYBAR_PART */ ? void 0 : part;
  }
  return void 0;
}
function getFloatingOuterGutterEdges(layoutService, partId) {
  if (!layoutService.isFloatingPanelsEnabled()) {
    return { left: false, right: false };
  }
  if (partId === "workbench.parts.panel" /* PANEL_PART */ && isHorizontal(layoutService.getPanelPosition())) {
    return getFloatingHorizontalPanelOuterEdges(layoutService);
  }
  const owners = getFloatingOuterEdgeOwners(layoutService);
  return { left: owners.left === partId, right: owners.right === partId };
}
function getFloatingSidebarSiblingToEditorStatus(layoutService) {
  const alignment = layoutService.getPanelAlignment();
  const sideBarOnLeft = layoutService.getSideBarPosition() === 0 /* LEFT */;
  return {
    sideBar: !(alignment === "center" || sideBarOnLeft && alignment === "right" || !sideBarOnLeft && alignment === "left"),
    auxBar: !(alignment === "center" || !sideBarOnLeft && alignment === "right" || sideBarOnLeft && alignment === "left")
  };
}
function getFloatingPaneCompositeVerticalMargins(layoutService, partId, targetWindow) {
  if (!layoutService.isFloatingPanelsEnabled()) {
    return { top: 0, bottom: 0 };
  }
  const topEdgeExposed = isFloatingTopEdgeExposed(layoutService, targetWindow);
  const panelPosition = layoutService.getPanelPosition();
  const panelVisible = layoutService.isVisible("workbench.parts.panel" /* PANEL_PART */);
  const isSideBar = partId === "workbench.parts.sidebar" /* SIDEBAR_PART */ || partId === "workbench.parts.auxiliarybar" /* AUXILIARYBAR_PART */;
  const siblingStatus = getFloatingSidebarSiblingToEditorStatus(layoutService);
  const isSiblingToEditor = partId === "workbench.parts.sidebar" /* SIDEBAR_PART */ ? siblingStatus.sideBar : siblingStatus.auxBar;
  const facesPanelAbove = panelVisible && panelPosition === 3 /* TOP */ && isSideBar && isSiblingToEditor;
  const facesEditorBelow = partId === "workbench.parts.panel" /* PANEL_PART */ && panelPosition === 3 /* TOP */;
  const facesPanelBelow = panelVisible && panelPosition === 2 /* BOTTOM */ && isSideBar && isSiblingToEditor;
  const atWindowBottom = !facesEditorBelow && !facesPanelBelow;
  const statusBarVisible = layoutService.isVisible("workbench.parts.statusbar" /* STATUSBAR_PART */, targetWindow);
  return {
    top: facesPanelAbove ? FLOATING_PANEL_MARGIN : topEdgeExposed ? FLOATING_PANEL_MARGIN * 2 : FLOATING_PANEL_MARGIN,
    bottom: atWindowBottom ? statusBarVisible ? FLOATING_PANEL_MARGIN : FLOATING_PANEL_MARGIN * 2 : FLOATING_PANEL_INNER_MARGIN
  };
}
function getFloatingEditorVerticalMargins(layoutService, targetWindow) {
  if (!layoutService.isFloatingPanelsEnabled()) {
    return { top: 0, bottom: 0 };
  }
  const panelVisible = layoutService.isVisible("workbench.parts.panel" /* PANEL_PART */);
  const panelPosition = layoutService.getPanelPosition();
  const panelAtTop = panelVisible && panelPosition === 3 /* TOP */;
  const panelAtBottom = panelVisible && panelPosition === 2 /* BOTTOM */;
  return {
    top: panelAtTop ? FLOATING_PANEL_MARGIN : isFloatingTopEdgeExposed(layoutService, targetWindow) ? FLOATING_PANEL_MARGIN * 2 : FLOATING_PANEL_MARGIN,
    bottom: panelAtBottom ? FLOATING_PANEL_INNER_MARGIN : layoutService.isVisible("workbench.parts.statusbar" /* STATUSBAR_PART */, targetWindow) ? FLOATING_PANEL_MARGIN : FLOATING_PANEL_MARGIN * 2
  };
}
function getFloatingHorizontalPanelOuterEdges(layoutService) {
  if (!layoutService.isVisible("workbench.parts.panel" /* PANEL_PART */)) {
    return { left: false, right: false };
  }
  const sideBarLeft = layoutService.getSideBarPosition() === 0 /* LEFT */;
  const { sideBar: sideBarSiblingToEditor, auxBar: auxSiblingToEditor } = getFloatingSidebarSiblingToEditorStatus(layoutService);
  const sideBarSideReached = !layoutService.isVisible("workbench.parts.activitybar" /* ACTIVITYBAR_PART */) && (!layoutService.isVisible("workbench.parts.sidebar" /* SIDEBAR_PART */) || sideBarSiblingToEditor);
  const auxSideReached = !layoutService.isVisible("workbench.parts.auxiliarybar" /* AUXILIARYBAR_PART */) || auxSiblingToEditor;
  return sideBarLeft ? { left: sideBarSideReached, right: auxSideReached } : { left: auxSideReached, right: sideBarSideReached };
}
const positionsByString = {
  [positionToString(0 /* LEFT */)]: 0 /* LEFT */,
  [positionToString(1 /* RIGHT */)]: 1 /* RIGHT */,
  [positionToString(2 /* BOTTOM */)]: 2 /* BOTTOM */,
  [positionToString(3 /* TOP */)]: 3 /* TOP */
};
function positionFromString(str) {
  return positionsByString[str];
}
function partOpensMaximizedSettingToString(setting) {
  switch (setting) {
    case 0 /* ALWAYS */:
      return "always";
    case 1 /* NEVER */:
      return "never";
    case 2 /* REMEMBER_LAST */:
      return "preserve";
    default:
      return "preserve";
  }
}
const partOpensMaximizedByString = {
  [partOpensMaximizedSettingToString(0 /* ALWAYS */)]: 0 /* ALWAYS */,
  [partOpensMaximizedSettingToString(1 /* NEVER */)]: 1 /* NEVER */,
  [partOpensMaximizedSettingToString(2 /* REMEMBER_LAST */)]: 2 /* REMEMBER_LAST */
};
function partOpensMaximizedFromString(str) {
  return partOpensMaximizedByString[str];
}
function isMultiWindowPart(part) {
  return part === "workbench.parts.editor" /* EDITOR_PART */ || part === "workbench.parts.statusbar" /* STATUSBAR_PART */ || part === "workbench.parts.titlebar" /* TITLEBAR_PART */;
}
function shouldShowCustomTitleBar(configurationService, window, menuBarToggled) {
  if (!hasCustomTitlebar(configurationService)) {
    return false;
  }
  const inFullscreen = isFullscreen(window);
  const nativeTitleBarEnabled = hasNativeTitlebar(configurationService);
  if (!isWeb) {
    const showCustomTitleBar = configurationService.getValue(TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY);
    if (showCustomTitleBar === CustomTitleBarVisibility.NEVER && nativeTitleBarEnabled || showCustomTitleBar === CustomTitleBarVisibility.WINDOWED && inFullscreen) {
      return false;
    }
  }
  if (!isTitleBarEmpty(configurationService)) {
    return true;
  }
  if (nativeTitleBarEnabled && hasNativeMenu(configurationService)) {
    return false;
  }
  if (isMacintosh && isNative) {
    return !inFullscreen;
  }
  if (isNative && !inFullscreen) {
    return true;
  }
  if (isWCOEnabled() && !inFullscreen) {
    return true;
  }
  const menuBarVisibility = !isAuxiliaryWindow(window) ? getMenuBarVisibility(configurationService) : "hidden";
  switch (menuBarVisibility) {
    case "classic":
      return !inFullscreen || !!menuBarToggled;
    case "compact":
    case "hidden":
      return false;
    case "toggle":
      return !!menuBarToggled;
    case "visible":
      return true;
    default:
      return isWeb ? false : !inFullscreen || !!menuBarToggled;
  }
}
function isTitleBarEmpty(configurationService) {
  if (configurationService.getValue("window.commandCenter" /* COMMAND_CENTER */)) {
    return false;
  }
  const activityBarPosition = configurationService.getValue("workbench.activityBar.location" /* ACTIVITY_BAR_LOCATION */);
  if (activityBarPosition === "top" /* TOP */ || activityBarPosition === "bottom" /* BOTTOM */) {
    return false;
  }
  const editorActionsLocation = configurationService.getValue("workbench.editor.editorActionsLocation" /* EDITOR_ACTIONS_LOCATION */);
  const editorTabsMode = configurationService.getValue("workbench.editor.showTabs" /* EDITOR_TABS_MODE */);
  if (editorActionsLocation === "titleBar" /* TITLEBAR */ || editorActionsLocation === "default" /* DEFAULT */ && editorTabsMode === "none" /* NONE */) {
    return false;
  }
  if (configurationService.getValue("workbench.layoutControl.enabled" /* LAYOUT_ACTIONS */)) {
    return false;
  }
  return true;
}
export {
  ActivityBarPosition,
  EditorActionsLocation,
  EditorTabsMode,
  FLOATING_PANEL_INNER_MARGIN,
  FLOATING_PANEL_MARGIN,
  IWorkbenchLayoutService,
  LayoutSettings,
  PartOpensMaximizedOptions,
  Parts,
  Position,
  ZenModeSettings,
  getFloatingEditorVerticalMargins,
  getFloatingOuterEdgeOwners,
  getFloatingOuterGutterEdges,
  getFloatingPaneCompositeVerticalMargins,
  getFloatingSidebarSiblingToEditorStatus,
  isFloatingTopEdgeExposed,
  isHorizontal,
  isMultiWindowPart,
  partOpensMaximizedFromString,
  positionFromString,
  positionToString,
  shouldShowCustomTitleBar
};
