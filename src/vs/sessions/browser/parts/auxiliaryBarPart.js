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
import "../../../workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css";
import "./media/auxiliaryBarPart.css";
import { localize } from "../../../nls.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { ActiveAuxiliaryContext, AuxiliaryBarFocusContext } from "../../../workbench/common/contextkeys.js";
import { ACTIVITY_BAR_TOP_ACTIVE_BORDER, ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER, ACTIVITY_BAR_TOP_FOREGROUND, ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND, PANEL_ACTIVE_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_DRAG_AND_DROP_BORDER, PANEL_INACTIVE_TITLE_FOREGROUND, SIDE_BAR_TITLE_BORDER } from "../../../workbench/common/theme.js";
import { agentsPanelBackground, agentsPanelBorder, agentsPanelForeground, agentsBadgeBackground, agentsBadgeForeground } from "../../common/theme.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../workbench/common/views.js";
import { IExtensionService } from "../../../workbench/services/extensions/common/extensions.js";
import { IWorkbenchLayoutService, Parts } from "../../../workbench/services/layout/browser/layoutService.js";
import { HoverPosition } from "../../../base/browser/ui/hover/hoverWidget.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { LayoutPriority } from "../../../base/browser/ui/splitview/splitview.js";
import { AbstractPaneCompositePart, CompositeBarPosition } from "../../../workbench/browser/parts/paneCompositePart.js";
import { Part } from "../../../workbench/browser/part.js";
import { ActionsOrientation } from "../../../base/browser/ui/actionbar/actionbar.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { Menus } from "../menus.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { DropdownWithPrimaryActionViewItem } from "../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { getFlatContextMenuActions } from "../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MutableDisposable } from "../../../base/common/lifecycle.js";
import { Extensions } from "../../../workbench/browser/panecomposite.js";
import { mainWindow } from "../../../base/browser/window.js";
let AuxiliaryBarPart = class extends AbstractPaneCompositePart {
  constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, menuService, configurationService) {
    super(
      Parts.AUXILIARYBAR_PART,
      {
        hasTitle: true,
        trailingSeparator: false,
        borderWidth: () => 0
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
      Menus.AuxiliaryBarTitle,
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
    // Run script dropdown management
    this._runScriptDropdown = this._register(new MutableDisposable());
    this._runScriptMenu = this._register(new MutableDisposable());
    this._runScriptMenuListener = this._register(new MutableDisposable());
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 0;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this.priority = LayoutPriority.Low;
    this._register(this.layoutService.onDidChangePartVisibility((e) => {
      if (e.partId === Parts.AUXILIARYBAR_PART || e.partId === Parts.EDITOR_PART) {
        this._onDidChange.fire(void 0);
      }
      if (e.partId === Parts.EDITOR_PART && this.dimension && this.contentPosition) {
        this.layout(this.dimension.width, this.dimension.height, this.contentPosition.top, this.contentPosition.left);
      }
    }));
  }
  static {
    this.activeViewSettingsKey = "workbench.agentsession.auxiliarybar.activepanelid";
  }
  static {
    this.pinnedViewsKey = "workbench.agentsession.auxiliarybar.pinnedPanels";
  }
  static {
    this.placeholderViewContainersKey = "workbench.agentsession.auxiliarybar.placeholderPanels";
  }
  static {
    this.viewContainersWorkspaceStateKey = "workbench.agentsession.auxiliarybar.viewContainersWorkspaceState";
  }
  static {
    /** Visual margin values for the card-like appearance (non-docked layout). */
    this.MARGIN_TOP = 0;
  }
  static {
    this.MARGIN_BOTTOM = 0;
  }
  static {
    this.CONTENT_PADDING_LEFT = 5;
  }
  static {
    // Action ID for run script - defined here to avoid layering issues
    this.RUN_SCRIPT_ACTION_ID = "workbench.action.agentSessions.runScript";
  }
  static {
    this.RUN_SCRIPT_DROPDOWN_MENU_ID = MenuId.for("AgentSessionsRunScriptDropdown");
  }
  static {
    this.DEFAULT_MINIMUM_WIDTH = 270;
  }
  // Sessions-specific auxiliary bar dimensions (intentionally not tied to the sessions SidebarPart values)
  get minimumWidth() {
    return AuxiliaryBarPart.DEFAULT_MINIMUM_WIDTH;
  }
  get snap() {
    return this.hasAttachedEditorRequiringSidebarSpace() ? false : super.snap;
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
  create(parent) {
    super.create(parent);
    parent.setAttribute("role", "complementary");
    parent.setAttribute("aria-label", localize("auxiliaryBarAriaLabel", "Session Details"));
  }
  updateStyles() {
    super.updateStyles();
    const container = assertReturnsDefined(this.getContainer());
    const backgroundColor = this.getPartBackgroundColor();
    container.style.setProperty("--part-background", backgroundColor);
    container.style.setProperty("--part-border-color", this.getColor(agentsPanelBorder) || "transparent");
    container.style.setProperty("--part-foreground", this.getColor(agentsPanelForeground) || "");
    container.style.backgroundColor = backgroundColor;
    container.style.borderLeftColor = "";
    container.style.borderRightColor = "";
    container.style.borderLeftStyle = "";
    container.style.borderRightStyle = "";
    container.style.borderLeftWidth = "";
    container.style.borderRightWidth = "";
  }
  /** The part background color. Overridden by the single-pane variant to match the editor. */
  getPartBackgroundColor() {
    return this.getColor(agentsPanelBackground) || "";
  }
  getCompositeBarOptions() {
    const $this = this;
    return {
      partContainerClass: "auxiliarybar",
      pinnedViewContainersKey: AuxiliaryBarPart.pinnedViewsKey,
      placeholderViewContainersKey: AuxiliaryBarPart.placeholderViewContainersKey,
      viewContainersWorkspaceStateKey: AuxiliaryBarPart.viewContainersWorkspaceStateKey,
      icon: false,
      orientation: ActionsOrientation.HORIZONTAL,
      recomputeSizes: true,
      activityHoverOptions: {
        position: () => this.getCompositeBarPosition() === CompositeBarPosition.BOTTOM ? HoverPosition.ABOVE : HoverPosition.BELOW
      },
      fillExtraContextMenuActions: (actions) => this.fillExtraContextMenuActions(actions),
      compositeSize: 0,
      iconSize: 16,
      get overflowActionSize() {
        return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? 40 : 30;
      },
      colors: (theme) => ({
        activeBackgroundColor: theme.getColor(agentsPanelBackground),
        inactiveBackgroundColor: theme.getColor(agentsPanelBackground),
        get activeBorderBottomColor() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_ACTIVE_TITLE_BORDER) : theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER);
        },
        get activeForegroundColor() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_ACTIVE_TITLE_FOREGROUND) : theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND);
        },
        get inactiveForegroundColor() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_INACTIVE_TITLE_FOREGROUND) : theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND);
        },
        badgeBackground: theme.getColor(agentsBadgeBackground),
        badgeForeground: theme.getColor(agentsBadgeForeground),
        get dragAndDropBorder() {
          return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_DRAG_AND_DROP_BORDER) : theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER);
        }
      }),
      compact: true
    };
  }
  actionViewItemProvider(action, options) {
    if (action.id === AuxiliaryBarPart.RUN_SCRIPT_ACTION_ID && action instanceof MenuItemAction) {
      if (!this._runScriptMenu.value) {
        this._runScriptMenu.value = this.menuService.createMenu(AuxiliaryBarPart.RUN_SCRIPT_DROPDOWN_MENU_ID, this.contextKeyService);
        this._runScriptMenuListener.value = this._runScriptMenu.value.onDidChange(() => this._updateRunScriptDropdown());
      }
      const dropdownActions = this._getRunScriptDropdownActions();
      const dropdownAction = {
        id: "runScriptDropdown",
        label: "",
        tooltip: "",
        class: void 0,
        enabled: true,
        run: () => {
        }
      };
      this._runScriptDropdown.value = this.instantiationService.createInstance(
        DropdownWithPrimaryActionViewItem,
        action,
        dropdownAction,
        dropdownActions,
        "",
        {
          hoverDelegate: options.hoverDelegate,
          getKeyBinding: (action2) => this.keybindingService.lookupKeybinding(action2.id, this.contextKeyService)
        }
      );
      return this._runScriptDropdown.value;
    }
    return super.actionViewItemProvider(action, options);
  }
  _getRunScriptDropdownActions() {
    if (!this._runScriptMenu.value) {
      return [];
    }
    return getFlatContextMenuActions(this._runScriptMenu.value.getActions({ shouldForwardArgs: true }));
  }
  _updateRunScriptDropdown() {
    if (this._runScriptDropdown.value) {
      const dropdownActions = this._getRunScriptDropdownActions();
      const dropdownAction = {
        id: "runScriptDropdown",
        label: "",
        tooltip: "",
        class: void 0,
        enabled: true,
        run: () => {
        }
      };
      this._runScriptDropdown.value.update(dropdownAction, dropdownActions);
    }
  }
  hasAttachedEditorRequiringSidebarSpace() {
    return this.layoutService.isVisible(Parts.AUXILIARYBAR_PART) && this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow);
  }
  fillExtraContextMenuActions(_actions) {
  }
  shouldShowCompositeBar() {
    return true;
  }
  getCompositeBarPosition() {
    return CompositeBarPosition.TITLE;
  }
  layout(width, height, top, left) {
    if (!this.layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
      return;
    }
    const borderTotal = 2;
    const editorVisible = this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow);
    const paddingLeft = editorVisible ? AuxiliaryBarPart.CONTENT_PADDING_LEFT : 0;
    const marginBottom = AuxiliaryBarPart.MARGIN_BOTTOM;
    super.layout(
      width - borderTotal - paddingLeft,
      height - AuxiliaryBarPart.MARGIN_TOP - marginBottom - borderTotal,
      top,
      left
    );
    Part.prototype.layout.call(this, width, height, top, left);
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
  __decorateParam(11, IMenuService),
  __decorateParam(12, IConfigurationService)
], AuxiliaryBarPart);
export {
  AuxiliaryBarPart
};
