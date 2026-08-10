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
import { Registry } from "../../platform/registry/common/platform.js";
import { Composite, CompositeDescriptor, CompositeRegistry } from "./composite.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { Separator } from "../../base/common/actions.js";
import { SubmenuItemAction } from "../../platform/actions/common/actions.js";
import { IContextMenuService } from "../../platform/contextview/browser/contextView.js";
import { IStorageService } from "../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../platform/theme/common/themeService.js";
import { IWorkspaceContextService } from "../../platform/workspace/common/workspace.js";
import { ViewsSubMenu } from "./parts/views/viewPaneContainer.js";
import { IExtensionService } from "../services/extensions/common/extensions.js";
import { VIEWPANE_FILTER_ACTION } from "./parts/views/viewPane.js";
let PaneComposite = class extends Composite {
  constructor(id, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService) {
    super(id, telemetryService, themeService, storageService);
    this.storageService = storageService;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this.extensionService = extensionService;
    this.contextService = contextService;
  }
  create(parent) {
    super.create(parent);
    this.viewPaneContainer = this._register(this.createViewPaneContainer(parent));
    this._register(this.viewPaneContainer.onTitleAreaUpdate(() => this.updateTitleArea()));
    this.viewPaneContainer.create(parent);
  }
  setVisible(visible) {
    super.setVisible(visible);
    this.viewPaneContainer?.setVisible(visible);
  }
  layout(dimension) {
    this.viewPaneContainer?.layout(dimension);
  }
  setBoundarySashes(sashes) {
    this.viewPaneContainer?.setBoundarySashes(sashes);
  }
  getOptimalWidth() {
    return this.viewPaneContainer?.getOptimalWidth() ?? 0;
  }
  openView(id, focus) {
    return this.viewPaneContainer?.openView(id, focus);
  }
  getViewPaneContainer() {
    return this.viewPaneContainer;
  }
  getActionsContext() {
    return this.getViewPaneContainer()?.getActionsContext();
  }
  getContextMenuActions() {
    return this.viewPaneContainer?.menuActions?.getContextMenuActions() ?? [];
  }
  getMenuIds() {
    const result = [];
    if (this.viewPaneContainer?.menuActions) {
      result.push(this.viewPaneContainer.menuActions.menuId);
      if (this.viewPaneContainer.isViewMergedWithContainer()) {
        result.push(this.viewPaneContainer.panes[0].menuActions.menuId);
      }
    }
    return result;
  }
  getActions() {
    const result = [];
    if (this.viewPaneContainer?.menuActions) {
      result.push(...this.viewPaneContainer.menuActions.getPrimaryActions());
      if (this.viewPaneContainer.isViewMergedWithContainer()) {
        const viewPane = this.viewPaneContainer.panes[0];
        if (viewPane.shouldShowFilterInHeader()) {
          result.push(VIEWPANE_FILTER_ACTION);
        }
        result.push(...viewPane.menuActions.getPrimaryActions());
      }
    }
    return result;
  }
  getSecondaryActions() {
    if (!this.viewPaneContainer?.menuActions) {
      return [];
    }
    const viewPaneActions = this.viewPaneContainer.isViewMergedWithContainer() ? this.viewPaneContainer.panes[0].menuActions.getSecondaryActions() : [];
    let menuActions = this.viewPaneContainer.menuActions.getSecondaryActions();
    const viewsSubmenuActionIndex = menuActions.findIndex((action) => action instanceof SubmenuItemAction && action.item.submenu === ViewsSubMenu);
    if (viewsSubmenuActionIndex !== -1) {
      const viewsSubmenuAction = menuActions[viewsSubmenuActionIndex];
      if (viewsSubmenuAction.actions.some(({ enabled }) => enabled)) {
        if (menuActions.length === 1 && viewPaneActions.length === 0) {
          menuActions = viewsSubmenuAction.actions.slice();
        } else if (viewsSubmenuActionIndex !== 0) {
          menuActions = [viewsSubmenuAction, ...menuActions.slice(0, viewsSubmenuActionIndex), ...menuActions.slice(viewsSubmenuActionIndex + 1)];
        }
      } else {
        menuActions.splice(viewsSubmenuActionIndex, 1);
      }
    }
    if (menuActions.length && viewPaneActions.length) {
      return [
        ...menuActions,
        new Separator(),
        ...viewPaneActions
      ];
    }
    return menuActions.length ? menuActions : viewPaneActions;
  }
  getActionViewItem(action, options) {
    return this.viewPaneContainer?.getActionViewItem(action, options);
  }
  getTitle() {
    return this.viewPaneContainer?.getTitle() ?? "";
  }
  focus() {
    super.focus();
    this.viewPaneContainer?.focus();
  }
};
PaneComposite = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IWorkspaceContextService)
], PaneComposite);
class PaneCompositeDescriptor extends CompositeDescriptor {
  constructor(ctor, id, name, cssClass, order, requestedIndex, iconUrl) {
    super(ctor, id, name, cssClass, order, requestedIndex);
    this.iconUrl = iconUrl;
  }
  static create(ctor, id, name, cssClass, order, requestedIndex, iconUrl) {
    return new PaneCompositeDescriptor(ctor, id, name, cssClass, order, requestedIndex, iconUrl);
  }
}
const Extensions = {
  Viewlets: "workbench.contributions.viewlets",
  Panels: "workbench.contributions.panels",
  Auxiliary: "workbench.contributions.auxiliary"
};
class PaneCompositeRegistry extends CompositeRegistry {
  /**
   * Registers a viewlet to the platform.
   */
  registerPaneComposite(descriptor) {
    super.registerComposite(descriptor);
  }
  /**
   * Deregisters a viewlet to the platform.
   */
  deregisterPaneComposite(id) {
    super.deregisterComposite(id);
  }
  /**
   * Returns the viewlet descriptor for the given id or null if none.
   */
  getPaneComposite(id) {
    return this.getComposite(id);
  }
  /**
   * Returns an array of registered viewlets known to the platform.
   */
  getPaneComposites() {
    return this.getComposites();
  }
}
Registry.add(Extensions.Viewlets, new PaneCompositeRegistry());
Registry.add(Extensions.Panels, new PaneCompositeRegistry());
Registry.add(Extensions.Auxiliary, new PaneCompositeRegistry());
export {
  Extensions,
  PaneComposite,
  PaneCompositeDescriptor,
  PaneCompositeRegistry
};
