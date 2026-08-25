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
import { Event } from "../../../base/common/event.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { AuxiliaryBarPart } from "./auxiliarybar/auxiliaryBarPart.js";
import { PanelPart } from "./panel/panelPart.js";
import { SidebarPart } from "./sidebar/sidebarPart.js";
import { ViewContainerLocation } from "../../common/views.js";
import { IPaneCompositePartService } from "../../services/panecomposite/browser/panecomposite.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
let PaneCompositePartService = class extends Disposable {
  constructor(instantiationService) {
    super();
    this.paneCompositeParts = /* @__PURE__ */ new Map();
    const panelPart = instantiationService.createInstance(PanelPart);
    const sideBarPart = instantiationService.createInstance(SidebarPart);
    const auxiliaryBarPart = instantiationService.createInstance(AuxiliaryBarPart);
    this.paneCompositeParts.set(ViewContainerLocation.Panel, panelPart);
    this.paneCompositeParts.set(ViewContainerLocation.Sidebar, sideBarPart);
    this.paneCompositeParts.set(ViewContainerLocation.AuxiliaryBar, auxiliaryBarPart);
    const viewContainerLocations = [ViewContainerLocation.Sidebar, ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar];
    const eventDisposables = this._register(new DisposableStore());
    this.onDidPaneCompositeOpen = Event.any(...viewContainerLocations.map((loc) => Event.map(this.paneCompositeParts.get(loc).onDidPaneCompositeOpen, (composite) => {
      return { composite, viewContainerLocation: loc };
    }, eventDisposables)));
    this.onDidPaneCompositeClose = Event.any(...viewContainerLocations.map((loc) => Event.map(this.paneCompositeParts.get(loc).onDidPaneCompositeClose, (composite) => {
      return { composite, viewContainerLocation: loc };
    }, eventDisposables)));
  }
  getRegistryId(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).registryId;
  }
  getPartId(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).partId;
  }
  openPaneComposite(id, viewContainerLocation, focus) {
    return this.getPartByLocation(viewContainerLocation).openPaneComposite(id, focus);
  }
  getActivePaneComposite(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getActivePaneComposite();
  }
  getPaneComposite(id, viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getPaneComposite(id);
  }
  getPaneComposites(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getPaneComposites();
  }
  getPinnedPaneCompositeIds(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getPinnedPaneCompositeIds();
  }
  getVisiblePaneCompositeIds(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getVisiblePaneCompositeIds();
  }
  getPaneCompositeIds(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getPaneCompositeIds();
  }
  getProgressIndicator(id, viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getProgressIndicator(id);
  }
  hideActivePaneComposite(viewContainerLocation) {
    this.getPartByLocation(viewContainerLocation).hideActivePaneComposite();
  }
  getLastActivePaneCompositeId(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getLastActivePaneCompositeId();
  }
  getPartByLocation(viewContainerLocation) {
    return assertReturnsDefined(this.paneCompositeParts.get(viewContainerLocation));
  }
};
PaneCompositePartService = __decorateClass([
  __decorateParam(0, IInstantiationService)
], PaneCompositePartService);
registerSingleton(IPaneCompositePartService, PaneCompositePartService, InstantiationType.Delayed);
export {
  PaneCompositePartService
};
