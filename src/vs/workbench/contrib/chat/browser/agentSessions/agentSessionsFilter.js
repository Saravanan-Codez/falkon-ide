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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { equals } from "../../../../../base/common/objects.js";
import { localize } from "../../../../../nls.js";
import { registerAction2, Action2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IChatSessionsService } from "../../common/chatSessionsService.js";
import { AgentSessionProviders, getAgentSessionProvider, getAgentSessionProviderName } from "./agentSessions.js";
import { AgentSessionStatus } from "./agentSessionsModel.js";
var AgentSessionsGrouping = /* @__PURE__ */ ((AgentSessionsGrouping2) => {
  AgentSessionsGrouping2["Capped"] = "capped";
  AgentSessionsGrouping2["Date"] = "date";
  AgentSessionsGrouping2["Repository"] = "repository";
  return AgentSessionsGrouping2;
})(AgentSessionsGrouping || {});
var AgentSessionsSorting = /* @__PURE__ */ ((AgentSessionsSorting2) => {
  AgentSessionsSorting2["Created"] = "created";
  AgentSessionsSorting2["Updated"] = "updated";
  return AgentSessionsSorting2;
})(AgentSessionsSorting || {});
const DEFAULT_EXCLUDES = Object.freeze({
  providers: [],
  states: [],
  archived: true,
  read: false,
  repositoryGroupCapped: true
});
let AgentSessionsFilter = class extends Disposable {
  constructor(options, chatSessionsService, storageService) {
    super();
    this.options = options;
    this.chatSessionsService = chatSessionsService;
    this.storageService = storageService;
    this.STORAGE_KEY = `agentSessions.filterExcludes.agentsessionsviewerfiltersubmenu`;
    this.SORTING_STORAGE_KEY = `agentSessions.sorting`;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.limitResults = () => this.options.limitResults?.();
    this.groupResults = () => this.options.groupResults?.();
    this.sortResults = () => this.options.sortResults?.() ?? this.currentSorting;
    this.excludes = DEFAULT_EXCLUDES;
    this.isStoringExcludes = false;
    this.currentSorting = "created" /* Created */;
    this.actionDisposables = this._register(new DisposableStore());
    this.restoreSorting();
    this.updateExcludes(false);
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.chatSessionsService.onDidChangeItemsProviders(() => this.updateFilterActions()));
    this._register(this.chatSessionsService.onDidChangeAvailability(() => this.updateFilterActions()));
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, this.STORAGE_KEY, this._store)(() => this.updateExcludes(true)));
  }
  updateExcludes(fromEvent) {
    if (!this.isStoringExcludes) {
      const excludedTypesRaw = this.storageService.get(this.STORAGE_KEY, StorageScope.PROFILE);
      if (excludedTypesRaw) {
        try {
          this.excludes = JSON.parse(excludedTypesRaw);
        } catch {
          this.excludes = { ...DEFAULT_EXCLUDES };
        }
      } else {
        this.excludes = { ...DEFAULT_EXCLUDES };
      }
    }
    this.updateFilterActions();
    if (fromEvent) {
      this._onDidChange.fire();
    }
  }
  storeExcludes(excludes) {
    this.excludes = excludes;
    this.isStoringExcludes = true;
    try {
      if (equals(this.excludes, DEFAULT_EXCLUDES)) {
        this.storageService.remove(this.STORAGE_KEY, StorageScope.PROFILE);
      } else {
        this.storageService.store(this.STORAGE_KEY, JSON.stringify(this.excludes), StorageScope.PROFILE, StorageTarget.USER);
      }
    } finally {
      this.isStoringExcludes = false;
    }
  }
  restoreSorting() {
    const storedSorting = this.storageService.get(this.SORTING_STORAGE_KEY, StorageScope.PROFILE);
    if (storedSorting && Object.values(AgentSessionsSorting).includes(storedSorting)) {
      this.currentSorting = storedSorting;
    }
  }
  setSorting(sorting) {
    if (this.currentSorting === sorting) {
      return;
    }
    this.currentSorting = sorting;
    this.storageService.store(this.SORTING_STORAGE_KEY, sorting, StorageScope.PROFILE, StorageTarget.USER);
    this.updateFilterActions();
    this._onDidChange.fire();
  }
  updateFilterActions() {
    this.actionDisposables.clear();
    const menuId = this.options.filterMenuId;
    if (!menuId) {
      return;
    }
    this.registerSortActions(this.actionDisposables, menuId);
    this.registerProviderActions(this.actionDisposables, menuId);
    this.registerStateActions(this.actionDisposables, menuId);
    this.registerArchivedActions(this.actionDisposables, menuId);
    this.registerReadActions(this.actionDisposables, menuId);
    this.registerResetAction(this.actionDisposables, menuId);
  }
  registerSortActions(disposables, menuId) {
    const that = this;
    disposables.add(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `agentSessions.filter.sortByCreated.${menuId.id.toLowerCase()}`,
          title: localize("agentSessions.filter.sortByCreated", "Sort by Created"),
          menu: {
            id: menuId,
            group: "0_sort",
            order: 0
          },
          toggled: that.currentSorting === "created" /* Created */ ? ContextKeyExpr.true() : ContextKeyExpr.false()
        });
      }
      run() {
        that.setSorting("created" /* Created */);
      }
    }));
    disposables.add(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `agentSessions.filter.sortByUpdated.${menuId.id.toLowerCase()}`,
          title: localize("agentSessions.filter.sortByUpdated", "Sort by Updated"),
          menu: {
            id: menuId,
            group: "0_sort",
            order: 1
          },
          toggled: that.currentSorting === "updated" /* Updated */ ? ContextKeyExpr.true() : ContextKeyExpr.false()
        });
      }
      run() {
        that.setSorting("updated" /* Updated */);
      }
    }));
  }
  registerProviderActions(disposables, menuId) {
    const labelOverrides = this.options.providerLabelOverrides;
    const resolveLabel = (id) => {
      if (labelOverrides?.has(id)) {
        return labelOverrides.get(id);
      }
      const knownProvider = getAgentSessionProvider(id);
      return knownProvider ? getAgentSessionProviderName(knownProvider) : id;
    };
    let providers;
    if (this.options.allowedProviders) {
      providers = this.options.allowedProviders.map((id) => ({ id, label: resolveLabel(id) }));
    } else {
      providers = [{ id: AgentSessionProviders.Local, label: resolveLabel(AgentSessionProviders.Local) }];
      for (const contribution of this.chatSessionsService.getAllChatSessionContributions()) {
        if (providers.find((p) => p.id === contribution.type)) {
          continue;
        }
        providers.push({
          id: contribution.type,
          label: resolveLabel(contribution.type)
        });
      }
    }
    const that = this;
    let counter = 0;
    for (const provider of providers) {
      disposables.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `agentSessions.filter.toggleExclude:${provider.id}.${menuId.id.toLowerCase()}`,
            title: provider.label,
            menu: {
              id: menuId,
              group: "1_providers",
              order: counter++
            },
            toggled: that.excludes.providers.includes(provider.id) ? ContextKeyExpr.false() : ContextKeyExpr.true()
          });
        }
        run() {
          const providerExcludes = new Set(that.excludes.providers);
          if (!providerExcludes.delete(provider.id)) {
            providerExcludes.add(provider.id);
          }
          that.storeExcludes({ ...that.excludes, providers: Array.from(providerExcludes) });
        }
      }));
    }
  }
  registerStateActions(disposables, menuId) {
    const states = [
      { id: AgentSessionStatus.Completed, label: localize("agentSessionStatus.completed", "Completed") },
      { id: AgentSessionStatus.InProgress, label: localize("agentSessionStatus.inProgress", "In Progress") },
      { id: AgentSessionStatus.NeedsInput, label: localize("agentSessionStatus.needsInput", "Input Needed") },
      { id: AgentSessionStatus.Failed, label: localize("agentSessionStatus.failed", "Failed") }
    ];
    const that = this;
    let counter = 0;
    for (const state of states) {
      disposables.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `agentSessions.filter.toggleExcludeState:${state.id}.${menuId.id.toLowerCase()}`,
            title: state.label,
            menu: {
              id: menuId,
              group: "2_states",
              order: counter++
            },
            toggled: that.excludes.states.includes(state.id) ? ContextKeyExpr.false() : ContextKeyExpr.true()
          });
        }
        run() {
          const stateExcludes = new Set(that.excludes.states);
          if (!stateExcludes.delete(state.id)) {
            stateExcludes.add(state.id);
          }
          that.storeExcludes({ ...that.excludes, states: Array.from(stateExcludes) });
        }
      }));
    }
  }
  registerArchivedActions(disposables, menuId) {
    const that = this;
    disposables.add(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `agentSessions.filter.toggleExcludeArchived.${menuId.id.toLowerCase()}`,
          title: localize("agentSessions.filter.archived", "Archived"),
          menu: {
            id: menuId,
            group: "3_props",
            order: 1e3
          },
          toggled: that.excludes.archived ? ContextKeyExpr.false() : ContextKeyExpr.true()
        });
      }
      run() {
        that.storeExcludes({ ...that.excludes, archived: !that.excludes.archived });
      }
    }));
  }
  registerReadActions(disposables, menuId) {
    const that = this;
    disposables.add(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `agentSessions.filter.toggleExcludeRead.${menuId.id.toLowerCase()}`,
          title: localize("agentSessions.filter.read", "Read"),
          menu: {
            id: menuId,
            group: "3_props",
            order: 0
          },
          toggled: that.excludes.read ? ContextKeyExpr.false() : ContextKeyExpr.true()
        });
      }
      run() {
        that.storeExcludes({ ...that.excludes, read: !that.excludes.read });
      }
    }));
  }
  /**
   * Programmatically toggle the repository group capping state.
   */
  setRepositoryGroupCapped(capped) {
    if (this.excludes.repositoryGroupCapped !== capped) {
      this.storeExcludes({ ...this.excludes, repositoryGroupCapped: capped });
    }
  }
  registerResetAction(disposables, menuId) {
    const that = this;
    disposables.add(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `agentSessions.filter.resetExcludes.${menuId.id.toLowerCase()}`,
          title: localize("agentSessions.filter.reset", "Reset"),
          menu: {
            id: menuId,
            group: "4_reset",
            order: 0
          }
        });
      }
      run() {
        that.reset();
      }
    }));
  }
  isDefault() {
    return equals(this.excludes, DEFAULT_EXCLUDES) && this.currentSorting === "created" /* Created */;
  }
  getExcludes() {
    return this.excludes;
  }
  exclude(session) {
    const overrideExclude = this.options?.overrideExclude?.(session);
    if (typeof overrideExclude === "boolean") {
      return overrideExclude;
    }
    if (this.options.allowedProviders && !this.options.allowedProviders.includes(session.providerType)) {
      return true;
    }
    if (this.excludes.read && session.isRead()) {
      return true;
    }
    if (this.excludes.providers.includes(session.providerType)) {
      return true;
    }
    if (this.excludes.states.includes(session.status)) {
      return true;
    }
    if (this.excludes.archived && this.groupResults?.() === "capped" /* Capped */ && session.isArchived()) {
      return true;
    }
    return false;
  }
  notifyResults(count) {
    this.options.notifyResults?.(count);
  }
  reset() {
    this.storeExcludes({ ...DEFAULT_EXCLUDES });
    if (this.currentSorting !== "created" /* Created */) {
      this.setSorting("created" /* Created */);
    }
  }
};
AgentSessionsFilter = __decorateClass([
  __decorateParam(1, IChatSessionsService),
  __decorateParam(2, IStorageService)
], AgentSessionsFilter);
export {
  AgentSessionsFilter,
  AgentSessionsGrouping,
  AgentSessionsSorting
};
