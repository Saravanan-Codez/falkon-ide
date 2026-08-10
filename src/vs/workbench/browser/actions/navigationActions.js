import { localize2 } from "../../../nls.js";
import { IEditorGroupsService, GroupDirection, GroupLocation } from "../../services/editor/common/editorGroupsService.js";
import { IWorkbenchLayoutService, Parts } from "../../services/layout/browser/layoutService.js";
import { Action2, registerAction2 } from "../../../platform/actions/common/actions.js";
import { Categories } from "../../../platform/action/common/actionCommonCategories.js";
import { Direction } from "../../../base/browser/ui/grid/grid.js";
import { KeyCode, KeyMod } from "../../../base/common/keyCodes.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IPaneCompositePartService } from "../../services/panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../common/views.js";
import { KeybindingWeight } from "../../../platform/keybinding/common/keybindingsRegistry.js";
import { getActiveWindow } from "../../../base/browser/dom.js";
import { isAuxiliaryWindow } from "../../../base/browser/window.js";
class BaseNavigationAction extends Action2 {
  constructor(options, direction) {
    super(options);
    this.direction = direction;
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const isEditorFocus = layoutService.hasFocus(Parts.EDITOR_PART);
    const isPanelFocus = layoutService.hasFocus(Parts.PANEL_PART);
    const isSidebarFocus = layoutService.hasFocus(Parts.SIDEBAR_PART);
    const isAuxiliaryBarFocus = layoutService.hasFocus(Parts.AUXILIARYBAR_PART);
    let neighborPart;
    if (isEditorFocus) {
      const didNavigate = this.navigateAcrossEditorGroup(this.toGroupDirection(this.direction), editorGroupService);
      if (didNavigate) {
        return;
      }
      neighborPart = layoutService.getVisibleNeighborPart(Parts.EDITOR_PART, this.direction);
    }
    if (isPanelFocus) {
      neighborPart = layoutService.getVisibleNeighborPart(Parts.PANEL_PART, this.direction);
    }
    if (isSidebarFocus) {
      neighborPart = layoutService.getVisibleNeighborPart(Parts.SIDEBAR_PART, this.direction);
    }
    if (isAuxiliaryBarFocus) {
      neighborPart = neighborPart = layoutService.getVisibleNeighborPart(Parts.AUXILIARYBAR_PART, this.direction);
    }
    if (neighborPart === Parts.EDITOR_PART) {
      if (!this.navigateBackToEditorGroup(this.toGroupDirection(this.direction), editorGroupService)) {
        this.navigateToEditorGroup(this.direction === Direction.Right ? GroupLocation.FIRST : GroupLocation.LAST, editorGroupService);
      }
    } else if (neighborPart === Parts.SIDEBAR_PART) {
      this.navigateToSidebar(layoutService, paneCompositeService);
    } else if (neighborPart === Parts.PANEL_PART) {
      this.navigateToPanel(layoutService, paneCompositeService);
    } else if (neighborPart === Parts.AUXILIARYBAR_PART) {
      this.navigateToAuxiliaryBar(layoutService, paneCompositeService);
    }
  }
  async navigateToPanel(layoutService, paneCompositeService) {
    if (!layoutService.isVisible(Parts.PANEL_PART)) {
      return false;
    }
    const activePanel = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
    if (!activePanel) {
      return false;
    }
    const activePanelId = activePanel.getId();
    const res = await paneCompositeService.openPaneComposite(activePanelId, ViewContainerLocation.Panel, true);
    if (!res) {
      return false;
    }
    return res;
  }
  async navigateToSidebar(layoutService, paneCompositeService) {
    if (!layoutService.isVisible(Parts.SIDEBAR_PART)) {
      return false;
    }
    const activeViewlet = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    if (!activeViewlet) {
      return false;
    }
    const activeViewletId = activeViewlet.getId();
    const viewlet = await paneCompositeService.openPaneComposite(activeViewletId, ViewContainerLocation.Sidebar, true);
    return !!viewlet;
  }
  async navigateToAuxiliaryBar(layoutService, paneCompositeService) {
    if (!layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
      return false;
    }
    const activePanel = paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar);
    if (!activePanel) {
      return false;
    }
    const activePanelId = activePanel.getId();
    const res = await paneCompositeService.openPaneComposite(activePanelId, ViewContainerLocation.AuxiliaryBar, true);
    if (!res) {
      return false;
    }
    return res;
  }
  navigateAcrossEditorGroup(direction, editorGroupService) {
    return this.doNavigateToEditorGroup({ direction }, editorGroupService);
  }
  navigateToEditorGroup(location, editorGroupService) {
    return this.doNavigateToEditorGroup({ location }, editorGroupService);
  }
  navigateBackToEditorGroup(direction, editorGroupService) {
    if (!editorGroupService.activeGroup) {
      return false;
    }
    const oppositeDirection = this.toOppositeDirection(direction);
    const groupInBetween = editorGroupService.findGroup({ direction: oppositeDirection }, editorGroupService.activeGroup);
    if (!groupInBetween) {
      editorGroupService.activeGroup.focus();
      return true;
    }
    return false;
  }
  toGroupDirection(direction) {
    switch (direction) {
      case Direction.Down:
        return GroupDirection.DOWN;
      case Direction.Left:
        return GroupDirection.LEFT;
      case Direction.Right:
        return GroupDirection.RIGHT;
      case Direction.Up:
        return GroupDirection.UP;
    }
  }
  toOppositeDirection(direction) {
    switch (direction) {
      case GroupDirection.UP:
        return GroupDirection.DOWN;
      case GroupDirection.RIGHT:
        return GroupDirection.LEFT;
      case GroupDirection.LEFT:
        return GroupDirection.RIGHT;
      case GroupDirection.DOWN:
        return GroupDirection.UP;
    }
  }
  doNavigateToEditorGroup(scope, editorGroupService) {
    const targetGroup = editorGroupService.findGroup(scope, editorGroupService.activeGroup);
    if (targetGroup) {
      targetGroup.focus();
      return true;
    }
    return false;
  }
}
registerAction2(class extends BaseNavigationAction {
  constructor() {
    super({
      id: "workbench.action.navigateLeft",
      title: localize2("navigateLeft", "Navigate to the View on the Left"),
      category: Categories.View,
      f1: true
    }, Direction.Left);
  }
});
registerAction2(class extends BaseNavigationAction {
  constructor() {
    super({
      id: "workbench.action.navigateRight",
      title: localize2("navigateRight", "Navigate to the View on the Right"),
      category: Categories.View,
      f1: true
    }, Direction.Right);
  }
});
registerAction2(class extends BaseNavigationAction {
  constructor() {
    super({
      id: "workbench.action.navigateUp",
      title: localize2("navigateUp", "Navigate to the View Above"),
      category: Categories.View,
      f1: true
    }, Direction.Up);
  }
});
registerAction2(class extends BaseNavigationAction {
  constructor() {
    super({
      id: "workbench.action.navigateDown",
      title: localize2("navigateDown", "Navigate to the View Below"),
      category: Categories.View,
      f1: true
    }, Direction.Down);
  }
});
class BaseFocusAction extends Action2 {
  constructor(options, focusNext) {
    super(options);
    this.focusNext = focusNext;
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const editorService = accessor.get(IEditorService);
    this.focusNextOrPreviousPart(layoutService, editorService, this.focusNext);
  }
  findVisibleNeighbour(layoutService, part, next) {
    const activeWindow = getActiveWindow();
    const windowIsAuxiliary = isAuxiliaryWindow(activeWindow);
    let neighbour;
    if (windowIsAuxiliary) {
      switch (part) {
        case Parts.EDITOR_PART:
          neighbour = Parts.STATUSBAR_PART;
          break;
        default:
          neighbour = Parts.EDITOR_PART;
      }
    } else {
      switch (part) {
        case Parts.EDITOR_PART:
          neighbour = next ? Parts.PANEL_PART : Parts.SIDEBAR_PART;
          break;
        case Parts.PANEL_PART:
          neighbour = next ? Parts.AUXILIARYBAR_PART : Parts.EDITOR_PART;
          break;
        case Parts.AUXILIARYBAR_PART:
          neighbour = next ? Parts.STATUSBAR_PART : Parts.PANEL_PART;
          break;
        case Parts.STATUSBAR_PART:
          neighbour = next ? Parts.ACTIVITYBAR_PART : Parts.AUXILIARYBAR_PART;
          break;
        case Parts.ACTIVITYBAR_PART:
          neighbour = next ? Parts.SIDEBAR_PART : Parts.STATUSBAR_PART;
          break;
        case Parts.SIDEBAR_PART:
          neighbour = next ? Parts.EDITOR_PART : Parts.ACTIVITYBAR_PART;
          break;
        default:
          neighbour = Parts.EDITOR_PART;
      }
    }
    if (layoutService.isVisible(neighbour, activeWindow) || neighbour === Parts.EDITOR_PART) {
      return neighbour;
    }
    return this.findVisibleNeighbour(layoutService, neighbour, next);
  }
  focusNextOrPreviousPart(layoutService, editorService, next) {
    let currentlyFocusedPart;
    if (editorService.activeEditorPane?.hasFocus() || layoutService.hasFocus(Parts.EDITOR_PART)) {
      currentlyFocusedPart = Parts.EDITOR_PART;
    } else if (layoutService.hasFocus(Parts.ACTIVITYBAR_PART)) {
      currentlyFocusedPart = Parts.ACTIVITYBAR_PART;
    } else if (layoutService.hasFocus(Parts.STATUSBAR_PART)) {
      currentlyFocusedPart = Parts.STATUSBAR_PART;
    } else if (layoutService.hasFocus(Parts.SIDEBAR_PART)) {
      currentlyFocusedPart = Parts.SIDEBAR_PART;
    } else if (layoutService.hasFocus(Parts.AUXILIARYBAR_PART)) {
      currentlyFocusedPart = Parts.AUXILIARYBAR_PART;
    } else if (layoutService.hasFocus(Parts.PANEL_PART)) {
      currentlyFocusedPart = Parts.PANEL_PART;
    }
    layoutService.focusPart(currentlyFocusedPart ? this.findVisibleNeighbour(layoutService, currentlyFocusedPart, next) : Parts.EDITOR_PART, getActiveWindow());
  }
}
registerAction2(class extends BaseFocusAction {
  constructor() {
    super({
      id: "workbench.action.focusNextPart",
      title: localize2("focusNextPart", "Focus Next Part"),
      category: Categories.View,
      f1: true,
      keybinding: {
        primary: KeyCode.F6,
        weight: KeybindingWeight.WorkbenchContrib
      }
    }, true);
  }
});
registerAction2(class extends BaseFocusAction {
  constructor() {
    super({
      id: "workbench.action.focusPreviousPart",
      title: localize2("focusPreviousPart", "Focus Previous Part"),
      category: Categories.View,
      f1: true,
      keybinding: {
        primary: KeyMod.Shift | KeyCode.F6,
        weight: KeybindingWeight.WorkbenchContrib
      }
    }, false);
  }
});
