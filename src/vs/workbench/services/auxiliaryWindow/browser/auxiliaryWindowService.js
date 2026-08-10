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
import { getZoomLevel } from "../../../../base/browser/browser.js";
import { $, Dimension, EventHelper, EventType, ModifierKeyEmitter, addDisposableListener, copyAttributes, createLinkElement, createMetaElement, getActiveWindow, getClientArea, getWindowId, isHTMLElement, position, registerWindow, sharedMutationObserver, trackAttributes } from "../../../../base/browser/dom.js";
import { cloneGlobalStylesheets, isGlobalStylesheet } from "../../../../base/browser/domStylesheets.js";
import { ensureCodeWindow, mainWindow } from "../../../../base/browser/window.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { Barrier } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { mark } from "../../../../base/common/performance.js";
import { isFirefox, isWeb } from "../../../../base/common/platform.js";
import Severity from "../../../../base/common/severity.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { DEFAULT_AUX_WINDOW_SIZE, WindowMinimumSize } from "../../../../platform/window/common/window.js";
import { BaseWindow } from "../../../browser/window.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IHostService } from "../../host/browser/host.js";
import { IWorkbenchLayoutService } from "../../layout/browser/layoutService.js";
const IAuxiliaryWindowService = createDecorator("auxiliaryWindowService");
var AuxiliaryWindowMode = /* @__PURE__ */ ((AuxiliaryWindowMode2) => {
  AuxiliaryWindowMode2[AuxiliaryWindowMode2["Maximized"] = 0] = "Maximized";
  AuxiliaryWindowMode2[AuxiliaryWindowMode2["Normal"] = 1] = "Normal";
  AuxiliaryWindowMode2[AuxiliaryWindowMode2["Fullscreen"] = 2] = "Fullscreen";
  return AuxiliaryWindowMode2;
})(AuxiliaryWindowMode || {});
const DEFAULT_AUX_WINDOW_DIMENSIONS = new Dimension(DEFAULT_AUX_WINDOW_SIZE.width, DEFAULT_AUX_WINDOW_SIZE.height);
let AuxiliaryWindow = class extends BaseWindow {
  constructor(window, container, stylesHaveLoaded, configurationService, hostService, environmentService, contextMenuService, layoutService) {
    super(window, void 0, hostService, environmentService, contextMenuService, layoutService);
    this.window = window;
    this.container = container;
    this.configurationService = configurationService;
    this._onWillLayout = this._register(new Emitter());
    this.onWillLayout = this._onWillLayout.event;
    this._onDidLayout = this._register(new Emitter());
    this.onDidLayout = this._onDidLayout.event;
    this._onBeforeUnload = this._register(new Emitter());
    this.onBeforeUnload = this._onBeforeUnload.event;
    this._onUnload = this._register(new Emitter());
    this.onUnload = this._onUnload.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.compact = false;
    this.whenStylesHaveLoaded = stylesHaveLoaded.wait().then(() => void 0);
    this.registerListeners();
  }
  updateOptions(options) {
    this.compact = options.compact;
  }
  async setBounds(bounds) {
    this.window.moveTo(bounds.x, bounds.y);
    this.window.resizeTo(bounds.width, bounds.height);
  }
  registerListeners() {
    this._register(addDisposableListener(this.window, EventType.BEFORE_UNLOAD, (e) => this.handleBeforeUnload(e)));
    this._register(addDisposableListener(this.window, EventType.UNLOAD, () => this.handleUnload()));
    this._register(addDisposableListener(this.window, "unhandledrejection", (e) => {
      onUnexpectedError(e.reason);
      e.preventDefault();
    }));
    this._register(addDisposableListener(this.window, EventType.RESIZE, () => this.layout()));
    this._register(addDisposableListener(this.container, EventType.SCROLL, () => this.container.scrollTop = 0));
    if (isWeb) {
      this._register(addDisposableListener(this.container, EventType.DROP, (e) => EventHelper.stop(e, true)));
      this._register(addDisposableListener(this.container, EventType.WHEEL, (e) => e.preventDefault(), { passive: false }));
      this._register(addDisposableListener(this.container, EventType.CONTEXT_MENU, (e) => EventHelper.stop(e, true)));
    } else {
      this._register(addDisposableListener(this.window.document.body, EventType.DRAG_OVER, (e) => EventHelper.stop(e)));
      this._register(addDisposableListener(this.window.document.body, EventType.DROP, (e) => EventHelper.stop(e)));
    }
  }
  handleBeforeUnload(e) {
    let veto;
    this._onBeforeUnload.fire({
      veto(reason) {
        if (reason) {
          veto = reason;
        }
      }
    });
    if (veto) {
      this.handleVetoBeforeClose(e, veto);
      return;
    }
    const confirmBeforeCloseSetting = this.configurationService.getValue("window.confirmBeforeClose");
    const confirmBeforeClose = confirmBeforeCloseSetting === "always" || confirmBeforeCloseSetting === "keyboardOnly" && ModifierKeyEmitter.getInstance().isModifierPressed;
    if (confirmBeforeClose) {
      this.confirmBeforeClose(e);
    }
  }
  handleVetoBeforeClose(e, reason) {
    this.preventUnload(e);
  }
  preventUnload(e) {
    e.preventDefault();
    e.returnValue = localize("lifecycleVeto", "Changes that you made may not be saved. Please check press 'Cancel' and try again.");
  }
  confirmBeforeClose(e) {
    this.preventUnload(e);
  }
  handleUnload() {
    this._onUnload.fire();
  }
  layout() {
    const dimension = getClientArea(this.window.document.body, DEFAULT_AUX_WINDOW_DIMENSIONS, this.container);
    this._onWillLayout.fire(dimension);
    this._onDidLayout.fire(dimension);
  }
  createState() {
    return {
      bounds: {
        x: this.window.screenX,
        y: this.window.screenY,
        width: this.window.outerWidth,
        height: this.window.outerHeight
      },
      zoomLevel: getZoomLevel(this.window),
      compact: this.compact
    };
  }
  dispose() {
    if (this._store.isDisposed) {
      return;
    }
    this._onWillDispose.fire();
    super.dispose();
  }
};
AuxiliaryWindow = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IWorkbenchLayoutService)
], AuxiliaryWindow);
let BrowserAuxiliaryWindowService = class extends Disposable {
  constructor(layoutService, dialogService, configurationService, telemetryService, hostService, environmentService, contextMenuService) {
    super();
    this.layoutService = layoutService;
    this.dialogService = dialogService;
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this.hostService = hostService;
    this.environmentService = environmentService;
    this.contextMenuService = contextMenuService;
    // start from the main window ID + 1
    this._onDidOpenAuxiliaryWindow = this._register(new Emitter());
    this.onDidOpenAuxiliaryWindow = this._onDidOpenAuxiliaryWindow.event;
    this.windows = /* @__PURE__ */ new Map();
  }
  static {
    this.WINDOW_IDS = getWindowId(mainWindow) + 1;
  }
  async open(options) {
    mark("code/auxiliaryWindow/willOpen");
    const targetWindow = await this.openWindow(options);
    if (!targetWindow) {
      throw new Error(localize("unableToOpenWindowError", "Unable to open a new window."));
    }
    const resolvedWindowId = await this.resolveWindowId(targetWindow);
    ensureCodeWindow(targetWindow, resolvedWindowId);
    const containerDisposables = new DisposableStore();
    const { container, stylesLoaded } = this.createContainer(targetWindow, containerDisposables, options);
    const auxiliaryWindow = this.createAuxiliaryWindow(targetWindow, container, stylesLoaded);
    auxiliaryWindow.updateOptions({ compact: options?.compact ?? false });
    const registryDisposables = new DisposableStore();
    this.windows.set(targetWindow.vscodeWindowId, auxiliaryWindow);
    registryDisposables.add(toDisposable(() => this.windows.delete(targetWindow.vscodeWindowId)));
    const eventDisposables = new DisposableStore();
    Event.once(auxiliaryWindow.onWillDispose)(() => {
      targetWindow.close();
      containerDisposables.dispose();
      registryDisposables.dispose();
      eventDisposables.dispose();
    });
    registryDisposables.add(registerWindow(targetWindow));
    this._onDidOpenAuxiliaryWindow.fire({ window: auxiliaryWindow, disposables: eventDisposables });
    mark("code/auxiliaryWindow/didOpen");
    this.telemetryService.publicLog2("auxiliaryWindowOpen", { bounds: !!options?.bounds });
    return auxiliaryWindow;
  }
  createAuxiliaryWindow(targetWindow, container, stylesLoaded) {
    return new AuxiliaryWindow(targetWindow, container, stylesLoaded, this.configurationService, this.hostService, this.environmentService, this.contextMenuService, this.layoutService);
  }
  async openWindow(options) {
    const activeWindow = getActiveWindow();
    const activeWindowBounds = {
      x: activeWindow.screenX,
      y: activeWindow.screenY,
      width: activeWindow.outerWidth,
      height: activeWindow.outerHeight
    };
    const defaultSize = DEFAULT_AUX_WINDOW_SIZE;
    const width = options?.frameless ? options?.bounds?.width ?? defaultSize.width : Math.max(options?.bounds?.width ?? defaultSize.width, WindowMinimumSize.WIDTH);
    const height = options?.frameless ? options?.bounds?.height ?? defaultSize.height : Math.max(options?.bounds?.height ?? defaultSize.height, WindowMinimumSize.HEIGHT);
    let newWindowBounds = {
      x: options?.bounds?.x ?? Math.max(activeWindowBounds.x + activeWindowBounds.width / 2 - width / 2, 0),
      y: options?.bounds?.y ?? Math.max(activeWindowBounds.y + activeWindowBounds.height / 2 - height / 2, 0),
      width,
      height
    };
    if (!options?.bounds && newWindowBounds.x === activeWindowBounds.x && newWindowBounds.y === activeWindowBounds.y) {
      newWindowBounds = {
        ...newWindowBounds,
        x: newWindowBounds.x + 30,
        y: newWindowBounds.y + 30
      };
    }
    const features = coalesce([
      "popup=yes",
      `left=${newWindowBounds.x}`,
      `top=${newWindowBounds.y}`,
      `width=${newWindowBounds.width}`,
      `height=${newWindowBounds.height}`,
      // non-standard properties
      options?.nativeTitlebar ? "window-native-titlebar=yes" : void 0,
      options?.disableFullscreen ? "window-disable-fullscreen=yes" : void 0,
      options?.alwaysOnTop ? "window-always-on-top=yes" : void 0,
      options?.mode === 0 /* Maximized */ ? "window-maximized=yes" : void 0,
      options?.mode === 2 /* Fullscreen */ ? "window-fullscreen=yes" : void 0,
      options?.frameless ? "window-frameless=yes" : void 0,
      options?.transparent ? "window-transparent=yes" : void 0,
      options?.notResizable ? "window-not-resizable=yes" : void 0,
      options?.noBackgroundThrottling ? "window-no-background-throttling=yes" : void 0,
      options?.backgroundColor && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(options.backgroundColor) ? `window-background-color=${options.backgroundColor}` : void 0
    ]);
    const auxiliaryWindow = mainWindow.open(isFirefox ? "" : "about:blank", void 0, features.join(","));
    if (!auxiliaryWindow && isWeb) {
      return (await this.dialogService.prompt({
        type: Severity.Warning,
        message: localize("unableToOpenWindow", "The browser blocked opening a new window. Press 'Retry' to try again."),
        custom: {
          markdownDetails: [{ markdown: new MarkdownString(localize("unableToOpenWindowDetail", "Please allow pop-ups for this website in your [browser settings]({0}).", "https://aka.ms/allow-vscode-popup"), true) }]
        },
        buttons: [
          {
            label: localize({ key: "retry", comment: ["&& denotes a mnemonic"] }, "&&Retry"),
            run: () => this.openWindow(options)
          }
        ],
        cancelButton: true
      })).result;
    }
    return auxiliaryWindow?.window;
  }
  async resolveWindowId(auxiliaryWindow) {
    return BrowserAuxiliaryWindowService.WINDOW_IDS++;
  }
  createContainer(auxiliaryWindow, disposables, options) {
    auxiliaryWindow.document.createElement = function() {
      throw new Error('Not allowed to create elements in child window JavaScript context. Always use the main window so that "xyz instanceof HTMLElement" continues to work.');
    };
    this.applyMeta(auxiliaryWindow);
    const { stylesLoaded } = this.applyCSS(auxiliaryWindow, disposables);
    const container = this.applyHTML(auxiliaryWindow, disposables);
    return { stylesLoaded, container };
  }
  applyMeta(auxiliaryWindow) {
    for (const metaTag of ['meta[charset="utf-8"]', 'meta[http-equiv="Content-Security-Policy"]', 'meta[name="viewport"]', 'meta[name="theme-color"]']) {
      const metaElement = mainWindow.document.querySelector(metaTag);
      if (metaElement) {
        const clonedMetaElement = createMetaElement(auxiliaryWindow.document.head);
        copyAttributes(metaElement, clonedMetaElement);
        if (metaTag === 'meta[http-equiv="Content-Security-Policy"]') {
          const content = clonedMetaElement.getAttribute("content");
          if (content) {
            clonedMetaElement.setAttribute("content", content.replace(/(script-src[^\;]*)/, `script-src 'none'`));
          }
        }
      }
    }
    const originalIconLinkTag = mainWindow.document.querySelector('link[rel="icon"]');
    if (originalIconLinkTag) {
      const icon = createLinkElement(auxiliaryWindow.document.head);
      copyAttributes(originalIconLinkTag, icon);
    }
  }
  applyCSS(auxiliaryWindow, disposables) {
    mark("code/auxiliaryWindow/willApplyCSS");
    const mapOriginalToClone = /* @__PURE__ */ new Map();
    const stylesLoaded = new Barrier();
    stylesLoaded.wait().then(() => mark("code/auxiliaryWindow/didLoadCSSStyles"));
    const pendingLinksDisposables = disposables.add(new DisposableStore());
    let pendingLinksToSettle = 0;
    function onLinkSettled() {
      if (--pendingLinksToSettle === 0) {
        pendingLinksDisposables.dispose();
        stylesLoaded.open();
      }
    }
    function cloneNode(originalNode) {
      if (isGlobalStylesheet(originalNode)) {
        return;
      }
      const clonedNode = auxiliaryWindow.document.head.appendChild(originalNode.cloneNode(true));
      if (originalNode.tagName.toLowerCase() === "link") {
        pendingLinksToSettle++;
        pendingLinksDisposables.add(addDisposableListener(clonedNode, "load", onLinkSettled));
        pendingLinksDisposables.add(addDisposableListener(clonedNode, "error", onLinkSettled));
      }
      mapOriginalToClone.set(originalNode, clonedNode);
    }
    pendingLinksToSettle++;
    try {
      for (const originalNode of mainWindow.document.head.querySelectorAll('link[rel="stylesheet"], style')) {
        cloneNode(originalNode);
      }
    } finally {
      onLinkSettled();
    }
    disposables.add(cloneGlobalStylesheets(auxiliaryWindow));
    disposables.add(sharedMutationObserver.observe(mainWindow.document.head, disposables, { childList: true, subtree: true })((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList" || // only interested in added/removed nodes
        mutation.target.nodeName.toLowerCase() === "title" || // skip over title changes that happen frequently
        mutation.target.nodeName.toLowerCase() === "script" || // block <script> changes that are unsupported anyway
        mutation.target.nodeName.toLowerCase() === "meta") {
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (isHTMLElement(node) && (node.tagName.toLowerCase() === "style" || node.tagName.toLowerCase() === "link")) {
            cloneNode(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentNode) {
            const clonedNode = mapOriginalToClone.get(node.parentNode);
            if (clonedNode) {
              clonedNode.textContent = node.textContent;
            }
          }
        }
        for (const node of mutation.removedNodes) {
          const clonedNode = mapOriginalToClone.get(node);
          if (clonedNode) {
            clonedNode.parentNode?.removeChild(clonedNode);
            mapOriginalToClone.delete(node);
          }
        }
      }
    }));
    mark("code/auxiliaryWindow/didApplyCSS");
    return { stylesLoaded };
  }
  applyHTML(auxiliaryWindow, disposables) {
    mark("code/auxiliaryWindow/willApplyHTML");
    const container = $("div", { role: "application" });
    position(container, 0, 0, 0, 0, "relative");
    container.style.display = "flex";
    container.style.height = "100%";
    container.style.flexDirection = "column";
    auxiliaryWindow.document.body.append(container);
    disposables.add(trackAttributes(mainWindow.document.documentElement, auxiliaryWindow.document.documentElement));
    disposables.add(trackAttributes(mainWindow.document.body, auxiliaryWindow.document.body));
    disposables.add(trackAttributes(this.layoutService.mainContainer, container, ["class"]));
    mark("code/auxiliaryWindow/didApplyHTML");
    return container;
  }
  getWindow(windowId) {
    return this.windows.get(windowId);
  }
};
BrowserAuxiliaryWindowService = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, IDialogService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IContextMenuService)
], BrowserAuxiliaryWindowService);
registerSingleton(IAuxiliaryWindowService, BrowserAuxiliaryWindowService, InstantiationType.Delayed);
export {
  AuxiliaryWindow,
  AuxiliaryWindowMode,
  BrowserAuxiliaryWindowService,
  IAuxiliaryWindowService
};
