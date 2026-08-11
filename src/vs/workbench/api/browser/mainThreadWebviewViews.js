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
import { onUnexpectedError } from "../../../base/common/errors.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { reviveWebviewExtension } from "./mainThreadWebviews.js";
import * as extHostProtocol from "../common/extHost.protocol.js";
import { IWebviewViewService } from "../../contrib/webviewView/browser/webviewViewService.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
let MainThreadWebviewsViews = class extends Disposable {
  constructor(context, mainThreadWebviews, _telemetryService, _webviewViewService) {
    super();
    this.mainThreadWebviews = mainThreadWebviews;
    this._telemetryService = _telemetryService;
    this._webviewViewService = _webviewViewService;
    this._webviewViews = this._register(new DisposableMap());
    this._webviewViewProviders = this._register(new DisposableMap());
    this._proxy = context.getProxy(extHostProtocol.ExtHostContext.ExtHostWebviewViews);
  }
  $setWebviewViewTitle(handle, value) {
    const webviewView = this.getWebviewView(handle);
    webviewView.title = value;
  }
  $setWebviewViewDescription(handle, value) {
    const webviewView = this.getWebviewView(handle);
    webviewView.description = value;
  }
  $setWebviewViewBadge(handle, badge) {
    const webviewView = this.getWebviewView(handle);
    webviewView.badge = badge;
  }
  $show(handle, preserveFocus) {
    const webviewView = this.getWebviewView(handle);
    webviewView.show(preserveFocus);
  }
  $registerWebviewViewProvider(extensionData, viewType, options) {
    if (this._webviewViewProviders.has(viewType)) {
      throw new Error(`View provider for ${viewType} already registered`);
    }
    const extension = reviveWebviewExtension(extensionData);
    const registration = this._webviewViewService.register(viewType, {
      resolve: async (webviewView, cancellation) => {
        const handle = generateUuid();
        this._webviewViews.set(handle, webviewView);
        this.mainThreadWebviews.addWebview(handle, webviewView.webview, { serializeBuffersForPostMessage: options.serializeBuffersForPostMessage });
        let state = void 0;
        if (webviewView.webview.state) {
          try {
            state = JSON.parse(webviewView.webview.state);
          } catch (e) {
            console.error("Could not load webview state", e, webviewView.webview.state);
          }
        }
        webviewView.webview.extension = extension;
        if (options) {
          webviewView.webview.options = options;
        }
        const subscriptions = new DisposableStore();
        subscriptions.add(webviewView.onDidChangeVisibility((visible) => {
          this._proxy.$onDidChangeWebviewViewVisibility(handle, visible);
        }));
        subscriptions.add(webviewView.onDispose(() => {
          this._proxy.$disposeWebviewView(handle);
          this._webviewViews.deleteAndDispose(handle);
          subscriptions.dispose();
        }));
        this._telemetryService.publicLog2("webviews:createWebviewView", {
          extensionId: extension.id.value,
          id: viewType
        });
        try {
          await this._proxy.$resolveWebviewView(handle, viewType, webviewView.title, state, cancellation);
        } catch (error) {
          onUnexpectedError(error);
          webviewView.webview.setHtml(this.mainThreadWebviews.getWebviewResolvedFailedContent(viewType));
        }
      }
    });
    this._webviewViewProviders.set(viewType, registration);
  }
  $unregisterWebviewViewProvider(viewType) {
    if (!this._webviewViewProviders.has(viewType)) {
      throw new Error(`No view provider for ${viewType} registered`);
    }
    this._webviewViewProviders.deleteAndDispose(viewType);
  }
  getWebviewView(handle) {
    const webviewView = this._webviewViews.get(handle);
    if (!webviewView) {
      throw new Error("unknown webview view");
    }
    return webviewView;
  }
};
MainThreadWebviewsViews = __decorateClass([
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IWebviewViewService)
], MainThreadWebviewsViews);
export {
  MainThreadWebviewsViews
};
