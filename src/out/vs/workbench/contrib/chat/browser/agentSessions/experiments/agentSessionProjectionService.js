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
import "./media/agentsessionprojection.css";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IEditorGroupsService } from "../../../../../services/editor/common/editorGroupsService.js";
import { IEditorService, MODAL_GROUP } from "../../../../../services/editor/common/editorService.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { isSessionInProgressStatus } from "../agentSessionsModel.js";
import { IChatWidgetService } from "../../chat.js";
import { AgentSessionProviders } from "../agentSessions.js";
import { IChatSessionsService } from "../../../common/chatSessionsService.js";
import { IWorkbenchLayoutService, Parts } from "../../../../../services/layout/browser/layoutService.js";
import { ACTION_ID_NEW_CHAT } from "../../actions/chatActions.js";
import { IChatEditingService, ModifiedFileEntryState } from "../../../common/editing/chatEditingService.js";
import { IAgentTitleBarStatusService } from "./agentTitleBarStatusService.js";
import { inAgentSessionProjection } from "./agentSessionProjection.js";
import { ChatConfiguration } from "../../../common/constants.js";
import { IAgentSessionsService } from "../agentSessionsService.js";
const AGENT_SESSION_PROJECTION_ENABLED_PROVIDERS = new Set(Object.values(AgentSessionProviders));
const IAgentSessionProjectionService = createDecorator("agentSessionProjectionService");
let AgentSessionProjectionService = class extends Disposable {
  constructor(contextKeyService, configurationService, editorGroupsService, editorService, logService, chatWidgetService, chatSessionsService, layoutService, commandService, chatEditingService, agentTitleBarStatusService, agentSessionsService) {
    super();
    this.configurationService = configurationService;
    this.editorGroupsService = editorGroupsService;
    this.editorService = editorService;
    this.logService = logService;
    this.chatWidgetService = chatWidgetService;
    this.chatSessionsService = chatSessionsService;
    this.layoutService = layoutService;
    this.commandService = commandService;
    this.chatEditingService = chatEditingService;
    this.agentTitleBarStatusService = agentTitleBarStatusService;
    this.agentSessionsService = agentSessionsService;
    this._isActive = false;
    /** Prevents re-entrant exits and enter-on-exit races */
    this._isExiting = false;
    /** Prevents checkForEmptyEditors from exiting during session swaps */
    this._isSwappingSessions = false;
    this._onDidChangeProjectionMode = this._register(new Emitter());
    this.onDidChangeProjectionMode = this._onDidChangeProjectionMode.event;
    this._onDidChangeActiveSession = this._register(new Emitter());
    this.onDidChangeActiveSession = this._onDidChangeActiveSession.event;
    /** Working sets per session, keyed by session resource URI string */
    this._sessionWorkingSets = /* @__PURE__ */ new Map();
    /** Whether the auxiliary bar was maximized when entering projection mode */
    this._wasAuxiliaryBarMaximized = false;
    this._inProjectionModeContextKey = inAgentSessionProjection.bindTo(contextKeyService);
    this._register(this.editorService.onDidCloseEditor(() => this._checkForEmptyEditors()));
    this._register(this.agentSessionsService.model.onDidChangeSessions(() => this._checkForInProgressSession()));
  }
  get isActive() {
    return this._isActive;
  }
  get activeSession() {
    return this._activeSession;
  }
  _isEnabled() {
    return this.configurationService.getValue(ChatConfiguration.AgentSessionProjectionEnabled) === true;
  }
  _checkForEmptyEditors() {
    if (!this._isActive || this._isExiting || this._isSwappingSessions) {
      return;
    }
    const hasVisibleEditors = this.editorService.visibleEditors.length > 0;
    if (!hasVisibleEditors) {
      this.logService.trace("[AgentSessionProjection] All editors closed, exiting projection mode");
      this.exitProjection();
    }
  }
  _checkForInProgressSession() {
    if (!this._isActive || !this._activeSession) {
      return;
    }
    const updatedSession = this.agentSessionsService.getSession(this._activeSession.resource);
    if (!updatedSession) {
      return;
    }
    if (isSessionInProgressStatus(updatedSession.status)) {
      this.logService.trace("[AgentSessionProjection] Active session transitioned to in-progress, exiting projection mode");
      this.exitProjection({ startNewChat: false });
    }
  }
  /**
   * Opens a session in the chat panel without entering projection mode.
   */
  async _openSessionInChatPanel(session) {
    session.setRead(true);
    await this.chatSessionsService.activateChatSessionItemProvider(session.providerType);
    await this.chatWidgetService.openSession(session.resource, void 0, {
      title: { preferred: session.label },
      revealIfOpened: true
    });
  }
  /**
   * Open the session's files in a multi-diff editor.
   * @returns true if any files were opened, false if nothing to display
   */
  async _openSessionFiles(session) {
    this.logService.trace(`[AgentSessionProjection] Opening files for session '${session.label}'`, {
      hasChanges: !!session.changes,
      isArray: Array.isArray(session.changes),
      changeCount: Array.isArray(session.changes) ? session.changes.length : 0
    });
    if (session.changes && Array.isArray(session.changes) && session.changes.length > 0) {
      const diffResources = session.changes.filter((change) => change.originalUri).map((change) => ({
        originalUri: change.originalUri,
        modifiedUri: change.modifiedUri
      }));
      this.logService.trace(`[AgentSessionProjection] Found ${diffResources.length} files with diffs to display`);
      if (diffResources.length > 0) {
        await this.editorService.openEditor({
          multiDiffSource: session.resource.with({ scheme: session.resource.scheme + "-agent-session-projection" }),
          resources: diffResources.map((dr) => ({
            original: { resource: dr.originalUri },
            modified: { resource: dr.modifiedUri }
          })),
          label: localize("agentSessionProjection.changes.title", "{0} - All Changes", session.label)
        }, MODAL_GROUP);
        this.logService.trace(`[AgentSessionProjection] Multi-diff editor opened successfully in modal view`);
        const sessionKey = session.resource.toString();
        const newWorkingSet = this.editorGroupsService.saveWorkingSet(`agent-session-projection-${sessionKey}`);
        this._sessionWorkingSets.set(sessionKey, newWorkingSet);
        return true;
      } else {
        this.logService.trace(`[AgentSessionProjection] No files with diffs to display (all changes missing originalUri)`);
        return false;
      }
    } else {
      this.logService.trace(`[AgentSessionProjection] Session has no changes to display`);
      return false;
    }
  }
  async enterProjection(session) {
    if (!this._isEnabled()) {
      this.logService.trace("[AgentSessionProjection] Agent Session Projection is disabled");
      return;
    }
    if (!AGENT_SESSION_PROJECTION_ENABLED_PROVIDERS.has(session.providerType)) {
      this.logService.trace(`[AgentSessionProjection] Provider type '${session.providerType}' does not support agent session projection`);
      return;
    }
    const isAuxBarMaximized = this.layoutService.isAuxiliaryBarMaximized();
    this.logService.trace("[AgentSessionProjection] enterProjection auxiliary bar state", {
      isAuxiliaryBarMaximized: isAuxBarMaximized
    });
    if (isSessionInProgressStatus(session.status)) {
      this.logService.trace("[AgentSessionProjection] Session is in progress, opening chat without projection mode");
      if (this._isActive) {
        await this.exitProjection({ startNewChat: false });
      }
      await this._openSessionInChatPanel(session);
      return;
    }
    let hasUndecidedChanges = true;
    let editingSessionExists = true;
    if (session.providerType === AgentSessionProviders.Local) {
      const editingSession = this.chatEditingService.getEditingSession(session.resource);
      editingSessionExists = !!editingSession;
      if (editingSession) {
        hasUndecidedChanges = editingSession.entries.get().some((e) => e.state.get() === ModifiedFileEntryState.Modified);
        if (!hasUndecidedChanges) {
          this.logService.trace("[AgentSessionProjection] Local session has no undecided changes, opening chat without projection mode");
        }
      } else {
        hasUndecidedChanges = false;
        this.logService.trace("[AgentSessionProjection] Local session has no editing session yet");
      }
    }
    if (!hasUndecidedChanges && this._isActive && editingSessionExists) {
      this.logService.trace("[AgentSessionProjection] Switching to session without changes while in projection mode, exiting projection");
      await this.exitProjection({ startNewChat: false });
      await this._openSessionInChatPanel(session);
      return;
    }
    if (!hasUndecidedChanges && this._isActive && !editingSessionExists) {
      this.logService.trace("[AgentSessionProjection] Switching to session without editing session while in projection mode, staying in projection");
      await this._openSessionInChatPanel(session);
      return;
    }
    if (hasUndecidedChanges) {
      if (!this._isActive && !this._preProjectionWorkingSet) {
        const visibleEditorsBefore = this.editorService.visibleEditors.length;
        this._preProjectionWorkingSet = this.editorGroupsService.saveWorkingSet("agent-session-projection-backup");
        this.logService.trace("[AgentSessionProjection] saved pre-projection working set", {
          id: this._preProjectionWorkingSet.id,
          visibleEditorsBefore
        });
      }
      const isSwapping = this._isActive && this._activeSession;
      if (isSwapping) {
        this._isSwappingSessions = true;
        const previousSessionKey = this._activeSession.resource.toString();
        const previousWorkingSet = this.editorGroupsService.saveWorkingSet(`agent-session-projection-${previousSessionKey}`);
        this._sessionWorkingSets.set(previousSessionKey, previousWorkingSet);
      }
      try {
        let filesOpened = false;
        if (session.providerType === AgentSessionProviders.Local) {
          filesOpened = true;
        } else {
          filesOpened = await this._openSessionFiles(session);
        }
        if (!filesOpened) {
          this.logService.trace("[AgentSessionProjection] No files to display, opening chat without projection mode");
          if (!this._isActive && this._preProjectionWorkingSet) {
            await this.editorGroupsService.applyWorkingSet(this._preProjectionWorkingSet);
            this.editorGroupsService.deleteWorkingSet(this._preProjectionWorkingSet);
            this._preProjectionWorkingSet = void 0;
          }
        } else {
          const wasActive = this._isActive;
          this._isActive = true;
          this._activeSession = session;
          this._inProjectionModeContextKey.set(true);
          this.layoutService.mainContainer.classList.add("agent-session-projection-active");
          if (!wasActive) {
            this._wasAuxiliaryBarMaximized = isAuxBarMaximized;
            this.logService.trace("[AgentSessionProjection] captured auxiliary bar maximized state", {
              wasAuxiliaryBarMaximized: this._wasAuxiliaryBarMaximized
            });
          }
          this.agentTitleBarStatusService.enterSessionMode(session.resource, session.label);
          if (!wasActive) {
            this._onDidChangeProjectionMode.fire(true);
          }
          this._onDidChangeActiveSession.fire(session);
        }
      } finally {
        this._isSwappingSessions = false;
      }
    }
    await this._openSessionInChatPanel(session);
    if (session.providerType === AgentSessionProviders.Local && hasUndecidedChanges) {
      await this.commandService.executeCommand("chatEditing.viewChanges");
    }
    if (this._wasAuxiliaryBarMaximized) {
      this.logService.trace("[AgentSessionProjection] hiding maximized auxiliary bar during projection");
      this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
    }
  }
  async exitProjection(options) {
    if (!this._isActive || this._isExiting) {
      return;
    }
    const startNewChat = options?.startNewChat ?? true;
    this._isExiting = true;
    this.logService.trace("[AgentSessionProjection] exitProjection start", {
      hasPreProjectionWorkingSet: !!this._preProjectionWorkingSet,
      activeSession: this._activeSession?.label,
      startNewChat,
      wasAuxiliaryBarMaximized: this._wasAuxiliaryBarMaximized
    });
    if (this._activeSession) {
      const sessionKey = this._activeSession.resource.toString();
      const workingSet = this.editorGroupsService.saveWorkingSet(`agent-session-projection-${sessionKey}`);
      this._sessionWorkingSets.set(sessionKey, workingSet);
    }
    for (const group of this.editorGroupsService.groups) {
      await group.closeAllEditors();
    }
    this.logService.trace("[AgentSessionProjection] exitProjection closed editors", { visible: this.editorService.visibleEditors.length });
    if (this._preProjectionWorkingSet) {
      await this.editorGroupsService.applyWorkingSet(this._preProjectionWorkingSet);
      this.logService.trace("[AgentSessionProjection] exitProjection applied pre-projection working set", {
        visible: this.editorService.visibleEditors.length,
        id: this._preProjectionWorkingSet.id
      });
      this.editorGroupsService.deleteWorkingSet(this._preProjectionWorkingSet);
      this._preProjectionWorkingSet = void 0;
    } else {
      await this.editorGroupsService.applyWorkingSet("empty", { preserveFocus: true });
      this.logService.trace("[AgentSessionProjection] exitProjection no pre-working set, applied empty");
    }
    this._isActive = false;
    this._activeSession = void 0;
    this._inProjectionModeContextKey.set(false);
    const shouldRestoreMaximized = this._wasAuxiliaryBarMaximized;
    this._wasAuxiliaryBarMaximized = false;
    this.layoutService.mainContainer.classList.remove("agent-session-projection-active");
    this.agentTitleBarStatusService.exitSessionMode();
    this._onDidChangeProjectionMode.fire(false);
    this._onDidChangeActiveSession.fire(void 0);
    if (startNewChat) {
      await this.commandService.executeCommand(ACTION_ID_NEW_CHAT);
    }
    if (shouldRestoreMaximized) {
      this.logService.trace("[AgentSessionProjection] restoring auxiliary bar maximized state");
      this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
      await this.commandService.executeCommand("workbench.action.maximizeAuxiliaryBar");
    }
    this.logService.trace("[AgentSessionProjection] exitProjection complete");
    this._isExiting = false;
  }
};
AgentSessionProjectionService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEditorGroupsService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, IChatSessionsService),
  __decorateParam(7, IWorkbenchLayoutService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, IChatEditingService),
  __decorateParam(10, IAgentTitleBarStatusService),
  __decorateParam(11, IAgentSessionsService)
], AgentSessionProjectionService);
export {
  AGENT_SESSION_PROJECTION_ENABLED_PROVIDERS,
  AgentSessionProjectionService,
  IAgentSessionProjectionService
};
