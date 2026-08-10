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
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { BrowserViewCommandId } from "../common/browserView.js";
import { clipboard, Menu, MenuItem } from "electron";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { BrowserView } from "./browserView.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
import { BrowserSession } from "./browserSession.js";
import { IApplicationStorageMainService } from "../../storage/electron-main/storageMainService.js";
import { logBrowserOpen } from "../common/browserViewTelemetry.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { localize } from "../../../nls.js";
import { INativeHostMainService } from "../../native/electron-main/nativeHostMainService.js";
import { htmlAttributeEncodeValue } from "../../../base/common/strings.js";
import { BrowserViewInspectElementId } from "./browserViewInspector.js";
import { equals } from "../../../base/common/objects.js";
const IBrowserViewMainService = createDecorator("browserViewMainService");
let BrowserViewMainService = class extends Disposable {
  constructor(environmentMainService, instantiationService, windowsMainService, telemetryService, nativeHostMainService, applicationStorageMainService) {
    super();
    this.environmentMainService = environmentMainService;
    this.instantiationService = instantiationService;
    this.windowsMainService = windowsMainService;
    this.telemetryService = telemetryService;
    this.nativeHostMainService = nativeHostMainService;
    this.applicationStorageMainService = applicationStorageMainService;
    this.browserViews = this._register(new DisposableMap());
    /**
     * Per-window configuration applied to the browser views that window owns.
     * Entries are dropped when the window is destroyed.
     */
    this._windowConfigurations = /* @__PURE__ */ new Map();
    this._windowCloseSubscriptions = this._register(new DisposableMap());
    this._onDidCreateBrowserView = this._register(new Emitter());
    this.onDidCreateBrowserView = this._onDidCreateBrowserView.event;
  }
  /**
   * Check if a webContents belongs to an integrated browser view.
   * Delegates to {@link BrowserSession.isBrowserViewWebContents}.
   */
  static isBrowserViewWebContents(contents) {
    return BrowserSession.isBrowserViewWebContents(contents);
  }
  async getOrCreateBrowserView(id, options) {
    if (this.browserViews.has(id)) {
      const view2 = this.browserViews.get(id);
      return view2.getState();
    }
    const ownerWindow = this.windowsMainService.getWindowById(options.owner.mainWindowId);
    if (!ownerWindow) {
      throw new Error(`Owner window with ID ${options.owner.mainWindowId} not found`);
    }
    const browserSession = BrowserSession.getOrCreate(
      this.instantiationService,
      id,
      options.sessionOptions,
      this.environmentMainService.workspaceStorageHome,
      ownerWindow.openedWorkspace?.id
    );
    const view = this.createBrowserView(id, options.owner, browserSession);
    if (options.initialState?.url) {
      void view.loadURL(options.initialState.url);
    }
    return {
      ...view.getState(),
      ...options.initialState
    };
  }
  tryGetBrowserView(id) {
    return this.browserViews.get(id);
  }
  async createTarget(url, owner, browserContextId) {
    const browserSession = browserContextId ? BrowserSession.get(browserContextId) : void 0;
    return this.openNew(url, {
      owner,
      session: browserSession,
      openOptions: { preserveFocus: true },
      source: "cdpCreated"
    });
  }
  /**
   * Get a browser view or throw if not found
   */
  _getBrowserView(id) {
    const view = this.browserViews.get(id);
    if (!view) {
      throw new Error(`Browser view ${id} not found`);
    }
    return view;
  }
  _getViewInfo(view) {
    return {
      id: view.id,
      owner: view.owner,
      state: view.getState()
    };
  }
  async getBrowserViews(windowId) {
    const result = [];
    for (const [, view] of this.browserViews) {
      if (windowId !== void 0 && view.owner.mainWindowId !== windowId) {
        continue;
      }
      result.push(this._getViewInfo(view));
    }
    return result;
  }
  onDynamicDidNavigate(id) {
    return this._getBrowserView(id).onDidNavigate;
  }
  onDynamicDidChangeLoadingState(id) {
    return this._getBrowserView(id).onDidChangeLoadingState;
  }
  onDynamicDidChangeFocus(id) {
    return this._getBrowserView(id).onDidChangeFocus;
  }
  onDynamicDidChangeVisibility(id) {
    return this._getBrowserView(id).onDidChangeVisibility;
  }
  onDynamicDidChangeDevToolsState(id) {
    return this._getBrowserView(id).onDidChangeDevToolsState;
  }
  onDynamicDidKeyCommand(id) {
    return this._getBrowserView(id).onDidKeyCommand;
  }
  onDynamicDidChangeTitle(id) {
    return this._getBrowserView(id).onDidChangeTitle;
  }
  onDynamicDidChangeFavicon(id) {
    return this._getBrowserView(id).onDidChangeFavicon;
  }
  onDynamicDidFindInPage(id) {
    return this._getBrowserView(id).onDidFindInPage;
  }
  onDynamicDidClose(id) {
    return this._getBrowserView(id).onDidClose;
  }
  onDynamicDidSelectElement(id) {
    return this._getBrowserView(id).inspector.onDidSelectElement;
  }
  onDynamicDidRemoveElementComment(id) {
    return this._getBrowserView(id).inspector.onDidRemoveElementComment;
  }
  onDynamicDidChangeElementSelectionState(id) {
    return this._getBrowserView(id).inspector.onDidChangeElementSelectionState;
  }
  onDynamicDidPickArea(id) {
    return this._getBrowserView(id).inspector.onDidPickArea;
  }
  onDynamicDidChangeAreaSelectionActive(id) {
    return this._getBrowserView(id).inspector.onDidChangeAreaSelectionActive;
  }
  onDynamicDidChangeDeviceEmulation(id) {
    return this._getBrowserView(id).emulator.onDidChange;
  }
  onDynamicDidChangeRemoteStatus(id) {
    return this._getBrowserView(id).onDidChangeRemoteStatus;
  }
  onDynamicDidRequestPermission(id) {
    return this._getBrowserView(id).onDidRequestPermission;
  }
  onDynamicDidChangePermissions(id) {
    return this._getBrowserView(id).onDidChangePermissions;
  }
  async getState(id) {
    return this._getBrowserView(id).getState();
  }
  async destroyBrowserView(id) {
    return this.browserViews.deleteAndDispose(id);
  }
  async layout(id, bounds) {
    return this._getBrowserView(id).layout(bounds);
  }
  async setVisible(id, visible) {
    return this._getBrowserView(id).setVisible(visible);
  }
  async loadURL(id, url) {
    return this._getBrowserView(id).loadURL(url);
  }
  async getURL(id) {
    return this._getBrowserView(id).getURL();
  }
  async goBack(id) {
    return this._getBrowserView(id).goBack();
  }
  async goForward(id) {
    return this._getBrowserView(id).goForward();
  }
  async reload(id, hard) {
    return this._getBrowserView(id).reload(hard);
  }
  async toggleDevTools(id) {
    return this._getBrowserView(id).toggleDevTools();
  }
  async canGoBack(id) {
    return this._getBrowserView(id).canGoBack();
  }
  async canGoForward(id) {
    return this._getBrowserView(id).canGoForward();
  }
  async captureScreenshot(id, options) {
    return this._getBrowserView(id).captureScreenshot(options);
  }
  async focus(id, force) {
    return this._getBrowserView(id).focus(force);
  }
  async findInPage(id, text, options) {
    return this._getBrowserView(id).findInPage(text, options);
  }
  async stopFindInPage(id, keepSelection) {
    return this._getBrowserView(id).stopFindInPage(keepSelection);
  }
  async getSelectedText(id) {
    return this._getBrowserView(id).getSelectedText();
  }
  async clearStorage(id) {
    return this._getBrowserView(id).clearStorage();
  }
  async setBrowserZoomIndex(id, zoomIndex) {
    return this._getBrowserView(id).setBrowserZoomIndex(zoomIndex);
  }
  async setDeviceEmulation(id, device) {
    return this._getBrowserView(id).emulator.setDevice(device);
  }
  async trustCertificate(id, host, fingerprint) {
    return this._getBrowserView(id).trustCertificate(host, fingerprint);
  }
  async untrustCertificate(id, host, fingerprint) {
    return this._getBrowserView(id).untrustCertificate(host, fingerprint);
  }
  async deleteBrowserHistory(id, entryIds) {
    this._getBrowserView(id).session.history.delete(entryIds);
  }
  async setPermissions(id, origin, grants) {
    this._getBrowserView(id).session.permissions.set(origin, grants);
  }
  async selectDevice(id, requestId, deviceId) {
    this._getBrowserView(id).selectDevice(requestId, deviceId);
  }
  async clearGlobalStorage() {
    const browserSession = BrowserSession.getOrCreateGlobal(this.instantiationService);
    browserSession.connectStorage(this.applicationStorageMainService);
    await browserSession.clearData();
  }
  async clearWorkspaceStorage(workspaceId) {
    const browserSession = BrowserSession.getOrCreateWorkspace(
      this.instantiationService,
      workspaceId,
      this.environmentMainService.workspaceStorageHome
    );
    browserSession.connectStorage(this.applicationStorageMainService);
    await browserSession.clearData();
  }
  async getConsoleLogs(id) {
    return this._getBrowserView(id).getConsoleLogs();
  }
  async toggleElementSelection(id, enabled, options) {
    return this._getBrowserView(id).inspector.toggleElementSelection(enabled, options);
  }
  async setElementComments(id, update) {
    this._getBrowserView(id).inspector.setElementComments(update);
  }
  async toggleAreaSelection(id, enabled) {
    return this._getBrowserView(id).inspector.toggleAreaSelection(enabled);
  }
  async updateWindowConfiguration(windowId, config) {
    const oldConfig = this._windowConfigurations.get(windowId);
    const didThemeChange = !equals(oldConfig?.theme, config.theme);
    const didProxyChange = !equals(oldConfig?.proxyInfo, config.proxyInfo);
    this._windowConfigurations.set(windowId, config);
    this._ensureWindowCloseSubscription(windowId);
    for (const [, view] of this.browserViews) {
      if (view.owner.mainWindowId === windowId) {
        if (didThemeChange) {
          view.inspector.setTheme(config.theme);
        }
        if (didProxyChange) {
          view.session.remote.acquire(view.id, config.proxyInfo);
        }
        if (typeof config.maxHistoryEntries === "number") {
          view.session.history.setMaxEntries(config.maxHistoryEntries);
        }
      }
    }
    this._recomputeTrustedFileRoots();
  }
  _ensureWindowCloseSubscription(windowId) {
    if (this._windowCloseSubscriptions.has(windowId)) {
      return;
    }
    const window = this.windowsMainService.getWindowById(windowId);
    if (!window) {
      return;
    }
    const onWindowGone = Event.any(window.onDidClose, window.onDidDestroy);
    this._windowCloseSubscriptions.set(windowId, Event.once(onWindowGone)(() => {
      this._windowCloseSubscriptions.deleteAndDispose(windowId);
      if (this._windowConfigurations.delete(windowId)) {
        this._recomputeTrustedFileRoots();
      }
    }));
  }
  _recomputeTrustedFileRoots() {
    const roots = /* @__PURE__ */ new Set();
    let trustAllFiles = false;
    for (const configuration of this._windowConfigurations.values()) {
      for (const root of configuration.trustedFileRoots) {
        roots.add(root);
      }
      trustAllFiles ||= configuration.trustAllFiles;
    }
    BrowserSession.setTrustedFileRoots([...roots], trustAllFiles);
  }
  /**
   * Create a browser view backed by the given {@link BrowserSession}.
   */
  createBrowserView(id, owner, browserSession, options) {
    if (this.browserViews.has(id)) {
      throw new Error(`Browser view with id ${id} already exists`);
    }
    browserSession.connectStorage(this.applicationStorageMainService);
    const windowConfiguration = this._windowConfigurations.get(owner.mainWindowId);
    if (typeof windowConfiguration?.maxHistoryEntries === "number") {
      browserSession.history.setMaxEntries(windowConfiguration.maxHistoryEntries);
    }
    browserSession.remote.acquire(id, windowConfiguration?.proxyInfo);
    const view = this.instantiationService.createInstance(
      BrowserView,
      id,
      owner,
      browserSession,
      // Recursive factory for nested windows (child views share the same session and owner).
      (url, electronOptions, openOptions) => {
        const child = this.createBrowserView(generateUuid(), owner, browserSession, electronOptions);
        if (url) {
          void child.loadURL(url).catch(() => {
          });
        }
        const info = this._getViewInfo(child);
        this._onDidCreateBrowserView.fire({
          info: url ? { ...info, state: { ...info.state, url } } : info,
          openOptions
        });
        return child;
      },
      (v, params) => this.showContextMenu(v, params),
      options
    );
    this.browserViews.set(id, view);
    if (windowConfiguration?.theme) {
      view.inspector.setTheme(windowConfiguration.theme);
    }
    Event.once(view.onDidClose)(() => {
      browserSession.remote.release(id);
      this.browserViews.deleteAndDispose(id);
    });
    return view;
  }
  async openNew(url, {
    owner,
    session,
    openOptions,
    source
  }) {
    const targetId = generateUuid();
    const view = this.createBrowserView(targetId, owner, session || BrowserSession.getOrCreateEphemeral(this.instantiationService, targetId));
    if (url) {
      void view.loadURL(url).catch(() => {
      });
    }
    logBrowserOpen(this.telemetryService, source);
    const info = this._getViewInfo(view);
    this._onDidCreateBrowserView.fire({
      info: url ? { ...info, state: { ...info.state, url } } : info,
      openOptions
    });
    return view;
  }
  async showContextMenu(view, params) {
    const win = view.getElectronWindow();
    if (!win) {
      return;
    }
    const webContents = view.webContents;
    if (webContents.isDestroyed()) {
      return;
    }
    const windowConfiguration = this._windowConfigurations.get(view.owner.mainWindowId);
    const inspectTarget = windowConfiguration?.aiFeaturesDisabled ? void 0 : params.frame && await view.inspector.getElementHandle(BrowserViewInspectElementId.ContextMenuTarget, params.frame);
    const menu = new Menu();
    if (params.linkURL) {
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.openLinkInNewTab", "Open Link in New Tab"),
        click: () => {
          void this.openNew(params.linkURL, {
            owner: view.owner,
            session: view.session,
            openOptions: { preserveFocus: true, background: true },
            source: "browserLinkBackground"
          });
        }
      }));
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.openLinkInExternalBrowser", "Open Link in External Browser"),
        click: () => {
          void this.nativeHostMainService.openExternal(void 0, params.linkURL);
        }
      }));
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.copyLink", "Copy Link"),
        click: () => {
          clipboard.write({
            text: params.linkURL,
            html: `<a href="${encodeURI(params.linkURL)}">${htmlAttributeEncodeValue(params.linkText || params.linkURL)}</a>`
          });
        }
      }));
    }
    if (params.hasImageContents && params.srcURL) {
      if (menu.items.length > 0) {
        menu.append(new MenuItem({ type: "separator" }));
      }
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.openImageInNewTab", "Open Image in New Tab"),
        click: () => {
          void this.openNew(params.srcURL, {
            owner: view.owner,
            session: view.session,
            openOptions: { preserveFocus: true, background: true },
            source: "browserLinkBackground"
          });
        }
      }));
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.copyImage", "Copy Image"),
        click: () => {
          view.webContents.copyImageAt(params.x, params.y);
        }
      }));
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.copyImageUrl", "Copy Image URL"),
        click: () => {
          clipboard.writeText(params.srcURL);
        }
      }));
    }
    if (params.isEditable) {
      menu.append(new MenuItem({ role: "cut", enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ role: "copy", enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ role: "paste", enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ role: "pasteAndMatchStyle", enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ role: "selectAll", enabled: params.editFlags.canSelectAll }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ role: "copy" }));
    }
    if (menu.items.length === 0) {
      if (webContents.navigationHistory.canGoBack()) {
        menu.append(new MenuItem({
          label: localize("browser.contextMenu.back", "Back"),
          accelerator: windowConfiguration?.keybindings[BrowserViewCommandId.GoBack],
          click: () => webContents.navigationHistory.goBack()
        }));
      }
      if (webContents.navigationHistory.canGoForward()) {
        menu.append(new MenuItem({
          label: localize("browser.contextMenu.forward", "Forward"),
          accelerator: windowConfiguration?.keybindings[BrowserViewCommandId.GoForward],
          click: () => webContents.navigationHistory.goForward()
        }));
      }
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.reload", "Reload"),
        accelerator: windowConfiguration?.keybindings[BrowserViewCommandId.Reload],
        click: () => webContents.reload()
      }));
    }
    if (inspectTarget) {
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.addElementToChat", "Add Element to Chat"),
        click: () => inspectTarget.addToChat()
      }));
      menu.append(new MenuItem({
        label: localize("browser.contextMenu.addComment", "Add Comment..."),
        click: () => inspectTarget.addComment()
      }));
      void inspectTarget.highlight().catch(() => {
      });
      menu.on("menu-will-close", () => inspectTarget.dispose());
    }
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(new MenuItem({
      label: localize("browser.contextMenu.inspect", "Inspect"),
      click: () => webContents.inspectElement(params.x, params.y)
    }));
    const viewBounds = view.getWebContentsView().getBounds();
    menu.popup({
      window: win,
      x: viewBounds.x + params.x,
      y: viewBounds.y + params.y,
      sourceType: params.menuSourceType
    });
  }
};
BrowserViewMainService = __decorateClass([
  __decorateParam(0, IEnvironmentMainService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWindowsMainService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, INativeHostMainService),
  __decorateParam(5, IApplicationStorageMainService)
], BrowserViewMainService);
export {
  BrowserViewMainService,
  IBrowserViewMainService
};
