import "../../workbench/browser/style.js";
import "./media/style.css";
import "./media/workbench.css";
import "./media/phoneLayout.css";
import { Disposable, DisposableStore, toDisposable } from "../../base/common/lifecycle.js";
import { Emitter, Event, setGlobalLeakWarningThreshold } from "../../base/common/event.js";
import { addDisposableGenericMouseDownListener, addDisposableListener, EventType, getActiveDocument, getActiveElement, getClientArea, getWindowId, getWindows, isAncestorUsingFlowTo, isHTMLElement, size, Dimension, runWhenWindowIdle } from "../../base/browser/dom.js";
import { DeferredPromise, RunOnceScheduler } from "../../base/common/async.js";
import { isFullscreen, onDidChangeFullscreen, isChrome, isFirefox, isSafari } from "../../base/browser/browser.js";
import { mark } from "../../base/common/performance.js";
import { onUnexpectedError, setUnexpectedErrorHandler } from "../../base/common/errors.js";
import { isWindows, isLinux, isWeb, isNative, isMacintosh } from "../../base/common/platform.js";
import { Parts, Position, IWorkbenchLayoutService, positionToString } from "../../workbench/services/layout/browser/layoutService.js";
import { Part } from "../../workbench/browser/part.js";
import { Orientation, SerializableGrid } from "../../base/browser/ui/grid/grid.js";
import { IEditorGroupsService } from "../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../workbench/services/editor/common/editorService.js";
import { IPaneCompositePartService } from "../../workbench/services/panecomposite/browser/panecomposite.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../workbench/common/views.js";
import { IInstantiationService, refineServiceDecorator } from "../../platform/instantiation/common/instantiation.js";
import { ITitleService } from "../../workbench/services/title/browser/titleService.js";
import { mainWindow } from "../../base/browser/window.js";
import { coalesce } from "../../base/common/arrays.js";
import { InstantiationService } from "../../platform/instantiation/common/instantiationService.js";
import { getSingletonServiceDescriptors } from "../../platform/instantiation/common/extensions.js";
import { ILifecycleService, LifecyclePhase } from "../../workbench/services/lifecycle/common/lifecycle.js";
import { IStorageService, WillSaveStateReason, StorageScope, StorageTarget } from "../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { IHostService } from "../../workbench/services/host/browser/host.js";
import { IDialogService } from "../../platform/dialogs/common/dialogs.js";
import { INotificationService } from "../../platform/notification/common/notification.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../platform/hover/browser/hover.js";
import { setHoverDelegateFactory } from "../../base/browser/ui/hover/hoverDelegateFactory.js";
import { setBaseLayerHoverDelegate } from "../../base/browser/ui/hover/hoverDelegate2.js";
import { Registry } from "../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../workbench/common/contributions.js";
import { EditorExtensions } from "../../workbench/common/editor.js";
import { alert, setARIAContainer } from "../../base/browser/ui/aria/aria.js";
import { localize } from "../../nls.js";
import { FontMeasurements } from "../../editor/browser/config/fontMeasurements.js";
import { createBareFontInfoFromRawSettings } from "../../editor/common/config/fontInfoFromSettings.js";
import { toErrorMessage } from "../../base/common/errorMessage.js";
import { WorkbenchContextKeysHandler } from "../../workbench/browser/contextkeys.js";
import { PixelRatio } from "../../base/browser/pixelRatio.js";
import { AccessibilityProgressSignalScheduler } from "../../platform/accessibilitySignal/browser/progressAccessibilitySignalScheduler.js";
import { setProgressAccessibilitySignalScheduler } from "../../base/browser/ui/progressbar/progressAccessibilitySignal.js";
import { AccessibleViewRegistry } from "../../platform/accessibility/browser/accessibleViewRegistry.js";
import { NotificationAccessibleView } from "../../workbench/browser/parts/notifications/notificationAccessibleView.js";
import { NotificationsCenter } from "../../workbench/browser/parts/notifications/notificationsCenter.js";
import { NotificationsAlerts } from "../../workbench/browser/parts/notifications/notificationsAlerts.js";
import { NotificationsStatus } from "../../workbench/browser/parts/notifications/notificationsStatus.js";
import { registerNotificationCommands } from "../../workbench/browser/parts/notifications/notificationsCommands.js";
import { CommandsRegistry } from "../../platform/commands/common/commands.js";
import { NotificationsToasts } from "../../workbench/browser/parts/notifications/notificationsToasts.js";
import { IMarkdownRendererService } from "../../platform/markdown/browser/markdownRenderer.js";
import { EditorMarkdownCodeBlockRenderer } from "../../editor/browser/widget/markdownRenderer/browser/editorMarkdownCodeBlockRenderer.js";
import { SyncDescriptor } from "../../platform/instantiation/common/descriptors.js";
import { TitleService } from "./parts/titlebarPart.js";
import { EDITOR_PART_DEFAULT_WIDTH, EDITOR_PART_MINIMUM_WIDTH } from "./parts/editorPartSizing.js";
import { IContextKeyService } from "../../platform/contextkey/common/contextkey.js";
import { CustomViewVisibleContext, EditorMaximizedContext, IsPhoneLayoutContext, SinglePaneLayoutEnabledContext } from "../common/contextkeys.js";
import {
  NotificationsPosition,
  NotificationsSettings,
  getNotificationsPosition
} from "../../workbench/common/notifications.js";
import { SessionsLayoutPolicy } from "./layoutPolicy.js";
import { AGENTS_PART_CARD_CLASS } from "./parts/agentsPartCard.js";
import { MobileNavigationStack } from "./mobileNavigationStack.js";
import { MobileTitlebarPart } from "./parts/mobile/mobileTitlebarPart.js";
import { IMobileVisualViewport } from "./parts/mobile/mobileVisualViewport.js";
import { autorun } from "../../base/common/observable.js";
import { ISessionsService } from "../services/sessions/browser/sessionsService.js";
import { ISessionsPartService } from "../services/sessions/browser/sessionsPartService.js";
import { ICustomViewService } from "../services/customView/browser/customViewService.js";
import { ICustomViewGridPartService } from "../services/customView/browser/customViewGridPartService.js";
import { ISessionsSetUpService } from "./sessionsSetUpService.js";
import { AGENTS_FLOATING_PANEL_GAP } from "../common/layoutConstants.js";
var LayoutClasses = /* @__PURE__ */ ((LayoutClasses2) => {
  LayoutClasses2["MODERN_UI_TABS"] = "modern-ui-tabs";
  LayoutClasses2["SIDEBAR_HIDDEN"] = "nosidebar";
  LayoutClasses2["MAIN_EDITOR_AREA_HIDDEN"] = "nomaineditorarea";
  LayoutClasses2["PANEL_HIDDEN"] = "nopanel";
  LayoutClasses2["AUXILIARYBAR_HIDDEN"] = "noauxiliarybar";
  LayoutClasses2["EDITOR_PANE_HIDDEN"] = "noeditorpane";
  LayoutClasses2["SESSIONS_HIDDEN"] = "nosessionspart";
  LayoutClasses2["CUSTOM_VIEW_GRID_HIDDEN"] = "nocustomviewgrid";
  LayoutClasses2["STATUSBAR_HIDDEN"] = "nostatusbar";
  LayoutClasses2["SHELL_GRADIENT_BACKGROUND"] = "shell-gradient-background";
  LayoutClasses2["FULLSCREEN"] = "fullscreen";
  LayoutClasses2["MAXIMIZED"] = "maximized";
  LayoutClasses2["PHONE_LAYOUT"] = "phone-layout";
  return LayoutClasses2;
})(LayoutClasses || {});
const IAgentWorkbenchLayoutService = refineServiceDecorator(IWorkbenchLayoutService);
const CLOSE_MOBILE_SIDEBAR_DRAWER_COMMAND_ID = "sessions.closeMobileSidebarDrawer";
class Workbench extends Disposable {
  //#endregion
  constructor(parent, options, serviceCollection, logService) {
    super();
    this.parent = parent;
    this.options = options;
    this.serviceCollection = serviceCollection;
    this.logService = logService;
    //#region Lifecycle Events
    this._onWillShutdown = this._register(new Emitter());
    this.onWillShutdown = this._onWillShutdown.event;
    this._onDidShutdown = this._register(new Emitter());
    this.onDidShutdown = this._onDidShutdown.event;
    //#endregion
    //#region Events
    this._onDidChangeZenMode = this._register(new Emitter());
    this.onDidChangeZenMode = this._onDidChangeZenMode.event;
    this._onDidChangeMainEditorCenteredLayout = this._register(new Emitter());
    this.onDidChangeMainEditorCenteredLayout = this._onDidChangeMainEditorCenteredLayout.event;
    this._onDidChangePanelAlignment = this._register(new Emitter());
    this.onDidChangePanelAlignment = this._onDidChangePanelAlignment.event;
    this._onDidChangeWindowMaximized = this._register(new Emitter());
    this.onDidChangeWindowMaximized = this._onDidChangeWindowMaximized.event;
    this._onDidChangePanelPosition = this._register(new Emitter());
    this.onDidChangePanelPosition = this._onDidChangePanelPosition.event;
    this._onDidChangePartVisibility = this._register(new Emitter());
    this.onDidChangePartVisibility = this._onDidChangePartVisibility.event;
    this._onWillToggleSidePane = this._register(new Emitter());
    this.onWillToggleSidePane = this._onWillToggleSidePane.event;
    this._onDidToggleSidePane = this._register(new Emitter());
    this.onDidToggleSidePane = this._onDidToggleSidePane.event;
    this._onDidRevealSidePane = this._register(new Emitter());
    this.onDidRevealSidePane = this._onDidRevealSidePane.event;
    this._onDidChangeNotificationsVisibility = this._register(new Emitter());
    this.onDidChangeNotificationsVisibility = this._onDidChangeNotificationsVisibility.event;
    this._onDidChangeAuxiliaryBarMaximized = this._register(new Emitter());
    this.onDidChangeAuxiliaryBarMaximized = this._onDidChangeAuxiliaryBarMaximized.event;
    this._onDidChangeEditorMaximized = this._register(new Emitter());
    this.onDidChangeEditorMaximized = this._onDidChangeEditorMaximized.event;
    this._onDidLayoutMainContainer = this._register(new Emitter());
    this.onDidLayoutMainContainer = this._onDidLayoutMainContainer.event;
    this._onDidLayoutActiveContainer = this._register(new Emitter());
    this.onDidLayoutActiveContainer = this._onDidLayoutActiveContainer.event;
    this._onDidLayoutContainer = this._register(new Emitter());
    this.onDidLayoutContainer = this._onDidLayoutContainer.event;
    this._onDidAddContainer = this._register(new Emitter());
    this.onDidAddContainer = this._onDidAddContainer.event;
    this._onDidChangeActiveContainer = this._register(new Emitter());
    this.onDidChangeActiveContainer = this._onDidChangeActiveContainer.event;
    //#endregion
    //#region Properties
    this.mainContainer = document.createElement("div");
    //#endregion
    //#region State
    this.parts = /* @__PURE__ */ new Map();
    /** `true` while the editor's current visible state was produced by an explicit user reveal. */
    this._editorRevealedExplicitly = false;
    this.partVisibility = {
      sidebar: true,
      auxiliaryBar: true,
      editor: false,
      panel: false,
      sessions: true,
      customViewGrid: false
    };
    this.mainWindowFullscreen = false;
    this.maximized = /* @__PURE__ */ new Set();
    this.layoutPolicy = this._register(new SessionsLayoutPolicy());
    this.mobileNavStack = this._register(new MobileNavigationStack());
    this.mobileTopBarDisposables = this._register(new DisposableStore());
    this._editorMaximized = false;
    /** Guards the grid updates that show/hide the custom view from feeding back into the desired part visibility. */
    this._applyingCustomViewGridVisibility = false;
    this._restoreAttachedEditorMaximizedOnShow = false;
    this._editorPartAutoVisibilitySuppressionCount = 0;
    this._hasAppliedInitialEditorSplit = false;
    this._restoreSidePaneEditorMaximizedOnShow = false;
    this._defaultSidePaneState = { editor: true, auxiliaryBar: true };
    this.restoredPromise = new DeferredPromise();
    this.whenRestored = this.restoredPromise.p;
    this.restored = false;
    this.openedDefaultEditors = false;
    this._savedPartSizes = {};
    this.previousUnexpectedError = { message: void 0, time: 0 };
    const metaElements = mainWindow.document.head.getElementsByTagName("meta");
    let viewportMeta;
    for (let i = 0; i < metaElements.length; i++) {
      if (metaElements[i].name === "viewport") {
        viewportMeta = metaElements[i];
        break;
      }
    }
    if (viewportMeta && !viewportMeta.content.includes("viewport-fit=")) {
      viewportMeta.content = `${viewportMeta.content}, viewport-fit=cover`;
    }
    mark("code/willStartWorkbench");
    this.registerErrorHandler(logService);
  }
  get activeContainer() {
    return this.getContainerFromDocument(getActiveDocument());
  }
  get containers() {
    const containers = [];
    for (const { window } of getWindows()) {
      containers.push(this.getContainerFromDocument(window.document));
    }
    return containers;
  }
  getContainerFromDocument(targetDocument) {
    if (targetDocument === this.mainContainer.ownerDocument) {
      return this.mainContainer;
    } else {
      return targetDocument.body.getElementsByClassName("monaco-workbench")[0];
    }
  }
  get mainContainerDimension() {
    return this._mainContainerDimension;
  }
  get activeContainerDimension() {
    return this.getContainerDimension(this.activeContainer);
  }
  getContainerDimension(container) {
    if (container === this.mainContainer) {
      return this.mainContainerDimension;
    } else {
      return getClientArea(container);
    }
  }
  get mainContainerOffset() {
    return this.computeContainerOffset();
  }
  get activeContainerOffset() {
    return this.computeContainerOffset();
  }
  computeContainerOffset() {
    let top = 0;
    let quickPickTop = 0;
    if (this.isVisible(Parts.TITLEBAR_PART, mainWindow)) {
      top = this.getPart(Parts.TITLEBAR_PART).maximumHeight;
      quickPickTop = top;
    } else if (this.mobileTopBarElement) {
      top = this.mobileTopBarElement.offsetHeight;
      quickPickTop = top;
    }
    return { top, quickPickTop };
  }
  /** `false` for the classic/mobile layout; {@link SinglePaneWorkbench} overrides to `true`. */
  get isSinglePaneLayoutEnabled() {
    return false;
  }
  static {
    //#endregion
    this._PART_VISIBILITY_KEY = "workbench.sessions.partVisibility";
  }
  static {
    this._PART_SIZES_KEY = "workbench.sessions.partSizes";
  }
  //#region Error Handling
  registerErrorHandler(logService) {
    if (!isFirefox) {
      Error.stackTraceLimit = 100;
    }
    mainWindow.addEventListener("unhandledrejection", (event) => {
      onUnexpectedError(event.reason);
      event.preventDefault();
    });
    setUnexpectedErrorHandler((error) => this.handleUnexpectedError(error, logService));
  }
  handleUnexpectedError(error, logService) {
    const message = toErrorMessage(error, true);
    if (!message) {
      return;
    }
    const now = Date.now();
    if (message === this.previousUnexpectedError.message && now - this.previousUnexpectedError.time <= 1e3) {
      return;
    }
    this.previousUnexpectedError.time = now;
    this.previousUnexpectedError.message = message;
    logService.error(message);
  }
  //#endregion
  //#region Startup
  startup() {
    try {
      this._register(setGlobalLeakWarningThreshold(175));
      const instantiationService = this.initServices(this.serviceCollection);
      instantiationService.invokeFunction((accessor) => {
        const lifecycleService = accessor.get(ILifecycleService);
        const storageService = accessor.get(IStorageService);
        const configurationService = accessor.get(IConfigurationService);
        const hostService = accessor.get(IHostService);
        const hoverService = accessor.get(IHoverService);
        const dialogService = accessor.get(IDialogService);
        const notificationService = accessor.get(INotificationService);
        const markdownRendererService = accessor.get(IMarkdownRendererService);
        if (isWeb && typeof configurationService.acquireInstantiationService === "function") {
          configurationService.acquireInstantiationService(instantiationService);
        }
        markdownRendererService.setDefaultCodeBlockRenderer(instantiationService.createInstance(EditorMarkdownCodeBlockRenderer));
        setHoverDelegateFactory((placement, enableInstantHover) => instantiationService.createInstance(WorkbenchHoverDelegate, placement, { instantHover: enableInstantHover }, {}));
        setBaseLayerHoverDelegate(hoverService);
        this.initLayout(accessor);
        Registry.as(WorkbenchExtensions.Workbench).start(accessor);
        Registry.as(EditorExtensions.EditorFactory).start(accessor);
        this._register(instantiationService.createInstance(WorkbenchContextKeysHandler));
        const editorMaximizedContext = EditorMaximizedContext.bindTo(accessor.get(IContextKeyService));
        this._register(this.onDidChangeEditorMaximized(() => {
          editorMaximizedContext.set(this.isEditorMaximized());
        }));
        const contextKeyService = accessor.get(IContextKeyService);
        const isPhoneLayoutCtx = IsPhoneLayoutContext.bindTo(contextKeyService);
        this._register(autorun((reader) => {
          isPhoneLayoutCtx.set(this.layoutPolicy.viewportClass.read(reader) === "phone");
        }));
        SinglePaneLayoutEnabledContext.bindTo(contextKeyService).set(this.isSinglePaneLayoutEnabled);
        accessor.get(IMobileVisualViewport);
        this.registerListeners(lifecycleService, storageService, configurationService, hostService, dialogService);
        this.renderWorkbench(instantiationService, notificationService, storageService, configurationService);
        this.createWorkbenchLayout();
        if (this.layoutPolicy.viewportClass.get() === "phone") {
          this.createMobileTitlebar();
        }
        this.createWorkbenchManagement(instantiationService);
        this.layout();
        this.restore(lifecycleService);
      });
      return instantiationService;
    } catch (error) {
      onUnexpectedError(error);
      throw error;
    }
  }
  initServices(serviceCollection) {
    serviceCollection.set(IAgentWorkbenchLayoutService, this);
    serviceCollection.set(ITitleService, new SyncDescriptor(TitleService, []));
    const contributedServices = getSingletonServiceDescriptors();
    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }
    const instantiationService = new InstantiationService(serviceCollection, true);
    instantiationService.invokeFunction((accessor) => {
      const lifecycleService = accessor.get(ILifecycleService);
      lifecycleService.phase = LifecyclePhase.Ready;
    });
    return instantiationService;
  }
  registerListeners(lifecycleService, storageService, configurationService, hostService, dialogService) {
    this._register(CommandsRegistry.registerCommand(CLOSE_MOBILE_SIDEBAR_DRAWER_COMMAND_ID, () => {
      if (this.layoutPolicy.viewportClass.get() === "phone") {
        this.closeMobileSidebarDrawer();
      }
    }));
    this._register(configurationService.onDidChangeConfiguration((e) => this.updateFontAliasing(e, configurationService)));
    if (isNative) {
      this._register(storageService.onWillSaveState((e) => {
        if (e.reason === WillSaveStateReason.SHUTDOWN) {
          this.storeFontInfo(storageService);
        }
      }));
    } else {
      this._register(lifecycleService.onWillShutdown(() => this.storeFontInfo(storageService)));
    }
    this._register(storageService.onWillSaveState(() => this._savePartSizes()));
    this._register(lifecycleService.onWillShutdown((event) => this._onWillShutdown.fire(event)));
    this._register(lifecycleService.onDidShutdown(() => {
      this._onDidShutdown.fire();
      this.dispose();
    }));
    this._register(hostService.onDidChangeFocus((focus) => {
      if (!focus) {
        storageService.flush();
      }
    }));
    this._register(dialogService.onWillShowDialog(() => this.mainContainer.classList.add("modal-dialog-visible")));
    this._register(dialogService.onDidShowDialog(() => this.mainContainer.classList.remove("modal-dialog-visible")));
  }
  updateFontAliasing(e, configurationService) {
    if (!isMacintosh) {
      return;
    }
    if (e && !e.affectsConfiguration("workbench.fontAliasing")) {
      return;
    }
    const aliasing = configurationService.getValue("workbench.fontAliasing");
    if (this.fontAliasing === aliasing) {
      return;
    }
    this.fontAliasing = aliasing;
    const fontAliasingValues = ["antialiased", "none", "auto"];
    this.mainContainer.classList.remove(...fontAliasingValues.map((value) => `monaco-font-aliasing-${value}`));
    if (fontAliasingValues.some((option) => option === aliasing)) {
      this.mainContainer.classList.add(`monaco-font-aliasing-${aliasing}`);
    }
  }
  restoreFontInfo(storageService, configurationService) {
    const storedFontInfoRaw = storageService.get("editorFontInfo", StorageScope.APPLICATION);
    if (storedFontInfoRaw) {
      try {
        const storedFontInfo = JSON.parse(storedFontInfoRaw);
        if (Array.isArray(storedFontInfo)) {
          FontMeasurements.restoreFontInfo(mainWindow, storedFontInfo);
        }
      } catch (err) {
      }
    }
    FontMeasurements.readFontInfo(mainWindow, createBareFontInfoFromRawSettings(configurationService.getValue("editor"), PixelRatio.getInstance(mainWindow).value));
  }
  storeFontInfo(storageService) {
    const serializedFontInfo = FontMeasurements.serializeFontInfo(mainWindow);
    if (serializedFontInfo) {
      storageService.store("editorFontInfo", JSON.stringify(serializedFontInfo), StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
  _loadPartVisibility(storageService) {
    if (this.layoutPolicy.viewportClass.get() === "phone") {
      return {};
    }
    const raw = storageService.get(Workbench._PART_VISIBILITY_KEY, StorageScope.WORKSPACE);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        storageService.remove(Workbench._PART_VISIBILITY_KEY, StorageScope.WORKSPACE);
      }
    }
    return {};
  }
  /**
   * Overlays the persisted part visibility on top of the current
   * (layout-policy default) `partVisibility` state. Must run before the
   * `WorkbenchContextKeysHandler` reads the initial visibility so that
   * context keys like `auxiliaryBarVisible` reflect the restored state on
   * reload rather than the hardcoded defaults.
   */
  _applyPersistedPartVisibility() {
    const savedPartVisibility = this._loadPartVisibility(this.storageService);
    this.partVisibility.editor = savedPartVisibility.editor ?? this.partVisibility.editor;
    this.partVisibility.auxiliaryBar = savedPartVisibility.auxiliaryBar ?? this.partVisibility.auxiliaryBar;
    this.partVisibility.sidebar = savedPartVisibility.sidebar ?? this.partVisibility.sidebar;
  }
  _savePartVisibility() {
    if (this.layoutPolicy.viewportClass.get() === "phone") {
      return;
    }
    this.storageService.store(Workbench._PART_VISIBILITY_KEY, JSON.stringify({
      editor: this.partVisibility.editor,
      auxiliaryBar: this.partVisibility.auxiliaryBar,
      sidebar: this.partVisibility.sidebar
    }), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  _loadPartSizes(storageService) {
    const raw = storageService.get(Workbench._PART_SIZES_KEY, StorageScope.WORKSPACE);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        storageService.remove(Workbench._PART_SIZES_KEY, StorageScope.WORKSPACE);
      }
    }
    return {};
  }
  _savePartSizes() {
    if (!this.workbenchGrid) {
      return;
    }
    const editorNodeVisible = this._editorNodeShouldBeVisible();
    const editorGridWidth = this._persistedGridViewSize(this.editorPartView, "width", editorNodeVisible);
    let editorWidth = this._persistedEditorWidth(editorGridWidth);
    if (editorWidth === void 0 || editorWidth < EDITOR_PART_MINIMUM_WIDTH) {
      editorWidth = this._savedPartSizes.editor !== void 0 && this._savedPartSizes.editor >= EDITOR_PART_MINIMUM_WIDTH ? this._savedPartSizes.editor : void 0;
    } else {
      this._savedPartSizes = { ...this._savedPartSizes, editor: editorWidth };
    }
    const sizes = {
      sidebar: this._persistedGridViewSize(this.sideBarPartView, "width", this.partVisibility.sidebar),
      auxiliaryBar: this._persistedGridViewSize(this.auxiliaryBarPartView, "width", this._effectiveVisible(Parts.AUXILIARYBAR_PART)),
      sessions: this._persistedGridViewSize(this.sessionsPartView, "width", this._effectiveVisible(Parts.SESSIONS_PART)),
      editor: editorWidth,
      panel: this._persistedGridViewSize(this.panelPartView, "height", this._effectiveVisible(Parts.PANEL_PART))
    };
    this.storageService.store(Workbench._PART_SIZES_KEY, JSON.stringify(sizes), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  //#endregion
  renderWorkbench(instantiationService, notificationService, storageService, configurationService) {
    setARIAContainer(this.mainContainer);
    setProgressAccessibilitySignalScheduler((msDelayTime, msLoopTime) => instantiationService.createInstance(AccessibilityProgressSignalScheduler, msDelayTime, msLoopTime));
    const initialDimension = getClientArea(this.parent);
    this.layoutPolicy.update(initialDimension.width, initialDimension.height);
    const visibilityDefaults = this.layoutPolicy.getPartVisibilityDefaults();
    this.partVisibility.sidebar = visibilityDefaults.sidebar;
    this.partVisibility.auxiliaryBar = visibilityDefaults.auxiliaryBar;
    this.partVisibility.panel = visibilityDefaults.panel;
    this.partVisibility.sessions = visibilityDefaults.sessions;
    this.partVisibility.editor = visibilityDefaults.editor;
    this._applyPersistedPartVisibility();
    this._savedPartSizes = this._loadPartSizes(storageService);
    if (this._savedPartSizes.auxiliaryBar !== void 0) {
      this._restoreAuxiliaryBarWidth(this._savedPartSizes.auxiliaryBar);
    }
    const platformClass = isWindows ? "windows" : isLinux ? "linux" : "mac";
    const workbenchClasses = coalesce([
      "monaco-workbench",
      "agent-sessions-workbench",
      "modern-ui-tabs" /* MODERN_UI_TABS */,
      // LayoutClasses.SHELL_GRADIENT_BACKGROUND,
      platformClass,
      isWeb ? "web" : void 0,
      isChrome ? "chromium" : isFirefox ? "firefox" : isSafari ? "safari" : void 0,
      ...this.getLayoutClasses(),
      ...this.options?.extraClasses ? this.options.extraClasses : []
    ]);
    this.mainContainer.classList.add(...workbenchClasses);
    this.updateFontAliasing(void 0, configurationService);
    this.restoreFontInfo(storageService, configurationService);
    for (const { id, role, classes } of [
      { id: Parts.TITLEBAR_PART, role: "none", classes: ["titlebar"] },
      { id: Parts.SIDEBAR_PART, role: "none", classes: ["sidebar", "left"] },
      { id: Parts.AUXILIARYBAR_PART, role: "none", classes: ["auxiliarybar", "basepanel", "right"] },
      { id: Parts.PANEL_PART, role: "none", classes: ["panel", "basepanel", positionToString(this.getPanelPosition())] }
    ]) {
      const partContainer = this.createPartContainer(id, role, classes);
      mark(`code/willCreatePart/${id}`);
      this.getPart(id).create(partContainer);
      mark(`code/didCreatePart/${id}`);
    }
    this.createEditorPart();
    this.createSessionsPart();
    this.createCustomViewGridPart();
    this.createNotificationsHandlers(instantiationService, notificationService, configurationService);
    this.parent.appendChild(this.mainContainer);
  }
  createMobileTitlebar() {
    this.mobileTopBarDisposables.clear();
    const mobileTitlebar = this.mobileTopBarDisposables.add(this.instantiationService.createInstance(MobileTitlebarPart, this.mainContainer));
    this.mobileTopBarElement = mobileTitlebar.element;
    this.mobileTopBarDisposables.add(mobileTitlebar.onDidClickHamburger(() => {
      this.toggleMobileSidebarDrawer();
    }));
    this.mobileTopBarDisposables.add(mobileTitlebar.onDidClickNewSession(() => {
      this.sessionsService.openNewSession();
      this.closeMobileSidebarDrawer();
      this.sessionsPartService.focusSession(this.sessionsService.activeSession.get());
    }));
  }
  toggleMobileSidebarDrawer() {
    const isOpen = this.partVisibility.sidebar;
    if (isOpen) {
      this.closeMobileSidebarDrawer();
    } else {
      this.openMobileSidebarDrawer();
    }
  }
  openMobileSidebarDrawer() {
    if (!this.mobileNavStack.has("sidebar")) {
      this.mobileNavStack.push("sidebar");
    }
    this.setSideBarHidden(false);
  }
  closeMobileSidebarDrawer() {
    this.setSideBarHidden(true);
    if (this.mobileNavStack.has("sidebar")) {
      this.mobileNavStack.popSilently("sidebar");
    }
  }
  createNotificationsHandlers(instantiationService, notificationService, configurationService) {
    const notificationsCenter = this._register(instantiationService.createInstance(NotificationsCenter, this.mainContainer, notificationService.model));
    const notificationsToasts = this._register(instantiationService.createInstance(NotificationsToasts, this.mainContainer, notificationService.model));
    this._register(instantiationService.createInstance(NotificationsAlerts, notificationService.model));
    const notificationsStatus = this._register(instantiationService.createInstance(NotificationsStatus, notificationService.model));
    this._register(notificationsCenter.onDidChangeVisibility(() => {
      notificationsStatus.update(notificationsCenter.isVisible, notificationsToasts.isVisible);
      notificationsToasts.update(notificationsCenter.isVisible);
    }));
    this._register(notificationsToasts.onDidChangeVisibility(() => {
      notificationsStatus.update(notificationsCenter.isVisible, notificationsToasts.isVisible);
    }));
    registerNotificationCommands(notificationsCenter, notificationsToasts, notificationService.model);
    AccessibleViewRegistry.register(new NotificationAccessibleView());
    this.registerSessionsNotificationOffsets(configurationService, notificationsCenter, notificationsToasts);
    this.registerNotifications({
      onDidChangeNotificationsVisibility: Event.map(
        Event.any(notificationsToasts.onDidChangeVisibility, notificationsCenter.onDidChangeVisibility),
        () => notificationsToasts.isVisible || notificationsCenter.isVisible
      )
    });
  }
  registerSessionsNotificationOffsets(configurationService, notificationsCenter, notificationsToasts) {
    const applySessionsNotificationOffsets = () => {
      const position = getNotificationsPosition(configurationService);
      const notificationsCenterContainer = this.getWorkbenchChildByClassName("notifications-center");
      const notificationsToastsContainer = this.getWorkbenchChildByClassName("notifications-toasts");
      if (position === NotificationsPosition.TOP_RIGHT) {
        notificationsCenterContainer?.style.setProperty("top", "40px");
        notificationsToastsContainer?.style.setProperty("top", "40px");
      }
    };
    this._register(this.onDidLayoutMainContainer(() => applySessionsNotificationOffsets()));
    this._register(notificationsCenter.onDidChangeVisibility(() => applySessionsNotificationOffsets()));
    this._register(notificationsToasts.onDidChangeVisibility(() => applySessionsNotificationOffsets()));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotificationsSettings.NOTIFICATIONS_POSITION)) {
        applySessionsNotificationOffsets();
      }
    }));
  }
  getWorkbenchChildByClassName(className) {
    for (const child of this.mainContainer.children) {
      if (isHTMLElement(child) && child.classList.contains(className)) {
        return child;
      }
    }
    return void 0;
  }
  createPartContainer(id, role, classes) {
    const part = document.createElement("div");
    part.classList.add("part", ...classes);
    part.id = id;
    part.setAttribute("role", role);
    return part;
  }
  createEditorPart() {
    const editorPartContainer = document.createElement("div");
    editorPartContainer.classList.add("part", "editor");
    editorPartContainer.id = Parts.EDITOR_PART;
    editorPartContainer.setAttribute("role", "main");
    this._register(addDisposableListener(editorPartContainer, EventType.FOCUS_IN, () => this._restoreEditorPartOnActivation()));
    this._register(addDisposableGenericMouseDownListener(editorPartContainer, () => this._restoreEditorPartOnActivation()));
    this._editorPartContainer = editorPartContainer;
    mark("code/willCreatePart/workbench.parts.editor");
    this.getPart(Parts.EDITOR_PART).create(editorPartContainer, { restorePreviousState: false });
    mark("code/didCreatePart/workbench.parts.editor");
    this.mainContainer.appendChild(editorPartContainer);
  }
  createSessionsPart() {
    const sessionsPartContainer = document.createElement("div");
    sessionsPartContainer.classList.add("part", "sessionspart", "basepanel", "right", AGENTS_PART_CARD_CLASS);
    sessionsPartContainer.id = Parts.SESSIONS_PART;
    sessionsPartContainer.setAttribute("role", "main");
    this._register(addDisposableListener(sessionsPartContainer, EventType.FOCUS_IN, () => this._restoreSessionsPartOnActivation()));
    this._register(addDisposableGenericMouseDownListener(sessionsPartContainer, () => this._restoreSessionsPartOnActivation()));
    mark(`code/willCreatePart/${Parts.SESSIONS_PART}`);
    this.getPart(Parts.SESSIONS_PART).create(sessionsPartContainer);
    mark(`code/didCreatePart/${Parts.SESSIONS_PART}`);
    this.mainContainer.appendChild(sessionsPartContainer);
  }
  _restoreSessionsPartOnActivation() {
    if (!this.workbenchGrid || !this.isVisible(Parts.EDITOR_PART, mainWindow)) {
      return;
    }
    this._restoreMinimizedPartOnActivation(this.sessionsPartView, this.editorPartView);
  }
  _restoreEditorPartOnActivation() {
    if (!this.workbenchGrid || !this.isVisible(Parts.EDITOR_PART, mainWindow) || !this.isVisible(Parts.SESSIONS_PART)) {
      return;
    }
    this._restoreMinimizedPartOnActivation(this.editorPartView, this.sessionsPartView);
  }
  _restoreMinimizedPartOnActivation(target, sibling) {
    const targetSize = this.workbenchGrid.getViewSize(target);
    if (targetSize.width !== this._minimumPartWidthForActivation(target)) {
      return;
    }
    const siblingSize = this.workbenchGrid.getViewSize(sibling);
    const siblingMinimumWidth = this._minimumPartWidthForActivation(sibling);
    if (siblingSize.width > siblingMinimumWidth) {
      this.workbenchGrid.resizeView(sibling, { width: siblingMinimumWidth, height: siblingSize.height });
    }
  }
  _minimumPartWidthForActivation(view) {
    return view.minimumWidth;
  }
  createCustomViewGridPart() {
    const customViewGridPartContainer = document.createElement("div");
    customViewGridPartContainer.classList.add("part", "customviewgridpart", "basepanel", "right", AGENTS_PART_CARD_CLASS);
    customViewGridPartContainer.id = Parts.CUSTOM_VIEW_GRID_PART;
    customViewGridPartContainer.setAttribute("role", "main");
    mark(`code/willCreatePart/${Parts.CUSTOM_VIEW_GRID_PART}`);
    this.getPart(Parts.CUSTOM_VIEW_GRID_PART).create(customViewGridPartContainer);
    mark(`code/didCreatePart/${Parts.CUSTOM_VIEW_GRID_PART}`);
    this.mainContainer.appendChild(customViewGridPartContainer);
  }
  restore(lifecycleService) {
    mark("code/didStartWorkbench");
    performance.measure("perf: workbench create & restore", "code/didLoadWorkbenchMain", "code/didStartWorkbench");
    this.restoreParts();
    void this.sessionsService.restoreVisibleSessions().catch((e) => {
      this.logService.error("[Workbench] restoreVisibleSessions failed", e);
    });
    lifecycleService.phase = LifecyclePhase.Restored;
    this.setRestored();
    const eventuallyPhaseScheduler = this._register(new RunOnceScheduler(() => {
      this._register(runWhenWindowIdle(mainWindow, () => lifecycleService.phase = LifecyclePhase.Eventually, 2500));
    }, 2500));
    eventuallyPhaseScheduler.schedule();
  }
  restoreParts() {
    const partsToRestore = [
      { location: ViewContainerLocation.Sidebar, visible: this.partVisibility.sidebar },
      { location: ViewContainerLocation.Panel, visible: this.partVisibility.panel },
      { location: ViewContainerLocation.AuxiliaryBar, visible: this.partVisibility.auxiliaryBar }
    ];
    for (const { location, visible } of partsToRestore) {
      if (visible) {
        const defaultViewContainer = this.viewDescriptorService.getDefaultViewContainer(location);
        if (defaultViewContainer) {
          this.paneCompositeService.openPaneComposite(defaultViewContainer.id, location);
        }
      }
    }
  }
  //#endregion
  //#region Initialization
  initLayout(accessor) {
    this.editorGroupService = accessor.get(IEditorGroupsService);
    this.editorService = accessor.get(IEditorService);
    this.paneCompositeService = accessor.get(IPaneCompositePartService);
    this.viewDescriptorService = accessor.get(IViewDescriptorService);
    this.sessionsService = accessor.get(ISessionsService);
    this.sessionsPartService = accessor.get(ISessionsPartService);
    this.customViewService = accessor.get(ICustomViewService);
    this.customViewGridPartService = accessor.get(ICustomViewGridPartService);
    this.instantiationService = accessor.get(IInstantiationService);
    this.storageService = accessor.get(IStorageService);
    accessor.get(ITitleService);
    this.layoutPolicy.setSinglePane(this.isSinglePaneLayoutEnabled);
    this.registerLayoutListeners();
    this._customViewVisibleKey = CustomViewVisibleContext.bindTo(accessor.get(IContextKeyService));
    this._register(autorun((reader) => {
      this._applyCustomViewGridVisibility(this.customViewService.activeCustomView.read(reader));
    }));
    this._register(this.editorService.onWillOpenEditor((e) => this.revealEditorOnOpen(e)));
    this._register(this.editorService.onDidCloseEditor(() => this.handleDidCloseEditor()));
    this._mainContainerDimension = getClientArea(this.parent, new Dimension(800, 600));
    this.layoutPolicy.update(this._mainContainerDimension.width, this._mainContainerDimension.height);
    const visDefaults = this.layoutPolicy.getPartVisibilityDefaults();
    this.partVisibility.sidebar = visDefaults.sidebar;
    this.partVisibility.auxiliaryBar = visDefaults.auxiliaryBar;
    this.partVisibility.panel = visDefaults.panel;
    this.partVisibility.sessions = visDefaults.sessions;
    this.partVisibility.editor = visDefaults.editor;
    this._applyPersistedPartVisibility();
  }
  areAllGroupsInMainPartEmpty() {
    for (const group of this.editorGroupService.mainPart.groups) {
      if (!group.isEmpty) {
        return false;
      }
    }
    return true;
  }
  revealEditorOnOpen(e) {
    if (this._editorPartAutoVisibilitySuppressionCount > 0) {
      return;
    }
    const group = this.editorGroupService.mainPart.groups.find((g) => g.id === e.groupId);
    if (!group) {
      return;
    }
    if (!this.partVisibility.editor) {
      this.setEditorHidden(
        false,
        /* explicit */
        true
      );
      this.restoreAttachedEditorMaximizedState();
    }
  }
  handleDidCloseEditor() {
    if (this._editorPartAutoVisibilitySuppressionCount > 0 || !this.areAllGroupsInMainPartEmpty()) {
      return;
    }
    this._handleAllEditorsClosed();
  }
  suppressEditorPartAutoVisibility() {
    this._editorPartAutoVisibilitySuppressionCount++;
    let disposed = false;
    return toDisposable(() => {
      if (disposed) {
        return;
      }
      disposed = true;
      this._editorPartAutoVisibilitySuppressionCount--;
    });
  }
  rememberAttachedEditorMaximizedState() {
    this._restoreAttachedEditorMaximizedOnShow = this._editorMaximized && this.partVisibility.auxiliaryBar;
  }
  restoreAttachedEditorMaximizedState() {
    const shouldRestore = this._restoreAttachedEditorMaximizedOnShow && this.partVisibility.auxiliaryBar;
    this._restoreAttachedEditorMaximizedOnShow = false;
    if (shouldRestore) {
      this.setEditorMaximized(true);
    }
  }
  //#region Side-pane layout hooks (classic grid defaults; overridden by SinglePaneWorkbench)
  _fireDidChangePartVisibility(partId, visible, source) {
    this._onDidChangePartVisibility.fire({ partId, visible, source });
  }
  _notifyContainerDidLayout() {
    this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
  }
  _setMainEditorAreaHidden(hidden) {
    this.mainContainer.classList.toggle("nomaineditorarea" /* MAIN_EDITOR_AREA_HIDDEN */, hidden);
  }
  /**
   * Handles a change in the editor-part grid view's visibility. In the classic
   * layout the editor part is a standalone grid view, so its view visibility *is*
   * the editor visibility — map it to `setEditorHidden` and raise the part event.
   * Single-pane overrides this: its editor-part grid view also hosts the docked
   * auxiliary bar, so the view can become visible purely to show the detail while
   * the editor content stays hidden; it fires its own editor-part events instead.
   */
  _onEditorPartGridVisibilityChange(visible) {
    this.setEditorHidden(!visible);
    this._onDidChangePartVisibility.fire({ partId: Parts.EDITOR_PART, visible });
  }
  get _isEditorPartAutoVisibilitySuppressed() {
    return this._editorPartAutoVisibilitySuppressionCount > 0;
  }
  /** Toggles the container marker class for the side-pane layout. */
  _applyLayoutContainerClass() {
    this.mainContainer.classList.toggle("dock-detail-panel", false);
  }
  /** Width the auxiliary bar occupies when visible (for max-editor-dimension math). */
  _auxiliaryBarLayoutWidth() {
    return this.workbenchGrid ? this.workbenchGrid.getViewSize(this.auxiliaryBarPartView).width : 0;
  }
  _auxiliaryBarViewSize() {
    if (!this.workbenchGrid || !this.auxiliaryBarPartView) {
      return { width: 0, height: 0 };
    }
    return this.workbenchGrid.getViewSize(this.auxiliaryBarPartView);
  }
  _setAuxiliaryBarViewSize(size2) {
    if (this.auxiliaryBarPartView) {
      this.workbenchGrid.resizeView(this.auxiliaryBarPartView, size2);
    }
  }
  _resizeAuxiliaryBarBy(deltaWidth, deltaHeight) {
    if (!this.auxiliaryBarPartView) {
      return;
    }
    const currentSize = this.workbenchGrid.getViewSize(this.auxiliaryBarPartView);
    this.workbenchGrid.resizeView(this.auxiliaryBarPartView, {
      width: currentSize.width + deltaWidth,
      height: currentSize.height + deltaHeight
    });
  }
  _restoreAuxiliaryBarWidth(_width) {
  }
  /**
   * Reads a part's size from the workbench grid for persistence. For visible
   * parts, the current view size; for hidden parts, the grid's cached visible
   * size (the size it had the last time it was shown) so toggling visibility
   * later restores the same dimensions. Overridden by the single-pane layout for
   * its docked auxiliary bar, which is not a grid view.
   */
  _persistedGridViewSize(view, dimension, visible) {
    if (visible) {
      return this.workbenchGrid.getViewSize(view)[dimension];
    }
    return this.workbenchGrid.getViewCachedVisibleSize(view);
  }
  _persistedEditorWidth(editorGridWidth) {
    return editorGridWidth;
  }
  _defaultSideBarSize(policySideBarSize) {
    return policySideBarSize;
  }
  _editorNodeSize(effectiveEditorWidth, _effectiveAuxBarWidth) {
    return effectiveEditorWidth;
  }
  _editorNodeVisible(editorVisible, _auxBarVisible) {
    return editorVisible;
  }
  _topRightSectionChildren(sessionsNode, editorNode, auxiliaryBarNode, customViewGridNode) {
    return [sessionsNode, editorNode, auxiliaryBarNode, customViewGridNode];
  }
  /** Attach any per-layout controllers once the editor part container exists. */
  _attachSidePane() {
  }
  /** Lay out any docked overlay. */
  _layoutSidePane() {
  }
  /** React to a whole-grid change (e.g. a sash drag) after the grid rebuilds. */
  _onGridDidChange() {
  }
  /** React to the editor grid node being resized to `nodeWidth`. */
  _onEditorNodeResized(_nodeWidth) {
  }
  /** Run editor-node work with the reveal-sync suspended (no-op for the grid layout). */
  _runWithEditorResizeSyncSuspended(fn) {
    fn();
  }
  _applyEditorVisibility(hidden) {
    const shouldApplyEvenSplit = !hidden && !this._hasAppliedInitialEditorSplit;
    const mainAreaWidth = this.workbenchGrid.getViewSize(this.sessionsPartView).width;
    this.workbenchGrid.setViewVisible(this.editorPartView, this._editorNodeShouldBeVisible());
    if (shouldApplyEvenSplit) {
      this._hasAppliedInitialEditorSplit = true;
      this._applyEditorSplitSize(mainAreaWidth);
    }
  }
  _onWillHideAuxiliaryBar(_hidden) {
  }
  _applyAuxiliaryBarVisibility(hidden, _source) {
    if (this.workbenchGrid) {
      this.workbenchGrid.setViewVisible(this.auxiliaryBarPartView, this._effectiveVisible(Parts.AUXILIARYBAR_PART));
    }
  }
  _shouldOpenAuxiliaryPaneComposite(_containerId) {
    return true;
  }
  _handleAllEditorsClosed() {
    if (this.partVisibility.editor) {
      this.rememberAttachedEditorMaximizedState();
      this.setEditorHidden(true);
    }
  }
  _prepareSideBarResize(_hidden) {
    return {};
  }
  _applySideBarResize(_hidden, _context) {
  }
  //#endregion
  registerLayoutListeners() {
    this._register(onDidChangeFullscreen((windowId) => {
      if (windowId === getWindowId(mainWindow)) {
        this.mainWindowFullscreen = isFullscreen(mainWindow);
        this.updateFullscreenClass();
        this.layout();
      }
    }));
    const onWindowResize = () => this.layout();
    this._register(addDisposableListener(mainWindow, "resize", onWindowResize));
  }
  updateFullscreenClass() {
    if (this.mainWindowFullscreen) {
      this.mainContainer.classList.add("fullscreen" /* FULLSCREEN */);
    } else {
      this.mainContainer.classList.remove("fullscreen" /* FULLSCREEN */);
    }
  }
  //#endregion
  //#region Workbench Layout Creation
  createWorkbenchLayout() {
    this._applyLayoutContainerClass();
    const titleBar = this.getPart(Parts.TITLEBAR_PART);
    const editorPart = this.getPart(Parts.EDITOR_PART);
    const panelPart = this.getPart(Parts.PANEL_PART);
    const auxiliaryBarPart = this.getPart(Parts.AUXILIARYBAR_PART);
    const sideBar = this.getPart(Parts.SIDEBAR_PART);
    const sessionsPart = this.getPart(Parts.SESSIONS_PART);
    const customViewGridPart = this.getPart(Parts.CUSTOM_VIEW_GRID_PART);
    this.titleBarPartView = titleBar;
    this.sideBarPartView = sideBar;
    this.panelPartView = panelPart;
    this.auxiliaryBarPartView = auxiliaryBarPart;
    this.sessionsPartView = sessionsPart;
    this.customViewGridPartView = customViewGridPart;
    this.editorPartView = editorPart;
    const viewMap = {
      [Parts.TITLEBAR_PART]: this.titleBarPartView,
      [Parts.PANEL_PART]: this.panelPartView,
      [Parts.SIDEBAR_PART]: this.sideBarPartView,
      [Parts.AUXILIARYBAR_PART]: this.auxiliaryBarPartView,
      [Parts.SESSIONS_PART]: this.sessionsPartView,
      [Parts.CUSTOM_VIEW_GRID_PART]: this.customViewGridPartView,
      [Parts.EDITOR_PART]: this.editorPartView
    };
    const fromJSON = ({ type }) => viewMap[type];
    const workbenchGrid = SerializableGrid.deserialize(
      this.createGridDescriptor(),
      { fromJSON },
      { proportionalLayout: false }
    );
    this.mainContainer.prepend(workbenchGrid.element);
    this.mainContainer.setAttribute("role", "application");
    this.workbenchGrid = workbenchGrid;
    this.workbenchGrid.edgeSnapping = this.mainWindowFullscreen;
    this._register(this.workbenchGrid.onDidChange(() => {
      this._onGridDidChange();
    }));
    this._hasAppliedInitialEditorSplit = this.partVisibility.editor;
    for (const part of [titleBar, panelPart, sideBar, auxiliaryBarPart, sessionsPart, editorPart]) {
      this._register(part.onDidVisibilityChange((visible) => {
        if (this._applyingCustomViewGridVisibility) {
          return;
        }
        if (part === editorPart) {
          this._onEditorPartGridVisibilityChange(visible);
          this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
          return;
        }
        if (part === sideBar) {
          this.setSideBarHidden(!visible);
        } else if (part === panelPart) {
          this.setPanelHidden(!visible);
        } else if (part === auxiliaryBarPart) {
          this.setAuxiliaryBarHidden(!visible);
        } else if (part === sessionsPart) {
          this.setSessionsHidden(!visible);
        }
        this._onDidChangePartVisibility.fire({ partId: part.getId(), visible });
        this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
      }));
    }
    this._register(this.mobileNavStack.onDidPop((layer) => {
      switch (layer) {
        case "sidebar":
          this.closeMobileSidebarDrawer();
          break;
        case "panel":
          this.setPanelHidden(true);
          break;
        case "auxbar":
          this.setAuxiliaryBarHidden(true);
          break;
        case "customView":
          this.customViewService.hideCustomView();
          break;
        case "editor":
          break;
      }
    }));
  }
  createWorkbenchManagement(instantiationService) {
    instantiationService.invokeFunction((accessor) => accessor.get(ISessionsSetUpService));
  }
  /**
   * Creates the grid descriptor for the Agent Sessions layout.
   *
   * Structure (horizontal orientation):
   * - Sidebar (left, spans full height from top to bottom)
   * - Right section (vertical):
   *   - Titlebar (top of right section)
   *   - Top right (horizontal): Chat Bar | Editor | Auxiliary Bar
   *   - Panel (below chat, editor, and auxiliary bar)
   */
  createGridDescriptor() {
    const { width, height } = this._mainContainerDimension;
    return this.createDesktopGridDescriptor(width, height);
  }
  /**
   * Standard multi-part layout for all viewport classes.
   * On phone, the titlebar is hidden via CSS and a MobileTitlebarPart
   * is prepended before the grid. Sidebar/panel/auxbar are hidden
   * in the grid via partVisibility defaults.
   */
  createDesktopGridDescriptor(width, height) {
    const sizes = this.layoutPolicy.getPartSizes(width, height);
    const defaultSideBarSize = this._defaultSideBarSize(sizes.sideBarSize);
    const sideBarSize = this._savedPartSizes.sidebar ?? (this.partVisibility.sidebar ? defaultSideBarSize : Math.max(defaultSideBarSize, 250));
    const defaultAuxiliaryBarSize = this.isSinglePaneLayoutEnabled ? this.getDockedAuxiliaryBarWidth() : sizes.auxiliaryBarSize;
    const auxiliaryBarSize = this._savedPartSizes.auxiliaryBar ?? (this.partVisibility.auxiliaryBar ? defaultAuxiliaryBarSize : Math.max(defaultAuxiliaryBarSize, 300));
    const panelSize = this._savedPartSizes.panel ?? (this.partVisibility.panel ? sizes.panelSize : Math.max(sizes.panelSize, 250));
    const savedEditorWidth = this._savedPartSizes.editor;
    const editorSize = savedEditorWidth !== void 0 && savedEditorWidth >= EDITOR_PART_MINIMUM_WIDTH ? savedEditorWidth : EDITOR_PART_DEFAULT_WIDTH;
    const titleBarHeight = this.titleBarPartView?.minimumHeight ?? 30;
    const effectiveSideBarWidth = this.partVisibility.sidebar ? sideBarSize : 0;
    const rightSectionWidth = Math.max(0, width - effectiveSideBarWidth);
    const effectiveAuxBarWidth = this.partVisibility.auxiliaryBar ? auxiliaryBarSize : 0;
    const effectiveEditorWidth = this.partVisibility.editor ? editorSize : 0;
    const sessionsWidth = this._savedPartSizes.sessions ?? Math.max(0, rightSectionWidth - effectiveAuxBarWidth - effectiveEditorWidth);
    const contentHeight = Math.max(0, height - titleBarHeight);
    const topRightHeight = Math.max(0, contentHeight - panelSize);
    const isPhone = this.layoutPolicy.viewportClass.get() === "phone";
    const titleBarNode = {
      type: "leaf",
      data: { type: Parts.TITLEBAR_PART },
      size: titleBarHeight,
      visible: !isPhone
    };
    const sideBarNode = {
      type: "leaf",
      data: { type: Parts.SIDEBAR_PART },
      size: sideBarSize,
      visible: this.partVisibility.sidebar
    };
    const sessionsNode = {
      type: "leaf",
      data: { type: Parts.SESSIONS_PART },
      size: sessionsWidth,
      visible: this._effectiveVisible(Parts.SESSIONS_PART)
    };
    const customViewGridNode = {
      type: "leaf",
      data: { type: Parts.CUSTOM_VIEW_GRID_PART },
      size: rightSectionWidth,
      visible: this.partVisibility.customViewGrid
    };
    const editorNode = {
      type: "leaf",
      data: { type: Parts.EDITOR_PART },
      size: this._editorNodeSize(effectiveEditorWidth, effectiveAuxBarWidth),
      visible: this._editorNodeShouldBeVisible()
    };
    const auxiliaryBarNode = {
      type: "leaf",
      data: { type: Parts.AUXILIARYBAR_PART },
      size: auxiliaryBarSize,
      visible: this._effectiveVisible(Parts.AUXILIARYBAR_PART)
    };
    const panelNode = {
      type: "leaf",
      data: { type: Parts.PANEL_PART },
      size: panelSize,
      visible: this._effectiveVisible(Parts.PANEL_PART)
    };
    const topRightSection = {
      type: "branch",
      data: this._topRightSectionChildren(sessionsNode, editorNode, auxiliaryBarNode, customViewGridNode),
      size: topRightHeight
    };
    const rightSection = {
      type: "branch",
      data: [topRightSection, panelNode],
      size: rightSectionWidth
    };
    const contentSection = {
      type: "branch",
      data: [sideBarNode, rightSection],
      size: contentHeight
    };
    const result = {
      root: {
        type: "branch",
        size: width,
        data: [
          titleBarNode,
          contentSection
        ]
      },
      orientation: Orientation.VERTICAL,
      width,
      height
    };
    return result;
  }
  layout() {
    this._mainContainerDimension = getClientArea(
      this.mainWindowFullscreen ? mainWindow.document.body : this.parent
    );
    const previousClass = this._previousViewportClass;
    this.layoutPolicy.update(this._mainContainerDimension.width, this._mainContainerDimension.height);
    const currentClass = this.layoutPolicy.viewportClass.get();
    this.mainContainer.classList.toggle("phone-layout" /* PHONE_LAYOUT */, currentClass === "phone");
    if (previousClass !== void 0 && previousClass !== currentClass) {
      if (currentClass === "phone" && !this.mobileTopBarElement) {
        this.createMobileTitlebar();
        this.workbenchGrid.setViewVisible(this.titleBarPartView, false);
        const defaults = this.layoutPolicy.getPartVisibilityDefaults();
        if (this.partVisibility.sidebar !== defaults.sidebar) {
          this.setSideBarHidden(!defaults.sidebar);
        }
        if (this.partVisibility.auxiliaryBar !== defaults.auxiliaryBar) {
          this.setAuxiliaryBarHidden(!defaults.auxiliaryBar);
        }
        if (this.partVisibility.panel !== defaults.panel) {
          this.setPanelHidden(!defaults.panel);
        }
      } else if (currentClass !== "phone" && this.mobileTopBarElement) {
        this.mobileTopBarDisposables.clear();
        this.mobileTopBarElement = void 0;
        this.workbenchGrid.setViewVisible(this.titleBarPartView, true);
        const defaults = this.layoutPolicy.getPartVisibilityDefaults();
        if (this.partVisibility.sidebar !== defaults.sidebar) {
          this.setSideBarHidden(!defaults.sidebar);
        }
        if (this.partVisibility.sessions !== defaults.sessions) {
          this.setSessionsHidden(!defaults.sessions);
        }
        if (this.partVisibility.auxiliaryBar !== defaults.auxiliaryBar) {
          this.setAuxiliaryBarHidden(!defaults.auxiliaryBar);
        }
        if (this.partVisibility.panel !== defaults.panel) {
          this.setPanelHidden(!defaults.panel);
        }
      }
      for (const partId of [Parts.SESSIONS_PART, Parts.CUSTOM_VIEW_GRID_PART, Parts.SIDEBAR_PART, Parts.AUXILIARYBAR_PART, Parts.PANEL_PART]) {
        this.parts.get(partId)?.updateStyles();
      }
      this._updateMobileCustomViewNavigation();
    }
    this._previousViewportClass = currentClass;
    this.logService.trace(`Workbench#layout, height: ${this._mainContainerDimension.height}, width: ${this._mainContainerDimension.width}`);
    size(this.mainContainer, this._mainContainerDimension.width, this._mainContainerDimension.height);
    this._layoutGrid();
    this._attachSidePane();
    this._layoutSidePane();
    this.layoutMobileSidebar();
    this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
  }
  _layoutGrid() {
    const mobileTopBarHeight = this.mobileTopBarElement?.offsetHeight ?? 0;
    const isPhone = this.layoutPolicy.viewportClass.get() === "phone";
    const gridGutterW = isPhone ? 0 : AGENTS_FLOATING_PANEL_GAP + (this.partVisibility.sidebar ? 4 : AGENTS_FLOATING_PANEL_GAP);
    const gridGutterH = isPhone ? 0 : AGENTS_FLOATING_PANEL_GAP;
    this.workbenchGrid.layout(
      this._mainContainerDimension.width - gridGutterW,
      this._mainContainerDimension.height - mobileTopBarHeight - gridGutterH
    );
  }
  handleDockedEditorPartLayout(nodeWidth) {
    this._onEditorNodeResized(nodeWidth);
  }
  isEditorRevealedExplicitly() {
    return this._editorRevealedExplicitly;
  }
  revealEditorPartExplicitly() {
    this._editorRevealedExplicitly = true;
    this.setEditorHidden(
      false,
      /* explicit */
      true
    );
  }
  getDockedAuxiliaryBarWidth() {
    return 0;
  }
  setDockedAuxiliaryBarWidth(_width) {
  }
  layoutMobileSidebar() {
    const sidebarContainer = this.getContainer(mainWindow, Parts.SIDEBAR_PART);
    const sidebarPart = this.getPart(Parts.SIDEBAR_PART);
    if (!sidebarContainer) {
      return;
    }
    const isPhone = this.layoutPolicy.viewportClass.get() === "phone";
    if (!isPhone || !this.partVisibility.sidebar) {
      sidebarContainer.classList.remove("mobile-overlay-sidebar");
      return;
    }
    sidebarContainer.classList.add("mobile-overlay-sidebar");
    const topBarHeight = this.mobileTopBarElement?.offsetHeight ?? 48;
    const drawerWidth = this._mainContainerDimension.width;
    const drawerHeight = Math.max(0, this._mainContainerDimension.height - topBarHeight);
    sidebarPart.layout(drawerWidth, drawerHeight, topBarHeight, 0);
  }
  handleContainerDidLayout(container, dimension) {
    this._onDidLayoutContainer.fire({ container, dimension });
    if (container === this.mainContainer) {
      this._onDidLayoutMainContainer.fire(dimension);
    }
    if (container === this.activeContainer) {
      this._onDidLayoutActiveContainer.fire(dimension);
    }
  }
  isFloatingPanelsEnabled() {
    return false;
  }
  getLayoutClasses() {
    return coalesce([
      !this.partVisibility.sidebar ? "nosidebar" /* SIDEBAR_HIDDEN */ : void 0,
      !this._effectiveVisible(Parts.EDITOR_PART) ? "nomaineditorarea" /* MAIN_EDITOR_AREA_HIDDEN */ : void 0,
      !this._effectiveVisible(Parts.PANEL_PART) ? "nopanel" /* PANEL_HIDDEN */ : void 0,
      !this._effectiveVisible(Parts.AUXILIARYBAR_PART) ? "noauxiliarybar" /* AUXILIARYBAR_HIDDEN */ : void 0,
      !this.isEditorPaneVisible() ? "noeditorpane" /* EDITOR_PANE_HIDDEN */ : void 0,
      !this._effectiveVisible(Parts.SESSIONS_PART) ? "nosessionspart" /* SESSIONS_HIDDEN */ : void 0,
      !this.partVisibility.customViewGrid ? "nocustomviewgrid" /* CUSTOM_VIEW_GRID_HIDDEN */ : void 0,
      "nostatusbar" /* STATUSBAR_HIDDEN */,
      // agents window never has a status bar
      this.mainWindowFullscreen ? "fullscreen" /* FULLSCREEN */ : void 0,
      this.layoutPolicy.viewportClass.get() === "phone" ? "phone-layout" /* PHONE_LAYOUT */ : void 0
    ]);
  }
  isEditorPaneVisible() {
    return this._effectiveVisible(Parts.EDITOR_PART) || this._effectiveVisible(Parts.AUXILIARYBAR_PART);
  }
  _updateEditorPaneVisibilityClass() {
    this.mainContainer.classList.toggle("noeditorpane" /* EDITOR_PANE_HIDDEN */, !this.isEditorPaneVisible());
  }
  //#endregion
  //#region Part Management
  registerPart(part) {
    const id = part.getId();
    this.parts.set(id, part);
    return toDisposable(() => this.parts.delete(id));
  }
  getPart(key) {
    const part = this.parts.get(key);
    if (!part) {
      throw new Error(`Unknown part ${key}`);
    }
    return part;
  }
  hasFocus(part) {
    const container = this.getContainer(mainWindow, part);
    if (!container) {
      return false;
    }
    const activeElement = getActiveElement();
    if (!activeElement) {
      return false;
    }
    return isAncestorUsingFlowTo(activeElement, container);
  }
  focusPart(part, targetWindow = mainWindow) {
    switch (part) {
      case Parts.EDITOR_PART:
        this.editorGroupService.activeGroup.focus();
        break;
      case Parts.PANEL_PART:
        this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)?.focus();
        break;
      case Parts.SIDEBAR_PART:
        this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar)?.focus();
        break;
      case Parts.AUXILIARYBAR_PART:
        this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)?.focus();
        break;
      case Parts.SESSIONS_PART:
        this.getPart(Parts.SESSIONS_PART).getContainer()?.focus();
        break;
      case Parts.CUSTOM_VIEW_GRID_PART:
        this.customViewGridPartService.focusActiveView();
        break;
      default: {
        const container = this.getContainer(targetWindow, part);
        container?.focus();
      }
    }
  }
  focus() {
    this.focusPart(Parts.SESSIONS_PART);
  }
  getContainer(targetWindow, part) {
    if (typeof part === "undefined") {
      return this.getContainerFromDocument(targetWindow.document);
    }
    if (targetWindow === mainWindow) {
      return this.parts.get(part)?.getContainer();
    }
    if (part === Parts.EDITOR_PART) {
      const container = this.getContainerFromDocument(targetWindow.document);
      const partCandidate = this.editorGroupService.getPart(container);
      if (partCandidate instanceof Part) {
        return partCandidate.getContainer();
      }
    }
    return void 0;
  }
  whenContainerStylesLoaded(_window) {
    return void 0;
  }
  //#endregion
  //#region Part Visibility
  isActivityBarHidden() {
    return true;
  }
  static {
    /**
     * Parts a visible custom view replaces. While the custom view grid is shown
     * these keep their desired (per-session) visibility state but are not
     * rendered, so hiding the custom view restores whatever the layout
     * controller last asked for — including changes made while it was shown.
     */
    this._CUSTOM_VIEW_EXCLUSIVE_PARTS = [
      Parts.SESSIONS_PART,
      Parts.EDITOR_PART,
      Parts.AUXILIARYBAR_PART,
      Parts.PANEL_PART
    ];
  }
  /** The desired visibility of a part, ignoring any custom view showing over it. */
  _desiredVisible(part) {
    switch (part) {
      case Parts.SESSIONS_PART:
        return this.partVisibility.sessions;
      case Parts.EDITOR_PART:
        return this.partVisibility.editor;
      case Parts.AUXILIARYBAR_PART:
        return this.partVisibility.auxiliaryBar;
      case Parts.PANEL_PART:
        return this.partVisibility.panel;
      default:
        return false;
    }
  }
  /** Whether a part is actually rendered right now. */
  _effectiveVisible(part) {
    return this._desiredVisible(part) && !this.partVisibility.customViewGrid;
  }
  /**
   * Whether the editor grid node should be shown. In the single-pane layout the
   * node also hosts the docked auxiliary bar, so it follows both parts.
   */
  _editorNodeShouldBeVisible() {
    return this._editorNodeVisible(this._effectiveVisible(Parts.EDITOR_PART), this._effectiveVisible(Parts.AUXILIARYBAR_PART));
  }
  isVisible(part, targetWindow) {
    switch (part) {
      case Parts.TITLEBAR_PART:
        return this.layoutPolicy.viewportClass.get() !== "phone";
      case Parts.SIDEBAR_PART:
        return this.partVisibility.sidebar;
      case Parts.AUXILIARYBAR_PART:
      case Parts.EDITOR_PART:
      case Parts.PANEL_PART:
      case Parts.SESSIONS_PART:
        return this._effectiveVisible(part);
      case Parts.CUSTOM_VIEW_GRID_PART:
        return this.partVisibility.customViewGrid;
      case Parts.ACTIVITYBAR_PART:
      case Parts.STATUSBAR_PART:
      case Parts.BANNER_PART:
      default:
        return false;
    }
  }
  setPartHidden(hidden, part) {
    switch (part) {
      case Parts.SIDEBAR_PART:
        this.setSideBarHidden(hidden);
        break;
      case Parts.AUXILIARYBAR_PART:
        this.setAuxiliaryBarHidden(hidden);
        break;
      case Parts.EDITOR_PART:
        this.setEditorHidden(hidden);
        break;
      case Parts.PANEL_PART:
        this.setPanelHidden(hidden);
        break;
      case Parts.SESSIONS_PART:
        this.setSessionsHidden(hidden);
        break;
    }
  }
  toggleSecondarySideBar() {
    if (this.partVisibility.customViewGrid) {
      return;
    }
    const visible = !this.isSecondarySideBarVisible();
    this.setAuxiliaryBarHidden(!visible);
    alert(visible ? localize("auxiliaryBarVisible", "Secondary Side Bar shown") : localize("auxiliaryBarHidden", "Secondary Side Bar hidden"));
  }
  isSecondarySideBarVisible() {
    return this.isVisible(Parts.AUXILIARYBAR_PART);
  }
  isSidePaneVisible() {
    const { editor, auxiliaryBar } = this._getSidePaneState();
    return editor || auxiliaryBar;
  }
  toggleSidePane() {
    const sidePaneHadFocus = this.hasFocus(Parts.EDITOR_PART) || this.hasFocus(Parts.AUXILIARYBAR_PART);
    const stateBeforeToggle = this._getSidePaneState();
    const editorWasMaximized = this.isEditorMaximized();
    this._onWillToggleSidePane.fire();
    try {
      if (editorWasMaximized) {
        this.setEditorMaximized(false);
      }
      const visible2 = !this.isSidePaneVisible();
      if (!visible2) {
        this._restoreSidePaneEditorMaximizedOnShow = editorWasMaximized;
      }
      const suppressEditorPartAutoVisibility = this.suppressEditorPartAutoVisibility();
      try {
        if (visible2) {
          const restore = this._sidePaneStateBeforeHide ?? this._defaultSidePaneState;
          this.setEditorHidden(!restore.editor, false, true);
          this._setAuxiliaryBarHidden(!restore.auxiliaryBar, void 0, true);
        } else {
          this._sidePaneStateBeforeHide = this._getSidePaneState();
          this._setAuxiliaryBarHidden(true, void 0, true);
          this.setEditorHidden(true);
        }
      } finally {
        suppressEditorPartAutoVisibility.dispose();
      }
      if (!stateBeforeToggle.editor && !stateBeforeToggle.auxiliaryBar && this.isSidePaneVisible()) {
        this._onSidePaneRevealed();
      }
      if (visible2) {
        const restoreEditorMaximized = this._restoreSidePaneEditorMaximizedOnShow;
        this._restoreSidePaneEditorMaximizedOnShow = false;
        if (restoreEditorMaximized) {
          this.setEditorMaximized(true);
        }
      }
    } finally {
      this._onDidToggleSidePane.fire({ before: stateBeforeToggle, after: this._getSidePaneState() });
    }
    const visible = this.isSidePaneVisible();
    if (!visible && sidePaneHadFocus) {
      this.focusPart(Parts.SESSIONS_PART);
    }
    return visible;
  }
  _getSidePaneState() {
    const editor = this.isVisible(Parts.EDITOR_PART, mainWindow);
    const auxiliaryBar = this.isVisible(Parts.AUXILIARYBAR_PART);
    return { editor, auxiliaryBar };
  }
  setSideBarHidden(hidden) {
    if (this.partVisibility.sidebar === !hidden) {
      return;
    }
    const resizeContext = this._prepareSideBarResize(hidden);
    this.partVisibility.sidebar = !hidden;
    this.mainContainer.classList.toggle("nosidebar" /* SIDEBAR_HIDDEN */, hidden);
    this.workbenchGrid.setViewVisible(
      this.sideBarPartView,
      !hidden
    );
    this._applySideBarResize(hidden, resizeContext);
    if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar)) {
      this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Sidebar);
    }
    if (!hidden && !this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar)) {
      const viewletToOpen = this.paneCompositeService.getLastActivePaneCompositeId(ViewContainerLocation.Sidebar) ?? this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Sidebar)?.id;
      if (viewletToOpen) {
        this.paneCompositeService.openPaneComposite(viewletToOpen, ViewContainerLocation.Sidebar);
      }
    }
    this.layoutMobileSidebar();
    this._savePartVisibility();
    this._layoutGrid();
  }
  setAuxiliaryBarHidden(hidden) {
    this._setAuxiliaryBarHidden(hidden);
  }
  setAuxiliaryBarHiddenForResize(hidden) {
    this._setAuxiliaryBarHidden(hidden, "resize");
  }
  _setAuxiliaryBarHidden(hidden, source, skipSidePaneReveal = false) {
    if (this.partVisibility.auxiliaryBar === !hidden) {
      return;
    }
    const sidePaneWasClosed = !this.partVisibility.editor && !this.partVisibility.auxiliaryBar;
    if (hidden) {
      this._restoreAttachedEditorMaximizedOnShow = false;
    }
    this._onWillHideAuxiliaryBar(hidden);
    this.partVisibility.auxiliaryBar = !hidden;
    this.mainContainer.classList.toggle("noauxiliarybar" /* AUXILIARYBAR_HIDDEN */, !this._effectiveVisible(Parts.AUXILIARYBAR_PART));
    this._applyAuxiliaryBarVisibility(hidden, source);
    this._updateEditorPaneVisibilityClass();
    if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)) {
      this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.AuxiliaryBar);
    }
    if (!hidden && !this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)) {
      const paneCompositeToOpen = this.paneCompositeService.getLastActivePaneCompositeId(ViewContainerLocation.AuxiliaryBar) ?? this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.AuxiliaryBar)?.id;
      if (paneCompositeToOpen && this._shouldOpenAuxiliaryPaneComposite(paneCompositeToOpen)) {
        this.paneCompositeService.openPaneComposite(paneCompositeToOpen, ViewContainerLocation.AuxiliaryBar);
      }
    }
    if (!source) {
      this._savePartVisibility();
    }
    if (!hidden && sidePaneWasClosed && !skipSidePaneReveal) {
      this._onSidePaneRevealed();
    }
  }
  /**
   * Whether the given auxiliary-bar view container currently has content to show
   * (mirrors `IViewsService.isViewContainerActive`: a `hideIfEmpty` container is
   * only active once it has at least one active view descriptor). Used to avoid
   * presenting an empty docked detail panel.
   */
  _isAuxViewContainerActive(containerId) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(containerId);
    if (!viewContainer) {
      return false;
    }
    if (!viewContainer.hideIfEmpty) {
      return true;
    }
    return this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length > 0;
  }
  setEditorHidden(hidden, explicit = false, skipSidePaneReveal = false) {
    if (this.partVisibility.editor === !hidden) {
      return;
    }
    const sidePaneWasClosed = !this.partVisibility.editor && !this.partVisibility.auxiliaryBar;
    const panelSizeBeforeEditorReveal = !hidden && this.isSinglePaneLayoutEnabled && this._effectiveVisible(Parts.PANEL_PART) ? this.workbenchGrid.getViewSize(this.panelPartView) : void 0;
    this._editorRevealedExplicitly = !hidden && explicit;
    this._runWithEditorResizeSyncSuspended(() => {
      if (hidden && this._editorMaximized) {
        this.setEditorMaximized(false);
      }
      this.partVisibility.editor = !hidden;
      this.mainContainer.classList.toggle("nomaineditorarea" /* MAIN_EDITOR_AREA_HIDDEN */, !this._effectiveVisible(Parts.EDITOR_PART));
      if (this.editorPartView) {
        this._applyEditorVisibility(hidden);
      }
      this._updateEditorPaneVisibilityClass();
      this._savePartVisibility();
    });
    if (panelSizeBeforeEditorReveal) {
      this.workbenchGrid.resizeView(this.panelPartView, panelSizeBeforeEditorReveal);
    }
    if (!hidden && sidePaneWasClosed && !skipSidePaneReveal) {
      this._onSidePaneRevealed();
    }
  }
  /**
   * Fires when the side pane (editor part and/or auxiliary bar) transitions from
   * fully hidden to visible.
   */
  _onSidePaneRevealed() {
    this._onDidRevealSidePane.fire();
  }
  /**
   * Sizes the editor part when it is first revealed from a hidden state, so it
   * opens as a comfortable split with the sessions part rather than at its
   * minimum/restored width. The default grid layout splits the main area evenly;
   * layouts with different sizing (e.g. the single-pane side pane) override this.
   */
  _applyEditorSplitSize(mainAreaWidth) {
    const targetEditorWidth = Math.max(EDITOR_PART_MINIMUM_WIDTH, Math.floor(mainAreaWidth / 2));
    const currentEditorSize = this.workbenchGrid.getViewSize(this.editorPartView);
    this.workbenchGrid.resizeView(this.editorPartView, {
      width: targetEditorWidth,
      height: currentEditorSize.height
    });
  }
  setPanelHidden(hidden) {
    if (this.partVisibility.panel === !hidden) {
      return;
    }
    if (hidden && this.workbenchGrid.hasMaximizedView()) {
      this.workbenchGrid.exitMaximizedView();
    }
    const panelHadFocus = !hidden || this.hasFocus(Parts.PANEL_PART);
    this.partVisibility.panel = !hidden;
    this.mainContainer.classList.toggle("nopanel" /* PANEL_HIDDEN */, !this._effectiveVisible(Parts.PANEL_PART));
    this.workbenchGrid.setViewVisible(
      this.panelPartView,
      this._effectiveVisible(Parts.PANEL_PART)
    );
    if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)) {
      this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Panel);
      if (panelHadFocus) {
        this.focusPart(Parts.SESSIONS_PART);
      }
    }
    if (!hidden) {
      if (!this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)) {
        const panelToOpen = this.paneCompositeService.getLastActivePaneCompositeId(ViewContainerLocation.Panel) ?? this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Panel)?.id;
        if (panelToOpen) {
          this.paneCompositeService.openPaneComposite(panelToOpen, ViewContainerLocation.Panel);
        }
      }
      if (this._effectiveVisible(Parts.PANEL_PART)) {
        this.focusPart(Parts.PANEL_PART);
      }
    }
  }
  setSessionsHidden(hidden) {
    if (this.partVisibility.sessions === !hidden) {
      return;
    }
    this.partVisibility.sessions = !hidden;
    this.mainContainer.classList.toggle("nosessionspart" /* SESSIONS_HIDDEN */, !this._effectiveVisible(Parts.SESSIONS_PART));
    this.workbenchGrid.setViewVisible(this.sessionsPartView, this._effectiveVisible(Parts.SESSIONS_PART));
  }
  /**
   * Shows or hides the custom view grid. The custom view grid and the sessions
   * grid are mutually exclusive and exactly one of them owns the row, so hiding
   * the custom view always brings the sessions grid back (together with the side
   * panel and panel state the layout wants for the active session). The parts it
   * covers keep their desired visibility while it is shown, so the restore
   * reflects whatever the layout controller last asked for.
   */
  _applyCustomViewGridVisibility(descriptor) {
    const visible = !!descriptor;
    if (this.partVisibility.customViewGrid === visible) {
      this.customViewGridPartService.setView(descriptor);
      return;
    }
    const wasVisible = Workbench._CUSTOM_VIEW_EXCLUSIVE_PARTS.map((part) => this._effectiveVisible(part));
    if (visible && this._editorMaximized) {
      this.setEditorMaximized(false);
    }
    this.customViewGridPartService.setView(descriptor);
    this.partVisibility.customViewGrid = visible;
    this._customViewVisibleKey.set(visible);
    if (!this.workbenchGrid) {
      return;
    }
    this._applyingCustomViewGridVisibility = true;
    try {
      this._runWithEditorResizeSyncSuspended(() => {
        if (visible) {
          this.workbenchGrid.setViewVisible(this.customViewGridPartView, true);
          this._applyExclusivePartVisibility();
        } else {
          this._applyExclusivePartVisibility();
          this.workbenchGrid.setViewVisible(this.customViewGridPartView, false);
        }
      });
    } finally {
      this._applyingCustomViewGridVisibility = false;
    }
    this._updateExclusiveLayoutClasses();
    this.mainContainer.classList.toggle("nocustomviewgrid" /* CUSTOM_VIEW_GRID_HIDDEN */, !visible);
    this._updateMobileCustomViewNavigation();
    if (visible) {
      this._fireDidChangePartVisibility(Parts.CUSTOM_VIEW_GRID_PART, true);
    }
    Workbench._CUSTOM_VIEW_EXCLUSIVE_PARTS.forEach((part, index) => {
      const nowVisible = this._effectiveVisible(part);
      if (nowVisible !== wasVisible[index]) {
        this._fireDidChangePartVisibility(part, nowVisible);
      }
    });
    if (!visible) {
      this._fireDidChangePartVisibility(Parts.CUSTOM_VIEW_GRID_PART, false);
    }
    this.layout();
    if (visible) {
      this.focusPart(Parts.CUSTOM_VIEW_GRID_PART);
    } else {
      this.sessionsPartService.focusSession(this.sessionsService.activeSession.get());
    }
  }
  _applyExclusivePartVisibility() {
    this.workbenchGrid.setViewVisible(this.sessionsPartView, this._effectiveVisible(Parts.SESSIONS_PART));
    this.workbenchGrid.setViewVisible(this.panelPartView, this._effectiveVisible(Parts.PANEL_PART));
    this._applyEditorAreaVisibility();
  }
  /** Pushes the editor and auxiliary bar node visibility into the grid. */
  _applyEditorAreaVisibility() {
    this.workbenchGrid.setViewVisible(this.editorPartView, this._editorNodeShouldBeVisible());
    this.workbenchGrid.setViewVisible(this.auxiliaryBarPartView, this._effectiveVisible(Parts.AUXILIARYBAR_PART));
  }
  _updateExclusiveLayoutClasses() {
    this.mainContainer.classList.toggle("nosessionspart" /* SESSIONS_HIDDEN */, !this._effectiveVisible(Parts.SESSIONS_PART));
    this.mainContainer.classList.toggle("nomaineditorarea" /* MAIN_EDITOR_AREA_HIDDEN */, !this._effectiveVisible(Parts.EDITOR_PART));
    this.mainContainer.classList.toggle("noauxiliarybar" /* AUXILIARYBAR_HIDDEN */, !this._effectiveVisible(Parts.AUXILIARYBAR_PART));
    this.mainContainer.classList.toggle("nopanel" /* PANEL_HIDDEN */, !this._effectiveVisible(Parts.PANEL_PART));
    this._updateEditorPaneVisibilityClass();
  }
  /** Keeps the Android back button in sync with a shown custom view. */
  _updateMobileCustomViewNavigation() {
    const tracked = this.layoutPolicy.viewportClass.get() === "phone" && this.partVisibility.customViewGrid;
    if (tracked === this.mobileNavStack.has("customView")) {
      return;
    }
    if (tracked) {
      this.mobileNavStack.push("customView");
    } else {
      this.mobileNavStack.popSilently("customView");
    }
  }
  //#endregion
  //#region Position Methods (Fixed - Not Configurable)
  getSideBarPosition() {
    return Position.LEFT;
  }
  getPanelPosition() {
    return Position.BOTTOM;
  }
  setPanelPosition(_position) {
  }
  getPanelAlignment() {
    return "justify";
  }
  setPanelAlignment(_alignment) {
  }
  //#endregion
  //#region Size Methods
  getSize(part) {
    if (part === Parts.AUXILIARYBAR_PART) {
      return this._auxiliaryBarViewSize();
    }
    const view = this.getPartView(part);
    if (!view) {
      return { width: 0, height: 0 };
    }
    return this.workbenchGrid.getViewSize(view);
  }
  setSize(part, size2) {
    if (part === Parts.AUXILIARYBAR_PART) {
      this._setAuxiliaryBarViewSize(size2);
      return;
    }
    const view = this.getPartView(part);
    if (view) {
      this.workbenchGrid.resizeView(view, size2);
    }
  }
  resizePart(part, sizeChangeWidth, sizeChangeHeight) {
    if (part === Parts.AUXILIARYBAR_PART) {
      this._resizeAuxiliaryBarBy(sizeChangeWidth, sizeChangeHeight);
      return;
    }
    const view = this.getPartView(part);
    if (!view) {
      return;
    }
    const currentSize = this.workbenchGrid.getViewSize(view);
    this.workbenchGrid.resizeView(view, {
      width: currentSize.width + sizeChangeWidth,
      height: currentSize.height + sizeChangeHeight
    });
  }
  getPartView(part) {
    switch (part) {
      case Parts.TITLEBAR_PART:
        return this.titleBarPartView;
      case Parts.SIDEBAR_PART:
        return this.sideBarPartView;
      case Parts.AUXILIARYBAR_PART:
        return this.auxiliaryBarPartView;
      case Parts.EDITOR_PART:
        return this.editorPartView;
      case Parts.PANEL_PART:
        return this.panelPartView;
      case Parts.SESSIONS_PART:
        return this.sessionsPartView;
      case Parts.CUSTOM_VIEW_GRID_PART:
        return this.customViewGridPartView;
      default:
        return void 0;
    }
  }
  getMaximumEditorDimensions(_container) {
    const sidebarWidth = this.partVisibility.sidebar ? this.workbenchGrid.getViewSize(this.sideBarPartView).width : 0;
    const auxiliaryBarWidth = this.partVisibility.auxiliaryBar ? this._auxiliaryBarLayoutWidth() : 0;
    const panelHeight = this.partVisibility.panel ? this.workbenchGrid.getViewSize(this.panelPartView).height : 0;
    const titleBarHeight = this.workbenchGrid.getViewSize(this.titleBarPartView).height;
    return new Dimension(
      this._mainContainerDimension.width - sidebarWidth - auxiliaryBarWidth,
      this._mainContainerDimension.height - titleBarHeight - panelHeight
    );
  }
  //#endregion
  //#region Unsupported Features (No-ops)
  toggleMaximizedPanel() {
    if (!this.workbenchGrid) {
      return;
    }
    if (this.isPanelMaximized()) {
      this.workbenchGrid.exitMaximizedView();
    } else {
      this.workbenchGrid.maximizeView(this.panelPartView, [this.titleBarPartView, this.sideBarPartView]);
    }
  }
  isPanelMaximized() {
    if (!this.workbenchGrid) {
      return false;
    }
    return this.workbenchGrid.isViewMaximized(this.panelPartView);
  }
  toggleMaximizedAuxiliaryBar() {
  }
  setAuxiliaryBarMaximized(_maximized) {
    return false;
  }
  isAuxiliaryBarMaximized() {
    return false;
  }
  isEditorMaximized() {
    return this._editorMaximized;
  }
  setEditorMaximized(maximized) {
    if (maximized === this._editorMaximized) {
      return;
    }
    if (maximized) {
      this._editorLastNonMaximizedVisibility = {
        sidebar: this.partVisibility.sidebar,
        auxiliaryBar: this.partVisibility.auxiliaryBar,
        editor: this.partVisibility.editor,
        panel: this.partVisibility.panel,
        sessions: this.partVisibility.sessions,
        customViewGrid: this.partVisibility.customViewGrid
      };
      this._editorLastNonMaximizedSize = this.editorPartView ? this.workbenchGrid.getViewSize(this.editorPartView) : void 0;
      if (!this.partVisibility.editor) {
        this.setEditorHidden(false);
      }
      if (this.partVisibility.sidebar) {
        this.setSideBarHidden(true);
      }
      if (this.partVisibility.sessions) {
        this.setSessionsHidden(true);
      }
      this._editorMaximized = true;
    } else {
      const state = this._editorLastNonMaximizedVisibility;
      const size2 = this._editorLastNonMaximizedSize;
      this._editorLastNonMaximizedSize = void 0;
      this.setSideBarHidden(!state?.sidebar);
      this.setSessionsHidden(!state?.sessions);
      this.setAuxiliaryBarHidden(!state?.auxiliaryBar);
      this._editorMaximized = false;
      if (this.editorPartView && size2) {
        this.workbenchGrid.resizeView(this.editorPartView, size2);
      }
      this._layoutSidePane();
    }
    this._onDidChangeEditorMaximized.fire();
  }
  toggleZenMode() {
  }
  toggleMenuBar() {
  }
  isMainEditorLayoutCentered() {
    return false;
  }
  centerMainEditorLayout(_active) {
  }
  hasMainWindowBorder() {
    return false;
  }
  getMainWindowBorderRadius() {
    return void 0;
  }
  //#endregion
  //#region Window Maximized State
  isWindowMaximized(targetWindow) {
    return this.maximized.has(getWindowId(targetWindow));
  }
  updateWindowMaximizedState(targetWindow, maximized) {
    const windowId = getWindowId(targetWindow);
    if (maximized) {
      this.maximized.add(windowId);
      if (targetWindow === mainWindow) {
        this.mainContainer.classList.add("maximized" /* MAXIMIZED */);
      }
    } else {
      this.maximized.delete(windowId);
      if (targetWindow === mainWindow) {
        this.mainContainer.classList.remove("maximized" /* MAXIMIZED */);
      }
    }
    this._onDidChangeWindowMaximized.fire({ windowId, maximized });
  }
  //#endregion
  //#region Neighbor Parts
  getVisibleNeighborPart(part, direction) {
    if (!this.workbenchGrid) {
      return void 0;
    }
    const view = this.getPartView(part);
    if (!view) {
      return void 0;
    }
    const neighbor = this.workbenchGrid.getNeighborViews(view, direction, false);
    if (neighbor.length === 0) {
      return void 0;
    }
    const neighborView = neighbor[0];
    if (neighborView === this.titleBarPartView) {
      return Parts.TITLEBAR_PART;
    }
    if (neighborView === this.sideBarPartView) {
      return Parts.SIDEBAR_PART;
    }
    if (neighborView === this.auxiliaryBarPartView) {
      return Parts.AUXILIARYBAR_PART;
    }
    if (neighborView === this.editorPartView) {
      return Parts.EDITOR_PART;
    }
    if (neighborView === this.panelPartView) {
      return Parts.PANEL_PART;
    }
    if (neighborView === this.sessionsPartView) {
      return Parts.SESSIONS_PART;
    }
    return void 0;
  }
  //#endregion
  //#region Restore
  isRestored() {
    return this.restored;
  }
  setRestored() {
    this.restored = true;
    this.restoredPromise.complete();
  }
  //#endregion
  //#region Notifications Registration
  registerNotifications(delegate) {
    this._register(delegate.onDidChangeNotificationsVisibility((visible) => this._onDidChangeNotificationsVisibility.fire(visible)));
  }
  //#endregion
}
export {
  CLOSE_MOBILE_SIDEBAR_DRAWER_COMMAND_ID,
  IAgentWorkbenchLayoutService,
  Workbench
};
