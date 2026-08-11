import { localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from "../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsSessionsWindowContext } from "../../../../../workbench/common/contextkeys.js";
import { exportAgentHostDebugLogs } from "../../../../../workbench/contrib/chat/browser/actions/exportAgentHostDebugLogsAction.js";
import { ChatContextKeys } from "../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { ISessionsManagementService } from "../../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { BaseAgentHostSessionsProvider } from "./baseAgentHostSessionsProvider.js";
class ExportAgentHostDebugLogsAction extends Action2 {
  static {
    this.ID = "agentHost.exportDebugLogs";
  }
  constructor() {
    super({
      id: ExportAgentHostDebugLogsAction.ID,
      title: localize2("exportAgentHostDebugLogs", "Export Agent Host Debug Logs..."),
      f1: true,
      category: Categories.Developer,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.or(IsSessionsWindowContext, AGENT_HOST_ENABLED_CONTEXT_KEY)
      )
    });
  }
  async run(accessor) {
    const sessionsManagementService = accessor.get(ISessionsManagementService);
    const sessionsService = accessor.get(ISessionsService);
    const sessionsProvidersService = accessor.get(ISessionsProvidersService);
    const activeSession = sessionsService.activeSession.get();
    const activeAgentHostSession = isAgentHostSession(activeSession, sessionsProvidersService) ? activeSession : void 0;
    const sessionForEvents = activeAgentHostSession ?? getMostRecentAgentHostSession(sessionsManagementService.getSessions(), sessionsProvidersService);
    const activeSessionContext = sessionForEvents ? {
      resource: sessionForEvents.resource,
      title: activeAgentHostSession?.title.get(),
      isLocal: sessionForEvents.resource.scheme.startsWith("agent-host-")
    } : void 0;
    await exportAgentHostDebugLogs(accessor, activeSessionContext);
  }
}
function isAgentHostSession(session, sessionsProvidersService) {
  return !!session && sessionsProvidersService.getProvider(session.providerId) instanceof BaseAgentHostSessionsProvider;
}
function getMostRecentAgentHostSession(sessions, sessionsProvidersService) {
  let mostRecent;
  for (const session of sessions) {
    if (!isAgentHostSession(session, sessionsProvidersService)) {
      continue;
    }
    if (!mostRecent || session.updatedAt.get().getTime() > mostRecent.updatedAt.get().getTime()) {
      mostRecent = session;
    }
  }
  return mostRecent;
}
registerAction2(ExportAgentHostDebugLogsAction);
export {
  ExportAgentHostDebugLogsAction
};
