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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { MenuId, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { parseChatUri, parseSubagentSessionUri } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID } from "../../../../../workbench/contrib/chat/common/constants.js";
import { OpenSubagentChatActionViewItem, shouldShowSubagentModel, subagentChatOpenerRegistry } from "../../../../../workbench/contrib/chat/browser/widget/chatContentParts/chatSubagentOpenChat.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
function chatIdFromResource(resource) {
  const fromChatUri = parseChatUri(resource)?.chatId;
  if (fromChatUri) {
    return fromChatUri;
  }
  const fromSessionUri = parseSubagentSessionUri(resource);
  return fromSessionUri ? `subagent/${fromSessionUri.toolCallId}` : void 0;
}
function matchesResource(chat, resource, chatId) {
  return chat.resource.toString() === resource || !!chatId && chat.resource.fragment === chatId;
}
function ownerSessionPath(resource) {
  const fromChatUri = parseChatUri(resource)?.session;
  if (fromChatUri) {
    try {
      return URI.parse(fromChatUri).path;
    } catch {
      return void 0;
    }
  }
  return parseSubagentSessionUri(resource)?.parentSession.path;
}
function findSubagentChat(sessionsService, resource, reader) {
  const chatId = chatIdFromResource(resource);
  const ownerPath = ownerSessionPath(resource);
  const allSessions = [sessionsService.activeSession.read(reader), ...sessionsService.visibleSessions.read(reader)].filter((session) => !!session);
  const candidates = ownerPath ? allSessions.filter((session) => session.resource.path === ownerPath) : allSessions;
  for (const session of candidates) {
    const chat = session.chats.read(reader).find((candidate) => matchesResource(candidate, resource, chatId));
    if (chat) {
      return { session, chat };
    }
  }
  return void 0;
}
let OpenSubagentChatActionViewItemContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.openSubagentChatActionViewItem";
  }
  constructor(actionViewItemService, sessionsService, logService) {
    super();
    this._register(subagentChatOpenerRegistry.register({
      open: async (context) => {
        const resource = context.chatResource;
        const match = findSubagentChat(sessionsService, resource);
        if (match) {
          await sessionsService.openChat(match.session, match.chat.resource);
          return true;
        }
        const active = sessionsService.activeSession.get();
        const available = active?.chats.get().map((chat) => chat.resource.toString()).join(", ") ?? "(none)";
        logService.warn(`[Sessions] Cannot open subagent chat for resource '${resource}' (chatId='${chatIdFromResource(resource)}'). Available chats: ${available}`);
        return true;
      }
    }));
    const onDidRegister = this._register(new Emitter());
    this._register(actionViewItemService.register(MenuId.ChatSubagentContent, CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID, (action, options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      const viewItem = instantiationService.createInstance(OpenSubagentChatActionViewItem, void 0, action, options, false);
      viewItem.trackEnabled((context, update) => autorun((reader) => update(!!findSubagentChat(sessionsService, context.chatResource, reader))));
      return viewItem;
    }, onDidRegister.event));
    onDidRegister.fire();
  }
};
OpenSubagentChatActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ILogService)
], OpenSubagentChatActionViewItemContribution);
registerWorkbenchContribution2(OpenSubagentChatActionViewItemContribution.ID, OpenSubagentChatActionViewItemContribution, WorkbenchPhase.BlockStartup);
export {
  OpenSubagentChatActionViewItem,
  shouldShowSubagentModel
};
