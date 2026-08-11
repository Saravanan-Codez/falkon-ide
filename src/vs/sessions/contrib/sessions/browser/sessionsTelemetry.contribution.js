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
import { disposableTimeout } from "../../../../base/common/async.js";
import { hash } from "../../../../base/common/hash.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isChatRequestFileEntry, isImageVariableEntry } from "../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js";
import { getExcludes, ISearchService, QueryType } from "../../../../workbench/services/search/common/search.js";
import { IAgentFeedbackService } from "../../agentFeedback/browser/agentFeedbackService.js";
import { ISessionsTasksService } from "../../chat/browser/sessionsTasksService.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionsPartService } from "../../../services/sessions/browser/sessionsPartService.js";
import { SessionsLifecycleTracker } from "./sessionsLifecycleTracker.js";
let SessionsTelemetryContribution = class extends Disposable {
  constructor(_sessionsManagementService, _sessionsService, _telemetryService, _uriIdentityService, _storageService, _searchService, _configurationService, commandService, agentFeedbackService, sessionsPartService, sessionsProvidersService, _sessionsTasksService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._telemetryService = _telemetryService;
    this._uriIdentityService = _uriIdentityService;
    this._storageService = _storageService;
    this._searchService = _searchService;
    this._configurationService = _configurationService;
    this._sessionsTasksService = _sessionsTasksService;
    /** Final workspace file counts, keyed by session id (so subsequent log calls for the same session are instant). */
    this._workspaceFileCountCache = /* @__PURE__ */ new Map();
    /** Pending workspace file-count fetches, keyed by workspace URI so a prewarm started before a session-id assignment can be picked up after. */
    this._workspaceFileCountInFlight = /* @__PURE__ */ new Map();
    /** Listener per provider that waits for the provider's first batch of sessions so we can run a one-time reconciliation against tracked entries. */
    this._providerReconcileListeners = this._register(new DisposableMap());
    this._lifecycleTracker = this._register(new SessionsLifecycleTracker(this._storageService));
    this._register(this._sessionsManagementService.onWillSendRequest((session) => {
      this._startWorkspaceFileCountFetch(session.workspace.get());
    }));
    this._register(this._sessionsManagementService.onDidSendRequest((e) => {
      if (e.isNewChat) {
        this._logNewChatRequestSent(e);
      } else {
        this._lifecycleTracker.recordRequestSent(e.session);
      }
    }));
    this._register(this._sessionsManagementService.onDidArchiveSession((session) => this._logSessionArchived(session)));
    this._register(this._sessionsManagementService.onDidUnarchiveSession((session) => this._logSessionUnarchived(session)));
    this._register(this._sessionsManagementService.onDidDeleteSession((session) => this._logSessionDeleted(session)));
    this._register(this._sessionsManagementService.onDidDeleteChat((session) => this._logChatDeleted(session)));
    this._register(this._sessionsManagementService.onDidRenameChat((session) => this._logChatRenamed(session)));
    this._register(this._sessionsManagementService.onDidRenameSession((session) => this._logSessionRenamed(session)));
    this._register(this._sessionsService.onDidToggleSessionStickiness((e) => this._logSessionStickinessToggled(e.session, e.sticky)));
    this._register(sessionsPartService.onDidToggleMaximizeSession((e) => this._logSessionMaximizeToggled(e.session, e.maximized)));
    this._register(this._sessionsManagementService.onDidChangeSessions((e) => this._onDidChangeSessions(e)));
    for (const provider of sessionsProvidersService.getProviders()) {
      this._trackProviderForReconciliation(provider);
    }
    this._register(sessionsProvidersService.onDidChangeProviders((e) => {
      for (const provider of e.added) {
        this._trackProviderForReconciliation(provider);
      }
      for (const provider of e.removed) {
        this._providerReconcileListeners.deleteAndDispose(provider.id);
      }
    }));
    this._register(commandService.onDidExecuteCommand((e) => {
      let log;
      switch (e.commandId) {
        case "github.copilot.chat.createPullRequestCopilotCLIAgentSession.createPR":
        case "workbench.action.agentSessions.runSkill.createPR":
          log = (session2) => this._logCreatePullRequest(session2);
          break;
        case "workbench.action.agentSessions.runSkill.createDraftPR":
          log = (session2) => this._logCreateDraftPullRequest(session2);
          break;
        case "workbench.action.agentSessions.runSkill.updatePR":
          log = (session2) => this._logUpdatePullRequest(session2);
          break;
        case "github.copilot.chat.mergeCopilotCLIAgentSessionChanges.merge":
        case "workbench.action.agentSessions.runSkill.merge":
          log = (session2) => this._logMergePullRequest(session2);
          break;
        case "github.copilot.chat.checkoutPullRequestReroute":
        case "pr.checkoutFromChat":
          log = (session2) => this._logCheckoutPullRequest(session2);
          break;
        case "github.copilot.sessions.initializeRepository":
          log = (session2) => this._logInitializeRepository(session2);
          break;
        case "github.copilot.sessions.commit":
          log = (session2) => this._logCommit(session2);
          break;
        case "github.copilot.sessions.commitAndSync":
          log = (session2) => this._logCommitAndSync(session2);
          break;
        case "agentSession.restore":
          log = (session2) => this._logSessionRestored(session2);
          break;
        case "sessions.action.fixCIChecks":
          log = (session2) => this._logFixCIChecks(session2);
          break;
        default:
          return;
      }
      const session = this._getSessionFromCommandArgs(e.args);
      if (session) {
        log(session);
      }
    }));
    this._register(agentFeedbackService.onDidAddFeedback((e) => this._logFeedbackAdded(e)));
    this._register(agentFeedbackService.onDidConvertFeedback((e) => this._logFeedbackConverted(e)));
    this._register(agentFeedbackService.onDidAddReply((e) => this._logFeedbackReplyAdded(e)));
    this._register(agentFeedbackService.onDidSubmitFeedback((e) => this._logFeedbackSubmitted(e)));
    this._register(this._sessionsTasksService.onDidRunTask((e) => this._lifecycleTracker.bumpCounter(e.session, "taskRun")));
  }
  static {
    this.ID = "workbench.contrib.sessionsTelemetry";
  }
  /**
   * Resolves the session a session-scoped command was invoked on. The first
   * argument is expected to be either a session resource {@link URI} or a
   * `{ resource: URI }` shape (e.g. a `ChatSessionItem`). Returns `undefined`
   * if the argument is not a recognized session reference.
   */
  _getSessionFromCommandArgs(args) {
    const first = args[0];
    let resource;
    if (URI.isUri(first)) {
      resource = first;
    } else if (first && typeof first === "object" && URI.isUri(first.resource)) {
      resource = first.resource;
    }
    return resource ? this._sessionsManagementService.getSession(resource) : void 0;
  }
  // -- event handlers --------------------------------------------------------
  _logNewChatRequestSent(e) {
    const { session, chat, isNewSession, options } = e;
    const wasTracked = this._lifecycleTracker.isTracked(session.sessionId);
    this._lifecycleTracker.recordNewChatRequestSent(session);
    if (!wasTracked) {
      void this._sessionsTasksService.getAllTasks(session).then((tasks) => {
        const hasWorktreeCreatedTask = tasks.some((t) => t.task.runOptions?.runOn === "worktreeCreated");
        this._lifecycleTracker.recordFirstRequestTaskInfo(session, { hasWorktreeCreatedTask, configuredTasksCount: tasks.length });
      });
    }
    const allSessions = this._sessionsManagementService.getSessions();
    const visibleSessionsCount = this._sessionsService.visibleSessions.get().filter((s) => s !== void 0).length;
    const workspace = session.workspace.get();
    const requestCounters = isNewSession ? this._lifecycleTracker.incrementAndGetUserRequestCounters(session) : this._lifecycleTracker.getUserRequestCounters(session);
    const sync = {
      isNewSession,
      visibleSessionsCount,
      ...this._getRequestFields(options),
      ...this._getSessionFields(session),
      ...this._getChatFields(chat),
      ...this._getAllSessionsFields(session, allSessions),
      ...requestCounters
    };
    void this._getOrFetchWorkspaceFileCount(session.sessionId, workspace).then((workspaceFileCount) => {
      this._telemetryService.publicLog2("agents/requestSent", {
        ...sync,
        ...this._getWorkspaceFields(workspace, workspaceFileCount)
      });
    });
  }
  _logSessionArchived(session) {
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/sessionArchived", payload);
    });
    this._fireSessionSummary(session, "archived");
  }
  _logSessionUnarchived(session) {
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/sessionUnarchived", payload);
    });
  }
  _logSessionDeleted(session) {
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/sessionDeleted", payload);
    });
    this._fireSessionSummary(session, "deleted");
  }
  _logChatDeleted(session) {
    this._lifecycleTracker.bumpCounter(session, "chatDeleted");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/chatDeleted", payload);
    });
  }
  _logChatRenamed(session) {
    this._lifecycleTracker.bumpCounter(session, "chatRenamed");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/chatRenamed", payload);
    });
  }
  _logSessionRenamed(session) {
    this._lifecycleTracker.bumpCounter(session, "sessionRenamed");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/sessionRenamed", payload);
    });
  }
  _logSessionStickinessToggled(session, sticky) {
    this._lifecycleTracker.bumpCounter(session, "stickinessToggled");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/sessionStickinessToggled", {
        ...payload,
        sticky
      });
    });
  }
  _logSessionMaximizeToggled(session, maximized) {
    this._lifecycleTracker.bumpCounter(session, "maximizeToggled");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/sessionMaximizeToggled", {
        ...payload,
        maximized
      });
    });
  }
  _logCreatePullRequest(session) {
    this._lifecycleTracker.bumpCounter(session, "createPullRequest");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/createPullRequest", payload);
    });
  }
  _logCreateDraftPullRequest(session) {
    this._lifecycleTracker.bumpCounter(session, "createDraftPullRequest");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/createDraftPullRequest", payload);
    });
  }
  _logUpdatePullRequest(session) {
    this._lifecycleTracker.bumpCounter(session, "updatePullRequest");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/updatePullRequest", payload);
    });
  }
  _logMergePullRequest(session) {
    this._lifecycleTracker.bumpCounter(session, "mergePullRequest");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/mergePullRequest", payload);
    });
  }
  _logCheckoutPullRequest(session) {
    this._lifecycleTracker.bumpCounter(session, "checkoutPullRequest");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/checkoutPullRequest", payload);
    });
  }
  _logInitializeRepository(session) {
    this._lifecycleTracker.bumpCounter(session, "initializeRepository");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/initializeRepository", payload);
    });
  }
  _logCommit(session) {
    this._lifecycleTracker.bumpCounter(session, "commit");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/commit", payload);
    });
  }
  _logCommitAndSync(session) {
    this._lifecycleTracker.bumpCounter(session, "commitAndSync");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/commitAndSync", payload);
    });
  }
  _logSessionRestored(session) {
    this._lifecycleTracker.bumpCounter(session, "sessionRestored");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/sessionRestored", payload);
    });
  }
  _logFixCIChecks(session) {
    this._lifecycleTracker.bumpCounter(session, "fixCIChecks");
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/fixCIChecks", payload);
    });
  }
  _logFeedbackAdded(e) {
    const session = this._sessionsManagementService.getSession(e.sessionResource);
    if (!session) {
      return;
    }
    this._lifecycleTracker.bumpCounter(session, "feedbackAdded");
    const hasSuggestion = !!e.feedback.suggestion;
    const hasExistingFeedbackForFile = e.hasExistingFeedbackForFile;
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/feedbackAdded", {
        ...payload,
        hasSuggestion,
        hasExistingFeedbackForFile
      });
    });
  }
  _logFeedbackConverted(e) {
    const session = this._sessionsManagementService.getSession(e.sessionResource);
    if (!session) {
      return;
    }
    this._lifecycleTracker.bumpCounter(session, "feedbackConverted");
    const feedbackKind = e.kind;
    const hasSuggestion = !!e.feedback.suggestion;
    const hasExistingFeedbackForFile = e.hasExistingFeedbackForFile;
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/feedbackConverted", {
        ...payload,
        feedbackKind,
        hasSuggestion,
        hasExistingFeedbackForFile
      });
    });
  }
  _logFeedbackReplyAdded(e) {
    const session = this._sessionsManagementService.getSession(e.sessionResource);
    if (!session) {
      return;
    }
    this._lifecycleTracker.bumpCounter(session, "feedbackReplyAdded");
    const feedbackKind = e.feedback.kind;
    const replyCount = e.replyCount;
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/feedbackReplyAdded", {
        ...payload,
        feedbackKind,
        replyCount
      });
    });
  }
  _logFeedbackSubmitted(e) {
    const session = this._sessionsManagementService.getSession(e.sessionResource);
    if (!session) {
      return;
    }
    this._lifecycleTracker.bumpCounter(session, "feedbackSubmitted");
    const { totalCount, userCount, codeReviewCount, prReviewCount, replyCount } = e;
    void this._getSessionActionPayload(session).then((payload) => {
      this._telemetryService.publicLog2("agents/feedbackSubmitted", {
        ...payload,
        totalCount,
        userCount,
        codeReviewCount,
        prReviewCount,
        replyCount
      });
    });
  }
  // -- cross-client session-done detection -----------------------------------
  /**
   * Reacts to the session list changing across all providers and emits a
   * `agents/sessionSummary` event for tracked sessions that the user
   * finished (archived or deleted) in a different client. Local archive /
   * delete are handled directly by {@link _logSessionArchived} /
   * {@link _logSessionDeleted}; the deferred timer here gives those handlers
   * a chance to claim the tracked entry first so the `doneReason` is
   * reported as `archived` / `deleted` rather than `archivedRemotely` /
   * `deletedRemotely`.
   */
  _onDidChangeSessions(e) {
    for (const session of e.removed) {
      if (!this._lifecycleTracker.isTracked(session.sessionId)) {
        continue;
      }
      this._register(disposableTimeout(() => {
        this._fireSessionSummary(session, "deletedRemotely");
      }, 100));
    }
    for (const session of e.changed) {
      if (!this._lifecycleTracker.isTracked(session.sessionId)) {
        continue;
      }
      if (session.isArchived.get()) {
        this._register(disposableTimeout(() => {
          this._fireSessionSummary(session, "archivedRemotely");
        }, 100));
      } else {
        this._lifecycleTracker.updateSessionState(session);
      }
    }
  }
  /**
   * Schedules a one-time reconciliation of tracked entries for `provider`.
   * Reconciliation runs as soon as the provider reports at least one live
   * session (its "loaded" signal). If the provider already has sessions at
   * registration time, this runs synchronously; otherwise we wait on
   * `onDidChangeSessions` and dispose the listener after the first run.
   */
  _trackProviderForReconciliation(provider) {
    if (this._tryReconcileProvider(provider)) {
      return;
    }
    this._providerReconcileListeners.set(provider.id, provider.onDidChangeSessions(() => {
      if (this._tryReconcileProvider(provider)) {
        this._providerReconcileListeners.deleteAndDispose(provider.id);
      }
    }));
  }
  /**
   * Reconciles tracked entries for `provider` against its current sessions.
   * For each tracked entry: finalizes as `deletedRemotely` when missing, or
   * `archivedRemotely` when present and archived. Returns `true` once the
   * provider has reported at least one session (so the caller can stop
   * listening).
   */
  _tryReconcileProvider(provider) {
    const sessions = provider.getSessions();
    if (sessions.length === 0) {
      return false;
    }
    const trackedForProvider = this._lifecycleTracker.getTrackedEntries().filter((e) => e.providerId === provider.id);
    if (trackedForProvider.length === 0) {
      return true;
    }
    const liveById = /* @__PURE__ */ new Map();
    for (const session of sessions) {
      liveById.set(session.sessionId, session);
    }
    for (const { sessionId } of trackedForProvider) {
      const live = liveById.get(sessionId);
      if (!live) {
        const summary = this._lifecycleTracker.finalize(sessionId, "deletedRemotely");
        if (summary) {
          this._logSessionSummary(summary);
        }
      } else if (live.isArchived.get()) {
        this._fireSessionSummary(live, "archivedRemotely");
      }
    }
    return true;
  }
  _fireSessionSummary(session, reason) {
    const summary = this._lifecycleTracker.finalize(session.sessionId, reason, session);
    if (summary) {
      this._logSessionSummary(summary);
    }
  }
  _logSessionSummary(summary) {
    this._telemetryService.publicLog2("agents/sessionSummary", summary);
  }
  _getSessionActionPayload(session) {
    const workspace = session.workspace.get();
    const sessionFields = this._getSessionFields(session);
    const changesFields = this._getSessionChangesFields(session);
    return this._getOrFetchWorkspaceFileCount(session.sessionId, workspace).then((workspaceFileCount) => ({
      ...sessionFields,
      ...this._getWorkspaceFields(workspace, workspaceFileCount),
      ...changesFields
    }));
  }
  // -- field-group getters (reusable by other telemetry events) --------------
  _getSessionFields(session) {
    return {
      agentSessionId: session.sessionId,
      providerId: session.providerId,
      providerType: session.sessionType,
      chatCount: session.chats.get().length
    };
  }
  _getSessionChangesFields(session) {
    const summary = session.changesSummary?.get();
    if (summary) {
      return {
        sessionFilesChanged: summary.files,
        sessionLinesAdded: summary.additions,
        sessionLinesDeleted: summary.deletions
      };
    }
    let sessionFilesChanged = 0;
    let sessionLinesAdded = 0;
    let sessionLinesDeleted = 0;
    for (const change of session.changes.get()) {
      sessionFilesChanged++;
      sessionLinesAdded += change.insertions;
      sessionLinesDeleted += change.deletions;
    }
    return { sessionFilesChanged, sessionLinesAdded, sessionLinesDeleted };
  }
  _getChatFields(chat) {
    return {
      chatModeKind: chat.mode.get()?.kind ?? ""
    };
  }
  _getWorkspaceFields(workspace, workspaceFileCount) {
    if (!workspace) {
      return {
        isolationKind: "folder",
        workspaceHash: "",
        hasGitRepository: false,
        isVirtualWorkspace: false,
        workspaceFileCount
      };
    }
    const hasWorktree = workspace.folders.some((folder) => folder.gitRepository?.workTreeUri !== void 0);
    return {
      isolationKind: hasWorktree ? "worktree" : "folder",
      workspaceHash: hash(workspace.uri.toString()).toString(16),
      hasGitRepository: workspace.folders.some((folder) => folder.gitRepository !== void 0),
      isVirtualWorkspace: workspace.uri.scheme !== Schemas.file,
      workspaceFileCount
    };
  }
  _getOrFetchWorkspaceFileCount(sessionId, workspace) {
    const cached = this._workspaceFileCountCache.get(sessionId);
    if (cached !== void 0) {
      return Promise.resolve(cached);
    }
    const pending = this._startWorkspaceFileCountFetch(workspace);
    if (!pending) {
      return Promise.resolve(-1);
    }
    return pending.then((count) => {
      this._workspaceFileCountCache.set(sessionId, count);
      return count;
    });
  }
  _startWorkspaceFileCountFetch(workspace) {
    if (!workspace || workspace.folders.length === 0) {
      return void 0;
    }
    const workspaceKey = workspace.uri.toString();
    let pending = this._workspaceFileCountInFlight.get(workspaceKey);
    if (!pending) {
      pending = this._computeWorkspaceFileCount(workspace).then((count) => {
        this._workspaceFileCountInFlight.delete(workspaceKey);
        return count;
      }, () => {
        this._workspaceFileCountInFlight.delete(workspaceKey);
        return -1;
      });
      this._workspaceFileCountInFlight.set(workspaceKey, pending);
    }
    return pending;
  }
  async _computeWorkspaceFileCount(workspace) {
    const excludePattern = getExcludes(this._configurationService.getValue({ resource: workspace.uri }));
    const result = await this._searchService.fileSearch({
      folderQueries: workspace.folders.map((folder) => ({ folder: folder.root, disregardIgnoreFiles: false })),
      type: QueryType.File,
      filePattern: "",
      excludePattern
    });
    return result.results.length;
  }
  _getRequestFields(options) {
    const attachments = options.attachedContext ?? [];
    return {
      queryLength: options.query?.length ?? 0,
      totalAttachementCount: attachments.length,
      fileAttachmentCount: attachments.filter(isChatRequestFileEntry).length,
      imageAttachmentCount: attachments.filter(isImageVariableEntry).length,
      attachmentKinds: JSON.stringify(countAttachmentsByKind(attachments))
    };
  }
  _getAllSessionsFields(anchorSession, allSessions) {
    const anchorWorkspaceUri = anchorSession.workspace.get()?.uri;
    const isSameWorkspace = (other) => {
      if (!anchorWorkspaceUri) {
        return false;
      }
      const otherWorkspaceUri = other.workspace.get()?.uri;
      return otherWorkspaceUri !== void 0 && this._uriIdentityService.extUri.isEqual(anchorWorkspaceUri, otherWorkspaceUri);
    };
    const inCurrentWorkspaceFolderOnly = [];
    const inCurrentWorkspace = [];
    const inAll = [];
    for (const session of allSessions) {
      if (session.isArchived.get()) {
        continue;
      }
      inAll.push(session);
      if (isSameWorkspace(session)) {
        inCurrentWorkspace.push(session);
        const hasWorktree = session.workspace.get()?.folders.some((folder) => folder.gitRepository?.workTreeUri !== void 0) ?? false;
        if (!hasWorktree) {
          inCurrentWorkspaceFolderOnly.push(session);
        }
      }
    }
    const folderOnly = countByStatus(inCurrentWorkspaceFolderOnly);
    const currentWorkspace = countByStatus(inCurrentWorkspace);
    const all = countByStatus(inAll);
    return {
      currentWorkspaceFolderInProgress: folderOnly.inProgress,
      currentWorkspaceFolderUnread: folderOnly.unread,
      currentWorkspaceFolderWaitingForInput: folderOnly.waitingForInput,
      currentWorkspaceFolderNotDone: folderOnly.notDone,
      currentWorkspaceInProgress: currentWorkspace.inProgress,
      currentWorkspaceUnread: currentWorkspace.unread,
      currentWorkspaceWaitingForInput: currentWorkspace.waitingForInput,
      currentWorkspaceNotDone: currentWorkspace.notDone,
      allWorkspacesInProgress: all.inProgress,
      allWorkspacesUnread: all.unread,
      allWorkspacesWaitingForInput: all.waitingForInput,
      allWorkspacesNotDone: all.notDone
    };
  }
};
SessionsTelemetryContribution = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ISearchService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IAgentFeedbackService),
  __decorateParam(9, ISessionsPartService),
  __decorateParam(10, ISessionsProvidersService),
  __decorateParam(11, ISessionsTasksService)
], SessionsTelemetryContribution);
function countByStatus(sessions) {
  let inProgress = 0;
  let unread = 0;
  let waitingForInput = 0;
  for (const session of sessions) {
    const status = session.status.get();
    if (status === SessionStatus.InProgress) {
      inProgress++;
    }
    if (status === SessionStatus.NeedsInput) {
      waitingForInput++;
    }
    if (!session.isRead.get()) {
      unread++;
    }
  }
  return { inProgress, unread, waitingForInput, notDone: sessions.length };
}
function countAttachmentsByKind(attachments) {
  const counts = {};
  for (const attachment of attachments) {
    counts[attachment.kind] = (counts[attachment.kind] ?? 0) + 1;
  }
  return counts;
}
export {
  SessionsTelemetryContribution
};
