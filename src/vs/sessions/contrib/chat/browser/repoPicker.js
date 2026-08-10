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
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
const OPEN_REPO_COMMAND = "github.copilot.chat.cloudSessions.openRepository";
const STORAGE_KEY_LAST_REPO = "agentSessions.lastPickedRepo";
const STORAGE_KEY_RECENT_REPOS = "agentSessions.recentlyPickedRepos";
const MAX_RECENT_REPOS = 10;
const FILTER_THRESHOLD = 10;
let RepoPicker = class extends Disposable {
  constructor(actionWidgetService, storageService, commandService) {
    super();
    this.actionWidgetService = actionWidgetService;
    this.storageService = storageService;
    this.commandService = commandService;
    this._onDidSelectRepo = this._register(new Emitter());
    this.onDidSelectRepo = this._onDidSelectRepo.event;
    this._renderDisposables = this._register(new DisposableStore());
    this._recentlyPickedRepos = [];
    try {
      const last = this.storageService.get(STORAGE_KEY_LAST_REPO, StorageScope.PROFILE);
      if (last) {
        this._selectedRepo = JSON.parse(last);
      }
    } catch {
    }
    try {
      const stored = this.storageService.get(STORAGE_KEY_RECENT_REPOS, StorageScope.PROFILE);
      if (stored) {
        this._recentlyPickedRepos = JSON.parse(stored);
      }
    } catch {
    }
  }
  get selectedRepo() {
    return this._selectedRepo?.id;
  }
  /**
   * Renders the repo picker trigger button into the given container.
   * Returns the container element.
   */
  render(container) {
    this._renderDisposables.clear();
    const slot = dom.append(container, dom.$(".sessions-chat-picker-slot"));
    this._renderDisposables.add({ dispose: () => slot.remove() });
    const trigger = dom.append(slot, dom.$("a.action-label"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    this._triggerElement = trigger;
    this._updateTriggerLabel();
    this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      this.showPicker();
    }));
    this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        this.showPicker();
      }
    }));
    return slot;
  }
  /**
   * Shows the repo picker dropdown anchored to the trigger element.
   */
  showPicker() {
    if (!this._triggerElement || this.actionWidgetService.isVisible) {
      return;
    }
    const items = this._buildItems();
    const showFilter = items.filter((i) => i.kind === ActionListItemKind.Action).length > FILTER_THRESHOLD;
    const triggerElement = this._triggerElement;
    const delegate = {
      onSelect: (item) => {
        this.actionWidgetService.hide();
        if (item.id === "browse") {
          this._browseForRepo();
        } else {
          this._selectRepo(item);
        }
      },
      onHide: () => {
        triggerElement.focus();
      }
    };
    this.actionWidgetService.show(
      "repoPicker",
      false,
      items,
      delegate,
      this._triggerElement,
      void 0,
      [],
      {
        getAriaLabel: (item) => item.label ?? "",
        getWidgetAriaLabel: () => localize("repoPicker.ariaLabel", "Repository Picker")
      },
      showFilter ? { showFilter: true, filterPlaceholder: localize("repoPicker.filter", "Filter repositories...") } : void 0
    );
  }
  /**
   * Programmatically set the selected repository.
   */
  setSelectedRepo(repoPath) {
    this._selectRepo({ id: repoPath, name: repoPath });
  }
  /**
   * Clears the selected repository.
   */
  clearSelection() {
    this._selectedRepo = void 0;
    this._updateTriggerLabel();
  }
  _selectRepo(item) {
    this._selectedRepo = item;
    this._addToRecentlyPicked(item);
    this.storageService.store(STORAGE_KEY_LAST_REPO, JSON.stringify(item), StorageScope.PROFILE, StorageTarget.MACHINE);
    this._updateTriggerLabel();
    this._onDidSelectRepo.fire(item.id);
  }
  async _browseForRepo() {
    try {
      const result = await this.commandService.executeCommand(OPEN_REPO_COMMAND);
      if (result) {
        this._selectRepo({ id: result, name: result });
      }
    } catch {
    }
  }
  _addToRecentlyPicked(item) {
    this._recentlyPickedRepos = [
      { id: item.id, name: item.name },
      ...this._recentlyPickedRepos.filter((r) => r.id !== item.id)
    ].slice(0, MAX_RECENT_REPOS);
    this.storageService.store(STORAGE_KEY_RECENT_REPOS, JSON.stringify(this._recentlyPickedRepos), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  _buildItems() {
    const seenIds = /* @__PURE__ */ new Set();
    const items = [];
    if (this._selectedRepo) {
      seenIds.add(this._selectedRepo.id);
      items.push({
        kind: ActionListItemKind.Action,
        label: this._selectedRepo.name,
        group: { title: "", icon: Codicon.repo },
        item: this._selectedRepo
      });
    }
    const dedupedRepos = this._recentlyPickedRepos.filter((r) => !seenIds.has(r.id));
    dedupedRepos.sort((a, b) => a.name.localeCompare(b.name));
    for (const repo of dedupedRepos) {
      seenIds.add(repo.id);
      items.push({
        kind: ActionListItemKind.Action,
        label: repo.name,
        group: { title: "", icon: Codicon.repo },
        item: repo,
        onRemove: () => this._removeRepo(repo.id)
      });
    }
    if (items.length > 0) {
      items.push({ kind: ActionListItemKind.Separator, label: "" });
    }
    items.push({
      kind: ActionListItemKind.Action,
      label: localize("browseRepo", "Browse..."),
      group: { title: "", icon: Codicon.search },
      item: { id: "browse", name: localize("browseRepo", "Browse...") }
    });
    return items;
  }
  _removeRepo(repoId) {
    this._recentlyPickedRepos = this._recentlyPickedRepos.filter((r) => r.id !== repoId);
    this.storageService.store(STORAGE_KEY_RECENT_REPOS, JSON.stringify(this._recentlyPickedRepos), StorageScope.PROFILE, StorageTarget.MACHINE);
    this.actionWidgetService.hide();
    this.showPicker();
  }
  _updateTriggerLabel() {
    if (!this._triggerElement) {
      return;
    }
    dom.clearNode(this._triggerElement);
    const label = this._selectedRepo?.name ?? localize("pickRepo", "Pick Repository");
    dom.append(this._triggerElement, renderIcon(Codicon.repo));
    const labelSpan = dom.append(this._triggerElement, dom.$("span.sessions-chat-dropdown-label"));
    labelSpan.textContent = label;
    dom.append(this._triggerElement, renderIcon(Codicon.chevronDown));
    this._triggerElement.ariaLabel = localize("repoPicker.triggerAriaLabel", "Pick Repository, {0}", label);
  }
};
RepoPicker = __decorateClass([
  __decorateParam(0, IActionWidgetService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, ICommandService)
], RepoPicker);
export {
  RepoPicker
};
