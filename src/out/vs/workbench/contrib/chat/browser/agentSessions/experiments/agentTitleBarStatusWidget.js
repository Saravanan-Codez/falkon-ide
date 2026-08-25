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
import "./media/agenttitlebarstatuswidget.css";
import { $, addDisposableListener, EventType, getWindow, isHTMLElement, reset } from "../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Event as EventUtils } from "../../../../../../base/common/event.js";
import { localize } from "../../../../../../nls.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { AgentStatusMode, IAgentTitleBarStatusService } from "./agentTitleBarStatusService.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { EnterAgentSessionProjectionAction, ExitAgentSessionProjectionAction } from "./agentSessionProjectionActions.js";
import { UNIFIED_QUICK_ACCESS_ACTION_ID } from "./unifiedQuickAccessActions.js";
import { IAgentSessionsService } from "../agentSessionsService.js";
import { AgentSessionStatus, isSessionInProgressStatus } from "../agentSessionsModel.js";
import { BaseActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Separator, SubmenuAction, toAction } from "../../../../../../base/common/actions.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../../../platform/workspace/common/workspace.js";
import { IEditorGroupsService } from "../../../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { renderAsPlaintext } from "../../../../../../base/browser/markdownRenderer.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IMenuService, MenuId, MenuItemAction, SubmenuItemAction } from "../../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { InEditorZenModeContext } from "../../../../../common/contextkeys.js";
import { HiddenItemStrategy, WorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { createActionViewItem } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { FocusAgentSessionsAction } from "../agentSessionsActions.js";
import { WORKBENCH_MENU_MOTION_CLASS, workbenchMenuCloseAnimation } from "../../../../../browser/actions/menuMotion.js";
import { IActionViewItemService } from "../../../../../../platform/actions/browser/actionViewItemService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { mainWindow } from "../../../../../../base/browser/window.js";
import { LayoutSettings } from "../../../../../services/layout/browser/layoutService.js";
import { ChatAIDisabledSettingId, ChatConfiguration } from "../../../common/constants.js";
import { IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
import { IChatWidgetService } from "../../chat.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { ITitleService } from "../../../../../services/title/browser/titleService.js";
const TOGGLE_CHAT_ACTION_ID = "workbench.action.chat.toggle";
const QUICK_OPEN_ACTION_ID = "workbench.action.quickOpenWithModes";
const FILTER_STORAGE_KEY = "agentSessions.filterExcludes.agentsessionsviewerfiltersubmenu";
const PREVIOUS_FILTER_STORAGE_KEY = "agentSessions.filterExcludes.previousUserFilter";
function shouldForceHiddenAgentStatus(configurationService, contextKeyService) {
  if (contextKeyService.getContextKeyValue(InEditorZenModeContext.key) === true) {
    return true;
  }
  const aiFeaturesDisabled = configurationService.getValue(ChatAIDisabledSettingId) === true;
  const aiCustomizationsDisabled = configurationService.getValue("disableAICustomizations") === true || configurationService.getValue("workbench.disableAICustomizations") === true;
  return aiFeaturesDisabled && aiCustomizationsDisabled;
}
function getAgentStatusSettingMode(configurationService, contextKeyService) {
  if (shouldForceHiddenAgentStatus(configurationService, contextKeyService)) {
    return "hidden";
  }
  const value = configurationService.getValue(ChatConfiguration.AgentStatusEnabled);
  if (value === false || value === "hidden") {
    return "hidden";
  }
  if (value === "badge") {
    return "badge";
  }
  if (value === true || value === void 0 || value === "compact") {
    return "compact";
  }
  return "compact";
}
let AgentTitleBarStatusWidget = class extends BaseActionViewItem {
  constructor(action, _windowTitle, options, instantiationService, agentTitleBarStatusService, hoverService, commandService, keybindingService, agentSessionsService, workspaceContextService, editorGroupsService, editorService, menuService, contextKeyService, storageService, configurationService, chatEntitlementService, chatWidgetService, telemetryService) {
    super(void 0, action, options);
    this._windowTitle = _windowTitle;
    this.instantiationService = instantiationService;
    this.agentTitleBarStatusService = agentTitleBarStatusService;
    this.hoverService = hoverService;
    this.commandService = commandService;
    this.keybindingService = keybindingService;
    this.agentSessionsService = agentSessionsService;
    this.workspaceContextService = workspaceContextService;
    this.editorGroupsService = editorGroupsService;
    this.editorService = editorService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.chatEntitlementService = chatEntitlementService;
    this.chatWidgetService = chatWidgetService;
    this.telemetryService = telemetryService;
    this._dynamicDisposables = this._register(new DisposableStore());
    /** Guard to prevent re-entrant rendering */
    this._isRendering = false;
    /** Roving tabindex elements for keyboard navigation */
    this._rovingElements = [];
    this._rovingIndex = 0;
    /** Tracks if this window applied a badge filter (unread/inProgress), so we only auto-clear our own filters */
    // TODO: This is imperfect. Targetted fix for vscode#290863. We should revisit storing filter state per-window to avoid this
    this._badgeFilterAppliedByThisWindow = null;
    this._commandCenterMenu = this._register(this.menuService.createMenu(MenuId.CommandCenterCenter, this.contextKeyService));
    this._chatTitleBarMenu = this._register(this.menuService.createMenu(MenuId.ChatTitleBarMenu, this.contextKeyService));
    this._register(this.agentTitleBarStatusService.onDidChangeMode(() => {
      this._render();
    }));
    this._register(this.agentTitleBarStatusService.onDidChangeSessionInfo(() => {
      this._render();
    }));
    this._register(this.agentSessionsService.model.onDidChangeSessions(() => {
      this._render();
    }));
    this._register(this._windowTitle.onDidChange(() => {
      this._render();
    }));
    this._register(this.editorService.onDidActiveEditorChange(() => {
      this._render();
    }));
    this._register(this.editorGroupsService.onDidChangeEditorPartOptions(({ newPartOptions, oldPartOptions }) => {
      if (newPartOptions.showTabs !== oldPartOptions.showTabs) {
        this._render();
      }
    }));
    this._register(this._commandCenterMenu.onDidChange(() => {
      this._lastRenderState = void 0;
      this._render();
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, "agentSessions.filterExcludes.agentsessionsviewerfiltersubmenu", this._store)(() => {
      this._render();
    }));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(/* @__PURE__ */ new Set([InEditorZenModeContext.key]))) {
        this._lastRenderState = void 0;
        this._render();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.AgentStatusEnabled) || e.affectsConfiguration(ChatConfiguration.UnifiedAgentsBar) || e.affectsConfiguration(ChatConfiguration.ChatViewSessionsEnabled) || e.affectsConfiguration(ChatAIDisabledSettingId) || e.affectsConfiguration("disableAICustomizations") || e.affectsConfiguration("workbench.disableAICustomizations")) {
        this._lastRenderState = void 0;
        this._render();
      }
    }));
    this._register(EventUtils.any(
      this.chatEntitlementService.onDidChangeSentiment,
      this.chatEntitlementService.onDidChangeQuotaExceeded,
      this.chatEntitlementService.onDidChangeEntitlement,
      this.chatEntitlementService.onDidChangeAnonymous
    )(() => {
      this._lastRenderState = void 0;
      this._render();
    }));
    this._register(this.chatWidgetService.onDidAddWidget(() => {
      this._render();
    }));
    this._register(this.chatWidgetService.onDidBackgroundSession(() => {
      this._render();
    }));
  }
  render(container) {
    super.render(container);
    this._container = container;
    container.classList.add("agent-status-container");
    container.setAttribute("role", "toolbar");
    container.setAttribute("aria-label", localize("agentStatusToolbarLabel", "Agent Status"));
    container.tabIndex = -1;
    this._render();
  }
  // Override focus methods - the container itself shouldn't be focusable,
  // focus is handled by the inner interactive elements (badge sections)
  setFocusable(_focusable) {
  }
  focus() {
    this._rovingElements[this._rovingIndex]?.focus();
  }
  blur() {
    if (!this._container) {
      return;
    }
    const activeElement = getWindow(this._container).document.activeElement;
    if (isHTMLElement(activeElement) && this._container.contains(activeElement)) {
      activeElement.blur();
    }
  }
  _render() {
    if (!this._container) {
      return;
    }
    if (this._isRendering) {
      return;
    }
    this._isRendering = true;
    try {
      const mode = this.agentTitleBarStatusService.mode;
      const sessionInfo = this.agentTitleBarStatusService.sessionInfo;
      const { activeSessions, unreadSessions, attentionNeededSessions } = this._getSessionStats();
      const attentionSession = attentionNeededSessions.length > 0 ? [...attentionNeededSessions].sort((a, b) => {
        const timeA = a.timing.lastRequestStarted ?? a.timing.created;
        const timeB = b.timing.lastRequestStarted ?? b.timing.created;
        return timeB - timeA;
      })[0] : void 0;
      const attentionText = attentionSession?.description ? typeof attentionSession.description === "string" ? attentionSession.description : renderAsPlaintext(attentionSession.description) : attentionSession?.label;
      const label = this._getLabel();
      const { isFilteredToUnread, isFilteredToInProgress, isFilteredToNeedsInput } = this._getCurrentFilterState();
      const statusMode = getAgentStatusSettingMode(this.configurationService, this.contextKeyService);
      const unifiedAgentsBarEnabled = this.configurationService.getValue(ChatConfiguration.UnifiedAgentsBar) === true;
      const viewSessionsEnabled = this.configurationService.getValue(ChatConfiguration.ChatViewSessionsEnabled) !== false;
      const stateKey = JSON.stringify({
        mode,
        sessionTitle: sessionInfo?.title,
        activeCount: activeSessions.length,
        unreadCount: unreadSessions.length,
        attentionCount: attentionNeededSessions.length,
        attentionText,
        label,
        isFilteredToUnread,
        isFilteredToInProgress,
        isFilteredToNeedsInput,
        statusMode,
        unifiedAgentsBarEnabled,
        viewSessionsEnabled
      });
      if (this._lastRenderState === stateKey) {
        return;
      }
      this._lastRenderState = stateKey;
      reset(this._container);
      this._dynamicDisposables.clear();
      this._rovingElements = [];
      if (this.agentTitleBarStatusService.mode === AgentStatusMode.Session) {
        this._renderSessionMode(this._dynamicDisposables);
      } else if (this.agentTitleBarStatusService.mode === AgentStatusMode.SessionReady) {
        this._renderSessionReadyMode(this._dynamicDisposables);
      } else if (statusMode === "compact") {
        this._renderChatInputMode(this._dynamicDisposables);
      } else if (statusMode === "badge") {
        this._renderStatusBadge(this._dynamicDisposables, activeSessions, unreadSessions, attentionNeededSessions);
      }
      this._setupRovingTabIndex(this._dynamicDisposables);
    } finally {
      this._isRendering = false;
    }
  }
  /**
   * Setup roving tabindex for arrow key navigation between interactive elements.
   * Uses the elements registered in `this._rovingElements` in their existing order.
   */
  _setupRovingTabIndex(disposables) {
    if (!this._container || this._rovingElements.length === 0) {
      return;
    }
    if (this._rovingIndex >= this._rovingElements.length) {
      this._rovingIndex = 0;
    }
    for (let i = 0; i < this._rovingElements.length; i++) {
      this._rovingElements[i].tabIndex = i === this._rovingIndex ? 0 : -1;
    }
    disposables.add(addDisposableListener(this._container, EventType.KEY_DOWN, (e) => {
      const index = this._rovingElements.findIndex((el) => el === e.target || el.contains(e.target));
      if (index === -1) {
        return;
      }
      const nextIndex = this._getNextRovingIndex(index, e.key);
      if (nextIndex !== void 0 && nextIndex !== index) {
        e.preventDefault();
        e.stopPropagation();
        this._moveRovingFocus(index, nextIndex);
      }
    }));
  }
  /**
   * Moves roving focus from `currentIndex` to `nextIndex`, updating tabIndex and focusing the element.
   */
  _moveRovingFocus(currentIndex, nextIndex) {
    this._rovingElements[currentIndex].tabIndex = -1;
    this._rovingElements[nextIndex].tabIndex = 0;
    this._rovingElements[nextIndex].focus();
    this._rovingIndex = nextIndex;
  }
  /**
   * Returns the next roving index for the given key, or `undefined` if no navigation should occur.
   */
  _getNextRovingIndex(currentIndex, key) {
    const len = this._rovingElements.length;
    switch (key) {
      case "ArrowRight":
        return (currentIndex + 1) % len;
      case "ArrowLeft":
        return (currentIndex - 1 + len) % len;
      case "Home":
        return 0;
      case "End":
        return len - 1;
      default:
        return void 0;
    }
  }
  // #region Session Statistics
  /**
   * Get computed session statistics for rendering.
   * Respects the current provider (session type) filter when calculating counts.
   */
  _getSessionStats() {
    const sessions = this.agentSessionsService.model.sessions;
    const currentFilter = this._getStoredFilter();
    const excludedProviders = currentFilter?.providers ?? [];
    const filteredSessions = excludedProviders.length > 0 ? sessions.filter((s) => !excludedProviders.includes(s.providerType)) : sessions;
    const activeSessions = filteredSessions.filter((s) => isSessionInProgressStatus(s.status) && !s.isArchived());
    const unreadSessions = filteredSessions.filter((s) => !s.isRead());
    const attentionNeededSessions = filteredSessions.filter((s) => s.status === AgentSessionStatus.NeedsInput && !this.chatWidgetService.getWidgetBySessionResource(s.resource));
    return {
      activeSessions,
      unreadSessions,
      attentionNeededSessions,
      hasActiveSessions: activeSessions.length > 0,
      hasUnreadSessions: unreadSessions.length > 0,
      hasAttentionNeeded: attentionNeededSessions.length > 0
    };
  }
  // #endregion
  // #region Mode Renderers
  _renderChatInputMode(disposables) {
    if (!this._container) {
      return;
    }
    const { activeSessions, unreadSessions, attentionNeededSessions, hasAttentionNeeded } = this._getSessionStats();
    const pill = $("div.agent-status-pill.chat-input-mode");
    if (hasAttentionNeeded) {
      pill.classList.add("needs-attention");
    }
    this._container.appendChild(pill);
    this._renderCommandCenterToolbar(disposables, pill);
    const isCompactMode = true;
    pill.classList.toggle("compact-mode", isCompactMode);
    const leftIcon = $("span.agent-status-left-icon");
    if (hasAttentionNeeded) {
      const reportIcon = renderIcon(Codicon.report);
      const countSpan = $("span.agent-status-attention-count");
      countSpan.textContent = String(attentionNeededSessions.length);
      reset(leftIcon, reportIcon, countSpan);
      leftIcon.classList.add("has-attention");
    } else {
      reset(leftIcon, renderIcon(Codicon.searchSparkle));
    }
    if (!isCompactMode) {
      pill.appendChild(leftIcon);
    }
    const inputArea = $("div.agent-status-input-area");
    inputArea.setAttribute("role", "button");
    inputArea.setAttribute("aria-label", localize("openQuickAccess", "Open Quick Access"));
    inputArea.tabIndex = 0;
    this._rovingElements.push(inputArea);
    pill.appendChild(inputArea);
    const label = $("span.agent-status-label");
    const { progress: progressText } = this._getSessionNeedingAttention(attentionNeededSessions);
    const defaultLabel = isCompactMode ? this._getLabel() : progressText ?? this._getLabel();
    if (!isCompactMode && progressText) {
      label.classList.add("has-progress");
    }
    const hoverLabel = localize("askAnythingPlaceholder", "Ask anything or describe what to build");
    label.textContent = defaultLabel;
    inputArea.appendChild(label);
    if (isCompactMode) {
      disposables.add(addDisposableListener(inputArea, EventType.MOUSE_ENTER, () => {
        reset(leftIcon, renderIcon(Codicon.searchSparkle));
        leftIcon.classList.remove("has-attention");
        label.classList.remove("has-progress");
      }));
      disposables.add(addDisposableListener(inputArea, EventType.MOUSE_LEAVE, () => {
        reset(leftIcon, renderIcon(Codicon.searchSparkle));
      }));
    } else {
      const sendIcon = $("span.agent-status-send");
      reset(sendIcon, renderIcon(Codicon.send));
      sendIcon.classList.add("hidden");
      inputArea.appendChild(sendIcon);
      if (!progressText) {
        disposables.add(addDisposableListener(inputArea, EventType.MOUSE_ENTER, () => {
          reset(leftIcon, renderIcon(Codicon.searchSparkle));
          leftIcon.classList.remove("has-attention");
          label.textContent = hoverLabel;
          label.classList.remove("has-progress");
          sendIcon.classList.remove("hidden");
        }));
        disposables.add(addDisposableListener(inputArea, EventType.MOUSE_LEAVE, () => {
          reset(leftIcon, renderIcon(Codicon.searchSparkle));
          label.textContent = defaultLabel;
          sendIcon.classList.add("hidden");
        }));
      }
    }
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    disposables.add(this.hoverService.setupManagedHover(hoverDelegate, inputArea, () => {
      const kbForTooltip = this.keybindingService.lookupKeybinding(UNIFIED_QUICK_ACCESS_ACTION_ID)?.getLabel();
      return kbForTooltip ? localize("askTooltip", "Open Quick Access ({0})", kbForTooltip) : localize("askTooltip2", "Open Quick Access");
    }));
    disposables.add(addDisposableListener(inputArea, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.telemetryService.publicLog2("agentStatusWidget.click", {
        source: "pill",
        action: "quickAccess"
      });
      const useUnifiedQuickAccess = this.configurationService.getValue(ChatConfiguration.UnifiedAgentsBar) === true;
      this.commandService.executeCommand(useUnifiedQuickAccess ? UNIFIED_QUICK_ACCESS_ACTION_ID : QUICK_OPEN_ACTION_ID);
    }));
    disposables.add(addDisposableListener(inputArea, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.telemetryService.publicLog2("agentStatusWidget.click", {
          source: "pill",
          action: "quickAccess"
        });
        const useUnifiedQuickAccess = this.configurationService.getValue(ChatConfiguration.UnifiedAgentsBar) === true;
        this.commandService.executeCommand(useUnifiedQuickAccess ? UNIFIED_QUICK_ACCESS_ACTION_ID : QUICK_OPEN_ACTION_ID);
      }
    }));
    this._renderStatusBadge(disposables, activeSessions, unreadSessions, attentionNeededSessions, pill);
  }
  _renderSessionMode(disposables) {
    if (!this._container) {
      return;
    }
    const { activeSessions, unreadSessions, attentionNeededSessions } = this._getSessionStats();
    this._renderCommandCenterToolbar(disposables);
    const pill = $("div.agent-status-pill.session-mode");
    this._container.appendChild(pill);
    this._renderSearchButton(disposables, pill);
    const titleLabel = $("span.agent-status-title");
    const sessionInfo = this.agentTitleBarStatusService.sessionInfo;
    titleLabel.textContent = sessionInfo?.title ?? localize("agentSessionProjection", "Agent Session Projection");
    pill.appendChild(titleLabel);
    this._renderEscapeButton(disposables, pill);
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    disposables.add(this.hoverService.setupManagedHover(hoverDelegate, pill, () => {
      const sessionInfo2 = this.agentTitleBarStatusService.sessionInfo;
      return sessionInfo2 ? localize("agentSessionProjectionTooltip", "Agent Session Projection: {0}", sessionInfo2.title) : localize("agentSessionProjection", "Agent Session Projection");
    }));
    const exitHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.commandService.executeCommand(ExitAgentSessionProjectionAction.ID);
    };
    disposables.add(addDisposableListener(pill, EventType.CLICK, exitHandler));
    disposables.add(addDisposableListener(pill, EventType.MOUSE_DOWN, exitHandler));
    this._renderStatusBadge(disposables, activeSessions, unreadSessions, attentionNeededSessions);
  }
  /**
   * Render session ready mode - shows session title + enter projection button.
   * Used when a projection-capable session is available but not yet entered.
   */
  _renderSessionReadyMode(disposables) {
    if (!this._container) {
      return;
    }
    const { activeSessions, unreadSessions, attentionNeededSessions } = this._getSessionStats();
    const pill = $("div.agent-status-pill.session-ready-mode");
    this._container.appendChild(pill);
    const titleLabel = $("span.agent-status-title");
    const sessionInfo = this.agentTitleBarStatusService.sessionInfo;
    titleLabel.textContent = sessionInfo?.title ?? localize("agentSessionReady", "Review Changes");
    pill.appendChild(titleLabel);
    this._renderEnterButton(disposables, pill);
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    disposables.add(this.hoverService.setupManagedHover(hoverDelegate, pill, () => {
      const sessionInfo2 = this.agentTitleBarStatusService.sessionInfo;
      return sessionInfo2 ? localize("agentSessionReadyTooltip", "Review changes from: {0}", sessionInfo2.title) : localize("agentSessionReadyGeneric", "Review agent session changes");
    }));
    const enterHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sessionInfo2 = this.agentTitleBarStatusService.sessionInfo;
      if (sessionInfo2) {
        const session = this.agentSessionsService.getSession(sessionInfo2.sessionResource);
        if (session) {
          this.commandService.executeCommand(EnterAgentSessionProjectionAction.ID, session);
        }
      }
    };
    disposables.add(addDisposableListener(pill, EventType.CLICK, enterHandler));
    disposables.add(addDisposableListener(pill, EventType.MOUSE_DOWN, enterHandler));
    this._renderStatusBadge(disposables, activeSessions, unreadSessions, attentionNeededSessions);
  }
  // #endregion
  // #region Reusable Components
  /**
   * Render command center toolbar items (like debug toolbar) that are registered to CommandCenter
   * Filters out the quick open action since we provide our own search UI.
   * Adds a dot separator after the toolbar if content was rendered.
   */
  _renderCommandCenterToolbar(disposables, parent) {
    const container = parent ?? this._container;
    if (!container) {
      return;
    }
    const allActions = [];
    for (const [, actions] of this._commandCenterMenu.getActions({ shouldForwardArgs: true })) {
      for (const action of actions) {
        if (action.id === QUICK_OPEN_ACTION_ID) {
          continue;
        }
        if (action instanceof SubmenuAction) {
          allActions.push(...action.actions);
        } else {
          allActions.push(action);
        }
      }
    }
    if (allActions.length === 0) {
      return;
    }
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    const toolbarContainer = $("div.agent-status-command-center-toolbar");
    container.appendChild(toolbarContainer);
    const toolbar = this.instantiationService.createInstance(WorkbenchToolBar, toolbarContainer, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "agentStatusCommandCenter",
      actionViewItemProvider: (action, options) => {
        return createActionViewItem(this.instantiationService, action, { ...options, hoverDelegate });
      }
    });
    disposables.add(toolbar);
    toolbar.setActions(allActions);
    if (parent) {
      const separator = $("span.agent-status-line-separator");
      container.appendChild(separator);
    } else {
      const separator = renderIcon(Codicon.circleSmallFilled);
      separator.classList.add("agent-status-separator");
      container.appendChild(separator);
    }
  }
  /**
   * Render the search button. If parent is provided, appends to parent; otherwise appends to container.
   */
  _renderSearchButton(disposables, parent) {
    const container = parent ?? this._container;
    if (!container) {
      return;
    }
    const searchButton = $("span.agent-status-search");
    reset(searchButton, renderIcon(Codicon.searchSparkle));
    searchButton.setAttribute("role", "button");
    searchButton.setAttribute("aria-label", localize("openQuickOpen", "Open Quick Open"));
    searchButton.tabIndex = 0;
    this._rovingElements.push(searchButton);
    container.appendChild(searchButton);
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    const searchKb = this.keybindingService.lookupKeybinding(QUICK_OPEN_ACTION_ID)?.getLabel();
    const searchTooltip = searchKb ? localize("openQuickOpenTooltip", "Go to File ({0})", searchKb) : localize("openQuickOpenTooltip2", "Go to File");
    disposables.add(this.hoverService.setupManagedHover(hoverDelegate, searchButton, searchTooltip));
    disposables.add(addDisposableListener(searchButton, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.commandService.executeCommand(QUICK_OPEN_ACTION_ID);
    }));
    disposables.add(addDisposableListener(searchButton, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.commandService.executeCommand(QUICK_OPEN_ACTION_ID);
      }
    }));
  }
  /**
   * Render the status badge showing in-progress, needs-input, and/or unread session counts.
   * Shows split UI with sparkle icon on left, then unread, needs-input, and active indicators.
   * Always renders the sparkle icon section.
   */
  _renderStatusBadge(disposables, activeSessions, unreadSessions, attentionNeededSessions, inlineContainer) {
    if (!this._container) {
      return;
    }
    const hasActiveSessions = activeSessions.length > 0;
    const hasUnreadSessions = unreadSessions.length > 0;
    const hasAttentionNeeded = attentionNeededSessions.length > 0;
    this._clearFilterIfCategoryEmpty(hasUnreadSessions, hasActiveSessions, hasAttentionNeeded);
    let badge;
    if (inlineContainer) {
      badge = inlineContainer;
    } else {
      badge = $("div.agent-status-badge");
      this._container.appendChild(badge);
    }
    const sparkleContainer = $("span.agent-status-badge-section.sparkle");
    sparkleContainer.tabIndex = 0;
    const menuActions = Separator.join(...this._chatTitleBarMenu.getActions({ shouldForwardArgs: true }).map(([, actions]) => actions));
    const primaryActionId = TOGGLE_CHAT_ACTION_ID;
    const primaryActionTitle = localize("toggleChat", "Toggle Chat");
    const primaryActionIcon = Codicon.chatSparkle;
    const primaryAction = this.instantiationService.createInstance(MenuItemAction, {
      id: primaryActionId,
      title: primaryActionTitle,
      icon: primaryActionIcon
    }, void 0, void 0, void 0, void 0);
    const dropdownAction = toAction({
      id: "agentStatus.sparkle.dropdown",
      label: localize("agentStatus.sparkle.dropdown", "More Actions"),
      run() {
      }
    });
    const sparkleDropdown = this.instantiationService.createInstance(
      DropdownWithPrimaryActionViewItem,
      primaryAction,
      dropdownAction,
      menuActions,
      "agent-status-sparkle-dropdown",
      { skipTelemetry: true, menuClassName: WORKBENCH_MENU_MOTION_CLASS, closeAnimation: workbenchMenuCloseAnimation }
    );
    sparkleDropdown.render(sparkleContainer);
    disposables.add(sparkleDropdown);
    disposables.add(addDisposableListener(
      sparkleContainer,
      EventType.KEY_DOWN,
      (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
          const idx = this._rovingElements.indexOf(sparkleContainer);
          if (idx === -1) {
            return;
          }
          const nextIndex = this._getNextRovingIndex(idx, e.key);
          if (nextIndex !== void 0 && nextIndex !== idx) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._moveRovingFocus(idx, nextIndex);
          }
        }
      },
      true
      /* useCapture */
    ));
    disposables.add(addDisposableListener(sparkleContainer, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.commandService.executeCommand(primaryActionId);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        sparkleDropdown.showDropdown();
      }
    }));
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    const viewSessionsEnabled = this.configurationService.getValue(ChatConfiguration.ChatViewSessionsEnabled) !== false;
    const reverseOrder = !!inlineContainer;
    if (!reverseOrder) {
      badge.appendChild(sparkleContainer);
    }
    let unreadSection;
    let activeSection;
    let needsInputSection;
    if (viewSessionsEnabled && hasUnreadSessions && this.workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY) {
      const { isFilteredToUnread } = this._getCurrentFilterState();
      unreadSection = $("span.agent-status-badge-section.unread");
      if (isFilteredToUnread) {
        unreadSection.classList.add("filtered");
      }
      unreadSection.setAttribute("role", "button");
      unreadSection.tabIndex = 0;
      const unreadIcon = $("span.agent-status-icon");
      reset(unreadIcon, renderIcon(Codicon.circleFilled));
      unreadSection.appendChild(unreadIcon);
      const unreadCount = $("span.agent-status-text");
      unreadCount.textContent = String(unreadSessions.length);
      unreadSection.appendChild(unreadCount);
      disposables.add(addDisposableListener(unreadSection, EventType.CLICK, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openSessionsWithFilter("unread");
      }));
      disposables.add(addDisposableListener(unreadSection, EventType.KEY_DOWN, (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          this._openSessionsWithFilter("unread");
        }
      }));
      const unreadTooltip = unreadSessions.length === 1 ? localize("unreadSessionsTooltip1", "{0} unread session", unreadSessions.length) : localize("unreadSessionsTooltip", "{0} unread sessions", unreadSessions.length);
      disposables.add(this.hoverService.setupManagedHover(hoverDelegate, unreadSection, unreadTooltip));
    }
    if (viewSessionsEnabled && hasAttentionNeeded) {
      const { isFilteredToNeedsInput } = this._getCurrentFilterState();
      needsInputSection = $("span.agent-status-badge-section.active.needs-input");
      if (isFilteredToNeedsInput) {
        needsInputSection.classList.add("filtered");
      }
      needsInputSection.setAttribute("role", "button");
      needsInputSection.tabIndex = 0;
      const needsInputIcon = $("span.agent-status-icon");
      reset(needsInputIcon, renderIcon(Codicon.report));
      needsInputSection.appendChild(needsInputIcon);
      const needsInputCount = $("span.agent-status-text");
      needsInputCount.textContent = String(attentionNeededSessions.length);
      needsInputSection.appendChild(needsInputCount);
      disposables.add(addDisposableListener(needsInputSection, EventType.CLICK, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openSessionsWithFilter("needsInput");
      }));
      disposables.add(addDisposableListener(needsInputSection, EventType.KEY_DOWN, (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          this._openSessionsWithFilter("needsInput");
        }
      }));
      const needsInputTooltip = attentionNeededSessions.length === 1 ? localize("needsInputSessionsTooltip1", "{0} session needs input", attentionNeededSessions.length) : localize("needsInputSessionsTooltip", "{0} sessions need input", attentionNeededSessions.length);
      disposables.add(this.hoverService.setupManagedHover(hoverDelegate, needsInputSection, needsInputTooltip));
    }
    const inProgressOnly = activeSessions.filter((s) => s.status !== AgentSessionStatus.NeedsInput);
    if (viewSessionsEnabled && inProgressOnly.length > 0) {
      const { isFilteredToInProgress } = this._getCurrentFilterState();
      activeSection = $("span.agent-status-badge-section.active");
      if (isFilteredToInProgress) {
        activeSection.classList.add("filtered");
      }
      activeSection.setAttribute("role", "button");
      activeSection.tabIndex = 0;
      const statusIcon = $("span.agent-status-icon");
      reset(statusIcon, renderIcon(Codicon.sessionInProgress));
      activeSection.appendChild(statusIcon);
      const statusCount = $("span.agent-status-text");
      statusCount.textContent = String(inProgressOnly.length);
      activeSection.appendChild(statusCount);
      disposables.add(addDisposableListener(activeSection, EventType.CLICK, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openSessionsWithFilter("inProgress");
      }));
      disposables.add(addDisposableListener(activeSection, EventType.KEY_DOWN, (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          this._openSessionsWithFilter("inProgress");
        }
      }));
      const activeTooltip = inProgressOnly.length === 1 ? localize("activeSessionsTooltip1", "{0} session in progress", inProgressOnly.length) : localize("activeSessionsTooltip", "{0} sessions in progress", inProgressOnly.length);
      disposables.add(this.hoverService.setupManagedHover(hoverDelegate, activeSection, activeTooltip));
    }
    if (reverseOrder) {
      if (needsInputSection) {
        badge.appendChild(needsInputSection);
        this._rovingElements.push(needsInputSection);
      }
      if (activeSection) {
        badge.appendChild(activeSection);
        this._rovingElements.push(activeSection);
      }
      if (unreadSection) {
        badge.appendChild(unreadSection);
        this._rovingElements.push(unreadSection);
      }
      badge.appendChild(sparkleContainer);
      this._rovingElements.push(sparkleContainer);
    } else {
      this._rovingElements.push(sparkleContainer);
      if (unreadSection) {
        badge.appendChild(unreadSection);
        this._rovingElements.push(unreadSection);
      }
      if (activeSection) {
        badge.appendChild(activeSection);
        this._rovingElements.push(activeSection);
      }
      if (needsInputSection) {
        badge.appendChild(needsInputSection);
        this._rovingElements.push(needsInputSection);
      }
    }
  }
  /**
   * Clear the filter if the currently filtered category becomes empty.
   * For example, if filtered to "unread" but no unread sessions exist, restore user's previous filter.
   * Only auto-clears if THIS window applied the badge filter to avoid cross-window interference.
   */
  _clearFilterIfCategoryEmpty(hasUnreadSessions, hasActiveSessions, hasAttentionNeeded) {
    if (this._badgeFilterAppliedByThisWindow === "unread" && !hasUnreadSessions) {
      this._restoreUserFilter();
    } else if (this._badgeFilterAppliedByThisWindow === "inProgress" && !hasActiveSessions) {
      this._restoreUserFilter();
    } else if (this._badgeFilterAppliedByThisWindow === "needsInput" && !hasAttentionNeeded) {
      this._restoreUserFilter();
    }
  }
  /**
   * Get the current filter state from storage.
   */
  _getCurrentFilterState() {
    const filter = this._getStoredFilter();
    if (!filter) {
      return { isFilteredToUnread: false, isFilteredToInProgress: false, isFilteredToNeedsInput: false };
    }
    const isFilteredToUnread = filter.read === true && filter.states.length === 0;
    const isFilteredToInProgress = filter.states?.length === 3 && filter.states.includes(AgentSessionStatus.NeedsInput) && filter.read === false;
    const isFilteredToNeedsInput = filter.states?.length === 3 && filter.states.includes(AgentSessionStatus.InProgress) && filter.read === false;
    return { isFilteredToUnread, isFilteredToInProgress, isFilteredToNeedsInput };
  }
  /**
   * Get the stored filter object from storage.
   */
  _getStoredFilter() {
    const filterStr = this.storageService.get(FILTER_STORAGE_KEY, StorageScope.PROFILE);
    if (!filterStr) {
      return void 0;
    }
    try {
      return JSON.parse(filterStr);
    } catch {
      return void 0;
    }
  }
  /**
   * Store a filter object to storage.
   */
  _storeFilter(filter) {
    this.storageService.store(FILTER_STORAGE_KEY, JSON.stringify(filter), StorageScope.PROFILE, StorageTarget.USER);
  }
  /**
   * Clear all filters (reset to default).
   */
  _clearFilter() {
    this._storeFilter({
      providers: [],
      states: [],
      archived: true,
      read: false
    });
  }
  /**
   * Save the current user filter before we override it with a badge filter.
   * Only saves if the current filter is NOT already a badge filter (unread or in-progress).
   * This preserves the original user filter when switching between badge filters.
   */
  _saveUserFilter() {
    const { isFilteredToUnread, isFilteredToInProgress, isFilteredToNeedsInput } = this._getCurrentFilterState();
    if (isFilteredToUnread || isFilteredToInProgress || isFilteredToNeedsInput) {
      return;
    }
    const currentFilter = this._getStoredFilter();
    if (currentFilter) {
      this.storageService.store(PREVIOUS_FILTER_STORAGE_KEY, JSON.stringify(currentFilter), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
  /**
   * Restore the user's previous filter (saved before we applied a badge filter).
   */
  _restoreUserFilter() {
    const previousFilterStr = this.storageService.get(PREVIOUS_FILTER_STORAGE_KEY, StorageScope.PROFILE);
    if (previousFilterStr) {
      try {
        const previousFilter = JSON.parse(previousFilterStr);
        this._storeFilter(previousFilter);
      } catch {
        this._clearFilter();
      }
    } else {
      this._clearFilter();
    }
    this.storageService.remove(PREVIOUS_FILTER_STORAGE_KEY, StorageScope.PROFILE);
    this._badgeFilterAppliedByThisWindow = null;
  }
  /**
   * Opens the agent sessions view with a specific filter applied, or restores previous filter if already applied.
   * Preserves session type (provider) filters while toggling only status filters.
   */
  _openSessionsWithFilter(filterType) {
    const { isFilteredToUnread, isFilteredToInProgress, isFilteredToNeedsInput } = this._getCurrentFilterState();
    const currentFilter = this._getStoredFilter();
    const preservedProviders = currentFilter?.providers ?? [];
    const isToggleOff = filterType === "unread" && isFilteredToUnread || filterType === "inProgress" && isFilteredToInProgress || filterType === "needsInput" && isFilteredToNeedsInput;
    this.telemetryService.publicLog2("agentStatusWidget.click", {
      source: filterType,
      action: isToggleOff ? "clearFilter" : "applyFilter"
    });
    if (isToggleOff) {
      this._restoreUserFilter();
    } else {
      this._saveUserFilter();
      if (filterType === "unread") {
        this._storeFilter({
          providers: preservedProviders,
          states: [],
          archived: true,
          read: true
        });
      } else if (filterType === "inProgress") {
        this._storeFilter({
          providers: preservedProviders,
          states: [AgentSessionStatus.Completed, AgentSessionStatus.Failed, AgentSessionStatus.NeedsInput],
          archived: true,
          read: false
        });
      } else {
        this._storeFilter({
          providers: preservedProviders,
          states: [AgentSessionStatus.Completed, AgentSessionStatus.Failed, AgentSessionStatus.InProgress],
          archived: true,
          read: false
        });
      }
      this._badgeFilterAppliedByThisWindow = filterType;
    }
    this.commandService.executeCommand(FocusAgentSessionsAction.id);
  }
  /**
   * Render the escape button for exiting session projection mode.
   */
  _renderEscapeButton(disposables, parent) {
    const escButton = $("span.agent-status-esc-button");
    escButton.textContent = "Esc";
    escButton.setAttribute("role", "button");
    escButton.setAttribute("aria-label", localize("exitAgentSessionProjection", "Exit Agent Session Projection"));
    escButton.tabIndex = 0;
    this._rovingElements.push(escButton);
    parent.appendChild(escButton);
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    disposables.add(this.hoverService.setupManagedHover(hoverDelegate, escButton, localize("exitAgentSessionProjectionTooltip", "Exit Agent Session Projection (Escape)")));
    disposables.add(addDisposableListener(escButton, EventType.MOUSE_DOWN, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.commandService.executeCommand(ExitAgentSessionProjectionAction.ID);
    }));
    disposables.add(addDisposableListener(escButton, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.commandService.executeCommand(ExitAgentSessionProjectionAction.ID);
    }));
    disposables.add(addDisposableListener(escButton, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.commandService.executeCommand(ExitAgentSessionProjectionAction.ID);
      }
    }));
  }
  /**
   * Render the enter button for entering session projection mode.
   */
  _renderEnterButton(disposables, parent) {
    const enterButton = $("span.agent-status-enter-button");
    const keybinding = this.keybindingService.lookupKeybinding(EnterAgentSessionProjectionAction.ID);
    enterButton.textContent = keybinding?.getLabel() ?? localize("review", "Review");
    enterButton.setAttribute("role", "button");
    enterButton.setAttribute("aria-label", localize("enterAgentSessionProjection", "Enter Agent Session Projection"));
    enterButton.tabIndex = 0;
    this._rovingElements.push(enterButton);
    parent.appendChild(enterButton);
    const hoverDelegate = getDefaultHoverDelegate("mouse");
    const hoverText = keybinding ? localize("enterAgentSessionProjectionTooltip", "Review Changes ({0})", keybinding.getLabel()) : localize("enterAgentSessionProjectionTooltipNoKey", "Review Changes");
    disposables.add(this.hoverService.setupManagedHover(hoverDelegate, enterButton, hoverText));
    const enterProjection = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sessionInfo = this.agentTitleBarStatusService.sessionInfo;
      if (sessionInfo) {
        const session = this.agentSessionsService.getSession(sessionInfo.sessionResource);
        if (session) {
          this.commandService.executeCommand(EnterAgentSessionProjectionAction.ID, session);
        }
      }
    };
    disposables.add(addDisposableListener(enterButton, EventType.MOUSE_DOWN, enterProjection));
    disposables.add(addDisposableListener(enterButton, EventType.CLICK, enterProjection));
    disposables.add(addDisposableListener(enterButton, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        enterProjection(e);
      }
    }));
  }
  // #endregion
  // #region Session Helpers
  /**
   * Get the session most urgently needing user attention (approval/confirmation/input).
   * Returns undefined if no sessions need attention.
   */
  _getSessionNeedingAttention(attentionNeededSessions) {
    if (attentionNeededSessions.length === 0) {
      return { session: void 0, progress: void 0 };
    }
    const sorted = [...attentionNeededSessions].sort((a, b) => {
      const timeA = a.timing.lastRequestStarted ?? a.timing.created;
      const timeB = b.timing.lastRequestStarted ?? b.timing.created;
      return timeB - timeA;
    });
    const mostRecent = sorted[0];
    if (!mostRecent.description) {
      return { session: mostRecent, progress: mostRecent.label };
    }
    const progress = typeof mostRecent.description === "string" ? mostRecent.description : renderAsPlaintext(mostRecent.description);
    return { session: mostRecent, progress };
  }
  // #endregion
  // #region Label Helpers
  /**
   * Compute the label to display in the command center.
   * Uses the workspace name (folder name) with prefix/suffix decorations.
   * Falls back to file name when tabs are hidden, or "Search" when empty.
   */
  _getLabel() {
    const { prefix, suffix } = this._windowTitle.getTitleDecorations();
    let label = this._windowTitle.workspaceName;
    if (this._windowTitle.isCustomTitleFormat()) {
      label = this._windowTitle.getWindowTitle();
    } else if (!label && this.editorGroupsService.partOptions.showTabs === "none") {
      label = this._windowTitle.fileName ?? "";
    }
    if (!label) {
      label = localize("agentStatusWidget.search", "Search");
    }
    if (prefix) {
      label = localize("label1", "{0} {1}", prefix, label);
    }
    if (suffix) {
      label = localize("label2", "{0} {1}", label, suffix);
    }
    return label.replaceAll(/\r\n|\r|\n/g, "\u23CE");
  }
  // #endregion
};
AgentTitleBarStatusWidget = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IAgentTitleBarStatusService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IAgentSessionsService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IEditorGroupsService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, IMenuService),
  __decorateParam(13, IContextKeyService),
  __decorateParam(14, IStorageService),
  __decorateParam(15, IConfigurationService),
  __decorateParam(16, IChatEntitlementService),
  __decorateParam(17, IChatWidgetService),
  __decorateParam(18, ITelemetryService)
], AgentTitleBarStatusWidget);
let AgentTitleBarStatusRendering = class extends Disposable {
  static {
    this.ID = "workbench.contrib.agentStatus.rendering";
  }
  constructor(actionViewItemService, instantiationService, configurationService, contextKeyService, titleService) {
    super();
    this._register(actionViewItemService.register(MenuId.CommandCenter, MenuId.AgentsTitleBarControlMenu, (action, options) => {
      if (!(action instanceof SubmenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(AgentTitleBarStatusWidget, action, titleService.windowTitle, options);
    }, void 0));
    const chatEnabledKey = contextKeyService.getContextKeyValue("chatIsEnabled");
    let chatEnabled = !!chatEnabledKey;
    const updateClass = () => {
      const commandCenterEnabled = configurationService.getValue(LayoutSettings.COMMAND_CENTER) === true;
      const statusMode = getAgentStatusSettingMode(configurationService, contextKeyService);
      const enabled = commandCenterEnabled && chatEnabled && statusMode !== "hidden";
      const enhanced = enabled && statusMode === "compact";
      mainWindow.document.body.classList.toggle("agent-status-enabled", enabled);
      mainWindow.document.body.classList.toggle("unified-agents-bar", enhanced);
    };
    updateClass();
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.AgentStatusEnabled) || e.affectsConfiguration(LayoutSettings.COMMAND_CENTER) || e.affectsConfiguration(ChatAIDisabledSettingId) || e.affectsConfiguration("disableAICustomizations") || e.affectsConfiguration("workbench.disableAICustomizations")) {
        updateClass();
      }
    }));
    this._register(contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(/* @__PURE__ */ new Set(["chatIsEnabled", InEditorZenModeContext.key]))) {
        chatEnabled = !!contextKeyService.getContextKeyValue("chatIsEnabled");
        updateClass();
      }
    }));
  }
};
AgentTitleBarStatusRendering = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ITitleService)
], AgentTitleBarStatusRendering);
export {
  AgentTitleBarStatusRendering,
  AgentTitleBarStatusWidget
};
