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
import { getWindowById } from "../../../../base/browser/dom.js";
import { OverlayLayoutElement } from "../../../../base/browser/overlayLayoutElement.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IWebviewService, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE } from "./webview.js";
let OverlayWebview = class extends Disposable {
  constructor(initInfo, _layoutService, _webviewService, _baseContextKeyService) {
    super();
    this._layoutService = _layoutService;
    this._webviewService = _webviewService;
    this._baseContextKeyService = _baseContextKeyService;
    this._isFirstLoad = true;
    this._firstLoadPendingMessages = /* @__PURE__ */ new Set();
    this._webview = this._register(new MutableDisposable());
    this._webviewEvents = this._register(new DisposableStore());
    this._html = "";
    this._initialScrollProgress = 0;
    this._state = void 0;
    this._owner = void 0;
    this._windowId = void 0;
    this._scopedContextKeyService = this._register(new MutableDisposable());
    this._shouldShowFindWidgetOnRestore = false;
    this._isDisposed = false;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onDidClickLink = this._register(new Emitter());
    this.onDidClickLink = this._onDidClickLink.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._onDidUpdateState = this._register(new Emitter());
    this.onDidUpdateState = this._onDidUpdateState.event;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onMissingCsp = this._register(new Emitter());
    this.onMissingCsp = this._onMissingCsp.event;
    this._onDidWheel = this._register(new Emitter());
    this.onDidWheel = this._onDidWheel.event;
    this._onFatalError = this._register(new Emitter());
    this.onFatalError = this._onFatalError.event;
    this.intrinsicContentSize = observableValue("WebviewIntrinsicContentSize", void 0);
    this.providedViewType = initInfo.providedViewType;
    this.origin = initInfo.origin ?? generateUuid();
    this._title = initInfo.title;
    this._extension = initInfo.extension;
    this._options = initInfo.options;
    this._contentOptions = initInfo.contentOptions;
  }
  get window() {
    return getWindowById(this._windowId, true).window;
  }
  get isFocused() {
    return !!this._webview.value?.isFocused;
  }
  dispose() {
    this._isDisposed = true;
    this._overlayLayout?.dispose();
    this._overlayLayout = void 0;
    for (const msg of this._firstLoadPendingMessages) {
      msg.resolve(false);
    }
    this._firstLoadPendingMessages.clear();
    this._onDidDispose.fire();
    super.dispose();
  }
  get container() {
    if (this._isDisposed) {
      throw new Error(`OverlayWebview has been disposed`);
    }
    return this.overlayLayout.content;
  }
  get overlayLayout() {
    if (!this._overlayLayout) {
      this._overlayLayout = new OverlayLayoutElement();
      this._overlayLayout.content.style.visibility = "hidden";
      this._overlayLayout.content.classList.add("webview-overlay-content");
      const root = this._layoutService.getContainer(this.window);
      root.appendChild(this._overlayLayout.root);
    }
    return this._overlayLayout;
  }
  claim(owner, targetWindow, scopedContextKeyService) {
    if (this._isDisposed) {
      return;
    }
    const oldOwner = this._owner;
    if (this._windowId !== targetWindow.vscodeWindowId) {
      this.release(oldOwner);
      this._webview.clear();
      this._webviewEvents.clear();
      this._overlayLayout?.dispose();
      this._overlayLayout = void 0;
    }
    this._owner = owner;
    this._windowId = targetWindow.vscodeWindowId;
    this._show(targetWindow);
    if (this._anchorState) {
      this.overlayLayout.setAnchorElement(this._anchorState.anchorElement, { clippingContainer: this._anchorState.clippingContainer });
    }
    if (oldOwner !== owner) {
      const contextKeyService = scopedContextKeyService || this._baseContextKeyService;
      this._scopedContextKeyService.clear();
      this._scopedContextKeyService.value = contextKeyService.createScoped(this.container);
      const wasFindVisible = this._findWidgetVisible?.get();
      this._findWidgetVisible?.reset();
      this._findWidgetVisible = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);
      this._findWidgetVisible.set(!!wasFindVisible);
      this._findWidgetEnabled?.reset();
      this._findWidgetEnabled = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED.bindTo(contextKeyService);
      this._findWidgetEnabled.set(!!this.options.enableFindWidget);
      this._webview.value?.setContextKeyService(this._scopedContextKeyService.value);
    }
  }
  release(owner) {
    if (this._owner !== owner) {
      return;
    }
    this._scopedContextKeyService.clear();
    this._owner = void 0;
    if (this._overlayLayout) {
      this._overlayLayout.content.style.visibility = "hidden";
    }
    if (this._options.retainContextWhenHidden) {
      this._shouldShowFindWidgetOnRestore = !!this._findWidgetVisible?.get();
      this.hideFind(false);
    } else {
      this._webview.clear();
      this._webviewEvents.clear();
    }
  }
  setAnchorElement(anchorElement, clippingContainer) {
    this._anchorState = { anchorElement, clippingContainer };
    this.overlayLayout.setAnchorElement(anchorElement, { clippingContainer });
  }
  _show(targetWindow) {
    if (this._isDisposed) {
      throw new Error("OverlayWebview is disposed");
    }
    if (!this._webview.value) {
      const webview = this._webviewService.createWebviewElement({
        providedViewType: this.providedViewType,
        origin: this.origin,
        title: this._title,
        options: this._options,
        contentOptions: this._contentOptions,
        extension: this.extension
      });
      this._webview.value = webview;
      webview.state = this._state;
      if (this._scopedContextKeyService.value) {
        this._webview.value.setContextKeyService(this._scopedContextKeyService.value);
      }
      if (this._html) {
        webview.setHtml(this._html);
      }
      if (this._options.tryRestoreScrollPosition) {
        webview.initialScrollProgress = this._initialScrollProgress;
      }
      this._findWidgetEnabled?.set(!!this.options.enableFindWidget);
      webview.mountTo(this.container, targetWindow);
      this._webviewEvents.clear();
      this._webviewEvents.add(webview.onDidFocus(() => {
        this._onDidFocus.fire();
      }));
      this._webviewEvents.add(webview.onDidBlur(() => {
        this._onDidBlur.fire();
      }));
      this._webviewEvents.add(webview.onDidClickLink((x) => {
        this._onDidClickLink.fire(x);
      }));
      this._webviewEvents.add(webview.onMessage((x) => {
        this._onMessage.fire(x);
      }));
      this._webviewEvents.add(webview.onMissingCsp((x) => {
        this._onMissingCsp.fire(x);
      }));
      this._webviewEvents.add(webview.onDidWheel((x) => {
        this._onDidWheel.fire(x);
      }));
      this._webviewEvents.add(webview.onFatalError((x) => {
        this._onFatalError.fire(x);
      }));
      this._webviewEvents.add(autorun((reader) => {
        this.intrinsicContentSize.set(reader.readObservable(webview.intrinsicContentSize), void 0, void 0);
      }));
      this._webviewEvents.add(webview.onDidScroll((x) => {
        this._initialScrollProgress = x.scrollYPercentage;
        this._onDidScroll.fire(x);
      }));
      this._webviewEvents.add(webview.onDidUpdateState((state) => {
        this._state = state;
        this._onDidUpdateState.fire(state);
      }));
      if (this._isFirstLoad) {
        this._firstLoadPendingMessages.forEach(async (msg) => {
          msg.resolve(await webview.postMessage(msg.message, msg.transfer));
        });
      }
      this._isFirstLoad = false;
      this._firstLoadPendingMessages.clear();
    }
    if (this.options.retainContextWhenHidden && this._shouldShowFindWidgetOnRestore) {
      this.showFind(false);
      this._shouldShowFindWidgetOnRestore = false;
    }
    if (this._overlayLayout) {
      this._overlayLayout.content.style.visibility = "visible";
    }
  }
  setHtml(html) {
    this._html = html;
    this._withWebview((webview) => webview.setHtml(html));
  }
  setTitle(title) {
    this._title = title;
    this._withWebview((webview) => webview.setTitle(title));
  }
  get initialScrollProgress() {
    return this._initialScrollProgress;
  }
  set initialScrollProgress(value) {
    this._initialScrollProgress = value;
    this._withWebview((webview) => webview.initialScrollProgress = value);
  }
  get state() {
    return this._state;
  }
  set state(value) {
    this._state = value;
    this._withWebview((webview) => webview.state = value);
  }
  get extension() {
    return this._extension;
  }
  set extension(value) {
    this._extension = value;
    this._withWebview((webview) => webview.extension = value);
  }
  get options() {
    return this._options;
  }
  set options(value) {
    this._options = { customClasses: this._options.customClasses, ...value };
  }
  get contentOptions() {
    return this._contentOptions;
  }
  set contentOptions(value) {
    this._contentOptions = value;
    this._withWebview((webview) => webview.contentOptions = value);
  }
  set localResourcesRoot(resources) {
    this._withWebview((webview) => webview.localResourcesRoot = resources);
  }
  async postMessage(message, transfer) {
    if (this._webview.value) {
      return this._webview.value.postMessage(message, transfer);
    }
    if (this._isFirstLoad) {
      let resolve;
      const p = new Promise((r) => resolve = r);
      this._firstLoadPendingMessages.add({ message, transfer, resolve });
      return p;
    }
    return false;
  }
  focus() {
    this._webview.value?.focus();
  }
  reload() {
    this._webview.value?.reload();
  }
  selectAll() {
    this._webview.value?.selectAll();
  }
  copy() {
    this._webview.value?.copy();
  }
  paste() {
    this._webview.value?.paste();
  }
  cut() {
    this._webview.value?.cut();
  }
  undo() {
    this._webview.value?.undo();
  }
  redo() {
    this._webview.value?.redo();
  }
  showFind(animated = true) {
    if (this._webview.value) {
      this._webview.value.showFind(animated);
      this._findWidgetVisible?.set(true);
    }
  }
  hideFind(animated = true) {
    this._findWidgetVisible?.reset();
    this._webview.value?.hideFind(animated);
  }
  runFindAction(previous) {
    this._webview.value?.runFindAction(previous);
  }
  _withWebview(f) {
    if (this._webview.value) {
      f(this._webview.value);
    }
  }
  windowDidDragStart() {
    this._webview.value?.windowDidDragStart();
  }
  windowDidDragEnd() {
    this._webview.value?.windowDidDragEnd();
  }
  setContextKeyService(contextKeyService) {
    this._webview.value?.setContextKeyService(contextKeyService);
  }
};
OverlayWebview = __decorateClass([
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IWebviewService),
  __decorateParam(3, IContextKeyService)
], OverlayWebview);
export {
  OverlayWebview
};
