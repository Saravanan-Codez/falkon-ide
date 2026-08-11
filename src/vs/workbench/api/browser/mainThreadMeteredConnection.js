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
import { IMeteredConnectionService } from "../../../platform/meteredConnection/common/meteredConnection.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadMeteredConnection = class extends Disposable {
  constructor(extHostContext, meteredConnectionService) {
    super();
    this.meteredConnectionService = meteredConnectionService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostMeteredConnection);
    this._proxy.$initializeIsConnectionMetered(this.meteredConnectionService.isConnectionMetered);
    this._register(this.meteredConnectionService.onDidChangeIsConnectionMetered((isMetered) => {
      this._proxy.$onDidChangeIsConnectionMetered(isMetered);
    }));
  }
};
MainThreadMeteredConnection = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadMeteredConnection),
  __decorateParam(1, IMeteredConnectionService)
], MainThreadMeteredConnection);
export {
  MainThreadMeteredConnection
};
