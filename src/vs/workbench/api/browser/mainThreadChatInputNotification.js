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
import { ChatInputNotificationActionKind, IChatInputNotificationService } from "../../contrib/chat/browser/widget/input/chatInputNotificationService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainContext } from "../common/extHost.protocol.js";
let MainThreadChatInputNotification = class extends Disposable {
  constructor(_extHostContext, _chatInputNotificationService) {
    super();
    this._chatInputNotificationService = _chatInputNotificationService;
  }
  $setNotification(notification) {
    this._chatInputNotificationService.setNotification({
      id: notification.id,
      severity: notification.severity,
      message: notification.message,
      description: notification.description,
      actions: notification.actions.map((action) => ({ ...action, kind: ChatInputNotificationActionKind.Command })),
      dismissible: notification.dismissible,
      autoDismissOnMessage: notification.autoDismissOnMessage
    });
  }
  $disposeNotification(id) {
    this._chatInputNotificationService.deleteNotification(id);
  }
};
MainThreadChatInputNotification = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatInputNotification),
  __decorateParam(1, IChatInputNotificationService)
], MainThreadChatInputNotification);
export {
  MainThreadChatInputNotification
};
