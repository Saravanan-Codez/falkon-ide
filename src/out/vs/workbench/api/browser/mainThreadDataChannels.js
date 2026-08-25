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
import { IDataChannelService } from "../../../platform/dataChannel/common/dataChannel.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadDataChannels = class extends Disposable {
  constructor(extHostContext, _dataChannelService) {
    super();
    this._dataChannelService = _dataChannelService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDataChannels);
    this._register(this._dataChannelService.onDidSendData((e) => {
      this._proxy.$onDidReceiveData(e.channelId, e.data);
    }));
  }
};
MainThreadDataChannels = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDataChannels),
  __decorateParam(1, IDataChannelService)
], MainThreadDataChannels);
export {
  MainThreadDataChannels
};
