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
import { Emitter } from "../../base/common/event.js";
import { assertReturnsDefined } from "../../base/common/types.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ViewContainerLocation } from "../../workbench/common/views.js";
import { IPaneCompositePartService } from "../../workbench/services/panecomposite/browser/panecomposite.js";
import { Disposable } from "../../base/common/lifecycle.js";
import { PanelPart } from "./parts/panelPart.js";
import { SidebarPart } from "./parts/sidebarPart.js";
import { AuxiliaryBarPart } from "./parts/auxiliaryBarPart.js";
import { MobilePanelPart } from "./parts/mobile/mobilePanelPart.js";
import { MobileSidebarPart } from "./parts/mobile/mobileSidebarPart.js";
import { MobileAuxiliaryBarPart } from "./parts/mobile/mobileAuxiliaryBarPart.js";
import { getClientArea } from "../../base/browser/dom.js";
import { mainWindow } from "../../base/browser/window.js";
import { InstantiationType, registerSingleton } from "../../platform/instantiation/common/extensions.js";
import { IEditorGroupsService } from "../../workbench/services/editor/common/editorGroupsService.js";
import { IAgentWorkbenchLayoutService } from "./workbench.js";
let AgenticPaneCompositePartService = class extends Disposable {
  constructor(instantiationService, layoutService, editorGroupsService) {
    super();
    this._onDidPaneCompositeOpen = this._register(new Emitter());
    this.onDidPaneCompositeOpen = this._onDidPaneCompositeOpen.event;
    this._onDidPaneCompositeClose = this._register(new Emitter());
    this.onDidPaneCompositeClose = this._onDidPaneCompositeClose.event;
    this.paneCompositeParts = /* @__PURE__ */ new Map();
    const { width } = getClientArea(mainWindow.document.body);
    const isPhoneLayout = width < 640;
    this.registerPart(ViewContainerLocation.Panel, instantiationService.createInstance(isPhoneLayout ? MobilePanelPart : PanelPart));
    this.registerPart(ViewContainerLocation.Sidebar, instantiationService.createInstance(isPhoneLayout ? MobileSidebarPart : SidebarPart));
    const auxiliaryBarPart = layoutService.isSinglePaneLayoutEnabled ? editorGroupsService.mainPart.auxiliaryBar : instantiationService.createInstance(isPhoneLayout ? MobileAuxiliaryBarPart : AuxiliaryBarPart);
    this.registerPart(ViewContainerLocation.AuxiliaryBar, auxiliaryBarPart);
  }
  registerPart(location, part) {
    this.paneCompositeParts.set(location, part);
    this._register(part.onDidPaneCompositeOpen((composite) => this._onDidPaneCompositeOpen.fire({ composite, viewContainerLocation: location })));
    this._register(part.onDidPaneCompositeClose((composite) => this._onDidPaneCompositeClose.fire({ composite, viewContainerLocation: location })));
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
AgenticPaneCompositePartService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IAgentWorkbenchLayoutService),
  __decorateParam(2, IEditorGroupsService)
], AgenticPaneCompositePartService);
registerSingleton(IPaneCompositePartService, AgenticPaneCompositePartService, InstantiationType.Delayed);
export {
  AgenticPaneCompositePartService
};
