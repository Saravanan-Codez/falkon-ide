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
import "../../../workbench/browser/parts/panel/media/panelpart.css";
import "./media/panelPart.css";
import { ActionsOrientation } from "../../../base/browser/ui/actionbar/actionbar.js";
import { ActivePanelContext, PanelFocusContext } from "../../../workbench/common/contextkeys.js";
import { IWorkbenchLayoutService, Parts, Position } from "../../../workbench/services/layout/browser/layoutService.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { PANEL_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_INACTIVE_TITLE_FOREGROUND, PANEL_ACTIVE_TITLE_BORDER, PANEL_DRAG_AND_DROP_BORDER } from "../../../workbench/common/theme.js";
import { agentsBadgeBackground, agentsBadgeForeground, agentsPanelBackground, agentsPanelBorder, agentsPanelForeground } from "../../common/theme.js";
import { AGENTS_FLOATING_PANEL_GAP } from "../../common/layoutConstants.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { IExtensionService } from "../../../workbench/services/extensions/common/extensions.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../workbench/common/views.js";
import { HoverPosition } from "../../../base/browser/ui/hover/hoverWidget.js";
import { IMenuService } from "../../../platform/actions/common/actions.js";
import { Menus } from "../menus.js";
import { AbstractPaneCompositePart, CompositeBarPosition } from "../../../workbench/browser/parts/paneCompositePart.js";
import { Part } from "../../../workbench/browser/part.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { Extensions } from "../../../workbench/browser/panecomposite.js";
let PanelPart = class extends AbstractPaneCompositePart {
  constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, menuService, configurationService) {
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
      Menus.PanelTitle,
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
    this.activePanelSettingsKey = "workbench.agentsession.panelpart.activepanelid";
  }
  static {
    /** Visual margin values for the card-like appearance */
    this.MARGIN_TOP = AGENTS_FLOATING_PANEL_GAP;
  }
  updateStyles() {
    super.updateStyles();
    const container = assertReturnsDefined(this.getContainer());
    container.style.setProperty("--part-background", this.getColor(agentsPanelBackground) || "");
    container.style.setProperty("--part-border-color", this.getColor(agentsPanelBorder) || "transparent");
    container.style.setProperty("--part-foreground", this.getColor(agentsPanelForeground) || "");
    container.style.backgroundColor = this.getColor(agentsPanelBackground) || "";
    container.style.borderTopColor = "";
    container.style.borderTopStyle = "";
    container.style.borderTopWidth = "";
  }
  getCompositeBarOptions() {
    return {
      partContainerClass: "panel",
      pinnedViewContainersKey: "workbench.agentsession.panel.pinnedPanels",
      placeholderViewContainersKey: "workbench.agentsession.panel.placeholderPanels",
      viewContainersWorkspaceStateKey: "workbench.agentsession.panel.viewContainersWorkspaceState",
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
      overflowActionSize: 44,
      colors: (theme) => ({
        activeBackgroundColor: theme.getColor(agentsPanelBackground),
        inactiveBackgroundColor: theme.getColor(agentsPanelBackground),
        activeBorderBottomColor: theme.getColor(PANEL_ACTIVE_TITLE_BORDER),
        activeForegroundColor: theme.getColor(PANEL_ACTIVE_TITLE_FOREGROUND),
        inactiveForegroundColor: theme.getColor(PANEL_INACTIVE_TITLE_FOREGROUND),
        badgeBackground: theme.getColor(agentsBadgeBackground),
        badgeForeground: theme.getColor(agentsBadgeForeground),
        dragAndDropBorder: theme.getColor(PANEL_DRAG_AND_DROP_BORDER)
      })
    };
  }
  fillExtraContextMenuActions(_actions) {
  }
  layout(width, height, top, left) {
    if (!this.layoutService.isVisible(Parts.PANEL_PART)) {
      return;
    }
    const borderTotal = 2;
    super.layout(
      width - borderTotal,
      height - PanelPart.MARGIN_TOP - borderTotal,
      top,
      left
    );
    Part.prototype.layout.call(this, width, height, top, left);
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
  __decorateParam(11, IMenuService),
  __decorateParam(12, IConfigurationService)
], PanelPart);
export {
  PanelPart
};
