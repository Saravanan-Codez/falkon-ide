import { localize, localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2 } from "../../../../../platform/actions/common/actions.js";
import { agentHostAuthority } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { IRemoteAgentHostService } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IsSessionsWindowContext } from "../../../../common/contextkeys.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { IChatWidgetService } from "../chat.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { resolveEventsUri } from "../copilotCliEventsUri.js";
async function openCopilotCliStateFile(accessor, sessionResource) {
  const pathService = accessor.get(IPathService);
  const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
  const editorService = accessor.get(IEditorService);
  const notificationService = accessor.get(INotificationService);
  const userHome = pathService.userHome({ preferLocal: true });
  const result = resolveEventsUri(
    sessionResource,
    userHome,
    (authority) => remoteAgentHostService.connections.find((c) => agentHostAuthority(c.address) === authority)
  );
  switch (result.kind) {
    case "ok":
      await editorService.openEditor({ resource: result.resource });
      return;
    case "no-session":
      notificationService.info(localize("openSessionEventsFile.noSession", "No Copilot CLI session is active."));
      return;
    case "unsupported-scheme":
      notificationService.info(localize("openSessionEventsFile.unsupported", "The active chat session is not a Copilot CLI session."));
      return;
    case "remote-not-connected":
      notificationService.warn(localize("openSessionEventsFile.notConnected", "No active connection found for remote agent host '{0}'.", result.authority));
      return;
    case "remote-no-home":
      notificationService.warn(localize("openSessionEventsFile.noHome", "Remote agent host '{0}' did not report a home directory.", result.authority));
      return;
  }
}
class OpenCopilotCliStateFileAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openCopilotCliStateFile";
  }
  constructor() {
    super({
      id: OpenCopilotCliStateFileAction.ID,
      title: localize2("openSessionEventsFile", "Open Copilot CLI State File"),
      f1: true,
      category: Categories.Developer,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        IsSessionsWindowContext.negate()
      )
    });
  }
  async run(accessor) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const sessionResource = chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource;
    await openCopilotCliStateFile(accessor, sessionResource);
  }
}
export {
  OpenCopilotCliStateFileAction,
  openCopilotCliStateFile
};
