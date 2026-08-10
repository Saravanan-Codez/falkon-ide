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
import "./media/sessionsTitleBarWidget.css";
import { $, addDisposableGenericMouseDownListener, addDisposableListener, EventType, getDomNodePagePosition, getWindow, isAncestor, reset } from "../../../../base/browser/dom.js";
import { combinedDisposable, Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { localize } from "../../../../nls.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { MenuRegistry, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { Menus } from "../../../browser/menus.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { autorun } from "../../../../base/common/observable.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { AnchorAlignment, AnchorPosition } from "../../../../base/common/layout.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IsAuxiliaryWindowContext } from "../../../../workbench/common/contextkeys.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { SessionsBlockedSessionsVisibleContext, SessionsWelcomeVisibleContext } from "../../../common/contextkeys.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { SHOW_SESSIONS_PICKER_COMMAND_ID } from "./sessionsActions.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { getUntitledSessionTitle } from "../../../services/sessions/common/session.js";
import { BlockedSessionsList, registerBlockedSessionsItemActions } from "./blockedSessionsList.js";
import { SessionActionFeedback } from "./sessionActionFeedback.js";
import { BlockedSessionsIndicatorModel } from "./blockedSessionsIndicatorModel.js";
import { openSessionToTheSide } from "./views/sessionsView.js";
const SHOW_ALL_SESSIONS_FROM_BLOCKED_LIST_COMMAND_ID = "sessions.blockedSessions.showAllSessions";
const IGNORE_ALL_INPUT_NEEDED_COMMAND_ID = "sessions.blockedSessions.ignoreAllInputNeeded";
const HIDE_BLOCKED_SESSIONS_COMMAND_ID = "sessions.blockedSessions.hide";
function registerBlockedSessionsHeaderActions() {
  return combinedDisposable(
    MenuRegistry.appendMenuItem(Menus.BlockedSessionsHeader, {
      command: {
        id: SHOW_ALL_SESSIONS_FROM_BLOCKED_LIST_COMMAND_ID,
        title: localize("showAllSessions", "Show All Sessions"),
        icon: Codicon.listSelection
      },
      group: "navigation",
      order: 1
    }),
    MenuRegistry.appendMenuItem(Menus.BlockedSessionsHeader, {
      command: {
        id: IGNORE_ALL_INPUT_NEEDED_COMMAND_ID,
        title: localize("ignoreAllInputNeeded", "Ignore All Input Needed"),
        icon: Codicon.bellSlash
      },
      group: "navigation",
      order: 2
    }),
    MenuRegistry.appendMenuItem(Menus.BlockedSessionsHeader, {
      command: {
        id: HIDE_BLOCKED_SESSIONS_COMMAND_ID,
        title: localize("closeBlockedSessions", "Close"),
        icon: Codicon.close
      },
      group: "z_close",
      order: 1
    })
  );
}
function registerBlockedSessionsHeaderCommands() {
  return combinedDisposable(
    CommandsRegistry.registerCommand(SHOW_ALL_SESSIONS_FROM_BLOCKED_LIST_COMMAND_ID, (_accessor, context) => {
      context.showAllSessions();
    }),
    CommandsRegistry.registerCommand(IGNORE_ALL_INPUT_NEEDED_COMMAND_ID, (_accessor, context) => {
      context.ignoreAllSessions();
    })
  );
}
let openBlockedSessionsView;
const BLOCKED_DROPDOWN_MIN_WIDTH = 550;
const BLOCKED_DROPDOWN_MAX_WIDTH_RATIO = 0.9;
let SessionsTitleBarWidget = class extends BaseActionViewItem {
  constructor(action, options, sessionActionFeedback, approvalModel, blockedSessions, ciFixModel, sessionsManagementService, sessionsService, sessionsProvidersService, commandService, contextViewService, layoutService, instantiationService, contextKeyService, quickInputService) {
    super(void 0, action, options);
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsService = sessionsService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.commandService = commandService;
    this.contextViewService = contextViewService;
    this.layoutService = layoutService;
    this.instantiationService = instantiationService;
    this.quickInputService = quickInputService;
    this._dynamicDisposables = this._register(new DisposableStore());
    /** Owns the blink animation's `animationend` listener, kept across re-renders. */
    this._blinkListener = this._register(new MutableDisposable());
    /** Guard to prevent re-entrant rendering */
    this._isRendering = false;
    this._blockedSessionsVisibleContext = SessionsBlockedSessionsVisibleContext.bindTo(contextKeyService);
    this._sessionActionFeedback = sessionActionFeedback ?? this._register(new SessionActionFeedback());
    this._blockedIndicator = this._register(this.instantiationService.createInstance(BlockedSessionsIndicatorModel, approvalModel, blockedSessions, ciFixModel));
    this._register(this._blockedIndicator.onDidRequestBlink(() => {
      this._lastRenderState = void 0;
      this._render();
    }));
    this._register(autorun((reader) => {
      const sessionData = this.sessionsService.activeSession.read(reader);
      if (sessionData) {
        sessionData.title.read(reader);
        sessionData.workspace.read(reader);
        sessionData.isQuickChat?.read(reader);
      }
      this._lastRenderState = void 0;
      this._render();
    }));
    this._register(autorun((reader) => {
      const blocked = this._blockedIndicator.blockedSessions.read(reader);
      this._sessionActionFeedback.approvedCount.read(reader);
      this._blockedIndicator.requiresInputKind.read(reader);
      if (this._openContextView && this._blockedList) {
        this._blockedList.setSessions(blocked.map((entry) => entry.session));
        this.contextViewService.layout();
      }
      this._render();
    }));
    this._register(this.sessionsManagementService.onDidChangeSessions(() => {
      this._lastRenderState = void 0;
      this._render();
    }));
    this._register(this.sessionsProvidersService.onDidChangeProviders(() => {
      this._lastRenderState = void 0;
      this._render();
    }));
    this._register(toDisposable(() => this._openContextView?.close()));
  }
  render(container) {
    super.render(container);
    this._container = container;
    container.classList.add("agent-sessions-titlebar-container");
    this._render();
  }
  setFocusable(_focusable) {
  }
  // Override onClick to prevent the base class from running the underlying
  // submenu action when the widget handles clicks itself.
  onClick() {
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
      const approvedCount = this._sessionActionFeedback.approvedCount.get();
      const blockedCount = this._blockedIndicator.blockedSessions.get().length;
      const requiresInput = blockedCount > 0;
      const showApproved = approvedCount > 0;
      const showRequiresInput = requiresInput && !showApproved;
      const shouldBlink = showRequiresInput && this._blockedIndicator.consumePendingBlink();
      const requiresInputKind = this._blockedIndicator.requiresInputKind.get();
      let renderState;
      if (showApproved) {
        renderState = `approved|${approvedCount}`;
      } else if (showRequiresInput) {
        renderState = `blocked|${blockedCount}|${requiresInputKind ?? "mixed"}`;
      } else {
        const icon = this._getActiveSessionIcon();
        const sessionTitle = this._getSessionTitle() ?? getUntitledSessionTitle(this.sessionsService.activeSession.get()?.isQuickChat?.get() ?? false);
        const workspaceLabel = this._getRepositoryLabel();
        renderState = `normal|${icon?.id ?? ""}|${sessionTitle ?? ""}|${workspaceLabel ?? ""}`;
      }
      if (this._lastRenderState === renderState) {
        return;
      }
      this._lastRenderState = renderState;
      if (!requiresInput && this._openContextView) {
        this._openContextView.close();
      }
      reset(this._container);
      this._dynamicDisposables.clear();
      this._container.removeAttribute("aria-hidden");
      this._container.setAttribute("role", "button");
      this._container.tabIndex = 0;
      if (!(showRequiresInput && !shouldBlink)) {
        this._container.classList.remove("agent-sessions-titlebar-blink");
      }
      this._container.classList.toggle("agent-sessions-titlebar-requires-input", showRequiresInput);
      this._container.classList.toggle("agent-sessions-titlebar-approved", showApproved);
      if (showApproved) {
        this._renderApproved(approvedCount);
      } else if (showRequiresInput) {
        this._renderRequiresInput(blockedCount, requiresInputKind, shouldBlink);
      } else {
        this._renderActiveSession();
      }
    } finally {
      this._isRendering = false;
    }
  }
  /**
   * Render the active-session pill: icon + title + workspace. Clicking opens the
   * sessions picker.
   */
  _renderActiveSession() {
    const container = this._container;
    container.setAttribute("aria-label", localize("agentSessionsShowSessions", "Show Sessions"));
    const icon = this._getActiveSessionIcon();
    const sessionTitle = this._getSessionTitle() ?? getUntitledSessionTitle(this.sessionsService.activeSession.get()?.isQuickChat?.get() ?? false);
    const workspaceLabel = this._getRepositoryLabel();
    const sessionPill = $("div.agent-sessions-titlebar-pill");
    const centerGroup = $("div.agent-sessions-titlebar-center");
    if (icon) {
      const iconEl = $("div.agent-sessions-titlebar-icon" + ThemeIcon.asCSSSelector(icon));
      centerGroup.appendChild(iconEl);
    }
    if (sessionTitle) {
      const titleEl = $("div.agent-sessions-titlebar-title");
      titleEl.textContent = sessionTitle;
      centerGroup.appendChild(titleEl);
    }
    if (workspaceLabel) {
      const separatorEl = $("div.agent-sessions-titlebar-separator");
      centerGroup.appendChild(separatorEl);
      const workspaceEl = $("div.agent-sessions-titlebar-workspace");
      workspaceEl.textContent = workspaceLabel;
      centerGroup.appendChild(workspaceEl);
    }
    sessionPill.appendChild(centerGroup);
    this._dynamicDisposables.add(addDisposableGenericMouseDownListener(sessionPill, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }));
    this._dynamicDisposables.add(addDisposableListener(sessionPill, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showSessionsPicker();
    }));
    container.appendChild(sessionPill);
    this._dynamicDisposables.add(addDisposableListener(container, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this._showSessionsPicker();
      }
    }));
  }
  /**
   * Render the requires-input pill. Clicking toggles a dropdown that lists the
   * blocked sessions below the command center box.
   */
  _renderRequiresInput(count, kind, shouldBlink) {
    const container = this._container;
    const label = this._blockedIndicator.getRequiresInputLabel(count, kind);
    container.setAttribute("aria-label", label);
    const pill = $("div.agent-sessions-titlebar-pill");
    const labelEl = $("div.agent-sessions-titlebar-requires-input-label");
    labelEl.textContent = label;
    pill.appendChild(labelEl);
    this._dynamicDisposables.add(addDisposableGenericMouseDownListener(pill, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }));
    this._dynamicDisposables.add(addDisposableListener(pill, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._toggleBlockedSessions();
    }));
    container.appendChild(pill);
    this._dynamicDisposables.add(addDisposableListener(container, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this._toggleBlockedSessions();
      }
    }));
    if (shouldBlink) {
      this._triggerAttentionBlink();
    }
  }
  /**
   * Render the transient green "Approved N sessions" confirmation shown briefly
   * after the user approves one or more sessions' pending actions from the list.
   */
  _renderApproved(count) {
    const container = this._container;
    const label = count === 1 ? localize("oneSessionApproved", "Approved 1 session") : localize("nSessionsApproved", "Approved {0} sessions", count);
    container.setAttribute("aria-label", label);
    const pill = $("div.agent-sessions-titlebar-pill");
    const labelEl = $("div.agent-sessions-titlebar-approved-label");
    labelEl.textContent = label;
    pill.appendChild(labelEl);
    this._dynamicDisposables.add(addDisposableGenericMouseDownListener(pill, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }));
    this._dynamicDisposables.add(addDisposableListener(pill, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._activateDefaultAction();
    }));
    container.appendChild(pill);
    this._dynamicDisposables.add(addDisposableListener(container, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this._activateDefaultAction();
      }
    }));
  }
  /**
   * Activate the widget as its non-approved state would: reveal the blocked
   * sessions when the requires-input state applies, otherwise the sessions picker.
   */
  _activateDefaultAction() {
    const requiresInput = this._blockedIndicator.blockedSessions.get().length > 0;
    if (requiresInput) {
      this._toggleBlockedSessions();
    } else {
      this._showSessionsPicker();
    }
  }
  /**
   * Restart the attention blink animation on the command center box. Re-adding
   * the class after a forced reflow guarantees the CSS animation replays even
   * when the container element persists across renders.
   */
  _triggerAttentionBlink() {
    const container = this._container;
    if (!container) {
      return;
    }
    container.classList.remove("agent-sessions-titlebar-blink");
    container.getBoundingClientRect();
    container.classList.add("agent-sessions-titlebar-blink");
    this._blinkListener.value = addDisposableListener(container, "animationend", () => {
      container.classList.remove("agent-sessions-titlebar-blink");
      this._blinkListener.clear();
    });
  }
  /**
   * Toggle the blocked-sessions dropdown open/closed.
   */
  _toggleBlockedSessions() {
    if (this._openContextView) {
      this._openContextView.close();
      return;
    }
    this._showBlockedSessions();
  }
  /**
   * Show the blocked sessions as a flat list in a dropdown anchored below the
   * command center box.
   */
  _showBlockedSessions() {
    const container = this._container;
    if (!container) {
      return;
    }
    if (this._blockedIndicator.blockedSessions.get().length === 0) {
      return;
    }
    const width = this._computeBlockedDropdownWidth(container);
    const store = new DisposableStore();
    this._openContextView = this.contextViewService.showContextView({
      getAnchor: () => this._getBlockedDropdownAnchor(container),
      anchorAlignment: AnchorAlignment.LEFT,
      anchorPosition: AnchorPosition.BELOW,
      render: (viewContainer) => {
        const list = store.add(this.instantiationService.createInstance(BlockedSessionsList, viewContainer, {
          width,
          approvalModel: this._blockedIndicator.approvalModel,
          ciFixModel: this._blockedIndicator.ciFixModel,
          onSessionOpen: (resource, preserveFocus, sideBySide) => {
            this._openContextView?.close();
            this._openBlockedSession(resource, preserveFocus, sideBySide);
          },
          onIgnoreSession: (session) => this._blockedIndicator.ignoreSession(session),
          onShowAllSessions: () => {
            this._openContextView?.close();
            this._showSessionsPicker();
          },
          onIgnoreAllSessions: () => this._blockedIndicator.ignoreAllSessions(),
          onClose: () => this._openContextView?.close()
        }));
        list.setSessions(this._blockedIndicator.blockedSessions.get().map((entry) => entry.session));
        store.add(list.onDidChangeContentHeight(() => this.contextViewService.layout()));
        store.add(list.onDidApproveSession((approved) => {
          this._blockedIndicator.dismissApproval(approved);
          this._sessionActionFeedback.notifyApproved();
        }));
        store.add(this.layoutService.onDidLayoutActiveContainer(() => {
          list.setWidth(this._computeBlockedDropdownWidth(container));
          this.contextViewService.layout();
        }));
        store.add(this.quickInputService.onShow(() => this._openContextView?.close()));
        this._blockedList = list;
        return store;
      },
      focus: () => this._blockedList?.focus(),
      onDOMEvent: (e) => {
        if (e.type === EventType.CLICK) {
          const target = e.target;
          if (target && !isAncestor(target, this.contextViewService.getContextViewElement()) && !isAncestor(target, container)) {
            this._openContextView?.close();
          }
        }
      },
      onHide: () => {
        this._blockedSessionsVisibleContext.set(false);
        store.dispose();
        this._openContextView = void 0;
        openBlockedSessionsView = void 0;
        this._blockedList = void 0;
      }
    });
    openBlockedSessionsView = this._openContextView;
    this._blockedSessionsVisibleContext.set(true);
  }
  /**
   * Compute the width of the blocked-sessions dropdown: at least as wide as the
   * command center box (the anchor) and {@link BLOCKED_DROPDOWN_MIN_WIDTH}, but
   * never wider than {@link BLOCKED_DROPDOWN_MAX_WIDTH_RATIO} of the window so it
   * stays within the viewport on narrow layouts.
   */
  _computeBlockedDropdownWidth(container) {
    const anchorWidth = getDomNodePagePosition(container).width;
    const windowWidth = getWindow(container).innerWidth;
    const minWidth = Math.max(anchorWidth, BLOCKED_DROPDOWN_MIN_WIDTH);
    const maxWidth = windowWidth * BLOCKED_DROPDOWN_MAX_WIDTH_RATIO;
    return Math.round(Math.min(minWidth, maxWidth));
  }
  /**
   * Anchor the blocked-sessions dropdown so it is horizontally centered on the
   * command center box. Because the dropdown can be wider than the box, we hand
   * the context view a zero-width anchor positioned at the dropdown's target
   * left edge (the box center minus half the dropdown width).
   */
  _getBlockedDropdownAnchor(container) {
    const position = getDomNodePagePosition(container);
    const width = this._computeBlockedDropdownWidth(container);
    const centerX = position.left + position.width / 2;
    return {
      x: Math.round(centerX - width / 2),
      y: position.top,
      width: 0,
      height: position.height
    };
  }
  _openBlockedSession(resource, preserveFocus, sideBySide) {
    if (sideBySide) {
      const session = this.sessionsManagementService.getSession(resource);
      if (session) {
        openSessionToTheSide(this.sessionsService, session, { preserveFocus }).catch(onUnexpectedError);
        return;
      }
    }
    this.sessionsService.openSession(resource, { preserveFocus }).catch(onUnexpectedError);
  }
  /**
   * Get the icon for the active session's type.
   */
  _getActiveSessionIcon() {
    const sessionData = this.sessionsService.activeSession.get();
    if (sessionData) {
      return sessionData.icon;
    }
    return void 0;
  }
  /**
   * Get the display title for the active session.
   */
  _getSessionTitle() {
    const sessionData = this.sessionsService.activeSession.get();
    return sessionData?.title.get()?.trim() || void 0;
  }
  /**
   * Get the repository label for the active session.
   */
  _getRepositoryLabel() {
    const sessionData = this.sessionsService.activeSession.get();
    if (sessionData) {
      const workspace = sessionData.workspace.get();
      if (workspace) {
        return workspace.label;
      }
    }
    return void 0;
  }
  _showSessionsPicker() {
    this.commandService.executeCommand(SHOW_SESSIONS_PICKER_COMMAND_ID);
  }
};
SessionsTitleBarWidget = __decorateClass([
  __decorateParam(6, ISessionsManagementService),
  __decorateParam(7, ISessionsService),
  __decorateParam(8, ISessionsProvidersService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, IContextViewService),
  __decorateParam(11, IWorkbenchLayoutService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, IContextKeyService),
  __decorateParam(14, IQuickInputService)
], SessionsTitleBarWidget);
let SessionsTitleBarContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.agentSessionsTitleBar";
  }
  constructor(actionViewItemService, instantiationService) {
    super();
    this._register(MenuRegistry.appendMenuItem(Menus.CommandCenter, {
      submenu: Menus.TitleBarSessionTitle,
      title: localize("agentSessionsControl", "Agent Sessions"),
      order: 101,
      when: ContextKeyExpr.and(IsAuxiliaryWindowContext.negate(), SessionsWelcomeVisibleContext.negate())
    }));
    this._register(MenuRegistry.appendMenuItem(Menus.TitleBarSessionTitle, {
      command: {
        id: SHOW_SESSIONS_PICKER_COMMAND_ID,
        title: localize("showSessions", "Show Sessions")
      },
      group: "a_sessions",
      order: 1,
      when: IsAuxiliaryWindowContext.negate()
    }));
    this._register(registerBlockedSessionsHeaderCommands());
    this._register(registerBlockedSessionsHeaderActions());
    this._register(registerBlockedSessionsItemActions());
    this._register(actionViewItemService.register(Menus.CommandCenter, Menus.TitleBarSessionTitle, (action, options) => {
      if (!(action instanceof SubmenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(SessionsTitleBarWidget, action, options, void 0, void 0, void 0, void 0);
    }, void 0));
  }
};
SessionsTitleBarContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService)
], SessionsTitleBarContribution);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: HIDE_BLOCKED_SESSIONS_COMMAND_ID,
  weight: KeybindingWeight.SessionsContrib + 100,
  when: SessionsBlockedSessionsVisibleContext,
  primary: KeyCode.Escape,
  handler: (_accessor, context) => {
    if (context) {
      context.close();
    } else {
      openBlockedSessionsView?.close();
    }
  }
});
export {
  SessionsTitleBarContribution,
  SessionsTitleBarWidget,
  registerBlockedSessionsHeaderActions,
  registerBlockedSessionsHeaderCommands
};
