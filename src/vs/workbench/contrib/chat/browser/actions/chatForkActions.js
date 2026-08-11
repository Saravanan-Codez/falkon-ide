import { CancellationToken, CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { revive } from "../../../../../base/common/marshalling.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IChatService, ResponseModelState } from "../../common/chatService/chatService.js";
import { isChatTreeItem, isRequestVM, isResponseVM } from "../../common/model/chatViewModel.js";
import { IChatSessionsService } from "../../common/chatSessionsService.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { CHAT_CATEGORY } from "./chatActions.js";
import { ChatViewPaneTarget, IChatWidgetService } from "../chat.js";
const ForkConversationActionId = "workbench.action.chat.forkConversation";
class ForkConversationAction extends Action2 {
  constructor() {
    super({
      id: ForkConversationActionId,
      title: localize2("chat.forkConversation.label", "Fork Conversation"),
      tooltip: localize2("chat.forkConversation.tooltip", "Fork conversation from this point"),
      f1: false,
      category: CHAT_CATEGORY,
      icon: Codicon.repoForked,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.readOnly.negate()),
      menu: [
        {
          id: MenuId.ChatMessageCheckpoint,
          group: "navigation",
          order: 3,
          when: ContextKeyExpr.and(
            ChatContextKeys.isRequest,
            ChatContextKeys.isFirstRequest.negate(),
            ContextKeyExpr.or(
              ContextKeyExpr.or(ChatContextKeys.lockedToCodingAgent.negate(), ChatContextKeyExprs.isAgentHostSession),
              ChatContextKeys.chatSessionSupportsFork
            ),
            ChatContextKeys.readOnly.negate()
          )
        }
      ]
    });
    this.pendingFork = /* @__PURE__ */ new Map();
  }
  async run(accessor, ...args) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const instantiationService = accessor.get(IInstantiationService);
    const chatService = accessor.get(IChatService);
    const chatSessionsService = accessor.get(IChatSessionsService);
    const forkedTitlePrefix = localize("chat.forked.titlePrefix", "Forked: ");
    if (URI.isUri(args[0])) {
      const sourceSessionResource = args[0];
      const contentProviderSchemes2 = chatSessionsService.getContentProviderSchemes();
      if (contentProviderSchemes2.includes(getChatSessionType(sourceSessionResource))) {
        if (await this._tryForkAsChat(instantiationService, sourceSessionResource, void 0)) {
          return;
        }
        return await this.forkContributedChatSession(sourceSessionResource, void 0, false, chatSessionsService, instantiationService);
      }
      const chatModel2 = chatService.getSession(sourceSessionResource);
      if (!chatModel2) {
        return;
      }
      const serializedData2 = chatModel2.toJSON();
      if (serializedData2.requests.length === 0) {
        return;
      }
      const cleanData = revive(JSON.parse(JSON.stringify(serializedData2)));
      cleanData.sessionId = generateUuid();
      const forkTimestamp = Date.now();
      cleanData.creationDate = forkTimestamp;
      cleanData.customTitle = chatModel2.title.startsWith(forkedTitlePrefix) ? chatModel2.title : localize("chat.forked.title", "Forked: {0}", chatModel2.title);
      for (const [index, req] of cleanData.requests.entries()) {
        req.shouldBeRemovedOnSend = void 0;
        req.isHidden = void 0;
        req.requestId = generateUuid();
        req.responseId = req.responseId ? generateUuid() : void 0;
        req.timestamp = forkTimestamp + index;
        if (req.response) {
          req.modelState = { value: ResponseModelState.Complete, completedAt: forkTimestamp + index };
        }
      }
      const modelRef2 = chatService.loadSessionFromData(cleanData, "ChatForkActions#forkCleanSession");
      const newSessionResource = modelRef2.object.sessionResource;
      setTimeout(async () => {
        try {
          await this._openForkedSession(instantiationService, chatModel2.sessionResource, newSessionResource);
        } finally {
          modelRef2.dispose();
        }
      }, 0);
      return;
    }
    const arg = args[0];
    let item = isChatTreeItem(arg) ? arg : isChatTreeItem(arg?.element) ? arg.element : isChatTreeItem(arg?.context) ? arg.context : isChatTreeItem(arg?.item) ? arg.item : void 0;
    const widget = item && chatWidgetService.getWidgetBySessionResource(item.sessionResource) || chatWidgetService.lastFocusedWidget;
    if (!isResponseVM(item) && !isRequestVM(item)) {
      item = widget?.getFocus();
    }
    if (!item) {
      return;
    }
    const sessionResource = widget?.viewModel?.sessionResource ?? (isChatTreeItem(item) ? item.sessionResource : void 0);
    if (!sessionResource) {
      return;
    }
    const targetRequestId = isRequestVM(item) ? item.id : isResponseVM(item) ? item.requestId : void 0;
    if (!targetRequestId) {
      return;
    }
    const contentProviderSchemes = chatSessionsService.getContentProviderSchemes();
    if (contentProviderSchemes.includes(getChatSessionType(sessionResource))) {
      const contributedSession = await chatSessionsService.getOrCreateChatSession(sessionResource, CancellationToken.None);
      let request = contributedSession.history.find((entry) => entry.type === "request" && entry.id === targetRequestId);
      if (!request) {
        const chatModel2 = chatService.getSession(sessionResource);
        const serializedData2 = chatModel2?.toJSON();
        for (const [, entry] of serializedData2?.requests.entries() ?? []) {
          if (entry.requestId === targetRequestId) {
            request = {
              id: entry.requestId,
              type: "request",
              prompt: typeof entry.message === "string" ? entry.message : entry.message.text,
              participant: entry.agent?.id ?? "",
              variableData: entry.variableData,
              modelId: entry.modelId
            };
            break;
          }
        }
      }
      if (await this._tryForkAsChat(instantiationService, sessionResource, request)) {
        return;
      }
      return await this.forkContributedChatSession(sessionResource, request, true, chatSessionsService, instantiationService);
    }
    const chatModel = chatService.getSession(sessionResource);
    if (!chatModel) {
      return;
    }
    const serializedData = chatModel.toJSON();
    const isRequestItem = isRequestVM(item);
    let targetIndex = -1;
    if (widget?.viewModel) {
      let requestIndex = -1;
      for (const entry of widget.viewModel.getItems()) {
        if (isRequestVM(entry)) {
          requestIndex += 1;
        }
        if (entry.id === item?.id) {
          targetIndex = isRequestVM(entry) ? Math.max(0, requestIndex - 1) : requestIndex;
          break;
        }
      }
    }
    if (targetIndex < 0) {
      const requestIndex = chatModel.getRequests().findIndex((r) => r.id === targetRequestId);
      targetIndex = isRequestItem ? Math.max(0, requestIndex - 1) : requestIndex;
    }
    if (targetIndex < 0) {
      return;
    }
    const forkedData = revive(JSON.parse(JSON.stringify({
      ...serializedData,
      requests: serializedData.requests.slice(0, targetIndex + 1)
    })));
    forkedData.sessionId = generateUuid();
    const forkedTimestamp = Date.now();
    forkedData.creationDate = forkedTimestamp;
    forkedData.customTitle = chatModel.title.startsWith(forkedTitlePrefix) ? chatModel.title : localize("chat.forked.title", "Forked: {0}", chatModel.title);
    for (const [index, req] of forkedData.requests.entries()) {
      req.shouldBeRemovedOnSend = void 0;
      req.isHidden = void 0;
      req.requestId = generateUuid();
      req.responseId = req.responseId ? generateUuid() : void 0;
      req.timestamp = forkedTimestamp + index;
      if (req.response) {
        req.modelState = { value: ResponseModelState.Complete, completedAt: forkedTimestamp + index };
      }
    }
    const modelRef = chatService.loadSessionFromData(forkedData, "ChatForkActions#forkSession");
    if (!modelRef) {
      return;
    }
    try {
      const newSessionResource = modelRef.object.sessionResource;
      await this._openForkedSession(instantiationService, chatModel.sessionResource, newSessionResource);
    } finally {
      modelRef.dispose();
    }
  }
  async _openForkedSession(instantiationService, parentSessionResource, forkedSessionResource) {
    await instantiationService.invokeFunction(async (accessor) => {
      const chatWidgetService = accessor.get(IChatWidgetService);
      await chatWidgetService.openSession(forkedSessionResource, ChatViewPaneTarget);
    });
  }
  /**
   * Hook for surfaces (the Agents window) that prefer to fork a multi-chat
   * session into a new peer chat in the same session rather than a brand-new
   * session. Returns `true` when it fully handled the fork; the default
   * implementation does nothing and returns `false`, so the standard
   * session-creating fork path runs.
   */
  async _tryForkAsChat(_instantiationService, _sourceSessionResource, _request) {
    return false;
  }
  async forkContributedChatSession(sourceSessionResource, request, openForkedSessionImmediately, chatSessionsService, instantiationService) {
    const pendingKey = `${sourceSessionResource.toString()}@${request?.id ?? "full"}`;
    const pending = this.pendingFork.get(pendingKey);
    if (pending) {
      return pending;
    }
    const forkPromise = (async () => {
      const cts = new CancellationTokenSource();
      try {
        const forkedItem = await chatSessionsService.forkChatSession(sourceSessionResource, request, cts.token);
        const open = () => this._openForkedSession(instantiationService, sourceSessionResource, forkedItem.resource);
        if (openForkedSessionImmediately) {
          await open();
        } else {
          setTimeout(open, 0);
        }
      } finally {
        cts.dispose();
      }
    })();
    this.pendingFork.set(pendingKey, forkPromise);
    try {
      await forkPromise;
    } finally {
      this.pendingFork.delete(pendingKey);
    }
  }
}
export {
  ForkConversationAction,
  ForkConversationActionId
};
