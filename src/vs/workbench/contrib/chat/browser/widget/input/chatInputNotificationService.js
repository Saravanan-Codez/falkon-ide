import { status } from "../../../../../../base/browser/ui/aria/aria.js";
import { renderAsPlaintext } from "../../../../../../base/browser/markdownRenderer.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
var ChatInputNotificationSeverity = /* @__PURE__ */ ((ChatInputNotificationSeverity2) => {
  ChatInputNotificationSeverity2[ChatInputNotificationSeverity2["Info"] = 0] = "Info";
  ChatInputNotificationSeverity2[ChatInputNotificationSeverity2["Warning"] = 1] = "Warning";
  ChatInputNotificationSeverity2[ChatInputNotificationSeverity2["Error"] = 2] = "Error";
  return ChatInputNotificationSeverity2;
})(ChatInputNotificationSeverity || {});
var ChatInputNotificationActionKind = /* @__PURE__ */ ((ChatInputNotificationActionKind2) => {
  ChatInputNotificationActionKind2["Command"] = "command";
  ChatInputNotificationActionKind2["OpenModelPicker"] = "openModelPicker";
  ChatInputNotificationActionKind2["SwitchToModel"] = "switchToModel";
  return ChatInputNotificationActionKind2;
})(ChatInputNotificationActionKind || {});
function isChatInputNotificationApplicableToSessionType(notification, sessionType) {
  return !notification.sessionTypes?.length || !!sessionType && notification.sessionTypes.includes(sessionType);
}
function isChatInputNotificationApplicableToSession(notification, sessionType, sessionResource) {
  return isChatInputNotificationApplicableToSessionType(notification, sessionType) && (!notification.sessionResources?.length || !!sessionResource && notification.sessionResources.some((resource) => isEqual(resource, sessionResource)));
}
const IChatInputNotificationService = createDecorator("chatInputNotificationService");
class ChatInputNotificationService extends Disposable {
  constructor() {
    super(...arguments);
    this._notifications = /* @__PURE__ */ new Map();
    this._dismissed = /* @__PURE__ */ new Set();
    /** Insertion order tracking — higher index = more recently set. */
    this._insertionOrder = /* @__PURE__ */ new Map();
    this._insertionCounter = 0;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidDismiss = this._register(new Emitter());
    this.onDidDismiss = this._onDidDismiss.event;
    /**
     * Last ARIA-announced signature per notification id. Lets us skip
     * re-announcing unchanged content (e.g. a notification re-pushed on every
     * quota tick, or the same notification rendered by several mounted chat
     * inputs) while still announcing when a notification's content changes.
     */
    this._announcedById = /* @__PURE__ */ new Map();
  }
  setNotification(notification) {
    this._notifications.set(notification.id, notification);
    this._dismissed.delete(notification.id);
    this._insertionOrder.set(notification.id, this._insertionCounter++);
    this._fireDidChange();
  }
  deleteNotification(id) {
    if (this._notifications.delete(id)) {
      this._dismissed.delete(id);
      this._insertionOrder.delete(id);
      this._announcedById.delete(id);
      this._fireDidChange();
    }
  }
  dismissNotification(id) {
    if (this._notifications.has(id) && !this._dismissed.has(id)) {
      this._dismissed.add(id);
      this._announcedById.delete(id);
      this._onDidDismiss.fire(id);
      this._fireDidChange();
    }
  }
  getActiveNotification(filter) {
    let best;
    let bestOrder = -1;
    for (const notification of this._notifications.values()) {
      if (this._dismissed.has(notification.id)) {
        continue;
      }
      if (filter && !filter(notification)) {
        continue;
      }
      const order = this._insertionOrder.get(notification.id) ?? 0;
      if (!best || notification.severity > best.severity || notification.severity === best.severity && order > bestOrder) {
        best = notification;
        bestOrder = order;
      }
    }
    return best;
  }
  handleMessageSent(context) {
    let changed = false;
    for (const notification of this._notifications.values()) {
      if (!notification.autoDismissOnMessage || this._dismissed.has(notification.id)) {
        continue;
      }
      if (context && !isChatInputNotificationApplicableToSession(notification, context.sessionType, context.sessionResource)) {
        continue;
      }
      this._dismissed.add(notification.id);
      changed = true;
    }
    if (changed) {
      this._fireDidChange();
    }
  }
  _fireDidChange() {
    this._onDidChange.fire();
  }
  announceRendered(notification) {
    if (!notification) {
      return;
    }
    const rawMessage = typeof notification.message === "string" ? notification.message : notification.message.value;
    const rawDescription = typeof notification.description === "string" ? notification.description : notification.description?.value ?? "";
    const signature = `${notification.id}\0${rawMessage}\0${rawDescription}`;
    if (this._announcedById.get(notification.id) === signature) {
      return;
    }
    this._announcedById.set(notification.id, signature);
    const message = renderAsPlaintext(notification.message);
    const description = notification.description ? renderAsPlaintext(notification.description) : "";
    const text = description ? `${message}. ${description}` : message;
    status(text);
  }
}
registerSingleton(IChatInputNotificationService, ChatInputNotificationService, InstantiationType.Delayed);
export {
  ChatInputNotificationActionKind,
  ChatInputNotificationSeverity,
  IChatInputNotificationService,
  isChatInputNotificationApplicableToSession,
  isChatInputNotificationApplicableToSessionType
};
