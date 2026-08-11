import { mainWindow } from "../../../../base/browser/window.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableFromEvent } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import product from "../../../../platform/product/common/product.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ViewContainerLocation } from "../../../../workbench/common/views.js";
import { Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { sessionHasChanges } from "../../../services/sessions/common/session.js";
import { CHANGES_VIEW_CONTAINER_ID, CHANGES_VIEW_ID } from "../../changes/common/changes.js";
import { SESSIONS_FILES_CONTAINER_ID } from "../../files/browser/files.contribution.js";
import { BaseLayoutController } from "./baseSessionLayoutController.js";
const NEW_SESSION_VIEW_STATE_KEY = "sessions.newSessionViewState";
const SMALL_WINDOW_MAX_WIDTH = 1800;
const RESPONSIVE_SIDEBAR_SETTING = "sessions.layout.autoCollapseSessionsSidebar";
class LayoutController extends BaseLayoutController {
  constructor() {
    super(...arguments);
    /** [D7] `true` while the sidebar is hidden because the controller auto-hid it; only such hides are auto-reverted. */
    this._sidebarAutoHidden = false;
    /** [D7] Guards the manual-toggle listener while the controller itself toggles the sidebar. */
    this._applyingAutoSidebar = false;
    /** [D7] Last computed space-constrained state, so the autorun only acts on real transitions. */
    this._previousSpaceConstrained = false;
    /** [D2/D8] `true` while the controller hides the side pane to restore a session's remembered state, so the hide isn't captured as a user choice. */
    this._hidingAuxiliaryBarForRestore = false;
  }
  static {
    this.ID = "workbench.contrib.sessionsLayoutController";
  }
  _registerViewStateManagement() {
    this._loadNewSessionViewState();
    const activeSessionIsCreatedObs = derived((reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      return activeSession?.isCreated.read(reader) ?? false;
    });
    const activeSessionHasWorkspaceObs = derived((reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      return activeSession?.workspace.read(reader)?.folders?.[0]?.root !== void 0;
    });
    const editorMaximizedObs = observableFromEvent(
      this,
      this._layoutService.onDidChangeEditorMaximized,
      () => this._layoutService.isEditorMaximized()
    );
    let previousSessionResource;
    let previousIsCreated = false;
    this._register(autorun((reader) => {
      const editorMaximized = editorMaximizedObs.read(reader);
      const activeSessionResource = this.activeSessionResourceObs.read(reader);
      const isCreated = activeSessionIsCreatedObs.read(reader);
      if (editorMaximized) {
        previousSessionResource = activeSessionResource;
        previousIsCreated = isCreated;
        void this._viewsService.openView(CHANGES_VIEW_ID, false);
        return;
      }
      const activeSessionHasWorkspace = activeSessionHasWorkspaceObs.read(reader);
      const multipleVisible = this.multipleSessionsVisibleObs.read(reader);
      if (multipleVisible) {
        previousSessionResource = activeSessionResource;
        previousIsCreated = isCreated;
        return;
      }
      const isSessionSwitch = previousSessionResource !== void 0 && !isEqual(previousSessionResource, activeSessionResource);
      if (isSessionSwitch) {
        this._captureViewState(previousSessionResource);
      }
      const isSubmit = previousSessionResource !== void 0 && !isSessionSwitch && !previousIsCreated && isCreated && activeSessionResource !== void 0;
      previousSessionResource = activeSessionResource;
      previousIsCreated = isCreated;
      if (isSubmit) {
        this._withSessionLayoutRestore(() => this._onNewSessionSubmitted(activeSessionResource));
        return;
      }
      this._withSessionLayoutRestore(
        () => this._syncAuxiliaryBarVisibility(activeSessionResource, activeSessionHasWorkspace, isCreated)
      );
    }));
    this._register(this._layoutService.onDidChangePartVisibility((e) => {
      if (e.partId !== Parts.AUXILIARYBAR_PART) {
        return;
      }
      if (this._togglingSidePane) {
        return;
      }
      if (this._hidingAuxiliaryBarForRestore) {
        return;
      }
      if (this._isRestoringSessionLayout) {
        return;
      }
      if (this.multipleSessionsVisibleObs.get()) {
        return;
      }
      if (this._layoutService.isEditorMaximized()) {
        return;
      }
      const activeSession = this._sessionsService.activeSession.get();
      if (!activeSession) {
        return;
      }
      if (!activeSession.isCreated.get()) {
        this._setNewSessionViewState({ auxiliaryBarVisible: e.visible });
      } else {
        if (e.visible && this._restoreSavedAuxiliaryBarContainerOnReveal(activeSession.resource)) {
          return;
        }
        this._captureViewState(activeSession.resource);
      }
    }));
    this._registerChangesAutoReveal();
    this._registerResponsiveSidebar();
    this._registerAuxiliaryBarPartVisibility();
    this._registerNewSessionRules();
  }
  _registerChangesAutoReveal() {
    this._register(this._editorService.onDidActiveEditorChange(() => this._revealChangesViewOnFirstOpen()));
    this._register(this._layoutService.onDidChangePartVisibility((e) => {
      if (e.partId === Parts.EDITOR_PART && e.visible) {
        this._revealChangesViewOnFirstOpen();
      }
    }));
  }
  _registerNewSessionRules() {
  }
  _onSessionReplaced(from, to) {
    super._onSessionReplaced(from, to);
    const activeSession = this._sessionsService.activeSession.get();
    const replacedSessionIsActive = isEqual(activeSession?.resource, from.resource) || isEqual(activeSession?.resource, to.resource);
    const auxiliaryBarVisible = replacedSessionIsActive ? this._layoutService.isVisible(Parts.AUXILIARYBAR_PART) : this._newSessionViewState?.auxiliaryBarVisible;
    if (auxiliaryBarVisible === void 0) {
      return;
    }
    this._viewStateBySession.set(to.resource, {
      auxiliaryBarVisible,
      auxiliaryBarActiveViewContainerId: replacedSessionIsActive && auxiliaryBarVisible ? this._paneCompositePartService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)?.getId() : void 0
    });
  }
  /**
   * [D10] Keep the auxiliary-bar part hidden when it has no active view
   * containers (e.g. a workspace-less quick chat where Changes+Files are gated
   * off), so an empty column is never shown. Re-checks on container add/remove,
   * location moves, active-view-descriptor changes (the gating signal), and
   * aux-bar visibility changes. Only ever hides — reveals stay with [D3]/[D8].
   */
  _registerAuxiliaryBarPartVisibility() {
    const modelListeners = this._register(new DisposableStore());
    const rewire = () => {
      modelListeners.clear();
      for (const container of this._viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.AuxiliaryBar)) {
        modelListeners.add(this._viewDescriptorService.getViewContainerModel(container).onDidChangeActiveViewDescriptors(() => this._syncAuxiliaryBarPartVisibility()));
      }
      this._syncAuxiliaryBarPartVisibility();
    };
    this._register(this._viewDescriptorService.onDidChangeViewContainers(rewire));
    this._register(this._viewDescriptorService.onDidChangeContainerLocation(rewire));
    this._register(this._viewsService.onDidChangeViewContainerVisibility((e) => {
      if (e.location === ViewContainerLocation.AuxiliaryBar) {
        this._syncAuxiliaryBarPartVisibility();
      }
    }));
    this._register(this._layoutService.onDidChangePartVisibility((e) => {
      if (e.partId === Parts.AUXILIARYBAR_PART && e.visible) {
        this._syncAuxiliaryBarPartVisibility();
      }
    }));
    rewire();
  }
  /** [D10] Hide the aux-bar part when it has no active view containers; never reveals it. */
  _syncAuxiliaryBarPartVisibility() {
    if (this._hasActiveAuxViewContainers()) {
      return;
    }
    const activeSession = this._sessionsService.activeSession.get();
    if (activeSession?.isQuickChat?.get() !== true) {
      return;
    }
    if (this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
      const suppression = this._layoutService.suppressEditorPartAutoVisibility();
      try {
        this._hideAuxiliaryBarForRestore();
      } finally {
        suppression.dispose();
      }
    }
  }
  /**
   * [D8] When a Changes (multi-diff) editor is opened (becomes active, or its
   * editor part is re-revealed) for an existing session, show the Changes view
   * in the side pane unless the user explicitly hid the aux bar for that
   * session. This reveals it the first time (no remembered choice) and again
   * after the whole side pane was closed (D9, which keeps the remembered choice
   * "open"), but respects an explicit aux-bar-hidden choice. The reveal is
   * captured by [D2]. Skipped while a side-pane toggle is in progress (so the
   * toggle restores exactly the remembered parts, D9), while the editor is
   * maximized (D5) or while multiple sessions are visible, where the side pane
   * is managed by other rules.
   */
  _revealChangesViewOnFirstOpen() {
    if (this._togglingSidePane) {
      return;
    }
    const activeEditorResource = this._editorService.activeEditor?.resource;
    if (!activeEditorResource) {
      return;
    }
    const changesSessionResource = this._sessionChangesService.getSessionResource(activeEditorResource);
    if (!changesSessionResource) {
      return;
    }
    if (this.multipleSessionsVisibleObs.get() || this._layoutService.isEditorMaximized()) {
      return;
    }
    const activeSession = this._sessionsService.activeSession.get();
    if (!activeSession || !isEqual(activeSession.resource, changesSessionResource)) {
      return;
    }
    if (!activeSession.isCreated.get()) {
      return;
    }
    if (!this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
      return;
    }
    const savedState = this._viewStateBySession.get(changesSessionResource);
    if (savedState) {
      if (this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
        return;
      }
      if (!savedState.auxiliaryBarVisible && !savedState.auxiliaryBarHiddenByCollapse) {
        return;
      }
    }
    void this._viewsService.openView(CHANGES_VIEW_ID, false);
  }
  /**
   * On a small window, auto-hide the sessions sidebar while both the editor and
   * auxiliary bar are open and auto-show it again once either closes — unless the
   * user closed the sidebar themselves. Disabled while multiple sessions are
   * visible and never triggered by session navigation. Gated by the experimental
   * `sessions.layout.autoCollapseSessionsSidebar` setting.
   */
  _registerResponsiveSidebar() {
    const enabledObs = observableConfigValue(RESPONSIVE_SIDEBAR_SETTING, product.quality !== "stable", this._configurationService);
    const smallWindowObs = observableFromEvent(
      this,
      this._layoutService.onDidLayoutMainContainer,
      () => this._layoutService.mainContainerDimension.width <= SMALL_WINDOW_MAX_WIDTH
    );
    const editorVisibleObs = observableFromEvent(
      this,
      this._layoutService.onDidChangePartVisibility,
      () => this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)
    );
    const auxiliaryBarVisibleObs = observableFromEvent(
      this,
      this._layoutService.onDidChangePartVisibility,
      () => this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)
    );
    const editorMaximizedObs = observableFromEvent(
      this,
      this._layoutService.onDidChangeEditorMaximized,
      () => this._layoutService.isEditorMaximized()
    );
    const spaceConstrainedObs = derived((reader) => enabledObs.read(reader) && !this.multipleSessionsVisibleObs.read(reader) && smallWindowObs.read(reader) && editorVisibleObs.read(reader) && auxiliaryBarVisibleObs.read(reader));
    this._previousSpaceConstrained = spaceConstrainedObs.get();
    this._register(autorun((reader) => {
      if (editorMaximizedObs.read(reader)) {
        return;
      }
      const constrained = spaceConstrainedObs.read(reader);
      if (this._isRestoringSessionLayout) {
        this._previousSpaceConstrained = constrained;
        return;
      }
      if (constrained === this._previousSpaceConstrained) {
        return;
      }
      this._previousSpaceConstrained = constrained;
      if (constrained) {
        if (this._setSidebarAutoHidden(true)) {
          this._sidebarAutoHidden = true;
        }
      } else if (this._sidebarAutoHidden) {
        this._setSidebarAutoHidden(false);
        this._sidebarAutoHidden = false;
      }
    }));
    this._register(this._layoutService.onDidChangePartVisibility((e) => {
      if (e.partId !== Parts.SIDEBAR_PART || this._applyingAutoSidebar) {
        return;
      }
      this._sidebarAutoHidden = false;
    }));
  }
  /** Returns `true` when the sidebar visibility was actually changed. */
  _setSidebarAutoHidden(hidden) {
    if (this._layoutService.isVisible(Parts.SIDEBAR_PART) === !hidden) {
      return false;
    }
    this._applyingAutoSidebar = true;
    try {
      this._layoutService.setPartHidden(hidden, Parts.SIDEBAR_PART);
    } finally {
      this._applyingAutoSidebar = false;
    }
    return true;
  }
  // [B4] Snapshot the active session's aux-bar state when persisting.
  _captureActiveSessionViewState(sessionResource) {
    this._captureViewState(sessionResource);
  }
  /**
   * [D9b] Records a whole-side-pane toggle for the active session. For an
   * uncreated session it updates the shared new-session choice. For a created
   * session, only a full collapse of a previously-visible aux bar is marked as a
   * collapse-driven hide (so opening Changes later re-reveals it); any other
   * outcome just captures the resulting state, preserving an explicit aux-bar
   * hide. See `desktopSessionLayoutController.md`.
   */
  _onSidePaneToggled(collapsed, previousAuxiliaryBarVisible, auxiliaryBarVisible) {
    if (this.multipleSessionsVisibleObs.get()) {
      return;
    }
    const activeSession = this._sessionsService.activeSession.get();
    if (!activeSession) {
      return;
    }
    if (!activeSession.isCreated.get()) {
      this._setNewSessionViewState({ auxiliaryBarVisible });
      return;
    }
    if (collapsed && previousAuxiliaryBarVisible) {
      const activeViewContainerId = this._paneCompositePartService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)?.getId();
      this._viewStateBySession.set(activeSession.resource, {
        auxiliaryBarVisible: false,
        auxiliaryBarActiveViewContainerId: activeViewContainerId,
        auxiliaryBarHiddenByCollapse: true
      });
      return;
    }
    this._captureViewState(activeSession.resource);
  }
  // --- Auxiliary bar [D1] ---
  _captureViewState(sessionResource) {
    const auxiliaryBarVisible = this._layoutService.isVisible(Parts.AUXILIARYBAR_PART);
    const activeViewContainerId = this._paneCompositePartService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)?.getId();
    const previous = this._viewStateBySession.get(sessionResource);
    const auxiliaryBarHiddenByCollapse = !auxiliaryBarVisible && previous?.auxiliaryBarHiddenByCollapse === true;
    this._viewStateBySession.set(sessionResource, {
      auxiliaryBarVisible,
      auxiliaryBarActiveViewContainerId: activeViewContainerId,
      ...auxiliaryBarHiddenByCollapse ? { auxiliaryBarHiddenByCollapse: true } : {}
    });
  }
  _setNewSessionViewState(state) {
    this._newSessionViewState = state;
    this._storageService.store(NEW_SESSION_VIEW_STATE_KEY, JSON.stringify(state), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  /**
   * [D4] When a new (uncreated) session is submitted it becomes a real session
   * while staying active. Keep the auxiliary bar exactly as the user left it: if
   * open, keep it open on the container it is already showing; if closed, keep it
   * closed and record no container so opening the side pane later picks the
   * default for the session's change state at that time ([D3d]). The resulting
   * state is persisted so later syncs don't fall back to hidden.
   */
  _onNewSessionSubmitted(sessionResource) {
    const auxiliaryBarVisible = this._layoutService.isVisible(Parts.AUXILIARYBAR_PART);
    this._viewStateBySession.set(sessionResource, {
      auxiliaryBarVisible,
      auxiliaryBarActiveViewContainerId: auxiliaryBarVisible ? this._paneCompositePartService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)?.getId() : void 0
    });
  }
  // [D3] Restore the auxiliary bar in strict priority order.
  // Note: This method is intentionally synchronous (void return). View-opening calls are
  // fire-and-forget so that _isRestoringSessionLayout ends immediately after sync operations.
  // This allows D2 to capture user actions that happen after the sync restore but before
  // working-set apply, while still skipping single-pane detail-panel reveals during working-set apply.
  _syncAuxiliaryBarVisibility(sessionResource, hasWorkspace, isCreated) {
    if (!sessionResource || !hasWorkspace) {
      return;
    }
    if (!isCreated) {
      if (this._newSessionViewState && !this._newSessionViewState.auxiliaryBarVisible) {
        this._hideAuxiliaryBarForRestore();
        return;
      }
      void this._openDefaultAuxiliaryBarContainer();
      return;
    }
    const savedState = this._viewStateBySession.get(sessionResource);
    if (!savedState || !savedState.auxiliaryBarVisible) {
      this._hideAuxiliaryBarForRestore();
      return;
    }
    const savedContainerId = savedState.auxiliaryBarActiveViewContainerId;
    if (savedContainerId && this._isAuxiliaryBarContainerPinned(savedContainerId)) {
      void this._viewsService.openViewContainer(savedContainerId, false);
      return;
    }
    void this._openDefaultAuxiliaryBarContainer();
  }
  /**
   * [D3d] The container the side pane defaults to for the active session:
   * Changes once the session has produced at least one change (in any of its
   * chats), Files until then. Falls back to Changes when the user has unpinned
   * the Files pane, since there is nothing else to show.
   *
   * Read untracked on purpose: the default is evaluated at the moment the side
   * pane is opened, so a change landing later never switches a pane the user is
   * already looking at.
   */
  _defaultAuxiliaryBarContainerId() {
    if (!this._isAuxiliaryBarContainerPinned(SESSIONS_FILES_CONTAINER_ID)) {
      return CHANGES_VIEW_CONTAINER_ID;
    }
    const activeSession = this._sessionsService.activeSession.get();
    return activeSession && sessionHasChanges(activeSession, void 0) ? CHANGES_VIEW_CONTAINER_ID : SESSIONS_FILES_CONTAINER_ID;
  }
  /** [D3d] Opens the container chosen by {@link _defaultAuxiliaryBarContainerId}. */
  _openDefaultAuxiliaryBarContainer(containerId = this._defaultAuxiliaryBarContainerId()) {
    if (containerId === CHANGES_VIEW_CONTAINER_ID) {
      return this._viewsService.openView(CHANGES_VIEW_ID, false);
    }
    return this._viewsService.openViewContainer(containerId, false);
  }
  _restoreSavedAuxiliaryBarContainerOnReveal(sessionResource) {
    const savedState = this._viewStateBySession.get(sessionResource);
    if (!savedState || savedState.auxiliaryBarVisible) {
      return false;
    }
    const savedContainerId = savedState.auxiliaryBarActiveViewContainerId;
    if (savedContainerId && this._isAuxiliaryBarContainerPinned(savedContainerId)) {
      this._viewStateBySession.set(sessionResource, { ...savedState, auxiliaryBarVisible: true });
      void this._viewsService.openViewContainer(savedContainerId, false);
    } else {
      const defaultContainerId = this._defaultAuxiliaryBarContainerId();
      this._viewStateBySession.set(sessionResource, {
        auxiliaryBarVisible: true,
        auxiliaryBarActiveViewContainerId: defaultContainerId
      });
      void this._openDefaultAuxiliaryBarContainer(defaultContainerId);
    }
    return true;
  }
  /**
   * [D2/D8] Hide the side pane as part of restoring a session's remembered
   * state. The synchronous guard makes the [D2] listener ignore the resulting
   * visibility change so a restore-driven hide is never recorded as a new
   * per-session choice.
   */
  _hideAuxiliaryBarForRestore() {
    this._hidingAuxiliaryBarForRestore = true;
    try {
      this._layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
    } finally {
      this._hidingAuxiliaryBarForRestore = false;
    }
  }
  _isAuxiliaryBarContainerPinned(containerId) {
    return this._paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.AuxiliaryBar).includes(containerId);
  }
  _loadNewSessionViewState() {
    const newSessionRaw = this._storageService.get(NEW_SESSION_VIEW_STATE_KEY, StorageScope.WORKSPACE);
    if (!newSessionRaw) {
      return;
    }
    try {
      const parsed = JSON.parse(newSessionRaw);
      if (parsed && typeof parsed.auxiliaryBarVisible === "boolean") {
        this._newSessionViewState = { auxiliaryBarVisible: parsed.auxiliaryBarVisible };
      } else {
        this._storageService.remove(NEW_SESSION_VIEW_STATE_KEY, StorageScope.WORKSPACE);
      }
    } catch {
      this._storageService.remove(NEW_SESSION_VIEW_STATE_KEY, StorageScope.WORKSPACE);
    }
  }
}
export {
  LayoutController,
  RESPONSIVE_SIDEBAR_SETTING
};
