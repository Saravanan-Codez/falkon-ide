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
import * as fs from "fs";
import { exec } from "child_process";
import { app, BrowserWindow, clipboard, contentTracing, Menu, Notification, powerMonitor, powerSaveBlocker, screen, shell, systemPreferences, webContents } from "electron";
import { arch, cpus, freemem, loadavg, platform, release, totalmem, type } from "os";
import { promisify } from "util";
import { memoize } from "../../../base/common/decorators.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { matchesSomeScheme, Schemas } from "../../../base/common/network.js";
import { dirname, join, posix, resolve, win32 } from "../../../base/common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../../base/common/platform.js";
import { hasKey } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { virtualMachineHint } from "../../../base/node/id.js";
import { Promises, SymlinkSupport } from "../../../base/node/pfs.js";
import { findFreePort, isPortFree } from "../../../base/node/ports.js";
import { localize } from "../../../nls.js";
import { IDialogMainService } from "../../dialogs/electron-main/dialogMainService.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { FocusMode } from "../common/native.js";
import { IGlobalKeybindingsMainService } from "../../globalKeybindings/electron-main/globalKeybindingsMainService.js";
import { IProductService } from "../../product/common/productService.js";
import { IThemeMainService } from "../../theme/electron-main/themeMainService.js";
import { defaultWindowState } from "../../window/electron-main/window.js";
import { defaultBrowserWindowOptions, IWindowsMainService, OpenContext } from "../../windows/electron-main/windows.js";
import { isWorkspaceIdentifier, toWorkspaceIdentifier } from "../../workspace/common/workspace.js";
import { IWorkspacesManagementMainService } from "../../workspaces/electron-main/workspacesManagementMainService.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { hasWSLFeatureInstalled } from "../../remote/node/wsl.js";
import { WindowProfiler } from "../../profiling/electron-main/windowProfiling.js";
import { IAuxiliaryWindowsMainService } from "../../auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { CancellationError } from "../../../base/common/errors.js";
import { zip } from "../../../base/node/zip.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IProxyAuthService } from "./auth.js";
import { IRequestService } from "../../request/common/request.js";
import { randomPath } from "../../../base/common/extpath.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
const INativeHostMainService = createDecorator("nativeHostMainService");
let NativeHostMainService = class extends Disposable {
  constructor(windowsMainService, auxiliaryWindowsMainService, dialogMainService, lifecycleMainService, environmentMainService, logService, productService, themeMainService, workspacesManagementMainService, configurationService, requestService, proxyAuthService, instantiationService, globalKeybindingsMainService) {
    super();
    this.windowsMainService = windowsMainService;
    this.auxiliaryWindowsMainService = auxiliaryWindowsMainService;
    this.dialogMainService = dialogMainService;
    this.lifecycleMainService = lifecycleMainService;
    this.environmentMainService = environmentMainService;
    this.logService = logService;
    this.productService = productService;
    this.themeMainService = themeMainService;
    this.workspacesManagementMainService = workspacesManagementMainService;
    this.configurationService = configurationService;
    this.requestService = requestService;
    this.proxyAuthService = proxyAuthService;
    this.instantiationService = instantiationService;
    this.globalKeybindingsMainService = globalKeybindingsMainService;
    this._onDidChangePassword = this._register(new Emitter());
    this.onDidChangePassword = this._onDidChangePassword.event;
    this._isTracing = false;
    // #endregion
    //#region Toast Notifications
    this.activeToasts = this._register(new DisposableMap());
    {
      this.onDidOpenMainWindow = Event.map(this.windowsMainService.onDidOpenWindow, (window) => window.id);
      this.onDidTriggerWindowSystemContextMenu = Event.any(
        Event.map(this.windowsMainService.onDidTriggerSystemContextMenu, ({ window, x, y }) => ({ windowId: window.id, x, y })),
        Event.map(this.auxiliaryWindowsMainService.onDidTriggerSystemContextMenu, ({ window, x, y }) => ({ windowId: window.id, x, y }))
      );
      this.onDidMaximizeWindow = Event.any(
        Event.map(this.windowsMainService.onDidMaximizeWindow, (window) => window.id),
        Event.map(this.auxiliaryWindowsMainService.onDidMaximizeWindow, (window) => window.id)
      );
      this.onDidUnmaximizeWindow = Event.any(
        Event.map(this.windowsMainService.onDidUnmaximizeWindow, (window) => window.id),
        Event.map(this.auxiliaryWindowsMainService.onDidUnmaximizeWindow, (window) => window.id)
      );
      this.onDidChangeWindowFullScreen = Event.any(
        Event.map(this.windowsMainService.onDidChangeFullScreen, (e) => ({ windowId: e.window.id, fullscreen: e.fullscreen })),
        Event.map(this.auxiliaryWindowsMainService.onDidChangeFullScreen, (e) => ({ windowId: e.window.id, fullscreen: e.fullscreen }))
      );
      this.onDidChangeWindowAlwaysOnTop = Event.any(
        Event.None,
        // always on top is unsupported in main windows currently
        Event.map(this.auxiliaryWindowsMainService.onDidChangeAlwaysOnTop, (e) => ({ windowId: e.window.id, alwaysOnTop: e.alwaysOnTop }))
      );
      this.onDidBlurMainWindow = Event.filter(Event.fromNodeEventEmitter(app, "browser-window-blur", (event, window) => window.id), (windowId) => !!this.windowsMainService.getWindowById(windowId));
      this.onDidFocusMainWindow = Event.any(
        Event.map(Event.filter(Event.map(this.windowsMainService.onDidChangeWindowsCount, () => this.windowsMainService.getLastActiveWindow()), (window) => !!window), (window) => window.id),
        Event.filter(Event.fromNodeEventEmitter(app, "browser-window-focus", (event, window) => window.id), (windowId) => !!this.windowsMainService.getWindowById(windowId))
      );
      this.onDidBlurMainOrAuxiliaryWindow = Event.any(
        this.onDidBlurMainWindow,
        Event.map(Event.filter(Event.fromNodeEventEmitter(app, "browser-window-blur", (event, window) => this.auxiliaryWindowsMainService.getWindowByWebContents(window.webContents)), (window) => !!window), (window) => window.id)
      );
      this.onDidFocusMainOrAuxiliaryWindow = Event.any(
        this.onDidFocusMainWindow,
        Event.map(Event.filter(Event.fromNodeEventEmitter(app, "browser-window-focus", (event, window) => this.auxiliaryWindowsMainService.getWindowByWebContents(window.webContents)), (window) => !!window), (window) => window.id)
      );
      this.onDidSuspendOS = Event.fromNodeEventEmitter(powerMonitor, "suspend");
      this.onDidResumeOS = Event.fromNodeEventEmitter(powerMonitor, "resume");
      this.onDidChangeOnBatteryPower = Event.any(
        Event.map(Event.fromNodeEventEmitter(powerMonitor, "on-ac"), () => false),
        Event.map(Event.fromNodeEventEmitter(powerMonitor, "on-battery"), () => true)
      );
      this.onDidChangeThermalState = Event.map(
        Event.fromNodeEventEmitter(powerMonitor, "thermal-state-change"),
        (e) => e.state
      );
      this.onDidChangeSpeedLimit = Event.map(
        Event.fromNodeEventEmitter(powerMonitor, "speed-limit-change"),
        (e) => e.limit
      );
      this.onWillShutdownOS = Event.fromNodeEventEmitter(powerMonitor, "shutdown");
      this.onDidLockScreen = Event.fromNodeEventEmitter(powerMonitor, "lock-screen");
      this.onDidUnlockScreen = Event.fromNodeEventEmitter(powerMonitor, "unlock-screen");
      this.onDidChangeColorScheme = this.themeMainService.onDidChangeColorScheme;
      this.onDidChangeDisplay = Event.debounce(Event.any(
        Event.filter(Event.fromNodeEventEmitter(screen, "display-metrics-changed", (event, display, changedMetrics) => changedMetrics), (changedMetrics) => {
          return !(Array.isArray(changedMetrics) && changedMetrics.length === 1 && changedMetrics[0] === "workArea");
        }),
        Event.fromNodeEventEmitter(screen, "display-added"),
        Event.fromNodeEventEmitter(screen, "display-removed")
      ), () => {
      }, 100);
    }
  }
  //#region Properties
  get windowId() {
    throw new Error("Not implemented in electron-main");
  }
  async getWindows(windowId, options) {
    const mainWindows = this.windowsMainService.getWindows().map((window) => ({
      id: window.id,
      workspace: window.openedWorkspace ?? toWorkspaceIdentifier(window.backupPath, window.isExtensionDevelopmentHost),
      title: window.win?.getTitle() ?? "",
      filename: window.getRepresentedFilename(),
      dirty: window.isDocumentEdited()
    }));
    const auxiliaryWindows = [];
    if (options.includeAuxiliaryWindows) {
      auxiliaryWindows.push(...this.auxiliaryWindowsMainService.getWindows().map((window) => ({
        id: window.id,
        parentId: window.parentId,
        title: window.win?.getTitle() ?? "",
        filename: window.getRepresentedFilename()
      })));
    }
    return [...mainWindows, ...auxiliaryWindows];
  }
  async getWindowCount(windowId) {
    return this.windowsMainService.getWindowCount();
  }
  async getActiveWindowId(windowId) {
    const activeWindow = this.windowsMainService.getFocusedWindow() || this.windowsMainService.getLastActiveWindow();
    if (activeWindow) {
      return activeWindow.id;
    }
    return void 0;
  }
  async getActiveWindowPosition() {
    const activeWindow = this.windowsMainService.getFocusedWindow() || this.windowsMainService.getLastActiveWindow();
    if (activeWindow) {
      return activeWindow.getBounds();
    }
    return void 0;
  }
  async getNativeWindowHandle(fallbackWindowId, windowId) {
    const window = this.windowById(windowId, fallbackWindowId);
    if (window?.win) {
      return VSBuffer.wrap(window.win.getNativeWindowHandle());
    }
    return void 0;
  }
  openWindow(windowId, arg1, arg2) {
    if (Array.isArray(arg1)) {
      return this.doOpenWindow(windowId, arg1, arg2);
    }
    return this.doOpenEmptyWindow(windowId, arg1);
  }
  async doOpenWindow(windowId, toOpen, options = /* @__PURE__ */ Object.create(null)) {
    if (toOpen.length > 0) {
      const windows = await this.windowsMainService.open({
        context: OpenContext.API,
        contextWindowId: windowId,
        urisToOpen: toOpen,
        cli: this.environmentMainService.args,
        forceNewWindow: options.forceNewWindow,
        forceReuseWindow: options.forceReuseWindow,
        preferNewWindow: options.preferNewWindow,
        diffMode: options.diffMode,
        mergeMode: options.mergeMode,
        addMode: options.addMode,
        removeMode: options.removeMode,
        gotoLineMode: options.gotoLineMode,
        noRecentEntry: options.noRecentEntry,
        waitMarkerFileURI: options.waitMarkerFileURI,
        remoteAuthority: options.remoteAuthority || void 0,
        forceProfile: options.forceProfile,
        forceTempProfile: options.forceTempProfile
      });
      const chatSessionToOpen = options.chatSessionToOpen;
      if (chatSessionToOpen && windows.length === 1) {
        windows[0].sendWhenReady("vscode:openChatSession", CancellationToken.None, URI.revive(chatSessionToOpen).toString());
      }
    }
  }
  async doOpenEmptyWindow(windowId, options) {
    await this.windowsMainService.openEmptyWindow({
      context: OpenContext.API,
      contextWindowId: windowId
    }, options);
  }
  async openAgentsWindow(windowId, options) {
    const windows = await this.windowsMainService.openAgentsWindow({
      context: OpenContext.API,
      contextWindowId: windowId,
      cli: this.environmentMainService.args
    }, options?.folderUri ? URI.revive(options.folderUri) : void 0, options?.sessionResource ? URI.revive(options.sessionResource) : void 0, options?.source);
    if (windows.length > 0) {
      windows[0].focus();
    }
  }
  async syncSystemWideKeybindings(windowId, keybindings) {
    if (typeof windowId !== "number") {
      return { failed: [] };
    }
    return this.globalKeybindingsMainService.updateKeybindings(windowId, keybindings);
  }
  async isFullScreen(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.isFullScreen ?? false;
  }
  async toggleFullScreen(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.toggleFullScreen();
  }
  async getCursorScreenPoint(windowId) {
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    return { point, display: display.bounds };
  }
  async isMaximized(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.win?.isMaximized() ?? false;
  }
  async maximizeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.maximize();
  }
  async unmaximizeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.unmaximize();
  }
  async minimizeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.minimize();
  }
  async moveWindowTop(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.moveTop();
  }
  async isWindowAlwaysOnTop(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.win?.isAlwaysOnTop() ?? false;
  }
  async toggleWindowAlwaysOnTop(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.setAlwaysOnTop(!window.win.isAlwaysOnTop());
  }
  async setWindowAlwaysOnTop(windowId, alwaysOnTop, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.setAlwaysOnTop(alwaysOnTop);
  }
  async positionWindow(windowId, position, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    if (window?.win) {
      if (window.win.isFullScreen()) {
        const fullscreenLeftFuture = Event.toPromise(Event.once(Event.fromNodeEventEmitter(window.win, "leave-full-screen")));
        window.win.setFullScreen(false);
        await fullscreenLeftFuture;
      }
      window.win.setBounds(position);
    }
  }
  async updateWindowControls(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.updateWindowControls(options);
  }
  async updateWindowAccentColor(windowId, color, inactiveColor) {
    if (!isWindows) {
      return;
    }
    const window = this.windowById(windowId);
    if (!window) {
      return;
    }
    let activeWindowAccentColor;
    let inactiveWindowAccentColor;
    if (color === "default") {
      activeWindowAccentColor = null;
      inactiveWindowAccentColor = null;
    } else if (color === "off") {
      activeWindowAccentColor = false;
      inactiveWindowAccentColor = false;
    } else {
      activeWindowAccentColor = color;
      inactiveWindowAccentColor = inactiveColor ?? color;
    }
    const windows = [window];
    for (const auxiliaryWindow of this.auxiliaryWindowsMainService.getWindows()) {
      if (auxiliaryWindow.parentId === windowId) {
        windows.push(auxiliaryWindow);
      }
    }
    for (const window2 of windows) {
      window2.win?.setAccentColor(window2.win.isFocused() ? activeWindowAccentColor : inactiveWindowAccentColor);
    }
  }
  async focusWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.focus({ mode: options?.mode ?? FocusMode.Transfer });
  }
  async setMinimumSize(windowId, width, height) {
    const window = this.codeWindowById(windowId);
    if (window?.win) {
      const [windowWidth, windowHeight] = window.win.getSize();
      const [minWindowWidth, minWindowHeight] = window.win.getMinimumSize();
      const [newMinWindowWidth, newMinWindowHeight] = [width ?? minWindowWidth, height ?? minWindowHeight];
      const [newWindowWidth, newWindowHeight] = [Math.max(windowWidth, newMinWindowWidth), Math.max(windowHeight, newMinWindowHeight)];
      if (minWindowWidth !== newMinWindowWidth || minWindowHeight !== newMinWindowHeight) {
        window.win.setMinimumSize(newMinWindowWidth, newMinWindowHeight);
      }
      if (windowWidth !== newWindowWidth || windowHeight !== newWindowHeight) {
        window.win.setSize(newWindowWidth, newWindowHeight);
      }
    }
  }
  async saveWindowSplash(windowId, splash) {
    const window = this.codeWindowById(windowId);
    this.themeMainService.saveWindowSplash(windowId, window?.openedWorkspace, splash);
  }
  async setBackgroundThrottling(windowId, allowed) {
    const window = this.codeWindowById(windowId);
    this.logService.trace(`Setting background throttling for window ${windowId} to '${allowed}'`);
    window?.win?.webContents?.setBackgroundThrottling(allowed);
  }
  //#endregion
  //#region macOS Shell Command
  async installShellCommand(windowId) {
    const { source, target } = await this.getShellCommandLink();
    try {
      const { symbolicLink } = await SymlinkSupport.stat(source);
      if (symbolicLink && !symbolicLink.dangling) {
        const linkTargetRealPath = await Promises.realpath(source);
        if (target === linkTargetRealPath) {
          return;
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    await this.installShellCommandWithPrivileges(windowId, source, target);
  }
  async installShellCommandWithPrivileges(windowId, source, target) {
    const { response } = await this.showMessageBox(windowId, {
      type: "info",
      message: localize("warnEscalation", "{0} will now prompt with 'osascript' for Administrator privileges to install the shell command.", this.productService.nameShort),
      buttons: [
        localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
        localize("cancel", "Cancel")
      ]
    });
    if (response === 1) {
      throw new CancellationError();
    }
    try {
      const command = `osascript -e "do shell script \\"mkdir -p /usr/local/bin && ln -sf '${target}' '${source}'\\" with administrator privileges"`;
      await promisify(exec)(command);
    } catch (error) {
      throw new Error(localize("cantCreateBinFolder", "Unable to install the shell command '{0}'.", source));
    }
  }
  async uninstallShellCommand(windowId) {
    const { source } = await this.getShellCommandLink();
    try {
      await fs.promises.unlink(source);
    } catch (error) {
      switch (error.code) {
        case "EACCES": {
          const { response } = await this.showMessageBox(windowId, {
            type: "info",
            message: localize("warnEscalationUninstall", "{0} will now prompt with 'osascript' for Administrator privileges to uninstall the shell command.", this.productService.nameShort),
            buttons: [
              localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
              localize("cancel", "Cancel")
            ]
          });
          if (response === 1) {
            throw new CancellationError();
          }
          try {
            const command = `osascript -e "do shell script \\"rm '${source}'\\" with administrator privileges"`;
            await promisify(exec)(command);
          } catch (error2) {
            throw new Error(localize("cantUninstall", "Unable to uninstall the shell command '{0}'.", source));
          }
          break;
        }
        case "ENOENT":
          break;
        // ignore file not found
        default:
          throw error;
      }
    }
  }
  async getShellCommandLink() {
    const target = resolve(this.environmentMainService.appRoot, "bin", "code");
    const source = `/usr/local/bin/${this.productService.applicationName}`;
    const sourceExists = await Promises.exists(target);
    if (!sourceExists) {
      throw new Error(localize("sourceMissing", "Unable to find shell script in '{0}'", target));
    }
    return { source, target };
  }
  //#endregion
  //#region Dialog
  async showMessageBox(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return this.dialogMainService.showMessageBox(options, window?.win ?? void 0);
  }
  async showSaveDialog(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return this.dialogMainService.showSaveDialog(options, window?.win ?? void 0);
  }
  async showOpenDialog(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return this.dialogMainService.showOpenDialog(options, window?.win ?? void 0);
  }
  async pickFileFolderAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickFileFolder(options);
    if (paths) {
      await this.doOpenPicked(await Promise.all(paths.map(async (path) => await SymlinkSupport.existsDirectory(path) ? { folderUri: URI.file(path) } : { fileUri: URI.file(path) })), options, windowId);
    }
  }
  async pickFolderAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickFolder(options);
    if (paths) {
      await this.doOpenPicked(paths.map((path) => ({ folderUri: URI.file(path) })), options, windowId);
    }
  }
  async pickFileAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickFile(options);
    if (paths) {
      await this.doOpenPicked(paths.map((path) => ({ fileUri: URI.file(path) })), options, windowId);
    }
  }
  async pickWorkspaceAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickWorkspace(options);
    if (paths) {
      await this.doOpenPicked(paths.map((path) => ({ workspaceUri: URI.file(path) })), options, windowId);
    }
  }
  async doOpenPicked(openable, options, windowId) {
    await this.windowsMainService.open({
      context: OpenContext.DIALOG,
      contextWindowId: windowId,
      cli: this.environmentMainService.args,
      urisToOpen: openable,
      forceNewWindow: options.forceNewWindow
      /* remoteAuthority will be determined based on openable */
    });
  }
  //#endregion
  //#region OS
  async showItemInFolder(windowId, path) {
    shell.showItemInFolder(path);
  }
  async setRepresentedFilename(windowId, path, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.setRepresentedFilename(path);
  }
  async setDocumentEdited(windowId, edited, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.setDocumentEdited(edited);
  }
  async openExternal(windowId, url, defaultApplication) {
    this.environmentMainService.unsetSnapExportedVariables();
    try {
      if (matchesSomeScheme(url, Schemas.http, Schemas.https)) {
        this.openExternalBrowser(windowId, url, defaultApplication);
      } else {
        this.doOpenShellExternal(windowId, url);
      }
    } finally {
      this.environmentMainService.restoreSnapExportedVariables();
    }
    return true;
  }
  async openExternalBrowser(windowId, url, defaultApplication) {
    const configuredBrowser = defaultApplication ?? this.configurationService.getValue("workbench.externalBrowser");
    if (!configuredBrowser) {
      return this.doOpenShellExternal(windowId, url);
    }
    if (configuredBrowser.includes(posix.sep) || configuredBrowser.includes(win32.sep)) {
      const browserPathExists = await Promises.exists(configuredBrowser);
      if (!browserPathExists) {
        this.logService.error(`Configured external browser path does not exist: ${configuredBrowser}`);
        return this.doOpenShellExternal(windowId, url);
      }
    }
    try {
      const { default: open, apps } = await import("open");
      const res = await open(url, {
        app: {
          // Use `open.apps` helper to allow cross-platform browser
          // aliases to be looked up properly. Fallback to the
          // configured value if not found.
          name: Object.hasOwn(apps, configuredBrowser) ? apps[configuredBrowser] : configuredBrowser
        }
      });
      if (!isWindows) {
        res.stderr?.once("data", (data) => {
          this.logService.error(`Error openening external URL '${url}' using browser '${configuredBrowser}': ${data.toString()}`);
          return this.doOpenShellExternal(windowId, url);
        });
      }
    } catch (error) {
      this.logService.error(`Unable to open external URL '${url}' using browser '${configuredBrowser}' due to ${error}.`);
      return this.doOpenShellExternal(windowId, url);
    }
  }
  async doOpenShellExternal(windowId, url) {
    try {
      await shell.openExternal(url);
    } catch (error) {
      let isLink;
      let message;
      if (matchesSomeScheme(url, Schemas.http, Schemas.https)) {
        isLink = true;
        message = localize("openExternalErrorLinkMessage", "An error occurred opening a link in your default browser.");
      } else {
        isLink = false;
        message = localize("openExternalProgramErrorMessage", "An error occurred opening an external program.");
      }
      const { response } = await this.dialogMainService.showMessageBox({
        type: "error",
        message,
        detail: error.message,
        buttons: isLink ? [
          localize({ key: "copyLink", comment: ["&& denotes a mnemonic"] }, "&&Copy Link"),
          localize("cancel", "Cancel")
        ] : [
          localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK")
        ]
      }, this.windowById(windowId)?.win ?? void 0);
      if (response === 1) {
        return;
      }
      this.writeClipboardText(windowId, url);
    }
  }
  moveItemToTrash(windowId, fullPath) {
    return shell.trashItem(fullPath);
  }
  async getMediaAccessStatus(windowId, mediaType) {
    if (isMacintosh) {
      return systemPreferences.getMediaAccessStatus(mediaType);
    }
    return "granted";
  }
  async isAdmin() {
    let isAdmin;
    if (isWindows) {
      isAdmin = (await import("native-is-elevated")).default();
    } else {
      isAdmin = process.getuid?.() === 0;
    }
    return isAdmin;
  }
  async writeElevated(windowId, source, target, options) {
    const sudoPrompt = await import("@vscode/sudo-prompt");
    const argsFile = randomPath(this.environmentMainService.userDataPath, "code-elevated");
    await Promises.writeFile(argsFile, JSON.stringify({ source: source.fsPath, target: target.fsPath }));
    try {
      await new Promise((resolve2, reject) => {
        const sudoCommand = [`"${this.cliPath}"`];
        if (options?.unlock) {
          sudoCommand.push("--file-chmod");
        }
        sudoCommand.push("--file-write", `"${argsFile}"`);
        const promptOptions = {
          name: this.productService.nameLong.replace("-", ""),
          icns: isMacintosh && this.environmentMainService.isBuilt ? join(dirname(this.environmentMainService.appRoot), `${this.productService.nameShort}.icns`) : void 0
        };
        this.logService.trace(`[sudo-prompt] running command: ${sudoCommand.join(" ")}`);
        sudoPrompt.exec(sudoCommand.join(" "), promptOptions, (error, stdout, stderr) => {
          if (stdout) {
            this.logService.trace(`[sudo-prompt] received stdout: ${stdout}`);
          }
          if (stderr) {
            this.logService.error(`[sudo-prompt] received stderr: ${stderr}`);
          }
          if (error) {
            reject(error);
          } else {
            resolve2(void 0);
          }
        });
      });
    } finally {
      await fs.promises.unlink(argsFile);
    }
  }
  async isRunningUnderARM64Translation() {
    if (isLinux || isWindows) {
      return false;
    }
    return app.runningUnderARM64Translation;
  }
  get cliPath() {
    if (isWindows) {
      if (this.environmentMainService.isBuilt) {
        return join(dirname(process.execPath), "bin", `${this.productService.applicationName}.cmd`);
      }
      return join(this.environmentMainService.appRoot, "scripts", "code-cli.bat");
    }
    if (isLinux) {
      if (this.environmentMainService.isBuilt) {
        return join(dirname(process.execPath), "bin", `${this.productService.applicationName}`);
      }
      return join(this.environmentMainService.appRoot, "scripts", "code-cli.sh");
    }
    if (this.environmentMainService.isBuilt) {
      return join(this.environmentMainService.appRoot, "bin", "code");
    }
    return join(this.environmentMainService.appRoot, "scripts", "code-cli.sh");
  }
  async getOSStatistics() {
    return {
      totalmem: totalmem(),
      freemem: freemem(),
      loadavg: loadavg()
    };
  }
  async getOSProperties() {
    return {
      arch: arch(),
      platform: platform(),
      release: release(),
      type: type(),
      cpus: cpus()
    };
  }
  async getOSVirtualMachineHint() {
    return virtualMachineHint.value();
  }
  async getOSColorScheme() {
    return this.themeMainService.getColorScheme();
  }
  // WSL
  async hasWSLFeatureInstalled() {
    return isWindows && hasWSLFeatureInstalled();
  }
  //#endregion
  //#region Screenshots
  async getScreenshot(windowId, rect, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    const captured = await window?.win?.webContents.capturePage(rect);
    const buf = captured?.toJPEG(95);
    return buf && VSBuffer.wrap(buf);
  }
  //#endregion
  //#region GitHub mobile upload API
  async uploadFileViaMobileApi(_windowId, token, repoId, fileName, fileBytes, contentType) {
    const { net } = await import("electron");
    const policyResponse = await net.fetch("https://api.github.com/mobile/upload/policy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        name: fileName,
        size: fileBytes.byteLength,
        content_type: contentType,
        repository_id: parseInt(repoId, 10)
      })
    });
    if (!policyResponse.ok) {
      const text = await policyResponse.text();
      throw new Error(`Policy request failed ${policyResponse.status}: ${text.substring(0, 300)}`);
    }
    const policy = await policyResponse.json();
    const asset = policy.asset;
    const formFields = policy.form;
    const boundary = `----VSCodeUpload${Date.now()}`;
    let multipartBody = "";
    for (const [key, value] of Object.entries(formFields)) {
      multipartBody += `--${boundary}\r
Content-Disposition: form-data; name="${key}"\r
\r
${value}\r
`;
    }
    const safeName = String(asset.name).replace(/[\r\n]+/g, " ").replace(/[\\"]/g, "_");
    multipartBody += `--${boundary}\r
Content-Disposition: form-data; name="file"; filename="${safeName}"\r
Content-Type: ${contentType}\r
\r
`;
    const epilogue = `\r
--${boundary}--\r
`;
    const preambleBytes = Buffer.from(multipartBody, "utf-8");
    const epilogueBytes = Buffer.from(epilogue, "utf-8");
    const bodyBuffer = Buffer.concat([preambleBytes, fileBytes.buffer, epilogueBytes]);
    const s3Response = await net.fetch(policy.upload_url, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: bodyBuffer
    });
    if (s3Response.status !== 204 && s3Response.status !== 201) {
      const text = await s3Response.text();
      throw new Error(`S3 upload failed ${s3Response.status}: ${text.substring(0, 300)}`);
    }
    const confirmResponse = await net.fetch(`https://api.github.com${policy.asset_upload_url}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });
    if (!confirmResponse.ok) {
      const text = await confirmResponse.text();
      throw new Error(`Asset upload confirmation failed ${confirmResponse.status}: ${text.substring(0, 300)}`);
    }
    return { fileName, assetUrl: asset.href, contentType };
  }
  //#endregion
  //#region Process
  async getProcessId(windowId) {
    const window = this.windowById(void 0, windowId);
    return window?.win?.webContents.getOSProcessId();
  }
  async killProcess(windowId, pid, code) {
    process.kill(pid, code);
  }
  //#endregion
  //#region Clipboard
  async readClipboardText(windowId, type2) {
    this.logService.trace(`readClipboardText in window ${windowId} with type:`, type2);
    const clipboardText = clipboard.readText(type2);
    this.logService.trace(`clipboardText.length :`, clipboardText.length);
    return clipboardText;
  }
  async triggerPaste(windowId, options) {
    this.logService.trace(`Triggering paste in window ${windowId} with options:`, options);
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.win?.webContents.paste() ?? Promise.resolve();
  }
  async readImage() {
    return clipboard.readImage().toPNG();
  }
  async writeClipboardText(windowId, text, type2) {
    return clipboard.writeText(text, type2);
  }
  async readClipboardFindText(windowId) {
    return clipboard.readFindText();
  }
  async writeClipboardFindText(windowId, text) {
    return clipboard.writeFindText(text);
  }
  async writeClipboardBuffer(windowId, format, buffer, type2) {
    return clipboard.writeBuffer(format, Buffer.from(buffer.buffer), type2);
  }
  async readClipboardBuffer(windowId, format) {
    return VSBuffer.wrap(clipboard.readBuffer(format));
  }
  async hasClipboard(windowId, format, type2) {
    return clipboard.has(format, type2);
  }
  //#endregion
  //#region macOS Touchbar
  async newWindowTab() {
    await this.windowsMainService.open({
      context: OpenContext.API,
      cli: this.environmentMainService.args,
      forceNewTabbedWindow: true,
      forceEmpty: true,
      remoteAuthority: this.environmentMainService.args.remote || void 0
    });
  }
  async showPreviousWindowTab() {
    Menu.sendActionToFirstResponder("selectPreviousTab:");
  }
  async showNextWindowTab() {
    Menu.sendActionToFirstResponder("selectNextTab:");
  }
  async moveWindowTabToNewWindow() {
    Menu.sendActionToFirstResponder("moveTabToNewWindow:");
  }
  async mergeAllWindowTabs() {
    Menu.sendActionToFirstResponder("mergeAllWindows:");
  }
  async toggleWindowTabsBar() {
    Menu.sendActionToFirstResponder("toggleTabBar:");
  }
  async updateTouchBar(windowId, items) {
    const window = this.codeWindowById(windowId);
    window?.updateTouchBar(items);
  }
  //#endregion
  //#region Lifecycle
  async notifyReady(windowId) {
    const window = this.codeWindowById(windowId);
    window?.setReady();
  }
  async relaunch(windowId, options) {
    return this.lifecycleMainService.relaunch(options);
  }
  async reload(windowId, options) {
    const window = this.codeWindowById(windowId);
    if (window) {
      if (isWorkspaceIdentifier(window.openedWorkspace)) {
        const configPath = window.openedWorkspace.configPath;
        if (configPath.scheme === Schemas.file) {
          const workspace = await this.workspacesManagementMainService.resolveLocalWorkspace(configPath);
          if (workspace?.transient) {
            return this.openWindow(window.id, { forceReuseWindow: true });
          }
        }
      }
      return this.lifecycleMainService.reload(window, options?.disableExtensions !== void 0 ? { _: [], "disable-extensions": options.disableExtensions } : void 0);
    }
  }
  async closeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.win?.close();
  }
  async quit(windowId) {
    const window = this.windowsMainService.getLastActiveWindow();
    if (window?.isExtensionDevelopmentHost && this.windowsMainService.getWindowCount() > 1 && window.win) {
      window.win.close();
    } else {
      this.lifecycleMainService.quit();
    }
  }
  async exit(windowId, code) {
    await this.lifecycleMainService.kill(code);
  }
  //#endregion
  //#region Connectivity
  async resolveProxy(windowId, url) {
    const window = this.codeWindowById(windowId);
    const session = window?.win?.webContents?.session;
    return session?.resolveProxy(url);
  }
  async resolveProxyWithPackage(_windowId, url) {
    const { resolveProxy } = await import("@vscode/os-proxy-resolver");
    return resolveProxy(url);
  }
  async readProxyConfigWithPackage(_windowId) {
    const { readProxyConfig } = await import("@vscode/os-proxy-resolver");
    return readProxyConfig();
  }
  async lookupAuthorization(_windowId, authInfo) {
    return this.proxyAuthService.lookupAuthorization(authInfo);
  }
  async lookupKerberosAuthorization(_windowId, url) {
    return this.requestService.lookupKerberosAuthorization(url);
  }
  async loadCertificates(_windowId) {
    return this.requestService.loadCertificates();
  }
  isPortFree(windowId, port) {
    return isPortFree(port, 1e3);
  }
  findFreePort(windowId, startPort, giveUpAfter, timeout, stride = 1) {
    return findFreePort(startPort, giveUpAfter, timeout, stride);
  }
  async openDevTools(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.webContents.openDevTools(options?.mode ? { mode: options.mode, activate: options.activate } : void 0);
  }
  async toggleDevTools(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.webContents.toggleDevTools();
  }
  async openDevToolsWindow(windowId, url) {
    const parentWindow = this.codeWindowById(windowId);
    if (!parentWindow) {
      return;
    }
    this.openChildWindow(parentWindow.win, url);
  }
  openChildWindow(parentWindow, url, overrideWindowOptions = {}) {
    const options = this.instantiationService.invokeFunction(defaultBrowserWindowOptions, defaultWindowState(), { forceNativeTitlebar: true });
    const windowOptions = {
      ...options,
      parent: parentWindow ?? void 0,
      ...overrideWindowOptions
    };
    const window = new BrowserWindow(windowOptions);
    window.setMenuBarVisibility(false);
    window.loadURL(url);
    window.once("ready-to-show", () => window.show());
    return window;
  }
  async openGPUInfoWindow(windowId) {
    const parentWindow = this.codeWindowById(windowId);
    if (!parentWindow) {
      return;
    }
    if (typeof this.gpuInfoWindowId !== "number") {
      const gpuInfoWindow = this.openChildWindow(parentWindow.win, "chrome://gpu");
      gpuInfoWindow.once("close", () => this.gpuInfoWindowId = void 0);
      this.gpuInfoWindowId = gpuInfoWindow.id;
    }
    if (typeof this.gpuInfoWindowId === "number") {
      const window = BrowserWindow.fromId(this.gpuInfoWindowId);
      if (window?.isMinimized()) {
        window?.restore();
      }
      window?.focus();
    }
  }
  async openContentTracingWindow() {
    if (typeof this.contentTracingWindowId !== "number") {
      const contentTracingWindow = this.openChildWindow(null, "chrome://tracing", {
        paintWhenInitiallyHidden: false,
        webPreferences: {
          backgroundThrottling: false
        }
      });
      contentTracingWindow.webContents.once("did-finish-load", async () => {
        await contentTracingWindow.webContents.executeJavaScript(`
					window.prompt = () => '';
					null
				`);
        contentTracingWindow.show();
      });
      contentTracingWindow.once("close", () => this.contentTracingWindowId = void 0);
      this.contentTracingWindowId = contentTracingWindow.id;
    }
    if (typeof this.contentTracingWindowId === "number") {
      const window = BrowserWindow.fromId(this.contentTracingWindowId);
      if (window?.isMinimized()) {
        window?.restore();
      }
      window?.focus();
    }
  }
  async startTracing(windowId, categories, options) {
    if (this._isTracing) {
      throw new Error(localize("tracing.alreadyInProgress", 'A tracing session is already in progress. Use command `"{0}"` to stop it first.', "workbench.action.stopTracing"));
    }
    if (options?.enableHeapProfiling) {
      await contentTracing.enableHeapProfiling();
      await contentTracing.startRecording({
        recording_mode: "record-until-full",
        included_categories: categories.split(","),
        memory_dump_config: {
          triggers: [
            { mode: "detailed", type: "periodic_interval", periodic_interval_ms: 1e4 }
          ]
        }
      });
    } else {
      const traceOptions = ["record-until-full", "enable-sampling"];
      await contentTracing.startRecording({
        categoryFilter: categories,
        traceOptions: traceOptions.join(",")
      });
    }
    this._isTracing = true;
  }
  async stopTracing(windowId) {
    if (!this._isTracing && !this.environmentMainService.args.trace) {
      return;
    }
    this._isTracing = false;
    const path = await contentTracing.stopRecording(`${randomPath(this.environmentMainService.userHome.fsPath, this.productService.applicationName)}.trace.txt`);
    await this.dialogMainService.showMessageBox({
      type: "info",
      message: localize("trace.message", "Successfully created the trace file"),
      detail: localize("trace.detail", "Please create an issue and manually attach the following file:\n{0}", path),
      buttons: [localize({ key: "trace.ok", comment: ["&& denotes a mnemonic"] }, "&&OK")]
    }, BrowserWindow.getFocusedWindow() ?? void 0);
    this.showItemInFolder(void 0, path);
  }
  //#endregion
  // #region Performance
  async profileRenderer(windowId, session, duration) {
    const window = this.codeWindowById(windowId);
    if (!window?.win) {
      throw new Error();
    }
    const profiler = new WindowProfiler(window.win, session, this.logService);
    const result = await profiler.inspect(duration);
    return result;
  }
  async showToast(windowId, options) {
    if (!Notification.isSupported()) {
      return { supported: false, clicked: false };
    }
    const toast = new Notification({
      title: options.title,
      body: options.body,
      silent: options.silent,
      actions: options.actions?.map((action) => ({
        type: "button",
        text: action
      }))
    });
    const disposables = new DisposableStore();
    this.activeToasts.set(options.id, disposables);
    const cts = new CancellationTokenSource();
    disposables.add(toDisposable(() => {
      this.activeToasts.deleteAndDispose(options.id);
      toast.removeAllListeners();
      toast.close();
      cts.dispose(true);
    }));
    return new Promise((r) => {
      const resolve2 = (result) => {
        r(result);
        disposables.dispose();
      };
      disposables.add(cts.token.onCancellationRequested(() => resolve2({ supported: true, clicked: false })));
      toast.on("click", () => resolve2({ supported: true, clicked: true }));
      toast.on("action", (_event, actionIndex) => resolve2({ supported: true, clicked: true, actionIndex }));
      toast.on("close", () => resolve2({ supported: true, clicked: false }));
      toast.on("failed", () => resolve2({ supported: false, clicked: false }));
      toast.show();
    });
  }
  async clearToast(windowId, toastId) {
    this.activeToasts.deleteAndDispose(toastId);
  }
  async clearToasts() {
    this.activeToasts.clearAndDisposeAll();
  }
  //#endregion
  //#region Registry (windows)
  async windowsGetStringRegKey(windowId, hive, path, name) {
    if (!isWindows) {
      return void 0;
    }
    const Registry = await import("@vscode/windows-registry");
    try {
      return Registry.GetStringRegKey(hive, path, name);
    } catch {
      return void 0;
    }
  }
  //#endregion
  //#region Zip
  async createZipFile(windowId, zipPath, files) {
    await zip(zipPath.fsPath, files.map((file) => {
      if (hasKey(file, { contents: true })) {
        return file;
      }
      const source = URI.revive(file.source);
      if (source.scheme !== Schemas.file) {
        throw new Error(`Cannot add non-local resource '${source.toString()}' to a zip file`);
      }
      return { path: file.path, localPath: source.fsPath, localPathSize: file.size };
    }));
  }
  //#endregion
  //#region Power
  async getSystemIdleState(windowId, idleThreshold) {
    return powerMonitor.getSystemIdleState(idleThreshold);
  }
  async getSystemIdleTime(windowId) {
    return powerMonitor.getSystemIdleTime();
  }
  async getCurrentThermalState(windowId) {
    return powerMonitor.getCurrentThermalState();
  }
  async isOnBatteryPower(windowId) {
    return powerMonitor.isOnBatteryPower();
  }
  async startPowerSaveBlocker(windowId, type2) {
    return powerSaveBlocker.start(type2);
  }
  async stopPowerSaveBlocker(windowId, id) {
    return powerSaveBlocker.stop(id);
  }
  async isPowerSaveBlockerStarted(windowId, id) {
    return powerSaveBlocker.isStarted(id);
  }
  //#endregion
  windowById(windowId, fallbackCodeWindowId) {
    return this.codeWindowById(windowId) ?? this.auxiliaryWindowById(windowId) ?? this.codeWindowById(fallbackCodeWindowId);
  }
  codeWindowById(windowId) {
    if (typeof windowId !== "number") {
      return void 0;
    }
    return this.windowsMainService.getWindowById(windowId);
  }
  auxiliaryWindowById(windowId) {
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
__decorateClass([
  memoize
], NativeHostMainService.prototype, "cliPath", 1);
NativeHostMainService = __decorateClass([
  __decorateParam(0, IWindowsMainService),
  __decorateParam(1, IAuxiliaryWindowsMainService),
  __decorateParam(2, IDialogMainService),
  __decorateParam(3, ILifecycleMainService),
  __decorateParam(4, IEnvironmentMainService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IThemeMainService),
  __decorateParam(8, IWorkspacesManagementMainService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IRequestService),
  __decorateParam(11, IProxyAuthService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, IGlobalKeybindingsMainService)
], NativeHostMainService);
export {
  INativeHostMainService,
  NativeHostMainService
};
