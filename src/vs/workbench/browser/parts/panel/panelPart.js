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
import "./media/panelpart.css";
import { localize } from "../../../../nls.js";
import { Separator, SubmenuAction, toAction } from "../../../../base/common/actions.js";
import { ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ActivePanelContext, PanelFocusContext } from "../../../common/contextkeys.js";
import { IWorkbenchLayoutService, Parts, Position } from "../../../services/layout/browser/layoutService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { TogglePanelAction } from "./panelActions.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { PANEL_BACKGROUND, PANEL_BORDER, PANEL_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_INACTIVE_TITLE_FOREGROUND, PANEL_ACTIVE_TITLE_BORDER, PANEL_DRAG_AND_DROP_BORDER, PANEL_TITLE_BADGE_BACKGROUND, PANEL_TITLE_BADGE_FOREGROUND } from "../../../common/theme.js";
import { contrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { Dimension } from "../../../../base/browser/dom.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { AbstractPaneCompositePart, CompositeBarPosition } from "../paneCompositePart.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions } from "../../panecomposite.js";
let PanelPart = class extends AbstractPaneCompositePart {
  constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, commandService, menuService, configurationService) {
    super(
      Parts.PANEL_PART,
      { hasTitle: true, trailingSeparator: true },
      PanelPart.activePanelSettingsKey,
      ActivePanelContext.bindTo(contextKeyService),
      PanelFocusContext.bindTo(contextKeyService),
      "panel",
      "panel",
      void 0,
      PANEL_TITLE_BORDER,
      ViewContainerLocation.Panel,
      Extensions.Panels,
      MenuId.PanelTitle,
      notificationService,
      storageService,
      contextMenuService,
      layoutService,
      keybindingService,
      hoverService,
      instantiationService,
      themeService,
      viewDescriptorService,
      contextKeyService,
      extensionService,
      menuService,
      configurationService
    );
    this.commandService = commandService;
    //#region IView
    this.minimumWidth = 300;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 77;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.panel.showLabels")) {
        this.updateCompositeBar(true);
      }
    }));
  }
  get preferredHeight() {
    return this.layoutService.mainContainerDimension.height * 0.4;
  }
  get preferredWidth() {
    const activeComposite = this.getActivePaneComposite();
    if (!activeComposite) {
      return void 0;
    }
    const width = activeComposite.getOptimalWidth();
    if (typeof width !== "number") {
      return void 0;
    }
    return Math.max(width, 300);
  }
  static {
    //#endregion
    this.activePanelSettingsKey = "workbench.panelpart.activepanelid";
  }
  updateStyles() {
    super.updateStyles();
    const container = assertReturnsDefined(this.getContainer());
    container.style.backgroundColor = this.getColor(PANEL_BACKGROUND) || "";
    const borderColor = this.getColor(PANEL_BORDER) || this.getColor(contrastBorder) || "";
    container.style.borderLeftColor = borderColor;
    container.style.borderRightColor = borderColor;
    container.style.borderBottomColor = borderColor;
    if (this.titleArea) {
      this.titleArea.style.borderTopColor = this.getColor(PANEL_BORDER) || this.getColor(contrastBorder) || "";
    }
  }
  getCompositeBarOptions() {
    return {
      partContainerClass: "panel",
      pinnedViewContainersKey: "workbench.panel.pinnedPanels",
      placeholderViewContainersKey: "workbench.panel.placeholderPanels",
      viewContainersWorkspaceStateKey: "workbench.panel.viewContainersWorkspaceState",
      icon: this.configurationService.getValue("workbench.panel.showLabels") === false,
      orientation: ActionsOrientation.HORIZONTAL,
      recomputeSizes: true,
      activityHoverOptions: {
        position: () => this.layoutService.getPanelPosition() === Position.BOTTOM && !this.layoutService.isPanelMaximized() ? HoverPosition.ABOVE : HoverPosition.BELOW
      },
      fillExtraContextMenuActions: (actions) => this.fillExtraContextMenuActions(actions),
      compositeSize: 0,
      iconSize: 16,
      compact: true,
      // Only applies to icons, not labels
      overflowActionSize: 44,
      colors: (theme) => ({
        activeBackgroundColor: theme.getColor(PANEL_BACKGROUND),
        // Background color for overflow action
        inactiveBackgroundColor: theme.getColor(PANEL_BACKGROUND),
        // Background color for overflow action
        activeBorderBottomColor: theme.getColor(PANEL_ACTIVE_TITLE_BORDER),
        activeForegroundColor: theme.getColor(PANEL_ACTIVE_TITLE_FOREGROUND),
        inactiveForegroundColor: theme.getColor(PANEL_INACTIVE_TITLE_FOREGROUND),
        badgeBackground: theme.getColor(PANEL_TITLE_BADGE_BACKGROUND),
        badgeForeground: theme.getColor(PANEL_TITLE_BADGE_FOREGROUND),
        dragAndDropBorder: theme.getColor(PANEL_DRAG_AND_DROP_BORDER)
      })
    };
  }
  fillExtraContextMenuActions(actions) {
    if (this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
      const viewsSubmenuAction = this.getViewsSubmenuAction();
      if (viewsSubmenuAction) {
        actions.push(new Separator());
        actions.push(viewsSubmenuAction);
      }
    }
    const panelPositionMenu = this.menuService.getMenuActions(MenuId.PanelPositionMenu, this.contextKeyService, { shouldForwardArgs: true });
    const panelAlignMenu = this.menuService.getMenuActions(MenuId.PanelAlignmentMenu, this.contextKeyService, { shouldForwardArgs: true });
    const positionActions = getContextMenuActions(panelPositionMenu).secondary;
    const alignActions = getContextMenuActions(panelAlignMenu).secondary;
    const panelShowLabels = this.configurationService.getValue("workbench.panel.showLabels");
    const toggleShowLabelsAction = toAction({
      id: "workbench.action.panel.toggleShowLabels",
      label: panelShowLabels ? localize("showIcons", "Show Icons") : localize("showLabels", "Show Labels"),
      run: () => this.configurationService.updateValue("workbench.panel.showLabels", !panelShowLabels)
    });
    actions.push(...[
      new Separator(),
      new SubmenuAction("workbench.action.panel.position", localize("panel position", "Panel Position"), positionActions),
      new SubmenuAction("workbench.action.panel.align", localize("align panel", "Align Panel"), alignActions),
      toggleShowLabelsAction,
      toAction({ id: TogglePanelAction.ID, label: localize("hidePanel", "Hide Panel"), run: () => this.commandService.executeCommand(TogglePanelAction.ID) })
    ]);
  }
  layout(width, height, top, left) {
    let dimensions;
    switch (this.layoutService.getPanelPosition()) {
      case Position.RIGHT:
        dimensions = new Dimension(width - 1, height);
        break;
      case Position.TOP:
        dimensions = new Dimension(width, height - 1);
        break;
      default:
        dimensions = new Dimension(width, height);
        break;
    }
    super.layout(dimensions.width, dimensions.height, top, left);
  }
  shouldShowCompositeBar() {
    return true;
  }
  getCompositeBarPosition() {
    return CompositeBarPosition.TITLE;
  }
  toJSON() {
    return {
      type: Parts.PANEL_PART
    };
  }
};
PanelPart = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IViewDescriptorService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, ICommandService),
  __decorateParam(12, IMenuService),
  __decorateParam(13, IConfigurationService)
], PanelPart);
export {
  PanelPart
};
