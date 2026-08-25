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
import { BrowserWindow, app } from "electron";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { FileAccess } from "../../../base/common/network.js";
import { validatedIpcMain } from "../../../base/parts/ipc/electron-main/ipcMain.js";
import { AuxiliaryWindow } from "./auxiliaryWindow.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { WindowMode, defaultAuxWindowState } from "../../window/electron-main/window.js";
import { WindowStateValidator, defaultBrowserWindowOptions, getLastFocused } from "../../windows/electron-main/windows.js";
let AuxiliaryWindowsMainService = class extends Disposable {
  constructor(instantiationService, logService) {
    super();
    this.instantiationService = instantiationService;
    this.logService = logService;
    this._onDidMaximizeWindow = this._register(new Emitter());
    this.onDidMaximizeWindow = this._onDidMaximizeWindow.event;
    this._onDidUnmaximizeWindow = this._register(new Emitter());
    this.onDidUnmaximizeWindow = this._onDidUnmaximizeWindow.event;
    this._onDidChangeFullScreen = this._register(new Emitter());
    this.onDidChangeFullScreen = this._onDidChangeFullScreen.event;
    this._onDidChangeAlwaysOnTop = this._register(new Emitter());
    this.onDidChangeAlwaysOnTop = this._onDidChangeAlwaysOnTop.event;
    this._onDidTriggerSystemContextMenu = this._register(new Emitter());
    this.onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;
    this.windows = /* @__PURE__ */ new Map();
    this.pendingWindowOptionsQueue = [];
    this.registerListeners();
  }
  registerListeners() {
    app.on("browser-window-created", (_event, browserWindow) => {
      const auxiliaryWindow = this.getWindowByWebContents(browserWindow.webContents);
      if (auxiliaryWindow) {
        this.logService.trace('[aux window] app.on("browser-window-created"): Trying to claim auxiliary window');
        auxiliaryWindow.tryClaimWindow();
      } else {
        const disposables = new DisposableStore();
        disposables.add(Event.fromNodeEventEmitter(browserWindow.webContents, "did-create-window", (browserWindow2, details) => ({ browserWindow: browserWindow2, details }))(({ browserWindow: browserWindow2, details }) => {
          const auxiliaryWindow2 = this.getWindowByWebContents(browserWindow2.webContents);
          if (auxiliaryWindow2) {
            this.logService.trace('[aux window] window.on("did-create-window"): Trying to claim auxiliary window');
            auxiliaryWindow2.tryClaimWindow(details.options);
          }
        }));
        disposables.add(Event.fromNodeEventEmitter(browserWindow, "closed")(() => disposables.dispose()));
      }
    });
    validatedIpcMain.handle("vscode:registerAuxiliaryWindow", async (event, mainWindowId) => {
      const auxiliaryWindow = this.getWindowByWebContents(event.sender);
      if (auxiliaryWindow) {
        this.logService.trace("[aux window] vscode:registerAuxiliaryWindow: Registering auxiliary window to main window");
        auxiliaryWindow.parentId = mainWindowId;
      }
      return event.sender.id;
    });
  }
  createWindow(details) {
    const { state, overrides } = this.computeWindowStateAndOverrides(details);
    const options = this.instantiationService.invokeFunction(defaultBrowserWindowOptions, state, overrides, {
      preload: FileAccess.asFileUri("vs/base/parts/sandbox/electron-browser/preload-aux.js").fsPath
    });
    this.pendingWindowOptionsQueue.push(options);
    return options;
  }
  computeWindowStateAndOverrides(details) {
    const windowState = {};
    const overrides = {};
    const features = details.features.split(",");
    for (const feature of features) {
      const [key, value] = feature.split("=");
      switch (key) {
        case "width":
          windowState.width = parseInt(value, 10);
          break;
        case "height":
          windowState.height = parseInt(value, 10);
          break;
        case "left":
          windowState.x = parseInt(value, 10);
          break;
        case "top":
          windowState.y = parseInt(value, 10);
          break;
        case "window-maximized":
          windowState.mode = WindowMode.Maximized;
          break;
        case "window-fullscreen":
          windowState.mode = WindowMode.Fullscreen;
          break;
        case "window-disable-fullscreen":
          overrides.disableFullscreen = true;
          break;
        case "window-native-titlebar":
          overrides.forceNativeTitlebar = true;
          break;
        case "window-always-on-top":
          overrides.alwaysOnTop = true;
          break;
        case "window-frameless":
          overrides.frameless = true;
          break;
        case "window-transparent":
          overrides.transparent = true;
          break;
        case "window-not-resizable":
          overrides.notResizable = true;
          break;
        case "window-background-color":
          if (typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
            overrides.backgroundColor = value;
          }
          break;
      }
    }
    const state = WindowStateValidator.validateWindowState(this.logService, windowState) ?? defaultAuxWindowState();
    this.logService.trace("[aux window] using window state", state);
    return { state, overrides };
  }
  registerWindow(webContents) {
    const disposables = new DisposableStore();
    const windowOptions = this.pendingWindowOptionsQueue.shift();
    const auxiliaryWindow = this.instantiationService.createInstance(AuxiliaryWindow, webContents, windowOptions);
    this.windows.set(auxiliaryWindow.id, auxiliaryWindow);
    disposables.add(toDisposable(() => this.windows.delete(auxiliaryWindow.id)));
    disposables.add(auxiliaryWindow.onDidMaximize(() => this._onDidMaximizeWindow.fire(auxiliaryWindow)));
    disposables.add(auxiliaryWindow.onDidUnmaximize(() => this._onDidUnmaximizeWindow.fire(auxiliaryWindow)));
    disposables.add(auxiliaryWindow.onDidEnterFullScreen(() => this._onDidChangeFullScreen.fire({ window: auxiliaryWindow, fullscreen: true })));
    disposables.add(auxiliaryWindow.onDidLeaveFullScreen(() => this._onDidChangeFullScreen.fire({ window: auxiliaryWindow, fullscreen: false })));
    disposables.add(auxiliaryWindow.onDidChangeAlwaysOnTop((alwaysOnTop) => this._onDidChangeAlwaysOnTop.fire({ window: auxiliaryWindow, alwaysOnTop })));
    disposables.add(auxiliaryWindow.onDidTriggerSystemContextMenu(({ x, y }) => this._onDidTriggerSystemContextMenu.fire({ window: auxiliaryWindow, x, y })));
    Event.once(auxiliaryWindow.onDidClose)(() => disposables.dispose());
  }
  getWindowByWebContents(webContents) {
    const window = this.windows.get(webContents.id);
    return window?.matches(webContents) ? window : void 0;
  }
  getFocusedWindow() {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      return this.getWindowByWebContents(window.webContents);
    }
    return void 0;
  }
  getLastActiveWindow() {
    return getLastFocused(Array.from(this.windows.values()));
  }
  getWindows() {
    return Array.from(this.windows.values());
  }
};
AuxiliaryWindowsMainService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILogService)
], AuxiliaryWindowsMainService);
export {
  AuxiliaryWindowsMainService
};
