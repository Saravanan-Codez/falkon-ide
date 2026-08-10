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
import * as dom from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { getErrorMessage } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, disposeIfDisposable, isDisposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { autorun, derived } from "../../../../base/common/observable.js";
import { PagedModel } from "../../../../base/common/paging.js";
import { dirname } from "../../../../base/common/resources.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchPagedList } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { getLocationBasedViewColors } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService, Extensions as ViewExtensions } from "../../../common/views.js";
import { getWorkbenchMenuMotionContextMenuOptions } from "../../../browser/actions/menuMotion.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { VIEW_CONTAINER } from "../../extensions/browser/extensions.contribution.js";
import { manageExtensionIcon } from "../../extensions/browser/extensionsIcons.js";
import { AbstractExtensionsListView } from "../../extensions/browser/extensionsViews.js";
import { DefaultViewsContext, extensionsFilterSubMenu, IExtensionsWorkbenchService, SearchAgentPluginsContext } from "../../extensions/common/extensions.js";
import { ChatContextKeys } from "../common/actions/chatContextKeys.js";
import { IAgentPluginService } from "../common/plugins/agentPluginService.js";
import { isContributionEnabled } from "../common/enablement.js";
import { IPluginInstallService } from "../common/plugins/pluginInstallService.js";
import { hasSourceChanged, IPluginMarketplaceService } from "../common/plugins/pluginMarketplaceService.js";
import { AgentPluginEditorInput } from "./agentPluginEditor/agentPluginEditorInput.js";
import { AgentPluginItemKind } from "./agentPluginEditor/agentPluginItems.js";
import { getInstalledPluginContextMenuActions, InstallPluginAction, OpenPluginReadmeAction } from "./agentPluginActions.js";
import { ForceUpdateAgentPluginsCommandId, HasInstalledAgentPluginsContext, InstalledAgentPluginsViewId, RefreshAgentPluginMarketplacesCommandId, UpdateAgentPluginsCommandId, UpdatingAgentPluginsContext } from "./chat.js";
function installedPluginToItem(plugin, labelService, outdated) {
  const name = plugin.label;
  const description = plugin.fromMarketplace?.description ?? labelService.getUriLabel(dirname(plugin.uri), { relative: true });
  const marketplace = plugin.fromMarketplace?.marketplace;
  return { kind: AgentPluginItemKind.Installed, name, description, marketplace, plugin, outdated };
}
function marketplacePluginToItem(plugin) {
  return {
    kind: AgentPluginItemKind.Marketplace,
    name: plugin.name,
    description: plugin.description,
    source: plugin.source,
    sourceDescriptor: plugin.sourceDescriptor,
    marketplace: plugin.marketplace,
    marketplaceReference: plugin.marketplaceReference,
    marketplaceType: plugin.marketplaceType,
    readmeUri: plugin.readmeUri
  };
}
let UpdatePluginAction = class extends Action {
  constructor(plugin, liveMarketplacePlugin, pluginInstallService, pluginMarketplaceService) {
    super(UpdatePluginAction.ID, localize("update", "Update"), "extension-action label prominent install");
    this.plugin = plugin;
    this.liveMarketplacePlugin = liveMarketplacePlugin;
    this.pluginInstallService = pluginInstallService;
    this.pluginMarketplaceService = pluginMarketplaceService;
  }
  static {
    this.ID = "agentPlugin.update";
  }
  async run() {
    if (await this.pluginInstallService.updatePlugin(this.liveMarketplacePlugin)) {
      this.pluginMarketplaceService.addInstalledPlugin(this.plugin.uri, this.liveMarketplacePlugin);
    }
  }
};
UpdatePluginAction = __decorateClass([
  __decorateParam(2, IPluginInstallService),
  __decorateParam(3, IPluginMarketplaceService)
], UpdatePluginAction);
let ManagePluginAction = class extends Action {
  constructor(getActionGroups, instantiationService) {
    super(ManagePluginAction.ID, "", ManagePluginAction.CLASS, true);
    this.getActionGroups = getActionGroups;
    this.instantiationService = instantiationService;
    this._actionViewItem = null;
    this.tooltip = localize("manage", "Manage");
  }
  static {
    this.ID = "agentPlugin.manage";
  }
  static {
    this.CLASS = `extension-action icon manage ${ThemeIcon.asClassName(manageExtensionIcon)}`;
  }
  createActionViewItem(options) {
    this._actionViewItem = this.instantiationService.createInstance(DropDownActionViewItem, this, options);
    return this._actionViewItem;
  }
  async run() {
    this._actionViewItem?.showMenu(this.getActionGroups());
  }
};
ManagePluginAction = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ManagePluginAction);
let DropDownActionViewItem = class extends ActionViewItem {
  constructor(action, options, contextMenuService) {
    super(null, action, { ...options, icon: true, label: false });
    this.contextMenuService = contextMenuService;
  }
  showMenu(actionGroups) {
    if (!this.element) {
      return;
    }
    const actions = actionGroups.flatMap((group) => [...group, new Separator()]);
    if (actions.length > 0) {
      actions.pop();
    }
    this.contextMenuService.showContextMenu({
      ...getWorkbenchMenuMotionContextMenuOptions(this.element),
      getActions: () => actions,
      onHide: () => disposeIfDisposable(actions)
    });
  }
};
DropDownActionViewItem = __decorateClass([
  __decorateParam(2, IContextMenuService)
], DropDownActionViewItem);
let AgentPluginRenderer = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
    this.templateId = AgentPluginRenderer.templateId;
  }
  static {
    this.templateId = "agentPlugin";
  }
  renderTemplate(root) {
    const element = dom.append(root, dom.$(".agent-plugin-item.extension-list-item"));
    const details = dom.append(element, dom.$(".details"));
    const headerContainer = dom.append(details, dom.$(".header-container"));
    const header = dom.append(headerContainer, dom.$(".header"));
    const name = dom.append(header, dom.$("span.name"));
    const description = dom.append(details, dom.$(".description.ellipsis"));
    const footer = dom.append(details, dom.$(".footer"));
    const detailContainer = dom.append(footer, dom.$(".publisher-container"));
    const detail = dom.append(detailContainer, dom.$("span.publisher-name"));
    const actionbar = new ActionBar(footer, {
      focusOnlyEnabledItems: true,
      actionViewItemProvider: (action, options) => {
        if (action instanceof ManagePluginAction) {
          return action.createActionViewItem(options);
        }
        return void 0;
      }
    });
    actionbar.setFocusable(false);
    return { root, name, description, detail, actionbar, disposables: [actionbar], elementDisposables: [] };
  }
  renderPlaceholder(_index, data) {
    data.name.textContent = "";
    data.description.textContent = "";
    data.detail.textContent = "";
    data.actionbar.clear();
    this.disposeElement(void 0, 0, data);
  }
  renderElement(element, _index, data) {
    this.disposeElement(void 0, 0, data);
    data.name.textContent = element.name;
    data.description.textContent = element.description;
    data.elementDisposables.push(autorun((reader) => {
      data.root.classList.toggle("disabled", element.kind === AgentPluginItemKind.Installed && !isContributionEnabled(element.plugin.enablement.read(reader)));
    }));
    const updateActions = (reader) => {
      data.actionbar.clear();
      if (element.kind === AgentPluginItemKind.Marketplace) {
        data.detail.textContent = element.marketplace;
        const installAction = this.instantiationService.createInstance(InstallPluginAction, element);
        reader.store.add(installAction);
        data.actionbar.push([installAction], { icon: true, label: true });
      } else {
        data.detail.textContent = element.marketplace ?? "";
        const actions = [];
        const livePlugin = element.outdated?.read(reader);
        if (livePlugin) {
          const updateAction = this.instantiationService.createInstance(UpdatePluginAction, element.plugin, livePlugin);
          reader.store.add(updateAction);
          actions.push(updateAction);
        }
        const manageAction = this.instantiationService.createInstance(
          ManagePluginAction,
          () => getInstalledPluginContextMenuActions(element.plugin, this.instantiationService)
        );
        reader.store.add(manageAction);
        actions.push(manageAction);
        data.actionbar.push(actions, { icon: true, label: true });
      }
    };
    data.elementDisposables.push(autorun(updateActions));
  }
  disposeElement(_element, _index, data) {
    for (const d of data.elementDisposables) {
      d.dispose();
    }
    data.elementDisposables = [];
  }
  disposeTemplate(data) {
    for (const d of data.disposables) {
      d.dispose();
    }
    this.disposeElement(void 0, 0, data);
  }
};
AgentPluginRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], AgentPluginRenderer);
let AgentPluginsListView = class extends AbstractExtensionsListView {
  constructor(listOptions, options, keybindingService, contextMenuService, instantiationService, themeService, hoverService, configurationService, contextKeyService, viewDescriptorService, openerService, agentPluginService, pluginMarketplaceService, pluginInstallService, labelService, editorService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.listOptions = listOptions;
    this.agentPluginService = agentPluginService;
    this.pluginMarketplaceService = pluginMarketplaceService;
    this.pluginInstallService = pluginInstallService;
    this.labelService = labelService;
    this.editorService = editorService;
    this.actionStore = this._register(new DisposableStore());
    this.queryCts = new MutableDisposable();
    this.list = null;
    this.listContainer = null;
    this.currentQuery = "@agentPlugins";
    this.refreshOnPluginsChangedScheduler = this._register(new RunOnceScheduler(() => {
      if (this.list) {
        void this.show(this.currentQuery);
      }
    }, 0));
    this._register(autorun((reader) => {
      const plugins = this.agentPluginService.plugins.read(reader);
      for (const plugin of plugins) {
        plugin.enablement.read(reader);
      }
      if (this.list && this.isBodyVisible()) {
        this.refreshOnPluginsChangedScheduler.schedule();
      }
    }));
    this._register(this.pluginMarketplaceService.onDidChangeMarketplaces(() => {
      if (this.list && this.isBodyVisible()) {
        this.refreshOnPluginsChangedScheduler.schedule();
      }
    }));
  }
  renderBody(container) {
    super.renderBody(container);
    const messageContainer = dom.append(container, dom.$(".message-container"));
    const messageBox = dom.append(messageContainer, dom.$(".message"));
    const pluginsList = dom.$(".agent-plugins-list");
    this.bodyTemplate = { pluginsList, messageBox, messageContainer };
    this.listContainer = dom.append(container, pluginsList);
    this.list = this._register(this.instantiationService.createInstance(
      WorkbenchPagedList,
      `${this.id}-Agent-Plugins`,
      this.listContainer,
      {
        getHeight() {
          return 72;
        },
        getTemplateId: () => AgentPluginRenderer.templateId
      },
      [this.instantiationService.createInstance(AgentPluginRenderer)],
      {
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        horizontalScrolling: false,
        accessibilityProvider: {
          getAriaLabel(item) {
            return item?.name ?? "";
          },
          getWidgetAriaLabel() {
            return localize("agentPlugins", "Agent Plugins");
          }
        },
        overrideStyles: getLocationBasedViewColors(this.viewDescriptorService.getViewLocationById(this.id)).listOverrideStyles
      }
    ));
    this._register(this.list.onContextMenu((e) => this.onContextMenu(e), this));
    this._register(Event.debounce(Event.filter(this.list.onDidOpen, (e) => e.element !== null), (_, event) => event, 75, true)((options) => {
      this.editorService.openEditor(
        this.instantiationService.createInstance(AgentPluginEditorInput, options.element),
        options.editorOptions
      );
    }));
  }
  onContextMenu(e) {
    if (!e.element) {
      return;
    }
    const actions = this.getContextMenuActions(e.element);
    if (actions.length === 0) {
      return;
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => actions
    });
  }
  getContextMenuActions(item) {
    let actions;
    if (item.kind === AgentPluginItemKind.Installed) {
      const groups = getInstalledPluginContextMenuActions(item.plugin, this.instantiationService);
      actions = groups.flatMap((group) => [...group, new Separator()]);
      if (actions.length > 0) {
        actions.pop();
      }
    } else {
      actions = [];
      if (item.readmeUri) {
        actions.push(this.instantiationService.createInstance(OpenPluginReadmeAction, item.readmeUri));
      }
      actions.push(this.instantiationService.createInstance(InstallPluginAction, item));
    }
    this.actionStore.clear();
    for (const action of actions) {
      if (isDisposable(action)) {
        this.actionStore.add(action);
      }
    }
    return actions;
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.list?.layout(height, width);
  }
  async show(query) {
    this.currentQuery = query;
    const stripped = query.replace(/@agentPlugins/i, "").trim();
    const isRecommended = /^@recommended$/i.test(stripped);
    const isInstalled = /(?:^|\s)@installed(?:\s|$)/i.test(stripped);
    const text = isRecommended ? "" : stripped.replace(/(?:^|\s)@installed(?:\s|$)/gi, " ").trim().toLowerCase();
    let installed = this.queryInstalled();
    if (text) {
      installed = installed.filter(
        (p) => p.name.toLowerCase().includes(text) || p.description.toLowerCase().includes(text) || (p.marketplace ?? "").toLowerCase().includes(text)
      );
    }
    if (isRecommended) {
      const recommended = this.pluginMarketplaceService.recommendedPlugins.get();
      installed = installed.filter((p) => {
        const marketplace = p.plugin.fromMarketplace;
        if (!marketplace) {
          return false;
        }
        const key = `${marketplace.name}@${marketplace.marketplace}`;
        return recommended.has(key);
      });
    }
    let items = installed;
    if (!this.listOptions.installedOnly && !isInstalled) {
      const marketplacePlugins = await this.queryMarketplacePlugins();
      let filteredMp = marketplacePlugins;
      if (isRecommended) {
        const recommended = this.pluginMarketplaceService.recommendedPlugins.get();
        filteredMp = filteredMp.filter((p) => {
          const key = `${p.name}@${p.marketplace}`;
          return recommended.has(key);
        });
      } else {
        const lowerText = text.toLowerCase();
        filteredMp = filteredMp.filter((p) => p.name.toLowerCase().includes(lowerText) || p.description.toLowerCase().includes(lowerText) || p.marketplace.toLowerCase().includes(lowerText));
      }
      const marketplace = filteredMp.map(marketplacePluginToItem);
      const installedPaths = new Set(installed.map((i) => i.plugin.uri.toString()));
      const filteredMarketplace = marketplace.filter((m) => {
        const expectedUri = this.pluginInstallService.getPluginInstallUri({
          name: m.name,
          description: m.description,
          version: "",
          source: m.source,
          sourceDescriptor: m.sourceDescriptor,
          marketplace: m.marketplace,
          marketplaceReference: m.marketplaceReference,
          marketplaceType: m.marketplaceType
        });
        return !installedPaths.has(expectedUri.toString());
      });
      items = [...installed, ...filteredMarketplace];
    }
    const model = new PagedModel(items);
    if (this.list) {
      this.list.model = model;
    }
    this.updateBody(model.length);
    return model;
  }
  /**
   * Builds the installed plugin list using only cached marketplace data
   * (no IO). The cached data is populated by {@link fetchMarketplacePlugins}
   * and exposed via the {@link IPluginMarketplaceService.lastFetchedPlugins}
   * observable, which the view's autorun subscribes to for reactivity.
   */
  queryInstalled() {
    const marketplaceObs = derived((reader) => {
      const cachedMarketplace = this.pluginMarketplaceService.lastFetchedPlugins.read(reader);
      const marketplaceByKey = /* @__PURE__ */ new Map();
      for (const mp of cachedMarketplace) {
        marketplaceByKey.set(`${mp.marketplaceReference.canonicalId}::${mp.name}`, mp);
      }
      const installedByUri = /* @__PURE__ */ new Map();
      for (const entry of this.pluginMarketplaceService.installedPlugins.read(reader)) {
        installedByUri.set(entry.pluginUri.toString(), entry.plugin);
      }
      return { marketplaceByKey, installedByUri };
    });
    const plugins = this.agentPluginService.plugins.get();
    return plugins.map((p) => {
      const isOutdated = derived((reader) => {
        const { marketplaceByKey, installedByUri } = marketplaceObs.read(reader);
        const storedPlugin = installedByUri.get(p.uri.toString()) ?? p.fromMarketplace;
        if (storedPlugin) {
          const key = `${storedPlugin.marketplaceReference.canonicalId}::${storedPlugin.name}`;
          const live = marketplaceByKey.get(key);
          if (live && hasSourceChanged(storedPlugin.sourceDescriptor, live.sourceDescriptor)) {
            return live;
          }
        }
        return void 0;
      });
      return installedPluginToItem(p, this.labelService, isOutdated);
    });
  }
  async queryMarketplacePlugins() {
    this.queryCts.value?.cancel();
    const cts = new CancellationTokenSource();
    this.queryCts.value = cts;
    try {
      return await this.pluginMarketplaceService.fetchMarketplacePlugins(cts.token);
    } catch {
      return [];
    }
  }
  updateBody(count) {
    if (this.bodyTemplate) {
      this.bodyTemplate.pluginsList.classList.toggle("hidden", count === 0);
      this.bodyTemplate.messageContainer.classList.toggle("hidden", count > 0);
      if (count === 0 && this.isBodyVisible()) {
        this.bodyTemplate.messageBox.textContent = localize("noAgentPlugins", "No agent plugins found.");
      }
    }
  }
};
AgentPluginsListView = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IViewDescriptorService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, IAgentPluginService),
  __decorateParam(12, IPluginMarketplaceService),
  __decorateParam(13, IPluginInstallService),
  __decorateParam(14, ILabelService),
  __decorateParam(15, IEditorService)
], AgentPluginsListView);
let updatingPluginsContextKey;
let updatePluginsPromise;
function updatePlugins(accessor, force) {
  if (updatePluginsPromise) {
    return updatePluginsPromise;
  }
  const pluginInstallService = accessor.get(IPluginInstallService);
  const notificationService = accessor.get(INotificationService);
  updatingPluginsContextKey?.set(true);
  updatePluginsPromise = (async () => {
    try {
      const result = await pluginInstallService.updateAllPlugins({ force }, CancellationToken.None);
      if (result.updatedNames.length === 0 && result.failedNames.length === 0) {
        notificationService.info(localize("agentPlugins.upToDate", "Plugins are up to date."));
      }
    } catch (error) {
      notificationService.error(localize("agentPlugins.updateFailed", "Failed to update plugins: {0}", getErrorMessage(error)));
      throw error;
    } finally {
      updatePluginsPromise = void 0;
      updatingPluginsContextKey?.set(false);
    }
  })();
  return updatePluginsPromise;
}
class AgentPluginsBrowseCommand extends Action2 {
  constructor() {
    super({
      id: "workbench.agentPlugins.browse",
      title: localize2("agentPlugins.browse", "Agent Plugins"),
      tooltip: localize2("agentPlugins.browse.tooltip", "Browse Agent Plugins"),
      icon: Codicon.search,
      precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
      menu: [{
        id: extensionsFilterSubMenu,
        group: "1_predefined",
        order: 2,
        when: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate())
      }, {
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", InstalledAgentPluginsViewId), ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
        group: "navigation"
      }]
    });
  }
  async run(accessor) {
    accessor.get(IExtensionsWorkbenchService).openSearch("@agentPlugins ");
  }
}
class CheckForPluginUpdatesCommand extends Action2 {
  constructor() {
    super({
      id: UpdateAgentPluginsCommandId,
      title: localize2("agentPlugins.checkForUpdates", "Update Plugins"),
      category: localize2("chat.category", "Chat"),
      icon: Codicon.refresh,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, UpdatingAgentPluginsContext.negate()),
      f1: true,
      menu: [{
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("view", InstalledAgentPluginsViewId),
          ChatContextKeys.Setup.hidden.negate(),
          ChatContextKeys.Setup.disabledInWorkspace.negate()
        ),
        group: "navigation",
        order: 1,
        alt: {
          id: ForceUpdateAgentPluginsCommandId,
          title: localize2("agentPlugins.forceUpdate", "Update Plugins (Force)"),
          icon: Codicon.refresh
        }
      }]
    });
  }
  async run(accessor) {
    await updatePlugins(accessor, false);
  }
}
class ForceUpdatePluginsCommand extends Action2 {
  constructor() {
    super({
      id: ForceUpdateAgentPluginsCommandId,
      title: localize2("agentPlugins.forceUpdate", "Update Plugins (Force)"),
      category: localize2("chat.category", "Chat"),
      icon: Codicon.refresh,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, UpdatingAgentPluginsContext.negate()),
      f1: true
    });
  }
  async run(accessor) {
    await updatePlugins(accessor, true);
  }
}
class RefreshPluginMarketplacesCommand extends Action2 {
  constructor() {
    super({
      id: RefreshAgentPluginMarketplacesCommandId,
      title: localize2("agentPlugins.refreshMarketplaces", "Refresh Plugin Marketplaces"),
      category: localize2("chat.category", "Chat"),
      icon: Codicon.refresh,
      precondition: ChatContextKeys.enabled,
      f1: true
    });
  }
  async run(accessor) {
    const marketplaceService = accessor.get(IPluginMarketplaceService);
    const notificationService = accessor.get(INotificationService);
    const progressService = accessor.get(IProgressService);
    const cts = new CancellationTokenSource();
    const failedLabels = [];
    try {
      await progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title: localize("agentPlugins.refreshingMarketplaces", "Refreshing plugin marketplaces..."),
          cancellable: true
        },
        () => marketplaceService.fetchMarketplacePlugins(cts.token, void 0, {
          refresh: true,
          onMarketplaceError: (reference) => failedLabels.push(reference.displayLabel)
        }),
        () => cts.dispose(true)
      );
      if (cts.token.isCancellationRequested) {
        return;
      }
      if (failedLabels.length > 0) {
        notificationService.warn(localize("agentPlugins.marketplacesRefreshedWithErrors", "Refreshed plugin marketplaces, but {0} could not be read: {1}", failedLabels.length, failedLabels.join(", ")));
      } else {
        notificationService.info(localize("agentPlugins.marketplacesRefreshed", "Plugin marketplaces refreshed."));
      }
    } catch (error) {
      notificationService.error(localize("agentPlugins.refreshMarketplacesFailed", "Failed to refresh plugin marketplaces: {0}", getErrorMessage(error)));
      throw error;
    } finally {
      cts.dispose();
    }
  }
}
let AgentPluginsViewsContribution = class extends Disposable {
  static {
    this.ID = "workbench.chat.agentPlugins.views.contribution";
  }
  constructor(contextKeyService, agentPluginService) {
    super();
    const hasInstalledKey = HasInstalledAgentPluginsContext.bindTo(contextKeyService);
    updatingPluginsContextKey = UpdatingAgentPluginsContext.bindTo(contextKeyService);
    this._register(autorun((reader) => {
      hasInstalledKey.set(agentPluginService.plugins.read(reader).length > 0);
    }));
    registerAction2(AgentPluginsBrowseCommand);
    registerAction2(CheckForPluginUpdatesCommand);
    registerAction2(ForceUpdatePluginsCommand);
    registerAction2(RefreshPluginMarketplacesCommand);
    Registry.as(ViewExtensions.ViewsRegistry).registerViews([
      {
        id: InstalledAgentPluginsViewId,
        name: localize2("agent-plugins-installed", "Agent Plugins - Installed"),
        ctorDescriptor: new SyncDescriptor(AgentPluginsListView, [{ installedOnly: true }]),
        when: ContextKeyExpr.and(DefaultViewsContext, HasInstalledAgentPluginsContext, ChatContextKeys.Setup.hidden.negate()),
        weight: 30,
        order: 5,
        canToggleVisibility: true
      },
      {
        id: "workbench.views.agentPlugins.default.marketplace",
        name: localize2("agent-plugins", "Agent Plugins"),
        ctorDescriptor: new SyncDescriptor(AgentPluginsListView, [{}]),
        when: ContextKeyExpr.and(DefaultViewsContext, HasInstalledAgentPluginsContext.toNegated(), ChatContextKeys.Setup.hidden.negate()),
        weight: 30,
        order: 5,
        canToggleVisibility: true,
        hideByDefault: true
      },
      {
        id: "workbench.views.agentPlugins.marketplace",
        name: localize2("agent-plugins", "Agent Plugins"),
        ctorDescriptor: new SyncDescriptor(AgentPluginsListView, [{}]),
        when: ContextKeyExpr.and(SearchAgentPluginsContext, ChatContextKeys.Setup.hidden.negate())
      }
    ], VIEW_CONTAINER);
  }
};
AgentPluginsViewsContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IAgentPluginService)
], AgentPluginsViewsContribution);
export {
  AgentPluginsListView,
  AgentPluginsViewsContribution
};
