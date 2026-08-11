import { alert } from "../../base/browser/ui/aria/aria.js";
import { Codicon } from "../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../base/common/keyCodes.js";
import { localize, localize2 } from "../../nls.js";
import { Categories } from "../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../platform/contextkey/common/contextkey.js";
import { Menus } from "./menus.js";
import { KeybindingWeight } from "../../platform/keybinding/common/keybindingsRegistry.js";
import { registerIcon } from "../../platform/theme/common/iconRegistry.js";
import { AuxiliaryBarVisibleContext, IsAuxiliaryWindowContext, IsSessionsWindowContext, IsTopRightEditorGroupContext, IsWindowAlwaysOnTopContext, SideBarVisibleContext } from "../../workbench/common/contextkeys.js";
import { IWorkbenchLayoutService, Parts } from "../../workbench/services/layout/browser/layoutService.js";
import { SessionsWelcomeVisibleContext, SinglePaneLayoutEnabledContext, CustomViewVisibleContext } from "../common/contextkeys.js";
const panelCloseIcon = registerIcon("agent-panel-close", Codicon.close, localize("agentPanelCloseIcon", "Icon to close the panel."));
const sidebarToggleClosedIcon = registerIcon("agent-sidebar-toggle-closed", Codicon.layoutSidebarLeftOff, localize("agentSidebarToggleClosedIcon", "Icon for the sessions sidebar when closed."));
const sidebarToggleOpenIcon = registerIcon("agent-sidebar-toggle-open", Codicon.layoutSidebarLeft, localize("agentSidebarToggleOpenIcon", "Icon for the sessions sidebar when open."));
class ToggleSidebarVisibilityAction extends Action2 {
  static {
    this.ID = "workbench.action.agentToggleSidebarVisibility";
  }
  constructor() {
    super({
      id: ToggleSidebarVisibilityAction.ID,
      title: localize2("toggleSidebar", "Toggle Side Bar"),
      icon: sidebarToggleClosedIcon,
      toggled: {
        condition: SideBarVisibleContext,
        icon: sidebarToggleOpenIcon
      },
      metadata: {
        description: localize("openAndCloseSidebar", "Open/Show and Close/Hide Sidebar")
      },
      category: Categories.View,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.SessionsContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyB
      },
      menu: [
        {
          id: Menus.TitleBarLeftLayout,
          group: "navigation",
          order: 0,
          when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated())
        }
      ]
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const isCurrentlyVisible = layoutService.isVisible(Parts.SIDEBAR_PART);
    layoutService.setPartHidden(isCurrentlyVisible, Parts.SIDEBAR_PART);
    const alertMessage = isCurrentlyVisible ? localize("sidebarHidden", "Primary Side Bar hidden") : localize("sidebarVisible", "Primary Side Bar shown");
    alert(alertMessage);
  }
}
registerAction2(ToggleSidebarVisibilityAction);
const editorTitleAuxiliaryBarWhen = ContextKeyExpr.and(
  IsSessionsWindowContext,
  IsAuxiliaryWindowContext.toNegated(),
  CustomViewVisibleContext.negate(),
  IsTopRightEditorGroupContext
);
const isSinglePaneDetailPanelDisabled = SinglePaneLayoutEnabledContext.negate();
MenuRegistry.appendMenuItem(MenuId.EditorTitleLayout, {
  command: {
    id: "workbench.action.toggleAuxiliaryBar",
    title: localize("hideSecondarySideBar", "Hide Secondary Side Bar"),
    icon: Codicon.rightPanelHide
  },
  group: "navigation",
  order: 99.5,
  when: ContextKeyExpr.and(editorTitleAuxiliaryBarWhen, AuxiliaryBarVisibleContext, isSinglePaneDetailPanelDisabled)
});
MenuRegistry.appendMenuItem(MenuId.EditorTitleLayout, {
  command: {
    id: "workbench.action.toggleAuxiliaryBar",
    title: localize("showSecondarySideBar", "Show Secondary Side Bar"),
    icon: Codicon.rightPanelShow
  },
  group: "navigation",
  order: 99.5,
  when: ContextKeyExpr.and(editorTitleAuxiliaryBarWhen, AuxiliaryBarVisibleContext.toNegated(), isSinglePaneDetailPanelDisabled)
});
MenuRegistry.appendMenuItem(Menus.PanelTitle, {
  command: {
    id: "workbench.action.closePanel",
    title: localize("closePanel", "Hide Panel"),
    icon: panelCloseIcon
  },
  group: "navigation",
  order: 2
});
MenuRegistry.appendMenuItem(Menus.TitleBarRightLayout, {
  command: {
    id: "workbench.action.toggleWindowAlwaysOnTop",
    title: localize("toggleWindowAlwaysOnTop", "Toggle Always on Top"),
    icon: Codicon.pin,
    toggled: {
      condition: IsWindowAlwaysOnTopContext,
      icon: Codicon.pinned
    }
  },
  when: IsAuxiliaryWindowContext,
  group: "navigation",
  order: 0
});
