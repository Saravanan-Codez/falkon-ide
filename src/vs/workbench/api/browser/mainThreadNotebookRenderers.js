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
import { Disposable } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { INotebookRendererMessagingService } from "../../contrib/notebook/common/notebookRendererMessagingService.js";
let MainThreadNotebookRenderers = class extends Disposable {
  constructor(extHostContext, messaging) {
    super();
    this.messaging = messaging;
    this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebookRenderers);
    this._register(messaging.onShouldPostMessage((e) => {
      this.proxy.$postRendererMessage(e.editorId, e.rendererId, e.message);
    }));
  }
  $postMessage(editorId, rendererId, message) {
    return this.messaging.receiveMessage(editorId, rendererId, message);
  }
};
MainThreadNotebookRenderers = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadNotebookRenderers),
  __decorateParam(1, INotebookRendererMessagingService)
], MainThreadNotebookRenderers);
export {
  MainThreadNotebookRenderers
};
