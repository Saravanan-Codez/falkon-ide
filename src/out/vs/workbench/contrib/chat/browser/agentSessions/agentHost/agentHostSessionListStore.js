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
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { extUriBiasedIgnorePathCase } from "../../../../../../base/common/resources.js";
import { URI } from "../../../../../../base/common/uri.js";
import { AgentSession } from "../../../../../../platform/agentHost/common/agentService.js";
import { ActionType } from "../../../../../../platform/agentHost/common/state/sessionActions.js";
import { readSessionMultiRootMetadata, SessionStatus } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
let AgentHostSessionListStore = class extends Disposable {
  constructor(_connection, _workspaceContextService) {
    super();
    this._connection = _connection;
    this._workspaceContextService = _workspaceContextService;
    this._onDidChangeSessions = this._register(new Emitter());
    this.onDidChangeSessions = this._onDidChangeSessions.event;
    this._entries = /* @__PURE__ */ new Map();
    /**
     * Backend session keys for sessions a controller created locally (via
     * `newChatSessionItem`) that the backend has not yet announced. Tracked here
     * so per-provider controllers stay stateless; cleared once the backend
     * surfaces or removes the session.
     */
    this._pendingNewSessions = /* @__PURE__ */ new Set();
    this._cacheValid = false;
    /**
     * Incremented whenever the in-memory list is mutated outside of
     * {@link refresh}. Used to detect races where a `root/sessionAdded`,
     * `root/sessionRemoved`, or `root/sessionSummaryChanged` notification
     * arrives while a `listSessions()` round-trip is in flight.
     */
    this._mutationGeneration = 0;
    this._register(this._connection.onDidNotification((n) => this._onNotification(n)));
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => {
      this._cacheValid = false;
      void this.refresh(CancellationToken.None);
    }));
  }
  getSessions(provider) {
    return [...this._entries.values()].filter((entry) => entry.provider === provider);
  }
  /** Record a session created locally before the backend has announced it. */
  addPendingNewSession(provider, rawId) {
    this._pendingNewSessions.add(this._key(provider, rawId));
  }
  /** Whether a session was created locally and the backend has not surfaced it yet. */
  isPendingNewSession(provider, rawId) {
    return this._pendingNewSessions.has(this._key(provider, rawId));
  }
  resetCache() {
    this._cacheValid = false;
    this._mutationGeneration++;
  }
  async disposeSession(provider, rawId) {
    await this._connection.disposeSession(AgentSession.uri(provider, rawId));
  }
  setSessionArchived(provider, rawId, archived) {
    this._setSessionFlag(provider, rawId, SessionStatus.IsArchived, archived, {
      type: ActionType.SessionIsArchivedChanged,
      isArchived: archived
    });
  }
  setSessionRead(provider, rawId, isRead) {
    this._setSessionFlag(provider, rawId, SessionStatus.IsRead, isRead, {
      type: ActionType.SessionIsReadChanged,
      isRead
    });
  }
  /**
   * Optimistically flips a session-scoped status flag and dispatches the owning
   * action, so the host can fan the change out to other connected clients. An
   * uncached session still dispatches; the summary notification seeds the entry.
   */
  _setSessionFlag(provider, rawId, flag, set, action) {
    const session = AgentSession.uri(provider, rawId);
    const key = this._key(provider, rawId);
    const cached = this._entries.get(key);
    let updated;
    if (cached) {
      const status = set ? cached.summary.status | flag : cached.summary.status & ~flag;
      if (status === cached.summary.status && cached.statusKnown) {
        return;
      }
      updated = { ...cached, statusKnown: true, summary: { ...cached.summary, status } };
    }
    this._mutationGeneration++;
    this._connection.dispatch(session.toString(), action);
    if (updated) {
      this._entries.set(key, updated);
      this._onDidChangeSessions.fire({ addedOrUpdated: [updated] });
    }
  }
  removeSession(provider, rawId) {
    this._mutationGeneration++;
    this._removeSessionFromList(provider, rawId);
  }
  _removeSessionFromList(provider, rawId) {
    const key = this._key(provider, rawId);
    this._pendingNewSessions.delete(key);
    const entry = this._entries.get(key);
    if (!entry) {
      return;
    }
    this._entries.delete(key);
    this._onDidChangeSessions.fire({ removed: [this._toRemoval(entry)] });
  }
  async refresh(token) {
    if (this._refreshInFlight) {
      return this._refreshInFlight;
    }
    this._refreshInFlight = this._doRefresh(token);
    try {
      await this._refreshInFlight;
    } finally {
      this._refreshInFlight = void 0;
    }
  }
  async _doRefresh(token) {
    if (this._cacheValid) {
      return;
    }
    const previousEntries = [...this._entries.values()];
    const startGeneration = this._mutationGeneration;
    let sessions;
    try {
      sessions = await this._connection.listSessions();
    } catch {
      if (startGeneration !== this._mutationGeneration) {
        return;
      }
      if (this._entries.size === 0) {
        return;
      }
      this._entries.clear();
      this._onDidChangeSessions.fire({ removed: previousEntries.map((entry) => this._toRemoval(entry)) });
      return;
    }
    if (startGeneration !== this._mutationGeneration) {
      return this._doRefresh(token);
    }
    const nextEntries = [];
    for (const session of sessions) {
      const entry = this._makeEntryFromMetadata(session);
      if (entry) {
        if (this._isSessionInWorkspace(entry)) {
          nextEntries.push(entry);
        }
      }
    }
    this._entries.clear();
    for (const entry of nextEntries) {
      const key = this._key(entry.provider, entry.rawId);
      this._entries.set(key, entry);
      this._pendingNewSessions.delete(key);
    }
    this._cacheValid = true;
    const nextKeys = new Set(nextEntries.map((entry) => this._key(entry.provider, entry.rawId)));
    const removed = previousEntries.filter((entry) => !nextKeys.has(this._key(entry.provider, entry.rawId))).map((entry) => this._toRemoval(entry));
    if (nextEntries.length === 0 && removed.length === 0) {
      return;
    }
    this._onDidChangeSessions.fire({
      ...nextEntries.length > 0 ? { addedOrUpdated: nextEntries } : void 0,
      ...removed.length > 0 ? { removed } : void 0
    });
  }
  _onNotification(notification) {
    if (notification.type === "root/sessionAdded") {
      const entry = this._makeEntryFromSummary(notification.summary);
      if (!entry) {
        return;
      }
      const key = this._key(entry.provider, entry.rawId);
      if (!this._isSessionInWorkspace(entry)) {
        return;
      }
      this._mutationGeneration++;
      this._entries.set(key, entry);
      this._pendingNewSessions.delete(key);
      this._onDidChangeSessions.fire({ addedOrUpdated: [entry] });
    } else if (notification.type === "root/sessionRemoved") {
      const provider = AgentSession.provider(notification.session);
      if (!provider) {
        return;
      }
      this.removeSession(provider, AgentSession.id(notification.session));
    } else if (notification.type === "root/sessionSummaryChanged") {
      const provider = AgentSession.provider(notification.session);
      if (!provider) {
        return;
      }
      const rawId = AgentSession.id(notification.session);
      const key = this._key(provider, rawId);
      const cached = this._entries.get(key);
      if (!cached) {
        return;
      }
      const updated = {
        provider,
        rawId,
        statusKnown: cached.statusKnown || notification.changes.status !== void 0,
        summary: { ...cached.summary, ...notification.changes }
      };
      if (!this._isSessionInWorkspace(updated)) {
        this._mutationGeneration++;
        this._removeSessionFromList(provider, rawId);
        return;
      }
      this._mutationGeneration++;
      this._entries.set(key, updated);
      this._onDidChangeSessions.fire({ addedOrUpdated: [updated] });
    }
  }
  _makeEntryFromMetadata(session) {
    const provider = AgentSession.provider(session.session);
    if (!provider) {
      return void 0;
    }
    const rawId = AgentSession.id(session.session);
    return {
      provider,
      rawId,
      statusKnown: session.status !== void 0,
      summary: {
        resource: session.session.toString(),
        provider,
        title: session.summary ?? `Session ${rawId.substring(0, 8)}`,
        status: session.status ?? SessionStatus.Idle,
        activity: session.activity,
        createdAt: new Date(session.startTime).toISOString(),
        modifiedAt: new Date(session.modifiedTime).toISOString(),
        changes: session.changes,
        workingDirectories: session.workingDirectories?.map((d) => d.toString()),
        // Carry `_meta` so the adoptable-legacy marker survives into the list
        // item; consumers use it to avoid passively restoring (and thereby
        // migrating) an un-adopted legacy Copilot CLI session.
        ...session._meta !== void 0 ? { _meta: session._meta } : {}
      }
    };
  }
  _makeEntryFromSummary(summary) {
    const provider = summary.provider || AgentSession.provider(summary.resource);
    if (!provider) {
      return void 0;
    }
    return {
      provider,
      rawId: AgentSession.id(summary.resource),
      statusKnown: true,
      summary
    };
  }
  /** Uses workspace-file provenance for multi-root workspaces and path containment otherwise. */
  _isSessionInWorkspace(entry) {
    const workingDirectories = entry.summary.workingDirectories?.map((directory) => URI.parse(directory)) ?? [];
    const workspace = this._workspaceContextService.getWorkspace();
    const folders = workspace.folders;
    const configuration = workspace.configuration;
    const multiRoot = readSessionMultiRootMetadata(entry.summary._meta);
    if (multiRoot) {
      if (URI.isUri(configuration)) {
        return extUriBiasedIgnorePathCase.isEqual(URI.parse(multiRoot.workspaceFile), configuration);
      }
      return folders.length === 0 || this._matchesAnyFolder(workingDirectories, folders);
    }
    if (folders.length === 0) {
      return true;
    }
    return this._matchesAnyFolder(workingDirectories, folders);
  }
  _matchesAnyFolder(workingDirectories, folders) {
    return workingDirectories.some(
      (directory) => folders.some((folder) => extUriBiasedIgnorePathCase.isEqualOrParent(directory, folder.uri))
    );
  }
  _toRemoval(entry) {
    return {
      provider: entry.provider,
      rawId: entry.rawId,
      session: AgentSession.uri(entry.provider, entry.rawId)
    };
  }
  _key(provider, rawId) {
    return `${provider}://${rawId}`;
  }
};
AgentHostSessionListStore = __decorateClass([
  __decorateParam(1, IWorkspaceContextService)
], AgentHostSessionListStore);
export {
  AgentHostSessionListStore
};
