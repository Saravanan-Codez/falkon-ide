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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ChatProgressSubPart } from "./chatProgressContentPart.js";
let ChatSystemNotificationContentPart = class extends Disposable {
  constructor(notification, renderer, instantiationService) {
    super();
    this.notification = notification;
    const rendered = this._register(renderer.render(notification.content));
    this.domNode = this._register(instantiationService.createInstance(ChatProgressSubPart, rendered.element, Codicon.check, void 0)).domNode;
  }
  hasSameContent(other) {
    return other.kind === "systemNotification" && other.content.value === this.notification.content.value;
  }
};
ChatSystemNotificationContentPart = __decorateClass([
  __decorateParam(2, IInstantiationService)
], ChatSystemNotificationContentPart);
export {
  ChatSystemNotificationContentPart
};
