import { raceTimeout } from "../../../../../base/common/async.js";
import { registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ForkConversationAction } from "../../../../../workbench/contrib/chat/browser/actions/chatForkActions.js";
import { IChatService } from "../../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { isAgentHostProviderId } from "../../../../common/agentHostSessionsProvider.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { ISessionsManagementService } from "../../../../services/sessions/common/sessionsManagement.js";
registerAction2(class extends ForkConversationAction {
  async _tryForkAsChat(instantiationService, sourceSessionResource, request) {
    return instantiationService.invokeFunction(async (accessor) => {
      const sessionsManagementService = accessor.get(ISessionsManagementService);
      const sessionsService = accessor.get(ISessionsService);
      const chatService = accessor.get(IChatService);
      const logService = accessor.get(ILogService);
      const session = sessionsManagementService.getSession(sourceSessionResource) ?? sessionsManagementService.getSessions().find((s) => s.chats.get().some((c) => c.resource.toString() === sourceSessionResource.toString()));
      if (!session?.capabilities.get().supportsMultipleChats || !isAgentHostProviderId(session.providerId)) {
        return false;
      }
      const requests = chatService.getSession(sourceSessionResource)?.getRequests();
      let turnId;
      if (request) {
        const requestIdx = requests?.findIndex((r) => r.id === request.id) ?? -1;
        if (requestIdx <= 0) {
          return false;
        }
        turnId = requests[requestIdx - 1].id;
      } else {
        turnId = requests?.at(-1)?.id;
      }
      if (!turnId) {
        return false;
      }
      const newChat = await sessionsManagementService.forkChatInSession(session, sourceSessionResource, turnId);
      await sessionsService.openChat(session, newChat.resource);
      logService.trace(`[AgentHostSessions] Forked conversation into new chat ${newChat.resource.toString()} in session ${session.sessionId}`);
      return true;
    });
  }
  _openForkedSession(instantiationService, parentSessionResource, forkedSessionResource) {
    return instantiationService.invokeFunction(async (accessor) => {
      const sessionsManagementService = accessor.get(ISessionsManagementService);
      const sessionsService = accessor.get(ISessionsService);
      const logService = accessor.get(ILogService);
      const parentSession = sessionsManagementService.getSession(parentSessionResource);
      if (!parentSession) {
        logService.error(`Parent session ${parentSessionResource.toString()} not found when forking conversation`);
        return super._openForkedSession(instantiationService, parentSessionResource, forkedSessionResource);
      }
      if (!sessionsManagementService.getSession(forkedSessionResource)) {
        let listener;
        const appeared = await raceTimeout(new Promise((resolve) => {
          listener = sessionsManagementService.onDidChangeSessions(() => {
            if (sessionsManagementService.getSession(forkedSessionResource)) {
              resolve(true);
            }
          });
        }), 3e4);
        listener?.dispose();
        if (!appeared) {
          logService.error(`Forked session ${forkedSessionResource.toString()} did not appear within timeout`);
          return;
        }
      }
      await sessionsService.openSession(forkedSessionResource);
    });
  }
});
