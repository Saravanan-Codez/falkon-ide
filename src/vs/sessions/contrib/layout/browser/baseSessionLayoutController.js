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
import { mainWindow } from "../../../../base/browser/window.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { isThenable, Sequencer } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { autorun, derived, derivedObservableWithCache, derivedOpts, observableFromEvent, runOnChange } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { URI } from "../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILifecycleService } from "../../../../workbench/services/lifecycle/common/lifecycle.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { AuxiliaryBarVisibleContext, IsAuxiliaryWindowContext, MainEditorAreaVisibleContext } from "../../../../workbench/common/contextkeys.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../workbench/common/views.js";
import { IEditorGroupsService } from "../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { IPaneCompositePartService } from "../../../../workbench/services/panecomposite/browser/panecomposite.js";
import { IViewsService } from "../../../../workbench/services/views/common/viewsService.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
import { Menus } from "../../../browser/menus.js";
import { SessionsWelcomeVisibleContext, IsQuickChatSessionContext, CustomViewVisibleContext } from "../../../common/contextkeys.js";
import { logSidePanelToggle } from "../../../common/sessionsTelemetry.js";
import { ISessionChangesService } from "../../changes/browser/sessionChangesService.js";
import { IChangesViewService } from "../../changes/common/changesViewService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
const secondarySidebarToggleClosedIcon = registerIcon("agent-secondary-sidebar-toggle-closed", Codicon.layoutSidebarRightOff, localize("agentSecondarySidebarToggleClosedIcon", "Icon for the sessions secondary sidebar when closed."));
const secondarySidebarToggleOpenIcon = registerIcon("agent-secondary-sidebar-toggle-open", Codicon.layoutSidebarRight, localize("agentSecondarySidebarToggleOpenIcon", "Icon for the sessions secondary sidebar when open."));
const SESSION_LAYOUT_STATE_KEY = "sessions.layoutState";
const WORKING_SETS_STORAGE_KEY = "sessions.workingSets";
let BaseLayoutController = class extends Disposable {
  constructor(_layoutService, _sessionManagementService, _sessionsService, _viewsService, _paneCompositePartService, _storageService, _configurationService, _editorService, _editorGroupsService, _workspaceContextService, _sessionChangesService, _changesViewService, _viewDescriptorService, _contextKeyService, _instantiationService, _lifecycleService) {
    super();
    this._layoutService = _layoutService;
    this._sessionManagementService = _sessionManagementService;
    this._sessionsService = _sessionsService;
    this._viewsService = _viewsService;
    this._paneCompositePartService = _paneCompositePartService;
    this._storageService = _storageService;
    this._configurationService = _configurationService;
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    this._workspaceContextService = _workspaceContextService;
    this._sessionChangesService = _sessionChangesService;
    this._changesViewService = _changesViewService;
    this._viewDescriptorService = _viewDescriptorService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._lifecycleService = _lifecycleService;
    // [B3] Per-session state, keyed by session resource and persisted to storage.
    this._panelVisibilityBySession = new ResourceMap();
    this._viewStateBySession = new ResourceMap();
    this._workingSets = new ResourceMap();
    /**
     * [B2] Whether the editor part was hidden (e.g. the user closed the Side
     * Panel while keeping editors open) for a session, captured on switch-away so
     * restoring the session's working set does not force the editor part open.
     */
    this._editorPartHiddenBySession = new ResourceMap();
    this._workingSetSequencer = new Sequencer();
    /**
     * `> 0` while the controller is restoring a session's layout on a session
     * switch (editor working set and/or auxiliary bar). Subclasses can use this to
     * re-baseline responsive behaviour instead of reacting to the restore-driven
     * part-visibility changes (see the desktop controller's [D7] sidebar logic).
     */
    this._restoringSessionLayoutDepth = 0;
    /**
     * Fires when a session-switch layout restore fully settles (the restore depth
     * returns to 0, after the — possibly async — working-set apply and aux-bar
     * restore complete). Subclasses reconcile off this instead of reacting to the
     * transient part/editor changes *during* the restore, which race the settled
     * state (e.g. a new session's empty working set closing the docked tabs).
     */
    this._onDidEndSessionLayoutRestore = this._register(new Emitter());
    this.onDidEndSessionLayoutRestore = this._onDidEndSessionLayoutRestore.event;
    /**
     * [D9] `true` between the layout service's side-pane will/did toggle events.
     * The per-session aux-bar capture skips this window, so toggling the whole
     * side pane is never recorded as an explicit aux-bar choice.
     */
    this._togglingSidePane = false;
    this._loadState();
    this._register(this._storageService.onWillSaveState(() => this._saveState()));
    this.activeSessionResourceObs = derivedOpts({
      equalsFn: isEqual
    }, (reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      return activeSession?.resource;
    });
    this.multipleSessionsVisibleObs = derived((reader) => {
      return this._sessionsService.visibleSessions.read(reader).length > 1;
    });
    this._register(autorun((reader) => {
      const visibleSessions = this._sessionsService.visibleSessions.read(reader);
      if (visibleSessions.length <= 1) {
        return;
      }
      for (const session of visibleSessions) {
        if (!session) {
          continue;
        }
        if (this._isViewStatePerSession) {
          this._viewStateBySession.delete(session.resource);
        }
        this._panelVisibilityBySession.delete(session.resource);
      }
    }));
    this._register(autorun((reader) => {
      const activeSessionResource = this.activeSessionResourceObs.read(reader);
      if (this.multipleSessionsVisibleObs.read(reader)) {
        return;
      }
      this._syncPanelVisibility(activeSessionResource);
    }));
    this._register(this._layoutService.onDidChangePartVisibility((e) => {
      if (e.partId !== Parts.PANEL_PART) {
        return;
      }
      if (this.multipleSessionsVisibleObs.get() || this._isCustomViewVisible()) {
        return;
      }
      const activeSession = this._sessionsService.activeSession.get();
      if (activeSession) {
        this._panelVisibilityBySession.set(activeSession.resource, e.visible);
      }
    }));
    this._register(this._layoutService.onDidChangePartVisibility((e) => {
      if (!this._isEditorPartVisibilityPerSession || e.partId !== Parts.EDITOR_PART || this._isRestoringSessionLayout) {
        return;
      }
      if (this.multipleSessionsVisibleObs.get() || this._isCustomViewVisible()) {
        return;
      }
      const activeSession = this._sessionsService.activeSession.get();
      if (activeSession) {
        this._editorPartHiddenBySession.set(activeSession.resource, !e.visible);
      }
    }));
    this._useModalConfigObs = observableConfigValue("workbench.editor.useModal", "all", this._configurationService);
    const workspaceFoldersObs = observableFromEvent(
      this._workspaceContextService.onDidChangeWorkspaceFolders,
      () => this._workspaceContextService.getWorkspace().folders
    );
    const activeSessionForWorkingSet = derivedObservableWithCache(this, (reader, lastValue) => {
      const workspaceFolders = workspaceFoldersObs.read(reader);
      const activeSession = this._sessionsService.activeSession.read(reader);
      const activeSessionWorkspaceUri = activeSession?.workspace.read(reader)?.folders[0]?.workingDirectory;
      if (activeSessionWorkspaceUri && !workspaceFolders.some((folder) => isEqual(folder.uri, activeSessionWorkspaceUri))) {
        return lastValue;
      }
      if (isEqual(activeSession?.resource, lastValue?.resource)) {
        return lastValue;
      }
      return activeSession;
    });
    this._register(runOnChange(this._sessionsService.activeSession, (session, previousSession) => {
      if (previousSession && !isEqual(previousSession.resource, session?.resource) && previousSession.status.read(void 0) !== SessionStatus.Untitled && !this._isRestoringSessionLayout) {
        this._saveWorkingSet(previousSession.resource);
      }
    }));
    this._register(runOnChange(activeSessionForWorkingSet, (session, previousSession) => {
      if (previousSession || session && this._workingSets.has(session.resource)) {
        this._withSessionLayoutRestore(() => this._applyWorkingSet(session?.resource, { isInitialRestore: !previousSession }));
      }
    }));
    this._register(this._sessionManagementService.onDidChangeSessions((e) => {
      const archivedSessions = e.changed.filter((session) => session.isArchived.read(void 0));
      for (const session of [...e.removed, ...archivedSessions]) {
        this._deleteWorkingSet(session.resource);
        this._viewStateBySession.delete(session.resource);
        this._editorPartHiddenBySession.delete(session.resource);
      }
    }));
    this._register(this._sessionManagementService.onDidReplaceSession(({ from, to }) => this._onSessionReplaced(from, to)));
    this._register(this._layoutService.onWillToggleSidePane(() => {
      this._togglingSidePane = true;
    }));
    this._register(this._layoutService.onDidToggleSidePane(({ before, after }) => {
      try {
        const wasVisible = before.editor || before.auxiliaryBar;
        const visible = after.editor || after.auxiliaryBar;
        this._onSidePaneToggled(wasVisible && !visible, before.auxiliaryBar, after.auxiliaryBar);
      } finally {
        this._togglingSidePane = false;
      }
    }));
    this._register(this._registerSidePaneToggleAction());
    this._registerViewStateManagement();
    this._registerAuxiliaryControllers();
  }
  get _isRestoringSessionLayout() {
    return this._restoringSessionLayoutDepth > 0;
  }
  /**
   * Storage key for this controller's per-session layout state. Overridable so a
   * sibling controller (e.g. single-pane) persists to a fresh key instead of
   * sharing the classic desktop state.
   */
  get _layoutStateStorageKey() {
    return SESSION_LAYOUT_STATE_KEY;
  }
  /**
   * Legacy key migrated on first load, or `undefined` to skip migration (a fresh
   * sibling controller has no legacy state to migrate).
   */
  get _legacyWorkingSetsStorageKey() {
    return WORKING_SETS_STORAGE_KEY;
  }
  get _isEditorPartVisibilityPerSession() {
    return true;
  }
  get _isViewStatePerSession() {
    return true;
  }
  /**
   * Hook for a layout controller to create and own its auxiliary controllers.
   * The base implementation does nothing.
   */
  _registerAuxiliaryControllers() {
  }
  /**
   * Whether a custom view currently replaces the sessions grid. The parts it
   * covers are force-hidden, so those transitions must not be captured as the
   * active session's layout preference.
   */
  _isCustomViewVisible() {
    return this._layoutService.isVisible(Parts.CUSTOM_VIEW_GRID_PART);
  }
  /**
   * Registers the `Toggle Side Panel` action (menu item, keybinding, and
   * command-palette entry). The command calls the workbench layout service
   * directly; this controller observes the service's toggle lifecycle events.
   */
  _registerSidePaneToggleAction() {
    return registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.agentToggleSidePanel",
          title: localize2("toggleSecondarySidebar", "Toggle Side Panel"),
          icon: secondarySidebarToggleClosedIcon,
          toggled: {
            condition: ContextKeyExpr.or(AuxiliaryBarVisibleContext, MainEditorAreaVisibleContext),
            icon: secondarySidebarToggleOpenIcon
          },
          metadata: {
            description: localize("openAndCloseSidePanel", "Open/Show and Close/Hide the Side Panel (editor area and auxiliary bar)")
          },
          category: Categories.View,
          f1: true,
          // A quick chat has no side pane (Round 20 hides the empty aux bar
          // and the chat is full-width), so toggling it is meaningless. A custom
          // view replaces the side pane entirely.
          precondition: ContextKeyExpr.and(IsQuickChatSessionContext.negate(), CustomViewVisibleContext.negate()),
          keybinding: {
            weight: KeybindingWeight.SessionsContrib,
            primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyB
          },
          menu: [
            {
              id: Menus.TitleBarSessionMenu,
              group: "navigation",
              order: 11,
              // After Open in VS Code (7), Run Script (8), and Open Terminal (10)
              when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated())
            }
          ]
        });
      }
      run(accessor) {
        const nowVisible = accessor.get(IAgentWorkbenchLayoutService).toggleSidePane();
        logSidePanelToggle(accessor.get(ITelemetryService), nowVisible);
        alert(nowVisible ? localize("sidePanelVisible", "Side Panel shown") : localize("sidePanelHidden", "Side Panel hidden"));
      }
    });
  }
  /**
   * Hook for subclasses to register platform-specific auxiliary bar
   * view-state management. Runs at the end of the base constructor. The base
   * implementation does nothing.
   */
  _registerViewStateManagement() {
  }
  _onSessionReplaced(from, to) {
    if (!this._isEditorPartVisibilityPerSession) {
      return;
    }
    const activeSession = this._sessionsService.activeSession.get();
    const replacedSessionIsActive = isEqual(activeSession?.resource, from.resource) || isEqual(activeSession?.resource, to.resource);
    const editorPartHidden = this._editorPartHiddenBySession.get(from.resource) ?? (replacedSessionIsActive ? !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow) : void 0);
    if (editorPartHidden !== void 0) {
      this._editorPartHiddenBySession.set(to.resource, editorPartHidden);
    }
  }
  /**
   * Whether the auxiliary bar currently has at least one active view container
   * (shown as a tab). Mirrors the workbench's own container-visibility rule
   * (`!hideIfEmpty || isViewContainerActive`, folded into `isViewContainerActive`).
   */
  _hasActiveAuxViewContainers() {
    return this._viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.AuxiliaryBar).some((container) => this._viewsService.isViewContainerActive(container.id));
  }
  /**
   * Records a completed whole-side-pane toggle from the did event's before/after
   * state while {@link _togglingSidePane} is still set.
   */
  _onSidePaneToggled(_collapsed, _previousAuxiliaryBarVisible, _auxiliaryBarVisible) {
  }
  /**
   * [B4] Hook that lets a subclass snapshot the active session's view state when
   * state is about to be persisted. The base implementation does nothing.
   */
  _captureActiveSessionViewState(_sessionResource) {
  }
  /**
   * Runs a session-switch layout restore with {@link _isRestoringSessionLayout}
   * held until the (possibly async) work settles, so part-visibility changes the
   * restore causes can be re-baselined rather than reacted to.
   */
  _withSessionLayoutRestore(work) {
    this._restoringSessionLayoutDepth++;
    const suppression = this._suppressEditorVisibilityDuringRestore();
    let settledSync = true;
    try {
      const result = work();
      if (isThenable(result)) {
        settledSync = false;
        Promise.resolve(result).catch(() => void 0).finally(() => {
          this._endSessionLayoutRestore(suppression);
        });
      }
    } finally {
      if (settledSync) {
        this._endSessionLayoutRestore(suppression);
      }
    }
  }
  _endSessionLayoutRestore(suppression) {
    this._restoringSessionLayoutDepth--;
    suppression?.dispose();
    if (this._restoringSessionLayoutDepth === 0) {
      this._onDidEndSessionLayoutRestore.fire();
    }
  }
  /**
   * Hook to suppress editor-part auto-visibility for the whole session-switch
   * restore. The base restore causes no layout-driven editor closes, so it
   * returns `undefined`.
   */
  _suppressEditorVisibilityDuringRestore() {
    return void 0;
  }
  /**
   * Hook deciding whether {@link _applyWorkingSet} reveals the editor part when
   * restoring a non-empty working set.
   */
  _shouldRevealEditorPartOnApply(editorPartHidden, isModal) {
    return !editorPartHidden && !isModal;
  }
  /**
   * Hook deciding whether {@link _applyWorkingSet} reveals the editor part for an
   * empty working set. The base never reveals in this case.
   */
  _shouldRevealEditorPartForEmptyWorkingSet(_revealEditorPart) {
    return false;
  }
  /**
   * Hook deciding whether {@link _applyWorkingSet} actively hides the editor part
   * when restoring a session that had it hidden. The base never hides (in the
   * classic layout the editor part visibility is not a per-session choice); the
   * single-pane layout restores its docked editor part both ways.
   */
  _shouldHideEditorPartOnApply(_editorPartHidden) {
    return false;
  }
  // --- Editor part reveal ---
  /**
   * Reveals the editor part. Editor working sets are restored into the shared
   * editor area on session switch, which requires the editor part to be visible.
   */
  _revealEditorPartForWorkingSet() {
    this._layoutService.setPartHidden(false, Parts.EDITOR_PART);
  }
  /** Hides the editor part to restore a session that had its docked editor closed. */
  _hideEditorPartForWorkingSet() {
    this._layoutService.setPartHidden(true, Parts.EDITOR_PART);
  }
  // --- Persistence [B3] ---
  _loadState() {
    const raw = this._storageService.get(this._layoutStateStorageKey, StorageScope.WORKSPACE);
    if (raw) {
      try {
        for (const entry of JSON.parse(raw)) {
          const resource = URI.parse(entry.sessionResource);
          if (entry.editorWorkingSet) {
            this._workingSets.set(resource, entry.editorWorkingSet);
          }
          if (this._isEditorPartVisibilityPerSession && entry.editorPartHidden !== void 0) {
            this._editorPartHiddenBySession.set(resource, entry.editorPartHidden);
          }
          if (this._isViewStatePerSession && entry.viewState) {
            this._viewStateBySession.set(resource, entry.viewState);
          }
        }
        return;
      } catch {
        this._storageService.remove(this._layoutStateStorageKey, StorageScope.WORKSPACE);
      }
    }
    const legacyKey = this._legacyWorkingSetsStorageKey;
    if (!legacyKey) {
      return;
    }
    const legacyRaw = this._storageService.get(legacyKey, StorageScope.WORKSPACE);
    if (legacyRaw) {
      try {
        for (const entry of JSON.parse(legacyRaw)) {
          const resource = URI.parse(entry.sessionResource);
          if (entry.editorWorkingSet) {
            this._workingSets.set(resource, entry.editorWorkingSet);
          }
          if (entry.auxiliaryBarState) {
            this._viewStateBySession.set(resource, {
              auxiliaryBarVisible: entry.auxiliaryBarState.visible,
              auxiliaryBarActiveViewContainerId: entry.auxiliaryBarState.activeViewContainerId
            });
          }
        }
      } catch {
      }
      this._storageService.remove(legacyKey, StorageScope.WORKSPACE);
    }
  }
  _saveState() {
    const activeSession = this._sessionsService.activeSession.get();
    const multipleVisible = this._sessionsService.visibleSessions.get().length > 1;
    if (activeSession && !multipleVisible && activeSession.status.read(void 0) !== SessionStatus.Untitled) {
      this._captureActiveSessionViewState(activeSession.resource);
    }
    if (activeSession && activeSession.status.read(void 0) !== SessionStatus.Untitled) {
      this._saveWorkingSet(activeSession.resource);
    }
    const allResources = new ResourceMap();
    this._workingSets.forEach((_, r) => allResources.set(r, true));
    if (this._isViewStatePerSession) {
      this._viewStateBySession.forEach((_, r) => allResources.set(r, true));
    }
    if (this._isEditorPartVisibilityPerSession) {
      this._editorPartHiddenBySession.forEach((_, r) => allResources.set(r, true));
    }
    if (allResources.size === 0) {
      this._storageService.remove(this._layoutStateStorageKey, StorageScope.WORKSPACE);
      return;
    }
    const entries = [];
    allResources.forEach((_, resource) => {
      entries.push({
        sessionResource: resource.toString(),
        editorWorkingSet: this._workingSets.get(resource),
        viewState: this._isViewStatePerSession ? this._viewStateBySession.get(resource) : void 0,
        editorPartHidden: this._isEditorPartVisibilityPerSession ? this._editorPartHiddenBySession.get(resource) : void 0
      });
    });
    this._storageService.store(this._layoutStateStorageKey, JSON.stringify(entries), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  // --- Panel [B1] ---
  _syncPanelVisibility(sessionResource) {
    if (!sessionResource) {
      this._layoutService.setPartHidden(true, Parts.PANEL_PART);
      return;
    }
    const wasVisible = this._panelVisibilityBySession.get(sessionResource);
    this._layoutService.setPartHidden(wasVisible !== true, Parts.PANEL_PART);
  }
  // --- Editor working sets [B2] ---
  async _applyWorkingSet(sessionResource, options) {
    const preserveFocus = true;
    const workingSet = sessionResource ? this._workingSets.get(sessionResource) ?? "empty" : "empty";
    return this._workingSetSequencer.queue(async () => {
      if (this._sessionsService.visibleSessions.get().length > 1) {
        const suppression = this._layoutService.suppressEditorPartAutoVisibility();
        try {
          await this._editorGroupsService.applyWorkingSet(workingSet, { preserveFocus });
        } finally {
          suppression.dispose();
        }
        return;
      }
      const isModal = this._useModalConfigObs.get() === "all";
      const editorPartHidden = this._isEditorPartVisibilityPerSession && sessionResource ? this._editorPartHiddenBySession.get(sessionResource) === true : false;
      const revealEditorPart = !options?.isInitialRestore && this._shouldRevealEditorPartOnApply(editorPartHidden, isModal);
      const hideEditorPart = !options?.isInitialRestore && !revealEditorPart && this._shouldHideEditorPartOnApply(editorPartHidden);
      if (workingSet === "empty") {
        await this._editorGroupsService.applyWorkingSet(workingSet, { preserveFocus });
        if (this._shouldRevealEditorPartForEmptyWorkingSet(revealEditorPart) && !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
          this._revealEditorPartForWorkingSet();
        } else if (hideEditorPart && this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
          this._hideEditorPartForWorkingSet();
        }
        return;
      }
      if (options?.isInitialRestore) {
        const suppression = this._layoutService.suppressEditorPartAutoVisibility();
        try {
          await this._editorGroupsService.applyWorkingSet(workingSet, { preserveFocus });
        } finally {
          suppression.dispose();
        }
        if (this._shouldHideEditorPartOnApply(editorPartHidden) && this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
          this._hideEditorPartForWorkingSet();
        }
        return;
      }
      if (revealEditorPart && !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this._revealEditorPartForWorkingSet();
      } else if (hideEditorPart && this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this._hideEditorPartForWorkingSet();
      }
      const result = await this._editorGroupsService.applyWorkingSet(workingSet, { preserveFocus });
      if (revealEditorPart && result && !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this._revealEditorPartForWorkingSet();
      } else if (hideEditorPart && this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this._hideEditorPartForWorkingSet();
      }
    });
  }
  _saveWorkingSet(sessionResource) {
    this._deleteWorkingSet(sessionResource);
    if (this._editorService.visibleEditors.length > 0) {
      const workingSetName = `session-working-set:${sessionResource.toString()}`;
      const workingSet = this._editorGroupsService.saveWorkingSet(workingSetName);
      this._workingSets.set(sessionResource, workingSet);
    }
  }
  _deleteWorkingSet(sessionResource) {
    const existingWorkingSet = this._workingSets.get(sessionResource);
    if (!existingWorkingSet) {
      return;
    }
    this._editorGroupsService.deleteWorkingSet(existingWorkingSet);
    this._workingSets.delete(sessionResource);
  }
};
BaseLayoutController = __decorateClass([
  __decorateParam(0, IAgentWorkbenchLayoutService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IViewsService),
  __decorateParam(4, IPaneCompositePartService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IEditorGroupsService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, ISessionChangesService),
  __decorateParam(11, IChangesViewService),
  __decorateParam(12, IViewDescriptorService),
  __decorateParam(13, IContextKeyService),
  __decorateParam(14, IInstantiationService),
  __decorateParam(15, ILifecycleService)
], BaseLayoutController);
export {
  BaseLayoutController
};
