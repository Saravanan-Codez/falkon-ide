import { Action2, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { localize2 } from "../../../../../../nls.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { ChatConfiguration } from "../../../common/constants.js";
import { ContextKeyExpr } from "../../../../../../platform/contextkey/common/contextkey.js";
import { UnifiedQuickAccess, DEFAULT_UNIFIED_QUICK_ACCESS_TABS } from "./unifiedQuickAccess.js";
let unifiedQuickAccessInstance;
function getUnifiedQuickAccess(instantiationService) {
  if (!unifiedQuickAccessInstance) {
    unifiedQuickAccessInstance = instantiationService.createInstance(UnifiedQuickAccess, DEFAULT_UNIFIED_QUICK_ACCESS_TABS);
  }
  return unifiedQuickAccessInstance;
}
const UNIFIED_QUICK_ACCESS_ACTION_ID = "workbench.action.unifiedQuickAccess";
class ShowUnifiedQuickAccessAction extends Action2 {
  static {
    this.ID = UNIFIED_QUICK_ACCESS_ACTION_ID;
  }
  constructor() {
    super({
      id: ShowUnifiedQuickAccessAction.ID,
      title: localize2("showAgentQuickAccess", "Show Agent Quick Access"),
      f1: true,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.has(`config.${ChatConfiguration.UnifiedAgentsBar}`)
      )
    });
  }
  run(accessor, initialTabId) {
    const instantiationService = accessor.get(IInstantiationService);
    const unifiedQuickAccess = getUnifiedQuickAccess(instantiationService);
    unifiedQuickAccess.show(initialTabId);
  }
}
class ShowAgentSessionsQuickAccessAction extends Action2 {
  static {
    this.ID = "workbench.action.showAgentSessionsQuickAccess";
  }
  constructor() {
    super({
      id: ShowAgentSessionsQuickAccessAction.ID,
      title: localize2("showAgentSessionsQuickAccess", "Show Agent Sessions"),
      f1: true,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.has(`config.${ChatConfiguration.UnifiedAgentsBar}`)
      )
    });
  }
  run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const unifiedQuickAccess = getUnifiedQuickAccess(instantiationService);
    unifiedQuickAccess.show("agentSessions");
  }
}
class ShowCommandsQuickAccessAction extends Action2 {
  static {
    this.ID = "workbench.action.showCommandsQuickAccess";
  }
  constructor() {
    super({
      id: ShowCommandsQuickAccessAction.ID,
      title: localize2("showCommandsQuickAccess", "Show Commands (Unified)"),
      f1: true,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.has(`config.${ChatConfiguration.UnifiedAgentsBar}`)
      )
    });
  }
  run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const unifiedQuickAccess = getUnifiedQuickAccess(instantiationService);
    unifiedQuickAccess.show("commands");
  }
}
class ShowFilesQuickAccessAction extends Action2 {
  static {
    this.ID = "workbench.action.showFilesQuickAccess";
  }
  constructor() {
    super({
      id: ShowFilesQuickAccessAction.ID,
      title: localize2("showFilesQuickAccess", "Show Files (Unified)"),
      f1: true,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.has(`config.${ChatConfiguration.UnifiedAgentsBar}`)
      )
    });
  }
  run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const unifiedQuickAccess = getUnifiedQuickAccess(instantiationService);
    unifiedQuickAccess.show("files");
  }
}
registerAction2(ShowUnifiedQuickAccessAction);
registerAction2(ShowAgentSessionsQuickAccessAction);
registerAction2(ShowCommandsQuickAccessAction);
registerAction2(ShowFilesQuickAccessAction);
export {
  ShowAgentSessionsQuickAccessAction,
  ShowCommandsQuickAccessAction,
  ShowFilesQuickAccessAction,
  ShowUnifiedQuickAccessAction,
  UNIFIED_QUICK_ACCESS_ACTION_ID
};
