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
import { IChatEntitlementService } from "../../services/chat/common/chatEntitlementService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainContext } from "../common/extHost.protocol.js";
let MainThreadChatQuota = class extends Disposable {
  constructor(extHostContext, _chatEntitlementService) {
    super();
    this._chatEntitlementService = _chatEntitlementService;
  }
  $updateQuotas(quotas) {
    this._chatEntitlementService.acceptQuotas({ ...this._chatEntitlementService.quotas, ...quotas });
  }
};
MainThreadChatQuota = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatQuota),
  __decorateParam(1, IChatEntitlementService)
], MainThreadChatQuota);
export {
  MainThreadChatQuota
};
