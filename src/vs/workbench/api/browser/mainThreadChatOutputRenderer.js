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
import { VSBuffer } from "../../../base/common/buffer.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IChatOutputRendererService } from "../../contrib/chat/browser/chatOutputItemRenderer.js";
import { ExtHostContext } from "../common/extHost.protocol.js";
let MainThreadChatOutputRenderer = class extends Disposable {
  constructor(extHostContext, _mainThreadWebview, _rendererService, _logService) {
    super();
    this._mainThreadWebview = _mainThreadWebview;
    this._rendererService = _rendererService;
    this._logService = _logService;
    this._webviewHandlePool = 0;
    this.registeredRenderers = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatOutputRenderer);
  }
  dispose() {
    super.dispose();
    this.registeredRenderers.forEach((disposable) => disposable.dispose());
    this.registeredRenderers.clear();
  }
  $registerChatOutputRenderer(viewType, extensionId, extensionLocation) {
    const existingRegistration = this.registeredRenderers.get(viewType);
    if (existingRegistration) {
      this._logService.warn(`Re-registering chat output renderer for view type '${viewType}' from extension '${extensionId.value}'.`);
      existingRegistration.dispose();
    }
    const disposable = this._rendererService.registerRenderer(viewType, {
      renderOutputPart: async (mime, data, webview, context, token) => {
        const webviewHandle = `chat-output-${++this._webviewHandlePool}`;
        this._mainThreadWebview.addWebview(webviewHandle, webview, {
          serializeBuffersForPostMessage: true
        });
        return this._proxy.$renderChatOutput(viewType, mime, VSBuffer.wrap(data), webviewHandle, context, token);
      }
    }, {
      extension: { id: extensionId, location: URI.revive(extensionLocation) }
    });
    this.registeredRenderers.set(viewType, disposable);
  }
  $unregisterChatOutputRenderer(viewType) {
    this.registeredRenderers.get(viewType)?.dispose();
    this.registeredRenderers.delete(viewType);
  }
};
MainThreadChatOutputRenderer = __decorateClass([
  __decorateParam(2, IChatOutputRendererService),
  __decorateParam(3, ILogService)
], MainThreadChatOutputRenderer);
export {
  MainThreadChatOutputRenderer
};
