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
import "../../../workbench/browser/parts/sidebar/media/sidebarpart.css";
import "./media/sidebarPart.css";
import { IWorkbenchLayoutService, Parts, Position as SideBarPosition } from "../../../workbench/services/layout/browser/layoutService.js";
import { SidebarFocusContext, ActiveViewletContext } from "../../../workbench/common/contextkeys.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { SIDE_BAR_TITLE_FOREGROUND, SIDE_BAR_TITLE_BORDER, SIDE_BAR_FOREGROUND, SIDE_BAR_DRAG_AND_DROP_BACKGROUND, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_TOP_FOREGROUND, ACTIVITY_BAR_TOP_ACTIVE_BORDER, ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND, ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER } from "../../../workbench/common/theme.js";
import { agentsPanelForeground } from "../../common/theme.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { AnchorAlignment } from "../../../base/browser/ui/contextview/contextview.js";
import { IExtensionService } from "../../../workbench/services/extensions/common/extensions.js";
import { LayoutPriority } from "../../../base/browser/ui/grid/grid.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../workbench/common/views.js";
import { AbstractPaneCompositePart, CompositeBarPosition } from "../../../workbench/browser/parts/paneCompositePart.js";
import { Part } from "../../../workbench/browser/part.js";
import { ActionsOrientation } from "../../../base/browser/ui/actionbar/actionbar.js";
import { HoverPosition } from "../../../base/browser/ui/hover/hoverWidget.js";
import { IMenuService } from "../../../platform/actions/common/actions.js";
import { Separator } from "../../../base/common/actions.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { Extensions } from "../../../workbench/browser/panecomposite.js";
import { Menus } from "../menus.js";
import { $, append, getWindowId, prepend } from "../../../base/browser/dom.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../platform/actions/browser/toolbar.js";
import { isFullscreen, onDidChangeFullscreen } from "../../../base/browser/browser.js";
import { mainWindow } from "../../../base/browser/window.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { hasNativeTitlebar, getTitleBarStyle } from "../../../platform/window/common/window.js";
import { isMacintosh, isNative, isWeb } from "../../../base/common/platform.js";
const SESSIONS_LIST_MINIMUM_WIDTH = isWeb ? 270 : 170;
let SidebarPart = class extends AbstractPaneCompositePart {
  //#endregion
  constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, menuService, configurationService) {
    super(
      Parts.SIDEBAR_PART,
      { hasTitle: false, trailingSeparator: false, borderWidth: () => 0 },
      SidebarPart.activeViewletSettingsKey,
      ActiveViewletContext.bindTo(contextKeyService),
      SidebarFocusContext.bindTo(contextKeyService),
      "sideBar",
      "viewlet",
      SIDE_BAR_TITLE_FOREGROUND,
      SIDE_BAR_TITLE_BORDER,
      ViewContainerLocation.Sidebar,
      Extensions.Viewlets,
      Menus.SidebarTitle,
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
    this.minimumWidth = SESSIONS_LIST_MINIMUM_WIDTH;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 0;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this.priority = LayoutPriority.Low;
  }
  static {
    this.activeViewletSettingsKey = "workbench.agentsession.sidebar.activeviewletid";
  }
  static {
    this.pinnedViewContainersKey = "workbench.agentsession.pinnedViewlets2";
  }
  static {
    this.placeholderViewContainersKey = "workbench.agentsession.placeholderViewlets";
  }
  static {
    this.viewContainersWorkspaceStateKey = "workbench.agentsession.viewletsWorkspaceState";
  }
  static {
    /** Visual margin values - sidebar is flush (no card appearance) */
    this.MARGIN_TOP = 0;
  }
  static {
    this.MARGIN_BOTTOM = 0;
  }
  static {
    this.MARGIN_LEFT = 0;
  }
  static {
    this.FOOTER_ITEM_HEIGHT = 26;
  }
  static {
    this.FOOTER_ITEM_GAP = 4;
  }
  static {
    this.FOOTER_VERTICAL_PADDING = 6;
  }
  static {
    this.FOOTER_BOTTOM_MARGIN = 2;
  }
  static {
    this.FOOTER_BORDER_TOP = 1;
  }
  get snap() {
    return true;
  }
  get preferredWidth() {
    const viewlet = this.getActivePaneComposite();
    if (!viewlet) {
      return void 0;
    }
    const width = viewlet.getOptimalWidth();
    if (typeof width !== "number") {
      return void 0;
    }
    return Math.max(width, 300);
  }
  create(parent) {
    super.create(parent);
    this.createFooter(parent);
  }
  createTitleArea(parent) {
    const titleArea = super.createTitleArea(parent);
    this.sideBarTitleArea = titleArea;
    if (titleArea) {
      prepend(titleArea, $("div.titlebar-drag-region"));
    }
    if (titleArea && isMacintosh && isNative && !hasNativeTitlebar(this.configurationService, getTitleBarStyle(this.configurationService))) {
      const spacer = $("div.window-controls-container");
      spacer.style.width = "70px";
      spacer.style.height = "100%";
      spacer.style.flexShrink = "0";
      spacer.style.order = "-1";
      prepend(titleArea, spacer);
      const updateSpacerVisibility = () => {
        spacer.style.display = isFullscreen(mainWindow) ? "none" : "";
      };
      updateSpacerVisibility();
      this._register(onDidChangeFullscreen((windowId) => {
        if (windowId === getWindowId(mainWindow)) {
          updateSpacerVisibility();
        }
      }));
    }
    return titleArea;
  }
  createFooter(parent) {
    const footer = append(parent, $(".sidebar-footer.sidebar-action-list"));
    this.footerContainer = footer;
    this.footerToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, footer, Menus.SidebarFooter, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: { primaryGroup: () => true },
      telemetrySource: "sidebarFooter"
    }));
    this._register(this.footerToolbar.onDidChangeMenuItems(() => {
      if (this.previousLayoutDimensions) {
        const { width, height, top, left } = this.previousLayoutDimensions;
        this.layout(width, height, top, left);
      }
    }));
  }
  getFooterHeight() {
    const actionCount = this.footerToolbar?.getItemsLength() ?? 0;
    if (actionCount === 0) {
      return 0;
    }
    return SidebarPart.FOOTER_VERTICAL_PADDING * 2 + actionCount * SidebarPart.FOOTER_ITEM_HEIGHT + (actionCount - 1) * SidebarPart.FOOTER_ITEM_GAP + SidebarPart.FOOTER_BOTTOM_MARGIN + SidebarPart.FOOTER_BORDER_TOP;
  }
  updateFooterVisibility() {
    const footer = this.footerContainer;
    if (!footer) {
      return;
    }
    footer.style.display = this.getFooterHeight() > 0 ? "" : "none";
  }
  updateStyles() {
    super.updateStyles();
    const container = assertReturnsDefined(this.getContainer());
    container.style.backgroundColor = "transparent";
    container.style.color = this.getColor(SIDE_BAR_FOREGROUND) || "";
    container.style.outlineColor = this.getColor(SIDE_BAR_DRAG_AND_DROP_BACKGROUND) ?? "";
    container.style.borderRightWidth = "";
    container.style.borderRightStyle = "";
    container.style.borderRightColor = "";
    if (this.sideBarTitleArea) {
      this.sideBarTitleArea.style.backgroundColor = "transparent";
      this.sideBarTitleArea.style.color = this.getColor(agentsPanelForeground) || "";
    }
  }
  layout(width, height, top, left) {
    this.previousLayoutDimensions = { width, height, top, left };
    if (!this.layoutService.isVisible(Parts.SIDEBAR_PART)) {
      return;
    }
    this.updateFooterVisibility();
    const footerHeight = Math.min(height, this.getFooterHeight());
    super.layout(
      width,
      height - footerHeight,
      top,
      left
    );
    Part.prototype.layout.call(this, width, height, top, left);
  }
  getTitleAreaDropDownAnchorAlignment() {
    return this.layoutService.getSideBarPosition() === SideBarPosition.LEFT ? AnchorAlignment.LEFT : AnchorAlignment.RIGHT;
  }
  createTitleLabel(_parent) {
    return {
      updateTitle: () => {
      },
      updateStyles: () => {
      }
    };
  }
  getCompositeBarOptions() {
    return {
      partContainerClass: "sidebar",
      pinnedViewContainersKey: SidebarPart.pinnedViewContainersKey,
      placeholderViewContainersKey: SidebarPart.placeholderViewContainersKey,
      viewContainersWorkspaceStateKey: SidebarPart.viewContainersWorkspaceStateKey,
      icon: false,
      orientation: ActionsOrientation.HORIZONTAL,
      recomputeSizes: true,
      activityHoverOptions: {
        position: () => this.getCompositeBarPosition() === CompositeBarPosition.BOTTOM ? HoverPosition.ABOVE : HoverPosition.BELOW
      },
      fillExtraContextMenuActions: (actions) => {
        if (this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
          const viewsSubmenuAction = this.getViewsSubmenuAction();
          if (viewsSubmenuAction) {
            actions.push(new Separator());
            actions.push(viewsSubmenuAction);
          }
        }
      },
      compositeSize: 0,
      iconSize: 16,
      overflowActionSize: 30,
      colors: (theme) => ({
        activeBackgroundColor: void 0,
        inactiveBackgroundColor: void 0,
        activeBorderBottomColor: theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER),
        activeForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND),
        inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND),
        badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
        badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
        dragAndDropBorder: theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER)
      }),
      compact: true
    };
  }
  shouldShowCompositeBar() {
    return false;
  }
  getCompositeBarPosition() {
    return CompositeBarPosition.TITLE;
  }
  async focusActivityBar() {
    if (this.shouldShowCompositeBar()) {
      this.focusCompositeBar();
    }
  }
  toJSON() {
    return {
      type: Parts.SIDEBAR_PART
    };
  }
};
SidebarPart = __decorateClass([
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
], SidebarPart);
export {
  SESSIONS_LIST_MINIMUM_WIDTH,
  SidebarPart
};
