var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import "../../../workbench/browser/parts/titlebar/media/titlebarpart.css";
import "./media/titlebarpart.css";
import { MultiWindowParts, Part } from "../../../workbench/browser/part.js";
import { getZoomFactor, isWCOEnabled, getWCOTitlebarAreaRect, isFullscreen, onDidChangeFullscreen } from "../../../base/browser/browser.js";
import { hasCustomTitlebar, hasNativeTitlebar, DEFAULT_CUSTOM_TITLEBAR_HEIGHT, getTitleBarStyle, getWindowControlsStyle, WindowControlsStyle } from "../../../platform/window/common/window.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { agentsBackground, agentsPanelForeground } from "../../common/theme.js";
import { isMacintosh, isWeb, isNative, platformLocale } from "../../../base/common/platform.js";
import { EventType, EventHelper, append, $, addDisposableListener, prepend, getWindow, getWindowId } from "../../../base/browser/dom.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { Parts, IWorkbenchLayoutService } from "../../../workbench/services/layout/browser/layoutService.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IHostService } from "../../../workbench/services/host/browser/host.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../platform/actions/browser/toolbar.js";
import { mainWindow } from "../../../base/browser/window.js";
import { safeIntl } from "../../../base/common/date.js";
import { WindowTitle } from "../../../workbench/browser/parts/titlebar/windowTitle.js";
import { Menus } from "../menus.js";
import { IsNewChatSessionContext } from "../../common/contextkeys.js";
const commandCenterContextKeys = /* @__PURE__ */ new Set([IsNewChatSessionContext.key]);
let TitlebarPart = class extends Part {
  constructor(id, targetWindow, contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService) {
    super(id, { hasTitle: false }, themeService, storageService, layoutService);
    this.contextMenuService = contextMenuService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.hostService = hostService;
    //#region IView
    this.minimumWidth = 0;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    //#endregion
    //#region Events
    this._onMenubarVisibilityChange = this._register(new Emitter());
    this.onMenubarVisibilityChange = this._onMenubarVisibilityChange.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.leftSpacerWidth = 0;
    this.isInactive = false;
    this.titleBarStyle = getTitleBarStyle(this.configurationService);
    this.registerListeners(getWindowId(targetWindow));
  }
  get minimumHeight() {
    const wcoEnabled = isWeb && isWCOEnabled();
    let value = DEFAULT_CUSTOM_TITLEBAR_HEIGHT;
    if (wcoEnabled) {
      value = Math.max(value, getWCOTitlebarAreaRect(getWindow(this.element))?.height ?? 0);
    }
    return value / (this.preventZoom ? getZoomFactor(getWindow(this.element)) : 1);
  }
  get maximumHeight() {
    return this.minimumHeight;
  }
  get leftContainer() {
    return this.leftContent;
  }
  get rightContainer() {
    return this.rightContent;
  }
  get rightWindowControlsContainer() {
    return this.windowControlsContainer;
  }
  registerListeners(targetWindowId) {
    this._register(this.hostService.onDidChangeFocus((focused) => focused ? this.onFocus() : this.onBlur()));
    this._register(this.hostService.onDidChangeActiveWindow((windowId) => windowId === targetWindowId ? this.onFocus() : this.onBlur()));
  }
  onBlur() {
    this.isInactive = true;
    this.updateStyles();
  }
  onFocus() {
    this.isInactive = false;
    this.updateStyles();
  }
  updateProperties(_properties) {
  }
  registerVariables(_variables) {
  }
  updateOptions(_options) {
  }
  createContentArea(parent) {
    this.element = parent;
    this.rootContainer = append(parent, $(".titlebar-container.sessions-titlebar-container.has-center"));
    prepend(this.rootContainer, $("div.titlebar-drag-region"));
    this.leftContent = append(this.rootContainer, $(".titlebar-left"));
    this.centerContent = append(this.rootContainer, $(".titlebar-center"));
    this.rightContent = append(this.rootContainer, $(".titlebar-right"));
    let rightWindowControlsContainer;
    if (!hasNativeTitlebar(this.configurationService, this.titleBarStyle)) {
      let primaryWindowControlsLocation = isMacintosh ? "left" : "right";
      if (isMacintosh && isNative) {
        const localeInfo = safeIntl.Locale(platformLocale).value;
        const textInfo = localeInfo.textInfo;
        if (textInfo?.direction === "rtl") {
          primaryWindowControlsLocation = "right";
        }
      }
      if (isMacintosh && isNative && primaryWindowControlsLocation === "left") {
        const spacer = append(this.leftContent, $("div.window-controls-container"));
        const updateSpacerVisibility = () => {
          const fullscreen = isFullscreen(mainWindow);
          spacer.style.display = fullscreen ? "none" : "";
          this.leftSpacerWidth = fullscreen ? 0 : 70;
        };
        updateSpacerVisibility();
        spacer.style.width = `${this.leftSpacerWidth}px`;
        spacer.style.flexShrink = "0";
        this._register(onDidChangeFullscreen((windowId) => {
          if (windowId === getWindowId(mainWindow)) {
            updateSpacerVisibility();
          }
        }));
      } else if (getWindowControlsStyle(this.configurationService) === WindowControlsStyle.HIDDEN) {
      } else {
        const primaryWindowControlsContainer = this.windowControlsContainer = append(primaryWindowControlsLocation === "left" ? this.leftContent : this.rightContent, $("div.window-controls-container"));
        if (primaryWindowControlsLocation === "right") {
          rightWindowControlsContainer = primaryWindowControlsContainer;
        }
        if (isWeb) {
          const secondaryWindowControlsContainer = append(primaryWindowControlsLocation === "left" ? this.rightContent : this.leftContent, $("div.window-controls-container"));
          if (primaryWindowControlsLocation === "left") {
            rightWindowControlsContainer = secondaryWindowControlsContainer;
          }
        }
        if (isWCOEnabled()) {
          this.windowControlsContainer.classList.add("wco-enabled");
        }
      }
    }
    this.leftToolbarContainer = append(this.leftContent, $("div.left-toolbar-container"));
    this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, this.leftToolbarContainer, Menus.TitleBarLeftLayout, {
      contextMenu: Menus.TitleBarContext,
      telemetrySource: "titlePart.left",
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: { primaryGroup: () => true }
    }));
    const centerNavContainer = append(this.centerContent, $("div.titlebar-actions-container.titlebar-center-nav-container"));
    this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, centerNavContainer, Menus.TitleBarCenterLeft, {
      contextMenu: Menus.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "titlePart.centerLeft",
      toolbarOptions: { primaryGroup: () => true }
    }));
    const windowTitle = append(this.centerContent, $("div.window-title"));
    const centerToolbarContainer = append(windowTitle, $("div.command-center"));
    const centerToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, centerToolbarContainer, Menus.CommandCenter, {
      contextMenu: Menus.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "commandCenter",
      toolbarOptions: { primaryGroup: () => true }
    }));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(commandCenterContextKeys)) {
        centerToolbar.refresh();
      }
    }));
    const centerActionsContainer = append(this.centerContent, $("div.titlebar-actions-container.titlebar-center-actions-container"));
    this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, centerActionsContainer, Menus.TitleBarCenterRight, {
      contextMenu: Menus.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "titlePart.centerRight",
      toolbarOptions: { primaryGroup: () => true }
    }));
    const rightToolbarContainer = prepend(this.rightContent, $("div.titlebar-actions-container.titlebar-right-layout-container"));
    this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, rightToolbarContainer, Menus.TitleBarRightLayout, {
      contextMenu: Menus.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "titlePart.right",
      toolbarOptions: { primaryGroup: () => true }
    }));
    const sessionActionsContainer = prepend(this.rightContent, $("div.titlebar-actions-container.titlebar-session-actions-container"));
    this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, sessionActionsContainer, Menus.TitleBarSessionMenu, {
      contextMenu: Menus.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "titlePart.sessionActions",
      toolbarOptions: { primaryGroup: () => true }
    }));
    const updateToolBarElement = $("div.titlebar-actions-container.titlebar-update-container");
    this.rightContent.insertBefore(updateToolBarElement, rightWindowControlsContainer ?? null);
    this.updateToolBarElement = updateToolBarElement;
    const updateToolBar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, updateToolBarElement, Menus.TitleBarUpdate, {
      contextMenu: Menus.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "titlePart.update",
      toolbarOptions: { primaryGroup: () => true }
    }));
    this._register(updateToolBar.onDidChangeMenuItems(() => this.updateUpdateToolBarOverflow()));
    this._register(addDisposableListener(this.rootContainer, EventType.CONTEXT_MENU, (e) => {
      EventHelper.stop(e);
      this.onContextMenu(e);
    }));
    this.updateStyles();
    return this.element;
  }
  updateStyles() {
    super.updateStyles();
    if (this.element) {
      this.element.classList.toggle("inactive", this.isInactive);
      const titleBarBackground = this.getColor(agentsBackground);
      this.element.style.backgroundColor = titleBarBackground || "";
      const titleForeground = this.getColor(agentsPanelForeground);
      this.element.style.color = titleForeground || "";
    }
  }
  onContextMenu(e) {
    const event = new StandardMouseEvent(getWindow(this.element), e);
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      menuId: Menus.TitleBarContext,
      contextKeyService: this.contextKeyService,
      domForShadowRoot: isMacintosh && isNative ? event.target : void 0
    });
  }
  get hasZoomableElements() {
    return true;
  }
  get preventZoom() {
    return getZoomFactor(getWindow(this.element)) < 1 || !this.hasZoomableElements;
  }
  layout(width, height) {
    this.updateLayout();
    super.layoutContents(width, height);
    this.updateUpdateToolBarOverflow();
  }
  updateUpdateToolBarOverflow() {
    const element = this.updateToolBarElement;
    if (!element) {
      return;
    }
    if (element.classList.contains("has-no-actions")) {
      element.classList.remove("overflowing");
      return;
    }
    element.classList.remove("overflowing");
    element.classList.toggle("overflowing", this.rootContainer.scrollWidth > this.rootContainer.clientWidth);
  }
  updateLayout() {
    if (!hasCustomTitlebar(this.configurationService, this.titleBarStyle)) {
      return;
    }
    const zoomFactor = getZoomFactor(getWindow(this.element));
    this.element.style.setProperty("--zoom-factor", zoomFactor.toString());
    this.rootContainer.classList.toggle("counter-zoom", this.preventZoom);
  }
  focus() {
    this.element.querySelector('[tabindex]:not([tabindex="-1"])')?.focus();
  }
  toJSON() {
    return { type: Parts.TITLEBAR_PART };
  }
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
};
TitlebarPart = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IWorkbenchLayoutService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IHostService)
], TitlebarPart);
let MainTitlebarPart = class extends TitlebarPart {
  constructor(contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService) {
    super(Parts.TITLEBAR_PART, mainWindow, contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService);
  }
};
MainTitlebarPart = __decorateClass([
  __decorateParam(0, IContextMenuService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IHostService)
], MainTitlebarPart);
let AuxiliaryTitlebarPart = class extends TitlebarPart {
  constructor(container, mainTitlebar, contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService) {
    const id = AuxiliaryTitlebarPart.COUNTER++;
    super(`workbench.parts.auxiliaryTitle.${id}`, getWindow(container), contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService);
    this.container = container;
    this.mainTitlebar = mainTitlebar;
  }
  static {
    this.COUNTER = 1;
  }
  get height() {
    return this.minimumHeight;
  }
  get preventZoom() {
    return getZoomFactor(getWindow(this.element)) < 1 || !this.mainTitlebar.hasZoomableElements;
  }
};
AuxiliaryTitlebarPart = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IWorkbenchLayoutService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IHostService)
], AuxiliaryTitlebarPart);
let TitleService = class extends MultiWindowParts {
  constructor(instantiationService, storageService, themeService) {
    super("workbench.agentSessionsTitleService", themeService, storageService);
    this.instantiationService = instantiationService;
    this.mainPart = this._register(this.createMainTitlebarPart());
    this.onMenubarVisibilityChange = this.mainPart.onMenubarVisibilityChange;
    this._register(this.registerPart(this.mainPart));
  }
  createMainTitlebarPart() {
    return this.instantiationService.createInstance(MainTitlebarPart);
  }
  //#region Auxiliary Titlebar Parts
  createAuxiliaryTitlebarPart(container, editorGroupsContainer, instantiationService) {
    const titlebarPartContainer = $(".part.titlebar", { role: "none" });
    titlebarPartContainer.style.position = "relative";
    container.insertBefore(titlebarPartContainer, container.firstChild);
    const disposables = new DisposableStore();
    const titlebarPart = this.doCreateAuxiliaryTitlebarPart(titlebarPartContainer, editorGroupsContainer, instantiationService);
    disposables.add(this.registerPart(titlebarPart));
    disposables.add(Event.runAndSubscribe(titlebarPart.onDidChange, () => titlebarPartContainer.style.height = `${titlebarPart.height}px`));
    titlebarPart.create(titlebarPartContainer);
    Event.once(titlebarPart.onWillDispose)(() => disposables.dispose());
    return titlebarPart;
  }
  doCreateAuxiliaryTitlebarPart(container, _editorGroupsContainer, instantiationService) {
    return instantiationService.createInstance(AuxiliaryTitlebarPart, container, this.mainPart);
  }
  updateProperties(properties) {
    for (const part of this.parts) {
      part.updateProperties(properties);
    }
  }
  registerVariables(variables) {
    for (const part of this.parts) {
      part.registerVariables(variables);
    }
  }
  get windowTitle() {
    if (!this._windowTitle) {
      this._windowTitle = this._register(this.instantiationService.createInstance(WindowTitle, mainWindow));
    }
    return this._windowTitle;
  }
  //#endregion
};
TitleService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IThemeService)
], TitleService);
export {
  AuxiliaryTitlebarPart,
  MainTitlebarPart,
  TitleService,
  TitlebarPart
};
