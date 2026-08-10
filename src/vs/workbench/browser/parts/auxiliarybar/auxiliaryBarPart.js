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
import "./media/auxiliaryBarPart.css";
import { localize } from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { contrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ActiveAuxiliaryContext, AuxiliaryBarFocusContext } from "../../../common/contextkeys.js";
import { ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_TOP_ACTIVE_BORDER, ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER, ACTIVITY_BAR_TOP_FOREGROUND, ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND, PANEL_ACTIVE_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_DRAG_AND_DROP_BORDER, PANEL_INACTIVE_TITLE_FOREGROUND, SIDE_BAR_BACKGROUND, SIDE_BAR_BORDER, SIDE_BAR_TITLE_BORDER, SIDE_BAR_FOREGROUND } from "../../../common/theme.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ActivityBarPosition, IWorkbenchLayoutService, LayoutSettings, Parts, Position } from "../../../services/layout/browser/layoutService.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { Separator, SubmenuAction, toAction } from "../../../../base/common/actions.js";
import { ToggleAuxiliaryBarAction } from "./auxiliaryBarActions.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { LayoutPriority } from "../../../../base/browser/ui/splitview/splitview.js";
import { ToggleSidebarPositionAction } from "../../actions/layoutActions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { AbstractPaneCompositePart, CompositeBarPosition } from "../paneCompositePart.js";
import { ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { VisibleViewContainersTracker } from "../visibleViewContainersTracker.js";
import { Extensions } from "../../panecomposite.js";
let AuxiliaryBarPart = class extends AbstractPaneCompositePart {
  constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, commandService, menuService, configurationService) {
    super(
      Parts.AUXILIARYBAR_PART,
      {
        hasTitle: true,
        trailingSeparator: true,
        borderWidth: () => this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder) ? 1 : 0
      },
      AuxiliaryBarPart.activeViewSettingsKey,
      ActiveAuxiliaryContext.bindTo(contextKeyService),
      AuxiliaryBarFocusContext.bindTo(contextKeyService),
      "auxiliarybar",
      "auxiliarybar",
      void 0,
      SIDE_BAR_TITLE_BORDER,
      ViewContainerLocation.AuxiliaryBar,
      Extensions.Auxiliary,
      MenuId.AuxiliaryBarTitle,
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
    // Use the side bar dimensions
    this.minimumWidth = 170;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 0;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this.priority = LayoutPriority.Low;
    this.visibleViewContainersTracker = this._register(instantiationService.createInstance(VisibleViewContainersTracker, ViewContainerLocation.AuxiliaryBar));
    this._register(this.visibleViewContainersTracker.onDidChange((e) => this.onDidChangeAutoHideViewContainers(e)));
    this.configuration = this.resolveConfiguration();
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
        this.configuration = this.resolveConfiguration();
        this.onDidChangeActivityBarLocation();
      } else if (e.affectsConfiguration("workbench.secondarySideBar.showLabels")) {
        this.configuration = this.resolveConfiguration();
        this.updateCompositeBar(true);
      } else if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_AUTO_HIDE)) {
        this.onDidChangeActivityBarLocation();
      }
    }));
  }
  static {
    this.activeViewSettingsKey = "workbench.auxiliarybar.activepanelid";
  }
  static {
    this.pinnedViewsKey = "workbench.auxiliarybar.pinnedPanels";
  }
  static {
    this.placeholdeViewContainersKey = "workbench.auxiliarybar.placeholderPanels";
  }
  static {
    this.viewContainersWorkspaceStateKey = "workbench.auxiliarybar.viewContainersWorkspaceState";
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
  onDidChangeAutoHideViewContainers(e) {
    const autoHide = this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_AUTO_HIDE);
    if (autoHide && (this.configuration.position === ActivityBarPosition.TOP || this.configuration.position === ActivityBarPosition.BOTTOM)) {
      const visibleBefore = e.before > 1;
      const visibleAfter = e.after > 1;
      if (visibleBefore !== visibleAfter) {
        this.onDidChangeActivityBarLocation();
      }
    }
  }
  resolveConfiguration() {
    const position = this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION);
    const canShowLabels = position !== ActivityBarPosition.TOP && position !== ActivityBarPosition.BOTTOM;
    const showLabels = canShowLabels && this.configurationService.getValue("workbench.secondarySideBar.showLabels") !== false;
    return { position, canShowLabels, showLabels };
  }
  onDidChangeActivityBarLocation() {
    this.updateCompositeBar();
    const id = this.getActiveComposite()?.getId();
    if (id) {
      this.onTitleAreaUpdate(id);
    }
  }
  updateStyles() {
    super.updateStyles();
    const container = assertReturnsDefined(this.getContainer());
    container.style.backgroundColor = this.getColor(SIDE_BAR_BACKGROUND) || "";
    const borderColor = this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder);
    const isPositionLeft = this.layoutService.getSideBarPosition() === Position.RIGHT;
    container.style.color = this.getColor(SIDE_BAR_FOREGROUND) || "";
    container.style.borderLeftColor = borderColor ?? "";
    container.style.borderRightColor = borderColor ?? "";
    container.style.borderLeftStyle = borderColor && !isPositionLeft ? "solid" : "none";
    container.style.borderRightStyle = borderColor && isPositionLeft ? "solid" : "none";
    container.style.borderLeftWidth = borderColor && !isPositionLeft ? "1px" : "0px";
    container.style.borderRightWidth = borderColor && isPositionLeft ? "1px" : "0px";
  }
  getCompositeBarOptions() {
    const $this = this;
    return {
      partContainerClass: "auxiliarybar",
      pinnedViewContainersKey: AuxiliaryBarPart.pinnedViewsKey,
      placeholderViewContainersKey: AuxiliaryBarPart.placeholdeViewContainersKey,
      viewContainersWorkspaceStateKey: AuxiliaryBarPart.viewContainersWorkspaceStateKey,
      icon: !this.configuration.showLabels,
      orientation: ActionsOrientation.HORIZONTAL,
      recomputeSizes: true,
      activityHoverOptions: {
        position: () => this.getCompositeBarPosition() === CompositeBarPosition.BOTTOM ? HoverPosition.ABOVE : HoverPosition.BELOW
      },
      fillExtraContextMenuActions: (actions) => this.fillExtraContextMenuActions(actions),
      compositeSize: 0,
      iconSize: 16,
      // Add 10px spacing if the overflow action is visible to no confuse the user with ... between the toolbars
      get overflowActionSize() {
        return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? 40 : 30;
      },
      colors: (theme) => ({
        activeBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
        inactiveBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
        get activeBorderBottomColor() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_ACTIVE_TITLE_BORDER) : theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER);
        },
        get activeForegroundColor() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_ACTIVE_TITLE_FOREGROUND) : theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND);
        },
        get inactiveForegroundColor() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_INACTIVE_TITLE_FOREGROUND) : theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND);
        },
        badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
        badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
        get dragAndDropBorder() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_DRAG_AND_DROP_BORDER) : theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER);
        }
      }),
      compact: true
    };
  }
  fillExtraContextMenuActions(actions) {
    const currentPositionRight = this.layoutService.getSideBarPosition() === Position.LEFT;
    if (this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
      const viewsSubmenuAction = this.getViewsSubmenuAction();
      if (viewsSubmenuAction) {
        actions.push(new Separator());
        actions.push(viewsSubmenuAction);
      }
    }
    const activityBarPositionMenu = this.menuService.getMenuActions(MenuId.ActivityBarPositionMenu, this.contextKeyService, { shouldForwardArgs: true, renderShortTitle: true });
    const positionActions = getContextMenuActions(activityBarPositionMenu).secondary;
    const toggleShowLabelsAction = toAction({
      id: "workbench.action.auxiliarybar.toggleShowLabels",
      label: this.configuration.showLabels ? localize("showIcons", "Show Icons") : localize("showLabels", "Show Labels"),
      enabled: this.configuration.canShowLabels,
      run: () => this.configurationService.updateValue("workbench.secondarySideBar.showLabels", !this.configuration.showLabels)
    });
    actions.push(...[
      new Separator(),
      new SubmenuAction("workbench.action.panel.position", localize("activity bar position", "Activity Bar Position"), positionActions),
      toAction({ id: ToggleSidebarPositionAction.ID, label: currentPositionRight ? localize("move second side bar left", "Move Secondary Side Bar Left") : localize("move second side bar right", "Move Secondary Side Bar Right"), run: () => this.commandService.executeCommand(ToggleSidebarPositionAction.ID) }),
      toggleShowLabelsAction,
      toAction({ id: ToggleAuxiliaryBarAction.ID, label: localize("hide second side bar", "Hide Secondary Side Bar"), run: () => this.commandService.executeCommand(ToggleAuxiliaryBarAction.ID) })
    ]);
  }
  shouldShowCompositeBar() {
    if (this.configuration.position === ActivityBarPosition.HIDDEN) {
      return false;
    }
    if (this.configuration.position === ActivityBarPosition.TOP || this.configuration.position === ActivityBarPosition.BOTTOM) {
      const autoHide = this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_AUTO_HIDE);
      if (autoHide) {
        const visibleCount = this.visibleViewContainersTracker.visibleCount;
        if (visibleCount <= 1) {
          return false;
        }
      }
    }
    return true;
  }
  getCompositeBarPosition() {
    switch (this.configuration.position) {
      case ActivityBarPosition.TOP:
        return CompositeBarPosition.TOP;
      case ActivityBarPosition.BOTTOM:
        return CompositeBarPosition.BOTTOM;
      case ActivityBarPosition.HIDDEN:
        return CompositeBarPosition.TITLE;
      case ActivityBarPosition.DEFAULT:
        return CompositeBarPosition.TITLE;
      default:
        return CompositeBarPosition.TITLE;
    }
  }
  toJSON() {
    return {
      type: Parts.AUXILIARYBAR_PART
    };
  }
};
AuxiliaryBarPart = __decorateClass([
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
], AuxiliaryBarPart);
export {
  AuxiliaryBarPart
};
