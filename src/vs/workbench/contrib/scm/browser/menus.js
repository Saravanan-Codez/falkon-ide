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
import { equals } from "../../../../base/common/arrays.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import "./media/scm.css";
import { localize } from "../../../../nls.js";
import { getActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ISCMService } from "../common/scm.js";
function actionEquals(a, b) {
  return a.id === b.id;
}
let SCMTitleMenu = class {
  constructor(menuService, contextKeyService) {
    this._actions = [];
    this._secondaryActions = [];
    this.disposables = new DisposableStore();
    this._onDidChangeTitle = this.disposables.add(new Emitter());
    this.onDidChangeTitle = this._onDidChangeTitle.event;
    this.menu = menuService.createMenu(MenuId.SCMTitle, contextKeyService);
    this.disposables.add(this.menu);
    this.menu.onDidChange(this.updateTitleActions, this, this.disposables);
    this.updateTitleActions();
  }
  get actions() {
    return this._actions;
  }
  get secondaryActions() {
    return this._secondaryActions;
  }
  updateTitleActions() {
    const { primary, secondary } = getActionBarActions(this.menu.getActions({ shouldForwardArgs: true }));
    if (equals(primary, this._actions, actionEquals) && equals(secondary, this._secondaryActions, actionEquals)) {
      return;
    }
    this._actions = primary;
    this._secondaryActions = secondary;
    this._onDidChangeTitle.fire();
  }
  dispose() {
    this.disposables.dispose();
  }
};
SCMTitleMenu = __decorateClass([
  __decorateParam(0, IMenuService),
  __decorateParam(1, IContextKeyService)
], SCMTitleMenu);
class SCMMenusItem {
  constructor(contextKeyService, menuService) {
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
  }
  get resourceFolderMenu() {
    if (!this._resourceFolderMenu) {
      this._resourceFolderMenu = this.menuService.createMenu(MenuId.SCMResourceFolderContext, this.contextKeyService);
    }
    return this._resourceFolderMenu;
  }
  getResourceGroupMenu(resourceGroup) {
    if (typeof resourceGroup.contextValue === "undefined") {
      if (!this.genericResourceGroupMenu) {
        this.genericResourceGroupMenu = this.menuService.createMenu(MenuId.SCMResourceGroupContext, this.contextKeyService);
      }
      return this.genericResourceGroupMenu;
    }
    if (!this.contextualResourceGroupMenus) {
      this.contextualResourceGroupMenus = /* @__PURE__ */ new Map();
    }
    let item = this.contextualResourceGroupMenus.get(resourceGroup.contextValue);
    if (!item) {
      const contextKeyService = this.contextKeyService.createOverlay([["scmResourceGroupState", resourceGroup.contextValue]]);
      const menu = this.menuService.createMenu(MenuId.SCMResourceGroupContext, contextKeyService);
      item = {
        menu,
        dispose() {
          menu.dispose();
        }
      };
      this.contextualResourceGroupMenus.set(resourceGroup.contextValue, item);
    }
    return item.menu;
  }
  getResourceMenu(resource) {
    if (typeof resource.contextValue === "undefined") {
      if (!this.genericResourceMenu) {
        this.genericResourceMenu = this.menuService.createMenu(MenuId.SCMResourceContext, this.contextKeyService);
      }
      return this.genericResourceMenu;
    }
    if (!this.contextualResourceMenus) {
      this.contextualResourceMenus = /* @__PURE__ */ new Map();
    }
    let item = this.contextualResourceMenus.get(resource.contextValue);
    if (!item) {
      const contextKeyService = this.contextKeyService.createOverlay([["scmResourceState", resource.contextValue]]);
      const menu = this.menuService.createMenu(MenuId.SCMResourceContext, contextKeyService);
      item = {
        menu,
        dispose() {
          menu.dispose();
        }
      };
      this.contextualResourceMenus.set(resource.contextValue, item);
    }
    return item.menu;
  }
  dispose() {
    this.genericResourceGroupMenu?.dispose();
    this.genericResourceMenu?.dispose();
    this._resourceFolderMenu?.dispose();
    if (this.contextualResourceGroupMenus) {
      dispose(this.contextualResourceGroupMenus.values());
      this.contextualResourceGroupMenus.clear();
      this.contextualResourceGroupMenus = void 0;
    }
    if (this.contextualResourceMenus) {
      dispose(this.contextualResourceMenus.values());
      this.contextualResourceMenus.clear();
      this.contextualResourceMenus = void 0;
    }
  }
}
let SCMRepositoryMenus = class {
  constructor(provider, contextKeyService, instantiationService, menuService) {
    this.provider = provider;
    this.menuService = menuService;
    this.artifactGroupMenus = /* @__PURE__ */ new Map();
    this.artifactMenus = /* @__PURE__ */ new Map();
    this.resourceGroupMenusItems = /* @__PURE__ */ new Map();
    this.disposables = new DisposableStore();
    this.contextKeyService = contextKeyService.createOverlay([
      ["scmProvider", provider.providerId],
      ["scmProviderRootUri", provider.rootUri?.toString()],
      ["scmProviderHasRootUri", !!provider.rootUri]
    ]);
    const serviceCollection = new ServiceCollection([IContextKeyService, this.contextKeyService]);
    instantiationService = instantiationService.createChild(serviceCollection, this.disposables);
    this.titleMenu = instantiationService.createInstance(SCMTitleMenu);
    this.disposables.add(this.titleMenu);
    provider.onDidChangeResourceGroups(this.onDidChangeResourceGroups, this, this.disposables);
    this.onDidChangeResourceGroups();
  }
  getArtifactGroupMenu(artifactGroup) {
    let item = this.artifactGroupMenus.get(artifactGroup.id);
    if (!item) {
      const contextKeyService = this.contextKeyService.createOverlay([["scmArtifactGroup", artifactGroup.id]]);
      const menu = this.menuService.createMenu(MenuId.SCMArtifactGroupContext, contextKeyService);
      item = {
        menu,
        dispose() {
          menu.dispose();
        }
      };
      this.artifactGroupMenus.set(artifactGroup.id, item);
    }
    return item.menu;
  }
  getArtifactMenu(artifactGroup, artifact) {
    const historyProvider = this.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    const isHistoryItemRef = artifact.id === historyItemRef?.id;
    const key = isHistoryItemRef ? `${artifactGroup.id}|historyItemRef` : artifactGroup.id;
    let item = this.artifactMenus.get(key);
    if (!item) {
      const contextKeyService = this.contextKeyService.createOverlay([
        ["scmArtifactGroupId", artifactGroup.id],
        ["scmArtifactIsHistoryItemRef", isHistoryItemRef]
      ]);
      const menu = this.menuService.createMenu(MenuId.SCMArtifactContext, contextKeyService);
      item = {
        menu,
        dispose() {
          menu.dispose();
        }
      };
      this.artifactMenus.set(key, item);
    }
    return item.menu;
  }
  getRepositoryMenu(repository) {
    const contextValue = repository.provider.contextValue.get();
    if (typeof contextValue === "undefined") {
      if (!this.genericRepositoryMenu) {
        this.genericRepositoryMenu = this.menuService.createMenu(MenuId.SCMSourceControlInline, this.contextKeyService);
      }
      return this.genericRepositoryMenu;
    }
    if (!this.contextualRepositoryMenus) {
      this.contextualRepositoryMenus = /* @__PURE__ */ new Map();
    }
    let item = this.contextualRepositoryMenus.get(contextValue);
    if (!item) {
      const contextKeyService = this.contextKeyService.createOverlay([["scmProviderContext", contextValue]]);
      const menu = this.menuService.createMenu(MenuId.SCMSourceControlInline, contextKeyService);
      item = {
        menu,
        dispose() {
          menu.dispose();
        }
      };
      this.contextualRepositoryMenus.set(contextValue, item);
    }
    return item.menu;
  }
  getRepositoryContextMenu(repository) {
    const contextValue = repository.provider.contextValue.get();
    if (typeof contextValue === "undefined") {
      if (!this.genericRepositoryContextMenu) {
        this.genericRepositoryContextMenu = this.menuService.createMenu(MenuId.SCMSourceControl, this.contextKeyService);
      }
      return this.genericRepositoryContextMenu;
    }
    if (!this.contextualRepositoryContextMenus) {
      this.contextualRepositoryContextMenus = /* @__PURE__ */ new Map();
    }
    let item = this.contextualRepositoryContextMenus.get(contextValue);
    if (!item) {
      const contextKeyService = this.contextKeyService.createOverlay([["scmProviderContext", contextValue]]);
      const menu = this.menuService.createMenu(MenuId.SCMSourceControl, contextKeyService);
      item = {
        menu,
        dispose() {
          menu.dispose();
        }
      };
      this.contextualRepositoryContextMenus.set(contextValue, item);
    }
    return item.menu;
  }
  getResourceGroupMenu(group) {
    return this.getOrCreateResourceGroupMenusItem(group).getResourceGroupMenu(group);
  }
  getResourceMenu(resource) {
    return this.getOrCreateResourceGroupMenusItem(resource.resourceGroup).getResourceMenu(resource);
  }
  getResourceFolderMenu(group) {
    return this.getOrCreateResourceGroupMenusItem(group).resourceFolderMenu;
  }
  getOrCreateResourceGroupMenusItem(group) {
    let result = this.resourceGroupMenusItems.get(group);
    if (!result) {
      const contextKeyService = this.contextKeyService.createOverlay([
        ["scmResourceGroup", group.id],
        ["multiDiffEditorEnableViewChanges", group.multiDiffEditorEnableViewChanges]
      ]);
      result = new SCMMenusItem(contextKeyService, this.menuService);
      this.resourceGroupMenusItems.set(group, result);
    }
    return result;
  }
  onDidChangeResourceGroups() {
    for (const resourceGroup of this.resourceGroupMenusItems.keys()) {
      if (!this.provider.groups.includes(resourceGroup)) {
        this.resourceGroupMenusItems.get(resourceGroup)?.dispose();
        this.resourceGroupMenusItems.delete(resourceGroup);
      }
    }
  }
  dispose() {
    this.genericRepositoryMenu?.dispose();
    if (this.contextualRepositoryMenus) {
      dispose(this.contextualRepositoryMenus.values());
      this.contextualRepositoryMenus.clear();
      this.contextualRepositoryMenus = void 0;
    }
    this.resourceGroupMenusItems.forEach((item) => item.dispose());
    this.disposables.dispose();
  }
};
SCMRepositoryMenus = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMenuService)
], SCMRepositoryMenus);
let SCMMenus = class {
  constructor(scmService, instantiationService) {
    this.instantiationService = instantiationService;
    this.disposables = new DisposableStore();
    this.menus = /* @__PURE__ */ new Map();
    this.titleMenu = instantiationService.createInstance(SCMTitleMenu);
    scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.disposables);
  }
  onDidRemoveRepository(repository) {
    const menus = this.menus.get(repository.provider);
    menus?.dispose();
    this.menus.delete(repository.provider);
  }
  getRepositoryMenus(provider) {
    let result = this.menus.get(provider);
    if (!result) {
      const menus = this.instantiationService.createInstance(SCMRepositoryMenus, provider);
      const dispose2 = () => {
        menus.dispose();
        this.menus.delete(provider);
      };
      result = { menus, dispose: dispose2 };
      this.menus.set(provider, result);
    }
    return result.menus;
  }
  dispose() {
    this.disposables.dispose();
  }
};
SCMMenus = __decorateClass([
  __decorateParam(0, ISCMService),
  __decorateParam(1, IInstantiationService)
], SCMMenus);
MenuRegistry.appendMenuItem(MenuId.SCMResourceContext, {
  title: localize("miShare", "Share"),
  submenu: MenuId.SCMResourceContextShare,
  group: "45_share",
  order: 3
});
export {
  SCMMenus,
  SCMRepositoryMenus,
  SCMTitleMenu
};
