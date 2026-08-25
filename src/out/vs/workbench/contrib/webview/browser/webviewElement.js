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
import { isFirefox } from "../../../../base/browser/browser.js";
import { addDisposableListener, EventType, getWindow, getWindowById } from "../../../../base/browser/dom.js";
import { parentOriginHash } from "../../../../base/browser/iframe.js";
import { promiseWithResolvers, ThrottledDelayer } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { COI } from "../../../../base/common/network.js";
import { observableValue } from "../../../../base/common/observable.js";
import { listenStream } from "../../../../base/common/stream.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { ITunnelService } from "../../../../platform/tunnel/common/tunnel.js";
import { WebviewPortMappingManager } from "../../../../platform/webview/common/webviewPortMapping.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { decodeAuthority, webviewGenericCspSource, webviewRootResourceAuthority } from "../common/webview.js";
import { loadLocalResource, WebviewResourceResponse } from "./resourceLoading.js";
import { areWebviewContentOptionsEqual } from "./webview.js";
import { WebviewFindWidget } from "./webviewFindWidget.js";
var WebviewState;
((WebviewState2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["Initializing"] = 0] = "Initializing";
    Type2[Type2["Ready"] = 1] = "Ready";
  })(Type = WebviewState2.Type || (WebviewState2.Type = {}));
  class Initializing {
    constructor(pendingMessages) {
      this.pendingMessages = pendingMessages;
      this.type = 0 /* Initializing */;
    }
  }
  WebviewState2.Initializing = Initializing;
  WebviewState2.Ready = { type: 1 /* Ready */ };
})(WebviewState || (WebviewState = {}));
const webviewIdContext = "webviewId";
let WebviewElement = class extends Disposable {
  constructor(initInfo, webviewThemeDataProvider, configurationService, contextMenuService, notificationService, _environmentService, _logService, _remoteAuthorityResolverService, _tunnelService, _accessibilityService, _instantiationService) {
    super();
    this.webviewThemeDataProvider = webviewThemeDataProvider;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._tunnelService = _tunnelService;
    this._accessibilityService = _accessibilityService;
    this._instantiationService = _instantiationService;
    this.id = generateUuid();
    this._windowId = void 0;
    this._expectedServiceWorkerVersion = 6;
    this._state = new WebviewState.Initializing([]);
    this._resourceLoadingCts = this._register(new CancellationTokenSource());
    this._activeStreamControllers = /* @__PURE__ */ new Set();
    this._focusDelayer = this._register(new ThrottledDelayer(50));
    this._onDidHtmlChange = this._register(new Emitter());
    this.onDidHtmlChange = this._onDidHtmlChange.event;
    this._messageHandlers = /* @__PURE__ */ new Map();
    this.checkImeCompletionState = true;
    this.intrinsicContentSize = observableValue("WebviewIntrinsicContentSize", void 0);
    this._disposed = false;
    this._onMissingCsp = this._register(new Emitter());
    this.onMissingCsp = this._onMissingCsp.event;
    this._onDidClickLink = this._register(new Emitter());
    this.onDidClickLink = this._onDidClickLink.event;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._onDidWheel = this._register(new Emitter());
    this.onDidWheel = this._onDidWheel.event;
    this._onDidUpdateState = this._register(new Emitter());
    this.onDidUpdateState = this._onDidUpdateState.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onFatalError = this._register(new Emitter());
    this.onFatalError = this._onFatalError.event;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._hasAlertedAboutMissingCsp = false;
    this._hasFindResult = this._register(new Emitter());
    this.hasFindResult = this._hasFindResult.event;
    this._onDidStopFind = this._register(new Emitter());
    this.onDidStopFind = this._onDidStopFind.event;
    this.providedViewType = initInfo.providedViewType;
    this.origin = initInfo.origin ?? this.id;
    this._options = initInfo.options;
    this.extension = initInfo.extension;
    this._content = {
      html: "",
      title: initInfo.title,
      options: initInfo.contentOptions,
      state: void 0
    };
    this._portMappingManager = this._register(new WebviewPortMappingManager(
      () => this.extension?.location,
      () => this._content.options.portMapping || [],
      this._tunnelService
    ));
    this._element = this._createElement(initInfo.options, initInfo.contentOptions);
    this._register(this.on("no-csp-found", () => {
      this.handleNoCspFound();
    }));
    this._register(this.on("did-click-link", ({ uri }) => {
      if (!this.isActiveElement()) {
        return;
      }
      this._onDidClickLink.fire(uri);
    }));
    this._register(this.on("onmessage", ({ message, transfer }) => {
      this._onMessage.fire({ message, transfer });
    }));
    this._register(this.on("did-scroll", ({ scrollYPercentage }) => {
      this._onDidScroll.fire({ scrollYPercentage });
    }));
    this._register(this.on("do-reload", () => {
      this.reload();
    }));
    this._register(this.on("do-update-state", (state) => {
      this.state = state;
      this._onDidUpdateState.fire(state);
    }));
    this._register(this.on("did-focus", () => {
      this.handleFocusChange(true);
    }));
    this._register(this.on("did-blur", () => {
      this.handleFocusChange(false);
    }));
    this._register(this.on("did-scroll-wheel", (event) => {
      this._onDidWheel.fire(event);
    }));
    this._register(this.on("did-find", ({ didFind }) => {
      this._hasFindResult.fire(didFind);
    }));
    this._register(this.on("fatal-error", (e) => {
      notificationService.error(localize("fatalErrorMessage", "Error loading webview: {0}", e.message));
      this._onFatalError.fire({ message: e.message });
    }));
    this._register(this.on("did-keydown", (data) => {
      this.handleKeyEvent("keydown", data);
    }));
    this._register(this.on("did-keyup", (data) => {
      this.handleKeyEvent("keyup", data);
    }));
    this._register(this.on("did-context-menu", (data) => {
      if (!this.element) {
        return;
      }
      if (!this._contextKeyService) {
        return;
      }
      const elementBox = this.element.getBoundingClientRect();
      const contextKeyService = this._contextKeyService.createOverlay([
        ...Object.entries(data.context),
        [webviewIdContext, this.providedViewType]
      ]);
      contextMenuService.showContextMenu({
        menuId: MenuId.WebviewContext,
        menuActionOptions: { shouldForwardArgs: true },
        contextKeyService,
        getActionsContext: () => ({ ...data.context, webview: this.providedViewType }),
        getAnchor: () => ({
          x: elementBox.x + data.clientX,
          y: elementBox.y + data.clientY
        })
      });
      this._send("set-context-menu-visible", { visible: true });
    }));
    this._register(this.on("load-resource", async (entry) => {
      try {
        const authority = decodeAuthority(entry.authority);
        const uri = URI.from({
          scheme: entry.scheme,
          authority,
          path: decodeURIComponent(entry.path),
          // This gets re-encoded
          query: entry.query ? decodeURIComponent(entry.query) : entry.query
        });
        this.loadResource(entry.id, uri, { ifNoneMatch: entry.ifNoneMatch, range: entry.range }, this._resourceLoadingCts.token);
      } catch (e) {
        this._send("did-load-resource", {
          id: entry.id,
          status: 404,
          path: entry.path
        });
      }
    }));
    this._register(this.on("load-localhost", (entry) => {
      this.localLocalhost(entry.id, entry.origin);
    }));
    this._register(Event.runAndSubscribe(webviewThemeDataProvider.onThemeDataChanged, () => this.style()));
    this._register(_accessibilityService.onDidChangeReducedMotion(() => this.style()));
    this._register(_accessibilityService.onDidChangeScreenReaderOptimized(() => this.style()));
    this._register(contextMenuService.onDidHideContextMenu(() => this._send("set-context-menu-visible", { visible: false })));
    this._confirmBeforeClose = configurationService.getValue("window.confirmBeforeClose");
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("window.confirmBeforeClose")) {
        this._confirmBeforeClose = configurationService.getValue("window.confirmBeforeClose");
        this._send("set-confirm-before-close", this._confirmBeforeClose);
      }
    }));
    this._register(this.on("drag-start", () => {
      this._startBlockingIframeDragEvents();
    }));
    this._register(this.on("drag", (event) => {
      this.handleDragEvent("drag", event);
    }));
    this._register(this.on("updated-intrinsic-content-size", (event) => {
      this.intrinsicContentSize.set({ width: event.width, height: event.height }, void 0, void 0);
    }));
    if (initInfo.options.enableFindWidget) {
      this._webviewFindWidget = this._register(this._instantiationService.createInstance(WebviewFindWidget, this));
    }
  }
  get window() {
    return typeof this._windowId === "number" ? getWindowById(this._windowId)?.window : void 0;
  }
  get platform() {
    return "browser";
  }
  static {
    this._supportsTransferableStreams = new Lazy(() => {
      try {
        const stream = new ReadableStream();
        const mc = new MessageChannel();
        mc.port1.postMessage(stream, [stream]);
        mc.port1.close();
        mc.port2.close();
        return true;
      } catch {
        return false;
      }
    });
  }
  get element() {
    return this._element;
  }
  get isFocused() {
    if (!this._focused) {
      return false;
    }
    if (!this.window) {
      return false;
    }
    if (this.window.document.activeElement && this.window.document.activeElement !== this.element) {
      return false;
    }
    return true;
  }
  dispose() {
    this._disposed = true;
    this.element?.remove();
    this._element = void 0;
    this._messagePort = void 0;
    if (this._state.type === 0 /* Initializing */) {
      for (const message of this._state.pendingMessages) {
        message.resolve(false);
      }
      this._state.pendingMessages = [];
    }
    this._onDidDispose.fire();
    for (const controller of this._activeStreamControllers) {
      try {
        controller.close();
      } catch {
      }
    }
    this._activeStreamControllers.clear();
    this._resourceLoadingCts.dispose(true);
    super.dispose();
  }
  setContextKeyService(contextKeyService) {
    this._contextKeyService = contextKeyService;
  }
  postMessage(message, transfer) {
    return this._send("message", { message, transfer });
  }
  async _send(channel, data, _createElement = []) {
    if (this._state.type === 0 /* Initializing */) {
      const { promise, resolve } = promiseWithResolvers();
      this._state.pendingMessages.push({ channel, data, transferable: _createElement, resolve });
      return promise;
    } else {
      return this.doPostMessage(channel, data, _createElement);
    }
  }
  _createElement(options, _contentOptions) {
    const element = document.createElement("iframe");
    element.name = this.id;
    element.className = `webview ${options.customClasses || ""}`;
    element.sandbox.add("allow-scripts", "allow-same-origin", "allow-forms", "allow-pointer-lock", "allow-downloads");
    const allowRules = ["cross-origin-isolated", "autoplay", "local-network-access"];
    if (!isFirefox) {
      allowRules.push("clipboard-read", "clipboard-write");
    }
    element.setAttribute("allow", allowRules.join("; "));
    element.style.border = "none";
    element.style.width = "100%";
    element.style.height = "100%";
    element.focus = () => {
      this._doFocus();
    };
    return element;
  }
  _initElement(encodedWebviewOrigin, extension, options, targetWindow) {
    const params = {
      id: this.id,
      parentId: targetWindow.vscodeWindowId.toString(),
      origin: this.origin,
      swVersion: String(this._expectedServiceWorkerVersion),
      extensionId: extension?.id.value ?? "",
      platform: this.platform,
      "vscode-resource-base-authority": webviewRootResourceAuthority,
      parentOrigin: targetWindow.origin
    };
    if (this._options.disableServiceWorker) {
      params.disableServiceWorker = "true";
    }
    if (this._environmentService.remoteAuthority) {
      params.remoteAuthority = this._environmentService.remoteAuthority;
    }
    if (options.purpose) {
      params.purpose = options.purpose;
    }
    COI.addSearchParam(params, true, true);
    const queryString = new URLSearchParams(params).toString();
    this.perfMark("init/set-src");
    const fileName = "index.html";
    this.element.setAttribute("src", `${this.webviewContentEndpoint(encodedWebviewOrigin)}/${fileName}?${queryString}`);
  }
  mountTo(element, targetWindow) {
    if (!this.element) {
      return;
    }
    this._windowId = targetWindow.vscodeWindowId;
    this._encodedWebviewOriginPromise = parentOriginHash(targetWindow.origin, this.origin).then((id) => this._encodedWebviewOrigin = id);
    this._encodedWebviewOriginPromise.then((encodedWebviewOrigin) => {
      if (!this._disposed) {
        this._initElement(encodedWebviewOrigin, this.extension, this._options, targetWindow);
      }
    });
    this._registerMessageHandler(targetWindow);
    if (this._webviewFindWidget) {
      element.appendChild(this._webviewFindWidget.getDomNode());
    }
    for (const eventName of [EventType.MOUSE_DOWN, EventType.MOUSE_MOVE, EventType.DROP]) {
      this._register(addDisposableListener(element, eventName, () => {
        this._stopBlockingIframeDragEvents();
      }));
    }
    for (const node of [element, targetWindow]) {
      this._register(addDisposableListener(node, EventType.DRAG_END, () => {
        this._stopBlockingIframeDragEvents();
      }));
    }
    element.id = this.id;
    this.perfMark("mounted");
    element.appendChild(this.element);
  }
  _registerMessageHandler(targetWindow) {
    const subscription = this._register(addDisposableListener(targetWindow, "message", (e) => {
      if (!this._encodedWebviewOrigin || e?.data?.target !== this.id) {
        return;
      }
      if (e.origin !== this._webviewContentOrigin(this._encodedWebviewOrigin)) {
        console.log(`Skipped renderer receiving message due to mismatched origins: ${e.origin} ${this._webviewContentOrigin}`);
        return;
      }
      if (e.data.channel === "webview-ready") {
        if (this._messagePort) {
          return;
        }
        this.perfMark("webview-ready");
        this._logService.trace(`Webview(${this.id}): webview ready`);
        this._messagePort = e.ports[0];
        this._messagePort.onmessage = (e2) => {
          const handlers = this._messageHandlers.get(e2.data.channel);
          if (!handlers) {
            console.log(`No handlers found for '${e2.data.channel}'`);
            return;
          }
          handlers?.forEach((handler) => handler(e2.data.data, e2));
        };
        this.element?.classList.add("ready");
        if (this._state.type === 0 /* Initializing */) {
          this._state.pendingMessages.forEach(({ channel, data, resolve }) => resolve(this.doPostMessage(channel, data)));
        }
        this._state = WebviewState.Ready;
        subscription.dispose();
      }
    }));
  }
  perfMark(name) {
    performance.mark(`webview/webviewElement/${name}`, {
      detail: {
        id: this.id
      }
    });
  }
  _startBlockingIframeDragEvents() {
    if (this.element) {
      this.element.style.pointerEvents = "none";
    }
  }
  _stopBlockingIframeDragEvents() {
    if (this.element) {
      this.element.style.pointerEvents = "auto";
    }
  }
  webviewContentEndpoint(encodedWebviewOrigin) {
    const webviewExternalEndpoint = this._environmentService.webviewExternalEndpoint;
    if (!webviewExternalEndpoint) {
      throw new Error(`'webviewExternalEndpoint' has not been configured. Webviews will not work!`);
    }
    const endpoint = webviewExternalEndpoint.replace("{{uuid}}", encodedWebviewOrigin);
    if (endpoint[endpoint.length - 1] === "/") {
      return endpoint.slice(0, endpoint.length - 1);
    }
    return endpoint;
  }
  _webviewContentOrigin(encodedWebviewOrigin) {
    const uri = URI.parse(this.webviewContentEndpoint(encodedWebviewOrigin));
    return uri.scheme + "://" + uri.authority.toLowerCase();
  }
  doPostMessage(channel, data, transferable = []) {
    if (this.element && this._messagePort) {
      this._messagePort.postMessage({ channel, args: data }, transferable);
      return true;
    }
    return false;
  }
  on(channel, handler) {
    let handlers = this._messageHandlers.get(channel);
    if (!handlers) {
      handlers = /* @__PURE__ */ new Set();
      this._messageHandlers.set(channel, handlers);
    }
    handlers.add(handler);
    return toDisposable(() => {
      this._messageHandlers.get(channel)?.delete(handler);
    });
  }
  handleNoCspFound() {
    if (this._hasAlertedAboutMissingCsp) {
      return;
    }
    this._hasAlertedAboutMissingCsp = true;
    if (this.extension?.id) {
      if (this._environmentService.isExtensionDevelopment) {
        this._onMissingCsp.fire(this.extension.id);
      }
    }
  }
  reload() {
    this.doUpdateContent(this._content);
  }
  reinitializeAfterDismount() {
    this._state = new WebviewState.Initializing([]);
    this._messagePort = void 0;
    this.mountTo(this.element.parentElement, getWindow(this.element));
    this.style();
    this.reload();
  }
  setHtml(html) {
    this.doUpdateContent({ ...this._content, html });
    this._onDidHtmlChange.fire(html);
  }
  setTitle(title) {
    this._content = { ...this._content, title };
    this._send("set-title", title);
  }
  set contentOptions(options) {
    this._logService.debug(`Webview(${this.id}): will update content options`);
    if (areWebviewContentOptionsEqual(options, this._content.options)) {
      this._logService.debug(`Webview(${this.id}): skipping content options update`);
      return;
    }
    this.doUpdateContent({ ...this._content, options });
  }
  set localResourcesRoot(resources) {
    this._content = {
      ...this._content,
      options: { ...this._content.options, localResourceRoots: resources }
    };
  }
  set state(state) {
    this._content = { ...this._content, state };
  }
  set initialScrollProgress(value) {
    this._send("initial-scroll-position", value);
  }
  doUpdateContent(newContent) {
    this._logService.debug(`Webview(${this.id}): will update content`);
    this._content = newContent;
    const allowScripts = !!this._content.options.allowScripts;
    this.perfMark("set-content");
    this._send("content", {
      contents: this._content.html,
      title: this._content.title,
      options: {
        allowMultipleAPIAcquire: !!this._content.options.allowMultipleAPIAcquire,
        allowScripts,
        allowForms: this._content.options.allowForms ?? allowScripts
        // For back compat, we allow forms by default when scripts are enabled
      },
      state: this._content.state,
      cspSource: webviewGenericCspSource,
      confirmBeforeClose: this._confirmBeforeClose
    });
  }
  style() {
    let { styles, activeTheme, themeLabel, themeId } = this.webviewThemeDataProvider.getWebviewThemeData();
    if (this._options.transformCssVariables) {
      styles = this._options.transformCssVariables(styles);
    }
    const reduceMotion = this._accessibilityService.isMotionReduced();
    const screenReader = this._accessibilityService.isScreenReaderOptimized();
    this._send("styles", { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader });
  }
  handleFocusChange(isFocused) {
    this._focused = isFocused;
    if (isFocused) {
      this._onDidFocus.fire();
    } else {
      this._onDidBlur.fire();
    }
  }
  shouldForwardKeyEvent(event) {
    return event.isTrusted || !!this._content.options.forwardUntrustedKeypressEvents;
  }
  isActiveElement() {
    return !!this.element && this.window?.document.activeElement === this.element;
  }
  handleKeyEvent(type, event) {
    if (!this.shouldForwardKeyEvent(event) || !this.isActiveElement()) {
      return;
    }
    const emulatedKeyboardEvent = new KeyboardEvent(type, event);
    Object.defineProperty(emulatedKeyboardEvent, "target", {
      get: () => this.element
    });
    this.window?.dispatchEvent(emulatedKeyboardEvent);
  }
  handleDragEvent(type, event) {
    const emulatedDragEvent = new DragEvent(type, event);
    Object.defineProperty(emulatedDragEvent, "target", {
      get: () => this.element
    });
    this.window?.dispatchEvent(emulatedDragEvent);
  }
  windowDidDragStart() {
    this._startBlockingIframeDragEvents();
  }
  windowDidDragEnd() {
    this._stopBlockingIframeDragEvents();
  }
  selectAll() {
    this.execCommand("selectAll");
  }
  copy() {
    this.execCommand("copy");
  }
  paste() {
    this.execCommand("paste");
  }
  cut() {
    this.execCommand("cut");
  }
  undo() {
    this.execCommand("undo");
  }
  redo() {
    this.execCommand("redo");
  }
  execCommand(command) {
    if (this.element) {
      this._send("execCommand", command);
    }
  }
  async loadResource(id, uri, options, token) {
    if (this._disposed) {
      return;
    }
    try {
      const result = await this._instantiationService.invokeFunction(loadLocalResource, uri, {
        ifNoneMatch: options.ifNoneMatch,
        roots: this._content.options.localResourceRoots || [],
        range: options.range
      }, token);
      if (this._disposed) {
        return;
      }
      switch (result.type) {
        case WebviewResourceResponse.Type.Success: {
          const range = options.range;
          const requestedRangeEnd = range?.end !== void 0 ? range.end : result.size - 1;
          const rangeEnd = Math.min(requestedRangeEnd, result.size - 1);
          const rangeHeader = range ? `bytes ${range.start}-${rangeEnd}/${result.size}` : void 0;
          if (WebviewElement._supportsTransferableStreams.value) {
            const streamCts = this.platform === "electron" ? new CancellationTokenSource(token) : void 0;
            let controller;
            let closed = false;
            const close = () => {
              if (!closed) {
                closed = true;
                streamCts?.dispose();
                if (controller) {
                  this._activeStreamControllers.delete(controller);
                  try {
                    controller.close();
                  } catch {
                  }
                }
              }
            };
            const stream = new ReadableStream({
              start: (newController) => {
                controller = newController;
                this._activeStreamControllers.add(controller);
                listenStream(result.stream, {
                  onData: (chunk) => {
                    if (!closed) {
                      try {
                        controller?.enqueue(new Uint8Array(chunk.buffer.buffer, chunk.buffer.byteOffset, chunk.buffer.byteLength));
                      } catch {
                        close();
                      }
                    }
                  },
                  onError: (err) => {
                    if (!closed) {
                      closed = true;
                      streamCts?.dispose();
                      const currentController = controller;
                      if (currentController) {
                        this._activeStreamControllers.delete(currentController);
                        try {
                          currentController.error(err);
                        } catch {
                        }
                      }
                    }
                  },
                  onEnd: () => close()
                }, streamCts?.token ?? token);
              },
              cancel: streamCts ? () => {
                streamCts.dispose(true);
                result.stream.destroy();
                close();
              } : void 0
            });
            this._send("did-load-resource", {
              id,
              status: range ? 206 : 200,
              path: uri.path,
              mime: result.mimeType,
              etag: result.etag,
              mtime: result.mtime,
              range: rangeHeader,
              stream
            }, [stream]);
          } else {
            this._send("did-load-resource", {
              id,
              status: range ? 206 : 200,
              path: uri.path,
              mime: result.mimeType,
              etag: result.etag,
              mtime: result.mtime,
              range: rangeHeader
            });
            listenStream(result.stream, {
              onData: (chunk) => {
                const data = chunk.buffer.slice();
                this._send("did-load-resource-chunk", { id, data }, [data.buffer]);
              },
              onError: () => {
                this._send("did-load-resource-end", { id, error: true });
              },
              onEnd: () => {
                this._send("did-load-resource-end", { id });
              }
            }, token);
          }
          return;
        }
        case WebviewResourceResponse.Type.NotModified: {
          return this._send("did-load-resource", {
            id,
            status: 304,
            // not modified
            path: uri.path,
            mime: result.mimeType,
            mtime: result.mtime
          });
        }
        case WebviewResourceResponse.Type.AccessDenied: {
          return this._send("did-load-resource", {
            id,
            status: 401,
            // unauthorized
            path: uri.path
          });
        }
      }
    } catch {
    }
    return this._send("did-load-resource", {
      id,
      status: 404,
      path: uri.path
    });
  }
  async localLocalhost(id, origin) {
    const authority = this._environmentService.remoteAuthority;
    const resolveAuthority = authority ? await this._remoteAuthorityResolverService.resolveAuthority(authority) : void 0;
    const redirect = resolveAuthority ? await this._portMappingManager.getRedirect(resolveAuthority.authority, origin) : void 0;
    return this._send("did-load-localhost", {
      id,
      origin,
      location: redirect
    });
  }
  focus() {
    this._doFocus();
    this.handleFocusChange(true);
  }
  _doFocus() {
    if (!this.element) {
      return;
    }
    try {
      this.element.contentWindow?.focus();
    } catch {
    }
    this._focusDelayer.trigger(async () => {
      if (!this.isFocused || !this.element) {
        return;
      }
      if (this.window?.document.activeElement && this.window.document.activeElement !== this.element && this.window.document.activeElement?.tagName !== "BODY") {
        return;
      }
      this.window?.document.body?.focus();
      this._send("focus", void 0);
    });
  }
  /**
   * Webviews expose a stateful find API.
   * Successive calls to find will move forward or backward through onFindResults
   * depending on the supplied options.
   *
   * @param value The string to search for. Empty strings are ignored.
   */
  find(value, previous) {
    if (!this.element) {
      return;
    }
    this._send("find", { value, previous });
  }
  updateFind(value) {
    if (!value || !this.element) {
      return;
    }
    this._send("find", { value });
  }
  stopFind(keepSelection) {
    if (!this.element) {
      return;
    }
    this._send("find-stop", { clearSelection: !keepSelection });
    this._onDidStopFind.fire();
  }
  showFind(animated = true) {
    this._webviewFindWidget?.reveal(void 0, animated);
  }
  hideFind(animated = true) {
    this._webviewFindWidget?.hide(animated);
  }
  runFindAction(previous) {
    this._webviewFindWidget?.find(previous);
  }
};
WebviewElement = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IRemoteAuthorityResolverService),
  __decorateParam(8, ITunnelService),
  __decorateParam(9, IAccessibilityService),
  __decorateParam(10, IInstantiationService)
], WebviewElement);
export {
  WebviewElement
};
