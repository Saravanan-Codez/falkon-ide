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
import { ViewContainerLocation, IViewDescriptorService, Extensions as ViewExtensions, ViewVisibilityState, defaultViewIcon, ViewContainerLocationToString, VIEWS_LOG_ID, VIEWS_LOG_NAME, WindowEnablement } from "../../../common/views.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { toDisposable, DisposableStore, Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { ViewPaneContainer, ViewPaneContainerAction, ViewsSubMenu } from "../../../browser/parts/views/viewPaneContainer.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { getViewsStateStorageId, ViewContainerModel } from "../common/viewContainerModel.js";
import { registerAction2, Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { localize, localize2 } from "../../../../nls.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { IViewsService } from "../common/viewsService.js";
import { windowLogGroup } from "../../log/common/logConstants.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
function getViewContainerStorageId(viewContainerId) {
  return `${viewContainerId}.state`;
}
let ViewDescriptorService = class extends Disposable {
  constructor(instantiationService, contextKeyService, storageService, extensionService, telemetryService, loggerService, environmentService) {
    super();
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.telemetryService = telemetryService;
    this._onDidChangeContainer = this._register(new Emitter());
    this.onDidChangeContainer = this._onDidChangeContainer.event;
    this._onDidChangeLocation = this._register(new Emitter());
    this.onDidChangeLocation = this._onDidChangeLocation.event;
    this._onDidChangeContainerLocation = this._register(new Emitter());
    this.onDidChangeContainerLocation = this._onDidChangeContainerLocation.event;
    this.viewContainerModels = this._register(new DisposableMap());
    this.viewsVisibilityActionDisposables = this._register(new DisposableMap());
    this.canRegisterViewsVisibilityActions = false;
    this._onDidChangeViewContainers = this._register(new Emitter());
    this.onDidChangeViewContainers = this._onDidChangeViewContainers.event;
    this.logger = new Lazy(() => loggerService.createLogger(VIEWS_LOG_ID, { name: VIEWS_LOG_NAME, group: windowLogGroup }));
    this.isSessionsWindow = environmentService.isSessionsWindow;
    this.activeViewContextKeys = /* @__PURE__ */ new Map();
    this.movableViewContextKeys = /* @__PURE__ */ new Map();
    this.defaultViewLocationContextKeys = /* @__PURE__ */ new Map();
    this.defaultViewContainerLocationContextKeys = /* @__PURE__ */ new Map();
    this.viewContainersRegistry = Registry.as(ViewExtensions.ViewContainersRegistry);
    this.viewsRegistry = Registry.as(ViewExtensions.ViewsRegistry);
    this.migrateToViewsCustomizationsStorage();
    this.viewContainersCustomLocations = new Map(Object.entries(this.viewCustomizations.viewContainerLocations));
    this.viewDescriptorsCustomLocations = new Map(Object.entries(this.viewCustomizations.viewLocations));
    this.viewContainerBadgeEnablementStates = new Map(Object.entries(this.viewCustomizations.viewContainerBadgeEnablementStates));
    this.viewContainers.forEach((viewContainer) => this.onDidRegisterViewContainer(viewContainer));
    this._register(this.viewsRegistry.onViewsRegistered((views) => this.onDidRegisterViews(views)));
    this._register(this.viewsRegistry.onViewsDeregistered(({ views, viewContainer }) => this.onDidDeregisterViews(views, viewContainer)));
    this._register(this.viewsRegistry.onDidChangeContainer(({ views, from, to }) => this.onDidChangeDefaultContainer(views, from, to)));
    this._register(this.viewContainersRegistry.onDidRegister(({ viewContainer }) => {
      if (!this.isViewContainerEnabled(viewContainer)) {
        return;
      }
      this.onDidRegisterViewContainer(viewContainer);
      this._onDidChangeViewContainers.fire({ added: [{ container: viewContainer, location: this.getViewContainerLocation(viewContainer) }], removed: [] });
    }));
    this._register(this.viewContainersRegistry.onDidDeregister(({ viewContainer, viewContainerLocation }) => {
      if (!this.isViewContainerEnabled(viewContainer)) {
        return;
      }
      this.onDidDeregisterViewContainer(viewContainer);
      this._onDidChangeViewContainers.fire({ removed: [{ container: viewContainer, location: viewContainerLocation }], added: [] });
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, ViewDescriptorService.VIEWS_CUSTOMIZATIONS, this._store)(() => this.onDidStorageChange()));
    this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered());
  }
  static {
    this.VIEWS_CUSTOMIZATIONS = "views.customizations";
  }
  static {
    this.COMMON_CONTAINER_ID_PREFIX = "workbench.views.service";
  }
  get viewContainers() {
    return this.viewContainersRegistry.all.filter((vc) => this.isViewContainerEnabled(vc));
  }
  migrateToViewsCustomizationsStorage() {
    if (this.storageService.get(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, StorageScope.PROFILE)) {
      return;
    }
    const viewContainerLocationsValue = this.storageService.get("views.cachedViewContainerLocations", StorageScope.PROFILE);
    const viewDescriptorLocationsValue = this.storageService.get("views.cachedViewPositions", StorageScope.PROFILE);
    if (!viewContainerLocationsValue && !viewDescriptorLocationsValue) {
      return;
    }
    const viewContainerLocations = viewContainerLocationsValue ? JSON.parse(viewContainerLocationsValue) : [];
    const viewDescriptorLocations = viewDescriptorLocationsValue ? JSON.parse(viewDescriptorLocationsValue) : [];
    const viewsCustomizations = {
      viewContainerLocations: viewContainerLocations.reduce((result, [id, location]) => {
        result[id] = location;
        return result;
      }, {}),
      viewLocations: viewDescriptorLocations.reduce((result, [id, { containerId }]) => {
        result[id] = containerId;
        return result;
      }, {}),
      viewContainerBadgeEnablementStates: {}
    };
    this.storageService.store(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    this.storageService.remove("views.cachedViewContainerLocations", StorageScope.PROFILE);
    this.storageService.remove("views.cachedViewPositions", StorageScope.PROFILE);
  }
  registerGroupedViews(groupedViews) {
    for (const [containerId, views] of groupedViews.entries()) {
      const viewContainer = this.getViewContainerById(containerId);
      if (!viewContainer || !this.viewContainerModels.has(viewContainer)) {
        if (this.isGeneratedContainerId(containerId)) {
          const viewContainerLocation = this.viewContainersCustomLocations.get(containerId);
          if (viewContainerLocation !== void 0) {
            this.registerGeneratedViewContainer(viewContainerLocation, containerId);
          }
        }
        continue;
      }
      const viewsToAdd = views.filter((view) => this.getViewContainerModel(viewContainer).allViewDescriptors.filter((vd) => vd.id === view.id).length === 0);
      this.addViews(viewContainer, viewsToAdd);
    }
  }
  deregisterGroupedViews(groupedViews) {
    for (const [viewContainerId, views] of groupedViews.entries()) {
      const viewContainer = this.getViewContainerById(viewContainerId);
      if (!viewContainer || !this.viewContainerModels.has(viewContainer)) {
        continue;
      }
      this.removeViews(viewContainer, views);
    }
  }
  moveOrphanViewsToDefaultLocation() {
    for (const [viewId, containerId] of this.viewDescriptorsCustomLocations.entries()) {
      if (this.getViewContainerById(containerId)) {
        continue;
      }
      const viewContainer = this.viewsRegistry.getViewContainer(viewId);
      const viewDescriptor = this.getViewDescriptorById(viewId);
      if (viewContainer && viewDescriptor) {
        this.addViews(viewContainer, [viewDescriptor]);
      }
    }
  }
  whenExtensionsRegistered() {
    this.moveOrphanViewsToDefaultLocation();
    for (const viewContainerId of [...this.viewContainersCustomLocations.keys()]) {
      this.cleanUpGeneratedViewContainer(viewContainerId);
    }
    this.saveViewCustomizations();
    for (const [key, value] of this.viewContainerModels) {
      this.registerViewsVisibilityActions(key, value);
    }
    this.canRegisterViewsVisibilityActions = true;
  }
  onDidRegisterViews(views) {
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach(({ views: views2, viewContainer }) => {
        const regroupedViews = this.regroupViews(viewContainer.id, views2);
        this.registerGroupedViews(regroupedViews);
        views2.forEach((viewDescriptor) => this.getOrCreateMovableViewContextKey(viewDescriptor).set(!!viewDescriptor.canMoveView));
      });
    });
  }
  isGeneratedContainerId(id) {
    return id.startsWith(ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX);
  }
  onDidDeregisterViews(views, viewContainer) {
    const regroupedViews = this.regroupViews(viewContainer.id, views);
    this.deregisterGroupedViews(regroupedViews);
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach((viewDescriptor) => this.getOrCreateMovableViewContextKey(viewDescriptor).set(false));
    });
  }
  regroupViews(containerId, views) {
    const viewsByContainer = /* @__PURE__ */ new Map();
    for (const viewDescriptor of views) {
      const correctContainerId = this.viewDescriptorsCustomLocations.get(viewDescriptor.id) ?? containerId;
      let containerViews = viewsByContainer.get(correctContainerId);
      if (!containerViews) {
        viewsByContainer.set(correctContainerId, containerViews = []);
      }
      containerViews.push(viewDescriptor);
    }
    return viewsByContainer;
  }
  getViewDescriptorById(viewId) {
    const view = this.viewsRegistry.getView(viewId);
    if (view && !this.isViewEnabled(view)) {
      return null;
    }
    return view;
  }
  getViewLocationById(viewId) {
    const container = this.getViewContainerByViewId(viewId);
    if (container === null) {
      return null;
    }
    return this.getViewContainerLocation(container);
  }
  getViewContainerByViewId(viewId) {
    const view = this.viewsRegistry.getView(viewId);
    if (view && !this.isViewEnabled(view)) {
      return null;
    }
    const containerId = this.viewDescriptorsCustomLocations.get(viewId);
    return containerId ? this.getViewContainerById(containerId) : this.getDefaultContainerById(viewId);
  }
  getViewContainerLocation(viewContainer) {
    return this.viewContainersCustomLocations.get(viewContainer.id) ?? this.getDefaultViewContainerLocation(viewContainer);
  }
  getDefaultViewContainerLocation(viewContainer) {
    return this.viewContainersRegistry.getViewContainerLocation(viewContainer);
  }
  getDefaultContainerById(viewId) {
    return this.viewsRegistry.getViewContainer(viewId) ?? null;
  }
  getViewContainerModel(container) {
    return this.getOrRegisterViewContainerModel(container);
  }
  getViewContainerById(id) {
    return this.viewContainers.find((vc) => vc.id === id) ?? null;
  }
  getViewContainersByLocation(location) {
    return this.viewContainers.filter((v) => this.getViewContainerLocation(v) === location);
  }
  isViewContainerEnabled(viewContainer) {
    return this.isEnabled(viewContainer.windowEnablement);
  }
  isViewEnabled(view) {
    return this.isEnabled(view.windowEnablement);
  }
  isEnabled(enablement) {
    if (this.isSessionsWindow) {
      return enablement === WindowEnablement.Sessions || enablement === WindowEnablement.Both;
    }
    return !enablement || enablement === WindowEnablement.Editor || enablement === WindowEnablement.Both;
  }
  getDefaultViewContainer(location) {
    const viewContainers = this.viewContainersRegistry.getDefaultViewContainers(location);
    return viewContainers.find((viewContainer) => this.isViewContainerEnabled(viewContainer));
  }
  canMoveViews() {
    return !this.isSessionsWindow;
  }
  moveViewContainerToLocation(viewContainer, location, requestedIndex, reason) {
    if (!this.canMoveViews()) {
      return;
    }
    this.logger.value.trace(`moveViewContainerToLocation: viewContainer:${viewContainer.id} location:${location} reason:${reason}`);
    this.moveViewContainerToLocationWithoutSaving(viewContainer, location, requestedIndex);
    this.saveViewCustomizations();
  }
  getViewContainerBadgeEnablementState(id) {
    return this.viewContainerBadgeEnablementStates.get(id) ?? true;
  }
  setViewContainerBadgeEnablementState(id, badgesEnabled) {
    this.viewContainerBadgeEnablementStates.set(id, badgesEnabled);
    this.saveViewCustomizations();
  }
  moveViewToLocation(view, location, reason) {
    if (!this.canMoveViews()) {
      return;
    }
    this.logger.value.trace(`moveViewToLocation: view:${view.id} location:${location} reason:${reason}`);
    const container = this.registerGeneratedViewContainer(location);
    this.moveViewsToContainer([view], container);
  }
  moveViewsToContainer(views, viewContainer, visibilityState, reason) {
    if (!views.length) {
      return;
    }
    if (!this.canMoveViews()) {
      return;
    }
    this.logger.value.trace(`moveViewsToContainer: views:${views.map((view) => view.id).join(",")} viewContainer:${viewContainer.id} reason:${reason}`);
    const from = this.getViewContainerByViewId(views[0].id);
    const to = viewContainer;
    if (from && to && from !== to) {
      this.moveViewsWithoutSaving(views, from, to, visibilityState);
      this.cleanUpGeneratedViewContainer(from.id);
      this.saveViewCustomizations();
      this.reportMovedViews(views, from, to);
    }
  }
  reset() {
    for (const viewContainer of this.viewContainers) {
      const viewContainerModel = this.getViewContainerModel(viewContainer);
      for (const viewDescriptor of viewContainerModel.allViewDescriptors) {
        const defaultContainer = this.getDefaultContainerById(viewDescriptor.id);
        const currentContainer = this.getViewContainerByViewId(viewDescriptor.id);
        if (currentContainer && defaultContainer && currentContainer !== defaultContainer) {
          this.moveViewsWithoutSaving([viewDescriptor], currentContainer, defaultContainer);
        }
      }
      const defaultContainerLocation = this.getDefaultViewContainerLocation(viewContainer);
      const currentContainerLocation = this.getViewContainerLocation(viewContainer);
      if (defaultContainerLocation !== null && currentContainerLocation !== defaultContainerLocation) {
        this.moveViewContainerToLocationWithoutSaving(viewContainer, defaultContainerLocation);
      }
      this.cleanUpGeneratedViewContainer(viewContainer.id);
    }
    this.viewContainersCustomLocations.clear();
    this.viewDescriptorsCustomLocations.clear();
    this.saveViewCustomizations();
  }
  isViewContainerRemovedPermanently(viewContainerId) {
    return this.isGeneratedContainerId(viewContainerId) && !this.viewContainersCustomLocations.has(viewContainerId);
  }
  onDidChangeDefaultContainer(views, from, to) {
    const viewsToMove = views.filter(
      (view) => !this.viewDescriptorsCustomLocations.has(view.id) || !this.viewContainers.includes(from) && this.viewDescriptorsCustomLocations.get(view.id) === from.id
      // Move views which are moved from a removed container
    );
    if (viewsToMove.length) {
      this.moveViewsWithoutSaving(viewsToMove, from, to);
    }
  }
  reportMovedViews(views, from, to) {
    const containerToString = (container) => {
      if (container.id.startsWith(ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX)) {
        return "custom";
      }
      if (!container.extensionId) {
        return container.id;
      }
      return "extension";
    };
    const oldLocation = this.getViewContainerLocation(from);
    const newLocation = this.getViewContainerLocation(to);
    const viewCount = views.length;
    const fromContainer = containerToString(from);
    const toContainer = containerToString(to);
    const fromLocation = oldLocation === ViewContainerLocation.Panel ? "panel" : "sidebar";
    const toLocation = newLocation === ViewContainerLocation.Panel ? "panel" : "sidebar";
    this.telemetryService.publicLog2("viewDescriptorService.moveViews", { viewCount, fromContainer, toContainer, fromLocation, toLocation });
  }
  moveViewsWithoutSaving(views, from, to, visibilityState = ViewVisibilityState.Expand) {
    this.removeViews(from, views);
    this.addViews(to, views, visibilityState);
    const oldLocation = this.getViewContainerLocation(from);
    const newLocation = this.getViewContainerLocation(to);
    if (oldLocation !== newLocation) {
      this._onDidChangeLocation.fire({ views, from: oldLocation, to: newLocation });
    }
    this._onDidChangeContainer.fire({ views, from, to });
  }
  moveViewContainerToLocationWithoutSaving(viewContainer, location, requestedIndex) {
    const from = this.getViewContainerLocation(viewContainer);
    const to = location;
    if (from !== to) {
      const isGeneratedViewContainer = this.isGeneratedContainerId(viewContainer.id);
      const isDefaultViewContainerLocation = to === this.getDefaultViewContainerLocation(viewContainer);
      if (isGeneratedViewContainer || !isDefaultViewContainerLocation) {
        this.viewContainersCustomLocations.set(viewContainer.id, to);
      } else {
        this.viewContainersCustomLocations.delete(viewContainer.id);
      }
      this.getOrCreateDefaultViewContainerLocationContextKey(viewContainer).set(isGeneratedViewContainer || isDefaultViewContainerLocation);
      viewContainer.requestedIndex = requestedIndex;
      this._onDidChangeContainerLocation.fire({ viewContainer, from, to });
      const views = this.getViewsByContainer(viewContainer);
      this._onDidChangeLocation.fire({ views, from, to });
    }
  }
  cleanUpGeneratedViewContainer(viewContainerId) {
    if (!this.isGeneratedContainerId(viewContainerId)) {
      return;
    }
    const viewContainer = this.getViewContainerById(viewContainerId);
    if (viewContainer && this.getViewContainerModel(viewContainer)?.allViewDescriptors.length) {
      return;
    }
    if ([...this.viewDescriptorsCustomLocations.values()].includes(viewContainerId)) {
      return;
    }
    if (viewContainer) {
      this.viewContainersRegistry.deregisterViewContainer(viewContainer);
    }
    this.viewContainersCustomLocations.delete(viewContainerId);
    this.viewContainerBadgeEnablementStates.delete(viewContainerId);
    this.storageService.remove(getViewsStateStorageId(viewContainer?.storageId || getViewContainerStorageId(viewContainerId)), StorageScope.PROFILE);
  }
  registerGeneratedViewContainer(location, existingId) {
    const id = existingId || this.generateContainerId(location);
    const container = this.viewContainersRegistry.registerViewContainer({
      id,
      ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [id, { mergeViewWithContainerWhenSingleView: true }]),
      title: { value: localize("user", "User View Container"), original: "User View Container" },
      // having a placeholder title - this should not be shown anywhere
      icon: location === ViewContainerLocation.Sidebar ? defaultViewIcon : void 0,
      storageId: getViewContainerStorageId(id),
      hideIfEmpty: true
    }, location, { doNotRegisterOpenCommand: true });
    if (this.viewContainersCustomLocations.get(container.id) !== location) {
      this.viewContainersCustomLocations.set(container.id, location);
    }
    this.getOrCreateDefaultViewContainerLocationContextKey(container).set(true);
    return container;
  }
  onDidStorageChange() {
    if (JSON.stringify(this.viewCustomizations) !== this.getStoredViewCustomizationsValue()) {
      this.onDidViewCustomizationsStorageChange();
    }
  }
  onDidViewCustomizationsStorageChange() {
    this._viewCustomizations = void 0;
    const newViewContainerCustomizations = new Map(Object.entries(this.viewCustomizations.viewContainerLocations));
    const newViewDescriptorCustomizations = new Map(Object.entries(this.viewCustomizations.viewLocations));
    const viewContainersToMove = [];
    const viewsToMove = [];
    for (const [containerId, location] of newViewContainerCustomizations.entries()) {
      const container = this.getViewContainerById(containerId);
      if (container) {
        if (location !== this.getViewContainerLocation(container)) {
          viewContainersToMove.push([container, location]);
        }
      } else if (this.isGeneratedContainerId(containerId)) {
        this.registerGeneratedViewContainer(location, containerId);
      }
    }
    for (const viewContainer of this.viewContainers) {
      if (!newViewContainerCustomizations.has(viewContainer.id)) {
        const currentLocation = this.getViewContainerLocation(viewContainer);
        const defaultLocation = this.getDefaultViewContainerLocation(viewContainer);
        if (currentLocation !== defaultLocation) {
          viewContainersToMove.push([viewContainer, defaultLocation]);
        }
      }
    }
    for (const [viewId, viewContainerId] of newViewDescriptorCustomizations.entries()) {
      const viewDescriptor = this.getViewDescriptorById(viewId);
      if (viewDescriptor) {
        const prevViewContainer = this.getViewContainerByViewId(viewId);
        const newViewContainer = this.getViewContainerById(viewContainerId);
        if (prevViewContainer && newViewContainer && newViewContainer !== prevViewContainer) {
          viewsToMove.push({ views: [viewDescriptor], from: prevViewContainer, to: newViewContainer });
        }
      }
    }
    for (const viewContainer of this.viewContainers) {
      const viewContainerModel = this.getViewContainerModel(viewContainer);
      for (const viewDescriptor of viewContainerModel.allViewDescriptors) {
        if (!newViewDescriptorCustomizations.has(viewDescriptor.id)) {
          const currentContainer = this.getViewContainerByViewId(viewDescriptor.id);
          const defaultContainer = this.getDefaultContainerById(viewDescriptor.id);
          if (currentContainer && defaultContainer && currentContainer !== defaultContainer) {
            viewsToMove.push({ views: [viewDescriptor], from: currentContainer, to: defaultContainer });
          }
        }
      }
    }
    for (const [container, location] of viewContainersToMove) {
      this.moveViewContainerToLocationWithoutSaving(container, location);
    }
    for (const { views, from, to } of viewsToMove) {
      this.moveViewsWithoutSaving(views, from, to, ViewVisibilityState.Default);
    }
    this.viewContainersCustomLocations = newViewContainerCustomizations;
    this.viewDescriptorsCustomLocations = newViewDescriptorCustomizations;
  }
  // Generated Container Id Format
  // {Common Prefix}.{Location}.{Uniqueness Id}
  // Old Format (deprecated)
  // {Common Prefix}.{Uniqueness Id}.{Source View Id}
  generateContainerId(location) {
    return `${ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX}.${ViewContainerLocationToString(location)}.${generateUuid()}`;
  }
  saveViewCustomizations() {
    const viewCustomizations = { viewContainerLocations: {}, viewLocations: {}, viewContainerBadgeEnablementStates: {} };
    for (const [containerId, location] of this.viewContainersCustomLocations) {
      const container = this.getViewContainerById(containerId);
      if (container && !this.isGeneratedContainerId(containerId) && location === this.getDefaultViewContainerLocation(container)) {
        continue;
      }
      viewCustomizations.viewContainerLocations[containerId] = location;
    }
    for (const [viewId, viewContainerId] of this.viewDescriptorsCustomLocations) {
      const viewContainer = this.getViewContainerById(viewContainerId);
      if (viewContainer) {
        const defaultContainer = this.getDefaultContainerById(viewId);
        if (defaultContainer?.id === viewContainer.id) {
          continue;
        }
      }
      viewCustomizations.viewLocations[viewId] = viewContainerId;
    }
    for (const [viewContainerId, badgeEnablementState] of this.viewContainerBadgeEnablementStates) {
      if (badgeEnablementState === false) {
        viewCustomizations.viewContainerBadgeEnablementStates[viewContainerId] = badgeEnablementState;
      }
    }
    this.viewCustomizations = viewCustomizations;
  }
  get viewCustomizations() {
    if (!this._viewCustomizations) {
      this._viewCustomizations = JSON.parse(this.getStoredViewCustomizationsValue());
      this._viewCustomizations.viewContainerLocations = this._viewCustomizations.viewContainerLocations ?? {};
      this._viewCustomizations.viewLocations = this._viewCustomizations.viewLocations ?? {};
      this._viewCustomizations.viewContainerBadgeEnablementStates = this._viewCustomizations.viewContainerBadgeEnablementStates ?? {};
    }
    return this._viewCustomizations;
  }
  set viewCustomizations(viewCustomizations) {
    const value = JSON.stringify(viewCustomizations);
    if (JSON.stringify(this.viewCustomizations) !== value) {
      this._viewCustomizations = viewCustomizations;
      this.setStoredViewCustomizationsValue(value);
    }
  }
  getStoredViewCustomizationsValue() {
    if (this.isSessionsWindow) {
      return "{}";
    }
    return this.storageService.get(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, StorageScope.PROFILE, "{}");
  }
  setStoredViewCustomizationsValue(value) {
    if (this.isSessionsWindow) {
      return;
    }
    this.storageService.store(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, value, StorageScope.PROFILE, StorageTarget.USER);
  }
  getViewsByContainer(viewContainer) {
    const result = this.viewsRegistry.getViews(viewContainer).filter((viewDescriptor) => {
      const viewDescriptorViewContainerId = this.viewDescriptorsCustomLocations.get(viewDescriptor.id) ?? viewContainer.id;
      return viewDescriptorViewContainerId === viewContainer.id;
    });
    for (const [viewId, viewContainerId] of this.viewDescriptorsCustomLocations.entries()) {
      if (viewContainerId !== viewContainer.id) {
        continue;
      }
      if (this.viewsRegistry.getViewContainer(viewId) === viewContainer) {
        continue;
      }
      const viewDescriptor = this.getViewDescriptorById(viewId);
      if (viewDescriptor) {
        result.push(viewDescriptor);
      }
    }
    return result;
  }
  onDidRegisterViewContainer(viewContainer) {
    const defaultLocation = this.isGeneratedContainerId(viewContainer.id) ? true : this.getViewContainerLocation(viewContainer) === this.getDefaultViewContainerLocation(viewContainer);
    this.getOrCreateDefaultViewContainerLocationContextKey(viewContainer).set(defaultLocation);
    this.getOrRegisterViewContainerModel(viewContainer);
  }
  getOrRegisterViewContainerModel(viewContainer) {
    let viewContainerModel = this.viewContainerModels.get(viewContainer)?.viewContainerModel;
    if (!viewContainerModel) {
      const disposables = new DisposableStore();
      viewContainerModel = disposables.add(this.instantiationService.createInstance(ViewContainerModel, viewContainer));
      this.onDidChangeActiveViews({ added: viewContainerModel.activeViewDescriptors, removed: [] });
      viewContainerModel.onDidChangeActiveViewDescriptors((changed) => this.onDidChangeActiveViews(changed), this, disposables);
      this.onDidChangeVisibleViews({ added: [...viewContainerModel.visibleViewDescriptors], removed: [] });
      viewContainerModel.onDidAddVisibleViewDescriptors((added) => this.onDidChangeVisibleViews({ added: added.map(({ viewDescriptor }) => viewDescriptor), removed: [] }), this, disposables);
      viewContainerModel.onDidRemoveVisibleViewDescriptors((removed) => this.onDidChangeVisibleViews({ added: [], removed: removed.map(({ viewDescriptor }) => viewDescriptor) }), this, disposables);
      disposables.add(toDisposable(() => this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer)));
      disposables.add(this.registerResetViewContainerAction(viewContainer));
      const value = { viewContainerModel, disposables, dispose: () => disposables.dispose() };
      this.viewContainerModels.set(viewContainer, value);
      this.onDidRegisterViews([{ views: this.viewsRegistry.getViews(viewContainer), viewContainer }]);
      const viewsToRegister = this.getViewsByContainer(viewContainer).filter((view) => this.getDefaultContainerById(view.id) !== viewContainer);
      if (viewsToRegister.length) {
        this.addViews(viewContainer, viewsToRegister);
        this.contextKeyService.bufferChangeEvents(() => {
          viewsToRegister.forEach((viewDescriptor) => this.getOrCreateMovableViewContextKey(viewDescriptor).set(!!viewDescriptor.canMoveView));
        });
      }
      if (this.canRegisterViewsVisibilityActions) {
        this.registerViewsVisibilityActions(viewContainer, value);
      }
    }
    return viewContainerModel;
  }
  onDidDeregisterViewContainer(viewContainer) {
    this.viewContainerModels.deleteAndDispose(viewContainer);
    this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer);
  }
  onDidChangeActiveViews({ added, removed }) {
    this.contextKeyService.bufferChangeEvents(() => {
      added.forEach((viewDescriptor) => this.getOrCreateActiveViewContextKey(viewDescriptor).set(true));
      removed.forEach((viewDescriptor) => this.getOrCreateActiveViewContextKey(viewDescriptor).set(false));
    });
  }
  onDidChangeVisibleViews({ added, removed }) {
    this.contextKeyService.bufferChangeEvents(() => {
      added.forEach((viewDescriptor) => this.getOrCreateVisibleViewContextKey(viewDescriptor).set(true));
      removed.forEach((viewDescriptor) => this.getOrCreateVisibleViewContextKey(viewDescriptor).set(false));
    });
  }
  registerViewsVisibilityActions(viewContainer, { viewContainerModel, disposables }) {
    this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer);
    this.viewsVisibilityActionDisposables.set(viewContainer, this.registerViewsVisibilityActionsForContainer(viewContainerModel));
    disposables.add(Event.any(
      viewContainerModel.onDidChangeActiveViewDescriptors,
      viewContainerModel.onDidAddVisibleViewDescriptors,
      viewContainerModel.onDidRemoveVisibleViewDescriptors,
      viewContainerModel.onDidMoveVisibleViewDescriptors
    )((e) => {
      this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer);
      this.viewsVisibilityActionDisposables.set(viewContainer, this.registerViewsVisibilityActionsForContainer(viewContainerModel));
    }));
  }
  registerViewsVisibilityActionsForContainer(viewContainerModel) {
    const disposables = new DisposableStore();
    viewContainerModel.activeViewDescriptors.forEach((viewDescriptor, index) => {
      if (!viewDescriptor.remoteAuthority) {
        disposables.add(registerAction2(class extends ViewPaneContainerAction {
          constructor() {
            super({
              id: `${viewDescriptor.id}.toggleVisibility`,
              viewPaneContainerId: viewContainerModel.viewContainer.id,
              precondition: viewDescriptor.canToggleVisibility && (!viewContainerModel.isVisible(viewDescriptor.id) || viewContainerModel.visibleViewDescriptors.length > 1) ? ContextKeyExpr.true() : ContextKeyExpr.false(),
              toggled: ContextKeyExpr.has(`${viewDescriptor.id}.visible`),
              title: viewDescriptor.name,
              metadata: {
                description: localize2("toggleVisibilityDescription", "Toggles the visibility of the {0} view if the view container it is located in is visible", viewDescriptor.name.value)
              },
              menu: [{
                id: ViewsSubMenu,
                when: ContextKeyExpr.equals("viewContainer", viewContainerModel.viewContainer.id),
                order: index
              }, {
                id: MenuId.ViewContainerTitleContext,
                when: ContextKeyExpr.equals("viewContainer", viewContainerModel.viewContainer.id),
                order: index,
                group: "1_toggleVisibility"
              }, {
                id: MenuId.ViewTitleContext,
                when: ContextKeyExpr.or(...viewContainerModel.visibleViewDescriptors.map((v) => ContextKeyExpr.equals("view", v.id))),
                order: index,
                group: "2_toggleVisibility"
              }]
            });
          }
          async runInViewPaneContainer(serviceAccessor, viewPaneContainer) {
            viewPaneContainer.toggleViewVisibility(viewDescriptor.id);
          }
        }));
        disposables.add(registerAction2(class extends ViewPaneContainerAction {
          constructor() {
            super({
              id: `${viewDescriptor.id}.removeView`,
              viewPaneContainerId: viewContainerModel.viewContainer.id,
              title: localize("hideView", "Hide '{0}'", viewDescriptor.name.value),
              metadata: {
                description: localize2("hideViewDescription", "Hides the {0} view if it is visible and the view container it is located in is visible", viewDescriptor.name.value)
              },
              precondition: viewDescriptor.canToggleVisibility && (!viewContainerModel.isVisible(viewDescriptor.id) || viewContainerModel.visibleViewDescriptors.length > 1) ? ContextKeyExpr.true() : ContextKeyExpr.false(),
              menu: [{
                id: MenuId.ViewTitleContext,
                when: ContextKeyExpr.and(
                  ContextKeyExpr.equals("view", viewDescriptor.id),
                  ContextKeyExpr.has(`${viewDescriptor.id}.visible`)
                ),
                group: "1_hide",
                order: 1
              }]
            });
          }
          async runInViewPaneContainer(serviceAccessor, viewPaneContainer) {
            if (viewPaneContainer.getView(viewDescriptor.id)?.isVisible()) {
              viewPaneContainer.toggleViewVisibility(viewDescriptor.id);
            }
          }
        }));
      }
    });
    return disposables;
  }
  registerResetViewContainerAction(viewContainer) {
    const that = this;
    return registerAction2(class ResetViewLocationAction extends Action2 {
      constructor() {
        super({
          id: `${viewContainer.id}.resetViewContainerLocation`,
          title: localize2("resetViewLocation", "Reset Location"),
          menu: [{
            id: MenuId.ViewContainerTitleContext,
            group: "1_viewActions",
            when: ContextKeyExpr.or(
              ContextKeyExpr.and(
                ContextKeyExpr.equals("viewContainer", viewContainer.id),
                ContextKeyExpr.equals(`${viewContainer.id}.defaultViewContainerLocation`, false)
              )
            )
          }]
        });
      }
      run(accessor) {
        that.moveViewContainerToLocation(viewContainer, that.getDefaultViewContainerLocation(viewContainer), void 0, this.desc.id);
        accessor.get(IViewsService).openViewContainer(viewContainer.id, true);
      }
    });
  }
  addViews(container, views, visibilityState = ViewVisibilityState.Default) {
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach((view) => {
        const isDefaultContainer = this.getDefaultContainerById(view.id) === container;
        this.getOrCreateDefaultViewLocationContextKey(view).set(isDefaultContainer);
        if (isDefaultContainer) {
          this.viewDescriptorsCustomLocations.delete(view.id);
        } else {
          this.viewDescriptorsCustomLocations.set(view.id, container.id);
        }
      });
    });
    this.getViewContainerModel(container).add(views.map((view) => {
      return {
        viewDescriptor: view,
        collapsed: visibilityState === ViewVisibilityState.Default ? void 0 : false,
        visible: visibilityState === ViewVisibilityState.Default ? void 0 : true
      };
    }));
  }
  removeViews(container, views) {
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach((view) => {
        if (this.viewDescriptorsCustomLocations.get(view.id) === container.id) {
          this.viewDescriptorsCustomLocations.delete(view.id);
        }
        this.getOrCreateDefaultViewLocationContextKey(view).set(false);
      });
    });
    this.getViewContainerModel(container).remove(views);
  }
  getOrCreateActiveViewContextKey(viewDescriptor) {
    const activeContextKeyId = `${viewDescriptor.id}.active`;
    let contextKey = this.activeViewContextKeys.get(activeContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(activeContextKeyId, false).bindTo(this.contextKeyService);
      this.activeViewContextKeys.set(activeContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateVisibleViewContextKey(viewDescriptor) {
    const activeContextKeyId = `${viewDescriptor.id}.visible`;
    let contextKey = this.activeViewContextKeys.get(activeContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(activeContextKeyId, false).bindTo(this.contextKeyService);
      this.activeViewContextKeys.set(activeContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateMovableViewContextKey(viewDescriptor) {
    const movableViewContextKeyId = `${viewDescriptor.id}.canMove`;
    let contextKey = this.movableViewContextKeys.get(movableViewContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(movableViewContextKeyId, false).bindTo(this.contextKeyService);
      this.movableViewContextKeys.set(movableViewContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateDefaultViewLocationContextKey(viewDescriptor) {
    const defaultViewLocationContextKeyId = `${viewDescriptor.id}.defaultViewLocation`;
    let contextKey = this.defaultViewLocationContextKeys.get(defaultViewLocationContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(defaultViewLocationContextKeyId, false).bindTo(this.contextKeyService);
      this.defaultViewLocationContextKeys.set(defaultViewLocationContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateDefaultViewContainerLocationContextKey(viewContainer) {
    const defaultViewContainerLocationContextKeyId = `${viewContainer.id}.defaultViewContainerLocation`;
    let contextKey = this.defaultViewContainerLocationContextKeys.get(defaultViewContainerLocationContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(defaultViewContainerLocationContextKeyId, false).bindTo(this.contextKeyService);
      this.defaultViewContainerLocationContextKeys.set(defaultViewContainerLocationContextKeyId, contextKey);
    }
    return contextKey;
  }
};
ViewDescriptorService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, ILoggerService),
  __decorateParam(6, IWorkbenchEnvironmentService)
], ViewDescriptorService);
registerSingleton(IViewDescriptorService, ViewDescriptorService, InstantiationType.Delayed);
export {
  ViewDescriptorService
};
