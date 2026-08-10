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
import { Disposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { buildBranchChangesetUri, ChangesetKind, parseChangesetUri } from "../common/changesetUri.js";
import { ChangesetFileMonitorCoordinator } from "./agentHostChangesetFileMonitorCoordinator.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { IAgentHostChangesetService, META_CHANGESET_BRANCH, META_CHANGESET_SESSION, META_LEGACY_DIFFS } from "../common/agentHostChangesetService.js";
import { IAgentHostChangesetSubscriptionService } from "../common/agentHostChangesetSubscriptionService.js";
import { IAgentHostChangesetOperationService } from "../common/agentHostChangesetOperationService.js";
import { IAgentHostGitStateService } from "../common/agentHostGitStateService.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { isAhpChatChannel } from "../common/state/sessionState.js";
let AgentHostChangesetCoordinator = class extends Disposable {
  constructor(_stateManager, _changesetOperationService, _changesets, _changesetSubscriptions, gitStateService, instantiationService) {
    super();
    this._stateManager = _stateManager;
    this._changesetOperationService = _changesetOperationService;
    this._changesets = _changesets;
    this._changesetSubscriptions = _changesetSubscriptions;
    this._changesetFileMonitor = this._register(instantiationService.createInstance(ChangesetFileMonitorCoordinator));
    this._register(gitStateService.onDidRefreshSessionGitState((sessionStr) => this.onDidRunSessionGitStateRefresh(sessionStr)));
  }
  // ---- Lifecycle hooks ----------------------------------------------------
  /**
   * Seeds the create-time catalogue and registers its backing changeset state
   * before `SessionReady` is dispatched.
   */
  onSessionCreated(sessionStr) {
    this._changesets.refreshChangesetCatalog(sessionStr);
    this._changesets.registerStaticChangesets(sessionStr);
  }
  /**
   * Called at session restore time. Registers the static changeset URIs
   * and reseeds them from any persisted blobs already read from the DB.
   * `metadata` must come from the same batched `getMetadataObject` call
   * `AgentService` already issues for title / read / archive / config
   * keys.
   */
  onSessionRestored(sessionStr, metadata) {
    this._changesets.refreshChangesetCatalog(sessionStr);
    this._changesets.registerStaticChangesets(sessionStr);
    this._changesets.restorePersistedStaticChangesets(sessionStr, {
      branchRaw: metadata[META_CHANGESET_BRANCH],
      sessionRaw: metadata[META_CHANGESET_SESSION],
      legacyRaw: metadata[META_LEGACY_DIFFS]
    });
    this._changesets.onWorkingDirectoryAvailable(sessionStr);
    this._changesetFileMonitor.onSessionRestored(sessionStr);
  }
  /**
   * Called when a provisional session is materialized (working directory
   * becomes known). Drains any static changeset refresh that was deferred
   * because the working directory was not yet known.
   */
  onSessionMaterialized(sessionStr) {
    this._changesets.refreshChangesetCatalog(sessionStr);
    this._changesets.onWorkingDirectoryAvailable(sessionStr);
    this._changesetFileMonitor.onSessionMaterialized(sessionStr);
  }
  /**
   * Called when a session is disposed. Forgets any pending refresh
   * queued for that session.
   */
  onSessionDisposed(sessionStr) {
    this._changesets.onSessionDisposed(sessionStr);
    this._changesetFileMonitor.onSessionDisposed(sessionStr);
    this._changesetSubscriptions.clearSessionSubscriptions(sessionStr);
  }
  onSessionTurnActiveChanged(sessionStr, active) {
    this._changesetFileMonitor.onSessionTurnActiveChanged(sessionStr, active);
    this._changesetOperationService.updateOperations(sessionStr);
  }
  // ---- Subscription hooks -------------------------------------------------
  /**
   * Called on every `addSubscriber` 0→1 transition. When `resource` is a
   * static changeset URI, triggers the first git-diff refresh (the
   * changeset service self-defers it when the working directory is not yet
   * known).
   *
   * Both {@link AgentService.subscribe} and the handshake fast-path
   * (`ProtocolServerHandler.initialSubscriptions`) call into
   * `addSubscriber`, so this single hook covers both paths.
   */
  onFirstSubscriber(resource) {
    const resourceStr = resource.toString();
    const parsed = parseChangesetUri(resourceStr);
    if (!parsed && !isAhpChatChannel(resourceStr) && this._stateManager.getSessionState(resourceStr)) {
      this._addSubscription(resourceStr, buildBranchChangesetUri(resourceStr));
      this._changesets.refreshBranchChangeset(resourceStr);
      this._changesetFileMonitor.trackSessionChanges(resourceStr, resourceStr);
      return;
    }
    if (parsed?.kind === ChangesetKind.Branch) {
      this._addSubscription(parsed.sessionUri, resourceStr);
      this._changesets.refreshBranchChangeset(parsed.sessionUri);
      this._changesetFileMonitor.trackSessionChanges(resourceStr, parsed.sessionUri);
      return;
    }
    if (parsed?.kind === ChangesetKind.Uncommitted) {
      this._addSubscription(parsed.sessionUri, resourceStr);
      void this._changesets.computeUncommittedChangeset(parsed.sessionUri);
      this._changesetFileMonitor.trackSessionChanges(resourceStr, parsed.sessionUri);
      return;
    }
    if (parsed?.kind === ChangesetKind.Session) {
      this._addSubscription(parsed.sessionUri, resourceStr);
      this._changesets.refreshSessionChangeset(parsed.sessionUri);
      this._changesetFileMonitor.trackSessionChanges(resourceStr, parsed.sessionUri);
      return;
    }
    if (parsed?.kind === ChangesetKind.Turn && parsed.turnId !== void 0) {
      this._addSubscription(parsed.sessionUri, resourceStr);
      return;
    }
  }
  /**
   * Called when a resource's last subscriber drops. Removes the
   * changeset from the session's subscription set so a later
   * materialization / git-state recompute (driven by
   * {@link IAgentHostChangesetService.recomputeSubscribedChangesets})
   * naturally skips it — no explicit cancellation needed.
   */
  onLastSubscriber(resource) {
    const resourceStr = resource.toString();
    const parsed = parseChangesetUri(resourceStr);
    if (parsed?.kind === ChangesetKind.Branch) {
      this._removeSubscription(parsed.sessionUri, resourceStr);
      this._changesetFileMonitor.untrackSessionChanges(resourceStr);
      return;
    }
    if (parsed?.kind === ChangesetKind.Uncommitted) {
      this._removeSubscription(parsed.sessionUri, resourceStr);
      this._changesetFileMonitor.untrackSessionChanges(resourceStr);
      return;
    }
    if (parsed?.kind === ChangesetKind.Session) {
      this._removeSubscription(parsed.sessionUri, resourceStr);
      this._changesetFileMonitor.untrackSessionChanges(resourceStr);
      return;
    }
    if (parsed?.kind === ChangesetKind.Turn && parsed.turnId !== void 0) {
      this._removeSubscription(parsed.sessionUri, resourceStr);
      return;
    }
    if (!parsed) {
      this._removeSubscription(resourceStr, resourceStr);
      this._changesetFileMonitor.untrackSessionChanges(resourceStr);
    }
  }
  /**
   * Restores the parent session when `resource` is a changeset URI and the
   * parent session is not already live. Non-changeset URIs are ignored.
   *
   * This is intentionally narrower than {@link tryHandleSubscribe}: it does
   * not compute per-turn / compare changesets and does not register static
   * changesets. It exists for the AgentService subscribe path where
   * `addSubscriber` may have already created a placeholder changeset snapshot
   * before the parent session restore had a chance to apply persisted diffs.
   */
  async restoreSessionIfChangesetSubscription(resource, restoreSession) {
    const resourceStr = resource.toString();
    const parsed = parseChangesetUri(resourceStr);
    if (!parsed) {
      return;
    }
    if (parsed.kind === ChangesetKind.Unknown) {
      throw new Error(`Cannot subscribe to unknown changeset resource: ${resourceStr}`);
    }
    if (!this._stateManager.getSessionState(parsed.sessionUri)) {
      await restoreSession(URI.parse(parsed.sessionUri));
    }
  }
  /**
   * If `resource` is a known changeset URI (uncommitted / session /
   * turn), seeds its state on the state manager and returns `true`.
   * Returns `false` for non-changeset URIs so callers fall through to
   * their default routing (session / subagent / terminal).
   *
   * The parent session is restored via the provided `restoreSession`
   * callback when no live state exists yet — this matches the previous
   * inline behaviour in `AgentService.subscribe`.
   *
   * Throws when the URI matches the changeset shape but the id is not
   * a well-known kind ({@link ChangesetKind.Unknown}). The unknown-id
   * rejection MUST fire before any parent-session restore so subscribing
   * to a bogus child URI cannot materialize the parent as a side effect.
   */
  async tryHandleSubscribe(resource, restoreSession) {
    const resourceStr = resource.toString();
    const parsed = parseChangesetUri(resourceStr);
    if (!parsed) {
      return false;
    }
    if (parsed.kind === ChangesetKind.Unknown) {
      throw new Error(`Cannot subscribe to unknown changeset resource: ${resourceStr}`);
    }
    await this.restoreSessionIfChangesetSubscription(resource, restoreSession);
    if (parsed.kind === ChangesetKind.Turn && parsed.turnId) {
      await this._changesets.computeTurnChangeset(parsed.sessionUri, parsed.turnId);
    } else if (parsed.kind === ChangesetKind.Compare && parsed.originalTurnId && parsed.modifiedTurnId) {
      await this._changesets.computeCompareTurnsChangeset(parsed.sessionUri, parsed.originalTurnId, parsed.modifiedTurnId);
    } else {
      this._changesets.registerStaticChangesets(parsed.sessionUri);
    }
    return true;
  }
  _addSubscription(sessionStr, changesetStr) {
    this._changesetSubscriptions.addSubscription(sessionStr, changesetStr);
  }
  _removeSubscription(sessionStr, changesetStr) {
    this._changesetSubscriptions.removeSubscription(sessionStr, changesetStr);
  }
  // ---- listSessions overlay ----------------------------------------------
  /**
   * Returns the session-DB metadata keys to merge into a batched read
   * for `sessionStr`, OR `undefined` when live state already answers
   * the aggregate-counts question. Delegates to the changeset service,
   * which owns the live-vs-persisted decision.
   */
  getListMetadataKeys(sessionStr) {
    return this._changesets.getListMetadataKeys(sessionStr);
  }
  /**
   * Decorates a single listSessions entry with the `changes` aggregate
   * (additions / deletions / files for the session-wide changeset). The
   * aggregate computation lives in the changeset service; the coordinator
   * only projects the result onto the entry.
   */
  decorateListEntry(entry, metadata) {
    const changes = this._changesets.computeListEntryChanges(entry.session.toString(), metadata);
    return changes ? { ...entry, changes } : entry;
  }
  // ---- Git state  events -------------------------------------------------
  /**
   * Called when a session's Git state is refreshed.
   */
  onDidRunSessionGitStateRefresh(sessionStr) {
    this._changesets.refreshChangesetCatalog(sessionStr);
    this._changesets.recomputeSubscribedChangesets(sessionStr);
  }
};
AgentHostChangesetCoordinator = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IAgentHostChangesetOperationService),
  __decorateParam(2, IAgentHostChangesetService),
  __decorateParam(3, IAgentHostChangesetSubscriptionService),
  __decorateParam(4, IAgentHostGitStateService),
  __decorateParam(5, IInstantiationService)
], AgentHostChangesetCoordinator);
export {
  AgentHostChangesetCoordinator
};
