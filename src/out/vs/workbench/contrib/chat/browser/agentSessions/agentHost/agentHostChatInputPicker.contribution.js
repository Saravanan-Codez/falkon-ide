import { localize2 } from "../../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ClaudeSessionConfigKey } from "../../../../../../platform/agentHost/common/claudeSessionConfigKeys.js";
import { CodexSessionConfigKey } from "../../../../../../platform/agentHost/common/codexSessionConfigKeys.js";
import { SessionConfigKey } from "../../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ContextKeyExpr } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IsSessionsWindowContext, WorkspaceFolderCountContext } from "../../../../../common/contextkeys.js";
import { ChatContextKeys, ChatContextKeyExprs } from "../../../common/actions/chatContextKeys.js";
class OpenAgentHostFolderPickerAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openAgentHostFolderPicker";
  }
  constructor() {
    super({
      id: OpenAgentHostFolderPickerAction.ID,
      title: localize2("agentHost.folderPicker", "Folder"),
      f1: false,
      // The working directory is an argument to session creation and is
      // fixed once the session has started (its first request), so the
      // chip stays visible afterwards but is disabled.
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.chatSessionIsEmpty),
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 1.1,
        // Only relevant when there is more than one root folder to choose
        // from and we are in a regular editor window (the agent sessions
        // window has its own workspace picker). Ordered last in the chip
        // row to match the extension-host Copilot CLI layout.
        when: ContextKeyExpr.and(
          ChatContextKeyExprs.isAgentHostSession,
          WorkspaceFolderCountContext.greater(1),
          IsSessionsWindowContext.negate()
        )
      }]
    });
  }
  async run() {
  }
}
class OpenAgentHostModePickerAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openAgentHostModePicker";
  }
  constructor() {
    super({
      id: OpenAgentHostModePickerAction.ID,
      title: localize2("agentHost.modePicker", "Agent Mode"),
      f1: false,
      precondition: ChatContextKeys.enabled,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 0.7,
        when: ChatContextKeyExprs.isAgentHostSession
      }]
    });
  }
  async run() {
  }
}
class OpenAgentHostAutoApprovePickerAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openAgentHostAutoApprovePicker";
  }
  constructor() {
    super({
      id: OpenAgentHostAutoApprovePickerAction.ID,
      title: localize2("agentHost.autoApprovePicker", "Auto-Approve"),
      f1: false,
      precondition: ChatContextKeys.enabled,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 0.8,
        when: ChatContextKeyExprs.isAgentHostSession
      }]
    });
  }
  async run() {
  }
}
class OpenAgentHostPermissionModePickerAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openAgentHostPermissionModePicker";
  }
  constructor() {
    super({
      id: OpenAgentHostPermissionModePickerAction.ID,
      title: localize2("agentHost.permissionModePicker", "Approvals"),
      f1: false,
      precondition: ChatContextKeys.enabled,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 0.9,
        when: ChatContextKeyExprs.isAgentHostSession
      }]
    });
  }
  async run() {
  }
}
class OpenAgentHostCodexApprovalsPickerAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.openAgentHostCodexApprovalsPicker";
  }
  constructor() {
    super({
      id: OpenAgentHostCodexApprovalsPickerAction.ID,
      title: localize2("agentHost.codexApprovalsPicker", "Approvals"),
      f1: false,
      precondition: ChatContextKeys.enabled,
      menu: [{
        id: MenuId.ChatInputSecondary,
        group: "navigation",
        order: 0.9,
        when: ChatContextKeyExprs.isAgentHostSession
      }]
    });
  }
  async run() {
  }
}
function getAgentHostPickerProperty(actionId) {
  switch (actionId) {
    case OpenAgentHostModePickerAction.ID:
      return SessionConfigKey.Mode;
    case OpenAgentHostAutoApprovePickerAction.ID:
      return SessionConfigKey.AutoApprove;
    case OpenAgentHostPermissionModePickerAction.ID:
      return ClaudeSessionConfigKey.PermissionMode;
    case OpenAgentHostCodexApprovalsPickerAction.ID:
      return CodexSessionConfigKey.PermissionsPreset;
    default:
      return void 0;
  }
}
registerAction2(OpenAgentHostModePickerAction);
registerAction2(OpenAgentHostAutoApprovePickerAction);
registerAction2(OpenAgentHostPermissionModePickerAction);
registerAction2(OpenAgentHostCodexApprovalsPickerAction);
registerAction2(OpenAgentHostFolderPickerAction);
export {
  OpenAgentHostAutoApprovePickerAction,
  OpenAgentHostCodexApprovalsPickerAction,
  OpenAgentHostFolderPickerAction,
  OpenAgentHostModePickerAction,
  OpenAgentHostPermissionModePickerAction,
  getAgentHostPickerProperty
};
