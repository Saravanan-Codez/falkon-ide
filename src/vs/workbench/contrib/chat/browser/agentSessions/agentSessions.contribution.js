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
import "./experiments/agentSessionsExperiments.contribution.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize2 } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { registerSingleton, InstantiationType } from "../../../../../platform/instantiation/common/extensions.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { AgentSessionsViewerOrientation, AgentSessionsViewerPosition } from "./agentSessions.js";
import { IAgentSessionsService, AgentSessionsService } from "./agentSessionsService.js";
import { LocalAgentsSessionsController } from "./localAgentSessionsController.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { OpenAgentSessionInEditorGroupAction, OpenAgentSessionInNewEditorGroupAction, OpenAgentSessionInNewWindowAction, ShowAgentSessionsSidebar, HideAgentSessionsSidebar, ToggleAgentSessionsSidebar, RefreshAgentSessionsViewerAction, FindAgentSessionInViewerAction, MarkAgentSessionUnreadAction, MarkAgentSessionReadAction, FocusAgentSessionsAction, SetAgentSessionsOrientationStackedAction, SetAgentSessionsOrientationSideBySideAction, MarkAllAgentSessionsReadAction, RenameAgentSessionAction, DeleteAgentSessionAction, DeleteAllLocalSessionsAction, MarkAgentSessionSectionReadAction, ToggleShowAgentSessionsAction, PinAgentSessionAction, UnpinAgentSessionAction, CollapseAllAgentSessionSectionsAction, getAgentSessionArchiveActionConstructors } from "./agentSessionsActions.js";
import { AgentHostPermissionUiContribution } from "./agentHost/agentHostPermissionUiContribution.js";
import "./agentHost/agentHostChatInputPicker.contribution.js";
import "./agentHost/agentHostModeSynchronizer.js";
import { ChatSessionArchiveActionWordingSettingId, getChatSessionArchiveActionWording } from "../../../../../platform/chat/common/sessionArchiveActions.js";
registerAction2(FocusAgentSessionsAction);
registerAction2(MarkAllAgentSessionsReadAction);
registerAction2(MarkAgentSessionSectionReadAction);
registerAction2(CollapseAllAgentSessionSectionsAction);
registerAction2(PinAgentSessionAction);
registerAction2(UnpinAgentSessionAction);
registerAction2(RenameAgentSessionAction);
registerAction2(DeleteAgentSessionAction);
registerAction2(DeleteAllLocalSessionsAction);
registerAction2(MarkAgentSessionUnreadAction);
registerAction2(MarkAgentSessionReadAction);
registerAction2(OpenAgentSessionInNewWindowAction);
registerAction2(OpenAgentSessionInEditorGroupAction);
registerAction2(OpenAgentSessionInNewEditorGroupAction);
registerAction2(RefreshAgentSessionsViewerAction);
registerAction2(FindAgentSessionInViewerAction);
registerAction2(ShowAgentSessionsSidebar);
registerAction2(HideAgentSessionsSidebar);
let AgentSessionArchiveActionsContribution = class extends Disposable {
  constructor(configurationService) {
    super();
    this.configurationService = configurationService;
    this.actionRegistrations = this._register(new DisposableStore());
    this.registerActions();
    this._register(this.configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ChatSessionArchiveActionWordingSettingId)) {
        this.registerActions();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentSessionArchiveActions";
  }
  registerActions() {
    this.actionRegistrations.clear();
    const wording = getChatSessionArchiveActionWording(this.configurationService);
    for (const action of getAgentSessionArchiveActionConstructors(wording)) {
      this.actionRegistrations.add(registerAction2(action));
    }
  }
};
AgentSessionArchiveActionsContribution = __decorateClass([
  __decorateParam(0, IConfigurationService)
], AgentSessionArchiveActionsContribution);
registerWorkbenchContribution2(AgentSessionArchiveActionsContribution.ID, AgentSessionArchiveActionsContribution, WorkbenchPhase.BlockStartup);
registerAction2(ToggleAgentSessionsSidebar);
registerAction2(ToggleShowAgentSessionsAction);
registerAction2(SetAgentSessionsOrientationStackedAction);
registerAction2(SetAgentSessionsOrientationSideBySideAction);
MenuRegistry.appendMenuItem(MenuId.AgentSessionsToolbar, {
  submenu: MenuId.AgentSessionsViewerFilterSubMenu,
  title: localize2("filterAgentSessions", "Filter Agent Sessions"),
  group: "navigation",
  order: 3,
  icon: Codicon.filter
});
MenuRegistry.appendMenuItem(MenuId.AgentSessionsToolbar, {
  command: {
    id: ShowAgentSessionsSidebar.ID,
    title: ShowAgentSessionsSidebar.TITLE,
    icon: Codicon.layoutSidebarRightOff
  },
  group: "navigation",
  order: 5,
  when: ContextKeyExpr.and(
    ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.Stacked),
    ChatContextKeys.agentSessionsViewerPosition.isEqualTo(AgentSessionsViewerPosition.Right)
  )
});
MenuRegistry.appendMenuItem(MenuId.AgentSessionsToolbar, {
  command: {
    id: ShowAgentSessionsSidebar.ID,
    title: ShowAgentSessionsSidebar.TITLE,
    icon: Codicon.layoutSidebarLeftOff
  },
  group: "navigation",
  order: 5,
  when: ContextKeyExpr.and(
    ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.Stacked),
    ChatContextKeys.agentSessionsViewerPosition.isEqualTo(AgentSessionsViewerPosition.Left)
  )
});
MenuRegistry.appendMenuItem(MenuId.AgentSessionsToolbar, {
  command: {
    id: HideAgentSessionsSidebar.ID,
    title: HideAgentSessionsSidebar.TITLE,
    icon: Codicon.layoutSidebarRight
  },
  group: "navigation",
  order: 5,
  when: ContextKeyExpr.and(
    ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.SideBySide),
    ChatContextKeys.agentSessionsViewerPosition.isEqualTo(AgentSessionsViewerPosition.Right)
  )
});
MenuRegistry.appendMenuItem(MenuId.AgentSessionsToolbar, {
  command: {
    id: HideAgentSessionsSidebar.ID,
    title: HideAgentSessionsSidebar.TITLE,
    icon: Codicon.layoutSidebarLeft
  },
  group: "navigation",
  order: 5,
  when: ContextKeyExpr.and(
    ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.SideBySide),
    ChatContextKeys.agentSessionsViewerPosition.isEqualTo(AgentSessionsViewerPosition.Left)
  )
});
MenuRegistry.appendMenuItem(MenuId.ChatViewSessionTitleToolbar, {
  command: {
    id: ShowAgentSessionsSidebar.ID,
    title: ShowAgentSessionsSidebar.TITLE,
    icon: Codicon.layoutSidebarLeftOff
  },
  group: "navigation",
  order: 1,
  when: ContextKeyExpr.and(
    ContextKeyExpr.or(
      ChatContextKeys.agentSessionsViewerVisible.negate(),
      ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.Stacked)
    ),
    ChatContextKeys.agentSessionsViewerPosition.isEqualTo(AgentSessionsViewerPosition.Left)
  )
});
MenuRegistry.appendMenuItem(MenuId.ChatViewSessionTitleToolbar, {
  command: {
    id: ShowAgentSessionsSidebar.ID,
    title: ShowAgentSessionsSidebar.TITLE,
    icon: Codicon.layoutSidebarRightOff
  },
  group: "navigation",
  order: 1,
  when: ContextKeyExpr.and(
    ContextKeyExpr.or(
      ChatContextKeys.agentSessionsViewerVisible.negate(),
      ChatContextKeys.agentSessionsViewerOrientation.isEqualTo(AgentSessionsViewerOrientation.Stacked)
    ),
    ChatContextKeys.agentSessionsViewerPosition.isEqualTo(AgentSessionsViewerPosition.Right)
  )
});
registerWorkbenchContribution2(LocalAgentsSessionsController.ID, LocalAgentsSessionsController, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentHostPermissionUiContribution.ID, AgentHostPermissionUiContribution, WorkbenchPhase.BlockRestore);
registerSingleton(IAgentSessionsService, AgentSessionsService, InstantiationType.Delayed);
