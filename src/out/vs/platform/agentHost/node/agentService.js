import { open, unlink } from "fs/promises";
import { decodeBase64, VSBuffer } from "../../../base/common/buffer.js";
import { DeferredPromise, disposableTimeout, ResourceQueue } from "../../../base/common/async.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableResourceMap, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { LRUCache, ResourceMap } from "../../../base/common/map.js";
import { getExtensionForMimeType, getMediaMime } from "../../../base/common/mime.js";
import { Schemas } from "../../../base/common/network.js";
import { observableValue } from "../../../base/common/observable.js";
import { dirname as resourcesDirname, extname as resourcesExtname, extUriBiasedIgnorePathCase, isEqual, isEqualOrParent, joinPath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { hasKey } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
import { FileChangeType, FileOperationResult, toFileOperationResult } from "../../files/common/files.js";
import { InstantiationService } from "../../instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../instantiation/common/serviceCollection.js";
import { ILogService } from "../../log/common/log.js";
import { AgentSession, AgentHostSessionReleaseGraceMsEnvVar, IAgentService, SubagentChatSignal } from "../common/agentService.js";
import { ISessionDataService, SESSION_ATTACHMENTS_DIRNAME } from "../common/sessionDataService.js";
import { parseEditAttributionResource } from "../common/fileEditAttribution.js";
import { SessionConfigKey } from "../common/sessionConfigKeys.js";
import { parseChangesetUri } from "../common/changesetUri.js";
import { ActionType, AuthRequiredReason, isSessionAction } from "../common/state/sessionActions.js";
import { resolveSessionWorkingDirectoryAction } from "../common/state/sessionWorkingDirectories.js";
import { AhpErrorCodes, AHP_SESSION_NOT_FOUND, ContentEncoding, JSON_RPC_INTERNAL_ERROR, ProtocolError, ResourceChangeType, ResourceType, ResourceWriteMode } from "../common/state/sessionProtocol.js";
import { ChatInteractivity, ChatOriginKind, MessageAttachmentKind } from "../common/state/protocol/state.js";
import { MessageKind, ResponsePartKind, SESSION_META_GITHUB_KEY, SESSION_META_GIT_KEY, SESSION_META_MULTI_ROOT_KEY, readSessionSpawnDepth, withSessionSpawnDepth, SessionLifecycle, SessionStatus, ToolCallStatus, ToolResultContentType, AH_META_WORKSPACELESS_DB_KEY, AH_META_IS_ARCHIVED_DB_KEY, AH_META_IS_DONE_DB_KEY, AH_META_IS_READ_DB_KEY, buildChatUri, buildDefaultChatUri, buildResourceWatchChannelUri, buildSubagentChatUri, buildSubagentSessionUriPrefix, hostBuildInfoFromProduct, isAhpChatChannel, isDefaultChatUri, isSubagentChatUri, isSubagentSession, parseDefaultChatUri, parseRequiredSessionUriFromChatUri, parseResourceWatchChannelUri, parseSessionMultiRootMetadata, parseSubagentSessionUri, readSessionGitState, readSessionMultiRootMetadata, readSessionWorkspaceless, withSessionGitHubState, withSessionGitState, withSessionMultiRootMetadata, withSessionStatusFlag, withSessionWorkspaceless, readSessionEhcliAdoptable, withSessionEhcliAdoptable, chatStorageUri, hasReportedUsage } from "../common/state/sessionState.js";
import { readToolCallMeta } from "../common/meta/agentToolCallMeta.js";
import { IProductService } from "../../product/common/productService.js";
import { buildBoundedSideChatSourceContext, getSideChatPartialResponse } from "./agentPeerChats.js";
import { AgentConfigurationService, IAgentConfigurationService } from "./agentConfigurationService.js";
import { AgentHostTerminalManager, IAgentHostTerminalManager } from "./agentHostTerminalManager.js";
import { parseSessionDbUri } from "../common/sessionDbUri.js";
import { parseGitBlobUri } from "./gitDiffContent.js";
import { AgentHostStateManager, IAgentHostStateManager } from "./agentHostStateManager.js";
import { IAgentHostGitService, tryResolvePrimaryWorktreeRoot } from "../common/agentHostGitService.js";
import { AgentSideEffects } from "./agentSideEffects.js";
import { AgentHostLocalTurns } from "./agentHostLocalTurns.js";
import { AgentServerToolHost } from "./shared/agentServerToolHost.js";
import { buildServerToolGroups } from "./shared/serverToolGroups.js";
import { buildWorktreeFailureNotification, WORKTREE_META_REPOSITORY_ROOT, worktreeProjectFromRepositoryRoot } from "./shared/worktreeIsolation.js";
import { AgentHostChangesetService } from "./agentHostChangesetService.js";
import { AgentHostFileMonitorService, IAgentHostFileMonitorService } from "./agentHostFileMonitorService.js";
import { IAgentHostCheckpointService } from "../common/agentHostCheckpointService.js";
import { IAgentHostReviewService } from "../common/agentHostReviewService.js";
import { AgentHostChangesetCoordinator } from "./agentHostChangesetCoordinator.js";
import { AgentHostCompletions } from "./agentHostCompletions.js";
import { AgentHostChatCompletionProvider } from "./agentHostChatCompletionProvider.js";
import { AgentHostFileCompletionProvider } from "./agentHostFileCompletionProvider.js";
import { AgentHostRenameCompletionProvider } from "./agentHostRenameCommand.js";
import { AgentHostSkillCompletionProvider } from "./agentHostSkillCompletionProvider.js";
import { AgentHostWorkspaceFiles } from "./agentHostWorkspaceFiles.js";
import { CodexCompactCompletionProvider } from "./codexCompactCommand.js";
import { CopilotApiService, ICopilotApiService } from "./shared/copilotApiService.js";
import { parseMcpChannelUri } from "./shared/mcpCustomizationController.js";
import { toAgentClientUri } from "../common/agentClientUri.js";
import { AgentHostClientType } from "../common/agentHostClientInfo.js";
import { AgentHostLaunchKind, createUnknownAgentHostClientTelemetryContext } from "../common/agentHostTelemetry.js";
import { AgentHostChangesetOperationService } from "./agentHostChangesetOperationService.js";
import { AgentHostGitStateService } from "./agentHostGitStateService.js";
import { AgentHostGitHubEndpointService, IAgentHostGitHubEndpointService } from "./agentHostGitHubEndpointService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../telemetry/common/telemetryUtils.js";
import { AgentHostAuthenticationService } from "./agentHostAuthenticationService.js";
import { updateAgentHostTelemetryLevelFromConfig } from "./agentHostTelemetryService.js";
import { AgentHostEditTelemetryEnabledConfigKey, AgentHostMigrateLegacyCopilotCliEnabledConfigKey, platformRootSchema } from "../common/agentHostSchema.js";
import { AgentHostOctoKitService, IAgentHostOctoKitService } from "./shared/agentHostOctoKitService.js";
import { IAgentHostChangesetService, CHANGESET_DB_METADATA_KEYS, META_CHANGES_SUMMARY } from "../common/agentHostChangesetService.js";
import { IAgentHostChangesetSubscriptionService } from "../common/agentHostChangesetSubscriptionService.js";
import { AgentHostChangesetSubscriptionService } from "./agentHostChangesetSubscriptionService.js";
import { GIT_DB_METADATA_KEYS, IAgentHostGitStateService, META_GIT_STATE, META_GITHUB_STATE } from "../common/agentHostGitStateService.js";
import { IAgentHostChangesetOperationService } from "../common/agentHostChangesetOperationService.js";
import { AgentHostCommitOperationContribution } from "./agentHostCommitOperationProvider.js";
import { AgentHostDiscardChangesOperationContribution } from "./agentHostDiscardChangesOperationProvider.js";
import { AgentHostPullRequestOperationContribution } from "./agentHostPullRequestOperationProvider.js";
import { AgentHostSyncOperationContribution } from "./agentHostSyncOperationProvider.js";
import { AgentHostReviewService } from "./agentHostReviewService.js";
import { AgentHostCheckpointService } from "./agentHostCheckpointService.js";
const SESSION_GC_GRACE_MS = 3e4;
const HOST_OWNED_SESSION_CONFIG_KEYS = [
  SessionConfigKey.Isolation,
  SessionConfigKey.Branch,
  SessionConfigKey.WorktreeBranchPrefix,
  SessionConfigKey.WorktreeIncludeFiles,
  SessionConfigKey.WorktreeBranchTrack
];
function omitHostOwnedSessionConfig(config) {
  const result = { ...config };
  for (const key of HOST_OWNED_SESSION_CONFIG_KEYS) {
    delete result[key];
  }
  return result;
}
const RESOURCE_WATCH_GRACE_MS = 3e4;
const SUBAGENT_CHAT_PENDING_TIMEOUT_MS = 15e3;
const SESSION_RELEASE_GRACE_MS = (() => {
  const raw = process.env[AgentHostSessionReleaseGraceMsEnvVar];
  const parsed = raw !== void 0 ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3e4;
})();
const PEER_CHATS_METADATA_KEY = "peerChats";
const PEER_CHAT_BACKING_METADATA_KEY = "peerChatBacking";
function reconcileWorkingDirectories(requested, resolved) {
  if (resolved === void 0) {
    return requested?.map((d) => d.toString());
  }
  const tail = (requested ?? []).slice(resolved.length);
  return [...resolved, ...tail].map((d) => d.toString());
}
class AgentService extends Disposable {
  constructor(_logService, _fileService, _sessionDataService, _productService, _gitService, _rootConfigResource, _telemetryService = NullTelemetryService, _fileMonitorService, copilotApiService, fetchFn, providerConfigurations = [], _hostLaunchKind = AgentHostLaunchKind.Unknown) {
    super();
    this._logService = _logService;
    this._fileService = _fileService;
    this._sessionDataService = _sessionDataService;
    this._productService = _productService;
    this._gitService = _gitService;
    this._rootConfigResource = _rootConfigResource;
    this._telemetryService = _telemetryService;
    this._hostLaunchKind = _hostLaunchKind;
    this._resourceWriteQueue = this._register(new ResourceQueue());
    /** Protocol: fires when state is mutated by an action. */
    this._onDidAction = this._register(new Emitter());
    this.onDidAction = this._onDidAction.event;
    /** Protocol: fires for ephemeral notifications (sessionAdded/Removed). */
    this._onDidNotification = this._register(new Emitter());
    this.onDidNotification = this._onDidNotification.event;
    /** Protocol: fires for MCP server-originated notifications routed over `mcp://` channels. */
    this._onMcpNotification = this._register(new Emitter());
    this.onMcpNotification = this._onMcpNotification.event;
    /** Registered providers keyed by their {@link AgentProvider} id. */
    this._providers = /* @__PURE__ */ new Map();
    /** Maps each active session URI (toString) to its owning provider. */
    this._sessionToProvider = /* @__PURE__ */ new Map();
    /**
     * Sessions that have opted in to bring-up progress, keyed by provider id.
     * A session is added here when its `createSession` carries a
     * {@link IAgentCreateSessionConfig.progressToken} and removed once it
     * materializes (the SDK is now resolved) or is disposed. The SDK download is
     * host-level and shared across every session of a provider, so this only
     * records *interest*: as long as one or more sessions of a provider is
     * registered, {@link emitDownloadProgress} surfaces that provider's download as a single
     * progress stream keyed by the download's own identity (the package id),
     * rather than one stream per session.
     */
    this._downloadProgressInterest = /* @__PURE__ */ new Map();
    /** Subscriptions to provider progress events; cleared when providers change. */
    this._providerSubscriptions = this._register(new DisposableStore());
    /**
     * Per-session tail of in-flight persisted peer-chat catalog writes, keyed by
     * session URI string. Read-modify-write updates to the {@link
     * PEER_CHATS_METADATA_KEY} blob are chained per session so a `createChat`,
     * `disposeChat`, and `onDidChangeChatData` racing for the same
     * session can't clobber each other's edits.
     */
    this._peerChatCatalogWrites = /* @__PURE__ */ new Map();
    /** Observable registered agents, drives `root/agentsChanged` via {@link AgentSideEffects}. */
    this._agents = observableValue("agents", []);
    /** Successful list-time repository-root resolutions; eviction only causes safe re-resolution. */
    this._normalizedWorktreeRepositoryRoots = new LRUCache(100);
    this._skillCompletionProviderRegistered = false;
    /**
     * Authoritative server-side per-resource subscription refcount, keyed by
     * resource URI string and valued by the set of subscribed protocol
     * client IDs. Populated by {@link subscribe} (or {@link addSubscriber}
     * for handshake fast-paths) and drained by {@link unsubscribe}. When a
     * resource's set becomes empty, the resource is dropped from the map and
     * {@link _maybeEvictIdleSession} is invoked to release any cached state
     * for it.
     */
    this._resourceSubscribers = new ResourceMap();
    this._releaseSessionInFlight = /* @__PURE__ */ new Map();
    this._restoreSessionInFlight = /* @__PURE__ */ new Map();
    this._restoreSubagentInFlight = /* @__PURE__ */ new Map();
    /** Subagent chats armed for a bounded wait (once execution is confirmed); resolved by {@link _onChatSpawned}, awaited by {@link subscribe}. */
    this._pendingSubagentChats = /* @__PURE__ */ new Map();
    this._pendingSubagentChatTimeouts = this._register(new DisposableMap());
    /** Subagent chats announced via `_meta.subagentChatUri` but still awaiting confirmation, keyed by `${channel}:${toolCallId}`. */
    this._pendingSubagentToolCalls = /* @__PURE__ */ new Map();
    /**
     * Pending {@link _runSessionGc} timers, keyed by session URI. A timer is
     * armed when a session loses its last subscriber while still empty (no
     * turns, no active turn) — see {@link _maybeScheduleSessionGc}. Cleared
     * whenever any client subscribes again or the timer fires.
     */
    this._pendingSessionGc = this._register(new DisposableResourceMap());
    /**
     * Pending {@link _maybeEvictIdleSession} timers, keyed by session URI. A
     * timer is armed when an idle session (with turns) loses its last subscriber
     * — see {@link unsubscribe}. Cleared when any client subscribes again
     * ({@link addSubscriber}) or the timer fires. Deferring the release avoids
     * churning the provider SDK session on rapid disconnect/reconnect cycles.
     */
    this._pendingSessionRelease = this._register(new DisposableResourceMap());
    /**
     * Active resource watches keyed by the channel URI string
     * (`ahp-resource-watch:/<encoded>`).
     *
     * Each entry owns the {@link IFileService} watcher together with the
     * decoded descriptor, the subscriber refcount, and the optional
     * grace-window dispose timer. The watch URI itself is fully
     * self-describing — {@link createResourceWatch} just encodes the
     * caller's params into the URI and returns it. State only exists
     * here once at least one client has subscribed.
     *
     * Lifecycle:
     * - First subscriber to a channel: {@link onResourceWatchSubscribed}
     *   parses the URI, creates the {@link IFileService} watcher, and
     *   installs the entry with `subscribers = 1`.
     * - Subsequent subscribers bump the refcount and cancel any pending
     *   grace-window dispose timer.
     * - {@link onResourceWatchUnsubscribed} drops the refcount; when it
     *   reaches zero we arm a {@link RESOURCE_WATCH_GRACE_MS} dispose
     *   timer rather than tearing down immediately, giving disconnected
     *   clients time to reconnect.
     */
    this._resourceWatches = this._register(new DisposableMap());
    /** Debounces provider `onDidChangeSessionList` bursts into one surface pass. */
    this._surfaceSessionsDebounce = this._register(new MutableDisposable());
    /** Adoptable-legacy session keys already announced this AH lifetime, so bursts don't re-announce them. */
    this._announcedSurfacedKeys = /* @__PURE__ */ new Set();
    /**
     * Per-client sequencer that serialises action dispatches whose
     * processing requires an asynchronous prelude (e.g. resolving a restored
     * peer chat or snapshotting user-message attachments before the action is
     * reduced into state). Actions that don't need any asynchronous prelude
     * bypass the queue entirely as long as no earlier action from the same
     * client is still pending.
     *
     * todo@connor4312: we can drop this when sending a message become a command
     */
    this._clientDispatchQueues = /* @__PURE__ */ new Map();
    this._logService.info("AgentService initialized");
    this._authService = new AgentHostAuthenticationService(_logService);
    this._stateManager = this._register(new AgentHostStateManager(_logService, {
      hostBuildInfo: hostBuildInfoFromProduct(this._productService),
      changesetStateRetention: {
        // The cache calls this lazily after construction. If a future state-manager
        // initialization path registers changesets before `_changesets` is assigned,
        // keep the entry pinned rather than evicting with incomplete liveness data.
        canEvict: (changeset) => this._changesets ? this._isChangesetEvictable(changeset) : false
      }
    }));
    this._register(this._stateManager.onDidEmitEnvelope((e) => this._onDidAction.fire(e)));
    this._register(this._stateManager.onDidEmitEnvelope((e) => this._trackPendingSubagentChatFromEnvelope(e)));
    this._register(this._stateManager.onDidEmitNotification((e) => this._onDidNotification.fire(e)));
    const configurationService = this._register(new AgentConfigurationService(this._stateManager, this._logService, this._rootConfigResource, providerConfigurations));
    this._configurationService = configurationService;
    const fileMonitorService = _fileMonitorService ?? this._register(new AgentHostFileMonitorService(this._fileService, this._logService));
    updateAgentHostTelemetryLevelFromConfig(this._telemetryService, this._stateManager.rootState.config?.values);
    const services = new ServiceCollection(
      [ILogService, this._logService],
      [IAgentService, this],
      [IProductService, this._productService],
      [IAgentConfigurationService, configurationService],
      [IAgentHostStateManager, this._stateManager],
      [IAgentHostFileMonitorService, fileMonitorService],
      [IAgentHostGitService, this._gitService],
      [ITelemetryService, this._telemetryService],
      // The outer agent-host process DI registers `ISessionDataService`,
      // but this nested strict `InstantiationService` does not inherit it.
      // Add it explicitly so `@ISessionDataService` injection into the
      // changeset service (and any future sibling) resolves correctly.
      [ISessionDataService, this._sessionDataService]
    );
    const instantiationService = this._register(new InstantiationService(
      services,
      /*strict*/
      true
    ));
    this._gitHubEndpointService = this._register(instantiationService.createInstance(AgentHostGitHubEndpointService));
    services.set(IAgentHostGitHubEndpointService, this._gitHubEndpointService);
    this._register(this._gitHubEndpointService.onDidChange(() => {
      this._stateManager.emitAuthRequired({
        resource: this._gitHubEndpointService.getCopilotResource().resource,
        reason: AuthRequiredReason.Required
      });
    }));
    const agentHostOctoKitService = instantiationService.createInstance(AgentHostOctoKitService, fetchFn);
    services.set(IAgentHostOctoKitService, agentHostOctoKitService);
    const effectiveCopilotApiService = copilotApiService ?? instantiationService.createInstance(CopilotApiService, fetchFn);
    services.set(ICopilotApiService, effectiveCopilotApiService);
    this._gitStateService = this._register(instantiationService.createInstance(AgentHostGitStateService));
    services.set(IAgentHostGitStateService, this._gitStateService);
    this._checkpointService = this._register(instantiationService.createInstance(AgentHostCheckpointService));
    services.set(IAgentHostCheckpointService, this._checkpointService);
    this._changesetSubscriptions = instantiationService.createInstance(AgentHostChangesetSubscriptionService);
    services.set(IAgentHostChangesetSubscriptionService, this._changesetSubscriptions);
    this._changesetOperationService = this._register(instantiationService.createInstance(AgentHostChangesetOperationService));
    services.set(IAgentHostChangesetOperationService, this._changesetOperationService);
    this._reviewService = this._register(instantiationService.createInstance(AgentHostReviewService));
    services.set(IAgentHostReviewService, this._reviewService);
    this._changesets = this._register(instantiationService.createInstance(AgentHostChangesetService));
    services.set(IAgentHostChangesetService, this._changesets);
    this._changesetCoordinator = this._register(instantiationService.createInstance(AgentHostChangesetCoordinator));
    this._register(this._stateManager.onDidChangeSessionActiveTurn((e) => this._changesetCoordinator.onSessionTurnActiveChanged(e.session, e.active)));
    this._register(this._changesetOperationService.registerContribution(instantiationService.createInstance(AgentHostCommitOperationContribution)));
    this._register(this._changesetOperationService.registerContribution(instantiationService.createInstance(AgentHostPullRequestOperationContribution)));
    this._register(this._changesetOperationService.registerContribution(instantiationService.createInstance(AgentHostSyncOperationContribution)));
    this._register(this._changesetOperationService.registerContribution(instantiationService.createInstance(AgentHostDiscardChangesOperationContribution)));
    this._completions = this._register(instantiationService.createInstance(AgentHostCompletions));
    const workspaceFiles = this._register(instantiationService.createInstance(AgentHostWorkspaceFiles));
    this._register(this._completions.registerProvider(
      new AgentHostFileCompletionProvider(this._stateManager, workspaceFiles, this._logService)
    ));
    this._register(this._completions.registerProvider(
      new AgentHostChatCompletionProvider(this._stateManager)
    ));
    this._register(this._completions.registerProvider(
      new AgentHostRenameCompletionProvider(
        (session) => (this._stateManager.getSessionState(session)?.turns.length ?? 0) > 0
      )
    ));
    this._register(this._completions.registerProvider(
      new CodexCompactCompletionProvider(
        (session) => (this._stateManager.getSessionState(session)?.turns.length ?? 0) > 0
      )
    ));
    this._terminalManager = this._register(instantiationService.createInstance(AgentHostTerminalManager));
    services.set(IAgentHostTerminalManager, this._terminalManager);
    this._localTurns = new AgentHostLocalTurns(this._sessionDataService, this._logService);
    this._sideEffects = this._register(instantiationService.createInstance(AgentSideEffects, this._stateManager, {
      getAgent: (session) => this._findProviderForSession(session),
      sessionDataService: this._sessionDataService,
      localTurns: this._localTurns,
      agents: this._agents,
      hostLaunchKind: this._hostLaunchKind,
      copilotApiService: effectiveCopilotApiService,
      getGitHubCopilotToken: () => {
        return this.getAuthToken({
          resource: this._gitHubEndpointService.getCopilotResource().resource,
          scopes: this._gitHubEndpointService.getCopilotResource().scopes_supported
        });
      },
      getGitHubToken: () => {
        return this.getAuthToken({
          resource: this._gitHubEndpointService.getRepoResource().resource,
          scopes: this._gitHubEndpointService.getRepoResource().scopes_supported
        });
      },
      getGitHubHost: () => this._gitHubEndpointService.getEnterpriseHost() ?? "github.com",
      octoKitService: agentHostOctoKitService,
      resolveWorkingDirectoryBeforeSend: (params) => this._resolveWorkingDirectoryBeforeSend(params),
      resolveChatAttachmentTurns: (resource) => this._resolveChatAttachmentTurns(resource),
      onTurnComplete: (session) => {
        const workingDirStr = this._stateManager.getSessionState(session)?.workingDirectories?.[0];
        void this._gitStateService.attachSessionGitHubPullRequest(session, workingDirStr ? URI.parse(workingDirStr) : void 0);
      },
      onUserMessage: (session, text) => {
        void this._gitStateService.attachSessionGitHubIssues(session.toString(), text);
      }
    }));
    this._serverToolHost = new AgentServerToolHost(this._stateManager, buildServerToolGroups(this._createSessionServerToolAccessor()));
  }
  /** Exposes the state manager for co-hosting a WebSocket protocol server. */
  get stateManager() {
    return this._stateManager;
  }
  /** Exposes the configuration service so agent providers can share root config plumbing. */
  get configurationService() {
    return this._configurationService;
  }
  /** Exposes the GitHub endpoint service so agent providers share GitHub (Enterprise) resource resolution. */
  get gitHubEndpointService() {
    return this._gitHubEndpointService;
  }
  /** Exposes the checkpoint service so agent providers can capture session baselines. */
  get checkpointService() {
    return this._checkpointService;
  }
  /** Exposes the terminal manager for use by agent providers. */
  get terminalManager() {
    return this._terminalManager;
  }
  /** Exposes the completions service for use by agent providers (e.g. to register agent-scoped completion item providers). */
  get completionsService() {
    return this._completions;
  }
  /**
   * Trigger characters announced to clients via `InitializeResult.completionTriggerCharacters`.
   * Aggregated from all registered {@link IAgentHostCompletionItemProvider}s.
   */
  get completionTriggerCharacters() {
    return this._completions.triggerCharacters;
  }
  /**
   * The registered providers. Exposed so process-lifetime background jobs
   * (notably {@link AgentModelRefreshScheduler}) can observe registrations
   * without this service owning an ambient recurring timer of its own.
   */
  get agents() {
    return this._agents;
  }
  /**
   * Fires with the provider id whenever a turn starts. Exposed alongside
   * {@link agents} so {@link AgentModelRefreshScheduler} can gate its periodic
   * refresh on real agent usage rather than polling an idle host.
   */
  get onDidStartTurn() {
    return this._sideEffects.onDidStartTurn;
  }
  // ---- provider registration ----------------------------------------------
  /**
   * Injects the host-owned {@link WorktreeIsolation} controller and forwards it
   * to the collaborators that consult it. Called once at startup (from
   * agentHostMain / agentHostServerMain) after the branch-name generator has
   * been wired.
   */
  setWorktreeIsolation(worktree) {
    this._worktree = worktree;
    this._configurationService.setWorktreeIsolation(worktree);
    this._sideEffects.setWorktreeIsolation(worktree);
  }
  _toProviderConfig(request) {
    if (!this._worktree || !request.config) {
      return request;
    }
    return { ...request, config: omitHostOwnedSessionConfig(request.config) };
  }
  /**
   * Host-owned first-send hook (invoked by {@link AgentSideEffects} before the
   * agent locks its subprocess cwd). Resolves the working directories the session
   * will actually run in and hands them to the agent at send time:
   *  - index 0 is the process root: for `worktree` isolation the isolated
   *    worktree (created here on the first send, see
   *    {@link _resolveWorktreeBeforeSend}); for `folder` isolation the picked
   *    folder; `undefined` (whole result) for workspace-less sessions.
   *  - the tail carries any additional session roots as-is (only index 0 is
   *    worktree-remapped; additional roots are passed through unchanged).
   */
  async _resolveWorkingDirectoryBeforeSend(params) {
    const sessionId = AgentSession.id(params.session);
    const pickedFolders = this._configurationService.getEffectiveWorkingDirectories(params.session);
    const pickedFolderUri = pickedFolders?.[0] ? URI.parse(pickedFolders[0]) : void 0;
    const tail = (pickedFolders ?? []).slice(1).map((d) => URI.parse(d));
    if (!this._worktree?.isWorkingDirectoryPending(sessionId)) {
      if (!pickedFolderUri) {
        return void 0;
      }
      const resolved2 = await this._configurationService.resolveWorkingDirectoryForResume(params.session, pickedFolderUri);
      return [resolved2, ...tail];
    }
    const resolved = await this._resolveWorktreeBeforeSend({ ...params, sessionId, pickedFolderUri }) ?? pickedFolderUri;
    return resolved ? [resolved, ...tail] : void 0;
  }
  async _resolveChatAttachmentTurns(resource) {
    const readTurns = () => {
      const state = this._stateManager.getChatState(resource) ?? this._stateManager.getDefaultChatState(resource);
      return state?.turns;
    };
    const existing = readTurns();
    if (existing) {
      return existing;
    }
    const sessionUri = URI.parse(isAhpChatChannel(resource) ? parseRequiredSessionUriFromChatUri(resource) : resource);
    if (!this._stateManager.getSessionState(sessionUri.toString())) {
      await this.restoreSession(sessionUri);
    } else {
      const provider = this._findProviderForSession(sessionUri);
      if (provider) {
        await this._restorePeerChats(provider, sessionUri);
      }
    }
    if (isAhpChatChannel(resource)) {
      const state = await this._stateManager.resolveChatState(resource);
      if (state) {
        return state.turns;
      }
      throw new Error(`Cannot resolve peer chat attachment: ${resource}`);
    }
    const resolved = readTurns();
    if (resolved) {
      return resolved;
    }
    return [];
  }
  /**
   * Creates the session's isolated worktree on the first send (deferred so the
   * user's prompt can name the branch), reports creation progress as the chat's
   * activity, surfaces the "Created isolated worktree" announcement as the first
   * markdown response part or a durable fallback warning, and returns the created worktree URI.
   * Idempotent; safe to call once the worktree exists. Returns `undefined` when
   * worktree creation failed. Only invoked for sessions whose worktree is still
   * pending (see {@link _resolveWorkingDirectoryBeforeSend}).
   */
  async _resolveWorktreeBeforeSend(params) {
    const { sessionId, pickedFolderUri } = params;
    const worktree = this._worktree;
    if (!worktree) {
      return void 0;
    }
    let reportedActivity = false;
    let failureDiagnostic;
    try {
      await worktree.resolveOnFirstSend({
        sessionUri: URI.parse(params.session),
        sessionId,
        workingDirectory: pickedFolderUri,
        config: this._configurationService.getSessionConfigValues(params.session),
        prompt: params.prompt,
        githubToken: this.getAuthToken({
          resource: this._gitHubEndpointService.getCopilotResource().resource,
          scopes: this._gitHubEndpointService.getCopilotResource().scopes_supported
        }),
        onProgress: (activity) => {
          reportedActivity = true;
          this._stateManager.dispatchServerAction(params.chat, { type: ActionType.ChatActivityChanged, activity });
        }
      });
    } catch (err) {
      failureDiagnostic = toErrorMessage(err);
      this._logService.warn(`[AgentService] worktree resolution failed for ${params.session}: ${failureDiagnostic}`);
    }
    if (reportedActivity) {
      this._stateManager.dispatchServerAction(params.chat, { type: ActionType.ChatActivityChanged, activity: void 0 });
    }
    const resolvedWorktree = worktree.getResolvedWorktree(sessionId);
    if (!resolvedWorktree) {
      try {
        await worktree.persistCreationFailure(URI.parse(params.session), sessionId, failureDiagnostic);
      } catch (err) {
        this._logService.warn(`[AgentService] failed to persist worktree creation failure for ${params.session}: ${toErrorMessage(err)}`);
      }
      this._stateManager.dispatchServerAction(params.chat, {
        type: ActionType.ChatResponsePart,
        turnId: params.turnId,
        part: buildWorktreeFailureNotification(failureDiagnostic)
      });
      return void 0;
    }
    const announcement = worktree.takePendingAnnouncement(sessionId);
    if (announcement !== void 0) {
      this._stateManager.dispatchServerAction(params.chat, {
        type: ActionType.ChatResponsePart,
        turnId: params.turnId,
        part: { kind: ResponsePartKind.Markdown, id: generateUuid(), content: announcement }
      });
    }
    return resolvedWorktree;
  }
  registerProvider(provider) {
    if (this._providers.has(provider.id)) {
      throw new Error(`Agent provider already registered: ${provider.id}`);
    }
    this._logService.info(`Registering agent provider: ${provider.id}`);
    this._providers.set(provider.id, provider);
    provider.setServerToolHost?.(this._serverToolHost);
    void this._authService.replay(provider);
    this._providerSubscriptions.add(provider.onDidSessionProgress((signal) => this._sequenceSpawnedChat(signal)));
    this._providerSubscriptions.add(this._sideEffects.registerProgressListener(provider));
    if (provider.onDidMaterializeSession) {
      this._providerSubscriptions.add(provider.onDidMaterializeSession((e) => this._onDidMaterializeSession(e)));
    }
    if (provider.onDidChangeSessionList) {
      this._providerSubscriptions.add(provider.onDidChangeSessionList(() => this._onProviderSessionListChanged()));
    }
    if (provider.onMcpNotification) {
      this._providerSubscriptions.add(provider.onMcpNotification((e) => this._onMcpNotification.fire(e)));
    }
    if (provider.onDidChangeChatData) {
      this._providerSubscriptions.add(provider.onDidChangeChatData((e) => this._onChatDataChanged(e)));
    }
    if (provider.onDidSpawnChat) {
      this._providerSubscriptions.add(provider.onDidSpawnChat((e) => this._onChatSpawned(e)));
    }
    this._registerSkillCompletionProvider();
    if (!this._defaultProvider) {
      this._defaultProvider = provider.id;
    }
    this._updateAgents();
  }
  _registerSkillCompletionProvider() {
    if (this._skillCompletionProviderRegistered) {
      return;
    }
    this._skillCompletionProviderRegistered = true;
    const provider = this._register(new AgentHostSkillCompletionProvider(
      (session) => this._findProviderForSession(session)
    ));
    this._register(this._completions.registerProvider(provider));
  }
  // ---- auth ---------------------------------------------------------------
  async authenticate(params) {
    return this._authService.authenticate(params, this._providers.values());
  }
  getAuthToken(request) {
    return this._authService.getAuthToken(request);
  }
  // ---- Changeset operation handlers --------------------------------------
  async invokeChangesetOperation(params) {
    return this._changesetOperationService.invokeChangesetOperation(params);
  }
  // ---- MCP `mcp://` channel routing --------------------------------------
  async handleMcpRequest(channel, method, params) {
    const route = parseMcpChannelUri(channel);
    if (!route) {
      throw new Error(`Method not found: invalid mcp:// channel ${channel}`);
    }
    const provider = this._providers.get(route.providerId);
    if (!provider || !provider.handleMcpRequest) {
      throw new Error(`Method not found: no provider for mcp:// channel ${channel}`);
    }
    const sessionUri = AgentSession.uri(route.providerId, route.sessionId);
    return provider.handleMcpRequest(sessionUri, route.serverName, method, params);
  }
  // ---- session management -------------------------------------------------
  /**
   * Builds the dependency surface the session server-tool group needs, bound
   * to this service so the group stays decoupled from the concrete host.
   */
  _createSessionServerToolAccessor() {
    return {
      listSessions: () => this.listSessions(),
      createSession: (config) => this.createSession(config),
      getModels: () => {
        const models = [];
        for (const provider of this._providers.values()) {
          models.push(...provider.models.get());
        }
        return models;
      },
      getCreationDefaults: (source) => this._getServerToolCreationDefaults(source),
      startPrompt: (session, chat, prompt) => this._startSessionPrompt(session, chat, prompt),
      createChat: (session, chat, options) => this.createChat(session, chat, options?.title !== void 0 || options?.model !== void 0 ? { ...options.title !== void 0 ? { title: options.title } : {}, ...options.model !== void 0 ? { model: options.model } : {} } : void 0),
      deleteSession: (session) => this.disposeSession(session),
      getChatContext: (session, chatId) => this._getChatContext(session, chatId),
      // Reads the `create_session` spawn depth from a session's `_meta` (0 when absent).
      getSessionSpawnDepth: (session) => readSessionSpawnDepth(this._stateManager.getSessionSummary(session.toString())?._meta),
      // Stamps a session's `create_session` spawn depth into its `_meta` (merging existing keys).
      setSessionSpawnDepth: (session, depth) => this._stateManager.dispatchServerAction(session.toString(), {
        type: ActionType.SessionMetaChanged,
        _meta: withSessionSpawnDepth(this._stateManager.getSessionSummary(session.toString())?._meta, depth)
      })
    };
  }
  _getServerToolCreationDefaults(source) {
    const session = this._stateManager.getSessionState(source.toString());
    if (!session) {
      return void 0;
    }
    const model = session.activeTurn ? session.activeTurn.message.model : session.draft ? session.draft.model : session.turns.at(-1)?.message.model;
    const config = this._providers.get(session.provider)?.getInheritedSessionConfig?.(session.config?.values ?? {});
    return {
      provider: session.provider,
      ...model !== void 0 ? { model } : {},
      ...config !== void 0 ? { config } : {}
    };
  }
  /**
   * Starts the first turn on a freshly-created session by dispatching a
   * `ChatTurnStarted` and routing it through the same side-effects path a
   * client-initiated turn takes (which sends the message to the provider).
   */
  async _startSessionPrompt(session, chat, prompt) {
    const message = { text: prompt, origin: { kind: MessageKind.User } };
    const action = { type: ActionType.ChatTurnStarted, turnId: generateUuid(), startedAt: (/* @__PURE__ */ new Date()).toISOString(), message };
    this._stateManager.dispatchServerAction(chat.toString(), action);
    this._sideEffects.handleAction(chat.toString(), action);
  }
  /**
   * Reads a point-in-time snapshot of a session's chat conversation for the
   * `get_session_context` server tool. Targets the session's default chat, or a
   * specific peer chat when `chatId` is provided. Returns `undefined` when no
   * live conversation state exists (e.g. a cold/unsubscribed session).
   */
  async _getChatContext(session, chatId) {
    const chatState = chatId ? await this._stateManager.resolveChatState(buildChatUri(session.toString(), chatId)) : this._stateManager.getDefaultChatState(session.toString());
    if (!chatState) {
      return void 0;
    }
    return {
      turns: chatState.turns,
      ...chatState.activeTurn ? { activeTurn: { message: chatState.activeTurn.message, responseParts: chatState.activeTurn.responseParts } } : {},
      hasMoreHistory: !!chatState.turnsNextCursor
    };
  }
  /**
   * Repairs repository roots written by older builds that treated a parent linked checkout as the repository.
   * Listing performs this migration because archived sessions may never resume through WorktreeIsolation's metadata reader.
   */
  async _normalizeListedWorktreeRepositoryRoot(session, database, repositoryRootRaw) {
    const storedRepositoryRootRaw = repositoryRootRaw;
    const persistedRoot = URI.parse(repositoryRootRaw);
    const sessionStr = session.session.toString();
    let primaryRoot = this._normalizedWorktreeRepositoryRoots.get(sessionStr);
    if (!primaryRoot) {
      const workingDirectory = session.workingDirectories?.[0];
      const checkoutRoot = workingDirectory && await this._fileExistsSafe(workingDirectory) ? workingDirectory : persistedRoot;
      try {
        primaryRoot = await tryResolvePrimaryWorktreeRoot(this._gitService, checkoutRoot) ?? (checkoutRoot.toString() !== persistedRoot.toString() ? await tryResolvePrimaryWorktreeRoot(this._gitService, persistedRoot) : void 0);
        if (primaryRoot) {
          this._normalizedWorktreeRepositoryRoots.set(sessionStr, primaryRoot);
        }
      } catch (error) {
        this._logService.warn(`[AgentService][listSessions] Failed to resolve primary worktree for ${session.session}`, error);
      }
    }
    if (primaryRoot) {
      repositoryRootRaw = primaryRoot.toString();
    }
    if (repositoryRootRaw !== storedRepositoryRootRaw) {
      try {
        await database.setMetadata(WORKTREE_META_REPOSITORY_ROOT, repositoryRootRaw);
      } catch (error) {
        this._logService.warn(`[AgentService][listSessions] Failed to normalize worktree repository metadata for ${session.session}`, error);
      }
    }
    return repositoryRootRaw;
  }
  async listSessions() {
    this._logService.trace("[AgentService] listSessions called");
    const results = await Promise.all(
      [...this._providers.values()].map((p) => p.listSessions())
    );
    const flat = results.flat();
    const overlaid = await Promise.all(flat.map(async (s) => {
      const sanitized = { ...s, _meta: withSessionMultiRootMetadata(s._meta, void 0) };
      try {
        const ref = await this._sessionDataService.tryOpenDatabase(s.session);
        if (!ref) {
          return sanitized;
        }
        try {
          const sessionStr = s.session.toString();
          const changesetKeys = this._changesetCoordinator.getListMetadataKeys(sessionStr);
          const metadataKeys = changesetKeys ? { customTitle: true, [AH_META_IS_READ_DB_KEY]: true, [AH_META_IS_ARCHIVED_DB_KEY]: true, [AH_META_IS_DONE_DB_KEY]: true, [AH_META_WORKSPACELESS_DB_KEY]: true, [SESSION_META_MULTI_ROOT_KEY]: true, [PEER_CHAT_BACKING_METADATA_KEY]: true, [WORKTREE_META_REPOSITORY_ROOT]: true, ...GIT_DB_METADATA_KEYS, ...changesetKeys } : { customTitle: true, [AH_META_IS_READ_DB_KEY]: true, [AH_META_IS_ARCHIVED_DB_KEY]: true, [AH_META_IS_DONE_DB_KEY]: true, [AH_META_WORKSPACELESS_DB_KEY]: true, [SESSION_META_MULTI_ROOT_KEY]: true, [PEER_CHAT_BACKING_METADATA_KEY]: true, [WORKTREE_META_REPOSITORY_ROOT]: true, ...GIT_DB_METADATA_KEYS };
          const m = await ref.object.getMetadataObject(metadataKeys);
          if (m[PEER_CHAT_BACKING_METADATA_KEY]) {
            return void 0;
          }
          let updated = sanitized;
          if (m.customTitle) {
            updated = { ...updated, summary: m.customTitle };
          }
          if (m[AH_META_IS_READ_DB_KEY] !== void 0) {
            updated = { ...updated, status: withSessionStatusFlag(updated.status ?? SessionStatus.Idle, SessionStatus.IsRead, m[AH_META_IS_READ_DB_KEY] === "true") };
          }
          const persistedArchived = m[AH_META_IS_ARCHIVED_DB_KEY] ?? m[AH_META_IS_DONE_DB_KEY];
          if (persistedArchived !== void 0) {
            updated = { ...updated, status: withSessionStatusFlag(updated.status ?? SessionStatus.Idle, SessionStatus.IsArchived, persistedArchived === "true") };
          }
          if (m[META_GIT_STATE]) {
            try {
              const gitState = JSON.parse(m[META_GIT_STATE]);
              updated = { ...updated, _meta: withSessionGitState(updated._meta, gitState) };
            } catch (e) {
              this._logService.warn(`[AgentService][listSessions] Failed to parse Git state for ${s.session}`, e);
            }
          }
          if (m[META_GITHUB_STATE]) {
            try {
              const gitHubState = JSON.parse(m[META_GITHUB_STATE]);
              updated = { ...updated, _meta: withSessionGitHubState(updated._meta, gitHubState) };
            } catch (e) {
              this._logService.warn(`[AgentService][listSessions] Failed to parse GitHub state for ${s.session}`, e);
            }
          }
          if (m[AH_META_WORKSPACELESS_DB_KEY] !== void 0) {
            updated = { ...updated, _meta: withSessionWorkspaceless(updated._meta, m[AH_META_WORKSPACELESS_DB_KEY] === "true") };
          }
          const multiRoot = parseSessionMultiRootMetadata(m[SESSION_META_MULTI_ROOT_KEY]);
          if (multiRoot) {
            updated = { ...updated, _meta: withSessionMultiRootMetadata(updated._meta, multiRoot) };
          }
          let repositoryRootRaw = m[WORKTREE_META_REPOSITORY_ROOT];
          if (repositoryRootRaw) {
            repositoryRootRaw = await this._normalizeListedWorktreeRepositoryRoot(updated, ref.object, repositoryRootRaw);
          }
          const worktreeProject = worktreeProjectFromRepositoryRoot(repositoryRootRaw);
          if (worktreeProject) {
            updated = { ...updated, project: worktreeProject };
          }
          return this._changesetCoordinator.decorateListEntry(updated, m);
        } finally {
          ref.dispose();
        }
      } catch (e) {
        this._logService.warn(`[AgentService] Failed to read session metadata overlay for ${s.session}`, e);
      }
      return sanitized;
    }));
    const result = overlaid.filter((s) => s !== void 0);
    const withStatus = result.map((s) => {
      const liveSummary = this._stateManager.getSessionSummary(s.session.toString());
      if (liveSummary) {
        let _meta = liveSummary._meta !== void 0 || s._meta !== void 0 ? { ...s._meta, ...liveSummary._meta } : void 0;
        _meta = withSessionMultiRootMetadata(_meta, readSessionMultiRootMetadata(liveSummary._meta) ?? readSessionMultiRootMetadata(s._meta));
        const liveWorkingDirs = liveSummary.workingDirectories;
        return {
          ...s,
          summary: liveSummary.title || s.summary,
          // Supersedes the flags folded in above: the state manager seeded
          // them from the same database on restore and has applied every
          // mutation since.
          status: liveSummary.status,
          activity: liveSummary.activity,
          modifiedTime: Date.parse(liveSummary.modifiedAt),
          project: liveSummary.project ? { uri: URI.parse(liveSummary.project.uri), displayName: liveSummary.project.displayName } : s.project,
          workingDirectories: liveWorkingDirs !== void 0 ? liveWorkingDirs.map((d) => URI.parse(d)) : s.workingDirectories,
          changes: liveSummary.changes ?? s.changes,
          changesets: this._stateManager.getSessionState(s.session.toString())?.changesets ?? s.changesets,
          ..._meta !== void 0 ? { _meta } : {}
        };
      }
      return s;
    });
    const known = new Set(withStatus.map((s) => s.session.toString()));
    const additions = [];
    for (const summary of this._stateManager.getOverlaySessionSummaries()) {
      if (known.has(summary.resource)) {
        continue;
      }
      if (isSubagentSession(summary.resource)) {
        continue;
      }
      const summaryWorkingDirs = summary.workingDirectories;
      additions.push({
        session: URI.parse(summary.resource),
        startTime: Date.parse(summary.createdAt),
        modifiedTime: Date.parse(summary.modifiedAt),
        summary: summary.title,
        status: summary.status,
        activity: summary.activity,
        workingDirectories: summaryWorkingDirs?.map((d) => URI.parse(d)),
        ...summary.project ? { project: { uri: URI.parse(summary.project.uri), displayName: summary.project.displayName } } : {},
        changes: summary.changes,
        // This overlay path never opens the session database (unlike the
        // provider-returned sessions handled above), so carry the
        // in-memory `summary._meta` directly. It holds the live state
        // (e.g. the GitHub state published when a PR is created), so a
        // freshly-created session that the provider transiently omits
        // still reports it here.
        ...summary._meta !== void 0 ? { _meta: summary._meta } : {}
      });
    }
    const combined = additions.length > 0 ? [...withStatus, ...additions] : withStatus;
    this._logService.trace(`[AgentService] listSessions returned ${combined.length} sessions (${additions.length} state-manager fallback)`);
    return combined;
  }
  /**
   * A provider reported its on-disk session set may have changed (e.g. a legacy
   * Copilot CLI session created by the extension host). Re-list and announce any
   * adoptable-legacy sessions not yet known to clients so they surface without a
   * manual reload.
   */
  _onProviderSessionListChanged() {
    this._surfaceSessionsDebounce.value = disposableTimeout(() => {
      void this._surfaceAdoptableLegacySessions();
    }, 250);
  }
  async _surfaceAdoptableLegacySessions() {
    let listed;
    try {
      listed = await this.listSessions();
    } catch (err) {
      this._logService.warn("[AgentService] surfaceAdoptableLegacySessions: listSessions failed", err);
      return;
    }
    for (const meta of listed) {
      if (!readSessionEhcliAdoptable(meta._meta)) {
        continue;
      }
      const provider = AgentSession.provider(meta.session);
      if (!provider) {
        continue;
      }
      const key = meta.session.toString();
      if (this._announcedSurfacedKeys.has(key)) {
        continue;
      }
      if (this._stateManager.getSessionState(key)) {
        continue;
      }
      this._stateManager.announceSurfacedSession(this._surfacedSessionSummary(meta, provider));
      this._announcedSurfacedKeys.add(key);
    }
  }
  /** Synthesizes the minimal {@link SessionSummary} for an adoptable session surfaced by {@link listSessions}. */
  _surfacedSessionSummary(meta, provider) {
    return {
      resource: meta.session.toString(),
      provider,
      title: meta.summary ?? "",
      status: meta.status ?? SessionStatus.Idle,
      createdAt: new Date(meta.startTime).toISOString(),
      modifiedAt: new Date(meta.modifiedTime).toISOString(),
      ...meta.project ? { project: { uri: meta.project.uri.toString(), displayName: meta.project.displayName } } : {},
      workingDirectories: meta.workingDirectories?.map((d) => d.toString()),
      // Marks the session adoptable so clients don't passively subscribe (and
      // thereby migrate) it before the user opens it.
      _meta: withSessionEhcliAdoptable(meta._meta)
    };
  }
  async createSession(config) {
    const providerId = config?.provider ?? this._defaultProvider;
    const provider = providerId ? this._providers.get(providerId) : void 0;
    if (!provider) {
      throw new Error(`No agent provider registered for: ${providerId ?? "(none)"}`);
    }
    if (config?.workingDirectories && config.workingDirectories.length > 1) {
      const supportsMultiple = !!provider.getDescriptor().capabilities?.multipleWorkingDirectories;
      if (!supportsMultiple) {
        this._logService.warn(`[AgentService] Provider '${providerId}' does not advertise multipleWorkingDirectories; truncating ${config.workingDirectories.length} working directories to 1.`);
        config = { ...config, workingDirectories: [config.workingDirectories[0]] };
      }
    }
    if (config?.fork) {
      const sourceState = this._stateManager.getSessionState(config.fork.session.toString());
      const sourceTurns = sourceState?.turns.slice(0, config.fork.turnIndex + 1) ?? [];
      if (sourceTurns.length === 0) {
        config = { ...config, fork: void 0 };
      } else {
        const turnIdMapping = /* @__PURE__ */ new Map();
        for (const t of sourceTurns) {
          turnIdMapping.set(t.id, generateUuid());
        }
        const concreteForkTurnId = this._localTurns.resolveConcreteTurnId(buildDefaultChatUri(config.fork.session).toString(), config.fork.turnId);
        config = {
          ...config,
          fork: { ...config.fork, turnIdMapping, ...concreteForkTurnId !== void 0 ? { turnId: concreteForkTurnId } : {} }
        };
      }
    }
    if (config?.importConversation) {
      const importedTurns = config.importConversation.turns.map((t) => ({ ...t, id: generateUuid() }));
      config = { ...config, importConversation: { ...config.importConversation, turns: importedTurns } };
    }
    const initializeSideEffects = this._sideEffects.initialize();
    const sessionConfig = await this._resolveCreatedSessionConfig(provider, config);
    const deferWorktreeCreation = sessionConfig?.values?.[SessionConfigKey.Isolation] === "worktree" && !config?.fork && !config?.importConversation;
    this._logService.trace(`[AgentService] createSession: initializing auto-approver and creating session...`);
    const [, created] = await Promise.all([
      initializeSideEffects,
      this._createProviderSession(provider, config, deferWorktreeCreation)
    ]);
    const session = created.session;
    this._logService.trace(`[AgentService] createSession: initialization complete`);
    this._cancelPendingSessionGc(session);
    this._cancelPendingSessionRelease(session);
    this._logService.trace(`[AgentService] createSession: provider=${provider.id} model=${config?.model?.id ?? "(default)"}`);
    this._sessionToProvider.set(session.toString(), provider.id);
    if (config?.progressToken) {
      let sessions = this._downloadProgressInterest.get(provider.id);
      if (!sessions) {
        sessions = /* @__PURE__ */ new Set();
        this._downloadProgressInterest.set(provider.id, sessions);
      }
      sessions.add(session.toString());
    }
    this._logService.trace(`[AgentService] createSession returned: ${session.toString()}`);
    const provisionalState = created.provisional && !config?.fork && !config?.importConversation ? (() => {
      const summary = this._buildInitialSummary(provider, session, config, created, "");
      const state = this._stateManager.createSession(summary, { emitNotification: false });
      state.config = sessionConfig;
      state.activeClients = config?.activeClient ? [config.activeClient] : [];
      return state;
    })() : void 0;
    const initialCustomizations = await (provider.getSessionCustomizations ? provider.getSessionCustomizations(session).catch((err) => {
      this._logService.error("[AgentService] createSession: failed to resolve initial customizations", err);
      return void 0;
    }) : Promise.resolve(void 0));
    if (config?.fork) {
      const sourceState = this._stateManager.getSessionState(config.fork.session.toString());
      const sourceChatUri = buildDefaultChatUri(config.fork.session).toString();
      const newChatUri = buildDefaultChatUri(session).toString();
      let sourceTurns = [];
      if (sourceState && config.fork.turnIdMapping) {
        const originalSlice = sourceState.turns.slice(0, config.fork.turnIndex + 1);
        const mapping = config.fork.turnIdMapping;
        sourceTurns = originalSlice.map((t) => ({ ...t, id: mapping.get(t.id) ?? generateUuid() }));
        this._persistForkedLocalTurns(session.toString(), sourceChatUri, newChatUri, originalSlice, sourceTurns, mapping);
      }
      const forkedTitlePrefix = localize("agentHost.forkedTitlePrefix", "Forked: ");
      const sourceTitle = sourceState?.title;
      const forkedTitle = sourceTitle ? sourceTitle.startsWith(forkedTitlePrefix) ? sourceTitle : `${forkedTitlePrefix}${sourceTitle}` : localize("agentHost.forkedSessionFallback", "Forked Session");
      const summary = this._buildInitialSummary(provider, session, config, created, forkedTitle);
      const state = this._stateManager.createSession(summary);
      state.config = sessionConfig;
      this._stateManager.seedDefaultChatTurns(summary.resource, sourceTurns);
      state.activeClients = config.activeClient ? [config.activeClient] : [];
      if (initialCustomizations && initialCustomizations.length > 0) {
        state.customizations = [...initialCustomizations];
      }
      if (sourceTurns.length > 0) {
        this._sideEffects.generateForkedTitle(summary.resource, void 0, sourceTurns, forkedTitle, sourceTitle);
      }
    } else if (config?.importConversation) {
      const importedTurns = [...config.importConversation.turns];
      const importedTitle = this._buildImportedTitle(importedTurns);
      const summary = this._buildInitialSummary(provider, session, config, created, importedTitle);
      const state = this._stateManager.createSession(summary);
      state.config = sessionConfig;
      this._stateManager.seedDefaultChatTurns(summary.resource, importedTurns);
      state.activeClients = config.activeClient ? [config.activeClient] : [];
      if (initialCustomizations && initialCustomizations.length > 0) {
        state.customizations = [...initialCustomizations];
      }
      if (importedTurns.length > 0) {
        this._sideEffects.generateForkedTitle(summary.resource, void 0, importedTurns, importedTitle);
      }
    } else {
      const summary = this._buildInitialSummary(provider, session, config, created, "");
      const state = provisionalState ?? this._stateManager.createSession(summary, { emitNotification: true });
      if (!provisionalState) {
        state.config = sessionConfig;
        state.activeClients = config?.activeClient ? [config.activeClient] : [];
      }
      if (initialCustomizations && initialCustomizations.length > 0) {
        state.customizations = [...initialCustomizations];
      }
    }
    if (sessionConfig?.values && Object.keys(sessionConfig.values).length > 0 && !created.provisional) {
      this._persistConfigValues(session, sessionConfig.values);
    }
    this._changesetCoordinator.onSessionCreated(session.toString());
    if (!created.provisional) {
      this._persistWorkspaceless(session, readSessionWorkspaceless(this._stateManager.getSessionSummary(session.toString())?._meta));
      this._persistMultiRoot(session, readSessionMultiRootMetadata(this._stateManager.getSessionSummary(session.toString())?._meta));
      this._stateManager.dispatchServerAction(session.toString(), { type: ActionType.SessionReady });
    }
    const workingDirectory = created.resolvedWorkingDirectory ?? config?.workingDirectories?.[0];
    void this._gitStateService.refreshSessionGitState(session.toString(), workingDirectory);
    return session;
  }
  async createChat(session, chat, options) {
    const sessionKey = session.toString();
    const provider = this._findProviderForSession(session);
    if (!provider) {
      throw new Error(`[AgentService] createChat: no provider for session ${sessionKey}`);
    }
    if (!this._supportsChats(provider)) {
      throw new Error(`[AgentService] createChat: provider ${provider.id} does not support multiple chats`);
    }
    let forkedTurns;
    let forkedTitle;
    let forkedSourceTitle;
    let createOptions = options;
    let sideChatOrigin;
    if (options?.sideChat) {
      const resolvedSideChat = await this._resolveSideChatOrigin(session, options.sideChat);
      sideChatOrigin = resolvedSideChat.origin;
      createOptions = {
        ...options,
        sideChat: {
          ...options.sideChat,
          source: URI.parse(resolvedSideChat.sourceChat),
          ...resolvedSideChat.providerAnchorTurnId ? { providerAnchorTurnId: resolvedSideChat.providerAnchorTurnId } : {},
          ...resolvedSideChat.sourceContext ? { sourceContext: resolvedSideChat.sourceContext } : {},
          ...resolvedSideChat.partialResponse ? { partialResponse: resolvedSideChat.partialResponse } : {}
        }
      };
    }
    if (options?.fork) {
      const { sourceChatKey, sourceSessionKey, sourceState } = await this._resolveSessionSourceChat(options.fork.source);
      const sourceTurns = sourceState?.turns ?? [];
      const forkIndex = sourceTurns.findIndex((t) => t.id === options.fork.turnId);
      if (forkIndex < 0) {
        createOptions = { ...options, fork: void 0 };
      } else {
        const slice = sourceTurns.slice(0, forkIndex + 1);
        const turnIdMapping = /* @__PURE__ */ new Map();
        for (const t of slice) {
          turnIdMapping.set(t.id, generateUuid());
        }
        forkedTurns = slice.map((t) => ({ ...t, id: turnIdMapping.get(t.id) ?? generateUuid() }));
        this._persistForkedLocalTurns(sessionKey, sourceChatKey, chat.toString(), slice, forkedTurns, turnIdMapping);
        const forkedTitlePrefix = localize("agentHost.forkedTitlePrefix", "Forked: ");
        forkedSourceTitle = sourceState?.title || this._stateManager.getSessionState(sourceSessionKey)?.title;
        forkedTitle = forkedSourceTitle ? forkedSourceTitle.startsWith(forkedTitlePrefix) ? forkedSourceTitle : `${forkedTitlePrefix}${forkedSourceTitle}` : localize("agentHost.forkedChatFallback", "Forked Chat");
        const concreteForkTurnId = this._localTurns.resolveConcreteTurnId(sourceChatKey, options.fork.turnId);
        createOptions = { ...options, fork: { ...options.fork, turnIdMapping, ...concreteForkTurnId !== void 0 ? { turnId: concreteForkTurnId } : {} } };
      }
    }
    const createResult = await this._createChat(provider, chat, createOptions);
    const providerData = createResult?.providerData;
    this._stateManager.addChat(sessionKey, chat.toString(), {
      ...forkedTitle !== void 0 ? { title: forkedTitle } : options?.title !== void 0 ? { title: options.title } : {},
      ...forkedTurns !== void 0 ? { turns: forkedTurns } : {},
      ...providerData !== void 0 ? { providerData } : {},
      ...sideChatOrigin !== void 0 ? { origin: sideChatOrigin } : {}
    });
    void this._persistPeerChat(session, chat, providerData, sideChatOrigin);
    if (createResult?.backingSession) {
      this._markPeerChatBacking(createResult.backingSession, chat);
    }
    if (forkedTurns && forkedTurns.length > 0 && forkedTitle !== void 0) {
      this._sideEffects.generateForkedTitle(sessionKey, chat.toString(), forkedTurns, forkedTitle, forkedSourceTitle);
    }
  }
  /**
   * Validates a side chat's source and returns its {@link ChatOriginKind.SideChat}
   * origin. Throws when the source chat is not part of `session` or when the
   * referenced completed or active turn is absent.
   */
  async _resolveSideChatOrigin(session, sideChat) {
    const sessionKey = session.toString();
    const sourceKey = sideChat.source.toString();
    const { sourceChatKey, sourceSessionKey, sourceState } = await this._resolveSessionSourceChat(sideChat.source);
    if (sourceSessionKey !== sessionKey) {
      throw new Error(`[AgentService] createChat: side chat source ${sourceKey} does not belong to session ${sessionKey}`);
    }
    const activeTurn = sourceState?.activeTurn?.id === sideChat.turnId ? sourceState.activeTurn : void 0;
    const hasCompletedTurn = sourceState?.turns.some((t) => t.id === sideChat.turnId) ?? false;
    if (!hasCompletedTurn && !activeTurn) {
      throw new Error(`[AgentService] createChat: side chat source turn ${sideChat.turnId} not found in ${sourceKey}`);
    }
    const isLocalSourceTurn = !activeTurn && this._localTurns.isLocal(sourceChatKey, sideChat.turnId);
    const providerAnchorTurnId = isLocalSourceTurn ? this._localTurns.resolveConcreteTurnId(sourceChatKey, sideChat.turnId) : void 0;
    const partialResponse = getSideChatPartialResponse(activeTurn);
    const sourceContext = activeTurn || isLocalSourceTurn ? buildBoundedSideChatSourceContext(sourceState?.turns ?? [], sideChat.turnId, activeTurn) : void 0;
    const selection = sideChat.selection?.text.trim() ? sideChat.selection : sideChat.selection ? (() => {
      throw new Error("[AgentService] createChat: side chat selection text must be non-empty");
    })() : void 0;
    return {
      origin: {
        kind: ChatOriginKind.SideChat,
        chat: sourceChatKey,
        turnId: sideChat.turnId,
        ...selection ? { selection } : {}
      },
      sourceChat: sourceChatKey,
      ...selection ? { selection } : {},
      ...providerAnchorTurnId ? { providerAnchorTurnId } : {},
      ...sourceContext ? { sourceContext } : {},
      ...partialResponse ? { partialResponse } : {}
    };
  }
  async _resolveSessionSourceChat(source) {
    const sourceKey = source.toString();
    const sourceSessionKey = isAhpChatChannel(sourceKey) ? parseRequiredSessionUriFromChatUri(sourceKey) : sourceKey;
    const defaultChatKey = this._stateManager.getSessionState(sourceSessionKey)?.defaultChat ?? buildDefaultChatUri(sourceSessionKey);
    const isDefaultSource = sourceKey === sourceSessionKey || isDefaultChatUri(sourceKey);
    const sourceChatKey = isDefaultSource ? defaultChatKey : sourceKey;
    return {
      sourceSessionKey,
      sourceChatKey,
      sourceState: isDefaultSource ? this._stateManager.getChatState(defaultChatKey) ?? this._stateManager.getDefaultChatState(sourceSessionKey) : await this._stateManager.resolveChatState(sourceChatKey)
    };
  }
  async disposeChat(session, chat) {
    const sessionKey = session.toString();
    const provider = this._findProviderForSession(session);
    this._sideEffects.clearQueuedMessageSenders(chat.toString());
    this._sideEffects.cancelSubagentSessions(chat.toString());
    this._sideEffects.clearToolCallTelemetry(chat.toString());
    this._stateManager.removeChat(sessionKey, chat.toString());
    void this._removePersistedPeerChat(session, chat);
    if (provider) {
      await this._disposeChat(provider, chat);
    }
  }
  // ---- Chat dispatch adapter ---------------------------------------------
  //
  // The orchestrator owns the feature-level `(session, chat)` →
  // `(agent, session, chat)` mapping. It dispatches against an agent's
  // chat-addressed surface ({@link IAgent.chats}) and session lifecycle
  // ({@link IAgent.createSession}/{@link IAgent.disposeSession}).
  /** Whether `provider` can host additional (peer) chats. */
  _supportsChats(provider) {
    return !!provider.chats;
  }
  async _createProviderSession(provider, config, deferWorktreeCreation) {
    const requestedSessionId = deferWorktreeCreation && config?.session ? AgentSession.id(config.session) : void 0;
    if (requestedSessionId) {
      this._worktree?.notePending(requestedSessionId);
    }
    let created;
    try {
      created = await provider.createSession(config ? this._toProviderConfig({ ...config, _meta: void 0 }) : void 0);
      if (deferWorktreeCreation && created.provisional) {
        this._worktree?.notePending(AgentSession.id(created.session));
      }
      return created;
    } finally {
      const returnedPendingSessionId = created?.provisional ? AgentSession.id(created.session) : void 0;
      if (requestedSessionId && requestedSessionId !== returnedPendingSessionId) {
        this._worktree?.clearPending(requestedSessionId);
      }
    }
  }
  async _disposeSession(provider, session) {
    await provider.disposeSession(session);
  }
  /**
   * Reconstruct the turns for a chat. `chat` is the concrete chat channel URI,
   * except for legacy restore paths that still address subagent sessions.
   */
  async _getChatMessages(provider, chat) {
    const turns = await this._applyPersistedTurnUsage(chat, await provider.chats.getMessages(chat));
    if (this._worktree && isDefaultChatUri(chat)) {
      return this._worktree.applyRestoreAnnouncement(URI.parse(parseRequiredSessionUriFromChatUri(chat.toString())), turns);
    }
    return turns;
  }
  /**
   * Re-attaches persisted per-turn {@link UsageInfo} to reconstructed turns.
   *
   * Agent backends don't durably record token/credit usage — the Copilot
   * SDK's `assistant.usage` event is explicitly ephemeral and the Claude
   * transcript replay produces none — so restored turns come back without it.
   * Without this the chat's context-usage gauge stays hidden after a reload
   * and the session cost total restarts from zero. Usage recorded live by
   * {@link AgentSideEffects} is looked up by turn id (or the turn's SDK event
   * id, which is what a restored turn is keyed by).
   *
   * NOTE: the lookup only lands for providers that record the bridge between
   * the live protocol turn id (a host-generated uuid) and the id a restored
   * turn is keyed by. Today only Copilot does, via `setTurnEventId`. Claude
   * restores turns keyed by transcript uuid and never populates
   * `turns.event_id`, so its rows are written but never matched; giving it a
   * gauge after reload needs that bridge recorded first.
   */
  async _applyPersistedTurnUsage(chat, turns) {
    if (turns.length === 0 || turns.every((turn) => hasReportedUsage(turn.usage)) || isSubagentChatUri(chat.toString())) {
      return turns;
    }
    const storage = chatStorageUri(chat);
    if (!storage) {
      return turns;
    }
    let usages;
    const ref = await this._sessionDataService.tryOpenDatabase(storage);
    if (!ref) {
      return turns;
    }
    try {
      usages = await ref.object.getTurnUsages();
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to read persisted turn usage for ${storage.toString()}`, err);
      return turns;
    } finally {
      ref.dispose();
    }
    if (usages.size === 0) {
      return turns;
    }
    return turns.map((turn) => {
      const raw = hasReportedUsage(turn.usage) ? void 0 : usages.get(turn.id);
      if (!raw) {
        return turn;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return turn;
        }
        const persisted = parsed;
        const meta = { ...turn.usage?._meta, ...persisted._meta };
        return {
          ...turn,
          usage: {
            ...turn.usage,
            ...persisted,
            ...Object.keys(meta).length > 0 ? { _meta: meta } : {}
          }
        };
      } catch {
        return turn;
      }
    });
  }
  /**
   * Merges persisted host-injected local turns (`/rename`, `!command`) for
   * `chatUri` back into that chat's SDK-derived `turns`, positioned after
   * their anchor turn (the concrete turn they were recorded after). Locals
   * anchored before any real turn are prepended; locals whose anchor is absent
   * from the SDK turns (e.g. truncated away) are dropped. Also seeds the
   * in-memory local-turn index so fork/truncate resolve correctly before the
   * next reload.
   */
  async _interleaveLocalTurns(sessionStr, chatUri, turns) {
    const records = await this._localTurns.loadForChat(sessionStr, chatUri);
    if (records.length === 0) {
      return [...turns];
    }
    const knownIds = new Set(turns.map((t) => t.id));
    const byAnchor = /* @__PURE__ */ new Map();
    const head = [];
    for (const record of records) {
      let turn;
      try {
        turn = JSON.parse(record.payload);
      } catch {
        continue;
      }
      if (record.anchorTurnId === void 0) {
        head.push(turn);
      } else if (knownIds.has(record.anchorTurnId)) {
        const list = byAnchor.get(record.anchorTurnId) ?? [];
        list.push(turn);
        byAnchor.set(record.anchorTurnId, list);
      }
    }
    const merged = [...head];
    for (const turn of turns) {
      merged.push(turn);
      const locals = byAnchor.get(turn.id);
      if (locals) {
        merged.push(...locals);
      }
    }
    return merged;
  }
  /**
   * Re-persists forked host-injected local turns (`/rename`, `!command`) into
   * a newly forked chat so they survive reload and anchor future
   * fork/truncate. `originalSlice[i]` and `forkedTurns[i]` are the source turn
   * and its remapped copy (same length, 1:1); `mapping` is the old→new turn id
   * map used to remap each local turn's anchor. `persistSession` owns the
   * destination database; `sourceChatUri` / `newChatUri` key the source and
   * destination local-turn indexes.
   *
   * Shared by the {@link createSession} (default-chat) and {@link createChat}
   * (peer-chat) fork paths.
   */
  _persistForkedLocalTurns(persistSession, sourceChatUri, newChatUri, originalSlice, forkedTurns, mapping) {
    for (let i = 0; i < originalSlice.length; i++) {
      const original = originalSlice[i];
      if (!this._localTurns.isLocal(sourceChatUri, original.id)) {
        continue;
      }
      const originalAnchor = this._localTurns.resolveConcreteTurnId(sourceChatUri, original.id);
      const newAnchor = originalAnchor !== void 0 ? mapping.get(originalAnchor) : void 0;
      this._localTurns.record(persistSession, newChatUri, forkedTurns[i], newAnchor);
    }
  }
  /**
   * Create (or fork) the peer chat `chat` within `session`. `chat` is
   * always a peer URI here (the default chat is created implicitly with
   * the session), so no default-chat resolution is needed.
   */
  _createChat(provider, chat, options) {
    const convOptions = options && (options.title !== void 0 || options.model !== void 0 || options.sideChat !== void 0) ? {
      ...options.title !== void 0 ? { title: options.title } : {},
      ...options.model !== void 0 ? { model: options.model } : {},
      ...options.sideChat !== void 0 ? { sideChat: options.sideChat } : {}
    } : void 0;
    return options?.fork ? provider.chats.fork(chat, options.fork, convOptions) : provider.chats.createChat(chat, convOptions);
  }
  async _disposeChat(provider, chat) {
    await provider.chats.disposeChat(chat);
  }
  /**
   * Derives a placeholder title for an imported session from its first user
   * turn (imports seed pre-existing turns, so the normal first-message title
   * generation never fires). Deliberately unprefixed: an imported session is a
   * continuation of the source chat, not a distinct kind of session, so it
   * should read like any other. The placeholder is later refined into a
   * generated title (see the `importConversation` branch in `createSession`),
   * but a neutral non-empty fallback is kept so the session still reads like a
   * normal chat when generation is unavailable or fails.
   */
  _buildImportedTitle(turns) {
    const firstText = turns.find((t) => t.message?.text?.trim())?.message.text.trim();
    if (!firstText) {
      return localize("agentHost.importedSessionFallback", "New Session");
    }
    const MAX = 60;
    return firstText.length > MAX ? `${firstText.slice(0, MAX)}...` : firstText;
  }
  _buildInitialSummary(provider, session, config, created, title) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const explicitMultiRoot = readSessionMultiRootMetadata(config?._meta);
    const inheritedMultiRoot = config?.fork ? readSessionMultiRootMetadata(this._stateManager.getSessionSummary(config.fork.session.toString())?._meta) : void 0;
    let _meta = withSessionMultiRootMetadata(void 0, explicitMultiRoot ?? inheritedMultiRoot);
    _meta = !config?.fork && !config?.workingDirectories ? withSessionWorkspaceless(_meta, true) : _meta;
    return {
      resource: session.toString(),
      provider: provider.id,
      title,
      status: SessionStatus.Idle,
      createdAt: now,
      modifiedAt: now,
      ...created.project ? { project: { uri: created.project.uri.toString(), displayName: created.project.displayName } } : {},
      // The provider resolved only its process root (index 0), which may
      // differ from the requested primary (e.g. a workspace-less scratch dir).
      // Assemble the session set by overriding the requested primary with it
      // and keeping the requested tail; the fully-resolved multi-root set
      // arrives later via the materialization receipt.
      workingDirectories: reconcileWorkingDirectories(config?.workingDirectories, created.resolvedWorkingDirectory ? [created.resolvedWorkingDirectory] : void 0),
      // Workspace-less is inferred at create from an absent input
      // `workingDirectories` (the host assigns a scratch cwd, so it can't be
      // re-inferred later) and tagged on the generic `_meta` bag. Use
      // `=== undefined` so an explicit empty set (`[]`) is NOT treated as
      // workspace-less.
      ..._meta ? { _meta } : {}
    };
  }
  /**
   * Listen for an agent transitioning a provisional session into a fully
   * materialized SDK session. The agent has already created the worktree
   * (if any) and persisted on-disk metadata; we need to:
   * - Refresh the in-memory summary with the resolved working directory
   *   and project metadata.
   * - Persist any config values now that we have a real on-disk session.
   * - Emit the deferred `notify/sessionAdded` so other clients learn of
   *   the session.
   * - Dispatch `SessionReady` so subscribers see the lifecycle transition.
   * - Lazily attach git state for the (possibly new) working directory.
   */
  _onDidMaterializeSession(e) {
    const sessionKey = e.session.toString();
    this._clearDownloadProgressInterest(sessionKey);
    const state = this._stateManager.getSessionState(sessionKey);
    if (!state) {
      this._logService.warn(`[AgentService] onDidMaterializeSession for unknown session: ${sessionKey}`);
      return;
    }
    const currentSummary = this._stateManager.getSessionSummary(sessionKey);
    if (!currentSummary) {
      this._logService.warn(`[AgentService] onDidMaterializeSession missing summary for session: ${sessionKey}`);
      return;
    }
    const project = this._worktree?.sessionWorktreeProject(AgentSession.id(e.session)) ?? e.project;
    const currentSet = currentSummary.workingDirectories?.map((d) => URI.parse(d));
    const summary = {
      ...currentSummary,
      ...project ? { project: { uri: project.uri.toString(), displayName: project.displayName } } : {},
      // The materialize receipt is authoritative for the roots it reports
      // (index 0 = the resolved process root, e.g. a worktree). A send-path
      // receipt carries the full resolved set; a resume-path receipt reports
      // only the process root, so the rest of the current set is preserved.
      workingDirectories: reconcileWorkingDirectories(currentSet, e.workingDirectories),
      modifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const configValues = state.config?.values;
    if (configValues && Object.keys(configValues).length > 0) {
      this._persistConfigValues(e.session, configValues);
    }
    this._persistWorkspaceless(e.session, readSessionWorkspaceless(summary._meta));
    this._persistMultiRoot(e.session, readSessionMultiRootMetadata(summary._meta));
    this._stateManager.markSessionPersisted(sessionKey, summary);
    this._stateManager.dispatchServerAction(sessionKey, { type: ActionType.SessionReady });
    void this._gitStateService.refreshSessionGitState(e.session.toString(), e.workingDirectories?.[0]);
    this._changesetCoordinator.onSessionMaterialized(sessionKey);
  }
  /** Drop a session's download-progress opt-in, if any. */
  _clearDownloadProgressInterest(sessionKey) {
    for (const [provider, sessions] of this._downloadProgressInterest) {
      if (sessions.delete(sessionKey) && sessions.size === 0) {
        this._downloadProgressInterest.delete(provider);
      }
    }
  }
  /**
   * Surface a host-level SDK download as client progress. The downloader fires
   * process-global frames keyed by package id (which equals the provider id);
   * because the download is shared across every session of that provider, we
   * emit a SINGLE `progress` stream keyed by that package id — not one per
   * session — so the client shows exactly one indicator no matter how many
   * sessions of the provider are awaiting it. Frames are only emitted while at
   * least one session has opted in (supplied a
   * {@link IAgentCreateSessionConfig.progressToken} on `createSession`). A
   * terminal frame reports `total === progress` (using `receivedBytes` when the
   * size was never known) so the client dismisses the indicator deterministically.
   *
   * `displayName` is the provider's brand noun (e.g. `Claude`). It is woven
   * into the notification's localized, human-readable `message` (e.g.
   * "Downloading Claude agent") so a generic client can render the indicator
   * verbatim without knowing the resource is an agent SDK. No trailing
   * ellipsis: clients render progress as "<title>: <percent>", so an ellipsis
   * would read as an unusual "…:" (see #324455).
   */
  emitDownloadProgress(packageId, displayName, receivedBytes, totalBytes, terminal) {
    const sessions = this._downloadProgressInterest.get(packageId);
    if (!sessions || sessions.size === 0) {
      return;
    }
    const total = terminal ? receivedBytes : totalBytes;
    const message = localize("agentHost.download.agentSdkTitle", "Downloading {0} agent", displayName);
    this._stateManager.emitProgress({ progressToken: packageId, progress: receivedBytes, total, message });
    if (terminal) {
      this._downloadProgressInterest.delete(packageId);
    }
  }
  _persistWorkspaceless(session, workspaceless) {
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(session);
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to open session database to persist workspaceless for ${session.toString()}: ${toErrorMessage(err)}`);
      return;
    }
    ref.object.setMetadata(AH_META_WORKSPACELESS_DB_KEY, workspaceless ? "true" : "false").catch((err) => {
      this._logService.warn(`[AgentService] Failed to persist workspaceless for ${session.toString()}: ${toErrorMessage(err)}`);
    }).finally(() => {
      ref.dispose();
    });
  }
  _persistMultiRoot(session, multiRoot) {
    if (!multiRoot) {
      return;
    }
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(session);
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to open session database to persist multi-root metadata for ${session.toString()}: ${toErrorMessage(err)}`);
      return;
    }
    ref.object.setMetadata(SESSION_META_MULTI_ROOT_KEY, JSON.stringify(multiRoot)).catch((err) => {
      this._logService.warn(`[AgentService] Failed to persist multi-root metadata for ${session.toString()}: ${toErrorMessage(err)}`);
    }).finally(() => {
      ref.dispose();
    });
  }
  _persistConfigValues(session, values) {
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(session);
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to open session database to persist configValues for ${session.toString()}: ${toErrorMessage(err)}`);
      return;
    }
    ref.object.setMetadata("configValues", JSON.stringify(values)).catch((err) => {
      this._logService.warn(`[AgentService] Failed to persist configValues for ${session.toString()}: ${toErrorMessage(err)}`);
    }).finally(() => {
      ref.dispose();
    });
  }
  async _resolveCreatedSessionConfig(provider, config) {
    if (!config?.config && config?.workingDirectories === void 0) {
      return void 0;
    }
    const params = {
      provider: provider.id,
      // `resolveSessionConfig` is a pre-session, single-context API:
      // resolve against the session's primary (index 0).
      workingDirectory: config.workingDirectories?.[0],
      config: config.config
    };
    try {
      const resolved = await this._withIsolationSchema(await provider.resolveSessionConfig(this._toProviderConfig(params)), params);
      return { schema: resolved.schema, values: resolved.values };
    } catch (err) {
      this._logService.error(`[AgentService] Failed to resolve created session config for provider ${provider.id}`, err);
      return config.config ? { schema: { type: "object", properties: {} }, values: config.config } : void 0;
    }
  }
  async resolveSessionConfig(params) {
    const providerId = params.provider ?? this._defaultProvider;
    const provider = providerId ? this._providers.get(providerId) : void 0;
    if (!provider) {
      throw new Error(`No agent provider registered for: ${providerId ?? "(none)"}`);
    }
    return this._withIsolationSchema(await provider.resolveSessionConfig(this._toProviderConfig(params)), params);
  }
  /**
   * Host-owned contribution of the shared `isolation` (folder / worktree),
   * `branch`, `worktreeBranchPrefix`, `worktreeIncludeFiles`, and `worktreeBranchTrack` session-config
   * properties on top of whatever an agent returned from `resolveSessionConfig`. Provider-returned
   * properties and values with these keys are replaced by the host contribution.
   */
  async _withIsolationSchema(result, params) {
    if (!this._worktree) {
      return result;
    }
    const iso = await this._worktree.resolveIsolationConfig({ workingDirectory: params.workingDirectory, config: params.config });
    const properties = {
      [SessionConfigKey.Isolation]: iso.isolationProperty.protocol,
      ...omitHostOwnedSessionConfig(result.schema.properties)
    };
    if (iso.branchProperty) {
      properties[SessionConfigKey.Branch] = iso.branchProperty.protocol;
    }
    if (iso.worktreeBranchPrefixProperty) {
      properties[SessionConfigKey.WorktreeBranchPrefix] = iso.worktreeBranchPrefixProperty.protocol;
    }
    if (iso.worktreeBranchTrackProperty) {
      properties[SessionConfigKey.WorktreeBranchTrack] = iso.worktreeBranchTrackProperty.protocol;
    }
    if (iso.worktreeIncludeFilesProperty) {
      properties[SessionConfigKey.WorktreeIncludeFiles] = iso.worktreeIncludeFilesProperty.protocol;
    }
    const values = omitHostOwnedSessionConfig(result.values);
    values[SessionConfigKey.Isolation] = iso.isolationValue;
    if (iso.branchProperty && iso.branchValue !== void 0) {
      values[SessionConfigKey.Branch] = iso.branchValue;
    }
    if (iso.worktreeBranchPrefixProperty && typeof params.config?.[SessionConfigKey.WorktreeBranchPrefix] === "string") {
      values[SessionConfigKey.WorktreeBranchPrefix] = params.config[SessionConfigKey.WorktreeBranchPrefix];
    }
    if (iso.worktreeBranchTrackProperty && typeof params.config?.[SessionConfigKey.WorktreeBranchTrack] === "boolean") {
      values[SessionConfigKey.WorktreeBranchTrack] = params.config[SessionConfigKey.WorktreeBranchTrack];
    }
    if (iso.worktreeIncludeFilesProperty && Array.isArray(params.config?.[SessionConfigKey.WorktreeIncludeFiles]) && params.config[SessionConfigKey.WorktreeIncludeFiles].every((pattern) => typeof pattern === "string")) {
      values[SessionConfigKey.WorktreeIncludeFiles] = params.config[SessionConfigKey.WorktreeIncludeFiles];
    }
    return { schema: { ...result.schema, properties }, values };
  }
  async sessionConfigCompletions(params) {
    if (params.property === SessionConfigKey.Branch && this._worktree) {
      return this._worktree.branchCompletions(params.workingDirectory, params.query);
    }
    const providerId = params.provider ?? this._defaultProvider;
    const provider = providerId ? this._providers.get(providerId) : void 0;
    if (!provider) {
      throw new Error(`No agent provider registered for: ${providerId ?? "(none)"}`);
    }
    return provider.sessionConfigCompletions(this._toProviderConfig(params));
  }
  async completions(params) {
    return this._completions.completions(params);
  }
  async getCompletionTriggerCharacters() {
    return this._completions.triggerCharacters;
  }
  async disposeSession(session) {
    this._logService.trace(`[AgentService] disposeSession: ${session.toString()}`);
    this._stateManager.invalidateSessionChatResolutions(session.toString());
    for (const chat of this._stateManager.getSessionState(session.toString())?.chats ?? []) {
      this._sideEffects.clearToolCallTelemetry(chat.resource);
    }
    this._sideEffects.clearToolCallTelemetry(session.toString());
    const workingDirectories = this._configurationService.getEffectiveWorkingDirectories(session.toString());
    const provider = this._findProviderForSession(session);
    if (provider) {
      await this._disposeSession(provider, session);
      this._sessionToProvider.delete(session.toString());
      this._clearDownloadProgressInterest(session.toString());
    }
    const sessionId = AgentSession.id(session);
    const worktree = await this._worktree?.prepareSessionDeletion(session, sessionId);
    await this._sessionDataService.deleteSessionData(session, workingDirectories);
    await this._worktree?.removeSessionWorktree(sessionId, worktree);
    this._changesetCoordinator.onSessionDisposed(session.toString());
    this._sideEffects.cancelSessionTitleGeneration(session.toString());
    for (const chat of this._stateManager.getSessionState(session.toString())?.chats ?? []) {
      this._sideEffects.clearQueuedMessageSenders(chat.resource);
    }
    this._sideEffects.clearInputRequestsForSession(session.toString());
    this._sideEffects.removeSubagentSessions(session.toString());
    this._stateManager.deleteSession(session.toString());
  }
  // ---- Protocol methods ---------------------------------------------------
  async createTerminal(params) {
    await this._terminalManager.createTerminal(params);
  }
  async disposeTerminal(terminal) {
    this._terminalManager.disposeTerminal(terminal.toString());
  }
  async subscribe(resource, clientId) {
    this._logService.trace(`[AgentService] subscribe: ${resource.toString()}`);
    const resourceStr = resource.toString();
    this.addSubscriber(resource, clientId);
    try {
      const terminalState = this._terminalManager.getTerminalState(resourceStr);
      if (terminalState) {
        return { resource: resourceStr, state: terminalState, fromSeq: this._stateManager.serverSeq };
      }
      let snapshot = this._stateManager.getSnapshot(resourceStr);
      const parsedChangeset = parseChangesetUri(resourceStr);
      if (snapshot && parsedChangeset && !this._stateManager.getSessionState(parsedChangeset.sessionUri)) {
        await this._changesetCoordinator.restoreSessionIfChangesetSubscription(resource, (s) => this.restoreSession(s));
        snapshot = this._stateManager.getSnapshot(resourceStr);
      }
      if (!snapshot) {
        const parsedChatSession = parseDefaultChatUri(resourceStr);
        if (parsedChatSession !== void 0) {
          if (!this._stateManager.getSessionState(parsedChatSession)) {
            const parentUri = URI.parse(parsedChatSession);
            const parsedSubagentParent = parseSubagentSessionUri(parentUri);
            if (parsedSubagentParent) {
              await this._restoreSubagentSession(parsedChatSession, parsedSubagentParent.parentSession);
            } else {
              await this.restoreSession(parentUri);
            }
          }
          snapshot = this._stateManager.getSnapshot(resourceStr);
        }
      }
      if (!snapshot && isAhpChatChannel(resourceStr)) {
        await this._stateManager.resolveChatState(resourceStr);
        snapshot = this._stateManager.getSnapshot(resourceStr);
      }
      if (!snapshot) {
        if (isSubagentChatUri(resource)) {
          snapshot = await this._awaitPendingSubagentChat(resourceStr);
        } else {
          const handled = await this._changesetCoordinator.tryHandleSubscribe(resource, (s) => this.restoreSession(s));
          if (handled) {
            snapshot = this._stateManager.getSnapshot(resourceStr);
          } else {
            const parsedSubagent = parseSubagentSessionUri(resource);
            if (parsedSubagent) {
              await this._restoreSubagentSession(resourceStr, parsedSubagent.parentSession);
            } else {
              await this.restoreSession(resource);
            }
            snapshot = this._stateManager.getSnapshot(resourceStr);
          }
        }
      }
      if (!snapshot) {
        throw new Error(`Cannot subscribe to unknown resource: ${resourceStr}`);
      }
      const sessionState = this._stateManager.getSessionState(resourceStr);
      if (!isAhpChatChannel(resourceStr) && sessionState && readSessionGitState(sessionState._meta) === void 0) {
        const workingDirectory = sessionState.workingDirectories?.[0] ? URI.parse(sessionState.workingDirectories[0]) : void 0;
        void this._gitStateService.refreshSessionGitState(resourceStr, workingDirectory);
      }
      return snapshot;
    } catch (err) {
      this.unsubscribe(resource, clientId);
      throw err;
    }
  }
  /** Waits for an armed subagent chat to register (or its wait to time out); returns `undefined` if not armed or never registered. */
  async _awaitPendingSubagentChat(subagentChatUri) {
    const pending = this._pendingSubagentChats.get(subagentChatUri);
    if (!pending) {
      return void 0;
    }
    await pending.p;
    return this._stateManager.getSnapshot(subagentChatUri);
  }
  addSubscriber(resource, clientId) {
    let set = this._resourceSubscribers.get(resource);
    const wasUnsubscribed = !set || set.size === 0;
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this._resourceSubscribers.set(resource, set);
    }
    set.add(clientId);
    this._cancelPendingSessionGc(resource);
    this._cancelPendingSessionRelease(resource);
    if (wasUnsubscribed) {
      this._changesetCoordinator.onFirstSubscriber(resource);
    }
  }
  unsubscribe(resource, clientId) {
    const set = this._resourceSubscribers.get(resource);
    if (!set) {
      return;
    }
    set.delete(clientId);
    if (set.size > 0) {
      return;
    }
    this._resourceSubscribers.delete(resource);
    this._changesetCoordinator.onLastSubscriber(resource);
    this._stateManager.onChangesetLivenessChanged();
    if (this._maybeScheduleSessionGc(resource)) {
      return;
    }
    this._pendingSessionRelease.set(resource, disposableTimeout(() => {
      this._pendingSessionRelease.deleteAndDispose(resource);
      this._maybeEvictIdleSession(resource);
    }, SESSION_RELEASE_GRACE_MS));
  }
  _cancelPendingSessionRelease(resource) {
    this._pendingSessionRelease.deleteAndDispose(resource);
  }
  /**
   * If `resource` names a session that no client is still subscribed to and
   * that has produced no turns (and has no active turn), schedule a delayed
   * {@link _runSessionGc} to fully tear it down — provider session, worktree,
   * persisted state and all. Sessions with at least one turn are left to the
   * existing {@link _maybeEvictIdleSession} path which only drops cached
   * state and lets the session be restored from disk later.
   *
   * GC is restricted to sessions that are still unused drafts. A session that
   * was restored from durable storage, or that has ever had a turn, is never
   * a candidate however empty it looks now — an empty state is also what a
   * failed history load and a truncate-to-zero leave behind.
   *
   * The delay ({@link SESSION_GC_GRACE_MS}) gives a disconnected client time
   * to reconnect or a workspace switch to settle. Any subsequent subscribe
   * (or createSession on the same URI) cancels the timer via
   * {@link _cancelPendingSessionGc}.
   *
   * Returns `true` if a GC timer was armed (existing or newly scheduled),
   * so callers can skip alternative cleanup paths.
   */
  _maybeScheduleSessionGc(resource) {
    if (parseSubagentSessionUri(resource)) {
      return false;
    }
    const key = resource.toString();
    const state = this._stateManager.getSessionState(key);
    if (!state) {
      return false;
    }
    if (state.turns.length > 0 || state.activeTurn !== void 0) {
      return false;
    }
    if (this._stateManager.isUnusedDraft(key) !== true) {
      this._logService.trace(`[AgentService] Skipping GC for session that is not an unused draft: ${key}`);
      return false;
    }
    this._pendingSessionGc.set(resource, disposableTimeout(() => {
      this._pendingSessionGc.deleteAndDispose(resource);
      this._runSessionGc(resource).catch((err) => {
        this._logService.error(err, `[AgentService] GC failed for ${key}`);
      });
    }, SESSION_GC_GRACE_MS));
    return true;
  }
  _cancelPendingSessionGc(resource) {
    this._pendingSessionGc.deleteAndDispose(resource);
  }
  /**
   * Fires {@link SESSION_GC_GRACE_MS} after a session lost its last
   * subscriber while empty. Re-checks the invariants (still no subscribers,
   * still empty, still an unused draft) before tearing the session down via
   * {@link disposeSession}. The cached state may already have been evicted by
   * {@link _maybeEvictIdleSession}; in that case we still proceed because
   * "evicted + no resubscribe" implies no client is observing the session.
   */
  async _runSessionGc(resource) {
    const key = resource.toString();
    if (this._resourceSubscribers.has(resource)) {
      return;
    }
    const state = this._stateManager.getSessionState(key);
    if (state && (state.turns.length > 0 || state.activeTurn !== void 0)) {
      return;
    }
    if (this._stateManager.isUnusedDraft(key) === false) {
      this._logService.trace(`[AgentService] GC aborted, session is no longer an unused draft: ${key}`);
      return;
    }
    this._logService.info(`[AgentService] GC: disposing empty unsubscribed session ${key}`);
    await this.disposeSession(resource);
  }
  /**
   * If `resource` names an idle session and no client is still subscribed to
   * it (or, for a subagent URI, no sibling subagent under the same parent is
   * still subscribed), release its in-memory footprint: drop the cached AHP
   * state from the state manager AND ask the provider to release the session's
   * SDK resources ({@link IAgent.releaseSession}). Subagent URIs evict the
   * parent session entry; the parent owns the materialized turn tree that
   * backs every subagent view. Nothing durable is deleted — the next subscribe
   * rehydrates the session via {@link restoreSession} and the provider resumes
   * the SDK session on demand.
   */
  _maybeEvictIdleSession(resource) {
    const key = resource.toString();
    if (this._resourceSubscribers.has(resource)) {
      return;
    }
    let evictionTarget = resource;
    {
      let parsed;
      while (parsed = parseSubagentSessionUri(evictionTarget)) {
        evictionTarget = parsed.parentSession;
      }
    }
    if (this._resourceSubscribers.has(evictionTarget)) {
      return;
    }
    for (const subscribedUri of this._resourceSubscribers.keys()) {
      if (this._isSubagentDescendantOf(subscribedUri, evictionTarget)) {
        return;
      }
    }
    const evictionTargetKey = evictionTarget.toString();
    if (this._restoreSessionInFlight.has(evictionTargetKey)) {
      return;
    }
    const targetState = this._stateManager.getSessionState(evictionTargetKey);
    if (!targetState || targetState.activeTurn !== void 0) {
      return;
    }
    this._logService.info(`[AgentService] Evicting idle session: ${evictionTargetKey} (triggered by unsubscribe of ${key})`);
    const subagentPrefix = buildSubagentSessionUriPrefix(evictionTarget);
    for (const cachedKey of this._stateManager.getSessionUrisWithPrefix(subagentPrefix)) {
      this._stateManager.removeSession(cachedKey);
    }
    this._stateManager.removeSession(evictionTargetKey);
    const provider = this._findProviderForSession(evictionTarget);
    const release = provider?.releaseSession?.(evictionTarget);
    if (release) {
      const trackedRelease = release.catch((err) => {
        this._logService.error(err, `[AgentService] Failed to release idle session ${evictionTargetKey}`);
      });
      this._releaseSessionInFlight.set(evictionTargetKey, trackedRelease);
      void trackedRelease.then(() => {
        if (this._releaseSessionInFlight.get(evictionTargetKey) === trackedRelease) {
          this._releaseSessionInFlight.delete(evictionTargetKey);
        }
      });
    }
  }
  // Returns true when a changeset is safe to drop from the in-memory cache.
  _isChangesetEvictable(changeset) {
    const changesetUri = URI.parse(changeset);
    if (this._resourceSubscribers.has(changesetUri)) {
      return false;
    }
    const parsed = parseChangesetUri(changeset);
    if (!parsed) {
      return false;
    }
    const sessionUri = URI.parse(parsed.sessionUri);
    if (this._resourceSubscribers.has(sessionUri)) {
      return false;
    }
    for (const subscribedUri of this._resourceSubscribers.keys()) {
      if (this._isSubagentDescendantOf(subscribedUri, sessionUri)) {
        return false;
      }
    }
    return !this._changesets.isStaticChangesetComputeActive(changeset);
  }
  _isSubagentDescendantOf(resource, parent) {
    let parsed = parseSubagentSessionUri(resource);
    while (parsed) {
      if (isEqual(parsed.parentSession, parent)) {
        return true;
      }
      parsed = parseSubagentSessionUri(parsed.parentSession);
    }
    return false;
  }
  dispatchAction(channel, action, clientId, clientSeq, clientContextOrType = AgentHostClientType.Unknown) {
    const clientContext = typeof clientContextOrType === "string" ? createUnknownAgentHostClientTelemetryContext(clientContextOrType) : clientContextOrType;
    this._logService.trace(`[AgentService] dispatchAction: type=${action.type}, clientId=${clientId}, clientSeq=${clientSeq}`, action);
    const chatChannel = isAhpChatChannel(channel) ? channel : void 0;
    const sessionChannel = chatChannel ? parseRequiredSessionUriFromChatUri(chatChannel) : channel;
    const requiresSessionRestore = (chatChannel !== void 0 || isSessionAction(action)) && !this._stateManager.getSessionState(sessionChannel);
    const requiresPeerResolution = chatChannel !== void 0 && !this._stateManager.getChatState(chatChannel);
    const requiresAttachmentRewrite = this._needsAsyncRewrite(sessionChannel, action);
    const pending = this._clientDispatchQueues.get(clientId);
    if (!pending && !requiresSessionRestore && !requiresPeerResolution && !requiresAttachmentRewrite) {
      this._dispatchActionNow(channel, sessionChannel, action, clientId, clientSeq, clientContext);
      return;
    }
    const next = (pending ?? Promise.resolve()).then(async () => {
      if (requiresSessionRestore) {
        const sessionUri = URI.parse(sessionChannel);
        const subagent = parseSubagentSessionUri(sessionUri);
        if (subagent) {
          await this._restoreSubagentSession(sessionChannel, subagent.parentSession);
        } else {
          await this.restoreSession(sessionUri);
        }
      }
      if (chatChannel && requiresPeerResolution) {
        await this._stateManager.resolveChatState(chatChannel);
      }
      const rewritten = requiresAttachmentRewrite ? await this._rewriteUserMessageAttachments(sessionChannel, action, clientId) : action;
      if (rewritten.type === ActionType.ChangesetFilesReviewChanged) {
        await this._reviewService.setReviewState(channel, rewritten.files, rewritten.reviewed);
        const changeset = parseChangesetUri(channel);
        if (!changeset) {
          throw new Error(`Invalid changeset URI: ${channel}`);
        }
        this._changesets.refreshBranchChangeset(changeset.sessionUri);
      }
      this._dispatchActionNow(channel, sessionChannel, rewritten, clientId, clientSeq, clientContext);
    }).catch((err) => {
      this._logService.error(`[AgentService] async dispatchAction failed: ${toErrorMessage(err)}`);
    });
    this._clientDispatchQueues.set(clientId, next.finally(() => {
      if (this._clientDispatchQueues.get(clientId) === next) {
        this._clientDispatchQueues.delete(clientId);
      }
    }));
  }
  /**
   * Authoritative gate for every client working-directory action. Throws when
   * the session or its provider cannot accept the change — including a removal
   * of the primary directory for a provider that pins it — so the caller can
   * reject the action. Returns the canonicalized action on success.
   */
  _prepareWorkingDirectoryAction(session, action) {
    const state = this._stateManager.getSessionState(session);
    if (!state || state.lifecycle !== SessionLifecycle.Ready || !state.workingDirectories?.length) {
      throw new Error(`Session is not ready for working-directory changes: ${session}`);
    }
    if (!readSessionMultiRootMetadata(state._meta) || readSessionWorkspaceless(state._meta) || state.config?.values[SessionConfigKey.Isolation] === "worktree" || state.chats.length !== 1 || !state.defaultChat || state.defaultChat !== state.chats[0].resource) {
      throw new Error(`Session does not support dynamic working-directory changes: ${session}`);
    }
    const sessionUri = URI.parse(session);
    const provider = this._findProviderForSession(sessionUri);
    const capability = provider?.getDescriptor().capabilities?.multipleWorkingDirectories;
    if (!provider || !capability) {
      throw new Error(`Provider does not support dynamic working-directory changes: ${AgentSession.provider(sessionUri) ?? "(unknown)"}`);
    }
    return resolveSessionWorkingDirectoryAction(action, state.workingDirectories, capability.immutablePrimary === true);
  }
  _dispatchActionNow(channel, sessionChannel, action, clientId, clientSeq, clientContext) {
    const origin = { clientId, clientSeq };
    if (action.type === ActionType.SessionWorkingDirectorySet || action.type === ActionType.SessionWorkingDirectoryRemoved) {
      if (clientContext.clientType !== AgentHostClientType.EditorWindow) {
        this._stateManager.rejectClientAction(channel, action, origin, "Session working-directory actions require an Editor Window client.");
        return;
      }
      if (channel !== sessionChannel) {
        this._stateManager.rejectClientAction(channel, action, origin, "Session working-directory actions require a session channel.");
        return;
      }
      try {
        action = this._prepareWorkingDirectoryAction(sessionChannel, action);
      } catch (error) {
        this._stateManager.rejectClientAction(channel, action, origin, toErrorMessage(error));
        return;
      }
    }
    this._stateManager.dispatchClientAction(channel, action, origin);
    if (action.type === ActionType.RootConfigChanged) {
      this._configurationService.persistRootConfig();
      const editTelemetryEnabled = action.config[AgentHostEditTelemetryEnabledConfigKey];
      if (typeof editTelemetryEnabled === "boolean") {
        this._editAttributionService?.setEnabled(editTelemetryEnabled);
      }
    }
    this._sideEffects.handleAction(channel, action, clientId, clientContext);
  }
  _needsAsyncRewrite(channel, action) {
    if (action.type !== ActionType.ChatTurnStarted && action.type !== ActionType.ChatPendingMessageSet) {
      return false;
    }
    const attachmentsRootStr = this._attachmentsRoot(channel).toString();
    return !!action.message.attachments?.some((a) => this._isRewritableAttachment(a, attachmentsRootStr));
  }
  _isRewritableAttachment(attachment, attachmentsRootStr) {
    if (attachment.type === MessageAttachmentKind.EmbeddedResource) {
      return true;
    }
    if (attachment.type === MessageAttachmentKind.Resource) {
      if (attachment.displayKind === "directory") {
        return false;
      }
      if (attachment.uri.startsWith(attachmentsRootStr)) {
        return false;
      }
      return true;
    }
    return false;
  }
  _attachmentsRoot(session) {
    return joinPath(this._sessionDataService.getSessionDataDir(URI.parse(session)), SESSION_ATTACHMENTS_DIRNAME);
  }
  /**
   * Snapshot inline / client-resident attachment payloads onto disk
   * under the session's data directory and rewrite the action to
   * reference them via local `file:` URIs. Keeps potentially large
   * blobs (e.g. pasted images) out of the in-memory state tree while
   * letting the agent consume them via the standard {@link IFileService}
   * surface — no special URI scheme or blob round-tripping needed.
   *
   * Failures are isolated per-attachment: if a rewrite cannot be
   * performed (no client connection registered, `resourceRead` rejects,
   * etc.) the original attachment is preserved so the agent still has a
   * chance to make use of it.
   */
  async _rewriteUserMessageAttachments(channel, action, clientId) {
    const attachments = action.message.attachments;
    if (!attachments?.length) {
      return action;
    }
    const attachmentsRoot = this._attachmentsRoot(channel);
    const attachmentsRootStr = attachmentsRoot.toString();
    const rewritten = await Promise.all(attachments.map((a) => this._rewriteSingleAttachment(a, attachmentsRoot, attachmentsRootStr, clientId)));
    return {
      ...action,
      message: { ...action.message, attachments: rewritten }
    };
  }
  async _rewriteSingleAttachment(attachment, attachmentsRoot, attachmentsRootStr, clientId) {
    try {
      if (attachment.type === MessageAttachmentKind.EmbeddedResource) {
        const bytes = decodeBase64(attachment.data).buffer;
        const basename = this._attachmentBasename(attachment.label, attachment.contentType);
        return this._writeAndRewrite(attachment, bytes, basename, attachmentsRoot);
      }
      if (attachment.type === MessageAttachmentKind.Resource && this._isRewritableAttachment(attachment, attachmentsRootStr)) {
        const originalUri = URI.parse(attachment.uri);
        if (originalUri.scheme === Schemas.file && await this._fileExistsSafe(originalUri)) {
          return attachment;
        }
        const bytes = await this._readClientResource(originalUri, clientId);
        const basename = this._attachmentBasename(attachment.label, getMediaMime(originalUri.path));
        return this._writeAndRewrite(attachment, bytes, basename, attachmentsRoot);
      }
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to rewrite attachment '${attachment.label}': ${toErrorMessage(err)}`);
    }
    return attachment;
  }
  /**
   * Like {@link IFileService.exists} but never throws (e.g. when no provider
   * is registered for the URI scheme), returning `false` in that case.
   */
  async _fileExistsSafe(uri) {
    try {
      return await this._fileService.exists(uri);
    } catch {
      return false;
    }
  }
  /**
   * Reads `originalUri` through the `vscode-agent-client` filesystem
   * provider so it is fetched from the originating client. Falls back to
   * a direct read against `originalUri` when no client filesystem
   * authority is registered for `clientId` (e.g. unit tests, in-process
   * agent host with a local URI).
   */
  async _readClientResource(originalUri, clientId) {
    const proxiedUri = clientId ? toAgentClientUri(originalUri, clientId) : originalUri;
    try {
      const contents = await this._fileService.readFile(proxiedUri);
      return contents.value.buffer;
    } catch (err) {
      if (proxiedUri !== originalUri) {
        try {
          const contents = await this._fileService.readFile(originalUri);
          return contents.value.buffer;
        } catch {
        }
      }
      throw err;
    }
  }
  async _writeAndRewrite(original, bytes, basename, attachmentsRoot) {
    const id = generateUuid();
    const target = joinPath(attachmentsRoot, id, basename);
    await this._fileService.writeFile(target, VSBuffer.wrap(bytes));
    const rewritten = {
      type: MessageAttachmentKind.Resource,
      uri: target.toString(),
      label: original.label,
      displayKind: original.displayKind,
      range: original.range,
      _meta: original._meta
    };
    if (original.type === MessageAttachmentKind.Resource && original.selection) {
      rewritten.selection = original.selection;
    }
    return rewritten;
  }
  /**
   * Pick a sensible on-disk basename for the snapshotted attachment,
   * preserving a usable extension where possible so the SDK and other
   * downstream consumers can detect the right type from the path alone.
   */
  _attachmentBasename(label, contentType) {
    const safeLabel = (label || "attachment").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_");
    if (resourcesExtname(URI.file(safeLabel))) {
      return safeLabel;
    }
    const ext = contentType ? getExtensionForMimeType(contentType) : void 0;
    return ext ? `${safeLabel}${ext}` : safeLabel;
  }
  async resourceList(uri) {
    let stat;
    try {
      stat = await this._fileService.resolve(uri);
    } catch {
      throw new ProtocolError(AhpErrorCodes.NotFound, `Directory not found: ${uri.toString()}`);
    }
    if (!stat.isDirectory) {
      throw new ProtocolError(AhpErrorCodes.NotFound, `Not a directory: ${uri.toString()}`);
    }
    const entries = (stat.children ?? []).map((child) => ({
      name: child.name,
      type: child.isDirectory ? "directory" : "file"
    }));
    return { entries };
  }
  async restoreSession(session) {
    const sessionStr = session.toString();
    await this._releaseSessionInFlight.get(sessionStr);
    if (this._stateManager.getSessionState(sessionStr)) {
      return;
    }
    const inFlight = this._restoreSessionInFlight.get(sessionStr);
    if (inFlight) {
      return inFlight;
    }
    const restore = this._doRestoreSession(session, sessionStr);
    this._restoreSessionInFlight.set(sessionStr, restore);
    try {
      await restore;
    } finally {
      if (this._restoreSessionInFlight.get(sessionStr) === restore) {
        this._restoreSessionInFlight.delete(sessionStr);
      }
    }
  }
  /** Emits one {@link AgentHostLegacyMigrationEvent} for a legacy-session adoption attempt. */
  _reportLegacyMigration(provider, outcome, startTime, extra) {
    this._telemetryService.publicLog2("agentHost.legacyCopilotCliMigration", {
      provider,
      outcome,
      success: outcome === "migrated" && (extra.turnCount ?? 0) > 0,
      turnCount: extra.turnCount ?? 0,
      durationMs: Date.now() - startTime,
      hasProject: extra.hasProject ?? false,
      hasWorktree: extra.hasWorktree ?? false,
      workingDirectoryCount: extra.workingDirectoryCount ?? 0,
      errorMessage: extra.errorMessage
    });
  }
  async _doRestoreSession(session, sessionStr) {
    if (this._stateManager.getSessionState(sessionStr)) {
      return;
    }
    const agent = this._findProviderForSession(session);
    if (!agent) {
      throw new ProtocolError(AHP_SESSION_NOT_FOUND, `No agent for session: ${sessionStr}`);
    }
    const migrateLegacyEnabled = this._configurationService.getRootValue(platformRootSchema, AgentHostMigrateLegacyCopilotCliEnabledConfigKey) === true;
    const migrationStartTime = Date.now();
    let adoption = { adopted: false, eligible: false };
    if (migrateLegacyEnabled && agent.ensureSessionAdopted) {
      try {
        adoption = await agent.ensureSessionAdopted(session);
      } catch (err) {
        this._reportLegacyMigration(agent.id, "failed", migrationStartTime, { errorMessage: toErrorMessage(err) });
        throw err;
      }
    }
    const adopted = adoption.adopted;
    try {
      const facts = await this._restoreSessionState(agent, session, sessionStr, adopted);
      if (adopted) {
        this._reportLegacyMigration(agent.id, "migrated", migrationStartTime, facts);
      } else if (adoption.eligible) {
        this._reportLegacyMigration(agent.id, "skipped", migrationStartTime, { hasProject: facts.hasProject, workingDirectoryCount: facts.workingDirectoryCount });
      }
    } catch (err) {
      if (adopted) {
        this._reportLegacyMigration(agent.id, "failed", migrationStartTime, { errorMessage: toErrorMessage(err) });
      }
      throw err;
    }
  }
  /**
   * Hydrates a restored (or freshly-adopted) session into the state manager and
   * completes all required restore work (turns, metadata, peer chats, config).
   * Returns the facts used for migration telemetry; throws if any required step
   * fails so the caller can report the outcome accurately.
   */
  async _restoreSessionState(agent, session, sessionStr, adopted) {
    let meta = await this._getSessionMetadataForRestore(agent, session);
    if (!meta) {
      throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Session not found on backend: ${sessionStr}`);
    }
    let adoptedWorktree = false;
    if (adopted && this._worktree) {
      const adoptedWorkingDirectory = meta.workingDirectories?.[0];
      if (adoptedWorkingDirectory) {
        try {
          if (await this._worktree.adoptExistingWorktreeMetadata(session, adoptedWorkingDirectory)) {
            adoptedWorktree = true;
            const worktreeProject = await this._worktree.resolveWorktreeProject(session);
            if (worktreeProject) {
              meta = { ...meta, project: worktreeProject };
            }
          }
        } catch (err) {
          this._logService.warn(`[AgentService] adopt: worktree metadata bridge failed for ${sessionStr}`, err);
        }
      }
    }
    const defaultChatUri = URI.parse(buildDefaultChatUri(sessionStr));
    let turns;
    try {
      turns = await this._getChatMessages(agent, defaultChatUri);
    } catch (err) {
      if (err instanceof ProtocolError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new ProtocolError(JSON_RPC_INTERNAL_ERROR, `Failed to restore session ${sessionStr}: ${message}`);
    }
    let title = meta.summary ?? "Session";
    let isRead;
    let isArchived;
    let persistedConfigValues;
    let changes;
    let gitMetadata;
    let changesetMetadata;
    let sessionMetadata;
    const ref = this._sessionDataService.tryOpenDatabase?.(session);
    if (ref) {
      try {
        const db = await ref;
        if (db) {
          try {
            const m = await db.object.getMetadataObject({
              customTitle: true,
              [AH_META_IS_READ_DB_KEY]: true,
              [AH_META_IS_ARCHIVED_DB_KEY]: true,
              [AH_META_IS_DONE_DB_KEY]: true,
              configValues: true,
              [AH_META_WORKSPACELESS_DB_KEY]: true,
              [SESSION_META_MULTI_ROOT_KEY]: true,
              ...GIT_DB_METADATA_KEYS,
              ...CHANGESET_DB_METADATA_KEYS
            });
            if (m.customTitle) {
              title = m.customTitle;
            }
            if (m[AH_META_IS_READ_DB_KEY] !== void 0) {
              isRead = m[AH_META_IS_READ_DB_KEY] === "true";
            }
            const persistedArchived = m[AH_META_IS_ARCHIVED_DB_KEY] ?? m[AH_META_IS_DONE_DB_KEY];
            if (persistedArchived !== void 0) {
              isArchived = persistedArchived === "true";
            }
            changesetMetadata = m;
            if (changesetMetadata[META_CHANGES_SUMMARY]) {
              try {
                changes = JSON.parse(changesetMetadata[META_CHANGES_SUMMARY]);
              } catch (err) {
                this._logService.warn(`[AgentService] Failed to parse changes summary for ${sessionStr}: ${toErrorMessage(err)}`);
              }
            }
            gitMetadata = m;
            if (gitMetadata[META_GIT_STATE]) {
              try {
                const gitState = JSON.parse(gitMetadata[META_GIT_STATE]);
                sessionMetadata = { [SESSION_META_GIT_KEY]: gitState };
              } catch (err) {
                this._logService.warn(`[AgentService] Failed to parse Git state for ${sessionStr}: ${toErrorMessage(err)}`);
              }
            }
            if (gitMetadata[META_GITHUB_STATE]) {
              try {
                const githubState = JSON.parse(gitMetadata[META_GITHUB_STATE]);
                sessionMetadata = {
                  ...sessionMetadata ? sessionMetadata : {},
                  [SESSION_META_GITHUB_KEY]: githubState
                };
              } catch (err) {
                this._logService.warn(`[AgentService] Failed to parse GitHub state for ${sessionStr}: ${toErrorMessage(err)}`);
              }
            }
            if (m[AH_META_WORKSPACELESS_DB_KEY] !== void 0) {
              sessionMetadata = withSessionWorkspaceless(sessionMetadata, m[AH_META_WORKSPACELESS_DB_KEY] === "true");
            }
            sessionMetadata = withSessionMultiRootMetadata(sessionMetadata, parseSessionMultiRootMetadata(m[SESSION_META_MULTI_ROOT_KEY]));
            if (m.configValues) {
              try {
                persistedConfigValues = JSON.parse(m.configValues);
              } catch (err) {
                this._logService.warn(`[AgentService] Failed to parse persisted configValues for ${sessionStr}: ${toErrorMessage(err)}`);
              }
            }
          } finally {
            db.dispose();
          }
        }
      } catch {
      }
    }
    let status = SessionStatus.Idle;
    if (isRead) {
      status |= SessionStatus.IsRead;
    }
    if (isArchived) {
      status |= SessionStatus.IsArchived;
    }
    const providerMeta = withSessionMultiRootMetadata(meta._meta, void 0);
    let restoredMeta = sessionMetadata || providerMeta ? { ...providerMeta ?? {}, ...sessionMetadata ?? {} } : void 0;
    restoredMeta = withSessionMultiRootMetadata(restoredMeta, readSessionMultiRootMetadata(sessionMetadata));
    const summary = {
      resource: sessionStr,
      provider: agent.id,
      title,
      status,
      createdAt: new Date(meta.startTime).toISOString(),
      modifiedAt: new Date(meta.modifiedTime).toISOString(),
      ...meta.project ? { project: { uri: meta.project.uri.toString(), displayName: meta.project.displayName } } : {},
      changes: meta.changes ?? changes,
      workingDirectories: meta.workingDirectories?.map((d) => d.toString()),
      _meta: restoredMeta
    };
    const [defaultDraft, defaultChatTitle] = await Promise.all([
      this._getChatDraft(session, defaultChatUri),
      this._readPersistedChatTitle(session, defaultChatUri)
    ]);
    const mergedTurns = await this._interleaveLocalTurns(sessionStr, defaultChatUri.toString(), turns);
    this._stateManager.restoreSession(summary, mergedTurns, { draft: defaultDraft, defaultChatTitle });
    if (adopted && this._checkpointService.adoptLegacyCheckpoints) {
      try {
        const checkpointWorkingDirectory = meta.workingDirectories?.[0];
        if (checkpointWorkingDirectory) {
          await this._checkpointService.adoptLegacyCheckpoints(session, checkpointWorkingDirectory, AgentSession.id(session), mergedTurns.map((t) => t.id));
        }
      } catch (err) {
        this._logService.warn(`[AgentService] adopt: checkpoint bridge failed for ${sessionStr}`, err);
      }
    }
    const promises = [];
    promises.push((async () => {
      if (agent.getSubagentSessions) {
        try {
          const children = await agent.getSubagentSessions(session);
          for (const child of children) {
            this._registerRestoredSubagent(child, summary, sessionStr);
          }
        } catch (err) {
          this._logService.warn(`[AgentService] restoreSession failed to eagerly register subagents session=${sessionStr}`, err);
        }
      }
    })());
    promises.push(this._restorePeerChats(agent, session));
    this._changesetCoordinator.onSessionRestored(sessionStr, changesetMetadata ?? {});
    if (summary._meta) {
      this._stateManager.setSessionMeta(sessionStr, summary._meta);
    }
    const [restoredConfig, restoredCustomizations] = await Promise.all([
      this._resolveCreatedSessionConfig(agent, {
        workingDirectories: meta.workingDirectories,
        config: persistedConfigValues
      }),
      agent.getSessionCustomizations ? agent.getSessionCustomizations(session).catch((err) => {
        this._logService.error("[AgentService] restoreSession: failed to resolve session customizations", err);
        return void 0;
      }) : Promise.resolve(void 0),
      ...promises
    ]);
    if (restoredConfig) {
      this._stateManager.setSessionConfig(sessionStr, restoredConfig);
    }
    if (restoredCustomizations && restoredCustomizations.length > 0) {
      this._stateManager.setSessionCustomizations(sessionStr, restoredCustomizations);
    }
    this._logService.info(`[AgentService] Restored session ${sessionStr} with ${turns.length} turns`);
    void this._gitStateService.attachSessionGitHubPullRequest(sessionStr, meta.workingDirectories?.[0]);
    return {
      turnCount: mergedTurns.length,
      hasProject: !!meta.project,
      hasWorktree: adoptedWorktree,
      workingDirectoryCount: meta.workingDirectories?.length ?? 0
    };
  }
  /**
   * Restores the additional (non-default) peer chats for a session.
   *
   * Enumeration is driven by the orchestrator's OWN persisted catalog (the
   * {@link PEER_CHATS_METADATA_KEY} blob). Each catalog entry is registered
   * immediately with its persisted title, draft, origin, and provider data.
   * Its backing and history remain unloaded until the peer chat is requested.
   *
   * When the orchestrator catalog is absent ({@link _readPersistedPeerChatCatalog}
   * returns `undefined`) the session predates orchestrator-owned persistence:
   * a one-time migration ({@link _migrateLegacyPeerChats}) drains the agent's
   * legacy `*.chats` enumeration into the catalog so it is never consulted
   * again.
   */
  async _restorePeerChats(agent, session) {
    const persisted = await this._readPersistedPeerChatCatalog(session);
    if (persisted !== void 0) {
      await this._restorePeerChatsFromCatalog(session, persisted);
      return;
    }
    await this._migrateLegacyPeerChats(agent, session);
  }
  /**
   * One-time migration for sessions persisted before the orchestrator owned
   * the peer-chat catalog: enumerate the agent's legacy `*.chats`
   * ({@link IAgent.listLegacyChats}), register them via the same path as the
   * new catalog, then write the orchestrator {@link PEER_CHATS_METADATA_KEY}
   * blob so subsequent restores read the new catalog and never consult the
   * legacy read again. No-op when the agent has no legacy enumeration or none
   * is persisted.
   */
  async _migrateLegacyPeerChats(agent, session) {
    const legacy = await agent.listLegacyChats?.(session);
    if (!legacy || legacy.length === 0) {
      await this._enqueuePeerChatCatalogWrite(session, () => []);
      return;
    }
    const entries = legacy.map((chat) => ({
      uri: chat.uri.toString(),
      ...chat.providerData !== void 0 ? { providerData: chat.providerData } : {}
    }));
    await this._restorePeerChatsFromCatalog(session, entries);
    await this._enqueuePeerChatCatalogWrite(session, () => [...entries]);
  }
  /**
   * Registers a set of peer chats from an enumerated catalog in catalog order.
   * Titles and drafts are metadata-only reads; backing sessions and histories
   * are loaded on the first content request.
   */
  async _restorePeerChatsFromCatalog(session, entries) {
    const restored = await Promise.all(entries.map(async (entry) => {
      let chatUri;
      try {
        chatUri = URI.parse(entry.uri);
      } catch (err) {
        this._logService.warn(`[AgentService] Skipping malformed persisted peer chat URI '${entry.uri}': ${toErrorMessage(err)}`);
        return void 0;
      }
      const [title, draft] = await Promise.all([
        this._readPersistedChatTitle(session, chatUri),
        this._getChatDraft(session, chatUri)
      ]);
      return { chatUri, title, draft, providerData: entry.providerData, origin: entry.origin };
    }));
    for (const item of restored) {
      if (!item) {
        continue;
      }
      const { chatUri, title, draft, providerData, origin } = item;
      if (this._stateManager.getChatState(chatUri.toString())) {
        continue;
      }
      this._stateManager.registerRestoredChatSummary(session.toString(), chatUri.toString(), {
        title,
        draft,
        providerData,
        origin,
        resolver: (currentProviderData) => this._materializeRestoredPeerChat(session, chatUri, currentProviderData)
      });
    }
  }
  /**
   * Materializes provider backing and history for the state-manager-owned
   * restored chat entry. This callback never mutates state manager state.
   */
  async _materializeRestoredPeerChat(session, chat, providerData) {
    const chatKey = chat.toString();
    const agent = this._findProviderForSession(session);
    if (!agent) {
      throw new Error(`No agent provider for restored peer chat: ${chatKey}`);
    }
    try {
      if (agent.materializeChat) {
        await agent.materializeChat(chat, providerData);
      }
      const turns = await this._getChatMessages(agent, chat);
      return { turns: await this._interleaveLocalTurns(session.toString(), chatKey, turns) };
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to materialize peer chat ${chatKey}: ${toErrorMessage(err)}`);
      throw err;
    }
  }
  /**
   * Re-persists a peer chat's opaque `providerData` blob when the agent
   * reports it changed (e.g. per-chat model switch or fork remap).
   */
  _onChatDataChanged(e) {
    const sessionStr = parseDefaultChatUri(e.chat);
    if (sessionStr === void 0) {
      this._logService.warn(`[AgentService] onDidChangeChatData for malformed chat URI: ${e.chat.toString()}`);
      return;
    }
    this._stateManager.updateChatProviderData(e.chat.toString(), e.providerData);
    void this._persistPeerChat(URI.parse(sessionStr), e.chat, e.providerData);
  }
  /**
   * Deterministic membership sequencer for agent-spawned chats,
   * driven off {@link IAgent.onDidSessionProgress}: a `subagent_started` adds
   * the subagent chat to the catalog via the same spawn-channel handler
   * ({@link _onChatSpawned}) used by {@link IAgent.onDidSpawnChat}.
   * A completed subagent chat stays live and subscribable, so completion is
   * not sequenced here; subagent chats are removed only on session teardown.
   * Registered before {@link AgentSideEffects} so the subagent chat exists
   * before its turn starts; addChat is idempotent so overlapping with the
   * agent's own spawn bridge is safe.
   */
  _sequenceSpawnedChat(signal) {
    const spawn = SubagentChatSignal.toSpawnEvent(signal);
    if (spawn) {
      this._onChatSpawned(spawn);
    }
  }
  /** Marks a subagent chat as pending once its confirmed tool call reaches (or is about to reach) `Running`. */
  _trackPendingSubagentChatFromEnvelope(envelope) {
    const { channel, action } = envelope;
    if (action.type === ActionType.ChatToolCallStart || action.type === ActionType.ChatToolCallDelta || action.type === ActionType.ChatToolCallReady) {
      const key = `${channel}:${action.toolCallId}`;
      const subagentChatUri = readToolCallMeta(action).subagentChatUri ?? this._pendingSubagentToolCalls.get(key);
      if (subagentChatUri === void 0) {
        return;
      }
      if (action.type === ActionType.ChatToolCallReady && action.confirmed) {
        this._pendingSubagentToolCalls.delete(key);
        this._armPendingSubagentChat(subagentChatUri);
        return;
      }
      this._pendingSubagentToolCalls.set(key, subagentChatUri);
      return;
    }
    if (action.type === ActionType.ChatToolCallConfirmed) {
      const key = `${channel}:${action.toolCallId}`;
      const subagentChatUri = this._pendingSubagentToolCalls.get(key);
      if (subagentChatUri === void 0) {
        return;
      }
      this._pendingSubagentToolCalls.delete(key);
      if (action.approved) {
        this._armPendingSubagentChat(subagentChatUri);
      }
      return;
    }
    if (action.type === ActionType.ChatToolCallComplete) {
      this._pendingSubagentToolCalls.delete(`${channel}:${action.toolCallId}`);
    }
  }
  _armPendingSubagentChat(subagentChatUri) {
    if (this._pendingSubagentChats.has(subagentChatUri) || this._stateManager.getSnapshot(subagentChatUri)) {
      return;
    }
    const deferred = new DeferredPromise();
    this._pendingSubagentChats.set(subagentChatUri, deferred);
    this._pendingSubagentChatTimeouts.set(subagentChatUri, disposableTimeout(() => {
      this._pendingSubagentChats.delete(subagentChatUri);
      this._pendingSubagentChatTimeouts.deleteAndDispose(subagentChatUri);
      deferred.complete();
    }, SUBAGENT_CHAT_PENDING_TIMEOUT_MS));
  }
  _resolvePendingSubagentChat(resource) {
    const deferred = this._pendingSubagentChats.get(resource);
    if (!deferred) {
      return;
    }
    this._pendingSubagentChats.delete(resource);
    this._pendingSubagentChatTimeouts.deleteAndDispose(resource);
    deferred.complete();
  }
  /**
   * Routes an agent-spawned chat (e.g. a sub-agent delegated by a tool
   * call) straight into the chat catalog via {@link IAgentHostStateManager.addChat},
   * so harness-spawned chats and user-driven chats share ONE membership path.
   * The {@link IAgentSpawnChatEvent.parent} spawn edge is recorded as
   * the chat's {@link ChatOriginKind.Tool} origin. Spawned chats are
   * not written to the orchestrator's persisted peer-chat catalog — they are
   * transient children re-derived from the parent's event log on restore.
   */
  _onChatSpawned(e) {
    this._stateManager.addChat(e.session.toString(), e.chat.toString(), {
      ...e.title !== void 0 ? { title: e.title } : {},
      ...e.parent ? {
        origin: { kind: ChatOriginKind.Tool, chat: e.parent.chat.toString(), toolCallId: e.parent.toolCallId },
        // Subagent worker chats are observable but not directly steerable:
        // the user watches them and steers the lead chat. Mark read-only so
        // the UI hides the composer and shows a lock (the agent-team pattern).
        interactivity: ChatInteractivity.ReadOnly
      } : {}
    });
    this._resolvePendingSubagentChat(e.chat.toString());
  }
  /**
   * Reads the orchestrator's persisted peer-chat catalog for a session.
   * Returns `undefined` when the session has no catalog yet (a legacy session
   * predating orchestrator-owned persistence, or a corrupt blob); the caller
   * then performs a one-time migration from the agent's legacy `*.chats`
   * enumeration (see {@link _restorePeerChats} / {@link _migrateLegacyPeerChats}).
   * An empty array means the session is known to have no peer chats, so
   * migration is skipped.
   */
  async _readPersistedPeerChatCatalog(session) {
    const ref = await this._sessionDataService.tryOpenDatabase?.(session);
    if (!ref) {
      return void 0;
    }
    try {
      const raw = await ref.object.getMetadata(PEER_CHATS_METADATA_KEY);
      if (raw === void 0) {
        return void 0;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this._logService.warn(`[AgentService] Ignoring malformed peer-chat catalog for ${session.toString()}`);
        return void 0;
      }
      return parsed.filter((entry) => typeof entry?.uri === "string").map((entry) => ({
        uri: entry.uri,
        ...typeof entry.providerData === "string" ? { providerData: entry.providerData } : {},
        ...entry.origin !== void 0 ? { origin: entry.origin } : {}
      }));
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to read peer-chat catalog for ${session.toString()}: ${toErrorMessage(err)}`);
      return void 0;
    } finally {
      ref.dispose();
    }
  }
  /**
   * Marks a peer chat's backing SDK session (in that session's own DB) so
   * {@link listSessions} filters it out of the top-level session list. The
   * marker is persisted, so it survives a host restart. Best-effort: a failure
   * only means the backing session may transiently reappear in the list.
   */
  _markPeerChatBacking(backingSession, chat) {
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(backingSession);
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to open backing session database to mark peer-chat backing for ${backingSession.toString()}: ${toErrorMessage(err)}`);
      return;
    }
    ref.object.setMetadata(PEER_CHAT_BACKING_METADATA_KEY, chat.toString()).catch((err) => {
      this._logService.warn(`[AgentService] Failed to mark peer-chat backing for ${backingSession.toString()}: ${toErrorMessage(err)}`);
    }).finally(() => {
      ref.dispose();
    });
  }
  /**
   * Inserts or updates a single peer chat in the orchestrator's persisted
   * catalog, recording its opaque `providerData` verbatim (or clearing it when
   * `undefined`). When `origin` is supplied it is stored as the chat's
   * provenance; when omitted (e.g. a provider-driven `providerData` refresh via
   * {@link _onChatDataChanged}) any previously persisted origin is preserved so
   * a data refresh never drops a side chat's source boundary. Serialized per
   * session via {@link _enqueuePeerChatCatalogWrite}.
   */
  _persistPeerChat(session, chat, providerData, origin) {
    const chatUri = chat.toString();
    return this._enqueuePeerChatCatalogWrite(session, (entries) => {
      const existing = entries.find((entry) => entry.uri === chatUri);
      const effectiveOrigin = origin ?? existing?.origin;
      const next = entries.filter((entry) => entry.uri !== chatUri);
      next.push({
        uri: chatUri,
        ...providerData !== void 0 ? { providerData } : {},
        ...effectiveOrigin !== void 0 ? { origin: effectiveOrigin } : {}
      });
      return next;
    });
  }
  /**
   * Removes a peer chat from the orchestrator's persisted catalog. Serialized
   * per session via {@link _enqueuePeerChatCatalogWrite}.
   */
  _removePersistedPeerChat(session, chat) {
    const chatUri = chat.toString();
    return this._enqueuePeerChatCatalogWrite(session, (entries) => entries.filter((entry) => entry.uri !== chatUri));
  }
  /**
   * Chains a read-modify-write of a session's persisted peer-chat catalog
   * behind any in-flight write for the same session, so concurrent
   * create/dispose/data-change updates can't clobber each other.
   */
  _enqueuePeerChatCatalogWrite(session, mutate) {
    const key = session.toString();
    const previous = this._peerChatCatalogWrites.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {
    }).then(() => this._applyPeerChatCatalogWrite(session, mutate));
    this._peerChatCatalogWrites.set(key, next.finally(() => {
      if (this._peerChatCatalogWrites.get(key) === next) {
        this._peerChatCatalogWrites.delete(key);
      }
    }));
    return next;
  }
  async _applyPeerChatCatalogWrite(session, mutate) {
    const ref = await this._sessionDataService.tryOpenDatabase?.(session);
    if (!ref) {
      return;
    }
    try {
      let current = [];
      try {
        const raw = await ref.object.getMetadata(PEER_CHATS_METADATA_KEY);
        if (raw !== void 0) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            current = parsed.filter((entry) => typeof entry?.uri === "string").map((entry) => ({
              uri: entry.uri,
              ...typeof entry.providerData === "string" ? { providerData: entry.providerData } : {},
              ...entry.origin !== void 0 ? { origin: entry.origin } : {}
            }));
          }
        }
      } catch (err) {
        this._logService.warn(`[AgentService] Replacing malformed peer-chat catalog for ${session.toString()}: ${toErrorMessage(err)}`);
      }
      const updated = mutate(current);
      await ref.object.setMetadata(PEER_CHATS_METADATA_KEY, JSON.stringify(updated));
    } catch (err) {
      this._logService.warn(`[AgentService] Failed to persist peer-chat catalog for ${session.toString()}: ${toErrorMessage(err)}`);
    } finally {
      ref.dispose();
    }
  }
  /** Reads a chat's persisted custom title (default or peer chat), if any. */
  async _readPersistedChatTitle(session, chatUri) {
    const ref = await this._sessionDataService.tryOpenDatabase?.(session);
    if (!ref) {
      return void 0;
    }
    try {
      return await ref.object.getMetadata(`customChatTitle:${chatUri.toString()}`) ?? void 0;
    } catch {
      return void 0;
    } finally {
      ref.dispose();
    }
  }
  async _getChatDraft(session, chatUri) {
    const ref = await this._sessionDataService.tryOpenDatabase(session);
    if (!ref) {
      return void 0;
    }
    try {
      return await ref.object.getChatDraft(chatUri);
    } finally {
      ref.dispose();
    }
  }
  async _getSessionMetadataForRestore(agent, session) {
    const sessionStr = session.toString();
    if (agent.getSessionMetadata) {
      try {
        return await this._withWorktreeProject(session, await agent.getSessionMetadata(session));
      } catch (err) {
        if (err instanceof ProtocolError) {
          throw err;
        }
        try {
          return await this._withWorktreeProject(session, await this._getSessionMetadataFromCatalog(agent, session));
        } catch (fallbackErr) {
          if (fallbackErr instanceof ProtocolError) {
            const message = err instanceof Error ? err.message : String(err);
            throw new ProtocolError(fallbackErr.code, `Failed to get session metadata for ${sessionStr}: ${message}; ${fallbackErr.message}`, fallbackErr.data);
          }
          throw fallbackErr;
        }
      }
    }
    return this._withWorktreeProject(session, await this._getSessionMetadataFromCatalog(agent, session));
  }
  /**
   * Merges the repository project for a worktree-isolated session onto its
   * restored metadata so the session groups under the repository (not the
   * `<repo>.worktrees/<name>` directory) in the sessions UI. No-op for folder
   * sessions and for `undefined` metadata. Host-owned so agents stay unaware.
   */
  async _withWorktreeProject(session, meta) {
    if (!meta || !this._worktree) {
      return meta;
    }
    const project = await this._worktree.resolveWorktreeProject(session);
    return project ? { ...meta, project } : meta;
  }
  async _getSessionMetadataFromCatalog(agent, session) {
    const sessionStr = session.toString();
    let allSessions;
    try {
      allSessions = await agent.listSessions();
    } catch (err) {
      if (err instanceof ProtocolError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new ProtocolError(JSON_RPC_INTERNAL_ERROR, `Failed to list sessions for ${sessionStr}: ${message}`);
    }
    return allSessions.find((s) => s.session.toString() === sessionStr);
  }
  async resourceRead(uri) {
    const editAttributionRequest = parseEditAttributionResource(uri);
    if (editAttributionRequest?.kind === "prepare") {
      const prepared = await this.prepareEditAttributionFlush(editAttributionRequest.params);
      return {
        data: JSON.stringify(prepared ?? null),
        encoding: ContentEncoding.Utf8,
        contentType: "application/json"
      };
    }
    if (editAttributionRequest?.kind === "commit") {
      const result = await this.commitEditAttributionFlush(editAttributionRequest.params);
      return {
        data: JSON.stringify(result),
        encoding: ContentEncoding.Utf8,
        contentType: "application/json"
      };
    }
    if (editAttributionRequest?.kind === "cancel") {
      const result = await this.cancelEditAttributionFlush(editAttributionRequest.params);
      return {
        data: JSON.stringify(result),
        encoding: ContentEncoding.Utf8,
        contentType: "application/json"
      };
    }
    const dbFields = parseSessionDbUri(uri.toString());
    if (dbFields) {
      return this._fetchSessionDbContent(dbFields);
    }
    const blobFields = parseGitBlobUri(uri.toString());
    if (blobFields) {
      return this._fetchGitBlobContent(blobFields);
    }
    try {
      const content = await this._fileService.readFile(uri);
      return {
        data: content.value.toString(),
        encoding: ContentEncoding.Utf8,
        contentType: "text/plain"
      };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const result = toFileOperationResult(error);
      if (result === FileOperationResult.FILE_NOT_FOUND) {
        throw new ProtocolError(AhpErrorCodes.NotFound, `Content not found: ${uri.toString()}`);
      }
      if (result === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${uri.toString()}`);
      }
      throw new ProtocolError(JSON_RPC_INTERNAL_ERROR, `Failed to read content: ${uri.toString()}: ${toErrorMessage(error)}`);
    }
  }
  prepareEditAttributionFlush(params) {
    return this._editAttributionService?.prepareFlush(params) ?? Promise.resolve(void 0);
  }
  commitEditAttributionFlush(params) {
    return this._editAttributionService?.commitFlush(params) ?? Promise.resolve({ outcome: "missing", agentModifiedCount: 0 });
  }
  cancelEditAttributionFlush(params) {
    return this._editAttributionService?.cancelFlush(params) ?? Promise.resolve({ outcome: "missing", agentModifiedCount: 0 });
  }
  async resourceWrite(params) {
    const fileUri = typeof params.uri === "string" ? URI.parse(params.uri) : URI.revive(params.uri);
    try {
      const parent = await this._fileService.stat(resourcesDirname(fileUri));
      if (!parent.isDirectory) {
        throw new ProtocolError(AhpErrorCodes.NotFound, `Parent directory not found: ${fileUri.toString()}`);
      }
    } catch (e) {
      if (e instanceof ProtocolError) {
        throw e;
      }
      const result = toFileOperationResult(e);
      if (result === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${fileUri.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Parent directory not found: ${fileUri.toString()}`);
    }
    let content;
    if (params.encoding === ContentEncoding.Base64) {
      content = decodeBase64(params.data);
    } else {
      content = VSBuffer.fromString(params.data);
    }
    const mode = params.mode ?? ResourceWriteMode.Truncate;
    const position = params.position ?? 0;
    try {
      await this._resourceWriteQueue.queueFor(fileUri, async () => {
        if (params.ifMatch !== void 0 || mode !== ResourceWriteMode.Truncate || position !== 0) {
          await this._resourceWriteWithMode(fileUri, content, mode, position, params);
        } else if (params.createOnly) {
          await this._createFileExclusive(fileUri, content);
        } else {
          await this._fileService.writeFile(fileUri, content);
        }
      }, extUriBiasedIgnorePathCase);
      return {};
    } catch (e) {
      if (e instanceof ProtocolError) {
        throw e;
      }
      const result = toFileOperationResult(e);
      if (params.createOnly && (result === FileOperationResult.FILE_MODIFIED_SINCE || result === FileOperationResult.FILE_MOVE_CONFLICT)) {
        throw new ProtocolError(AhpErrorCodes.AlreadyExists, `File already exists: ${fileUri.toString()}`);
      }
      if (result === FileOperationResult.FILE_MODIFIED_SINCE) {
        const message = params.ifMatch !== void 0 ? `ifMatch precondition failed for: ${fileUri.toString()}` : `File changed while writing: ${fileUri.toString()}`;
        throw new ProtocolError(AhpErrorCodes.Conflict, message);
      }
      if (result === FileOperationResult.FILE_MOVE_CONFLICT) {
        throw new ProtocolError(AhpErrorCodes.AlreadyExists, `File already exists: ${fileUri.toString()}`);
      }
      if (result === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${fileUri.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Failed to write file: ${fileUri.toString()}`);
    }
  }
  async _createFileExclusive(fileUri, content) {
    if (fileUri.scheme !== Schemas.file) {
      await this._fileService.createFile(fileUri, content, { overwrite: false });
      return;
    }
    let handle;
    try {
      handle = await open(fileUri.fsPath, "wx");
    } catch (error) {
      if (isErrorWithCode(error, "EEXIST")) {
        throw new ProtocolError(AhpErrorCodes.AlreadyExists, `File already exists: ${fileUri.toString()}`);
      }
      throw error;
    }
    let failure;
    try {
      await handle.writeFile(content.buffer);
    } catch (error) {
      failure = error;
    }
    try {
      await handle.close();
    } catch (error) {
      failure = failure ? new AggregateError([failure, error]) : error;
    }
    if (failure) {
      try {
        await unlink(fileUri.fsPath);
      } catch (cleanupError) {
        throw new AggregateError([failure, cleanupError], `Failed to create and clean up file: ${fileUri.toString()}`);
      }
      throw failure;
    }
  }
  /**
   * Slow-path for {@link resourceWrite} when the caller requested a
   * non-default {@link ResourceWriteMode}, supplied a `position`, or
   * provided an `ifMatch` etag precondition. Reads the current file
   * contents (when needed) and produces a single `writeFile` call that
   * realises the requested splice. A missing file is treated as
   * empty for `append` and `insert` (so the operation behaves like a
   * create); for `truncate` it falls through to a normal write.
   */
  async _resourceWriteWithMode(fileUri, data, mode, position, params) {
    let existing;
    let currentEtag;
    let currentMtime;
    try {
      const file = await this._fileService.readFile(fileUri);
      existing = file.value;
      currentEtag = file.etag;
      currentMtime = file.mtime;
    } catch (e) {
      if (toFileOperationResult(e) !== FileOperationResult.FILE_NOT_FOUND) {
        throw e;
      }
    }
    if (params.createOnly && existing !== void 0) {
      throw new ProtocolError(AhpErrorCodes.AlreadyExists, `File already exists: ${fileUri.toString()}`);
    }
    if (params.ifMatch !== void 0) {
      if (existing === void 0 || currentEtag !== params.ifMatch) {
        throw new ProtocolError(AhpErrorCodes.Conflict, `ifMatch precondition failed for: ${fileUri.toString()}`);
      }
    }
    const base = existing ?? VSBuffer.alloc(0);
    let next;
    switch (mode) {
      case ResourceWriteMode.Append: {
        const eof = base.byteLength;
        const splitAt = Math.max(0, eof - position);
        next = VSBuffer.concat([base.slice(0, splitAt), data, base.slice(splitAt, eof)]);
        break;
      }
      case ResourceWriteMode.Insert: {
        const splitAt = Math.min(position, base.byteLength);
        next = VSBuffer.concat([base.slice(0, splitAt), data, base.slice(splitAt, base.byteLength)]);
        break;
      }
      case ResourceWriteMode.Truncate:
      default: {
        const splitAt = Math.min(position, base.byteLength);
        next = VSBuffer.concat([base.slice(0, splitAt), data]);
        break;
      }
    }
    if (params.createOnly) {
      await this._createFileExclusive(fileUri, next);
    } else {
      await this._fileService.writeFile(fileUri, next, { etag: currentEtag, mtime: currentMtime });
    }
  }
  async resourceCopy(params) {
    const source = URI.parse(params.source);
    const destination = URI.parse(params.destination);
    try {
      await this._fileService.copy(source, destination, !params.failIfExists);
      return {};
    } catch (e) {
      const result = toFileOperationResult(e);
      if (result === FileOperationResult.FILE_MOVE_CONFLICT) {
        throw new ProtocolError(AhpErrorCodes.AlreadyExists, `Destination already exists: ${destination.toString()}`);
      }
      if (result === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${source.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Source not found: ${source.toString()}`);
    }
  }
  async resourceDelete(params) {
    const fileUri = URI.parse(params.uri);
    try {
      await this._fileService.del(fileUri, { recursive: params.recursive });
      return {};
    } catch (e) {
      if (toFileOperationResult(e) === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${fileUri.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Resource not found: ${fileUri.toString()}`);
    }
  }
  async resourceMove(params) {
    const source = URI.parse(params.source);
    const destination = URI.parse(params.destination);
    try {
      await this._fileService.move(source, destination, !params.failIfExists);
      return {};
    } catch (e) {
      const result = toFileOperationResult(e);
      if (result === FileOperationResult.FILE_MOVE_CONFLICT) {
        throw new ProtocolError(AhpErrorCodes.AlreadyExists, `Destination already exists: ${destination.toString()}`);
      }
      if (result === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${source.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Source not found: ${source.toString()}`);
    }
  }
  async resourceResolve(params) {
    const uri = typeof params.uri === "string" ? URI.parse(params.uri) : URI.revive(params.uri);
    try {
      const stat = await this._fileService.stat(uri);
      let type;
      if (stat.isSymbolicLink && params.followSymlinks === false) {
        type = ResourceType.Symlink;
      } else if (stat.isDirectory) {
        type = ResourceType.Directory;
      } else {
        type = ResourceType.File;
      }
      const result = {
        uri: uri.toString(),
        type,
        ...stat.size !== void 0 ? { size: stat.size } : {},
        ...stat.mtime !== void 0 ? { mtime: new Date(stat.mtime).toISOString() } : {},
        ...stat.ctime !== void 0 ? { ctime: new Date(stat.ctime).toISOString() } : {},
        ...stat.etag ? { etag: stat.etag } : {}
      };
      return result;
    } catch (e) {
      if (toFileOperationResult(e) === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${uri.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Resource not found: ${uri.toString()}`);
    }
  }
  async resourceMkdir(params) {
    const uri = typeof params.uri === "string" ? URI.parse(params.uri) : URI.revive(params.uri);
    try {
      const existing = await this._fileService.stat(uri).catch(() => void 0);
      if (existing && !existing.isDirectory) {
        throw new ProtocolError(AhpErrorCodes.AlreadyExists, `Path exists and is not a directory: ${uri.toString()}`);
      }
      await this._fileService.createFolder(uri);
      return {};
    } catch (e) {
      if (e instanceof ProtocolError) {
        throw e;
      }
      if (toFileOperationResult(e) === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${uri.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Failed to create directory: ${uri.toString()}`);
    }
  }
  async createResourceWatch(params) {
    const root = typeof params.uri === "string" ? URI.parse(params.uri) : URI.revive(params.uri);
    try {
      await this._fileService.stat(root);
    } catch (e) {
      if (toFileOperationResult(e) === FileOperationResult.FILE_PERMISSION_DENIED) {
        throw new ProtocolError(AhpErrorCodes.PermissionDenied, `Permission denied: ${root.toString()}`);
      }
      throw new ProtocolError(AhpErrorCodes.NotFound, `Resource not found: ${root.toString()}`);
    }
    const channel = buildResourceWatchChannelUri({
      root: root.toString(),
      recursive: params.recursive === true,
      excludes: params.excludes,
      includes: params.includes
    });
    return { channel };
  }
  /**
   * Notifies the agent service that a client subscribed to a resource
   * watch channel. On the first subscriber the underlying
   * {@link IFileService} watcher is attached; subsequent subscribers
   * bump the refcount and cancel any pending grace dispose. Returns
   * the decoded descriptor for use as the subscribe snapshot, or
   * `undefined` when `channel` is not a recognisable
   * `ahp-resource-watch:` URI.
   */
  onResourceWatchSubscribed(channel) {
    const descriptor = parseResourceWatchChannelUri(channel);
    if (!descriptor) {
      return void 0;
    }
    const existing = this._resourceWatches.get(channel);
    if (existing) {
      existing.subscribers++;
      if (existing.pendingGc) {
        existing.pendingGc.clear();
      }
      return existing.descriptor;
    }
    const disposables = new DisposableStore();
    try {
      const root = URI.parse(descriptor.root);
      const watchOptions = {
        recursive: descriptor.recursive,
        excludes: descriptor.excludes?.items ?? [],
        includes: descriptor.includes?.items
      };
      if (descriptor.recursive) {
        disposables.add(this._fileService.watch(root, watchOptions));
        disposables.add(this._fileService.onDidFilesChange((event) => {
          const filtered = collectChangesUnderRoot(event, root);
          if (filtered.length > 0) {
            this._dispatchResourceWatchChanges(channel, filtered);
          }
        }));
      } else {
        const watcher = this._fileService.createWatcher(root, { ...watchOptions, recursive: false });
        disposables.add(watcher);
        disposables.add(watcher.onDidChange((event) => {
          this._dispatchResourceWatchChanges(channel, collectChanges(event));
        }));
      }
    } catch (e) {
      disposables.dispose();
      this._logService.warn(`[AgentService] Failed to start IFileService watcher for ${channel}: ${e instanceof Error ? e.message : String(e)}`);
      return void 0;
    }
    this._resourceWatches.set(channel, {
      channel,
      descriptor,
      subscribers: 1,
      disposables,
      pendingGc: disposables.add(new MutableDisposable()),
      dispose: () => disposables.dispose()
    });
    return descriptor;
  }
  /**
   * Counterpart to {@link onResourceWatchSubscribed}. Decrements the
   * subscriber refcount for a watch channel; when it reaches zero the
   * watcher is held for {@link RESOURCE_WATCH_GRACE_MS} before being
   * disposed, giving a transient disconnect time to resubscribe.
   */
  onResourceWatchUnsubscribed(channel) {
    const entry = this._resourceWatches.get(channel);
    if (!entry) {
      return false;
    }
    entry.subscribers = Math.max(0, entry.subscribers - 1);
    if (entry.subscribers > 0) {
      return true;
    }
    entry.pendingGc.value = disposableTimeout(() => {
      const current = this._resourceWatches.get(channel);
      if (!current || current.subscribers > 0) {
        return;
      }
      this._resourceWatches.deleteAndDispose(channel);
    }, RESOURCE_WATCH_GRACE_MS);
    return true;
  }
  _dispatchResourceWatchChanges(channel, raw) {
    if (raw.length === 0) {
      return;
    }
    const items = raw.map((c) => ({
      uri: c.resource.toString(),
      type: c.type === FileChangeType.ADDED ? ResourceChangeType.Added : c.type === FileChangeType.DELETED ? ResourceChangeType.Deleted : ResourceChangeType.Updated
    }));
    this._stateManager.dispatchServerAction(channel, {
      type: ActionType.ResourceWatchChanged,
      changes: { items }
    });
  }
  async shutdown() {
    this._logService.info("AgentService: shutting down all providers...");
    const promises = [];
    for (const provider of this._providers.values()) {
      promises.push(provider.shutdown());
    }
    await Promise.all(promises);
    this._sessionToProvider.clear();
    this._downloadProgressInterest.clear();
  }
  /**
   * Wire the network diagnostics service backing {@link getNetworkDiagnosticsInfo}
   * and {@link diagnosticsFetch}. A setter rather than a constructor argument
   * because the service depends on the agent-host proxy resolver, which the
   * remote server constructs lazily — after this service.
   */
  setNetworkDiagnosticsService(service) {
    this._networkDiagnostics = service;
  }
  setEditAttributionService(service) {
    this._editAttributionService = service;
    service.setEnabled(this._stateManager.rootState.config?.values[AgentHostEditTelemetryEnabledConfigKey] !== false);
  }
  async getNetworkDiagnosticsInfo() {
    if (!this._networkDiagnostics) {
      throw new Error("Network diagnostics unavailable: service not wired");
    }
    const providers = [...this._providers.values()];
    const contributions = await Promise.all(providers.map(async (provider) => {
      try {
        return await provider.getNetworkDiagnosticsEndpoints?.() ?? [];
      } catch (error) {
        this._logService.warn(`[AgentService] Failed to resolve network diagnostics endpoints for ${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    }));
    const accounts = await Promise.all(providers.map(async (provider) => {
      try {
        return await provider.getNetworkDiagnosticsAccount?.();
      } catch (error) {
        this._logService.warn(`[AgentService] Failed to resolve network diagnostics account for ${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
        return void 0;
      }
    }));
    const endpoints = [];
    const seen = /* @__PURE__ */ new Set();
    for (const endpoint of contributions.flat()) {
      let key;
      try {
        key = new URL(endpoint.url).toString();
      } catch {
        key = endpoint.url;
      }
      if (!seen.has(key)) {
        seen.add(key);
        endpoints.push(endpoint);
      }
    }
    return this._networkDiagnostics.getInfo(endpoints, accounts.find((account) => !!account));
  }
  async getManagedSettingsDiagnostics() {
    const providers = [...this._providers.values()].filter((provider) => provider.getManagedSettingsDiagnostics);
    return Promise.all(providers.map(async (provider) => {
      try {
        return { provider: provider.id, snapshot: await provider.getManagedSettingsDiagnostics() };
      } catch (error) {
        return { provider: provider.id, error: error instanceof Error ? error.message : String(error) };
      }
    }));
  }
  async diagnosticsFetch(url) {
    if (!this._networkDiagnostics) {
      throw new Error("Network diagnostics unavailable: service not wired");
    }
    return this._networkDiagnostics.fetch(url);
  }
  // ---- helpers ------------------------------------------------------------
  async _fetchSessionDbContent(fields) {
    const sessionUri = URI.parse(fields.sessionUri);
    const ref = this._sessionDataService.openDatabase(sessionUri);
    try {
      const content = await ref.object.readFileEditContent(fields.toolCallId, fields.filePath);
      if (!content) {
        throw new ProtocolError(AhpErrorCodes.NotFound, `File edit not found: toolCallId=${fields.toolCallId}, filePath=${fields.filePath}`);
      }
      const bytes = fields.part === "before" ? content.beforeContent : content.afterContent;
      if (!bytes) {
        throw new ProtocolError(AhpErrorCodes.NotFound, `No ${fields.part} content for: toolCallId=${fields.toolCallId}, filePath=${fields.filePath}`);
      }
      return {
        data: new TextDecoder().decode(bytes),
        encoding: ContentEncoding.Utf8,
        contentType: "text/plain"
      };
    } finally {
      ref.dispose();
    }
  }
  async _fetchGitBlobContent(fields) {
    if (!this._gitService) {
      throw new ProtocolError(AhpErrorCodes.NotFound, `git service unavailable for: ${fields.repoRelativePath}`);
    }
    const workingDirectory = this._stateManager.getSessionState(fields.sessionUri)?.workingDirectories?.[0];
    if (!workingDirectory) {
      throw new ProtocolError(AhpErrorCodes.NotFound, `Session has no working directory for git-blob URI: ${fields.sessionUri}`);
    }
    const blob = await this._gitService.showBlob(URI.parse(workingDirectory), fields.sha, fields.repoRelativePath);
    if (!blob) {
      throw new ProtocolError(AhpErrorCodes.NotFound, `git blob not found: ${fields.sha}:${fields.repoRelativePath}`);
    }
    return {
      data: blob.toString(),
      encoding: ContentEncoding.Utf8,
      contentType: "text/plain"
    };
  }
  /**
   * Restores a subagent session from its parent session's event history.
   * Loads the parent's raw messages, filters for events belonging to
   * the subagent (by `parentToolCallId`), and builds the child session's
   * turns from those events.
   */
  async _restoreSubagentSession(subagentUri, parentSession) {
    if (this._stateManager.getSessionState(subagentUri)) {
      return;
    }
    const inFlight = this._restoreSubagentInFlight.get(subagentUri);
    if (inFlight) {
      return inFlight;
    }
    const restore = this._doRestoreSubagentSession(subagentUri, parentSession);
    this._restoreSubagentInFlight.set(subagentUri, restore);
    try {
      await restore;
    } finally {
      if (this._restoreSubagentInFlight.get(subagentUri) === restore) {
        this._restoreSubagentInFlight.delete(subagentUri);
      }
    }
  }
  async _doRestoreSubagentSession(subagentUri, parentSession) {
    const parentSessionKey = parentSession.toString();
    if (!this._stateManager.getSessionState(parentSessionKey)) {
      try {
        await this.restoreSession(parentSession);
      } catch {
        this._logService.warn(`[AgentService] Cannot restore parent session for subagent: ${parentSessionKey}`);
        return;
      }
    }
    const parentState = this._stateManager.getSessionState(parentSessionKey);
    if (!parentState) {
      return;
    }
    const allTurns = [...parentState.turns];
    if (parentState.activeTurn) {
      allTurns.push(parentState.activeTurn);
    }
    let subagentContent;
    for (const turn of allTurns) {
      for (const part of turn.responseParts) {
        if (part.kind === ResponsePartKind.ToolCall) {
          const tc = part.toolCall;
          const content = tc.status === ToolCallStatus.Completed ? tc.content : tc.status === ToolCallStatus.Running ? tc.content : void 0;
          if (content) {
            for (const c of content) {
              if (c.type === ToolResultContentType.Subagent && c.resource === subagentUri) {
                subagentContent = c;
                break;
              }
            }
          }
        }
      }
      if (subagentContent) {
        break;
      }
    }
    let childTurns = [];
    const agent = this._findProviderForSession(parentSession);
    if (agent) {
      try {
        childTurns = await this._getChatMessages(agent, URI.parse(subagentUri));
      } catch (err) {
        this._logService.warn(`[AgentService] Failed to load subagent turns for ${subagentUri}`, err);
      }
    }
    const title = subagentContent?.title ?? "Subagent";
    const subagentNow = (/* @__PURE__ */ new Date()).toISOString();
    const mergedChildTurns = await this._interleaveLocalTurns(parentSession.toString(), subagentUri, childTurns);
    this._stateManager.restoreSession(
      {
        resource: subagentUri,
        provider: "subagent",
        title,
        status: SessionStatus.Idle,
        createdAt: subagentNow,
        modifiedAt: subagentNow,
        ...parentState?.project ? { project: parentState.project } : {}
      },
      mergedChildTurns
    );
    this._logService.info(`[AgentService] Restored subagent session: ${subagentUri} with ${childTurns.length} turn(s)`);
  }
  /**
   * Registers a subagent child session's state up-front from data the agent
   * already reconstructed for the parent, so a later subscribe-driven
   * {@link _restoreSubagentSession} finds it present and returns early
   * instead of re-reading the parent event log. No-op if already registered.
   */
  _registerRestoredSubagent(child, parentSummary, parentSessionStr) {
    const resourceStr = child.resource.toString();
    if (this._stateManager.getSessionState(resourceStr)) {
      return;
    }
    const registeredNow = (/* @__PURE__ */ new Date()).toISOString();
    this._stateManager.restoreSession(
      {
        resource: resourceStr,
        provider: "subagent",
        title: child.title,
        status: SessionStatus.Idle,
        createdAt: registeredNow,
        modifiedAt: registeredNow,
        ...parentSummary.project ? { project: parentSummary.project } : {}
      },
      [...child.turns]
    );
    const subagentChatUri = buildSubagentChatUri(parentSessionStr, child.toolCallId);
    this._stateManager.addChat(parentSessionStr, subagentChatUri, {
      title: child.title,
      turns: [...child.turns],
      origin: { kind: ChatOriginKind.Tool, chat: buildDefaultChatUri(parentSessionStr), toolCallId: child.toolCallId },
      interactivity: ChatInteractivity.ReadOnly
    });
  }
  _findProviderForSession(session) {
    const key = typeof session === "string" ? session : session.toString();
    const providerId = this._sessionToProvider.get(key);
    if (providerId) {
      return this._providers.get(providerId);
    }
    const schemeProvider = AgentSession.provider(session);
    if (schemeProvider) {
      return this._providers.get(schemeProvider);
    }
    if (this._defaultProvider) {
      return this._providers.get(this._defaultProvider);
    }
    return void 0;
  }
  /**
   * Sets the agents observable to trigger model re-fetch and
   * `root/agentsChanged` via the autorun in {@link AgentSideEffects}.
   */
  _updateAgents() {
    this._agents.set([...this._providers.values()], void 0);
  }
  dispose() {
    for (const provider of this._providers.values()) {
      provider.dispose();
    }
    this._providers.clear();
    super.dispose();
  }
}
function isErrorWithCode(error, code) {
  return error instanceof Error && hasErrorCode(error, code);
}
function hasErrorCode(error, code) {
  return hasKey(error, { code: true }) && error.code === code;
}
function collectChanges(event) {
  const out = [];
  for (const resource of event.rawAdded) {
    out.push({ resource, type: FileChangeType.ADDED });
  }
  for (const resource of event.rawUpdated) {
    out.push({ resource, type: FileChangeType.UPDATED });
  }
  for (const resource of event.rawDeleted) {
    out.push({ resource, type: FileChangeType.DELETED });
  }
  return out;
}
function collectChangesUnderRoot(event, root) {
  const out = [];
  const accept = (resource, type) => {
    if (isEqualOrParent(resource, root)) {
      out.push({ resource, type });
    }
  };
  for (const resource of event.rawAdded) {
    accept(resource, FileChangeType.ADDED);
  }
  for (const resource of event.rawUpdated) {
    accept(resource, FileChangeType.UPDATED);
  }
  for (const resource of event.rawDeleted) {
    accept(resource, FileChangeType.DELETED);
  }
  return out;
}
export {
  AgentService
};
