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
import { DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { isEqual } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { IAgentEditorCommentsBridge } from "../../services/agentEditorComments/common/agentEditorComments.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadAgentEditorComments = class {
  constructor(extHostContext, _bridge) {
    this._bridge = _bridge;
    this._resources = /* @__PURE__ */ new Map();
    this._disposables = new DisposableMap();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostAgentEditorComments);
  }
  async $createAgentEditorComments(handle, uri) {
    const resource = URI.revive(uri);
    this._resources.set(handle, resource);
    const store = new DisposableStore();
    store.add(this._bridge.onDidChangeComments(() => this._sendComments(handle)));
    store.add(this._bridge.onDidRevealComment((event) => {
      if (isEqual(event.resource, resource)) {
        this._proxy.$revealAgentEditorComment(handle, event.id);
      }
    }));
    this._disposables.set(handle, store);
    this._sendComments(handle);
  }
  async $addComment(handle, range, body) {
    const resource = this._resources.get(handle);
    if (!resource) {
      return;
    }
    this._bridge.addComment(resource, range, body);
  }
  async $deleteComment(handle, id) {
    const resource = this._resources.get(handle);
    if (!resource) {
      return;
    }
    this._bridge.deleteComment(resource, id);
  }
  async $disposeAgentEditorComments(handle) {
    this._resources.delete(handle);
    this._disposables.deleteAndDispose(handle);
  }
  _sendComments(handle) {
    const resource = this._resources.get(handle);
    if (!resource) {
      return;
    }
    const comments = this._bridge.getComments(resource).map((comment) => ({ id: comment.id, range: comment.range, body: comment.body }));
    this._proxy.$acceptAgentEditorComments(handle, comments, this._bridge.acceptsComments(resource));
  }
  dispose() {
    this._disposables.dispose();
    this._resources.clear();
  }
};
MainThreadAgentEditorComments = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadAgentEditorComments),
  __decorateParam(1, IAgentEditorCommentsBridge)
], MainThreadAgentEditorComments);
export {
  MainThreadAgentEditorComments
};
