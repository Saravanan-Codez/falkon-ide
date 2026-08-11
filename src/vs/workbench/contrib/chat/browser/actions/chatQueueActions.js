import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { ChatRequestQueueKind, IChatService } from "../../common/chatService/chatService.js";
import { IChatSideChatService } from "../../common/chatSideChatService.js";
import { ChatConfiguration } from "../../common/constants.js";
import { isRequestVM } from "../../common/model/chatViewModel.js";
import { IChatWidgetService } from "../chat.js";
import { captureSideChatSelection } from "../chatSideChat.js";
import { CHAT_CATEGORY } from "./chatActions.js";
const editingQueue = ChatContextKeys.editingRequestType.isEqualTo(ChatContextKeys.EditingRequestType.Queue);
const editingSteer = ChatContextKeys.editingRequestType.isEqualTo(ChatContextKeys.EditingRequestType.Steer);
const editingQueueOrSteer = ContextKeyExpr.or(editingQueue, editingSteer);
const queuingActionsPresent = ContextKeyExpr.and(
  ContextKeyExpr.or(ChatContextKeys.requestInProgress, editingQueueOrSteer),
  ChatContextKeys.editingRequestType.notEqualsTo(ChatContextKeys.EditingRequestType.Sent)
);
const steerIsDefault = ContextKeyExpr.equals(`config.${ChatConfiguration.RequestQueueingDefaultAction}`, "steer");
const queueIsDefault = steerIsDefault.negate();
const effectiveDefaultIsQueue = ContextKeyExpr.or(
  ContextKeyExpr.and(queueIsDefault, editingQueueOrSteer.negate()),
  editingQueue
);
const effectiveDefaultIsSteer = ContextKeyExpr.or(
  ContextKeyExpr.and(steerIsDefault, editingQueueOrSteer.negate()),
  editingSteer
);
function isRemovePendingRequestContext(context) {
  return !!context && typeof context === "object" && "sessionResource" in context && "pendingRequestId" in context && URI.isUri(context.sessionResource) && typeof context.pendingRequestId === "string";
}
class ChatQueueMessageAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.queueMessage";
  }
  constructor() {
    super({
      id: ChatQueueMessageAction.ID,
      title: localize2("chat.queueMessage", "Add to Queue"),
      tooltip: localize("chat.queueMessage.tooltip", "Queue this message to send after the current request completes"),
      icon: Codicon.add,
      f1: false,
      category: CHAT_CATEGORY,
      precondition: ChatContextKeys.inputHasText,
      keybinding: [{
        when: ContextKeyExpr.and(
          ChatContextKeys.inChatInput,
          effectiveDefaultIsSteer
        ),
        primary: KeyMod.Alt | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib + 1
      }, {
        when: ContextKeyExpr.and(
          ChatContextKeys.inChatInput,
          queuingActionsPresent,
          effectiveDefaultIsQueue
        ),
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib + 1
      }]
    });
  }
  run(accessor, ...args) {
    const widgetService = accessor.get(IChatWidgetService);
    const widget = widgetService.lastFocusedWidget;
    if (!widget?.viewModel) {
      return;
    }
    const inputValue = widget.getInput();
    if (!inputValue.trim()) {
      return;
    }
    if (!widget.viewModel.model.requestInProgress.get()) {
      widget.acceptInput();
      return;
    }
    widget.acceptInput(void 0, { queue: ChatRequestQueueKind.Queued });
  }
}
class ChatSteerWithMessageAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.steerWithMessage";
  }
  constructor() {
    super({
      id: ChatSteerWithMessageAction.ID,
      title: localize2("chat.steerWithMessage", "Steer with Message"),
      tooltip: localize("chat.steerWithMessage.tooltip", "Send this message at the next opportunity, signaling the current request to yield"),
      icon: Codicon.newLine,
      f1: false,
      category: CHAT_CATEGORY,
      precondition: ChatContextKeys.inputHasText,
      keybinding: [{
        when: ContextKeyExpr.and(
          ChatContextKeys.inChatInput,
          queuingActionsPresent,
          effectiveDefaultIsSteer
        ),
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib + 1
      }, {
        when: ContextKeyExpr.and(
          ChatContextKeys.inChatInput,
          effectiveDefaultIsQueue
        ),
        primary: KeyMod.Alt | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib + 1
      }]
    });
  }
  run(accessor, ...args) {
    const widgetService = accessor.get(IChatWidgetService);
    const widget = widgetService.lastFocusedWidget;
    if (!widget?.viewModel) {
      return;
    }
    const inputValue = widget.getInput();
    if (!inputValue.trim()) {
      return;
    }
    if (!widget.viewModel.model.requestInProgress.get()) {
      widget.acceptInput();
      return;
    }
    widget.acceptInput(void 0, { queue: ChatRequestQueueKind.Steering });
  }
}
class ChatAskInSideChatAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.askInSideChat";
  }
  constructor() {
    super({
      id: ChatAskInSideChatAction.ID,
      title: localize2("chat.askInSideChat", "Ask in Side Chat"),
      tooltip: localize("chat.askInSideChat.tooltip", "Ask this question in a side chat without adding it to this conversation"),
      icon: Codicon.commentDiscussion,
      f1: false,
      category: CHAT_CATEGORY,
      precondition: ChatContextKeys.inputHasText
    });
  }
  async run(accessor, ...args) {
    const widgetService = accessor.get(IChatWidgetService);
    const sideChatService = accessor.get(IChatSideChatService);
    const notificationService = accessor.get(INotificationService);
    const logService = accessor.get(ILogService);
    const widget = widgetService.lastFocusedWidget;
    const sessionResource = widget?.viewModel?.model.sessionResource;
    if (!widget || !sessionResource) {
      return;
    }
    const query = widget.getInput().trim();
    if (!query) {
      return;
    }
    if (!sideChatService.canAskInSideChat(sessionResource)) {
      notificationService.warn(localize("chat.askInSideChat.unsupported", "This conversation does not support side chats."));
      return;
    }
    const selection = captureSideChatSelection(widget);
    widget.setInput("");
    try {
      await sideChatService.askInSideChat(sessionResource, query, selection);
    } catch (err) {
      logService.error("[askInSideChat] Failed to create side chat", err);
      notificationService.error(localize("chat.askInSideChat.createFailed", "The side chat could not be created."));
      if (!widget.getInput()) {
        widget.setInput(query);
      }
    }
  }
}
class ChatRemovePendingRequestAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.removePendingRequest";
  }
  constructor() {
    super({
      id: ChatRemovePendingRequestAction.ID,
      title: localize2("chat.removePendingRequest", "Remove from Queue"),
      icon: Codicon.close,
      f1: false,
      category: CHAT_CATEGORY,
      menu: [{
        id: MenuId.ChatMessageTitle,
        group: "navigation",
        order: 4,
        when: ContextKeyExpr.and(
          ChatContextKeys.isRequest,
          ChatContextKeys.isPendingRequest
        )
      }]
    });
  }
  run(accessor, ...args) {
    const chatService = accessor.get(IChatService);
    const [context] = args;
    if (isRequestVM(context) && context.pendingKind) {
      chatService.removePendingRequest(context.sessionResource, context.id);
      return;
    }
    if (isRemovePendingRequestContext(context)) {
      chatService.removePendingRequest(context.sessionResource, context.pendingRequestId);
      return;
    }
  }
}
class ChatEditPendingRequestAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.editPendingRequest";
  }
  constructor() {
    super({
      id: ChatEditPendingRequestAction.ID,
      title: localize2("chat.editPendingRequest", "Edit"),
      icon: Codicon.edit,
      f1: false,
      category: CHAT_CATEGORY,
      menu: [{
        id: MenuId.ChatMessageTitle,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.and(
          ChatContextKeys.isRequest,
          ChatContextKeys.isPendingRequest,
          ContextKeyExpr.notEquals(`config.${ChatConfiguration.EditRequests}`, "hover"),
          ContextKeyExpr.notEquals(`config.${ChatConfiguration.EditRequests}`, "input")
        )
      }]
    });
  }
  run(accessor, ...args) {
    const widgetService = accessor.get(IChatWidgetService);
    const [context] = args;
    if (!isRequestVM(context) || !context.pendingKind) {
      return;
    }
    const widget = widgetService.getWidgetBySessionResource(context.sessionResource);
    widget?.startEditing(context.id);
  }
}
class ChatSendPendingImmediatelyAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.sendPendingImmediately";
  }
  constructor() {
    super({
      id: ChatSendPendingImmediatelyAction.ID,
      title: localize2("chat.sendPendingImmediately", "Send Immediately"),
      icon: Codicon.newLine,
      f1: false,
      category: CHAT_CATEGORY,
      menu: [{
        id: MenuId.ChatMessageTitle,
        group: "navigation",
        order: 3,
        when: ContextKeyExpr.and(
          ChatContextKeys.isRequest,
          ChatContextKeys.isPendingRequest
        )
      }]
    });
  }
  async run(accessor, ...args) {
    const chatService = accessor.get(IChatService);
    const [context] = args;
    if (!isRequestVM(context) || !context.pendingKind) {
      return;
    }
    await chatService.sendPendingRequestImmediately(context.sessionResource, context.id);
  }
}
class ChatRemoveAllPendingRequestsAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.removeAllPendingRequests";
  }
  constructor() {
    super({
      id: ChatRemoveAllPendingRequestsAction.ID,
      title: localize2("chat.removeAllPendingRequests", "Remove All Queued"),
      icon: Codicon.clearAll,
      f1: false,
      category: CHAT_CATEGORY,
      menu: [{
        id: MenuId.ChatContext,
        group: "navigation",
        order: 3,
        when: ChatContextKeys.hasPendingRequests
      }]
    });
  }
  run(accessor, ...args) {
    const chatService = accessor.get(IChatService);
    const widgetService = accessor.get(IChatWidgetService);
    const [context] = args;
    const widget = isRequestVM(context) && widgetService.getWidgetBySessionResource(context.sessionResource) || widgetService.lastFocusedWidget;
    const model = widget?.viewModel?.model;
    if (!model) {
      return;
    }
    for (const pendingRequest of [...model.getPendingRequests()]) {
      chatService.removePendingRequest(model.sessionResource, pendingRequest.request.id);
    }
  }
}
function registerChatQueueActions() {
  registerAction2(ChatQueueMessageAction);
  registerAction2(ChatSteerWithMessageAction);
  registerAction2(ChatAskInSideChatAction);
  registerAction2(ChatRemovePendingRequestAction);
  registerAction2(ChatEditPendingRequestAction);
  registerAction2(ChatSendPendingImmediatelyAction);
  registerAction2(ChatRemoveAllPendingRequestsAction);
  MenuRegistry.appendMenuItem(MenuId.ChatExecuteQueue, {
    command: { id: ChatQueueMessageAction.ID, title: localize2("chat.queueMessage", "Add to Queue"), icon: Codicon.add },
    group: "navigation",
    order: 1
  });
  MenuRegistry.appendMenuItem(MenuId.ChatExecuteQueue, {
    command: { id: ChatSteerWithMessageAction.ID, title: localize2("chat.steerWithMessage", "Steer with Message"), icon: Codicon.newLine },
    group: "navigation",
    order: 2
  });
  MenuRegistry.appendMenuItem(MenuId.ChatExecute, {
    submenu: MenuId.ChatExecuteQueue,
    title: localize2("chat.queueSubmenu", "Queue"),
    icon: Codicon.listOrdered,
    when: ContextKeyExpr.and(
      queuingActionsPresent,
      ChatContextKeys.inputHasText
    ),
    group: "navigation",
    order: 4
  });
}
export {
  ChatAskInSideChatAction,
  ChatEditPendingRequestAction,
  ChatQueueMessageAction,
  ChatRemoveAllPendingRequestsAction,
  ChatRemovePendingRequestAction,
  ChatSendPendingImmediatelyAction,
  ChatSteerWithMessageAction,
  registerChatQueueActions
};
