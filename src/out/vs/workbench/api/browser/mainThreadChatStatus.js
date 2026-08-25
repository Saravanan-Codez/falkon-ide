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
import { IChatStatusItemService } from "../../contrib/chat/browser/chatStatus/chatStatusItemService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainContext } from "../common/extHost.protocol.js";
let MainThreadChatStatus = class extends Disposable {
  constructor(_extHostContext, _chatStatusItemService) {
    super();
    this._chatStatusItemService = _chatStatusItemService;
  }
  $setEntry(id, entry) {
    this._chatStatusItemService.setOrUpdateEntry({
      id,
      label: entry.title,
      description: entry.description,
      detail: entry.detail,
      tooltip: entry.tooltip
    });
  }
  $disposeEntry(id) {
    this._chatStatusItemService.deleteEntry(id);
  }
};
MainThreadChatStatus = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatStatus),
  __decorateParam(1, IChatStatusItemService)
], MainThreadChatStatus);
export {
  MainThreadChatStatus
};
