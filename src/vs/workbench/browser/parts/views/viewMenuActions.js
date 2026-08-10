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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { getActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuId, IMenuService } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IViewDescriptorService, ViewContainerLocationToString } from "../../../common/views.js";
let ViewMenuActions = class extends Disposable {
  constructor(menuId, contextMenuId, options, menuActionsOptions, contextKeyService, menuService) {
    super();
    this.menuId = menuId;
    this.contextMenuId = contextMenuId;
    this.options = options;
    this.menuActionsOptions = menuActionsOptions;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.menu = this._register(menuService.createMenu(menuId, contextKeyService, { emitEventsForSubmenuChanges: true }));
    this._register(this.menu.onDidChange(() => {
      this.actions = void 0;
      this._onDidChange.fire();
    }));
  }
  getActions() {
    if (!this.actions) {
      this.actions = getActionBarActions(this.menu.getActions(this.options), (group) => this.isPrimaryActionGroup(group), void 0, true);
    }
    return this.actions;
  }
  isPrimaryActionGroup(group) {
    if (group === "navigation") {
      return true;
    }
    if (this.menuActionsOptions?.primaryActionGroups) {
      return this.menuActionsOptions.primaryActionGroups.includes(group);
    }
    return false;
  }
  getPrimaryActions() {
    return this.getActions().primary;
  }
  getSecondaryActions() {
    return this.getActions().secondary;
  }
  getContextMenuActions() {
    if (this.contextMenuId) {
      const menu = this.menuService.getMenuActions(this.contextMenuId, this.contextKeyService, this.options);
      return getActionBarActions(menu).secondary;
    }
    return [];
  }
};
ViewMenuActions = __decorateClass([
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IMenuService)
], ViewMenuActions);
let ViewContainerMenuActions = class extends ViewMenuActions {
  constructor(element, viewContainer, menuActionsOptions, viewDescriptorService, contextKeyService, menuService) {
    const scopedContextKeyService = contextKeyService.createScoped(element);
    scopedContextKeyService.createKey("viewContainer", viewContainer.id);
    const viewContainerLocationKey = scopedContextKeyService.createKey("viewContainerLocation", ViewContainerLocationToString(viewDescriptorService.getViewContainerLocation(viewContainer)));
    super(MenuId.ViewContainerTitle, MenuId.ViewContainerTitleContext, { shouldForwardArgs: true, renderShortTitle: true }, menuActionsOptions, scopedContextKeyService, menuService);
    this._register(scopedContextKeyService);
    this._register(Event.filter(viewDescriptorService.onDidChangeContainerLocation, (e) => e.viewContainer === viewContainer)(() => viewContainerLocationKey.set(ViewContainerLocationToString(viewDescriptorService.getViewContainerLocation(viewContainer)))));
  }
};
ViewContainerMenuActions = __decorateClass([
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IMenuService)
], ViewContainerMenuActions);
export {
  ViewContainerMenuActions,
  ViewMenuActions
};
