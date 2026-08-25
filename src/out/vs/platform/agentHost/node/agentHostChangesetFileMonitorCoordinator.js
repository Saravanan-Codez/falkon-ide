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
import { SequencerByKey } from "../../../base/common/async.js";
import { Disposable, DisposableMap, ReferenceCollection } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { buildBranchChangesetUri, buildSessionChangesetUri, buildUncommittedChangesetUri } from "../common/changesetUri.js";
import { parseSubagentSessionUri } from "../common/state/sessionState.js";
import { IAgentConfigurationService } from "./agentConfigurationService.js";
import { DEFAULT_AGENT_HOST_WATCH_EXCLUDES, IAgentHostFileMonitorService } from "./agentHostFileMonitorService.js";
import { IAgentHostGitService } from "../common/agentHostGitService.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { ILogService } from "../../log/common/log.js";
import { IAgentHostGitStateService } from "../common/agentHostGitStateService.js";
class WatchInterestReferenceCollection extends ReferenceCollection {
  constructor(_create, _destroy) {
    super();
    this._create = _create;
    this._destroy = _destroy;
  }
  createReferencedObject(sessionStr) {
    this._create(sessionStr);
    return sessionStr;
  }
  destroyReferencedObject(sessionStr) {
    this._destroy(sessionStr);
  }
}
let ChangesetFileMonitorCoordinator = class extends Disposable {
  constructor(_stateManager, _configurationService, _fileMonitorService, _gitService, _gitStateService, _logService) {
    super();
    this._stateManager = _stateManager;
    this._configurationService = _configurationService;
    this._fileMonitorService = _fileMonitorService;
    this._gitService = _gitService;
    this._gitStateService = _gitStateService;
    this._logService = _logService;
    /** Per-subscription references into the per-session watch-interest collection. */
    this._watchInterestReferences = this._register(new DisposableMap());
    this._watchInterestCollection = new WatchInterestReferenceCollection(
      (sessionStr) => this._attachWatcherIfPossible(sessionStr),
      (sessionStr) => this._destroyWatchInterest(sessionStr)
    );
    /** Sessions waiting for materialization before a root watcher can attach. */
    this._pendingWatchInterest = /* @__PURE__ */ new Set();
    /** Session URI string to the working directory that produced the current root attachment. */
    this._sessionWorkingDirectory = /* @__PURE__ */ new Map();
    /** Session URI string to repository-root URI string. */
    this._sessionRoot = /* @__PURE__ */ new Map();
    /** Repository-root URI string to sessions currently fanned out from that root. */
    this._rootSessions = /* @__PURE__ */ new Map();
    /** Repository-root URI string to the shared monitor acquisition. */
    this._rootWatchAcquisitions = this._register(new DisposableMap());
    /** Repository-root URI string to the canonical repository root URI. */
    this._rootUris = /* @__PURE__ */ new Map();
    /** Active session URI string to repository-root URI string. */
    this._activeSessionRoots = /* @__PURE__ */ new Map();
    /** Repository-root URI string to sessions currently active against that root. */
    this._rootActiveSessions = /* @__PURE__ */ new Map();
    /** Active sessions whose repository root cannot yet be resolved. */
    this._unresolvedActiveSessions = /* @__PURE__ */ new Set();
    this._watchAttachmentSequencer = new SequencerByKey();
    this._activeTurnSequencer = new SequencerByKey();
  }
  trackSessionChanges(subscriptionKey, sessionStr) {
    if (!this._watchInterestReferences.has(subscriptionKey)) {
      this._watchInterestReferences.set(subscriptionKey, this._watchInterestCollection.acquire(sessionStr));
    }
  }
  untrackSessionChanges(subscriptionKey) {
    this._watchInterestReferences.deleteAndDispose(subscriptionKey);
  }
  onSessionRestored(sessionStr) {
    this._retryWatchAttachment(sessionStr);
  }
  onSessionMaterialized(sessionStr) {
    this._retryWatchAttachment(sessionStr);
  }
  onSessionDisposed(sessionStr) {
    this.untrackSessionChanges(buildUncommittedChangesetUri(sessionStr));
    this.untrackSessionChanges(buildSessionChangesetUri(sessionStr));
    this.untrackSessionChanges(sessionStr);
    this._removeActiveSession(sessionStr);
    this._destroyWatchInterest(sessionStr);
  }
  onSessionTurnActiveChanged(sessionStr, active) {
    this._activeTurnSequencer.queue(sessionStr, async () => {
      if (active) {
        await this._markSessionActive(sessionStr);
      } else {
        this._markSessionInactive(sessionStr);
      }
    });
  }
  _destroyWatchInterest(sessionStr) {
    this._pendingWatchInterest.delete(sessionStr);
    this._releaseSessionRoot(sessionStr);
  }
  _retryWatchAttachment(sessionStr) {
    if (this._shouldAttachSession(sessionStr) || this._pendingWatchInterest.has(sessionStr)) {
      this._attachWatcherIfPossible(sessionStr);
    }
  }
  _hasWatchInterest(sessionStr) {
    return this._watchInterestReferences.has(sessionStr) || this._watchInterestReferences.has(buildBranchChangesetUri(sessionStr)) || this._watchInterestReferences.has(buildUncommittedChangesetUri(sessionStr)) || this._watchInterestReferences.has(buildSessionChangesetUri(sessionStr));
  }
  _attachWatcherIfPossible(sessionStr) {
    this._watchAttachmentSequencer.queue(sessionStr, async () => {
      if (!this._shouldAttachSession(sessionStr)) {
        return;
      }
      const workingDirectory = this._configurationService.getEffectiveWorkingDirectory(sessionStr);
      if (!workingDirectory) {
        this._pendingWatchInterest.add(sessionStr);
        this._releaseSessionRoot(sessionStr);
        return;
      }
      let workingDirectoryUri;
      try {
        workingDirectoryUri = URI.parse(workingDirectory);
      } catch (err) {
        this._logService.warn(`[ChangesetFileMonitorCoordinator] Failed to parse working directory URI for ${sessionStr}: ${workingDirectory}`, err);
        this._pendingWatchInterest.add(sessionStr);
        this._releaseSessionRoot(sessionStr);
        return;
      }
      if (this._sessionRoot.has(sessionStr) && this._sessionWorkingDirectory.get(sessionStr) === workingDirectory) {
        this._pendingWatchInterest.delete(sessionStr);
        return;
      }
      const repositoryRoot = await this._gitService.getRepositoryRoot(workingDirectoryUri);
      if (!this._shouldAttachSession(sessionStr)) {
        return;
      }
      if (!repositoryRoot) {
        this._pendingWatchInterest.delete(sessionStr);
        this._releaseSessionRoot(sessionStr);
        return;
      }
      this._pendingWatchInterest.delete(sessionStr);
      this._attachSessionToRoot(sessionStr, repositoryRoot, workingDirectory);
    });
  }
  _attachSessionToRoot(sessionStr, repositoryRoot, workingDirectory) {
    const rootStr = repositoryRoot.toString();
    if (this._sessionRoot.get(sessionStr) === rootStr) {
      this._sessionWorkingDirectory.set(sessionStr, workingDirectory);
      this._ensureRootWatcher(rootStr, repositoryRoot);
      return;
    }
    this._releaseSessionRoot(sessionStr);
    let sessions = this._rootSessions.get(rootStr);
    if (!sessions) {
      sessions = /* @__PURE__ */ new Set();
      this._rootSessions.set(rootStr, sessions);
      this._rootUris.set(rootStr, repositoryRoot);
    }
    sessions.add(sessionStr);
    this._sessionRoot.set(sessionStr, rootStr);
    this._sessionWorkingDirectory.set(sessionStr, workingDirectory);
    this._ensureRootWatcher(rootStr, repositoryRoot);
  }
  _releaseSessionRoot(sessionStr) {
    const rootStr = this._sessionRoot.get(sessionStr);
    if (!rootStr) {
      this._sessionWorkingDirectory.delete(sessionStr);
      return;
    }
    this._sessionRoot.delete(sessionStr);
    this._sessionWorkingDirectory.delete(sessionStr);
    const sessions = this._rootSessions.get(rootStr);
    if (!sessions) {
      return;
    }
    sessions.delete(sessionStr);
    if (sessions.size === 0) {
      this._rootSessions.delete(rootStr);
      this._rootUris.delete(rootStr);
      this._rootWatchAcquisitions.deleteAndDispose(rootStr);
    }
  }
  _onRootChanged(rootStr) {
    if (this._isRootActive(rootStr)) {
      return;
    }
    const sessions = this._rootSessions.get(rootStr);
    if (!sessions || sessions.size === 0) {
      return;
    }
    const activeSessions = [...sessions].filter((session) => {
      return this._hasWatchInterest(session) && this._sessionRoot.get(session) === rootStr && !this._activeSessionRoots.has(session) && !this._unresolvedActiveSessions.has(session) && !!this._stateManager.getSessionState(session);
    });
    if (activeSessions.length === 0) {
      return;
    }
    const workingDirectory = URI.parse(rootStr);
    for (const session of activeSessions) {
      void this._gitStateService.refreshSessionGitState(session, workingDirectory);
    }
  }
  _shouldAttachSession(sessionStr) {
    return this._hasWatchInterest(sessionStr) && !this._activeSessionRoots.has(sessionStr) && !this._unresolvedActiveSessions.has(sessionStr);
  }
  _isRootActive(rootStr) {
    return (this._rootActiveSessions.get(rootStr)?.size ?? 0) > 0;
  }
  _ensureRootWatcher(rootStr, repositoryRoot) {
    if (this._isRootActive(rootStr) || this._rootWatchAcquisitions.has(rootStr)) {
      return;
    }
    const sessions = this._rootSessions.get(rootStr);
    if (!sessions || sessions.size === 0) {
      return;
    }
    const rootWatchAcquisition = this._fileMonitorService.acquire(repositoryRoot, () => this._onRootChanged(rootStr), {
      excludes: DEFAULT_AGENT_HOST_WATCH_EXCLUDES,
      debounceMs: 750
    });
    if (!rootWatchAcquisition) {
      for (const session of sessions) {
        this._pendingWatchInterest.add(session);
      }
      return;
    }
    this._rootWatchAcquisitions.set(rootStr, rootWatchAcquisition);
  }
  _suspendRootWatcher(rootStr) {
    this._rootWatchAcquisitions.deleteAndDispose(rootStr);
  }
  async _markSessionActive(sessionStr) {
    this._removeActiveSession(sessionStr);
    this._pendingWatchInterest.delete(sessionStr);
    const repositoryRoot = await this._resolveActivityRepositoryRoot(sessionStr);
    if (!repositoryRoot) {
      this._unresolvedActiveSessions.add(sessionStr);
      this._releaseSessionRoot(sessionStr);
      return;
    }
    const rootStr = repositoryRoot.toString();
    let activeSessions = this._rootActiveSessions.get(rootStr);
    if (!activeSessions) {
      activeSessions = /* @__PURE__ */ new Set();
      this._rootActiveSessions.set(rootStr, activeSessions);
    }
    activeSessions.add(sessionStr);
    this._activeSessionRoots.set(sessionStr, rootStr);
    this._rootUris.set(rootStr, repositoryRoot);
    this._suspendRootWatcher(rootStr);
    if (this._sessionRoot.get(sessionStr) !== rootStr) {
      this._releaseSessionRoot(sessionStr);
    }
  }
  _markSessionInactive(sessionStr) {
    const rootStr = this._removeActiveSession(sessionStr);
    if (rootStr) {
      const repositoryRoot = this._rootUris.get(rootStr);
      if (repositoryRoot) {
        this._ensureRootWatcher(rootStr, repositoryRoot);
      }
    }
    if (this._hasWatchInterest(sessionStr) || this._pendingWatchInterest.has(sessionStr)) {
      this._attachWatcherIfPossible(sessionStr);
    }
  }
  _removeActiveSession(sessionStr) {
    this._unresolvedActiveSessions.delete(sessionStr);
    const rootStr = this._activeSessionRoots.get(sessionStr);
    if (!rootStr) {
      return void 0;
    }
    this._activeSessionRoots.delete(sessionStr);
    const activeSessions = this._rootActiveSessions.get(rootStr);
    if (activeSessions) {
      activeSessions.delete(sessionStr);
      if (activeSessions.size === 0) {
        this._rootActiveSessions.delete(rootStr);
      }
    }
    return rootStr;
  }
  async _resolveActivityRepositoryRoot(sessionStr) {
    const workingDirectory = this._getActivityWorkingDirectory(sessionStr);
    if (!workingDirectory) {
      return void 0;
    }
    let workingDirectoryUri;
    try {
      workingDirectoryUri = URI.parse(workingDirectory);
    } catch (err) {
      this._logService.warn(`[ChangesetFileMonitorCoordinator] Failed to parse active working directory URI for ${sessionStr}: ${workingDirectory}`, err);
      return void 0;
    }
    return this._gitService.getRepositoryRoot(workingDirectoryUri);
  }
  _getActivityWorkingDirectory(sessionStr) {
    const workingDirectory = this._configurationService.getEffectiveWorkingDirectory(sessionStr);
    if (workingDirectory) {
      return workingDirectory;
    }
    const parsedSubagent = parseSubagentSessionUri(sessionStr);
    if (!parsedSubagent) {
      return void 0;
    }
    return this._configurationService.getEffectiveWorkingDirectory(parsedSubagent.parentSession.toString());
  }
};
ChangesetFileMonitorCoordinator = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IAgentConfigurationService),
  __decorateParam(2, IAgentHostFileMonitorService),
  __decorateParam(3, IAgentHostGitService),
  __decorateParam(4, IAgentHostGitStateService),
  __decorateParam(5, ILogService)
], ChangesetFileMonitorCoordinator);
export {
  ChangesetFileMonitorCoordinator
};
