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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WebviewThemeDataProvider } from "./themeing.js";
import { WebviewElement } from "./webviewElement.js";
import { OverlayWebview } from "./overlayWebview.js";
let WebviewService = class extends Disposable {
  constructor(_instantiationService) {
    super();
    this._instantiationService = _instantiationService;
    this._webviews = /* @__PURE__ */ new Set();
    this._onDidChangeActiveWebview = this._register(new Emitter());
    this.onDidChangeActiveWebview = this._onDidChangeActiveWebview.event;
    this._webviewThemeDataProvider = this._instantiationService.createInstance(WebviewThemeDataProvider);
  }
  get activeWebview() {
    return this._activeWebview;
  }
  _updateActiveWebview(value) {
    if (value !== this._activeWebview) {
      this._activeWebview = value;
      this._onDidChangeActiveWebview.fire(value);
    }
  }
  get webviews() {
    return this._webviews.values();
  }
  createWebviewElement(initInfo) {
    const webview = this._instantiationService.createInstance(WebviewElement, initInfo, this._webviewThemeDataProvider);
    this.registerNewWebview(webview);
    return webview;
  }
  createWebviewOverlay(initInfo) {
    const webview = this._instantiationService.createInstance(OverlayWebview, initInfo);
    this.registerNewWebview(webview);
    return webview;
  }
  registerNewWebview(webview) {
    this._webviews.add(webview);
    const store = new DisposableStore();
    store.add(webview.onDidFocus(() => {
      this._updateActiveWebview(webview);
    }));
    const onBlur = () => {
      if (this._activeWebview === webview) {
        this._updateActiveWebview(void 0);
      }
    };
    store.add(webview.onDidBlur(onBlur));
    store.add(webview.onDidDispose(() => {
      onBlur();
      store.dispose();
      this._webviews.delete(webview);
    }));
  }
};
WebviewService = __decorateClass([
  __decorateParam(0, IInstantiationService)
], WebviewService);
export {
  WebviewService
};
