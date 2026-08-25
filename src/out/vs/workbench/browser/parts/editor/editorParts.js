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
import { localize } from "../../../../nls.js";
import { GroupActivationReason, GroupLocation, GroupsOrder, IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableMap, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { MainEditorPart } from "./editorPart.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { distinct } from "../../../../base/common/arrays.js";
import { AuxiliaryEditorPart } from "./auxiliaryEditorPart.js";
import { ModalEditorPart } from "./modalEditorPart.js";
import { MultiWindowParts } from "../../part.js";
import { DeferredPromise } from "../../../../base/common/async.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IAuxiliaryWindowService } from "../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { getActiveElement, isAncestor, isHTMLElement } from "../../../../base/browser/dom.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { EditorPartModalVisibleContext } from "../../../common/contextkeys.js";
let EditorParts = class extends MultiWindowParts {
  constructor(instantiationService, storageService, themeService, auxiliaryWindowService, contextKeyService) {
    super("workbench.editorParts", themeService, storageService);
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.auxiliaryWindowService = auxiliaryWindowService;
    this.contextKeyService = contextKeyService;
    //#region Scoped Instantiation Services
    this.mapPartToInstantiationService = /* @__PURE__ */ new Map();
    //#endregion
    //#region Auxiliary Editor Parts
    this._onDidCreateAuxiliaryEditorPart = this._register(new Emitter());
    this.onDidCreateAuxiliaryEditorPart = this._onDidCreateAuxiliaryEditorPart.event;
    this.modalEditorMaximized = false;
    this.workspaceMemento = this.getMemento(StorageScope.WORKSPACE, StorageTarget.USER);
    this.profileMemento = this.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    this._isReady = false;
    this.whenReadyPromise = new DeferredPromise();
    this.whenReady = this.whenReadyPromise.p;
    this.whenRestoredPromise = new DeferredPromise();
    this.whenRestored = this.whenRestoredPromise.p;
    //#endregion
    //#region Events
    this._onDidActiveGroupChange = this._register(new Emitter());
    this.onDidChangeActiveGroup = this._onDidActiveGroupChange.event;
    this._onDidAddGroup = this._register(new Emitter());
    this.onDidAddGroup = this._onDidAddGroup.event;
    this._onDidRemoveGroup = this._register(new Emitter());
    this.onDidRemoveGroup = this._onDidRemoveGroup.event;
    this._onDidMoveGroup = this._register(new Emitter());
    this.onDidMoveGroup = this._onDidMoveGroup.event;
    this._onDidActivateGroup = this._register(new Emitter());
    this.onDidActivateGroup = this._onDidActivateGroup.event;
    this._onDidChangeGroupIndex = this._register(new Emitter());
    this.onDidChangeGroupIndex = this._onDidChangeGroupIndex.event;
    this._onDidChangeGroupLocked = this._register(new Emitter());
    this.onDidChangeGroupLocked = this._onDidChangeGroupLocked.event;
    this._onDidChangeGroupMaximized = this._register(new Emitter());
    this.onDidChangeGroupMaximized = this._onDidChangeGroupMaximized.event;
    //#endregion
    //#region Editor Group Context Key Handling
    this.globalContextKeys = /* @__PURE__ */ new Map();
    this.scopedContextKeys = /* @__PURE__ */ new Map();
    this.contextKeyProviders = /* @__PURE__ */ new Map();
    this.registeredContextKeys = /* @__PURE__ */ new Map();
    this.contextKeyProviderDisposables = this._register(new DisposableMap());
    this.modalEditorVisibleContext = EditorPartModalVisibleContext.bindTo(this.contextKeyService);
    this.editorWorkingSets = (() => {
      const workingSetsRaw = this.storageService.get(EditorParts.EDITOR_WORKING_SETS_STORAGE_KEY, StorageScope.WORKSPACE);
      if (workingSetsRaw) {
        return JSON.parse(workingSetsRaw);
      }
      return [];
    })();
    const modalState = this.profileMemento[EditorParts.MODAL_EDITOR_STATE_STORAGE_KEY];
    if (modalState) {
      this.modalEditorMaximized = modalState.maximized;
      this.modalEditorSize = modalState.size;
      this.modalEditorPosition = modalState.position;
      this.modalEditorSidebarWidth = modalState.sidebarWidth;
      this.modalEditorSidebarHidden = modalState.sidebarHidden;
    }
    this.mainPart = this._register(this.createMainEditorPart());
    this._register(this.registerPart(this.mainPart));
    this.mostRecentActiveParts = [this.mainPart];
    this.restoreParts();
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.onDidChangeMementoValue(StorageScope.WORKSPACE, this._store)((e) => this.onDidChangeMementoState(e)));
    this.whenReady.then(() => this.registerGroupsContextKeyListeners());
  }
  createMainEditorPart() {
    return this.instantiationService.createInstance(MainEditorPart, this);
  }
  getScopedInstantiationService(part) {
    if (part === this.mainPart) {
      let mainPartInstantiationService = this.mapPartToInstantiationService.get(part.windowId);
      if (!mainPartInstantiationService) {
        mainPartInstantiationService = this.instantiationService.invokeFunction((accessor) => {
          const editorService = accessor.get(IEditorService);
          const statusbarService = accessor.get(IStatusbarService);
          const mainPartInstantiationService2 = this._register(this.mainPart.scopedInstantiationService.createChild(new ServiceCollection(
            [IEditorService, editorService.createScoped(this.mainPart, this._store)],
            [IStatusbarService, statusbarService.createScoped(statusbarService, this._store)]
          )));
          this.mapPartToInstantiationService.set(part.windowId, mainPartInstantiationService2);
          return mainPartInstantiationService2;
        });
      }
      return mainPartInstantiationService;
    }
    if (part === this.modalEditorPart && this.modalPartInstantiationService) {
      return this.modalPartInstantiationService;
    }
    return this.mapPartToInstantiationService.get(part.windowId) ?? this.instantiationService;
  }
  async createAuxiliaryEditorPart(options) {
    const { part, instantiationService, disposables } = await this.instantiationService.createInstance(AuxiliaryEditorPart, this).create(this.getGroupsLabel(this._parts.size), options);
    this.mapPartToInstantiationService.set(part.windowId, instantiationService);
    disposables.add(toDisposable(() => this.mapPartToInstantiationService.delete(part.windowId)));
    this._onDidAddGroup.fire(part.activeGroup);
    this._onDidCreateAuxiliaryEditorPart.fire(part);
    return part;
  }
  get activeModalEditorPart() {
    return this.modalEditorPart;
  }
  async createModalEditorPart(options) {
    if (this.modalEditorPart) {
      this.modalEditorPart.updateOptions(options);
      return this.modalEditorPart;
    }
    if (this.modalEditorPartCreatePromise) {
      const part = await this.modalEditorPartCreatePromise;
      part.updateOptions(options);
      return part;
    }
    const createPromise = this.doCreateModalEditorPart(options).finally(() => {
      this.modalEditorPartCreatePromise = void 0;
    });
    this.modalEditorPartCreatePromise = createPromise;
    return createPromise;
  }
  async doCreateModalEditorPart(options) {
    this.modalEditorVisibleContext.set(true);
    let result;
    try {
      result = await this.instantiationService.createInstance(ModalEditorPart, this).create({
        ...options,
        maximized: options?.maximized ?? this.modalEditorMaximized,
        size: options?.size ?? this.modalEditorSize,
        position: options?.position ?? this.modalEditorPosition,
        sidebar: options?.sidebar ? {
          ...options.sidebar,
          sidebarWidth: options.sidebar.sidebarWidth ?? this.modalEditorSidebarWidth,
          sidebarHidden: options.sidebar.sidebarHidden ?? this.modalEditorSidebarHidden
        } : void 0
      });
    } catch (error) {
      this.modalEditorVisibleContext.set(false);
      throw error;
    }
    const { part, instantiationService, disposables } = result;
    this.modalEditorPart = part;
    this.modalPartInstantiationService = instantiationService;
    disposables.add(toDisposable(() => {
      this.modalEditorMaximized = part.maximized;
      this.modalEditorSize = part.size;
      this.modalEditorPosition = part.position;
      if (part.hasSidebar) {
        this.modalEditorSidebarWidth = part.sidebarWidth;
        this.modalEditorSidebarHidden = part.sidebarHidden || void 0;
      }
      this.modalPartInstantiationService = void 0;
      this.modalEditorPart = void 0;
      this.modalEditorVisibleContext.set(false);
    }));
    this._onDidAddGroup.fire(part.activeGroup);
    return part;
  }
  //#endregion
  //#region Registration
  registerPart(part) {
    const disposables = this._register(new DisposableStore());
    disposables.add(super.registerPart(part));
    this.registerEditorPartListeners(part, disposables);
    return disposables;
  }
  unregisterPart(part) {
    super.unregisterPart(part);
    this.parts.forEach((part2, index) => {
      if (part2 === this.mainPart) {
        return;
      }
      part2.notifyGroupsLabelChange(this.getGroupsLabel(index));
    });
  }
  registerEditorPartListeners(part, disposables) {
    disposables.add(part.onDidFocus(() => {
      this.doUpdateMostRecentActive(part, true);
      if (this._parts.size > 1) {
        this._onDidActiveGroupChange.fire(this.activeGroup);
      }
    }));
    disposables.add(toDisposable(() => {
      this.doUpdateMostRecentActive(part);
      if (part.windowId !== mainWindow.vscodeWindowId) {
        this._onDidActiveGroupChange.fire(this.activeGroup);
      }
    }));
    disposables.add(part.onDidChangeActiveGroup((group) => this._onDidActiveGroupChange.fire(group)));
    disposables.add(part.onDidAddGroup((group) => this._onDidAddGroup.fire(group)));
    disposables.add(part.onDidRemoveGroup((group) => this._onDidRemoveGroup.fire(group)));
    disposables.add(part.onDidMoveGroup((group) => this._onDidMoveGroup.fire(group)));
    disposables.add(part.onDidActivateGroup((e) => {
      if (e.reason === GroupActivationReason.PART_CLOSE) {
        this.doUpdateMostRecentActive(part, true);
      }
      this._onDidActivateGroup.fire(e);
    }));
    disposables.add(part.onDidChangeGroupMaximized((maximized) => this._onDidChangeGroupMaximized.fire(maximized)));
    disposables.add(part.onDidChangeGroupIndex((group) => this._onDidChangeGroupIndex.fire(group)));
    disposables.add(part.onDidChangeGroupLocked((group) => this._onDidChangeGroupLocked.fire(group)));
  }
  doUpdateMostRecentActive(part, makeMostRecentlyActive) {
    const index = this.mostRecentActiveParts.indexOf(part);
    if (index !== -1) {
      this.mostRecentActiveParts.splice(index, 1);
    }
    if (makeMostRecentlyActive) {
      this.mostRecentActiveParts.unshift(part);
    }
  }
  getGroupsLabel(index) {
    return localize("groupLabel", "Window {0}", index + 1);
  }
  //#endregion
  //#region Helpers
  getPartByDocument(document) {
    const mruParts = this.mostRecentActiveParts;
    const mruDocumentParts = mruParts.filter((part) => part.element?.ownerDocument === document);
    if (mruDocumentParts.length > 1) {
      const activeElement = getActiveElement();
      for (const part of mruDocumentParts) {
        const container = part.getContainer();
        if (container && isAncestor(activeElement, container)) {
          return part;
        }
      }
      return mruDocumentParts[0];
    }
    return super.getPartByDocument(document);
  }
  getPart(groupOrElement) {
    if (this._parts.size > 1) {
      if (isHTMLElement(groupOrElement)) {
        const element = groupOrElement;
        return this.getPartByDocument(element.ownerDocument);
      } else {
        const group = groupOrElement;
        let id;
        if (typeof group === "number") {
          id = group;
        } else {
          id = group.id;
        }
        for (const part of this._parts) {
          if (part.hasGroup(id)) {
            return part;
          }
        }
      }
    }
    return this.mainPart;
  }
  static {
    //#endregion
    //#region Lifecycle / State
    this.EDITOR_PARTS_UI_STATE_STORAGE_KEY = "editorparts.state";
  }
  static {
    this.MODAL_EDITOR_STATE_STORAGE_KEY = "editorparts.modalState";
  }
  get isReady() {
    return this._isReady;
  }
  async restoreParts() {
    await this.mainPart.whenReady;
    if (this.mainPart.willRestoreState) {
      const state = this.loadState();
      if (state) {
        await this.restoreState(state);
      }
    }
    const mostRecentActivePart = this.mostRecentActiveParts.at(0);
    mostRecentActivePart?.activeGroup.focus();
    this._isReady = true;
    this.whenReadyPromise.complete();
    await Promise.allSettled(this.parts.map((part) => part.whenRestored));
    this.whenRestoredPromise.complete();
  }
  loadState() {
    return this.workspaceMemento[EditorParts.EDITOR_PARTS_UI_STATE_STORAGE_KEY];
  }
  saveState() {
    const state = this.createState();
    if (state.auxiliary.length === 0) {
      delete this.workspaceMemento[EditorParts.EDITOR_PARTS_UI_STATE_STORAGE_KEY];
    } else {
      this.workspaceMemento[EditorParts.EDITOR_PARTS_UI_STATE_STORAGE_KEY] = state;
    }
    this.saveModalState();
  }
  saveModalState() {
    if (this.modalEditorPart) {
      this.modalEditorMaximized = this.modalEditorPart.maximized;
      this.modalEditorSize = this.modalEditorPart.size;
      this.modalEditorPosition = this.modalEditorPart.position;
      if (this.modalEditorPart.hasSidebar) {
        this.modalEditorSidebarWidth = this.modalEditorPart.sidebarWidth;
        this.modalEditorSidebarHidden = this.modalEditorPart.sidebarHidden || void 0;
      }
    }
    if (this.modalEditorMaximized || this.modalEditorSize || this.modalEditorPosition || this.modalEditorSidebarWidth || this.modalEditorSidebarHidden) {
      this.profileMemento[EditorParts.MODAL_EDITOR_STATE_STORAGE_KEY] = {
        maximized: this.modalEditorMaximized,
        size: this.modalEditorSize ? { width: this.modalEditorSize.width, height: this.modalEditorSize.height } : void 0,
        position: this.modalEditorPosition,
        sidebarWidth: this.modalEditorSidebarWidth,
        sidebarHidden: this.modalEditorSidebarHidden
      };
    } else {
      delete this.profileMemento[EditorParts.MODAL_EDITOR_STATE_STORAGE_KEY];
    }
  }
  createState() {
    return {
      auxiliary: this.parts.map((part) => ({ part, auxiliaryWindow: this.auxiliaryWindowService.getWindow(part.windowId) })).filter(({ auxiliaryWindow }) => auxiliaryWindow !== void 0).map(({ part, auxiliaryWindow }) => ({
        state: part.createState(),
        ...auxiliaryWindow.createState()
      })),
      mru: this.mostRecentActiveParts.map((part) => this.parts.indexOf(part))
    };
  }
  async restoreState(state) {
    if (state.auxiliary.length) {
      const auxiliaryEditorPartPromises = [];
      for (const auxiliaryEditorPartState of state.auxiliary) {
        auxiliaryEditorPartPromises.push(this.createAuxiliaryEditorPart(auxiliaryEditorPartState));
      }
      await Promise.allSettled(auxiliaryEditorPartPromises);
      if (state.mru.length === this.parts.length) {
        this.mostRecentActiveParts = state.mru.map((index) => this.parts[index]);
      } else {
        this.mostRecentActiveParts = [...this.parts];
      }
      await Promise.allSettled(this.parts.map((part) => part.whenReady));
    }
  }
  get hasRestorableState() {
    return this.parts.some((part) => part.hasRestorableState);
  }
  onDidChangeMementoState(e) {
    if (e.external && e.scope === StorageScope.WORKSPACE) {
      this.reloadMemento(e.scope);
      const state = this.loadState();
      if (state) {
        this.applyState(state);
      }
    }
  }
  async applyState(state) {
    for (const part of this.parts) {
      if (part === this.mainPart) {
        continue;
      }
      for (const group of part.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
        await group.closeAllEditors({ excludeConfirming: true, force: true });
      }
      const closed = part.close();
      if (!closed) {
        return false;
      }
    }
    if (state !== "empty") {
      await this.restoreState(state);
    }
    return true;
  }
  static {
    //#endregion
    //#region Working Sets
    this.EDITOR_WORKING_SETS_STORAGE_KEY = "editor.workingSets";
  }
  saveWorkingSet(name) {
    const workingSet = {
      id: generateUuid(),
      name,
      main: this.mainPart.createState(),
      auxiliary: this.createState()
    };
    this.editorWorkingSets.push(workingSet);
    this.saveWorkingSets();
    return {
      id: workingSet.id,
      name: workingSet.name
    };
  }
  getWorkingSets() {
    return this.editorWorkingSets.map((workingSet) => ({ id: workingSet.id, name: workingSet.name }));
  }
  deleteWorkingSet(workingSet) {
    const index = this.indexOfWorkingSet(workingSet);
    if (typeof index === "number") {
      this.editorWorkingSets.splice(index, 1);
      this.saveWorkingSets();
    }
  }
  async applyWorkingSet(workingSet, options) {
    let workingSetState;
    if (workingSet === "empty") {
      workingSetState = "empty";
    } else {
      workingSetState = this.editorWorkingSets[this.indexOfWorkingSet(workingSet) ?? -1];
    }
    if (!workingSetState) {
      return false;
    }
    const applied = await this.applyState(workingSetState === "empty" ? workingSetState : workingSetState.auxiliary);
    if (!applied) {
      return false;
    }
    await this.mainPart.applyState(workingSetState === "empty" ? workingSetState : workingSetState.main, options);
    if (!options?.preserveFocus) {
      const mostRecentActivePart = this.mostRecentActiveParts.at(0);
      if (mostRecentActivePart) {
        await mostRecentActivePart.whenReady;
        mostRecentActivePart.activeGroup.focus();
      }
    }
    return true;
  }
  indexOfWorkingSet(workingSet) {
    for (let i = 0; i < this.editorWorkingSets.length; i++) {
      if (this.editorWorkingSets[i].id === workingSet.id) {
        return i;
      }
    }
    return void 0;
  }
  saveWorkingSets() {
    this.storageService.store(EditorParts.EDITOR_WORKING_SETS_STORAGE_KEY, JSON.stringify(this.editorWorkingSets), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  //#endregion
  //#region Group Management
  get activeGroup() {
    return this.activePart.activeGroup;
  }
  get sideGroup() {
    return this.activePart.sideGroup;
  }
  get groups() {
    return this.getGroups();
  }
  get count() {
    return this.groups.length;
  }
  getGroups(order = GroupsOrder.CREATION_TIME) {
    if (this._parts.size > 1) {
      let parts;
      switch (order) {
        case GroupsOrder.GRID_APPEARANCE:
        // we currently do not have a way to compute by appearance over multiple windows
        case GroupsOrder.CREATION_TIME:
          parts = this.parts;
          break;
        case GroupsOrder.MOST_RECENTLY_ACTIVE:
          parts = distinct([...this.mostRecentActiveParts, ...this.parts]);
          break;
      }
      return parts.flatMap((part) => part.getGroups(order));
    }
    return this.mainPart.getGroups(order);
  }
  getGroup(identifier) {
    if (this._parts.size > 1) {
      for (const part of this._parts) {
        const group = part.getGroup(identifier);
        if (group) {
          return group;
        }
      }
    }
    return this.mainPart.getGroup(identifier);
  }
  assertGroupView(group) {
    let groupView;
    if (typeof group === "number") {
      groupView = this.getGroup(group);
    } else {
      groupView = group;
    }
    if (!groupView) {
      throw new Error("Invalid editor group provided!");
    }
    return groupView;
  }
  activateGroup(group) {
    return this.getPart(group).activateGroup(group);
  }
  getSize(group) {
    return this.getPart(group).getSize(group);
  }
  setSize(group, size) {
    this.getPart(group).setSize(group, size);
  }
  arrangeGroups(arrangement, group = this.activePart.activeGroup) {
    this.getPart(group).arrangeGroups(arrangement, group);
  }
  toggleMaximizeGroup(group = this.activePart.activeGroup) {
    this.getPart(group).toggleMaximizeGroup(group);
  }
  toggleExpandGroup(group = this.activePart.activeGroup) {
    this.getPart(group).toggleExpandGroup(group);
  }
  restoreGroup(group) {
    return this.getPart(group).restoreGroup(group);
  }
  applyLayout(layout) {
    this.activePart.applyLayout(layout);
  }
  getLayout() {
    return this.activePart.getLayout();
  }
  get orientation() {
    return this.activePart.orientation;
  }
  setGroupOrientation(orientation) {
    this.activePart.setGroupOrientation(orientation);
  }
  findGroup(scope, source = this.activeGroup, wrap) {
    const sourcePart = this.getPart(source);
    if (this._parts.size > 1) {
      const groups = this.getGroups(GroupsOrder.GRID_APPEARANCE);
      if (scope.location === GroupLocation.FIRST || scope.location === GroupLocation.LAST) {
        return scope.location === GroupLocation.FIRST ? groups[0] : groups[groups.length - 1];
      }
      const group = sourcePart.findGroup(scope, source, false);
      if (group) {
        return group;
      }
      if (scope.location === GroupLocation.NEXT || scope.location === GroupLocation.PREVIOUS) {
        const sourceGroup = this.assertGroupView(source);
        const index = groups.indexOf(sourceGroup);
        if (scope.location === GroupLocation.NEXT) {
          let nextGroup = groups[index + 1];
          if (!nextGroup && wrap) {
            nextGroup = groups[0];
          }
          return nextGroup;
        } else {
          let previousGroup = groups[index - 1];
          if (!previousGroup && wrap) {
            previousGroup = groups[groups.length - 1];
          }
          return previousGroup;
        }
      }
    }
    return sourcePart.findGroup(scope, source, wrap);
  }
  addGroup(location, direction) {
    return this.getPart(location).addGroup(location, direction);
  }
  removeGroup(group) {
    this.getPart(group).removeGroup(group);
  }
  moveGroup(group, location, direction) {
    return this.getPart(group).moveGroup(group, location, direction);
  }
  mergeGroup(group, target, options) {
    return this.getPart(group).mergeGroup(group, target, options);
  }
  mergeAllGroups(target, options) {
    return this.activePart.mergeAllGroups(target, options);
  }
  copyGroup(group, location, direction) {
    return this.getPart(group).copyGroup(group, location, direction);
  }
  createEditorDropTarget(container, delegate) {
    return this.getPart(container).createEditorDropTarget(container, delegate);
  }
  registerGroupsContextKeyListeners() {
    this._register(this.onDidChangeActiveGroup(() => this.updateGlobalContextKeys()));
    this.groups.forEach((group) => this.registerGroupContextKeyProvidersListeners(group));
    this._register(this.onDidAddGroup((group) => this.registerGroupContextKeyProvidersListeners(group)));
    this._register(this.onDidRemoveGroup((group) => {
      this.scopedContextKeys.delete(group.id);
      this.registeredContextKeys.delete(group.id);
      this.contextKeyProviderDisposables.deleteAndDispose(group.id);
    }));
  }
  updateGlobalContextKeys() {
    const activeGroupScopedContextKeys = this.scopedContextKeys.get(this.activeGroup.id);
    if (!activeGroupScopedContextKeys) {
      return;
    }
    for (const [key, globalContextKey] of this.globalContextKeys) {
      const scopedContextKey = activeGroupScopedContextKeys.get(key);
      if (scopedContextKey) {
        globalContextKey.set(scopedContextKey.get());
      } else {
        globalContextKey.reset();
      }
    }
  }
  bind(contextKey, group) {
    let globalContextKey = this.globalContextKeys.get(contextKey.key);
    if (!globalContextKey) {
      globalContextKey = contextKey.bindTo(this.contextKeyService);
      this.globalContextKeys.set(contextKey.key, globalContextKey);
    }
    let groupScopedContextKeys = this.scopedContextKeys.get(group.id);
    if (!groupScopedContextKeys) {
      groupScopedContextKeys = /* @__PURE__ */ new Map();
      this.scopedContextKeys.set(group.id, groupScopedContextKeys);
    }
    let scopedContextKey = groupScopedContextKeys.get(contextKey.key);
    if (!scopedContextKey) {
      scopedContextKey = contextKey.bindTo(group.scopedContextKeyService);
      groupScopedContextKeys.set(contextKey.key, scopedContextKey);
    }
    const that = this;
    return {
      get() {
        return scopedContextKey.get();
      },
      set(value) {
        if (that.activeGroup === group) {
          globalContextKey.set(value);
        }
        scopedContextKey.set(value);
      },
      reset() {
        if (that.activeGroup === group) {
          globalContextKey.reset();
        }
        scopedContextKey.reset();
      }
    };
  }
  registerContextKeyProvider(provider) {
    if (this.contextKeyProviders.has(provider.contextKey.key) || this.globalContextKeys.has(provider.contextKey.key)) {
      throw new Error(`A context key provider for key ${provider.contextKey.key} already exists.`);
    }
    this.contextKeyProviders.set(provider.contextKey.key, provider);
    const setContextKeyForGroups = () => {
      for (const group of this.groups) {
        this.updateRegisteredContextKey(group, provider);
      }
    };
    setContextKeyForGroups();
    const onDidChange = provider.onDidChange?.(() => setContextKeyForGroups());
    return toDisposable(() => {
      onDidChange?.dispose();
      this.globalContextKeys.delete(provider.contextKey.key);
      this.scopedContextKeys.forEach((scopedContextKeys) => scopedContextKeys.delete(provider.contextKey.key));
      this.contextKeyProviders.delete(provider.contextKey.key);
      this.registeredContextKeys.forEach((registeredContextKeys) => registeredContextKeys.delete(provider.contextKey.key));
    });
  }
  registerGroupContextKeyProvidersListeners(group) {
    const disposable = group.onDidActiveEditorChange(() => {
      for (const contextKeyProvider of this.contextKeyProviders.values()) {
        this.updateRegisteredContextKey(group, contextKeyProvider);
      }
    });
    this.contextKeyProviderDisposables.set(group.id, disposable);
  }
  updateRegisteredContextKey(group, provider) {
    let groupRegisteredContextKeys = this.registeredContextKeys.get(group.id);
    if (!groupRegisteredContextKeys) {
      groupRegisteredContextKeys = /* @__PURE__ */ new Map();
      this.registeredContextKeys.set(group.id, groupRegisteredContextKeys);
    }
    let scopedRegisteredContextKey = groupRegisteredContextKeys.get(provider.contextKey.key);
    if (!scopedRegisteredContextKey) {
      scopedRegisteredContextKey = this.bind(provider.contextKey, group);
      groupRegisteredContextKeys.set(provider.contextKey.key, scopedRegisteredContextKey);
    }
    scopedRegisteredContextKey.set(provider.getGroupContextKeyValue(group));
  }
  //#endregion
  //#region Main Editor Part Only
  get partOptions() {
    return this.mainPart.partOptions;
  }
  get onDidChangeEditorPartOptions() {
    return this.mainPart.onDidChangeEditorPartOptions;
  }
  enforcePartOptions(options) {
    return this.mainPart.enforcePartOptions(options);
  }
  //#endregion
};
EditorParts = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IAuxiliaryWindowService),
  __decorateParam(4, IContextKeyService)
], EditorParts);
registerSingleton(IEditorGroupsService, EditorParts, InstantiationType.Eager);
export {
  EditorParts
};
