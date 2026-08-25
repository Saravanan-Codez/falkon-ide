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
import { disposableTimeout, SequencerByKey } from "../../../base/common/async.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../log/common/log.js";
import {
  buildBranchChangesetUri,
  buildCompareTurnsChangesetUri,
  buildSessionChangesetUri,
  buildTurnChangesetUri,
  buildUncommittedChangesetUri,
  parseChangesetUri,
  ChangesetKind,
  buildDefaultChangesetCatalog
} from "../common/changesetUri.js";
import { ISessionDataService } from "../common/sessionDataService.js";
import { ActionType } from "../common/state/sessionActions.js";
import {
  ChangesetStatus,
  readSessionGitState,
  isDefaultChatUri,
  SessionLifecycle
} from "../common/state/sessionState.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { IAgentConfigurationService } from "./agentConfigurationService.js";
import { IAgentHostGitService, META_DIFF_BASE_BRANCH, resolveDiffBaseBranchName } from "../common/agentHostGitService.js";
import { IAgentHostCheckpointService } from "../common/agentHostCheckpointService.js";
import { NodeWorkerDiffComputeService } from "./diffComputeService.js";
import { computeSessionDiffs, computeTurnDiffs, computeUnionedDiffs } from "./sessionDiffAggregator.js";
import { CHANGESET_DB_METADATA_KEYS, META_CHANGES_SUMMARY, META_CHANGESET_BRANCH, META_CHANGESET_SESSION, META_LEGACY_DIFFS } from "../common/agentHostChangesetService.js";
import { IAgentHostChangesetSubscriptionService } from "../common/agentHostChangesetSubscriptionService.js";
import { IAgentHostChangesetOperationService } from "../common/agentHostChangesetOperationService.js";
import { IAgentHostReviewService } from "../common/agentHostReviewService.js";
import { relativePath } from "../../../base/common/resources.js";
function staticChangesetUri(session, kind) {
  return kind === "branch" ? buildBranchChangesetUri(session) : buildSessionChangesetUri(session);
}
function persistKeyFor(kind) {
  return kind === "branch" ? META_CHANGESET_BRANCH : META_CHANGESET_SESSION;
}
function summariseDiffs(diffs) {
  if (!diffs) {
    return void 0;
  }
  let additions = 0;
  let deletions = 0;
  for (const d of diffs) {
    additions += d.diff?.added ?? 0;
    deletions += d.diff?.removed ?? 0;
  }
  return { additions, deletions, files: diffs.length };
}
function computeChangesSummaryFromLiveState(session) {
  const sessionDiffs = session?.status === ChangesetStatus.Ready ? session.files.map((f) => f.edit) : void 0;
  return summariseDiffs(sessionDiffs);
}
function computeChangesSummaryFromPersistedDiffs(sessionDiffs) {
  return summariseDiffs(sessionDiffs);
}
function tryParsePersistedDiffs(raw, sessionUri, kind, log) {
  if (!raw) {
    return void 0;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    log.warn(`[AgentHostChangesetService] Failed to parse persisted ${kind} diffs for ${sessionUri}: ${toErrorMessage(err)}`);
    return void 0;
  }
}
let AgentHostChangesetService = class extends Disposable {
  constructor(_stateManager, _logService, _sessionDataService, _gitService, _checkpointService, _configurationService, _changesetOperationService, _changesetSubscriptions, _reviewService) {
    super();
    this._stateManager = _stateManager;
    this._logService = _logService;
    this._sessionDataService = _sessionDataService;
    this._gitService = _gitService;
    this._checkpointService = _checkpointService;
    this._configurationService = _configurationService;
    this._changesetOperationService = _changesetOperationService;
    this._changesetSubscriptions = _changesetSubscriptions;
    this._reviewService = _reviewService;
    /** Serializes per-session diff computations to avoid races with stale previousDiffs. */
    this._diffComputationSequencer = new SequencerByKey();
    /** Per-session debounce timers for mid-turn diff computation. */
    this._debouncedDiffTimers = this._register(new DisposableMap());
    /** Per-`(session, turnId)` debounce timers for mid-turn per-turn changeset recomputation. */
    this._perTurnDebouncedDiffTimers = this._register(new DisposableMap());
    this._activeStaticComputes = /* @__PURE__ */ new Set();
    /**
     * Sessions whose static changeset refresh was requested before the
     * working directory was known (provisional / not-yet-materialized
     * sessions). Drained from {@link onWorkingDirectoryAvailable} once the
     * working directory is set, which recomputes every changeset still
     * subscribed for the session.
     *
     * Firing a refresh before the working directory is known would compute
     * against a missing directory and the git path would bail, so we defer
     * instead and re-run once materialization / restore populates it.
     */
    this._pendingMaterialization = /* @__PURE__ */ new Set();
    this._diffComputeService = this._register(new NodeWorkerDiffComputeService(this._logService));
  }
  static {
    this._DIFF_DEBOUNCE_MS = 5e3;
  }
  /**
   * Returns true when at least one client is subscribed to `changeset`
   * under `session`.
   */
  _hasSubscription(session, changeset) {
    return this._changesetSubscriptions.getSessionSubscriptions(session).has(changeset);
  }
  _hasWorkingDirectory(session) {
    return !!this._configurationService.getEffectiveWorkingDirectory(session);
  }
  registerStaticChangesets(session) {
    this._stateManager.registerChangeset(buildBranchChangesetUri(session));
    this._stateManager.registerChangeset(buildUncommittedChangesetUri(session));
    this._stateManager.registerChangeset(buildSessionChangesetUri(session));
  }
  restoreStaticChangeset(session, kind, diffs) {
    const changesetUri = this._stateManager.registerChangeset(staticChangesetUri(session, kind));
    this._publishChangesetDiffs(session, changesetUri, diffs);
  }
  parsePersistedStaticChangesets(sessionUri, metadata) {
    const persistedBranch = tryParsePersistedDiffs(metadata.branchRaw, sessionUri, "branch", this._logService);
    const persistedSession = tryParsePersistedDiffs(metadata.sessionRaw, sessionUri, "session", this._logService) ?? tryParsePersistedDiffs(metadata.legacyRaw, sessionUri, "session (legacy)", this._logService);
    return { branch: persistedBranch, session: persistedSession };
  }
  applyPersistedStaticChangesets(sessionUri, diffs) {
    this._seedIfEmpty(sessionUri, "branch", diffs.branch);
    this._seedIfEmpty(sessionUri, "session", diffs.session);
  }
  restorePersistedStaticChangesets(sessionUri, metadata) {
    const parsed = this.parsePersistedStaticChangesets(sessionUri, metadata);
    this.applyPersistedStaticChangesets(sessionUri, parsed);
    return parsed;
  }
  persistChangesSummary(sessionUri, summary) {
    this._persistSessionFlag(sessionUri, META_CHANGES_SUMMARY, JSON.stringify(summary));
  }
  getListMetadataKeys(sessionUri) {
    const liveSummaryChanges = this._stateManager.getSessionSummary(sessionUri)?.changes;
    if (liveSummaryChanges) {
      return void 0;
    }
    const liveSession = this._stateManager.getChangesetState(buildSessionChangesetUri(sessionUri));
    if (liveSession?.status === ChangesetStatus.Ready) {
      return void 0;
    }
    return CHANGESET_DB_METADATA_KEYS;
  }
  computeListEntryChanges(sessionUri, metadata) {
    if (this._stateManager.getSessionState(sessionUri)) {
      return void 0;
    }
    const changesSummary = metadata[META_CHANGES_SUMMARY];
    if (changesSummary !== void 0) {
      try {
        return JSON.parse(changesSummary);
      } catch (error) {
        return void 0;
      }
    }
    const liveSession = this._stateManager.getChangesetState(buildBranchChangesetUri(sessionUri));
    const liveChanges = computeChangesSummaryFromLiveState(liveSession);
    if (liveChanges) {
      this.persistChangesSummary(sessionUri, liveChanges);
      return liveChanges;
    }
    const branchRaw = metadata[META_CHANGESET_BRANCH];
    const legacyRaw = metadata[META_LEGACY_DIFFS];
    if (branchRaw === void 0 && legacyRaw === void 0) {
      return void 0;
    }
    const restored = this.parsePersistedStaticChangesets(sessionUri, { branchRaw, legacyRaw });
    const persistedChanges = computeChangesSummaryFromPersistedDiffs(restored.branch);
    if (persistedChanges) {
      this.persistChangesSummary(sessionUri, persistedChanges);
      return persistedChanges;
    }
    return void 0;
  }
  isStaticChangesetComputeActive(changesetUri) {
    return this._activeStaticComputes.has(changesetUri);
  }
  _seedIfEmpty(session, kind, diffs) {
    if (!diffs) {
      return;
    }
    const existing = this._stateManager.getChangesetState(staticChangesetUri(session, kind));
    if (existing && existing.files.length > 0) {
      return;
    }
    this.restoreStaticChangeset(session, kind, diffs);
  }
  refreshChangesetCatalog(session) {
    const state = this._stateManager.getSessionState(session);
    if (!state || state?.lifecycle === SessionLifecycle.CreationFailed) {
      return;
    }
    const changesets = buildDefaultChangesetCatalog(session, state);
    this._stateManager.setSessionChangesets(session, changesets);
  }
  refreshBranchChangeset(session) {
    if (!this._hasWorkingDirectory(session)) {
      this._pendingMaterialization.add(session);
      return;
    }
    this._scheduleStaticRecompute(session, "branch", void 0, this._markStaticChangesetComputing(session, "branch"));
  }
  refreshSessionChangeset(session) {
    if (!this._hasWorkingDirectory(session)) {
      this._pendingMaterialization.add(session);
      return;
    }
    this._scheduleStaticRecompute(session, "session", void 0, this._markStaticChangesetComputing(session, "session"));
  }
  /**
   * Drains static changeset refreshes that were deferred because the
   * session's working directory was not yet known. Called by the
   * coordinator once a session is materialized or restored. Recomputes
   * every changeset still subscribed for the session; subscriptions that
   * dropped while the working directory was unknown are naturally skipped.
   */
  onWorkingDirectoryAvailable(session) {
    if (this._pendingMaterialization.delete(session)) {
      this.recomputeSubscribedChangesets(session);
    }
  }
  /**
   * Recomputes every changeset currently subscribed for `session`. Each
   * subscribed changeset is dispatched to its kind-specific recompute; the
   * recomputes self-defer when the working directory is still unknown.
   */
  recomputeSubscribedChangesets(session) {
    const subscriptions = this._changesetSubscriptions.getSessionSubscriptions(session);
    if (subscriptions.size === 0) {
      return;
    }
    for (const changeset of subscriptions) {
      const parsed = parseChangesetUri(changeset);
      switch (parsed?.kind) {
        case ChangesetKind.Branch:
          this.refreshBranchChangeset(session);
          break;
        case ChangesetKind.Session:
          this.refreshSessionChangeset(session);
          break;
        case ChangesetKind.Uncommitted:
          void this.computeUncommittedChangeset(session);
          break;
        case ChangesetKind.Turn:
          if (parsed.turnId !== void 0) {
            void this.computeTurnChangeset(session, parsed.turnId);
          }
          break;
        default:
          if (changeset === session) {
            this.refreshBranchChangeset(session);
            this.refreshSessionChangeset(session);
          }
          break;
      }
    }
  }
  /**
   * Forgets any deferred static changeset refreshes queued for a session
   * that is being disposed.
   */
  onSessionDisposed(session) {
    this._pendingMaterialization.delete(session);
  }
  async computeTurnChangeset(session, turnId) {
    const turnUri = this._stateManager.registerChangeset(buildTurnChangesetUri(session, turnId));
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(URI.parse(session));
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] Failed to open session database for turn diff: ${session}`, err);
      this._stateManager.dispatchServerAction(turnUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Error,
        error: { errorType: "computeFailed", message: err instanceof Error ? err.message : String(err) }
      });
      return turnUri;
    }
    try {
      const diffs = await this._computeTurnDiffsPreferCheckpoint(session, ref.object, turnId);
      this._publishChangesetDiffs(session, turnUri, diffs);
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] Failed to compute turn diffs for ${session}/${turnId}`, err);
      this._stateManager.dispatchServerAction(turnUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Error,
        error: { errorType: "computeFailed", message: err instanceof Error ? err.message : String(err) }
      });
    } finally {
      ref.dispose();
    }
    return turnUri;
  }
  async computeCompareTurnsChangeset(session, originalTurnId, modifiedTurnId) {
    const compareUri = this._stateManager.registerChangeset(buildCompareTurnsChangesetUri(session, originalTurnId, modifiedTurnId));
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(URI.parse(session));
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] Failed to open session database for compare-turns diff: ${session}`, err);
      this._stateManager.dispatchServerAction(compareUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Error,
        error: { errorType: "computeFailed", message: err instanceof Error ? err.message : String(err) }
      });
      return compareUri;
    }
    try {
      const sessionUri = URI.parse(session);
      const [originalCurrentRef, modifiedPair] = await Promise.all([
        this._checkpointService.getTurnCheckpointPair(sessionUri, originalTurnId).then((p) => p?.current),
        this._checkpointService.getTurnCheckpointPair(sessionUri, modifiedTurnId)
      ]);
      if (!originalCurrentRef || !modifiedPair) {
        const missing = !originalCurrentRef && !modifiedPair ? "both turns" : !originalCurrentRef ? "original turn" : "modified turn";
        this._stateManager.dispatchServerAction(compareUri, {
          type: ActionType.ChangesetStatusChanged,
          status: ChangesetStatus.Error,
          error: { errorType: "computeFailed", message: `No checkpoint available for ${missing}; compare requires git-backed sessions.` }
        });
        return compareUri;
      }
      if (originalCurrentRef === modifiedPair.current) {
        this._publishChangesetDiffs(session, compareUri, []);
        return compareUri;
      }
      const workingDir = await this._resolveWorkingDirectory(session);
      if (!workingDir) {
        this._stateManager.dispatchServerAction(compareUri, {
          type: ActionType.ChangesetStatusChanged,
          status: ChangesetStatus.Error,
          error: { errorType: "computeFailed", message: "No working directory recorded for session; compare requires git-backed sessions." }
        });
        return compareUri;
      }
      const diffs = await this._gitService.computeFileDiffsBetweenRefs(workingDir, {
        sessionUri: session,
        fromRef: originalCurrentRef,
        toRef: modifiedPair.current
      });
      if (diffs === void 0) {
        this._stateManager.dispatchServerAction(compareUri, {
          type: ActionType.ChangesetStatusChanged,
          status: ChangesetStatus.Error,
          error: { errorType: "computeFailed", message: `Failed to compute compare-turns diff from git (${originalCurrentRef}..${modifiedPair.current}).` }
        });
        return compareUri;
      }
      this._publishChangesetDiffs(session, compareUri, diffs);
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] Failed to compute compare-turns diffs for ${session}/${originalTurnId}/${modifiedTurnId}`, err);
      this._stateManager.dispatchServerAction(compareUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Error,
        error: { errorType: "computeFailed", message: err instanceof Error ? err.message : String(err) }
      });
    } finally {
      ref.dispose();
    }
    return compareUri;
  }
  async computeUncommittedChangeset(session) {
    const uncommittedUri = this._stateManager.registerChangeset(buildUncommittedChangesetUri(session));
    if (!this._hasSubscription(session, uncommittedUri)) {
      return uncommittedUri;
    }
    if (!this._hasWorkingDirectory(session)) {
      this._pendingMaterialization.add(session);
      return uncommittedUri;
    }
    const statusBeforeCompute = this._stateManager.getChangesetState(uncommittedUri)?.status;
    if (statusBeforeCompute !== ChangesetStatus.Computing) {
      this._stateManager.dispatchServerAction(uncommittedUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Computing
      });
    }
    try {
      const diffs = await this._computeUncommittedDiffs(session);
      if (diffs === void 0) {
        this._stateManager.dispatchServerAction(uncommittedUri, {
          type: ActionType.ChangesetStatusChanged,
          status: ChangesetStatus.Error,
          error: { errorType: "computeFailed", message: "Failed to compute uncommitted diff from git." }
        });
        return uncommittedUri;
      }
      this._publishChangesetDiffs(session, uncommittedUri, diffs);
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] Failed to compute uncommitted diffs for ${session}`, err);
      this._stateManager.dispatchServerAction(uncommittedUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Error,
        error: { errorType: "computeFailed", message: err instanceof Error ? err.message : String(err) }
      });
    }
    return uncommittedUri;
  }
  async _computeUncommittedDiffs(session) {
    const workingDirectory = this._stateManager.getSessionState(session)?.workingDirectories?.[0];
    if (!workingDirectory) {
      return void 0;
    }
    let workingDirectoryUri;
    try {
      workingDirectoryUri = URI.parse(workingDirectory);
    } catch {
      return void 0;
    }
    return this._gitService.computeSessionFileDiffs(workingDirectoryUri, {
      sessionUri: session
    });
  }
  async _computeTurnDiffsPreferCheckpoint(session, db, turnId) {
    const pair = await this._checkpointService.getTurnCheckpointPair(URI.parse(session), turnId);
    if (pair && pair.parent !== pair.current) {
      const workingDir = await this._resolveWorkingDirectory(session);
      if (workingDir) {
        const fromRefDiffs = await this._gitService.computeFileDiffsBetweenRefs(workingDir, {
          sessionUri: session,
          fromRef: pair.parent,
          toRef: pair.current
        });
        if (fromRefDiffs) {
          return fromRefDiffs;
        }
      }
    } else if (pair && pair.parent === pair.current) {
      return [];
    }
    return computeTurnDiffs(session, db, this._diffComputeService, turnId);
  }
  async _resolveWorkingDirectory(session) {
    const workingDirectories = this._configurationService.getEffectiveWorkingDirectories(session);
    return workingDirectories && workingDirectories.length > 0 ? URI.parse(workingDirectories[0]) : void 0;
  }
  // ---- Lifecycle hooks invoked by AgentSideEffects -----------------------
  onToolCallEditsApplied(session, turnId) {
    this._scheduleDebouncedDiffComputation(session, turnId);
    if (this._hasSubscription(session, buildTurnChangesetUri(session, turnId))) {
      this._scheduleDebouncedTurnDiffComputation(session, turnId);
    }
  }
  onTurnComplete(session, turnId) {
    this._cancelDebouncedDiffComputation(session);
    if (turnId !== void 0) {
      this._cancelDebouncedTurnDiffComputation(session, turnId);
      if (this._hasSubscription(session, buildTurnChangesetUri(session, turnId))) {
        this._scheduleTurnRecompute(session, turnId);
      }
    }
    if (this._hasSubscription(session, buildUncommittedChangesetUri(session))) {
      this._scheduleUncommittedRecompute(session);
    }
    this._scheduleStaticRecompute(session, "branch", turnId);
    this._scheduleStaticRecompute(session, "session", turnId);
  }
  onSessionTruncated(session) {
    this._scheduleStaticRecompute(session, "branch");
    this._scheduleStaticRecompute(session, "session");
  }
  // ---- Internal compute pipeline -----------------------------------------
  /**
   * Schedules a debounced session-changeset recomputation. Uncommitted
   * recomputes ride the same turn-complete path; mid-turn debounce only
   * makes sense for the SDK-tracked session-wide diff (which sees fresh
   * `tool_complete` events between turn boundaries).
   */
  _scheduleDebouncedDiffComputation(session, turnId) {
    this._debouncedDiffTimers.set(session, disposableTimeout(() => {
      this._debouncedDiffTimers.deleteAndDispose(session);
      this._scheduleStaticRecompute(session, "branch", turnId);
      this._scheduleStaticRecompute(session, "session", turnId);
    }, AgentHostChangesetService._DIFF_DEBOUNCE_MS));
  }
  /**
   * Cancels any pending debounced diff computation for a session.
   * Called at turn end before the final (non-debounced) computation.
   */
  _cancelDebouncedDiffComputation(session) {
    this._debouncedDiffTimers.deleteAndDispose(session);
  }
  /**
   * Schedules a debounced per-turn changeset recomputation. Mirrors
   * {@link _scheduleDebouncedDiffComputation} but uses a per-
   * `(session, turnId)` map key so a long-running per-turn compute
   * doesn't block the static session recompute path (and vice versa).
   */
  _scheduleDebouncedTurnDiffComputation(session, turnId) {
    const key = `${session}\0${turnId}`;
    this._perTurnDebouncedDiffTimers.set(key, disposableTimeout(() => {
      this._perTurnDebouncedDiffTimers.deleteAndDispose(key);
      this._scheduleTurnRecompute(session, turnId);
    }, AgentHostChangesetService._DIFF_DEBOUNCE_MS));
  }
  /**
   * Cancels any pending debounced per-turn diff computation for a
   * `(session, turnId)`. Called at turn end before the final
   * (non-debounced) per-turn computation.
   */
  _cancelDebouncedTurnDiffComputation(session, turnId) {
    this._perTurnDebouncedDiffTimers.deleteAndDispose(`${session}\0${turnId}`);
  }
  /**
   * Queues a per-turn recompute on a per-`(session, turnId)` sequencer
   * key so back-to-back recomputes for the same turn serialise, but
   * recomputes for different turns (or for the static `session` /
   * `uncommitted` slots) run independently. Fire-and-forget — failures
   * are logged inside `computeTurnChangeset` and do not fail the turn.
   */
  _scheduleTurnRecompute(session, turnId) {
    this._diffComputationSequencer.queue(`${session}\0turn\0${turnId}`, () => this.computeTurnChangeset(session, turnId).then(() => void 0));
  }
  _scheduleUncommittedRecompute(session) {
    this._diffComputationSequencer.queue(`${session}\0uncommitted`, () => this.computeUncommittedChangeset(session).then(() => void 0));
  }
  /**
   * Schedules a static changeset (`uncommitted` or `session`) recompute,
   * serialised per-session so back-to-back triggers don't race against
   * stale `previousDiffs` reads. Fire-and-forget — failures are logged
   * but do not fail the turn.
   */
  _scheduleStaticRecompute(session, kind, changedTurnId, statusBeforeRefresh) {
    this._diffComputationSequencer.queue(`${session}\0${kind}`, () => this._doComputeStaticChangeset(session, kind, changedTurnId, statusBeforeRefresh));
  }
  _markStaticChangesetComputing(session, kind) {
    const changesetUri = staticChangesetUri(session, kind);
    this._stateManager.registerChangeset(changesetUri);
    const status = this._stateManager.getChangesetState(changesetUri)?.status;
    if (status !== ChangesetStatus.Computing) {
      this._stateManager.dispatchServerAction(changesetUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Computing
      });
    }
    return status;
  }
  async _doComputeStaticChangeset(session, kind, changedTurnId, statusBeforeRefresh) {
    const changesetUri = staticChangesetUri(session, kind);
    this._activeStaticComputes.add(changesetUri);
    const statusBeforeCompute = statusBeforeRefresh ?? this._stateManager.getChangesetState(changesetUri)?.status;
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(URI.parse(session));
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] Failed to open session database for ${kind} diff computation: ${session}`, err);
      this._restoreStaticChangesetStatus(changesetUri, statusBeforeCompute);
      this._activeStaticComputes.delete(changesetUri);
      this._stateManager.onChangesetLivenessChanged();
      return;
    }
    this._stateManager.registerChangeset(changesetUri);
    try {
      let diffs = await this._tryComputeGitDiffs(session, ref.object, kind);
      if (!diffs) {
        if (kind === "branch") {
          this._logService.debug(`[AgentHostChangesetService] Branch git diff unavailable for ${session}; preserving cached changeset. previousStatus=${statusBeforeCompute ?? "unknown"} cachedFiles=${this._stateManager.getChangesetState(changesetUri)?.files.length ?? 0}`);
          this._restoreStaticChangesetStatus(changesetUri, statusBeforeCompute);
          return;
        }
        const peerSources = this._openPeerChatSources(session);
        try {
          if (peerSources.length > 0) {
            const sources = [
              { sessionUri: session, db: ref.object },
              ...peerSources.map((p) => ({ sessionUri: p.sessionUri, db: p.ref.object }))
            ];
            diffs = await computeUnionedDiffs(sources, this._diffComputeService);
          } else {
            let incremental;
            if (changedTurnId) {
              const previousDiffs = this._readPreviousChangesetDiffs(changesetUri);
              if (previousDiffs) {
                incremental = { changedTurnId, previousDiffs: [...previousDiffs] };
              }
            }
            diffs = await computeSessionDiffs(session, ref.object, this._diffComputeService, incremental);
          }
        } finally {
          for (const peer of peerSources) {
            peer.ref.dispose();
          }
        }
      }
      const reviewed = kind === ChangesetKind.Branch ? await this._computeReviewedInfo(session, ref.object) : void 0;
      this._publishChangesetDiffs(session, changesetUri, diffs, reviewed);
      this._persistSessionFlag(session, persistKeyFor(kind), JSON.stringify(diffs));
      if (kind === ChangesetKind.Branch) {
        this._persistSessionFlag(session, META_LEGACY_DIFFS, JSON.stringify(diffs));
        const changesSummary = summariseDiffs(diffs) ?? { additions: 0, deletions: 0, files: 0 };
        this.persistChangesSummary(session, changesSummary);
        this._stateManager.setSessionSummaryChanges(session, changesSummary);
      }
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] Failed to compute ${kind} diffs`, err);
      this._stateManager.dispatchServerAction(changesetUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Error,
        error: { errorType: "computeFailed", message: err instanceof Error ? err.message : String(err) }
      });
    } finally {
      this._activeStaticComputes.delete(changesetUri);
      this._stateManager.onChangesetLivenessChanged();
      ref.dispose();
    }
  }
  /**
   * Refresh requests optimistically mark static changesets as Computing
   * while preserving their current files. Some refresh paths intentionally
   * do not publish a replacement file list (for example, uncommitted git
   * diff is temporarily unavailable), so restore the previous non-computing
   * status instead of leaving a stale cached snapshot stuck as Computing.
   */
  _restoreStaticChangesetStatus(changesetUri, status) {
    if (!status || status === ChangesetStatus.Computing) {
      return;
    }
    this._stateManager.dispatchServerAction(changesetUri, {
      type: ActionType.ChangesetStatusChanged,
      status
    });
  }
  /**
   * Reads the previous diff list back out of the changeset state so the
   * incremental aggregator can avoid recomputing files that haven't
   * changed.
   */
  _readPreviousChangesetDiffs(changesetUri) {
    const state = this._stateManager.getChangesetState(changesetUri);
    if (!state || state.files.length === 0) {
      return void 0;
    }
    return state.files.map((f) => f.edit);
  }
  /**
   * Translates the new file list into a sequence of changeset/* actions
   * (fileSet, fileRemoved) and moves the changeset to `ready` once the
   * fresh file list has been applied.
   */
  _publishChangesetDiffs(session, changesetUri, diffs, reviewed) {
    const operations = this._changesetOperationService.getOperations(session, changesetUri);
    const files = [];
    for (const edit of diffs) {
      const id = edit.after?.uri ?? edit.before?.uri;
      if (!id) {
        continue;
      }
      if (reviewed) {
        const relPath = relativePath(reviewed.repoRoot, URI.parse(id));
        files.push({
          id,
          edit,
          reviewed: relPath ? reviewed.paths.has(relPath) : false
        });
      } else {
        files.push({ id, edit });
      }
    }
    this._stateManager.dispatchServerAction(changesetUri, {
      type: ActionType.ChangesetContentChanged,
      files,
      operations: operations ? [...operations] : void 0
    });
    const status = this._stateManager.getChangesetState(changesetUri)?.status;
    if (status !== ChangesetStatus.Ready) {
      this._stateManager.dispatchServerAction(changesetUri, {
        type: ActionType.ChangesetStatusChanged,
        status: ChangesetStatus.Ready
      });
    }
  }
  /**
   * Opens the databases for every non-default (peer) chat in a multi-chat
   * session. Each peer chat records its file edits into its own database
   * keyed by the chat URI, so the session changeset must union those
   * databases with the session DB. Returns an empty array for single-chat
   * sessions. Callers MUST dispose every returned `ref`.
   */
  _openPeerChatSources(session) {
    const chats = this._stateManager.getSessionState(session)?.chats ?? [];
    const sources = [];
    for (const chat of chats) {
      if (isDefaultChatUri(chat.resource)) {
        continue;
      }
      try {
        const ref = this._sessionDataService.openDatabase(URI.parse(chat.resource));
        sources.push({ sessionUri: chat.resource, ref });
      } catch (err) {
        this._logService.warn(`[AgentHostChangesetService] Failed to open peer chat database for session changes: ${chat.resource}`, err);
      }
    }
    return sources;
  }
  /**
   * Returns the turn id whose checkpoint best represents the latest state of
   * the session's shared working tree. For single-chat sessions this is the
   * default chat's last turn. For multi-chat sessions it is the last turn of
   * the most-recently-modified chat (peer-chat turn checkpoints are stored
   * under the session URI keyed by their turn id). Returns `undefined` when
   * no chat has any turns.
   */
  _latestTurnIdAcrossChats(session) {
    const sessionState = this._stateManager.getSessionState(session);
    if (!sessionState) {
      return void 0;
    }
    const chats = sessionState.chats ?? [];
    if (chats.length <= 1) {
      return sessionState.turns.at(-1)?.id;
    }
    let bestTurnId;
    let bestModifiedAt = "";
    for (const chat of chats) {
      const turns = isDefaultChatUri(chat.resource) ? sessionState.turns : this._stateManager.getChatState(chat.resource)?.turns;
      const lastTurnId = turns?.at(-1)?.id;
      if (lastTurnId && chat.modifiedAt >= bestModifiedAt) {
        bestModifiedAt = chat.modifiedAt;
        bestTurnId = lastTurnId;
      }
    }
    return bestTurnId;
  }
  /**
   * Computes diffs for a static changeset by shelling out to git.
   * Returns the diff list when the session has a working directory and
   * that directory is a git work tree; returns `undefined` otherwise so
   * the caller can fall back to the edit-tracker aggregator (for
   * `kind: 'session'`) or preserve cached state (for `kind: 'branch'`).
   *
   * For `kind: 'session'` the diff is computed between the baseline
   * checkpoint ref and the latest turn checkpoint ref.
   * For `kind: 'branch'` the diff is computed against the merge-base
   * with {@link META_DIFF_BASE_BRANCH} when one is set; without a base
   * branch git falls back to `HEAD`.
   */
  async _tryComputeGitDiffs(session, db, kind) {
    const workingDirectory = this._stateManager.getSessionState(session)?.workingDirectories?.[0];
    if (!workingDirectory) {
      return void 0;
    }
    let workingDirectoryUri;
    try {
      workingDirectoryUri = URI.parse(workingDirectory);
    } catch {
      return void 0;
    }
    if (kind === "session") {
      const latestTurnId = this._latestTurnIdAcrossChats(session);
      if (!latestTurnId) {
        return void 0;
      }
      const sessionUri = URI.parse(session);
      const [baseline, pair] = await Promise.all([
        this._checkpointService.getBaselineCheckpoint(sessionUri),
        this._checkpointService.getTurnCheckpointPair(sessionUri, latestTurnId)
      ]);
      if (!baseline || !pair) {
        return void 0;
      }
      try {
        return await this._gitService.computeFileDiffsBetweenRefs(workingDirectoryUri, {
          sessionUri: session,
          fromRef: baseline,
          toRef: pair.current
        });
      } catch (err) {
        this._logService.warn(`[AgentHostChangesetService] git-driven ${kind} diff computation failed; falling back to edit-tracker`, err);
        return void 0;
      }
    }
    const baseBranch = await this._resolveBranchBaseBranch(session, db);
    try {
      return await this._gitService.computeSessionFileDiffs(workingDirectoryUri, {
        sessionUri: session,
        baseBranch
      });
    } catch (err) {
      this._logService.warn(`[AgentHostChangesetService] git-driven ${kind} diff computation failed; falling back to edit-tracker`, err);
      return void 0;
    }
  }
  /**
   * Resolves the Branch Changes base branch, reused by the diff computation
   * and the review-status lookup so both are keyed on the same baseline.
   */
  async _resolveBranchBaseBranch(session, db) {
    const persistedBaseBranch = await db.getMetadata(META_DIFF_BASE_BRANCH);
    const gitStateBaseBranch = readSessionGitState(this._stateManager.getSessionState(session)?._meta)?.baseBranchName;
    if (!persistedBaseBranch && gitStateBaseBranch) {
      this._logService.debug(`[AgentHostChangesetService] Using _meta.git base branch fallback for Branch Changes in ${session}: ${gitStateBaseBranch}`);
    }
    return resolveDiffBaseBranchName(persistedBaseBranch, gitStateBaseBranch);
  }
  /**
   * Computes the reviewed-paths overlay for the Branch changeset: the
   * repository root (used to key file ids to repo-relative paths) and the set
   * of reviewed repo-relative paths. Returns `undefined` when the session has
   * no git working directory (review status is then simply omitted).
   */
  async _computeReviewedInfo(session, db) {
    const workingDirectory = this._stateManager.getSessionState(session)?.workingDirectories?.[0];
    if (!workingDirectory) {
      return void 0;
    }
    let workingDirectoryUri;
    try {
      workingDirectoryUri = URI.parse(workingDirectory);
    } catch {
      return void 0;
    }
    const repoRoot = await this._gitService.getRepositoryRoot(workingDirectoryUri);
    if (!repoRoot) {
      return void 0;
    }
    const baseBranch = await this._resolveBranchBaseBranch(session, db);
    const paths = await this._reviewService.getReviewedPaths(session, workingDirectoryUri, baseBranch);
    return { repoRoot, paths };
  }
  /**
   * Persists a session metadata key/value pair to the session database.
   * Counterpart in `agentSideEffects.ts` (`AgentSideEffects._persistSessionFlag`):
   * keep both copies in sync if the signature changes. Duplicated rather
   * than lifted because the two consumers persist disjoint metadata
   * (changeset diffs here vs. customTitle / isRead / isArchived /
   * configValues there) and a shared util would only have two callers.
   */
  _persistSessionFlag(session, key, value) {
    const ref = this._sessionDataService.openDatabase(URI.parse(session));
    ref.object.setMetadata(key, value).catch((err) => {
      this._logService.warn(`[AgentHostChangesetService] Failed to persist ${key}`, err);
    }).finally(() => {
      ref.dispose();
    });
  }
};
AgentHostChangesetService = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, ILogService),
  __decorateParam(2, ISessionDataService),
  __decorateParam(3, IAgentHostGitService),
  __decorateParam(4, IAgentHostCheckpointService),
  __decorateParam(5, IAgentConfigurationService),
  __decorateParam(6, IAgentHostChangesetOperationService),
  __decorateParam(7, IAgentHostChangesetSubscriptionService),
  __decorateParam(8, IAgentHostReviewService)
], AgentHostChangesetService);
export {
  AgentHostChangesetService
};
