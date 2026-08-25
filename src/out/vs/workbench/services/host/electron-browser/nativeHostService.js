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
import { Emitter, Event } from "../../../../base/common/event.js";
import { IHostService } from "../browser/host.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { isFolderToOpen, isWorkspaceToOpen } from "../../../../platform/window/common/window.js";
import { Disposable, DisposableSet } from "../../../../base/common/lifecycle.js";
import { NativeHostService } from "../../../../platform/native/common/nativeHostService.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { disposableWindowInterval, getActiveDocument, getWindowId, getWindowsCount, hasWindow, onDidRegisterWindow } from "../../../../base/browser/dom.js";
import { memoize } from "../../../../base/common/decorators.js";
import { isAuxiliaryWindow } from "../../../../base/browser/window.js";
import { showBrowserToast } from "../browser/toasts.js";
import { generateUuid } from "../../../../base/common/uuid.js";
let WorkbenchNativeHostService = class extends NativeHostService {
  constructor(environmentService, mainProcessService) {
    super(environmentService.window.id, mainProcessService);
  }
};
WorkbenchNativeHostService = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IMainProcessService)
], WorkbenchNativeHostService);
let WorkbenchHostService = class extends Disposable {
  constructor(nativeHostService, labelService, environmentService) {
    super();
    this.nativeHostService = nativeHostService;
    this.labelService = labelService;
    this.environmentService = environmentService;
    //#endregion
    //#region Native Handle
    this._nativeWindowHandleCache = /* @__PURE__ */ new Map();
    //#endregion
    //#region Toast Notifications
    this.activeBrowserToasts = this._register(new DisposableSet());
    this.onDidChangeFocus = Event.latch(
      Event.any(
        Event.map(Event.filter(this.nativeHostService.onDidFocusMainOrAuxiliaryWindow, (id) => hasWindow(id), this._store), () => this.hasFocus, this._store),
        Event.map(Event.filter(this.nativeHostService.onDidBlurMainOrAuxiliaryWindow, (id) => hasWindow(id), this._store), () => this.hasFocus, this._store),
        Event.map(this.onDidChangeActiveWindow, () => this.hasFocus, this._store)
      ),
      void 0,
      this._store
    );
    this.onDidChangeFullScreen = Event.filter(this.nativeHostService.onDidChangeWindowFullScreen, (e) => hasWindow(e.windowId), this._store);
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.onDidChangeFocus((focus) => {
      if (focus) {
        this.clearToasts();
      }
    }));
  }
  get hasFocus() {
    return getActiveDocument().hasFocus();
  }
  async hadLastFocus() {
    const activeWindowId = await this.nativeHostService.getActiveWindowId();
    if (typeof activeWindowId === "undefined") {
      return false;
    }
    return activeWindowId === this.nativeHostService.windowId;
  }
  get onDidChangeActiveWindow() {
    const emitter = this._register(new Emitter());
    this._register(Event.filter(this.nativeHostService.onDidFocusMainOrAuxiliaryWindow, (id) => hasWindow(id), this._store)((id) => emitter.fire(id)));
    this._register(onDidRegisterWindow(({ window, disposables }) => {
      disposables.add(disposableWindowInterval(window, () => {
        const hasFocus = window.document.hasFocus();
        if (hasFocus) {
          emitter.fire(window.vscodeWindowId);
        }
        return hasFocus;
      }, 100, 20));
    }));
    return Event.latch(emitter.event, void 0, this._store);
  }
  openWindow(arg1, arg2) {
    if (Array.isArray(arg1)) {
      return this.doOpenWindow(arg1, arg2);
    }
    return this.doOpenEmptyWindow(arg1);
  }
  doOpenWindow(toOpen, options) {
    const remoteAuthority = this.environmentService.remoteAuthority;
    if (remoteAuthority) {
      toOpen.forEach((openable) => openable.label = openable.label || this.getRecentLabel(openable));
      if (options?.remoteAuthority === void 0) {
        options = options ? { ...options, remoteAuthority } : { remoteAuthority };
      }
    }
    return this.nativeHostService.openWindow(toOpen, options);
  }
  getRecentLabel(openable) {
    if (isFolderToOpen(openable)) {
      return this.labelService.getWorkspaceLabel(openable.folderUri, { verbose: Verbosity.LONG });
    }
    if (isWorkspaceToOpen(openable)) {
      return this.labelService.getWorkspaceLabel({ id: "", configPath: openable.workspaceUri }, { verbose: Verbosity.LONG });
    }
    return this.labelService.getUriLabel(openable.fileUri, { appendWorkspaceSuffix: true });
  }
  doOpenEmptyWindow(options) {
    const remoteAuthority = this.environmentService.remoteAuthority;
    if (!!remoteAuthority && options?.remoteAuthority === void 0) {
      options = options ? { ...options, remoteAuthority } : { remoteAuthority };
    }
    return this.nativeHostService.openWindow(options);
  }
  toggleFullScreen(targetWindow) {
    return this.nativeHostService.toggleFullScreen({ targetWindowId: isAuxiliaryWindow(targetWindow) ? targetWindow.vscodeWindowId : void 0 });
  }
  async moveTop(targetWindow) {
    if (getWindowsCount() <= 1) {
      return;
    }
    return this.nativeHostService.moveWindowTop(isAuxiliaryWindow(targetWindow) ? { targetWindowId: targetWindow.vscodeWindowId } : void 0);
  }
  async setWindowDimmed(targetWindow, dimmed) {
    return this.nativeHostService.updateWindowControls({ dimmed, targetWindowId: getWindowId(targetWindow) });
  }
  getCursorScreenPoint() {
    return this.nativeHostService.getCursorScreenPoint();
  }
  getWindows(options) {
    if (options.includeAuxiliaryWindows === false) {
      return this.nativeHostService.getWindows({ includeAuxiliaryWindows: false });
    }
    return this.nativeHostService.getWindows({ includeAuxiliaryWindows: true });
  }
  //#endregion
  //#region Lifecycle
  focus(targetWindow, options) {
    return this.nativeHostService.focusWindow({
      mode: options?.mode,
      targetWindowId: getWindowId(targetWindow)
    });
  }
  restart() {
    return this.nativeHostService.relaunch();
  }
  reload(options) {
    return this.nativeHostService.reload(options);
  }
  close() {
    return this.nativeHostService.closeWindow();
  }
  shutdown() {
    return this.nativeHostService.quit();
  }
  async withExpectedShutdown(expectedShutdownTask) {
    return await expectedShutdownTask();
  }
  //#endregion
  //#region Screenshots
  getScreenshot(rect) {
    return this.nativeHostService.getScreenshot(rect);
  }
  async getNativeWindowHandle(windowId) {
    if (!this._nativeWindowHandleCache.has(windowId)) {
      this._nativeWindowHandleCache.set(windowId, this.nativeHostService.getNativeWindowHandle(windowId));
    }
    return this._nativeWindowHandleCache.get(windowId);
  }
  async showToast(options, token) {
    const id = generateUuid();
    const listener = token.onCancellationRequested(() => this.nativeHostService.clearToast(id));
    try {
      const nativeToast = await this.nativeHostService.showToast({ ...options, id });
      if (nativeToast.supported) {
        return nativeToast;
      }
      return await showBrowserToast({
        onDidCreateToast: (toast) => this.activeBrowserToasts.add(toast),
        onDidDisposeToast: (toast) => this.activeBrowserToasts.deleteAndDispose(toast)
      }, options, token);
    } finally {
      listener.dispose();
    }
  }
  async clearToasts() {
    await this.nativeHostService.clearToasts();
    this.activeBrowserToasts.clearAndDisposeAll();
  }
  //#endregion
};
__decorateClass([
  memoize
], WorkbenchHostService.prototype, "onDidChangeActiveWindow", 1);
WorkbenchHostService = __decorateClass([
  __decorateParam(0, INativeHostService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, IWorkbenchEnvironmentService)
], WorkbenchHostService);
registerSingleton(IHostService, WorkbenchHostService, InstantiationType.Delayed);
registerSingleton(INativeHostService, WorkbenchNativeHostService, InstantiationType.Delayed);
