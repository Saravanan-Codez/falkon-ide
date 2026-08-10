import { hash } from "../../../../base/common/hash.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const APP_LAUNCH_COUNT_KEY = "agentSessions.telemetry.summary.appLaunchCount";
const SESSIONS_KEY = "agentSessions.telemetry.summary.sessions";
const TOTAL_SESSIONS_KEY = "agentSessions.telemetry.totalSessions";
const WORKSPACE_SESSIONS_KEY = "agentSessions.telemetry.workspaceSessions";
const PROVIDER_SESSIONS_KEY = "agentSessions.telemetry.providerSessions";
const MAX_TRACKED_SESSIONS = 2e3;
class SessionsLifecycleTracker extends Disposable {
  constructor(_storageService) {
    super();
    this._storageService = _storageService;
    const previousAppLaunches = this._storageService.getNumber(APP_LAUNCH_COUNT_KEY, StorageScope.APPLICATION, 0);
    this._appLaunchCount = previousAppLaunches + 1;
    this._storageService.store(APP_LAUNCH_COUNT_KEY, this._appLaunchCount, StorageScope.APPLICATION, StorageTarget.MACHINE);
    this._stats = this._load();
  }
  /** Record a request that creates a new chat for the given session. Bumps both `requestsSent` and `chatCount`. */
  recordNewChatRequestSent(session) {
    this._recordRequestSent(
      session,
      /* isNewChat */
      true
    );
  }
  /** Record a follow-up request within an existing chat. Bumps `requestsSent` but not `chatCount`. */
  recordRequestSent(session) {
    this._recordRequestSent(
      session,
      /* isNewChat */
      false
    );
  }
  _recordRequestSent(session, isNewChat) {
    const entry = this._ensure(session);
    entry.requestsSent++;
    if (isNewChat) {
      entry.chatCount++;
    }
    if (entry.firstRequestSentAt === 0) {
      entry.firstRequestSentAt = Date.now();
      entry.firstRequestSentInThisClient = true;
    }
    this._updateChangesSummary(entry, session);
    this._save();
  }
  /**
   * Records task-related state observed at the time of the first user
   * request for the given session. Only the first call per tracked session
   * has an effect; subsequent calls are ignored.
   */
  recordFirstRequestTaskInfo(session, info) {
    const entry = this._stats.get(session.sessionId);
    if (!entry || entry.hasWorktreeCreatedTask !== void 0) {
      return;
    }
    entry.hasWorktreeCreatedTask = info.hasWorktreeCreatedTask;
    entry.configuredTasksCount = info.configuredTasksCount;
    this._save();
  }
  /** Increment a named counter. Creates a tracking entry if the session is not yet tracked. */
  bumpCounter(session, key) {
    const entry = this._ensure(session);
    entry[key]++;
    this._updateChangesSummary(entry, session);
    this._save();
  }
  /** Refresh observed change summary for a tracked session. No-op when not tracked. */
  updateSessionState(session) {
    const entry = this._stats.get(session.sessionId);
    if (!entry) {
      return;
    }
    this._updateChangesSummary(entry, session);
    this._save();
  }
  /**
   * Increments the persisted user-request counters (total, per-workspace,
   * per-provider) and returns the new values. Should be called once per
   * brand-new session the user starts from the Agents window.
   */
  incrementAndGetUserRequestCounters(session) {
    const providerId = session.providerId;
    const workspaceUri = session.workspace.get()?.uri.toString();
    const userSessionsTotal = this._storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0) + 1;
    this._storageService.store(TOTAL_SESSIONS_KEY, userSessionsTotal, StorageScope.APPLICATION, StorageTarget.MACHINE);
    const providerCounts = this._readCounterMap(PROVIDER_SESSIONS_KEY);
    const userSessionsForProvider = (providerCounts[providerId] ?? 0) + 1;
    providerCounts[providerId] = userSessionsForProvider;
    this._storageService.store(PROVIDER_SESSIONS_KEY, JSON.stringify(providerCounts), StorageScope.APPLICATION, StorageTarget.MACHINE);
    let userSessionsInWorkspace = 0;
    if (workspaceUri) {
      const workspaceCounts = this._readCounterMap(WORKSPACE_SESSIONS_KEY);
      userSessionsInWorkspace = (workspaceCounts[workspaceUri] ?? 0) + 1;
      workspaceCounts[workspaceUri] = userSessionsInWorkspace;
      this._storageService.store(WORKSPACE_SESSIONS_KEY, JSON.stringify(workspaceCounts), StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
    return { userSessionsTotal, userSessionsInWorkspace, userSessionsForProvider };
  }
  /** Reads the persisted user-request counters without incrementing them. */
  getUserRequestCounters(session) {
    return this._readUserRequestCounters(session.providerId, session.workspace.get()?.uri.toString());
  }
  /** Whether the given session id has a tracking entry. */
  isTracked(sessionId) {
    return this._stats.has(sessionId);
  }
  /** Snapshot of tracked session ids. */
  getTrackedIds() {
    return [...this._stats.keys()];
  }
  /** Snapshot of tracked sessions as `(sessionId, providerId)` pairs. */
  getTrackedEntries() {
    const result = [];
    for (const [sessionId, entry] of this._stats) {
      result.push({ sessionId, providerId: entry.providerId });
    }
    return result;
  }
  /**
   * Build a summary for the given tracked session and remove its entry.
   * Returns `undefined` if the session was not tracked (e.g., already
   * finalized by a competing event).
   */
  finalize(sessionId, reason, finalSession) {
    const entry = this._stats.get(sessionId);
    if (!entry) {
      return void 0;
    }
    if (finalSession) {
      this._updateChangesSummary(entry, finalSession);
    }
    this._stats.delete(sessionId);
    this._save();
    return buildSummary(sessionId, entry, reason, this._appLaunchCount, this._readUserRequestCountersForSummary(entry));
  }
  // -- internals -------------------------------------------------------------
  _readUserRequestCountersForSummary(entry) {
    return this._readUserRequestCounters(entry.providerId, entry.workspaceUriString || void 0);
  }
  _readUserRequestCounters(providerId, workspaceUri) {
    const userSessionsTotal = this._storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0);
    const providerCounts = this._readCounterMap(PROVIDER_SESSIONS_KEY);
    const userSessionsForProvider = providerCounts[providerId] ?? 0;
    let userSessionsInWorkspace = 0;
    if (workspaceUri) {
      const workspaceCounts = this._readCounterMap(WORKSPACE_SESSIONS_KEY);
      userSessionsInWorkspace = workspaceCounts[workspaceUri] ?? 0;
    }
    return { userSessionsTotal, userSessionsInWorkspace, userSessionsForProvider };
  }
  _readCounterMap(key) {
    const raw = this._storageService.get(key, StorageScope.APPLICATION);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  _ensure(session) {
    const id = session.sessionId;
    let entry = this._stats.get(id);
    if (!entry) {
      if (this._stats.size >= MAX_TRACKED_SESSIONS) {
        this._evictOldest();
      }
      entry = createEntry(session, this._appLaunchCount);
      this._stats.set(id, entry);
    }
    return entry;
  }
  _updateChangesSummary(entry, session) {
    const summary = session.changesSummary?.get();
    if (summary) {
      entry.filesChanged = summary.files;
      entry.linesAdded = summary.additions;
      entry.linesDeleted = summary.deletions;
      return;
    }
    let files = 0;
    let additions = 0;
    let deletions = 0;
    for (const change of session.changes.get()) {
      files++;
      additions += change.insertions;
      deletions += change.deletions;
    }
    entry.filesChanged = files;
    entry.linesAdded = additions;
    entry.linesDeleted = deletions;
  }
  _evictOldest() {
    let oldestId;
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [id, entry] of this._stats) {
      if (entry.firstObservedAt < oldestTime) {
        oldestTime = entry.firstObservedAt;
        oldestId = id;
      }
    }
    if (oldestId !== void 0) {
      this._stats.delete(oldestId);
    }
  }
  _load() {
    const raw = this._storageService.get(SESSIONS_KEY, StorageScope.APPLICATION);
    const map = /* @__PURE__ */ new Map();
    if (!raw) {
      return map;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [id, value] of Object.entries(parsed)) {
          if (value && typeof value === "object") {
            map.set(id, value);
          }
        }
      }
    } catch {
    }
    return map;
  }
  _save() {
    if (this._stats.size === 0) {
      this._storageService.remove(SESSIONS_KEY, StorageScope.APPLICATION);
      return;
    }
    const obj = {};
    for (const [id, entry] of this._stats) {
      obj[id] = entry;
    }
    this._storageService.store(SESSIONS_KEY, JSON.stringify(obj), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
}
function createEntry(session, appLaunchCount) {
  const workspace = session.workspace.get();
  const workspaceUriString = workspace?.uri.toString() ?? "";
  const hasWorktree = workspace?.folders.some((folder) => folder.gitRepository?.workTreeUri !== void 0) ?? false;
  const hasGit = workspace?.folders.some((folder) => folder.gitRepository !== void 0) ?? false;
  const isVirtual = workspace ? workspace.uri.scheme !== Schemas.file : false;
  return {
    providerId: session.providerId,
    providerType: session.sessionType,
    sessionResourceUri: session.resource.toString(),
    workspaceUriString,
    isolationKind: hasWorktree ? "worktree" : "folder",
    hasGitRepository: hasGit,
    isVirtualWorkspace: isVirtual,
    firstRequestSentInThisClient: false,
    hasWorktreeCreatedTask: void 0,
    configuredTasksCount: void 0,
    firstObservedAt: Date.now(),
    firstRequestSentAt: 0,
    appLaunchCountAtFirstObserved: appLaunchCount,
    requestsSent: 0,
    chatCount: 0,
    feedbackAdded: 0,
    feedbackConverted: 0,
    feedbackReplyAdded: 0,
    feedbackSubmitted: 0,
    createPullRequest: 0,
    createDraftPullRequest: 0,
    updatePullRequest: 0,
    mergePullRequest: 0,
    checkoutPullRequest: 0,
    initializeRepository: 0,
    commit: 0,
    commitAndSync: 0,
    sessionRestored: 0,
    stickinessToggled: 0,
    maximizeToggled: 0,
    chatDeleted: 0,
    chatRenamed: 0,
    sessionRenamed: 0,
    fixCIChecks: 0,
    taskRun: 0,
    filesChanged: 0,
    linesAdded: 0,
    linesDeleted: 0
  };
}
function buildSummary(sessionId, entry, reason, appLaunchCount, requestCounters) {
  const now = Date.now();
  return {
    agentSessionId: sessionId,
    providerId: entry.providerId,
    providerType: entry.providerType,
    isolationKind: entry.isolationKind,
    workspaceHash: entry.workspaceUriString ? hash(entry.workspaceUriString).toString(16) : "",
    hasGitRepository: entry.hasGitRepository,
    isVirtualWorkspace: entry.isVirtualWorkspace,
    doneReason: reason,
    firstRequestSentInThisClient: entry.firstRequestSentInThisClient,
    hasWorktreeCreatedTask: entry.hasWorktreeCreatedTask,
    configuredTasksCount: entry.configuredTasksCount,
    timeSinceFirstObservedMs: now - entry.firstObservedAt,
    timeSinceFirstRequestMs: entry.firstRequestSentAt > 0 ? now - entry.firstRequestSentAt : -1,
    appLaunchesSinceFirstObserved: appLaunchCount - entry.appLaunchCountAtFirstObserved,
    requestsSent: entry.requestsSent,
    chatCount: entry.chatCount,
    feedbackAdded: entry.feedbackAdded,
    feedbackConverted: entry.feedbackConverted,
    feedbackReplyAdded: entry.feedbackReplyAdded,
    feedbackSubmitted: entry.feedbackSubmitted,
    createPullRequest: entry.createPullRequest,
    createDraftPullRequest: entry.createDraftPullRequest,
    updatePullRequest: entry.updatePullRequest,
    mergePullRequest: entry.mergePullRequest,
    checkoutPullRequest: entry.checkoutPullRequest,
    initializeRepository: entry.initializeRepository,
    commit: entry.commit,
    commitAndSync: entry.commitAndSync,
    sessionRestored: entry.sessionRestored,
    stickinessToggled: entry.stickinessToggled,
    maximizeToggled: entry.maximizeToggled,
    chatDeleted: entry.chatDeleted,
    chatRenamed: entry.chatRenamed,
    sessionRenamed: entry.sessionRenamed,
    fixCIChecks: entry.fixCIChecks,
    taskRun: entry.taskRun,
    filesChanged: entry.filesChanged,
    linesAdded: entry.linesAdded,
    linesDeleted: entry.linesDeleted,
    userSessionsTotal: requestCounters.userSessionsTotal,
    userSessionsInWorkspace: requestCounters.userSessionsInWorkspace,
    userSessionsForProvider: requestCounters.userSessionsForProvider
  };
}
export {
  MAX_TRACKED_SESSIONS,
  SESSIONS_KEY,
  SessionsLifecycleTracker,
  TOTAL_SESSIONS_KEY
};
