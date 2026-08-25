import { Codicon } from "../../../../../base/common/codicons.js";
import { localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { INativeHostService } from "../../../../../platform/native/common/native.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { DebugAgentHostInDevToolsAction } from "./debugAgentHostAction.js";
import "./exportAgentHostDebugLogsService.js";
import { ProfileAgentHostAction, StopAgentHostProfileAction } from "./profileAgentHostAction.js";
import { registerNetworkDiagnosticsAction } from "./networkDiagnosticsAction.js";
import { RestartLocalAgentHostAction } from "./restartAgentHostAction.js";
function registerChatDeveloperActions() {
  registerAction2(OpenChatStorageFolderAction);
  registerAction2(DebugAgentHostInDevToolsAction);
  registerAction2(RestartLocalAgentHostAction);
  registerAction2(ProfileAgentHostAction);
  registerAction2(StopAgentHostProfileAction);
  registerNetworkDiagnosticsAction();
}
class OpenChatStorageFolderAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openStorageFolder";
  }
  constructor() {
    super({
      id: OpenChatStorageFolderAction.ID,
      title: localize2("workbench.action.chat.openStorageFolder.label", "Open Chat Storage Folder"),
      icon: Codicon.attach,
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor, ...args) {
    const chatService = accessor.get(IChatService);
    const nativeHostService = accessor.get(INativeHostService);
    const storagePath = chatService.getChatStorageFolder();
    nativeHostService.showItemInFolder(storagePath.fsPath);
  }
}
export {
  registerChatDeveloperActions
};
