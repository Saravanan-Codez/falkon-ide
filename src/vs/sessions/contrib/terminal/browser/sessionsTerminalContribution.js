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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived } from "../../../../base/common/observable.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { AGENT_HOST_SCHEME, fromAgentHostUri } from "../../../../platform/agentHost/common/agentHostUri.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { getWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IAgentHostTerminalService } from "../../../../workbench/contrib/terminal/browser/agentHostTerminalService.js";
import { ITerminalService } from "../../../../workbench/contrib/terminal/browser/terminal.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { IPathService } from "../../../../workbench/services/path/common/pathService.js";
import { Menus } from "../../../browser/menus.js";
import { isAgentHostProvider, LOCAL_AGENT_HOST_PROVIDER_ID } from "../../../common/agentHostSessionsProvider.js";
import { SessionsWelcomeVisibleContext, IsPhoneLayoutContext, CustomViewVisibleContext } from "../../../common/contextkeys.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { IsAuxiliaryWindowContext } from "../../../../workbench/common/contextkeys.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { logSessionsInteraction } from "../../../common/sessionsTelemetry.js";
import { IViewsService } from "../../../../workbench/services/views/common/viewsService.js";
import { ITerminalProfileService, TERMINAL_VIEW_ID } from "../../../../workbench/contrib/terminal/common/terminal.js";
import { IWorkbenchLayoutService, Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { ISessionTaskRunnerRegistry } from "../../chat/browser/sessionTaskRunner.js";
import { AgentHostSessionTaskRunner } from "./agentHostSessionTaskRunner.js";
const SessionsTerminalViewVisibleContext = new RawContextKey("sessionsTerminalViewVisible", false);
function getSessionTerminalInfo(session, reader) {
  if (!session) {
    return void 0;
  }
  const workspace = reader ? session.workspace.read(reader) : session.workspace.get();
  if (workspace?.isVirtualWorkspace !== false) {
    return void 0;
  }
  const folder = workspace.folders[0];
  const cwd = folder?.workingDirectory;
  if (!cwd) {
    return void 0;
  }
  if (cwd.scheme === AGENT_HOST_SCHEME) {
    return { cwd: fromAgentHostUri(cwd), agentHostCwd: cwd };
  }
  return { cwd };
}
let SessionsTerminalContribution = class extends Disposable {
  constructor(_sessionsManagementService, _sessionsService, _sessionsProvidersService, _terminalService, _agentHostTerminalService, _logService, _pathService, _terminalProfileService, viewsService, contextKeyService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._terminalService = _terminalService;
    this._agentHostTerminalService = _agentHostTerminalService;
    this._logService = _logService;
    this._pathService = _pathService;
    this._terminalProfileService = _terminalProfileService;
    this._sessionTerminals = /* @__PURE__ */ new Map();
    this._standaloneTerminalIds = /* @__PURE__ */ new Set();
    /** In-flight terminal work for drafts, retained only until each operation settles. */
    this._pendingTerminalOperations = /* @__PURE__ */ new Map();
    /**
     * Session ids already processed as archived. The archive cleanup runs only
     * on the not-archived → archived transition: the provider keeps archived
     * sessions cached and re-emits them in `changed` on every sync, so acting on
     * the current archived state would re-run the cwd cleanup each time and sweep
     * terminals the user opened afterwards. See #313510, #318645.
     */
    this._archivedSessionIds = /* @__PURE__ */ new Set();
    for (const session of this._sessionsManagementService.getSessions()) {
      if (session.isArchived.get()) {
        this._archivedSessionIds.add(session.sessionId);
      }
    }
    const profileOverride = derived((reader) => {
      const session = this._sessionsService.activeSession.read(reader);
      if (!session || session.providerId === LOCAL_AGENT_HOST_PROVIDER_ID) {
        return;
      }
      const address = this._getSessionAgentHostAddress(session);
      if (!address) {
        return;
      }
      const profiles = this._agentHostTerminalService.profiles.read(reader);
      return profiles.find((p) => p.address === address) ?? this._agentHostTerminalService.getProfileForConnection(address);
    });
    this._register(autorun((reader) => {
      const profile = profileOverride.read(reader);
      if (profile) {
        reader.store.add(this._terminalProfileService.overrideDefaultProfile(
          profile.extensionIdentifier,
          profile.profileId
        ));
      }
    }));
    this._register(autorun((reader) => {
      const session = this._sessionsService.activeSession.read(reader);
      if (session?.loading.read(reader)) {
        this._agentHostTerminalService.setDefaultCwd(void 0);
        return;
      }
      const info = getSessionTerminalInfo(session, reader);
      this._agentHostTerminalService.setDefaultCwd(info?.cwd);
    }));
    const terminalViewVisible = SessionsTerminalViewVisibleContext.bindTo(contextKeyService);
    terminalViewVisible.set(viewsService.isViewVisible(TERMINAL_VIEW_ID));
    this._register(viewsService.onDidChangeViewVisibility((e) => {
      if (e.id === TERMINAL_VIEW_ID) {
        terminalViewVisible.set(e.visible);
      }
    }));
    this._register(autorun((reader) => {
      const session = this._sessionsService.activeSession.read(reader);
      if (session?.loading.read(reader)) {
        this._activeKey = void 0;
        this._activeSessionId = void 0;
        return;
      }
      this._onActiveSessionChanged(session);
    }));
    this._register(this._sessionsManagementService.onDidReplaceNewDraftSession(({ from, to }) => {
      this._onDidReplaceNewDraftSession(from, to);
    }));
    this._register(this._sessionsManagementService.onDidReplaceSession(({ from, to }) => {
      this._transferTerminals(from.sessionId, to.sessionId);
    }));
    this._register(this._terminalService.onDidDisposeInstance((instance) => {
      this._removeTerminalFromTrackedSessions(instance.instanceId);
      this._standaloneTerminalIds.delete(instance.instanceId);
    }));
    this._register(this._terminalService.onDidCreateInstance((instance) => {
      if (instance.shellLaunchConfig.hideFromUser) {
        return;
      }
      if (instance.shellLaunchConfig.attachPersistentProcess && this._activeKey) {
        instance.getInitialCwd().then((cwd) => {
          if (cwd.toLowerCase() !== this._activeKey) {
            const availableInstance = this._getAvailableTerminal(instance, `hide restored terminal for ${cwd}`);
            if (!availableInstance) {
              return;
            }
            this._terminalService.moveToBackground(availableInstance);
            this._logService.trace(`[SessionsTerminal] Hid restored terminal ${availableInstance.instanceId} (cwd: ${cwd})`);
          }
        });
      }
    }));
    this._register(this._sessionsManagementService.onDidChangeSessions((e) => {
      for (const session of e.added) {
        if (session.isArchived.get()) {
          this._archivedSessionIds.add(session.sessionId);
        }
      }
      const justArchived = [];
      for (const session of e.changed) {
        if (session.isArchived.get()) {
          if (!this._archivedSessionIds.has(session.sessionId)) {
            this._archivedSessionIds.add(session.sessionId);
            justArchived.push(session);
          }
        } else {
          this._archivedSessionIds.delete(session.sessionId);
        }
      }
      for (const session of e.removed) {
        this._archivedSessionIds.delete(session.sessionId);
      }
      if (e.removed.length === 0 && justArchived.length === 0) {
        return;
      }
      this._logService.trace(`[SessionsTerminal] onDidChangeSessions cleanup (removed: ${e.removed.length}, justArchived: ${justArchived.length}, trackedSessions: ${this._sessionTerminals.size}, activeKey: ${this._activeKey ?? "<none>"})`);
      for (const session of e.removed) {
        void this._closeTerminalsForSession(session.sessionId, `session removed (${session.sessionId})`).finally(() => this._sessionTerminals.delete(session.sessionId));
      }
      for (const session of justArchived) {
        void this._hideTerminalsForSession(session.sessionId, `session archived (${session.sessionId})`);
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.sessionsTerminal";
  }
  /**
   * Ensures a terminal exists for the given cwd. When a session is provided,
   * tracked terminals for that session id are preferred; otherwise the method
   * falls back to matching untracked terminals by initial cwd for backward
   * compatibility before creating a new terminal. Sets newly created terminals
   * as active and optionally focuses them.
   *
   * When {@link session} is provided and the session is backed by an agent
   * host, the terminal is created on the agent host instead of locally.
   */
  async ensureTerminal(cwd, focus, session) {
    if (!session) {
      return this._ensureTerminal(cwd, focus, session);
    }
    this._beginTerminalOperation(session.sessionId);
    try {
      return await this._ensureTerminal(cwd, focus, session);
    } finally {
      this._endTerminalOperation(session.sessionId);
    }
  }
  async _ensureTerminal(cwd, focus, session) {
    if (session && this._pendingTerminalOperations.get(session.sessionId)?.replaced) {
      return [];
    }
    const key = cwd.fsPath.toLowerCase();
    let existing = session ? this._getTrackedTerminalsForSession(session.sessionId) : [];
    if (existing.length === 0) {
      existing = await this._findTerminalsForKey(key, { excludeTracked: !!session });
      if (session && this._pendingTerminalOperations.get(session.sessionId)?.replaced) {
        return [];
      }
    }
    if (existing.length === 0) {
      try {
        const instance = await this._createTerminalForSession(cwd, session);
        const createdInstance = this._getAvailableTerminal(instance, `activate created terminal for ${cwd.fsPath}`);
        if (!createdInstance) {
          return [];
        }
        if (session && this._pendingTerminalOperations.get(session.sessionId)?.replaced) {
          await this._terminalService.safeDisposeTerminal(createdInstance);
          return [];
        }
        existing = [createdInstance];
        this._terminalService.setActiveInstance(createdInstance);
        this._logService.trace(`[SessionsTerminal] Created terminal ${createdInstance.instanceId} for ${cwd.fsPath}`);
      } catch (e) {
        this._logService.trace(`[SessionsTerminal] Cannot create terminal for ${cwd.fsPath}: ${e}`);
        return [];
      }
    }
    if (session) {
      this._trackTerminalsForSession(session.sessionId, existing);
    }
    if (focus) {
      await this._terminalService.focusActiveInstance();
    }
    return existing;
  }
  /**
   * Creates a terminal for the given cwd. If the session is backed by an
   * agent host, creates an agent host terminal; otherwise creates a local one.
   */
  async _createTerminalForSession(cwd, session) {
    const address = session && this._getSessionAgentHostAddress(session);
    if (address) {
      const instance = await this._agentHostTerminalService.createTerminalForEntry(address, { cwd });
      if (instance) {
        return instance;
      }
    }
    return this._terminalService.createTerminal({ config: { cwd } });
  }
  /**
   * Returns the agent host address for the given session's provider,
   * or `undefined` if the session is not backed by an agent host.
   */
  _getSessionAgentHostAddress(session) {
    if (!session) {
      return void 0;
    }
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    if (!provider || !isAgentHostProvider(provider)) {
      return void 0;
    }
    return provider.remoteAddress ?? "__local__";
  }
  async _onActiveSessionChanged(session) {
    if (!session) {
      return;
    }
    this._beginTerminalOperation(session.sessionId);
    try {
      const info = getSessionTerminalInfo(session);
      const targetPath = info?.cwd ?? await this._pathService.userHome();
      const targetKey = targetPath.fsPath.toLowerCase();
      if (this._activeKey === targetKey && this._activeSessionId === session.sessionId) {
        return;
      }
      this._activeKey = targetKey;
      this._activeSessionId = session.sessionId;
      const instances = await this._ensureTerminal(targetPath, false, session);
      if (this._activeKey !== targetKey || this._activeSessionId !== session.sessionId) {
        return;
      }
      await this._updateTerminalVisibility(session, targetKey, instances.map((instance) => instance.instanceId));
    } finally {
      this._endTerminalOperation(session.sessionId);
    }
  }
  /**
   * Finds all terminal instances whose initial cwd (lower-cased) matches
   * the given key.
   */
  async _findTerminalsForKey(key, options) {
    const result = [];
    for (const instance of this._terminalService.instances) {
      if (instance.shellLaunchConfig.hideFromUser) {
        continue;
      }
      if (options?.excludeTracked && (this._isTerminalTracked(instance.instanceId) || this._standaloneTerminalIds.has(instance.instanceId))) {
        continue;
      }
      try {
        const cwd = await instance.getInitialCwd();
        if (cwd.toLowerCase() === key) {
          result.push(instance);
        }
      } catch {
      }
    }
    return result;
  }
  _trackTerminalsForSession(sessionId, instances) {
    if (instances.length === 0) {
      return;
    }
    let terminalIds = this._sessionTerminals.get(sessionId);
    if (!terminalIds) {
      terminalIds = /* @__PURE__ */ new Set();
      this._sessionTerminals.set(sessionId, terminalIds);
    }
    for (const instance of instances) {
      terminalIds.add(instance.instanceId);
    }
  }
  _beginTerminalOperation(sessionId) {
    const operation = this._pendingTerminalOperations.get(sessionId);
    if (operation) {
      operation.count++;
      return;
    }
    this._pendingTerminalOperations.set(sessionId, { count: 1, replaced: false });
  }
  _endTerminalOperation(sessionId) {
    const operation = this._pendingTerminalOperations.get(sessionId);
    if (!operation) {
      return;
    }
    operation.count--;
    if (operation.count > 0) {
      return;
    }
    this._pendingTerminalOperations.delete(sessionId);
  }
  _onDidReplaceNewDraftSession(from, to) {
    const pendingOperation = this._pendingTerminalOperations.get(from.sessionId);
    if (pendingOperation) {
      pendingOperation.replaced = true;
    }
    const fromCwd = getSessionTerminalInfo(from)?.cwd.fsPath.toLowerCase();
    const toCwd = getSessionTerminalInfo(to)?.cwd.fsPath.toLowerCase();
    const fromAgentHostAddress = this._getSessionAgentHostAddress(from);
    const toAgentHostAddress = this._getSessionAgentHostAddress(to);
    if (fromCwd === toCwd && fromAgentHostAddress === toAgentHostAddress) {
      this._transferTerminals(from.sessionId, to.sessionId);
    } else {
      this._rehomeTerminals(from.sessionId);
    }
  }
  _rehomeTerminals(sessionId) {
    const terminals = this._getTrackedTerminalsForSession(sessionId);
    for (const terminal of terminals) {
      this._standaloneTerminalIds.add(terminal.instanceId);
    }
    if (terminals.length > 0) {
      this._logService.trace(`[SessionsTerminal] Rehomed ${terminals.length} terminal(s) from session ${sessionId}`);
    }
    this._sessionTerminals.delete(sessionId);
  }
  _transferTerminals(fromSessionId, toSessionId) {
    const terminalIds = this._sessionTerminals.get(fromSessionId);
    if (terminalIds && terminalIds.size > 0) {
      let targetIds = this._sessionTerminals.get(toSessionId);
      if (!targetIds) {
        targetIds = /* @__PURE__ */ new Set();
        this._sessionTerminals.set(toSessionId, targetIds);
      }
      for (const id of terminalIds) {
        targetIds.add(id);
      }
      this._logService.trace(`[SessionsTerminal] Transferred ${terminalIds.size} terminal(s) from session ${fromSessionId} to ${toSessionId}`);
    }
    this._sessionTerminals.delete(fromSessionId);
  }
  _getTrackedTerminalsForSession(sessionId) {
    const terminalIds = this._sessionTerminals.get(sessionId);
    if (!terminalIds) {
      return [];
    }
    const result = [];
    for (const instanceId of [...terminalIds]) {
      const instance = this._terminalService.getInstanceFromId(instanceId);
      if (!instance || instance.isDisposed || instance.shellLaunchConfig.hideFromUser) {
        terminalIds.delete(instanceId);
        continue;
      }
      result.push(instance);
    }
    if (terminalIds.size === 0) {
      this._sessionTerminals.delete(sessionId);
    }
    return result;
  }
  _isTerminalTracked(instanceId) {
    for (const [sessionId, terminalIds] of this._sessionTerminals) {
      if (terminalIds.has(instanceId)) {
        const instance = this._terminalService.getInstanceFromId(instanceId);
        if (!instance || instance.isDisposed) {
          terminalIds.delete(instanceId);
          if (terminalIds.size === 0) {
            this._sessionTerminals.delete(sessionId);
          }
          continue;
        }
        return true;
      }
    }
    return false;
  }
  _removeTerminalFromTrackedSessions(instanceId) {
    for (const [sessionId, terminalIds] of this._sessionTerminals) {
      terminalIds.delete(instanceId);
      if (terminalIds.size === 0) {
        this._sessionTerminals.delete(sessionId);
      }
    }
  }
  _getAvailableTerminal(instance, action) {
    const currentInstance = this._terminalService.getInstanceFromId(instance.instanceId);
    if (!currentInstance || currentInstance.isDisposed) {
      this._logService.trace(`[SessionsTerminal] Cannot ${action}; terminal ${instance.instanceId} is no longer available`);
      return void 0;
    }
    return currentInstance;
  }
  /**
   * Shows background terminals that belong to the active session and hides
   * foreground terminals that belong to other sessions. When the active
   * session has no tracked terminals yet, falls back to initial cwd matching
   * for compatibility with restored terminals from previous sessions.
   */
  async _updateTerminalVisibility(activeSession, activeKey, forceForegroundTerminalIds) {
    const toShow = [];
    const toHide = [];
    const trackedTerminalIds = new Set(this._getTrackedTerminalsForSession(activeSession.sessionId).map((instance) => instance.instanceId));
    for (const instance of [...this._terminalService.instances]) {
      if (instance.shellLaunchConfig.hideFromUser || this._standaloneTerminalIds.has(instance.instanceId)) {
        continue;
      }
      let cwd;
      const currentInstance = this._getAvailableTerminal(instance, "update terminal visibility");
      if (!currentInstance) {
        continue;
      }
      const isForeground = this._terminalService.foregroundInstances.includes(currentInstance);
      const isForceVisible = forceForegroundTerminalIds.includes(currentInstance.instanceId);
      let belongsToActiveSession = trackedTerminalIds.has(currentInstance.instanceId);
      if (!belongsToActiveSession && !this._isTerminalTracked(currentInstance.instanceId)) {
        try {
          cwd = (await currentInstance.getInitialCwd()).toLowerCase();
        } catch {
          continue;
        }
        belongsToActiveSession = cwd === activeKey;
      }
      if ((belongsToActiveSession || isForceVisible) && !isForeground) {
        toShow.push(currentInstance);
      } else if (!belongsToActiveSession && !isForceVisible && isForeground) {
        toHide.push(currentInstance);
      }
    }
    for (const instance of toShow) {
      const availableInstance = this._getAvailableTerminal(instance, "show background terminal");
      if (availableInstance) {
        await this._terminalService.showBackgroundTerminal(availableInstance, true);
      }
    }
    for (const instance of toHide) {
      const availableInstance = this._getAvailableTerminal(instance, "move terminal to background");
      if (availableInstance) {
        this._logService.debug(`[SessionsTerminal] Hiding terminal ${availableInstance.instanceId} (does not belong to active key ${activeKey})`);
        this._terminalService.moveToBackground(availableInstance);
      }
    }
    const foreground = this._terminalService.foregroundInstances;
    let mostRecent;
    let mostRecentTimestamp = -1;
    for (const instance of foreground) {
      if (this._standaloneTerminalIds.has(instance.instanceId)) {
        continue;
      }
      const cmdDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
      const lastCmd = cmdDetection?.commands.at(-1);
      if (lastCmd && lastCmd.timestamp > mostRecentTimestamp) {
        mostRecentTimestamp = lastCmd.timestamp;
        mostRecent = instance;
      }
    }
    if (mostRecent) {
      this._terminalService.setActiveInstance(mostRecent);
    }
  }
  /**
   * Disposes (kills) terminals associated with the given session id. Used
   * when a session is removed: removal is an explicit user action, so the pty
   * is torn down.
   *
   * Never disposes the terminal the user is currently working in. Removal also
   * covers session *graduation* (untitled → committed via `onDidReplaceSession`,
   * which surfaces the skeleton in `removed`): the focused (active) instance is
   * therefore always protected.
   *
   * {@link reason} is logged for each killed terminal so unexpected disposals in
   * the agents window can be diagnosed from the logs. See #313510, #318645.
   */
  async _closeTerminalsForSession(sessionId, reason) {
    const protectedInstanceId = this._terminalService.activeInstance?.instanceId;
    for (const instance of this._getTrackedTerminalsForSession(sessionId)) {
      if (protectedInstanceId !== void 0 && instance.instanceId === protectedInstanceId) {
        this._logService.info(`[SessionsTerminal] Skipping active terminal ${instance.instanceId} for session ${sessionId} (user is working in it)`);
        continue;
      }
      const availableInstance = this._getAvailableTerminal(instance, `close removed session terminal for session ${sessionId}`);
      if (!availableInstance) {
        continue;
      }
      this._logService.info(`[SessionsTerminal] Killing terminal ${availableInstance.instanceId} (session: ${sessionId}, reason: ${reason})`);
      await this._terminalService.safeDisposeTerminal(availableInstance);
      this._removeTerminalFromTrackedSessions(availableInstance.instanceId);
    }
  }
  /**
   * Hides (moves to background) terminals associated with the given session id
   * without disposing them. Used when a session is archived ("Mark as Done"):
   * archiving is reversible and the pty must survive so it can be shown again.
   *
   * Archiving is asynchronous and can land while the user is working in a
   * just-opened terminal at this cwd, so the focused (active) instance is
   * never hidden out from under the user.
   *
   * {@link reason} is logged for each hidden terminal so unexpected visibility
   * changes in the agents window can be diagnosed from the logs. See #313510,
   * #318645.
   */
  async _hideTerminalsForSession(sessionId, reason) {
    const protectedInstanceId = this._terminalService.activeInstance?.instanceId;
    for (const instance of this._getTrackedTerminalsForSession(sessionId)) {
      if (protectedInstanceId !== void 0 && instance.instanceId === protectedInstanceId) {
        this._logService.info(`[SessionsTerminal] Skipping active terminal ${instance.instanceId} for session ${sessionId} (user is working in it)`);
        continue;
      }
      const availableInstance = this._getAvailableTerminal(instance, `hide archived terminal for session ${sessionId}`);
      if (!availableInstance) {
        continue;
      }
      this._logService.info(`[SessionsTerminal] Hiding terminal ${availableInstance.instanceId} (session: ${sessionId}, reason: ${reason})`);
      this._terminalService.moveToBackground(availableInstance);
    }
  }
  async dumpTracking() {
    console.log(`[SessionsTerminal] Active key: ${this._activeKey ?? "<none>"}`);
    console.log(`[SessionsTerminal] Session terminals: ${JSON.stringify([...this._sessionTerminals.entries()].map(([sessionId, terminalIds]) => [sessionId, [...terminalIds]]))}`);
    console.log(`[SessionsTerminal] Standalone terminals: ${JSON.stringify([...this._standaloneTerminalIds])}`);
    console.log("[SessionsTerminal] === All Terminals ===");
    for (const instance of this._terminalService.instances) {
      let cwd = "<unknown>";
      try {
        cwd = await instance.getInitialCwd();
      } catch {
      }
      const isForeground = this._terminalService.foregroundInstances.includes(instance);
      console.log(`  ${instance.instanceId} - ${cwd} - ${isForeground ? "foreground" : "background"}`);
    }
  }
  async showAllTerminals() {
    for (const instance of this._terminalService.instances) {
      if (!this._terminalService.foregroundInstances.includes(instance)) {
        await this._terminalService.showBackgroundTerminal(instance, true);
        this._logService.trace(`[SessionsTerminal] Moved terminal ${instance.instanceId} to foreground`);
      }
    }
  }
};
SessionsTerminalContribution = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, ITerminalService),
  __decorateParam(4, IAgentHostTerminalService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IPathService),
  __decorateParam(7, ITerminalProfileService),
  __decorateParam(8, IViewsService),
  __decorateParam(9, IContextKeyService)
], SessionsTerminalContribution);
registerWorkbenchContribution2(SessionsTerminalContribution.ID, SessionsTerminalContribution, WorkbenchPhase.AfterRestored);
let RegisterAgentHostSessionTaskRunnerContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.registerAgentHostTaskRunner";
  }
  constructor(instantiationService, registry) {
    super();
    const runner = instantiationService.createInstance(AgentHostSessionTaskRunner);
    this._register(registry.register(runner));
  }
};
RegisterAgentHostSessionTaskRunnerContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ISessionTaskRunnerRegistry)
], RegisterAgentHostSessionTaskRunnerContribution);
registerWorkbenchContribution2(RegisterAgentHostSessionTaskRunnerContribution.ID, RegisterAgentHostSessionTaskRunnerContribution, WorkbenchPhase.BlockStartup);
class OpenSessionInTerminalAction extends Action2 {
  constructor() {
    super({
      id: "agentSession.openInTerminal",
      title: localize2("openInTerminal", "Open Terminal"),
      icon: Codicon.terminal,
      // The panel is hidden while a custom view replaces the sessions grid.
      precondition: CustomViewVisibleContext.negate(),
      toggled: {
        condition: SessionsTerminalViewVisibleContext,
        title: localize("hideTerminal", "Hide Terminal")
      },
      menu: [{
        id: Menus.TitleBarSessionMenu,
        group: "navigation",
        order: 10,
        when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated(), IsPhoneLayoutContext.negate())
      }]
    });
  }
  async run(_accessor) {
    const telemetryService = _accessor.get(ITelemetryService);
    logSessionsInteraction(telemetryService, "openTerminal");
    const layoutService = _accessor.get(IWorkbenchLayoutService);
    const viewsService = _accessor.get(IViewsService);
    if (layoutService.isVisible(Parts.PANEL_PART)) {
      if (viewsService.isViewVisible(TERMINAL_VIEW_ID)) {
        layoutService.setPartHidden(true, Parts.PANEL_PART);
        return;
      }
    }
    const contribution = getWorkbenchContribution(SessionsTerminalContribution.ID);
    const sessionsService = _accessor.get(ISessionsService);
    const pathService = _accessor.get(IPathService);
    const activeSession = sessionsService.activeSession.get();
    const info = getSessionTerminalInfo(activeSession);
    const cwd = info?.cwd ?? await pathService.userHome();
    await contribution.ensureTerminal(cwd, true, activeSession);
    viewsService.openView(TERMINAL_VIEW_ID);
  }
}
registerAction2(OpenSessionInTerminalAction);
class DumpTerminalTrackingAction extends Action2 {
  constructor() {
    super({
      id: "agentSession.dumpTerminalTracking",
      title: localize2("dumpTerminalTracking", "Dump Terminal Tracking"),
      f1: true
    });
  }
  async run() {
    const contribution = getWorkbenchContribution(SessionsTerminalContribution.ID);
    await contribution.dumpTracking();
  }
}
registerAction2(DumpTerminalTrackingAction);
class ShowAllTerminalsAction extends Action2 {
  constructor() {
    super({
      id: "agentSession.showAllTerminals",
      title: localize2("showAllTerminals", "Show All Terminals"),
      f1: true
    });
  }
  async run() {
    const contribution = getWorkbenchContribution(SessionsTerminalContribution.ID);
    await contribution.showAllTerminals();
  }
}
registerAction2(ShowAllTerminalsAction);
export {
  SessionsTerminalContribution
};
