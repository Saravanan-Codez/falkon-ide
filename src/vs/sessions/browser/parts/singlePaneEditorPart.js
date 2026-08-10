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
import { mainWindow } from "../../../base/browser/window.js";
import { DisposableMap, MutableDisposable } from "../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { IWorkbenchLayoutService, Parts } from "../../../workbench/services/layout/browser/layoutService.js";
import { IHostService } from "../../../workbench/services/host/browser/host.js";
import { DockedAuxiliaryBarController } from "../dockedAuxiliaryBarController.js";
import { Menus } from "../menus.js";
import { MainEditorPart } from "./editorPart.js";
import { SinglePaneAuxiliaryBarPart } from "./singlePaneAuxiliaryBarPart.js";
let SinglePaneMainEditorPart = class extends MainEditorPart {
  constructor(editorPartsView, _instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService) {
    super(editorPartsView, _instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService);
    this._instantiationService = _instantiationService;
    this._groupRelayoutListeners = this._register(new DisposableMap());
    const tabsOverride = this._register(new MutableDisposable());
    let enforcedShowTabs;
    const updateTabsOverride = () => {
      const nextShowTabs = this._getShowTabsOverride(
        configurationService.getValue("workbench.editor.showTabs"),
        layoutService.isVisible(Parts.EDITOR_PART, mainWindow),
        layoutService.isVisible(Parts.AUXILIARYBAR_PART, mainWindow)
      );
      if (nextShowTabs === enforcedShowTabs) {
        return;
      }
      enforcedShowTabs = nextShowTabs;
      tabsOverride.value = nextShowTabs ? this.enforcePartOptions({ showTabs: nextShowTabs }) : void 0;
    };
    this._register(configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("workbench.editor.showTabs")) {
        updateTabsOverride();
      }
    }));
    this._register(layoutService.onDidChangePartVisibility((event) => {
      if (event.partId === Parts.EDITOR_PART || event.partId === Parts.AUXILIARYBAR_PART) {
        updateTabsOverride();
      }
    }));
    updateTabsOverride();
  }
  getGroupViewOptions() {
    return {
      menuIds: {
        headerPrimary: Menus.SessionsEditorHeaderPrimary,
        headerSecondary: Menus.SessionsEditorHeaderSecondary,
        headerLayout: Menus.SessionsEditorHeaderLayout,
        editorActions: Menus.SessionsEditorTitle,
        tabsBarContext: Menus.SessionsEditorTabsBarContext,
        tabsBarAddTab: Menus.SessionsEditorTabsBarAddTab
      },
      showHeader: true
    };
  }
  // Double-click resets detail-only to its default; with editor content visible
  // the grid distributes the Sessions and editor siblings evenly.
  get preferredWidth() {
    if (!this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
      return DockedAuxiliaryBarController.DEFAULT_WIDTH;
    }
    return void 0;
  }
  // Matches the sessions list's minimum while only the detail panel is shown.
  get minimumWidth() {
    if (!this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
      return DockedAuxiliaryBarController.NO_EDITOR_MIN_WIDTH;
    }
    return super.minimumWidth;
  }
  // Snap-collapse via sash-drag, like the sessions list, only when detail-only.
  get snap() {
    return !this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow);
  }
  _getShowTabsOverride(configuredShowTabs, editorVisible, auxiliaryBarVisible) {
    if (auxiliaryBarVisible && !editorVisible) {
      return "multiple";
    }
    return configuredShowTabs === "none" ? "single" : void 0;
  }
  /**
   * The auxiliary bar owned by this editor part, created on first access. The
   * pane composite service reads this so both share the same instance.
   */
  get auxiliaryBar() {
    if (!this._auxiliaryBar) {
      this._auxiliaryBar = this._register(this._instantiationService.createInstance(SinglePaneAuxiliaryBarPart));
    }
    return this._auxiliaryBar;
  }
  /**
   * Creates the editor part's DOM. Besides the base content (the editor grid), the
   * single-pane part docks the auxiliary bar here — in the same place the base part
   * creates its content — and enables the header separator border on every group.
   */
  createContentArea(parent, options) {
    const container = super.createContentArea(parent, options);
    this._registerGroupRelayoutListeners();
    const layoutService = this.layoutService;
    this._dockedAuxBar = this._register(new DockedAuxiliaryBarController(
      this.element,
      this.auxiliaryBar,
      {
        getWidth: () => layoutService.getDockedAuxiliaryBarWidth(),
        setWidth: (width) => layoutService.setDockedAuxiliaryBarWidth(width),
        isEditorAreaVisible: () => layoutService.isVisible(Parts.EDITOR_PART, mainWindow) || layoutService.isVisible(Parts.AUXILIARYBAR_PART),
        isEditorVisible: () => layoutService.isVisible(Parts.EDITOR_PART, mainWindow),
        isAuxiliaryBarVisible: () => layoutService.isVisible(Parts.AUXILIARYBAR_PART),
        hideAuxiliaryBar: () => layoutService.setAuxiliaryBarHiddenForResize(true),
        setEditorContentRightInset: (px) => this.setContentRightInset(px),
        getHeaderHeight: () => {
          const { total, offset } = this.activeGroup.titleHeight;
          return total - offset;
        }
      }
    ));
    return container;
  }
  /**
   * Keeps the docked auxiliary bar aligned after group-local relayouts.
   */
  _registerGroupRelayoutListeners() {
    for (const group of this.groups) {
      this._registerGroupRelayoutListener(group);
    }
    this._register(this.onDidAddGroup((group) => this._registerGroupRelayoutListener(group)));
    this._register(this.onDidRemoveGroup((group) => this._groupRelayoutListeners.deleteAndDispose(group)));
  }
  _registerGroupRelayoutListener(group) {
    this._groupRelayoutListeners.set(group, group.onDidRelayout(() => this._dockedAuxBar?.layout()));
  }
  layout(width, height, top, left) {
    super.layout(width, height, top, left);
    this.layoutService.handleDockedEditorPartLayout(width);
    this._dockedAuxBar?.layout();
  }
  /** Re-layouts the docked auxiliary bar. Called by the workbench on layout changes. */
  layoutDockedAuxiliaryBar() {
    this._dockedAuxBar?.layout();
  }
};
SinglePaneMainEditorPart = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IHostService),
  __decorateParam(7, IContextKeyService)
], SinglePaneMainEditorPart);
export {
  SinglePaneMainEditorPart
};
