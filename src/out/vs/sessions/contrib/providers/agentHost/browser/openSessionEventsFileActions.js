import { localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { openCopilotCliStateFile } from "../../../../../workbench/contrib/chat/browser/actions/openCopilotCliStateFileAction.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { IsAgentHostSession } from "./agentHostSkillButtons.js";
class OpenSessionEventsFileAction extends Action2 {
  static {
    this.ID = "agentHost.openSessionEventsFile";
  }
  constructor() {
    super({
      id: OpenSessionEventsFileAction.ID,
      title: localize2("openSessionEventsFile", "Open Copilot CLI State File"),
      f1: true,
      category: Categories.Developer,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, IsAgentHostSession)
    });
  }
  async run(accessor) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionResource = sessionsService.activeSession.get()?.resource;
    await openCopilotCliStateFile(accessor, sessionResource);
  }
}
export {
  OpenSessionEventsFileAction
};
