import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID } from "../../../../workbench/contrib/chat/browser/agentSessions/agentSessions.js";
import { LOCAL_AGENT_HOST_PROVIDER_ID } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
CommandsRegistry.registerCommand(CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID, async (accessor, request) => {
  const logService = accessor.get(ILogService);
  if (!request?.type || !request.prompt) {
    logService.warn("[Sessions] Agent host delegation skipped: missing request payload");
    return;
  }
  const sessionsService = accessor.get(ISessionsService);
  const sessionsManagementService = accessor.get(ISessionsManagementService);
  const sourceSession = sessionsService.activeSession.get();
  if (!sourceSession) {
    logService.warn("[Sessions] Agent host delegation skipped: no active session");
    return;
  }
  const folderUri = sourceSession.workspace.get()?.folders.at(0)?.root;
  if (!folderUri) {
    logService.warn("[Sessions] Agent host delegation skipped: no active session workspace folder");
    return;
  }
  const isLocalAgentHostTarget = request.type.startsWith("agent-host-");
  const sessionTypeId = isLocalAgentHostTarget ? request.type.slice("agent-host-".length) : request.type;
  const providerId = isLocalAgentHostTarget ? LOCAL_AGENT_HOST_PROVIDER_ID : void 0;
  try {
    const session = sessionsManagementService.createNewSession(folderUri, { providerId, sessionTypeId });
    sessionsService.insertAt(session, sourceSession.sessionId, "right", true);
    await sessionsManagementService.sendNewChatRequest(session, { query: request.prompt, attachedContext: request.attachedContext });
  } catch (e) {
    logService.error(`[Sessions] Agent host delegation to '${sessionTypeId}' failed`, e);
    throw e;
  }
});
