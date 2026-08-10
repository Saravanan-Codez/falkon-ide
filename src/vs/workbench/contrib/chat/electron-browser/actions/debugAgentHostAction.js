import { Codicon } from "../../../../../base/common/codicons.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2 } from "../../../../../platform/actions/common/actions.js";
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from "../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { IAgentHostService } from "../../../../../platform/agentHost/common/agentService.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { INativeHostService } from "../../../../../platform/native/common/native.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
class DebugAgentHostInDevToolsAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.debugAgentHostInDevTools";
  }
  constructor() {
    super({
      id: DebugAgentHostInDevToolsAction.ID,
      title: localize2("debugAgentHostInDevTools", "Debug Local Agent Host Process In Dev Tools"),
      category: Categories.Developer,
      f1: true,
      icon: Codicon.debugStart,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        AGENT_HOST_ENABLED_CONTEXT_KEY
      )
    });
  }
  async run(accessor) {
    const agentHostService = accessor.get(IAgentHostService);
    const nativeHostService = accessor.get(INativeHostService);
    const notificationService = accessor.get(INotificationService);
    const info = await agentHostService.getInspectInfo(true);
    if (!info) {
      notificationService.warn(localize("debugAgentHost.noInspectPort", "Could not enable the Node.js inspector for the agent host process."));
      return;
    }
    nativeHostService.openDevToolsWindow(info.devtoolsUrl);
  }
}
export {
  DebugAgentHostInDevToolsAction
};
