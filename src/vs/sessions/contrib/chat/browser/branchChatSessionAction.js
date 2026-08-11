import { localize2 } from "../../../../nls.js";
import { Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { isRequestVM, isResponseVM } from "../../../../workbench/contrib/chat/common/model/chatViewModel.js";
import { revive } from "../../../../base/common/marshalling.js";
import { IChatService } from "../../../../workbench/contrib/chat/common/chatService/chatService.js";
const ACTION_ID_BRANCH_CHAT_SESSION = "workbench.action.chat.branchChatSession";
class BranchChatSessionAction extends Action2 {
  static {
    this.ID = ACTION_ID_BRANCH_CHAT_SESSION;
  }
  constructor() {
    super({
      id: BranchChatSessionAction.ID,
      title: localize2("branchChatSession", "Branch Chat"),
      tooltip: localize2("branchChatSessionTooltip", "Branch to new session"),
      icon: Codicon.reply,
      f1: false,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ChatContextKeys.requestInProgress.negate()
      ),
      menu: [{
        id: MenuId.ChatMessageCheckpoint,
        group: "navigation",
        order: 3,
        when: ContextKeyExpr.and(
          ChatContextKeys.isRequest,
          ChatContextKeys.lockedToCodingAgent.negate(),
          ContextKeyExpr.false()
          // TODO: add support again for multi view scenario
        )
      }]
    });
  }
  async run(accessor, ...args) {
    const item = args[0];
    const widgetService = accessor.get(IChatWidgetService);
    const chatService = accessor.get(IChatService);
    if (!item || !isRequestVM(item) && !isResponseVM(item)) {
      return;
    }
    const widget = widgetService.getWidgetBySessionResource(item.sessionResource);
    if (!widget || !widget.viewModel) {
      return;
    }
    const chatModel = widget.viewModel.model;
    if (!chatModel) {
      return;
    }
    const checkpointRequestId = isRequestVM(item) ? item.id : item.requestId;
    const serializedData = revive(structuredClone(chatModel.toJSON()));
    serializedData.sessionId = generateUuid();
    delete serializedData.customTitle;
    const checkpointIndex = serializedData.requests.findIndex((r) => r.requestId === checkpointRequestId);
    if (checkpointIndex === -1) {
      return;
    }
    serializedData.requests = serializedData.requests.slice(0, checkpointIndex);
    for (const request of serializedData.requests) {
      delete request.shouldBeRemovedOnSend;
      delete request.isHidden;
    }
    if (serializedData.requests.length === 0) {
      return;
    }
    const modelRef = chatService.loadSessionFromData(serializedData);
    throw new Error("Branching chat sessions is not yet supported." + modelRef.object.title);
  }
}
export {
  ACTION_ID_BRANCH_CHAT_SESSION,
  BranchChatSessionAction
};
