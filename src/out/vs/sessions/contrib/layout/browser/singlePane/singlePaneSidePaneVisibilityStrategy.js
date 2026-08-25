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
import { mainWindow } from "../../../../../base/browser/window.js";
import { Event } from "../../../../../base/common/event.js";
import { autorun, observableFromEvent } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { StorageScope, StorageTarget, IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IEditorGroupsService } from "../../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../../workbench/services/editor/common/editorService.js";
import { BrowserEditorInput } from "../../../../../workbench/contrib/browserView/common/browserEditorInput.js";
import { Parts } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { IAgentWorkbenchLayoutService } from "../../../../browser/workbench.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { SinglePaneLayoutStrategy } from "./singlePaneLayoutStrategy.js";
var SessionVisibilityProfile = /* @__PURE__ */ ((SessionVisibilityProfile2) => {
  SessionVisibilityProfile2[SessionVisibilityProfile2["New"] = 0] = "New";
  SessionVisibilityProfile2[SessionVisibilityProfile2["Existing"] = 1] = "Existing";
  return SessionVisibilityProfile2;
})(SessionVisibilityProfile || {});
var PendingAuxiliaryBarRestore = /* @__PURE__ */ ((PendingAuxiliaryBarRestore2) => {
  PendingAuxiliaryBarRestore2[PendingAuxiliaryBarRestore2["WaitingForEmptyGroup"] = 0] = "WaitingForEmptyGroup";
  PendingAuxiliaryBarRestore2[PendingAuxiliaryBarRestore2["WaitingForContent"] = 1] = "WaitingForContent";
  return PendingAuxiliaryBarRestore2;
})(PendingAuxiliaryBarRestore || {});
const SINGLE_PANE_VISIBILITY_STATE_KEY = "sessions.singlePane.sidePaneVisibility";
const DEFAULT_NEW_SESSION_VISIBILITY_STATE = {
  editorVisible: false,
  auxiliaryBarVisible: true
};
const DEFAULT_EXISTING_SESSION_VISIBILITY_STATE = {
  editorVisible: true,
  auxiliaryBarVisible: false
};
let SinglePaneSidePaneVisibilityStrategy = class extends SinglePaneLayoutStrategy {
  constructor(ctx, _layoutService, _sessionsService, _storageService, _editorService, _editorGroupsService) {
    super(ctx);
    this._layoutService = _layoutService;
    this._sessionsService = _sessionsService;
    this._storageService = _storageService;
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    this._profiles = {
      newSession: DEFAULT_NEW_SESSION_VISIBILITY_STATE,
      existingSession: DEFAULT_EXISTING_SESSION_VISIBILITY_STATE
    };
    this._applyingProfile = false;
    this._loadState();
    const mainPartEmptyObs = observableFromEvent(
      this,
      Event.any(this._editorService.onDidActiveEditorChange, this._editorService.onDidEditorsChange, this._editorService.onDidCloseEditor),
      () => this._isMainPartEmpty()
    );
    let activeProfile;
    let quickChatActive = false;
    let initialized = false;
    let multipleSessionsWereVisible = false;
    let previousIsCreated;
    let previousSession;
    this._register(autorun((reader) => {
      const multipleSessionsVisible = this._ctx.multipleSessionsVisibleObs.read(reader);
      if (multipleSessionsVisible) {
        this._pendingAuxiliaryBarRestore = void 0;
        multipleSessionsWereVisible = true;
        const activeSession2 = this._sessionsService.activeSession.read(reader);
        const isQuickChat2 = activeSession2?.isQuickChat?.read(reader) ?? false;
        const workspace = activeSession2?.workspace.read(reader);
        if (activeSession2 && !isQuickChat2 && workspace) {
          const profile = activeSession2.isCreated.read(reader) ? 1 /* Existing */ : 0 /* New */;
          this._ctx.withSessionLayoutRestore(() => this._revealState(this._getProfile(profile)));
        }
        return;
      }
      const restoreAfterMultipleSessions = multipleSessionsWereVisible;
      multipleSessionsWereVisible = false;
      const activeSession = this._sessionsService.activeSession.read(reader);
      if (!activeSession) {
        return;
      }
      const isQuickChat = activeSession.isQuickChat?.read(reader) ?? false;
      const mainPartEmpty = mainPartEmptyObs.read(reader);
      if (isQuickChat) {
        const enteringQuickChat = !quickChatActive;
        const previousProfile = activeProfile;
        const switchingFromWorkspaceSession = enteringQuickChat && previousProfile !== void 0;
        this._pendingAuxiliaryBarRestore = void 0;
        quickChatActive = true;
        initialized = true;
        this._ctx.withSessionLayoutRestore(() => this._hideForQuickChat(switchingFromWorkspaceSession || mainPartEmpty));
        return;
      }
      const isCreated = activeSession.isCreated.read(reader);
      const sessionChanged = previousSession !== void 0 && !isEqual(previousSession.resource, activeSession.resource);
      const nextProfile = isCreated ? 1 /* Existing */ : 0 /* New */;
      const isSubmit = !quickChatActive && previousIsCreated === false && isCreated && (previousSession === activeSession || previousSession?.isCreated.read(void 0) === true);
      if (isSubmit) {
        this._captureProfile(0 /* New */);
        this._captureProfile(1 /* Existing */);
      }
      if (!isSubmit && (!initialized || restoreAfterMultipleSessions || quickChatActive || activeProfile !== nextProfile || sessionChanged)) {
        const profile = this._getProfile(nextProfile);
        this._pendingAuxiliaryBarRestore = profile.auxiliaryBarVisible ? mainPartEmpty ? 1 /* WaitingForContent */ : 0 /* WaitingForEmptyGroup */ : void 0;
        this._applyingProfile = true;
        try {
          this._ctx.withSessionLayoutRestore(() => this._applyState(profile));
        } finally {
          this._applyingProfile = false;
        }
      } else if (this._pendingAuxiliaryBarRestore === 0 /* WaitingForEmptyGroup */ && mainPartEmpty) {
        this._pendingAuxiliaryBarRestore = 1 /* WaitingForContent */;
      } else if (this._pendingAuxiliaryBarRestore === 1 /* WaitingForContent */ && !mainPartEmpty) {
        this._pendingAuxiliaryBarRestore = void 0;
        this._ctx.withSessionLayoutRestore(() => this._layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART));
      }
      previousIsCreated = isCreated;
      previousSession = activeSession;
      activeProfile = nextProfile;
      quickChatActive = false;
      initialized = true;
    }));
    this._register(this._ctx.onDidEndSessionLayoutRestore(() => {
      if (this._applyingProfile || this._pendingAuxiliaryBarRestore !== 0 /* WaitingForEmptyGroup */) {
        return;
      }
      if (this._ctx.multipleSessionsVisibleObs.get()) {
        this._pendingAuxiliaryBarRestore = void 0;
        return;
      }
      const activeSession = this._sessionsService.activeSession.get();
      if (!activeSession || activeSession.isQuickChat?.get()) {
        this._pendingAuxiliaryBarRestore = void 0;
        return;
      }
      this._pendingAuxiliaryBarRestore = void 0;
      const profile = activeSession.isCreated.get() ? 1 /* Existing */ : 0 /* New */;
      if (this._getProfile(profile).auxiliaryBarVisible) {
        this._applyState(this._getProfile(profile));
      }
    }));
    this._register(this._layoutService.onDidChangePartVisibility((e) => {
      if (e.partId !== Parts.EDITOR_PART && e.partId !== Parts.AUXILIARYBAR_PART) {
        return;
      }
      if (this._ctx.isRestoringSessionLayout) {
        return;
      }
      if (this._ctx.multipleSessionsVisibleObs.get()) {
        return;
      }
      const activeSession = this._sessionsService.activeSession.get();
      if (!activeSession || activeSession.isQuickChat?.get() || this._layoutService.isEditorMaximized() || this._layoutService.isVisible(Parts.CUSTOM_VIEW_GRID_PART)) {
        return;
      }
      if (e.partId === Parts.AUXILIARYBAR_PART && !e.visible && this._editorService.activeEditor instanceof BrowserEditorInput) {
        return;
      }
      if (e.partId === Parts.AUXILIARYBAR_PART && !e.visible && this._pendingAuxiliaryBarRestore !== void 0) {
        return;
      }
      const profile = activeSession.isCreated.get() ? 1 /* Existing */ : 0 /* New */;
      this._captureProfile(profile);
    }));
  }
  _captureProfile(profile) {
    const state = {
      editorVisible: this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow),
      auxiliaryBarVisible: this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)
    };
    this._setProfile(profile, state);
  }
  _getProfile(profile) {
    return profile === 0 /* New */ ? this._profiles.newSession : this._profiles.existingSession;
  }
  _setProfile(profile, state) {
    this._profiles = profile === 0 /* New */ ? { ...this._profiles, newSession: state } : { ...this._profiles, existingSession: state };
    this._storageService.store(SINGLE_PANE_VISIBILITY_STATE_KEY, JSON.stringify(this._profiles), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  _hideForQuickChat(hideEditor) {
    if (hideEditor && this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
      this._layoutService.setPartHidden(true, Parts.EDITOR_PART);
    }
    if (this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
      this._layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
    }
  }
  _applyState(state) {
    const suppression = this._layoutService.suppressEditorPartAutoVisibility();
    try {
      if (!state.editorVisible && this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this._layoutService.setPartHidden(true, Parts.EDITOR_PART);
      }
      if (!state.auxiliaryBarVisible && this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
        this._layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
      }
      if (state.auxiliaryBarVisible && !this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
        this._layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
      }
      if (state.editorVisible && !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this._layoutService.setPartHidden(false, Parts.EDITOR_PART);
      }
    } finally {
      suppression.dispose();
    }
  }
  _revealState(state) {
    const suppression = this._layoutService.suppressEditorPartAutoVisibility();
    try {
      if (state.auxiliaryBarVisible && !this._layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
        this._layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
      }
      if (state.editorVisible && !this._layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this._layoutService.setPartHidden(false, Parts.EDITOR_PART);
      }
    } finally {
      suppression.dispose();
    }
  }
  _isMainPartEmpty() {
    return this._editorGroupsService.mainPart.groups.every((group) => group.isEmpty);
  }
  _loadState() {
    const raw = this._storageService.get(SINGLE_PANE_VISIBILITY_STATE_KEY, StorageScope.WORKSPACE);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (this._isVisibilityState(parsed?.newSession) && this._isVisibilityState(parsed?.existingSession)) {
        this._profiles = {
          newSession: parsed.newSession,
          existingSession: parsed.existingSession
        };
      } else if (this._isVisibilityState(parsed)) {
        this._profiles = { ...this._profiles, existingSession: parsed };
      } else {
        this._storageService.remove(SINGLE_PANE_VISIBILITY_STATE_KEY, StorageScope.WORKSPACE);
      }
    } catch {
      this._storageService.remove(SINGLE_PANE_VISIBILITY_STATE_KEY, StorageScope.WORKSPACE);
    }
  }
  _isVisibilityState(value) {
    return typeof value?.editorVisible === "boolean" && typeof value.auxiliaryBarVisible === "boolean";
  }
};
SinglePaneSidePaneVisibilityStrategy = __decorateClass([
  __decorateParam(1, IAgentWorkbenchLayoutService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IEditorGroupsService)
], SinglePaneSidePaneVisibilityStrategy);
export {
  SinglePaneSidePaneVisibilityStrategy
};
