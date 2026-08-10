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
import { screen, WebContentsView, webContents } from "electron";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Emitter } from "../../../base/common/event.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { browserViewIsolatedWorldId, browserZoomFactors, browserZoomDefaultIndex } from "../common/browserView.js";
import { BrowserViewEmulator } from "./browserViewEmulator.js";
import { BrowserViewInspector } from "./browserViewInspector.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
import { LoadReason } from "../../window/electron-main/window.js";
import { IAuxiliaryWindowsMainService } from "../../auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { BrowserViewDebugger } from "./browserViewDebugger.js";
import { ILogService } from "../../log/common/log.js";
import { PermissionCategory } from "../common/browserPermissions.js";
import { SCAN_CODE_STR_TO_EVENT_KEY_CODE } from "../../../base/common/keyCodes.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { logBrowserOpen } from "../common/browserViewTelemetry.js";
var NewPageLocation = /* @__PURE__ */ ((NewPageLocation2) => {
  NewPageLocation2["Foreground"] = "foreground";
  NewPageLocation2["Background"] = "background";
  NewPageLocation2["NewWindow"] = "newWindow";
  return NewPageLocation2;
})(NewPageLocation || {});
let BrowserView = class extends Disposable {
  constructor(id, owner, session, createChildView, openContextMenu, options, windowsMainService, auxiliaryWindowsMainService, logService, telemetryService) {
    super();
    this.id = id;
    this.owner = owner;
    this.session = session;
    this.windowsMainService = windowsMainService;
    this.auxiliaryWindowsMainService = auxiliaryWindowsMainService;
    this.logService = logService;
    this.telemetryService = telemetryService;
    this._faviconRequestCache = /* @__PURE__ */ new Map();
    this._lastScreenshot = void 0;
    this._lastFavicon = void 0;
    this._lastError = void 0;
    this._lastUserGestureTimestamp = -Infinity;
    this._browserZoomIndex = browserZoomDefaultIndex;
    this._explicitNavigationPending = false;
    /**
     * Active index in the webContents navigation history list.
     * Used to tell whether a navigation appended a new entry or replaced the current one in place.
     */
    this._lastCommittedEntryIndex = -1;
    this._isDisposed = false;
    this._wantsVisibility = false;
    this._hasBeenLaidOut = false;
    this._consoleLogs = [];
    this._onDidNavigate = this._register(new Emitter());
    this.onDidNavigate = this._onDidNavigate.event;
    this._onDidChangeLoadingState = this._register(new Emitter());
    this.onDidChangeLoadingState = this._onDidChangeLoadingState.event;
    this._onDidChangeFocus = this._register(new Emitter());
    this.onDidChangeFocus = this._onDidChangeFocus.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDidChangeDevToolsState = this._register(new Emitter());
    this.onDidChangeDevToolsState = this._onDidChangeDevToolsState.event;
    this._onDidKeyCommand = this._register(new Emitter());
    this.onDidKeyCommand = this._onDidKeyCommand.event;
    this._onDidChangeTitle = this._register(new Emitter());
    this.onDidChangeTitle = this._onDidChangeTitle.event;
    this._onDidChangeFavicon = this._register(new Emitter());
    this.onDidChangeFavicon = this._onDidChangeFavicon.event;
    this._onDidFindInPage = this._register(new Emitter());
    this.onDidFindInPage = this._onDidFindInPage.event;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeRemoteStatus = this._register(new Emitter());
    this.onDidChangeRemoteStatus = this._onDidChangeRemoteStatus.event;
    this._onDidRequestPermission = this._register(new Emitter());
    this.onDidRequestPermission = this._onDidRequestPermission.event;
    this._onDidChangePermissions = this._register(new Emitter());
    this.onDidChangePermissions = this._onDidChangePermissions.event;
    const webPreferences = {
      ...options?.webPreferences,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // NOTE: When `sandbox` is enabled, `nodeIntegrationInSubFrames` doesn't actually enable node integration or prevent sandboxing.
      //       It allows preload scripts to run in subframes, which is important for our features like keyboard shortcut forwarding.
      nodeIntegrationInSubFrames: true,
      webviewTag: false,
      session: this.session.electronSession,
      focusOnNavigation: false
    };
    this._view = new WebContentsView({
      webPreferences,
      // Passing an `undefined` webContents triggers an error in Electron.
      ...options?.webContents ? { webContents: options.webContents } : {}
    });
    this._view.setBounds({ x: 0, y: 0, width: 1024, height: 768 });
    this._view.setBackgroundColor("#FFFFFF");
    this._ownerWindow = this.windowsMainService.getWindowById(owner.mainWindowId);
    if (!this._ownerWindow) {
      throw new Error(`Window with ID ${owner.mainWindowId} not found`);
    }
    this._register(this._ownerWindow.onDidClose(() => this.dispose()));
    this._register(this._ownerWindow.onWillLoad((e) => {
      if (e.reason === LoadReason.LOAD) {
        this.dispose();
      } else if (e.reason === LoadReason.RELOAD) {
        this.setVisible(false);
      }
    }));
    this._view.setVisible(false);
    this._ownerWindow.win?.contentView.addChildView(this._view);
    this._view.webContents.setWindowOpenHandler((details) => {
      const location = (() => {
        switch (details.disposition) {
          case "background-tab":
            return "background" /* Background */;
          case "foreground-tab":
            return "foreground" /* Foreground */;
          case "new-window":
            return "newWindow" /* NewWindow */;
          default:
            return void 0;
        }
      })();
      if (!location || !this.consumePopupPermission(location)) {
        return { action: "deny" };
      }
      return {
        action: "allow",
        createWindow: (options2) => {
          logBrowserOpen(this.telemetryService, (() => {
            switch (location) {
              case "newWindow" /* NewWindow */:
                return "browserLinkNewWindow";
              case "background" /* Background */:
                return "browserLinkBackground";
              case "foreground" /* Foreground */:
                return "browserLinkForeground";
            }
          })());
          const childView = createChildView(details.url, options2, {
            pinned: true,
            background: location === "background" /* Background */,
            parentViewId: id,
            auxiliaryWindow: location === "newWindow" /* NewWindow */ ? { x: options2.x, y: options2.y, width: options2.width, height: options2.height } : void 0
          });
          return childView.webContents;
        },
        // We want the standard browser behavior as opposed to Electron's default of closing the new window when the parent is closed
        outlivesOpener: true
      };
    });
    this._view.webContents.on("context-menu", (_event, params) => {
      openContextMenu(this, params);
    });
    this._view.webContents.on("destroyed", () => {
      this.dispose();
    });
    this.debugger = new BrowserViewDebugger(this, this.logService);
    this.emulator = this._register(new BrowserViewEmulator(this, this.logService));
    this.inspector = this._register(new BrowserViewInspector(this));
    const fireRemoteStatus = () => this._onDidChangeRemoteStatus.fire(this.session.remote.isRemote);
    this._register(this.session.remote.onDidStart(fireRemoteStatus));
    this._register(this.session.remote.onDidStop(fireRemoteStatus));
    this._register(this.session.permissions.onDidRequestPermission((e) => {
      if (e.webContents === this.webContents && !this._isDisposed) {
        e.claim();
        this._onDidRequestPermission.fire(e.request);
      }
    }));
    this._register(this.session.permissions.onDidRequestDevice((e) => {
      if (e.webContents === this.webContents && !this._isDisposed) {
        e.claim();
        this._onDidRequestPermission.fire({
          origin: e.origin,
          category: PermissionCategory.Devices,
          device: {
            requestId: e.requestId,
            deviceType: e.deviceType,
            devices: e.devices
          }
        });
      }
    }));
    this._register(this.session.permissions.onDidChange(() => {
      this._onDidChangePermissions.fire(this.session.permissions.serialize());
    }));
    this.setupEventListeners();
  }
  static {
    this.MAX_CONSOLE_LOG_ENTRIES = 1e3;
  }
  static {
    /**
     * Resize a full-page screenshot so its largest dimension never exceeds this many pixels. A very tall
     * or wide page would otherwise request an enormous bitmap, which is costly to allocate/encode and
     * can stress the browser process. We downscale via `scale` (rather than cropping) so the whole page
     * still fits in the result.
     */
    this.MAX_FULL_PAGE_SCREENSHOT_DIMENSION = 2576;
  }
  setupEventListeners() {
    const webContents2 = this._view.webContents;
    webContents2.on("devtools-opened", () => {
      this._onDidChangeDevToolsState.fire({ isDevToolsOpen: true });
    });
    webContents2.on("devtools-closed", () => {
      this._onDidChangeDevToolsState.fire({ isDevToolsOpen: false });
    });
    webContents2.on("page-favicon-updated", async (_event, favicons) => {
      for (const url of favicons) {
        if (!this._faviconRequestCache.has(url)) {
          this._faviconRequestCache.set(url, (async () => {
            if (url.startsWith("data:image/")) {
              return url;
            }
            const response = await webContents2.session.fetch(url, {
              cache: "force-cache"
            });
            if (!response.ok) {
              throw new Error(`Failed to fetch favicon: ${response.status} ${response.statusText}`);
            }
            const type = await response.headers.get("content-type");
            if (!type?.startsWith("image/")) {
              throw new Error(`Favicon is not an image: ${type}`);
            }
            const buffer = await response.arrayBuffer();
            return `data:${type};base64,${Buffer.from(buffer).toString("base64")}`;
          })());
        }
        try {
          this._lastFavicon = await this._faviconRequestCache.get(url);
          this._onDidChangeFavicon.fire({ favicon: this._lastFavicon });
          this._currentHistoryHandle?.update({ favicon: this._lastFavicon });
          return;
        } catch (e) {
        }
      }
      if (this._lastFavicon) {
        this._lastFavicon = void 0;
        this._onDidChangeFavicon.fire({ favicon: this._lastFavicon });
        this._currentHistoryHandle?.update({ favicon: null });
      }
    });
    webContents2.on("will-navigate", (event) => {
      const host = URL.parse(event.url)?.host;
      const currHost = URL.parse(this.webContents.getURL())?.host;
      if (host !== currHost) {
        this._lastFavicon = void 0;
      }
    });
    webContents2.on("page-title-updated", (_event, title) => {
      this._onDidChangeTitle.fire({ title });
      this._currentHistoryHandle?.update({ title });
    });
    const fireNavigationEvent = (url) => {
      this._onDidNavigate.fire({
        url,
        title: webContents2.getTitle(),
        canGoBack: webContents2.navigationHistory.canGoBack(),
        canGoForward: webContents2.navigationHistory.canGoForward(),
        certificateError: this.session.trust.getCertificateError(url)
      });
      this._recordNavigation(url);
    };
    const fireLoadingEvent = (loading) => {
      this._onDidChangeLoadingState.fire({ loading, error: this._lastError });
    };
    webContents2.on("did-start-loading", () => {
      this._lastError = void 0;
      if (webContents2.isLoadingMainFrame()) {
        fireLoadingEvent(true);
      }
    });
    webContents2.on("did-stop-loading", () => fireLoadingEvent(false));
    webContents2.on("did-fail-load", (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        if (errorCode === -3) {
          fireLoadingEvent(false);
          return;
        }
        this._lastError = {
          url: validatedURL,
          errorCode,
          errorDescription,
          // -200 - -220 are the range of certificate errors in Chromium.
          certificateError: errorCode <= -200 && errorCode >= -220 ? this.session.trust.getCertificateError(validatedURL) : void 0
        };
        fireLoadingEvent(false);
        this._onDidNavigate.fire({
          url: validatedURL,
          title: "",
          canGoBack: webContents2.navigationHistory.canGoBack(),
          canGoForward: webContents2.navigationHistory.canGoForward(),
          certificateError: this.session.trust.getCertificateError(validatedURL)
        });
      }
    });
    webContents2.on("did-finish-load", () => fireLoadingEvent(false));
    this.session.trust.installCertErrorHandler(webContents2);
    webContents2.on("login", (event, _details, authInfo, callback) => {
      if (this.session.remote.proxy) {
        const { username, password } = this.session.remote.proxy.credentials;
        const proxyPort = this.session.remote.proxy.port;
        if (authInfo.isProxy && authInfo.host === "127.0.0.1" && authInfo.port === proxyPort) {
          event.preventDefault();
          callback(username, password);
        }
      }
    });
    webContents2.on("render-process-gone", (_event, details) => {
      this._lastError = {
        url: webContents2.getURL(),
        errorCode: details.exitCode,
        errorDescription: `Render process gone: ${details.reason}`
      };
      fireLoadingEvent(false);
    });
    webContents2.on("did-navigate", (_, url) => fireNavigationEvent(url));
    webContents2.on("did-navigate-in-page", (_, url, isMainFrame) => {
      if (isMainFrame) {
        fireNavigationEvent(url);
      }
    });
    webContents2.on("did-navigate", () => {
      this._consoleLogs.length = 0;
      this._view.webContents.setZoomFactor(browserZoomFactors[this._browserZoomIndex]);
      void this._view.webContents.setVisualZoomLevelLimits(1, 3).catch((error) => {
        this.logService.error("Failed to set visual zoom level limits for browser view webContents.", error);
      });
    });
    webContents2.on("select-bluetooth-device", (event, devices, callback) => {
      event.preventDefault();
      this.session.permissions.beginBluetoothRequest(this.webContents, devices, callback);
    });
    webContents2.on("focus", () => {
      this._onDidChangeFocus.fire({ focused: true });
    });
    webContents2.on("blur", () => {
      this._onDidChangeFocus.fire({ focused: false });
    });
    const onCommandKeydown = (_event, keyEvent) => {
      this._onDidKeyCommand.fire(keyEvent);
    };
    webContents2.ipc.on("vscode:browserView:keydown", onCommandKeydown);
    webContents2.on("devtools-opened", () => {
      webContents2.devToolsWebContents?.ipc.off("vscode:browserView:keydown", onCommandKeydown);
      webContents2.devToolsWebContents?.ipc.on("vscode:browserView:keydown", onCommandKeydown);
    });
    webContents2.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") {
        return;
      }
      const pageIsAvailable = this._view.getVisible() && !webContents2.isCrashed() && !this.debugger.isPaused;
      if (pageIsAvailable) {
        return;
      }
      if (!(input.control || input.alt || input.meta) && input.key.length === 1) {
        return;
      }
      event.preventDefault();
      const eventKeyCode = SCAN_CODE_STR_TO_EVENT_KEY_CODE[input.code] || 0;
      this._onDidKeyCommand.fire({
        key: input.key,
        keyCode: eventKeyCode,
        code: input.code,
        ctrlKey: input.control,
        shiftKey: input.shift,
        altKey: input.alt,
        metaKey: input.meta,
        repeat: input.isAutoRepeat
      });
    });
    webContents2.on("input-event", (_event, input) => {
      switch (input.type) {
        case "rawKeyDown":
        case "keyDown":
        case "mouseDown":
        case "pointerDown":
        case "pointerUp":
        case "touchEnd":
          this._lastUserGestureTimestamp = Date.now();
      }
    });
    webContents2.on("will-prevent-unload", (e) => {
      e.preventDefault();
    });
    webContents2.on("found-in-page", (_event, result) => {
      this._onDidFindInPage.fire({
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        selectionArea: result.selectionArea,
        finalUpdate: result.finalUpdate
      });
    });
    this._view.webContents.on("console-message", (event) => {
      this._consoleLogs.push(`[${event.level}] ${event.message}`);
      if (this._consoleLogs.length > BrowserView.MAX_CONSOLE_LOG_ENTRIES) {
        this._consoleLogs.splice(0, this._consoleLogs.length - BrowserView.MAX_CONSOLE_LOG_ENTRIES);
      }
    });
  }
  consumePopupPermission(location) {
    switch (location) {
      case "foreground" /* Foreground */:
      case "background" /* Background */:
        return true;
      case "newWindow" /* NewWindow */:
        if (this._lastUserGestureTimestamp > Date.now() - 1e3) {
          this._lastUserGestureTimestamp = -Infinity;
          return true;
        }
        return false;
    }
  }
  /**
   * Record a committed navigation in the session's history.
   */
  _recordNavigation(url) {
    const webContents2 = this._view.webContents;
    const activeIndex = webContents2.navigationHistory.getActiveIndex();
    if (!isTrackableHistoryUrl(url)) {
      this._currentHistoryHandle = void 0;
      this._lastCommittedEntryIndex = activeIndex;
      return;
    }
    const handle = this._currentHistoryHandle;
    if (handle && activeIndex === this._lastCommittedEntryIndex) {
      handle.update({ url, title: webContents2.getTitle() });
      return;
    }
    this._lastCommittedEntryIndex = activeIndex;
    const userInitiated = this._explicitNavigationPending;
    this._explicitNavigationPending = false;
    this._currentHistoryHandle = this.session.history.add(
      url,
      webContents2.getTitle(),
      this._lastFavicon,
      userInitiated
    );
  }
  get webContents() {
    return this._view.webContents;
  }
  /**
   * Get the current state of this browser view
   */
  getState() {
    const webContents2 = this._view.webContents;
    const url = webContents2.getURL();
    return {
      url,
      title: webContents2.getTitle(),
      canGoBack: webContents2.navigationHistory.canGoBack(),
      canGoForward: webContents2.navigationHistory.canGoForward(),
      loading: webContents2.isLoading(),
      focused: webContents2.isFocused(),
      visible: this._view.getVisible(),
      isDevToolsOpen: webContents2.isDevToolsOpened(),
      lastScreenshot: this._lastScreenshot,
      lastFavicon: this._lastFavicon,
      lastError: this._lastError,
      certificateError: this.session.trust.getCertificateError(url),
      storageScope: this.session.storageScope,
      storageKeys: { ...this.session.history.storageKeys, ...this.session.permissions.storageKeys },
      permissions: this.session.permissions.serialize(),
      browserZoomIndex: this._browserZoomIndex,
      elementSelectionState: this.inspector.elementSelectionState,
      isRemoteSession: this.session.remote.isRemote,
      isAreaSelectionActive: this.inspector.isAreaSelectionActive,
      device: this.emulator.device
    };
  }
  /**
   * Toggle developer tools for this browser view.
   */
  toggleDevTools() {
    this._view.webContents.toggleDevTools();
  }
  /**
   * Update the layout bounds of this view
   */
  layout(bounds) {
    if (this._currentWindow?.win?.id !== bounds.windowId) {
      const newWindow = this._windowById(bounds.windowId);
      if (newWindow) {
        this._currentWindow?.win?.contentView.removeChildView(this._view);
        this._currentWindow = newWindow;
        newWindow.win?.contentView.addChildView(this._view);
      }
    }
    this._view.setBorderRadius(Math.round(bounds.cornerRadius * bounds.zoomFactor));
    if (bounds.emulation) {
      this.emulator.applyScreenEmulation(bounds.width, bounds.height, bounds.emulation.scale, bounds.zoomFactor);
    }
    this._view.setBounds({
      x: Math.round(bounds.x * bounds.zoomFactor),
      y: Math.round(bounds.y * bounds.zoomFactor),
      width: Math.round(bounds.width * bounds.zoomFactor),
      height: Math.round(bounds.height * bounds.zoomFactor)
    });
    this._hasBeenLaidOut = true;
    if (this._wantsVisibility && !this._view.getVisible()) {
      this._view.setVisible(true);
    }
  }
  setBrowserZoomIndex(zoomIndex) {
    this._browserZoomIndex = Math.max(0, Math.min(zoomIndex, browserZoomFactors.length - 1));
    const browserZoomFactor = browserZoomFactors[this._browserZoomIndex];
    this._view.webContents.setZoomFactor(browserZoomFactor);
  }
  /**
   * Set the visibility of this view
   */
  setVisible(visible) {
    if (this._wantsVisibility === visible) {
      return;
    }
    if (!visible && this._view.webContents.isFocused()) {
      this._currentWindow?.win?.webContents.focus();
    }
    if (this._hasBeenLaidOut || !visible) {
      this._view.setVisible(visible);
    }
    this._wantsVisibility = visible;
    this._onDidChangeVisibility.fire({ visible });
  }
  /**
   * Get captured console logs.
   */
  getConsoleLogs() {
    return this._consoleLogs.join("\n");
  }
  /**
   * Load a URL in this view
   */
  async loadURL(url) {
    this._explicitNavigationPending = true;
    await this.session.remote.whenReady;
    await this._view.webContents.loadURL(url);
  }
  /**
   * Get the current URL
   */
  getURL() {
    return this._view.webContents.getURL();
  }
  /**
   * Navigate back in history
   */
  goBack() {
    if (this._view.webContents.navigationHistory.canGoBack()) {
      this._view.webContents.navigationHistory.goBack();
    }
  }
  /**
   * Navigate forward in history
   */
  goForward() {
    if (this._view.webContents.navigationHistory.canGoForward()) {
      this._view.webContents.navigationHistory.goForward();
    }
  }
  /**
   * Reload the current page
   */
  reload(hard) {
    if (hard) {
      this._view.webContents.reloadIgnoringCache();
    } else {
      this._view.webContents.reload();
    }
  }
  /**
   * Check if the view can navigate back
   */
  canGoBack() {
    return this._view.webContents.navigationHistory.canGoBack();
  }
  /**
   * Check if the view can navigate forward
   */
  canGoForward() {
    return this._view.webContents.navigationHistory.canGoForward();
  }
  /**
   * Capture a screenshot of this view
   */
  async captureScreenshot(options) {
    if (!this._view.getVisible()) {
      this._view.setVisible(true);
      this._view.setVisible(false);
    }
    const quality = options?.quality ?? 80;
    const format = options?.format ?? "jpeg";
    if (options?.fullPage && !options.screenRect && !options.pageRect) {
      return this._captureFullPageScreenshot(format, quality);
    }
    if (options?.pageRect) {
      const zoomFactor = this._view.webContents.getZoomFactor();
      const visualViewportScale = await this.inspector.getVisualViewportScale();
      const emulationScale = this.emulator.emulatedScaleFactor;
      options.screenRect = {
        x: options.pageRect.x * visualViewportScale * zoomFactor * emulationScale,
        y: options.pageRect.y * visualViewportScale * zoomFactor * emulationScale,
        width: options.pageRect.width * visualViewportScale * zoomFactor * emulationScale,
        height: options.pageRect.height * visualViewportScale * zoomFactor * emulationScale
      };
    }
    if (options?.awaitNextPaint) {
      await this._waitForNextPaint();
    }
    const image = await (async () => {
      const maxAttempts = 5;
      let lastError;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          return await this._view.webContents.capturePage(options?.screenRect, {
            stayHidden: true
          });
        } catch (error) {
          if (error instanceof Error && error.message === "UnknownVizError") {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 16));
            continue;
          } else {
            throw error;
          }
        }
      }
      throw new Error(`Failed to capture screenshot after ${maxAttempts} attempts`, { cause: lastError });
    })();
    const buffer = format === "png" ? image.toPNG() : image.toJPEG(quality);
    const screenshot = VSBuffer.wrap(buffer);
    if (!options?.screenRect) {
      this._lastScreenshot = screenshot;
    }
    return screenshot;
  }
  // Capture a screenshot of the full scrollable document (beyond the viewport) via CDP.
  async _captureFullPageScreenshot(format, quality) {
    const metrics = await this.debugger.sendCommand("Page.getLayoutMetrics");
    const size = metrics.cssContentSize;
    if (!size) {
      throw new Error("Page.getLayoutMetrics did not return a cssContentSize");
    }
    const zoomFactor = this._view.webContents.getZoomFactor();
    const clipWidth = size.width * zoomFactor;
    const clipHeight = size.height * zoomFactor;
    const hostWindow = this._hostWindow;
    const display = hostWindow ? screen.getDisplayMatching(hostWindow.getBounds()) : screen.getPrimaryDisplay();
    const devicePixelRatio = display.scaleFactor;
    const maxClipDimension = BrowserView.MAX_FULL_PAGE_SCREENSHOT_DIMENSION / Math.max(devicePixelRatio, 1);
    const scale = Math.min(1, maxClipDimension / Math.max(clipWidth, clipHeight));
    try {
      const result = await this.debugger.sendCommand("Page.captureScreenshot", {
        format,
        ...format === "jpeg" ? { quality } : {},
        captureBeyondViewport: true,
        // In theory, `clip` defaults to the full area when not explicitly passed, but in practice it doesn't work when
        // the zoom level isn't 100, because it doesn't multiply the width and height by zoomFactor like we do here.
        // Setting the clip explicitly, we can multiply by zoomFactor and thus work around this Chromium bug.
        // Note that even with this workaround, we often see that the page isn't fully captured and might repeat
        // visual content from the top at the bottom, instead of showing the bottom of the page.
        // - Another sidenote: Currently the scrollbar width isn't accounted for. If a scrollbar exists, we should add the
        //   vertical scrollbar's width and horizontal scrollbar's height to the clip dimensions, since the image is currently
        //   clipped by that amount (this also happens when no clip parameter is provided; ideally it should be fixed upstream
        //   in Chromium).
        clip: { x: 0, y: 0, width: clipWidth, height: clipHeight, scale }
      });
      return VSBuffer.wrap(Buffer.from(result.data, "base64"));
    } finally {
      void this._view.webContents.setVisualZoomLevelLimits(1, 3).catch((error) => {
        this.logService.error("Failed to restore visual zoom level limits after full-page screenshot.", error);
      });
    }
  }
  async _waitForNextPaint() {
    const WAIT_TIMEOUT_MS = 100;
    try {
      await Promise.race([
        this.debugger.sendCommand("Runtime.evaluate", {
          expression: "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))",
          awaitPromise: true
        }),
        new Promise((resolve) => setTimeout(resolve, WAIT_TIMEOUT_MS))
      ]);
    } catch {
    }
  }
  /**
   * Focus this view
   */
  async focus(force) {
    if (!force && !this._currentWindow?.win?.isFocused()) {
      return;
    }
    this._view.webContents.focus();
  }
  /**
   * Find text in the page
   */
  async findInPage(text, options) {
    this._view.webContents.findInPage(text, {
      matchCase: options?.matchCase ?? false,
      forward: options?.forward ?? true,
      // `findNext` is not very clearly named. From Electron docs: `Whether to begin a new text finding session with this request`.
      // It needs to be set to `true` if we want a new search to be performed, such as when the text changes.
      // We name it `recompute` in our internal options to better reflect its purpose / behavior.
      findNext: options?.recompute ?? false
    });
  }
  /**
   * Stop finding in page
   */
  async stopFindInPage(keepSelection) {
    this._view.webContents.stopFindInPage(keepSelection ? "keepSelection" : "clearSelection");
  }
  /**
   * Get the currently selected text in the browser view.
   * Returns immediately with empty string if the page is still loading.
   */
  async getSelectedText() {
    if (this._view.webContents.isLoading()) {
      return "";
    }
    try {
      return await this._view.webContents.executeJavaScriptInIsolatedWorld(browserViewIsolatedWorldId, [{ code: 'window.browserViewAPI?.getSelectedText?.() ?? ""' }]);
    } catch {
      return "";
    }
  }
  /**
   * Clear all storage data for this browser view's session
   */
  async clearStorage() {
    await this.session.clearData();
  }
  /**
   * Answer an in-progress hardware-device chooser. Pass the chosen device id,
   * or `null` to cancel the chooser.
   */
  selectDevice(requestId, deviceId) {
    this.session.permissions.resolveDevice(requestId, deviceId);
  }
  /**
   * Trust a certificate for a given host and reload the page.
   */
  async trustCertificate(host, fingerprint) {
    await this.session.trust.trustCertificate(host, fingerprint);
    this._view.webContents.reload();
  }
  /**
   * Revoke trust for a previously trusted certificate and close the view.
   */
  async untrustCertificate(host, fingerprint) {
    await this.session.trust.untrustCertificate(host, fingerprint);
    this.dispose();
  }
  /**
   * Get the underlying WebContentsView
   */
  getWebContentsView() {
    return this._view;
  }
  /**
   * Get the hosting Electron window for this view, if any.
   * This can be an auxiliary window, depending on where the view is currently hosted.
   */
  getElectronWindow() {
    return this._currentWindow?.win ?? void 0;
  }
  /**
   * The Electron window that currently hosts this view, if any. Before `layout()` is first
   * called this is the owner window; after that it's whichever window the view was last moved
   * to. Returns `undefined` if no host window can be resolved (e.g. during teardown).
   */
  get _hostWindow() {
    return this._currentWindow?.win ?? this._ownerWindow.win ?? void 0;
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.debugger.dispose();
    const currentWin = this._currentWindow?.win;
    if (currentWin && !currentWin.isDestroyed()) {
      currentWin.contentView.removeChildView(this._view);
    }
    this._onDidClose.fire();
    if (!this._view.webContents.isDestroyed()) {
      this._view.webContents.close({ waitForBeforeUnload: false });
    }
    super.dispose();
  }
  _windowById(windowId) {
    return this._codeWindowById(windowId) ?? this._auxiliaryWindowById(windowId);
  }
  _codeWindowById(windowId) {
    if (typeof windowId !== "number") {
      return void 0;
    }
    return this.windowsMainService.getWindowById(windowId);
  }
  _auxiliaryWindowById(windowId) {
    if (typeof windowId !== "number") {
      return void 0;
    }
    const contents = webContents.fromId(windowId);
    if (!contents) {
      return void 0;
    }
    return this.auxiliaryWindowsMainService.getWindowByWebContents(contents);
  }
};
BrowserView = __decorateClass([
  __decorateParam(6, IWindowsMainService),
  __decorateParam(7, IAuxiliaryWindowsMainService),
  __decorateParam(8, ILogService),
  __decorateParam(9, ITelemetryService)
], BrowserView);
function isTrackableHistoryUrl(url) {
  if (!url) {
    return false;
  }
  const colon = url.indexOf(":");
  if (colon <= 0) {
    return false;
  }
  const scheme = url.substring(0, colon).toLowerCase();
  return scheme === "http" || scheme === "https" || scheme === "file";
}
export {
  BrowserView
};
