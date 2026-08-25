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
import * as touch from "../../../../base/browser/touch.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { toAction } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { TabbedActionListWidget } from "../../../../platform/actionWidget/browser/tabbedActionListWidget.js";
import { IMenuService, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus, RemoteAgentHostsEnabledSettingId } from "../../../../platform/agentHost/common/remoteAgentHostService.js";
import { TUNNEL_ADDRESS_PREFIX } from "../../../../platform/agentHost/common/tunnelAgentHost.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { SESSION_WORKSPACE_GROUP_LOCAL, SESSION_WORKSPACE_GROUP_REMOTE } from "../../../services/sessions/common/session.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionsRecentWorkspacesService, isWorktreeWorkspaceUri } from "../../../services/sessions/browser/sessionsRecentWorkspacesService.js";
import { isAgentHostProvider } from "../../../common/agentHostSessionsProvider.js";
import { SessionWorkspacePickerGroupContext } from "../../../common/contextkeys.js";
import { getStatusHover, getStatusLabel, removeRemoteHost, showRemoteHostOptions } from "../../providers/remoteAgentHost/browser/remoteHostOptions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { reportNewChatPickerClosed } from "./newChatPickerTelemetry.js";
import { Menus } from "../../../browser/menus.js";
import { markOnboardingTarget } from "../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js";
const FILTER_THRESHOLD = 10;
const TABBED_PICKER_WIDTH = 360;
const RESTORE_CONNECT_GRACE_MS = 5e3;
let WorkspacePicker = class extends Disposable {
  constructor(options, actionWidgetService, uriIdentityService, sessionsProvidersService, recentWorkspacesService, remoteAgentHostService, configurationService, commandService, menuService, contextKeyService, instantiationService, fileDialogService, telemetryService, notificationService) {
    super();
    this.options = options;
    this.actionWidgetService = actionWidgetService;
    this.uriIdentityService = uriIdentityService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.recentWorkspacesService = recentWorkspacesService;
    this.remoteAgentHostService = remoteAgentHostService;
    this.configurationService = configurationService;
    this.commandService = commandService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.fileDialogService = fileDialogService;
    this.telemetryService = telemetryService;
    this.notificationService = notificationService;
    this._onDidSelectWorkspace = this._register(new Emitter());
    this.onDidSelectWorkspace = this._onDidSelectWorkspace.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._selectionGeneration = 0;
    /**
     * Set to `true` once the user has explicitly picked or cleared a workspace.
     * Until then, late-arriving provider registrations are allowed to upgrade
     * the current (auto-restored) selection to the user's stored "checked"
     * entry. After the user has acted, providers coming and going never move
     * the selection out from under them.
     */
    this._userHasPicked = false;
    /**
     * Watches the connection status of a restored remote workspace. Cleared when
     * the user explicitly picks, when the connection succeeds, or when it fails
     * and we fall back.
     */
    this._connectionStatusWatch = this._register(new MutableDisposable());
    this._localBrowseAction = {
      label: localize("workspacePicker.browseSelectLocal", "Select..."),
      group: SESSION_WORKSPACE_GROUP_LOCAL,
      icon: Codicon.folderOpened,
      providerId: "",
      run: async () => (await this._browseForLocalFolder())?.workspace
    };
    /** All live trigger elements. Label updates fan out to every entry. */
    this._triggerElements = /* @__PURE__ */ new Set();
    this._renderDisposables = this._register(new DisposableStore());
    /**
     * Whether the user explicitly clicked a tab while the picker was open.
     * Reset on each fresh open so the picker re-defaults to the selected
     * workspace's group between opens.
     */
    this._userPickedTab = false;
    this._tabbedWidget = this._register(this.instantiationService.createInstance(TabbedActionListWidget));
    this._pickerGroupContext = SessionWorkspacePickerGroupContext.bindTo(this.contextKeyService);
    this._register(this._tabbedWidget.onDidChangeTab((tab) => {
      this._activeTab = tab;
      this._userPickedTab = true;
      this._pickerGroupContext.set(tab);
    }));
    this._register(this._tabbedWidget.onDidHide(() => {
      this._pickerGroupContext.reset();
    }));
    const restored = this._restoreSelectedWorkspace();
    this._applySelection(restored);
    if (this._selectedResolved) {
      this._watchForConnectionFailure(this._selectedResolved);
    }
    this._register(this.sessionsProvidersService.onDidChangeProviders(() => {
      if (this._selectedFolderUri) {
        const reresolved = this._resolveFolder(this._selectedFolderUri);
        if (!reresolved) {
          this._selectedFolderUri = void 0;
          this._selectedResolved = void 0;
          this._connectionStatusWatch.clear();
          this._updateTriggerLabel();
          this._onDidChangeSelection.fire();
          this._onDidSelectWorkspace.fire(void 0);
        } else {
          this._selectedResolved = reresolved;
        }
      }
      this._restoreSelectionFromHistory();
    }));
    this._register(this.recentWorkspacesService.onDidChangeRecentWorkspaces(() => {
      if (!this._selectedFolderUri) {
        this._restoreSelectionFromHistory();
      }
    }));
    this._register(this.onDidSelectWorkspace((selection) => {
      if (selection && !this.actionWidgetService.isVisible && !this._tabbedWidget.isVisible) {
        this._userPickedTab = false;
      }
    }));
  }
  get selectedFolderUri() {
    return this._selectedFolderUri;
  }
  /**
   * Returns the currently selected folder resolved to a workspace via the
   * first provider that can resolve it. Used internally for rendering
   * (label, icon, group). The provider association is not part of the
   * picker's public contract — callers should use {@link selectedFolderUri}
   * and let the management service rediscover the provider.
   */
  get selectedResolved() {
    return this._selectedResolved;
  }
  /**
   * Renders the project picker trigger button into the given container.
   * Returns the container element.
   *
   * Calling it again replaces the trigger created by the previous
   * {@link render} call.
   */
  render(container) {
    this._renderDisposables.clear();
    const slot = dom.append(container, dom.$(".sessions-chat-picker-slot.sessions-chat-workspace-picker"));
    this._renderDisposables.add({ dispose: () => slot.remove() });
    this._renderDisposables.add(this._addTrigger(slot));
    return slot;
  }
  /**
   * Shared trigger-creation core for {@link render}. Wires up the click /
   * keyboard / touch handlers and the per-trigger lifecycle.
   */
  _addTrigger(slot) {
    const triggerDisposables = new DisposableStore();
    const trigger = dom.append(slot, dom.$("a.action-label"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    this._triggerElements.add(trigger);
    this._triggerElement = trigger;
    this._renderTriggerLabel(trigger);
    triggerDisposables.add(markOnboardingTarget(trigger, "sessions.newSession.workspacePicker", {
      open: () => this.showPicker(false, trigger)
    }));
    triggerDisposables.add(touch.Gesture.addTarget(trigger));
    [dom.EventType.CLICK, touch.EventType.Tap].forEach((eventType) => {
      triggerDisposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        this.showPicker(false, trigger);
      }));
    });
    triggerDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        this.showPicker(false, trigger);
      }
    }));
    triggerDisposables.add({
      dispose: () => {
        this._triggerElements.delete(trigger);
        if (this._triggerElement === trigger) {
          this._triggerElement = this._triggerElements.values().next().value;
        }
      }
    });
    return triggerDisposables;
  }
  /**
   * Shows the workspace picker dropdown anchored to a trigger element.
   *
   * @param force When true, re-show even if the picker is already visible.
   *              Used internally when swapping items in place after a tab
   *              change.
   * @param anchor The specific trigger element to anchor the popup to. When
   *               omitted, defaults to the most-recently rendered trigger.
   *               Pass through when more than one trigger is live and the
   *               popup should align with the one the user actually clicked.
   */
  showPicker(force = false, anchor) {
    const triggerElement = anchor ?? this._triggerElement;
    if (!triggerElement) {
      return;
    }
    const alreadyVisible = this.actionWidgetService.isVisible || this._tabbedWidget.isVisible;
    if (!force && alreadyVisible) {
      return;
    }
    const tabs = this._showTabs() ? this._getAvailableTabs() : [];
    if (tabs.length > 0) {
      const selectedGroup = this._selectedResolved?.workspace.group;
      if (!this._userPickedTab && selectedGroup && tabs.some((t) => t.id === selectedGroup)) {
        this._activeTab = selectedGroup;
      }
      if (!this._activeTab || !tabs.some((t) => t.id === this._activeTab)) {
        this._activeTab = tabs[0].id;
      }
    }
    const tabbed = tabs.length > 1;
    if (tabbed) {
      this._showTabbedPicker(tabs, triggerElement);
    } else {
      this._activeTab = void 0;
      this._showFlatPicker(triggerElement);
    }
  }
  /**
   * Subclasses may opt out of the categorical tab bar (e.g. when scoped to
   * a single host).
   */
  _showTabs() {
    return true;
  }
  _getAvailableTabs() {
    const byLabel = /* @__PURE__ */ new Map();
    const remoteAgentHostsEnabled = this.configurationService.getValue(RemoteAgentHostsEnabledSettingId);
    if (remoteAgentHostsEnabled) {
      byLabel.set(SESSION_WORKSPACE_GROUP_REMOTE, {
        id: SESSION_WORKSPACE_GROUP_REMOTE,
        icon: Codicon.beaker,
        tooltip: `${SESSION_WORKSPACE_GROUP_REMOTE} (${localize("workspacePicker.experimental", "Experimental")})`
      });
    }
    for (const provider of this.sessionsProvidersService.getProviders()) {
      if (provider.supportsLocalWorkspaces && !byLabel.has(SESSION_WORKSPACE_GROUP_LOCAL)) {
        byLabel.set(SESSION_WORKSPACE_GROUP_LOCAL, { id: SESSION_WORKSPACE_GROUP_LOCAL });
      }
      for (const action of provider.browseActions) {
        if (action.group === SESSION_WORKSPACE_GROUP_REMOTE && !remoteAgentHostsEnabled) {
          continue;
        }
        if (action.group && !byLabel.has(action.group)) {
          byLabel.set(action.group, { id: action.group });
        }
      }
    }
    return Array.from(byLabel.values()).sort((a, b) => a.id === SESSION_WORKSPACE_GROUP_LOCAL ? -1 : b.id === SESSION_WORKSPACE_GROUP_LOCAL ? 1 : a.id.localeCompare(b.id));
  }
  /**
   * Builds the shared `IActionListDelegate` used by both the flat and
   * tabbed presentations.
   */
  _buildDelegate(triggerElement, hide) {
    return {
      onSelect: (item) => {
        hide();
        void this._dispatchPickerItem(item);
      },
      onHide: () => {
        triggerElement.setAttribute("aria-expanded", "false");
        triggerElement.focus();
      }
    };
  }
  _buildListOptions(items, pickerWidth) {
    const showFilter = items.filter((i) => i.kind === ActionListItemKind.Action).length > FILTER_THRESHOLD;
    return showFilter ? { showFilter: true, filterPlaceholder: localize("workspacePicker.filter", "Search Workspaces..."), reserveSubmenuSpace: false, inlineDescription: true, showGroupTitleOnFirstItem: true, minWidth: pickerWidth, maxWidth: pickerWidth, hideDefaultKeybindingTooltip: true } : { reserveSubmenuSpace: false, inlineDescription: true, showGroupTitleOnFirstItem: true, minWidth: pickerWidth, maxWidth: pickerWidth, hideDefaultKeybindingTooltip: true };
  }
  /**
   * Flat (no-tabs) presentation. Delegates rendering to the shared
   * `IActionWidgetService` so we benefit from its keybindings, focus
   * tracking and submenu chrome.
   */
  _showFlatPicker(triggerElement) {
    this._tabbedWidget.hide();
    const items = this._buildItems();
    const delegate = this._buildDelegate(triggerElement, () => this._hidePicker());
    triggerElement.setAttribute("aria-expanded", "true");
    this.actionWidgetService.show(
      "workspacePicker",
      false,
      items,
      delegate,
      triggerElement,
      void 0,
      [],
      {
        getAriaLabel: (item) => item.label ?? "",
        getWidgetAriaLabel: () => localize("workspacePicker.ariaLabel", "Workspace Picker")
      },
      this._buildListOptions(items, void 0)
    );
  }
  /**
   * Tabbed presentation. Delegates rendering and lifecycle to the
   * platform `TabbedActionListWidget`; this picker only owns the data
   * and selection logic.
   */
  _showTabbedPicker(tabs, triggerElement) {
    if (this.actionWidgetService.isVisible) {
      this.actionWidgetService.hide();
    }
    const delegate = this._buildDelegate(triggerElement, () => this._hidePicker());
    const accessibilityProvider = {
      getAriaLabel: (item) => item.label ?? "",
      getWidgetAriaLabel: () => localize("workspacePicker.ariaLabel", "Workspace Picker")
    };
    triggerElement.setAttribute("aria-expanded", "true");
    this._pickerGroupContext.set(this._activeTab ?? tabs[0].id);
    this._tabbedWidget.show({
      user: "workspacePicker",
      anchor: triggerElement,
      tabs,
      initialTab: this._activeTab ?? tabs[0].id,
      createActionList: (tab) => {
        this._activeTab = tab;
        const items = this._buildItems();
        return { items, listOptions: { inlineDescription: true, showGroupTitleOnFirstItem: true, hideDefaultKeybindingTooltip: true } };
      },
      delegate,
      accessibilityProvider,
      width: TABBED_PICKER_WIDTH,
      tabBarClassName: "sessions-workspace-picker-tabbar"
    });
  }
  /**
   * Dispatch logic for a picker item once the user picks it. Shared
   * between the desktop action-widget delegate and any mobile sheet
   * subclass that opts to render a different UI but reuse the
   * selection semantics. Treats unavailable workspaces as a no-op.
   */
  async _dispatchPickerItem(item) {
    const generation = ++this._selectionGeneration;
    this._reportPickerClosed(item);
    if (item.run) {
      item.run();
      return true;
    } else if (item.commandId) {
      void this.commandService.executeCommand(item.commandId);
      return true;
    } else if (item.folderUri && item.providerId && this._isProviderUnavailable(item.providerId)) {
      return false;
    }
    if (item.browseActionIndex !== void 0) {
      const selection = await this._executeBrowseAction(item.browseActionIndex);
      const folderUri = selection?.workspace.folders[0]?.root;
      if (!folderUri || generation !== this._selectionGeneration) {
        return false;
      }
      if (!await this._canSelectWorkspace(folderUri, selection.providerId)) {
        return false;
      }
      if (generation !== this._selectionGeneration) {
        return false;
      }
      this._selectFolder(folderUri);
      return true;
    } else if (item.folderUri) {
      if (item.providerId && !await this._connectProviderOnDemand(item.providerId)) {
        return false;
      }
      if (generation !== this._selectionGeneration) {
        return false;
      }
      if (!await this._canSelectWorkspace(item.folderUri, item.providerId)) {
        return false;
      }
      if (generation !== this._selectionGeneration) {
        return false;
      }
      this._selectFolder(item.folderUri);
      return true;
    }
    return false;
  }
  /**
   * Emits `newChatPickerClosed` telemetry on user selection. The
   * "before" value is read from storage (the currently-checked recent
   * workspace) if available, otherwise from the in-memory selection.
   * The "after" value comes from the item the user picked — undefined
   * when the item is a browse action or command rather than a workspace.
   */
  _reportPickerClosed(item) {
    const beforeFromStorage = this._restoreCheckedWorkspace();
    const before = beforeFromStorage ?? this._selectedResolved;
    const afterUri = item.folderUri;
    const afterResolved = afterUri ? this._resolveFolder(afterUri) : void 0;
    reportNewChatPickerClosed(this.telemetryService, {
      id: "NewChatWorkspacePicker",
      name: "NewChatWorkspacePicker",
      optionIdBefore: before?.workspace?.uri.toString(),
      optionIdAfter: afterResolved?.workspace?.uri.toString(),
      optionLabelBefore: before?.workspace?.label,
      optionLabelAfter: afterResolved?.workspace?.label,
      isPII: true
    });
  }
  /**
   * Programmatically set the selected workspace by folder URI.
   * @param folderUri The folder URI to select.
   * @param options.fireEvent Whether to fire the onDidSelectWorkspace event. Defaults to true.
   * @param options.providerId Optional providerId hint that wins over any historical
   *        recent entry's provider. Use when the caller knows which provider should
   *        own the resulting session (e.g. "New Session" invoked from a workspace
   *        section in the sessions list, where the existing sessions for the
   *        workspace were created by a specific provider).
   * @param options.persist Whether to persist the selection as a recent workspace. Defaults to true.
   */
  setSelectedWorkspace(folderUri, options) {
    this._selectFolder(folderUri, options?.fireEvent ?? true, options?.providerId, options?.persist ?? true);
  }
  /**
   * Hides whichever popup variant is currently visible — the shared
   * action-widget-service flat picker or our own context-view-driven
   * tabbed picker.
   */
  _hidePicker() {
    this._tabbedWidget.hide();
    if (this.actionWidgetService.isVisible) {
      this.actionWidgetService.hide();
    }
  }
  /**
   * Clears the selected project.
   */
  clearSelection() {
    this._selectionGeneration++;
    this._hidePicker();
    this._userHasPicked = true;
    this._connectionStatusWatch.clear();
    this._selectedFolderUri = void 0;
    this._selectedResolved = void 0;
    if (this._shouldPersistSelection()) {
      this.recentWorkspacesService.clearCheckedWorkspace();
    }
    this._updateTriggerLabel();
    this._onDidChangeSelection.fire();
  }
  /**
   * Clears the selection if it matches the given URI.
   */
  removeFromRecents(uri) {
    if (this._selectedFolderUri && this.uriIdentityService.extUri.isEqual(this._selectedFolderUri, uri)) {
      this.clearSelection();
    }
  }
  _selectFolder(folderUri, fireEvent = true, providerIdHint, persist = true) {
    this._selectionGeneration++;
    this._userHasPicked = true;
    this._connectionStatusWatch.clear();
    const storedProviderId = this.recentWorkspacesService.getRecentWorkspaces().find((r) => this.uriIdentityService.extUri.isEqual(r.workspace.folders[0]?.root, folderUri))?.providerId;
    const resolved = this._resolveFolder(folderUri, providerIdHint ?? storedProviderId);
    this._selectedFolderUri = folderUri;
    this._selectedResolved = resolved;
    if (persist && this._shouldPersistSelection()) {
      this.recentWorkspacesService.addRecentWorkspace(folderUri, resolved?.providerId, true);
    }
    this._updateTriggerLabel();
    this._onDidChangeSelection.fire();
    if (fireEvent) {
      this._onDidSelectWorkspace.fire(folderUri);
    }
  }
  _shouldPersistSelection() {
    return true;
  }
  /**
   * Apply a restored selection without firing events or persisting. Used
   * during construction and after provider list changes.
   */
  _applySelection(resolved) {
    this._selectedResolved = resolved;
    this._selectedFolderUri = resolved?.workspace.folders[0]?.root;
  }
  /**
   * Iterate providers and return the first resolution of the folder URI.
   * When `preferredProviderId` is given, that provider is tried first so a
   * user's historical pick survives provider iteration order changes.
   */
  _resolveFolder(folderUri, preferredProviderId) {
    if (preferredProviderId) {
      const preferred = this.sessionsProvidersService.getProvider(preferredProviderId);
      const workspace = preferred?.resolveWorkspace(folderUri);
      if (workspace) {
        return { providerId: preferredProviderId, workspace };
      }
    }
    for (const provider of this.sessionsProvidersService.getProviders()) {
      const workspace = provider.resolveWorkspace(folderUri);
      if (workspace) {
        return { providerId: provider.id, workspace };
      }
    }
    return void 0;
  }
  /**
   * Executes a browse action from a provider, identified by index.
   */
  async _executeBrowseAction(actionIndex) {
    const allActions = this._getAllBrowseActions();
    const action = allActions[actionIndex];
    if (!action) {
      return void 0;
    }
    try {
      if (action === this._localBrowseAction) {
        return await this._browseForLocalFolder();
      }
      const workspace = await action.run();
      return workspace ? { workspace, providerId: action.providerId } : void 0;
    } catch {
    }
    return void 0;
  }
  async _canSelectWorkspace(folderUri, providerId) {
    return !this.options.canSelectWorkspace || await this.options.canSelectWorkspace(folderUri, providerId);
  }
  /**
   * Collects browse actions from all registered providers, scoped to the
   * currently active tab when tabs are shown.
   */
  _getAllBrowseActions() {
    const all = this.sessionsProvidersService.getProviders().flatMap((p) => p.browseActions);
    const hasLocalSupport = this.sessionsProvidersService.getProviders().some((p) => p.supportsLocalWorkspaces);
    if (hasLocalSupport) {
      all.unshift(this._localBrowseAction);
    }
    if (!this._isTabFiltered()) {
      return all;
    }
    return all.filter((a) => a.group === this._activeTab);
  }
  /**
   * Opens a folder picker dialog and returns the chosen URI. The folder's
   * provider is rediscovered later by the management service when the
   * session is created — no provider quick-pick is needed here.
   */
  async _browseForLocalFolder() {
    const localProviders = this.sessionsProvidersService.getProviders().filter((p) => p.supportsLocalWorkspaces);
    if (localProviders.length === 0) {
      return void 0;
    }
    const result = await this.fileDialogService.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false
    });
    if (!result?.length) {
      return void 0;
    }
    for (const provider of localProviders) {
      const workspace = provider.resolveWorkspace(result[0]);
      if (workspace) {
        return { workspace, providerId: provider.id };
      }
    }
    return void 0;
  }
  /** True when the picker is currently scoped to a single tab. */
  _isTabFiltered() {
    return this._showTabs() && !!this._activeTab && this._getAvailableTabs().length > 1;
  }
  /**
   * Builds the picker items list from recent workspaces.
   *
   * Items are shown in a flat recency-sorted list (most recently used first)
   * without source grouping. Own recents come first, followed by VS Code
   * recent folders.
   */
  _buildItems() {
    const items = [];
    const allProviders = this.sessionsProvidersService.getProviders();
    const providerIds = new Set(allProviders.map((p) => p.id));
    const tabFilter = this._isTabFiltered() ? (w) => w.workspace.group === this._activeTab : void 0;
    const recentWorkspaces = this._getRecentWorkspaces().filter((w) => providerIds.has(w.providerId)).filter((w) => !tabFilter || tabFilter(w));
    for (const { workspace, providerId } of recentWorkspaces) {
      const folderUri = workspace.folders[0]?.root;
      if (!folderUri) {
        continue;
      }
      const selected = this._isSelectedFolder(folderUri);
      items.push({
        kind: ActionListItemKind.Action,
        label: workspace.label,
        description: workspace.description,
        group: { title: "", icon: workspace.icon },
        disabled: this._isProviderUnavailable(providerId),
        item: { folderUri, providerId, checked: selected || void 0 },
        onRemove: () => this._removeRecentWorkspace(folderUri)
      });
    }
    const allBrowseActions = this._getAllBrowseActions();
    const remoteProviders = allProviders.filter(isAgentHostProvider).filter((p) => p.connectionStatus !== void 0);
    const includeRemoteProviders = this._activeTab === SESSION_WORKSPACE_GROUP_REMOTE;
    if (items.length > 0 && allBrowseActions.length > 0) {
      items.push({ kind: ActionListItemKind.Separator, label: "" });
    }
    allBrowseActions.forEach((action, index) => {
      const provider = allProviders.find((p) => p.id === action.providerId);
      const agentHostProvider = provider && isAgentHostProvider(provider) ? provider : void 0;
      const connectionStatus = agentHostProvider?.connectionStatus?.get();
      const isIncompatible = RemoteAgentHostConnectionStatus.isIncompatible(connectionStatus);
      const isUnavailable = isIncompatible || !!connectionStatus && !RemoteAgentHostConnectionStatus.isConnected(connectionStatus) && !agentHostProvider?.canConnectOnDemand;
      items.push({
        kind: ActionListItemKind.Action,
        label: localize("workspacePicker.browseSelectAction", "Select..."),
        description: action.description,
        group: { title: "", icon: action.icon },
        disabled: isUnavailable,
        item: { browseActionIndex: index }
      });
    });
    const manageActions = [];
    if (includeRemoteProviders) {
      for (const provider of remoteProviders) {
        const status2 = provider.connectionStatus.get();
        const isTunnel = provider.remoteAddress?.startsWith(TUNNEL_ADDRESS_PREFIX);
        const action = toAction({
          id: `workspacePicker.remote.${provider.id}`,
          label: provider.label,
          tooltip: getStatusLabel(status2),
          enabled: true,
          run: () => {
            this._hidePicker();
            this._showRemoteHostOptionsDelayed(provider);
          }
        });
        const extended = action;
        extended.icon = RemoteAgentHostConnectionStatus.isIncompatible(status2) ? Codicon.warning : isTunnel ? Codicon.cloud : Codicon.remote;
        extended.hoverContent = getStatusHover(status2, provider.remoteAddress);
        if (provider.remoteAddress) {
          extended.onRemove = async () => {
            await removeRemoteHost(provider, this.remoteAgentHostService);
          };
        }
        manageActions.push(action);
      }
    }
    const menuActions = this.menuService.getMenuActions(Menus.SessionWorkspaceManage, this.contextKeyService, { renderShortTitle: true });
    for (const [, actions] of menuActions) {
      for (const menuAction of actions) {
        if (menuAction instanceof MenuItemAction) {
          const icon = ThemeIcon.isThemeIcon(menuAction.item.icon) ? menuAction.item.icon : void 0;
          manageActions.push(Object.assign(menuAction, { icon }));
        }
      }
    }
    if (manageActions.length > 0) {
      if (items.length > 0 && items[items.length - 1].kind !== ActionListItemKind.Separator) {
        items.push({ kind: ActionListItemKind.Separator, label: "" });
      }
      for (const action of manageActions) {
        const extended = action;
        items.push({
          kind: ActionListItemKind.Action,
          label: action.label,
          description: extended.onRemove ? action.tooltip || void 0 : void 0,
          group: { title: "", icon: extended.icon ?? Codicon.settingsGear },
          item: { run: () => action.run(), commandId: action.id },
          onRemove: extended.onRemove
        });
      }
    }
    return items;
  }
  _showRemoteHostOptionsDelayed(provider) {
    const timeout = setTimeout(() => {
      this.instantiationService.invokeFunction((accessor) => showRemoteHostOptions(accessor, provider));
    }, 1);
    this._renderDisposables.add({ dispose: () => clearTimeout(timeout) });
  }
  _updateTriggerLabel() {
    for (const trigger of this._triggerElements) {
      this._renderTriggerLabel(trigger);
    }
  }
  _renderTriggerLabel(trigger) {
    dom.clearNode(trigger);
    const workspace = this._selectedResolved?.workspace;
    const label = workspace ? workspace.label : localize("pickWorkspace", "workspace");
    const icon = workspace ? workspace.icon : Codicon.project;
    trigger.setAttribute("aria-label", workspace ? localize("workspacePicker.selectedAriaLabel", "New session in {0}", label) : localize("workspacePicker.pickAriaLabel", "Start by picking a workspace"));
    dom.append(trigger, renderIcon(icon));
    const labelSpan = dom.append(trigger, dom.$("span.sessions-chat-dropdown-label"));
    labelSpan.textContent = label;
    dom.append(trigger, renderIcon(Codicon.chevronDownCompact)).classList.add("sessions-chat-dropdown-chevron");
  }
  /**
   * Returns whether the given provider is a remote that is currently unavailable
   * (incompatible, or disconnected/still connecting without on-demand connect).
   * Returns false for providers without connection status (e.g. local providers).
   */
  _isProviderUnavailable(providerId) {
    const provider = this.sessionsProvidersService.getProvider(providerId);
    if (!provider || !isAgentHostProvider(provider) || !provider.connectionStatus) {
      return false;
    }
    const connectionStatus = provider.connectionStatus.get();
    return RemoteAgentHostConnectionStatus.isIncompatible(connectionStatus) || !RemoteAgentHostConnectionStatus.isConnected(connectionStatus) && !provider.canConnectOnDemand;
  }
  async _connectProviderOnDemand(providerId) {
    const provider = this.sessionsProvidersService.getProvider(providerId);
    if (!provider || !isAgentHostProvider(provider) || !provider.connectionStatus) {
      return true;
    }
    const connectionStatus = provider.connectionStatus.get();
    if (RemoteAgentHostConnectionStatus.isConnected(connectionStatus)) {
      return true;
    }
    if (RemoteAgentHostConnectionStatus.isIncompatible(connectionStatus) || !provider.canConnectOnDemand || !provider.connect) {
      return false;
    }
    const initialMessage = localize("workspacePicker.connectingRemoteAgentHost", "Connecting to {0}...", provider.label);
    const handle = this.notificationService.notify({
      severity: Severity.Info,
      message: initialMessage,
      progress: { infinite: true }
    });
    status(initialMessage);
    const progressListener = provider.onDidReportConnectProgress?.((progress) => {
      if (!provider.remoteAddress || progress.connectionKey === provider.remoteAddress) {
        handle.updateMessage(progress.message);
        status(progress.message);
      }
    });
    let connected = false;
    try {
      await provider.connect();
      connected = RemoteAgentHostConnectionStatus.isConnected(provider.connectionStatus.get());
    } catch {
    } finally {
      progressListener?.dispose();
      handle.close();
    }
    if (connected) {
      return true;
    }
    const message = localize("workspacePicker.connectRemoteAgentHostFailed", "Failed to connect to {0}.", provider.label);
    this.notificationService.error(message);
    status(message);
    return false;
  }
  _isSelectedFolder(folderUri) {
    if (!this._selectedFolderUri || !folderUri) {
      return false;
    }
    return this.uriIdentityService.extUri.isEqual(this._selectedFolderUri, folderUri);
  }
  _restoreSelectedWorkspace() {
    const checked = this._restoreCheckedWorkspace();
    if (checked) {
      return checked;
    }
    try {
      for (const recent of this.recentWorkspacesService.getRecentWorkspaces()) {
        const folderUri = recent.workspace.folders[0]?.root;
        if (!folderUri || isWorktreeWorkspaceUri(folderUri) || this._isProviderUnavailable(recent.providerId)) {
          continue;
        }
        return recent;
      }
      return void 0;
    } catch {
      return void 0;
    }
  }
  _restoreSelectionFromHistory() {
    if (this._userHasPicked) {
      return;
    }
    const restored = this._restoreSelectedWorkspace();
    if (!restored || this._isSelectedFolder(restored.workspace.folders[0]?.root)) {
      return;
    }
    this._applySelection(restored);
    this._updateTriggerLabel();
    this._onDidChangeSelection.fire();
    this._onDidSelectWorkspace.fire(this._selectedFolderUri);
    this._watchForConnectionFailure(restored);
  }
  /**
   * Restore only the checked (previously selected) workspace if any
   * provider can resolve its URI. The provider's connection status is
   * intentionally NOT checked — we honor the user's explicit pick even
   * if the remote is still connecting or currently disconnected. The
   * trigger label reflects the connection state separately
   * (spinner / grayed).
   */
  _restoreCheckedWorkspace() {
    try {
      return this.recentWorkspacesService.getRecentWorkspaces(false).find((recent) => {
        const folderUri = recent.workspace.folders[0]?.root;
        return recent.checked && !!folderUri && !isWorktreeWorkspaceUri(folderUri);
      });
    } catch {
      return void 0;
    }
  }
  /**
   * When restoring a workspace whose provider isn't currently Connected,
   * watch the connection status. Fires `onDidSelectWorkspace(undefined)`
   * (which the view pane converts to `unsetNewSession()`) if:
   *   - the status transitions to Disconnected after we start watching, or
   *   - the status is still not Connected after a short grace period.
   *
   * The grace period covers a race: provider state can transition synchronously
   * inside provider registration before our autorun's first read, so we may
   * never observe an explicit Disconnected transition. The timer ensures we
   * eventually fall back instead of leaving the picker showing an unreachable
   * remote with no session.
   *
   * Has no effect once the user makes an explicit pick (`_userHasPicked`).
   */
  _watchForConnectionFailure(resolved) {
    const provider = this.sessionsProvidersService.getProvider(resolved.providerId);
    if (!provider || !isAgentHostProvider(provider) || !provider.connectionStatus) {
      return;
    }
    const connStatus = provider.connectionStatus;
    if (RemoteAgentHostConnectionStatus.isConnected(connStatus.get())) {
      return;
    }
    const folderUri = resolved.workspace.folders[0]?.root;
    if (!folderUri) {
      return;
    }
    const store = new DisposableStore();
    this._connectionStatusWatch.value = store;
    const fallback = () => {
      this._connectionStatusWatch.clear();
      if (!this._userHasPicked && this._isSelectedFolder(folderUri)) {
        this._selectedFolderUri = void 0;
        this._selectedResolved = void 0;
        this._updateTriggerLabel();
        this._onDidChangeSelection.fire();
        this._onDidSelectWorkspace.fire(void 0);
      }
    };
    let isFirstRun = true;
    store.add(autorun((reader) => {
      const status2 = connStatus.read(reader);
      if (RemoteAgentHostConnectionStatus.isConnected(status2)) {
        this._connectionStatusWatch.clear();
      } else if ((RemoteAgentHostConnectionStatus.isDisconnected(status2) || RemoteAgentHostConnectionStatus.isIncompatible(status2)) && !isFirstRun) {
        fallback();
      }
      isFirstRun = false;
    }));
    disposableTimeout(() => {
      if (!RemoteAgentHostConnectionStatus.isConnected(connStatus.get())) {
        fallback();
      }
    }, RESTORE_CONNECT_GRACE_MS, store);
  }
  // -- Recent workspaces (sessions' own history) --
  _getRecentWorkspaces() {
    return this.recentWorkspacesService.getRecentWorkspaces();
  }
  _removeRecentWorkspace(folderUri) {
    this.recentWorkspacesService.removeRecentWorkspace(folderUri);
    if (this._isSelectedFolder(folderUri)) {
      this._hidePicker();
      this._selectedFolderUri = void 0;
      this._selectedResolved = void 0;
      this._updateTriggerLabel();
      this._onDidSelectWorkspace.fire(void 0);
    }
  }
};
WorkspacePicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, ISessionsProvidersService),
  __decorateParam(4, ISessionsRecentWorkspacesService),
  __decorateParam(5, IRemoteAgentHostService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IFileDialogService),
  __decorateParam(12, ITelemetryService),
  __decorateParam(13, INotificationService)
], WorkspacePicker);
export {
  WorkspacePicker
};
