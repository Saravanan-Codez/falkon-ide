import { assertNever } from "../../../../base/common/assert.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { observableFromEvent } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { ActionType, isChangesetAction, isChatAction, isAnnotationsAction, isSessionAction } from "./sessionActions.js";
import { changesetReducer, chatReducer, annotationsReducer, rootReducer, sessionReducer } from "./sessionReducers.js";
import { terminalReducer } from "./protocol/reducers.js";
import { isAhpRootChannel, StateComponents } from "./sessionState.js";
class BaseAgentSubscription extends Disposable {
  constructor(clientId, log) {
    super();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidError = this._register(new Emitter());
    this.onDidError = this._onDidError.event;
    this._onWillApplyAction = this._register(new Emitter());
    this.onWillApplyAction = this._onWillApplyAction.event;
    this._onDidApplyAction = this._register(new Emitter());
    this.onDidApplyAction = this._onDidApplyAction.event;
    this._clientId = clientId;
    this._log = log;
  }
  get value() {
    if (this._error) {
      return this._error;
    }
    return this._getOptimisticState() ?? this._confirmedState;
  }
  get verifiedValue() {
    return this._confirmedState;
  }
  /**
   * Apply an initial snapshot from the server.
   */
  handleSnapshot(state, fromSeq) {
    this._confirmedState = state;
    this._error = void 0;
    this._onSnapshotApplied(fromSeq);
    this._onDidChange.fire(this.value);
  }
  /**
   * Mark this subscription as failed.
   */
  setError(error) {
    this._error = error;
    this._onDidError.fire(error);
  }
  /**
   * Process an incoming action envelope. The subscription determines
   * whether the action is relevant via {@link _isRelevantEnvelope}.
   */
  receiveEnvelope(envelope) {
    if (!this._isRelevantEnvelope(envelope)) {
      return;
    }
    if (this._confirmedState === void 0) {
      if (!this._bufferedEnvelopes) {
        this._bufferedEnvelopes = [];
      }
      this._bufferedEnvelopes.push(envelope);
      return;
    }
    const isOwnAction = envelope.origin?.clientId === this._clientId;
    this._onWillApplyAction.fire(envelope);
    this._reconcile(envelope, isOwnAction);
    this._onDidApplyAction.fire(envelope);
  }
  /** Return optimistic state if write-ahead is active, otherwise `undefined`. */
  _getOptimisticState() {
    return void 0;
  }
  /** Hook called after a snapshot is applied. Replays buffered actions. */
  _onSnapshotApplied(_fromSeq) {
    const buffered = this._bufferedEnvelopes;
    if (buffered) {
      this._bufferedEnvelopes = void 0;
      for (const envelope of buffered) {
        if (envelope.serverSeq > _fromSeq) {
          const isOwnAction = envelope.origin?.clientId === this._clientId;
          this._reconcile(envelope, isOwnAction);
        }
      }
    }
  }
  /**
   * Default reconciliation: apply to confirmed, fire change event.
   * Session subscriptions override this for write-ahead.
   */
  _reconcile(envelope, _isOwnAction) {
    this._confirmedState = this._applyReducer(this._confirmedState, envelope.action);
    this._onDidChange.fire(this.value);
  }
}
class RootStateSubscription extends BaseAgentSubscription {
  _applyReducer(state, action) {
    return rootReducer(state, action, this._log);
  }
  _isRelevantEnvelope(envelope) {
    return isAhpRootChannel(envelope.channel) && envelope.action.type.startsWith("root/");
  }
}
class SessionStateSubscription extends BaseAgentSubscription {
  constructor(sessionUri, clientId, seqAllocator, log) {
    super(clientId, log);
    this._pendingActions = [];
    this._sessionUri = sessionUri;
    this._seqAllocator = seqAllocator;
  }
  /**
   * Optimistically apply a session action. Returns the clientSeq to send
   * to the server so it can echo back for reconciliation.
   */
  applyOptimistic(action) {
    const clientSeq = this._seqAllocator();
    this._pendingActions.push({ clientSeq, action });
    const base = this._optimisticState ?? this.verifiedValue;
    if (base) {
      this._optimisticState = sessionReducer(base, action, this._log);
      this._onDidChange.fire(this._optimisticState);
    }
    return clientSeq;
  }
  _getOptimisticState() {
    return this._optimisticState;
  }
  _applyReducer(state, action) {
    return sessionReducer(state, action, this._log);
  }
  _isRelevantEnvelope(envelope) {
    return isSessionAction(envelope.action) && envelope.channel === this._sessionUri;
  }
  _onSnapshotApplied(fromSeq) {
    super._onSnapshotApplied(fromSeq);
    this._recomputeOptimistic();
  }
  _reconcile(envelope, isOwnAction) {
    if (isOwnAction && envelope.origin) {
      const idx = this._pendingActions.findIndex((p) => p.clientSeq === envelope.origin.clientSeq);
      if (idx !== -1) {
        if (!envelope.rejectionReason) {
          this._confirmedApply(envelope.action);
        }
        this._pendingActions.splice(idx, 1);
      } else if (!envelope.rejectionReason) {
        this._confirmedApply(envelope.action);
      }
    } else if (!envelope.rejectionReason) {
      this._confirmedApply(envelope.action);
    }
    this._recomputeOptimistic();
  }
  _confirmedApply(action) {
    if (this._confirmedState) {
      this._confirmedState = this._applyReducer(this._confirmedState, action);
    }
  }
  _recomputeOptimistic() {
    const confirmed = this._confirmedState;
    if (!confirmed) {
      this._optimisticState = void 0;
      return;
    }
    if (this._pendingActions.length === 0) {
      this._optimisticState = void 0;
      this._onDidChange.fire(confirmed);
      return;
    }
    let state = confirmed;
    for (const pending of this._pendingActions) {
      state = sessionReducer(state, pending.action, this._log);
    }
    this._optimisticState = state;
    this._onDidChange.fire(state);
  }
  /**
   * Clear pending actions for this session (e.g., on unsubscribe).
   */
  clearPending() {
    this._pendingActions.length = 0;
    this._optimisticState = void 0;
  }
  /**
   * Snapshot of the currently-pending optimistic actions, with the session
   * URI included so callers can re-issue them across a reconnect. The
   * actions remain in the subscription so the optimistic state continues
   * to reflect them — the client must explicitly drop entries echoed back
   * by the server.
   */
  getPendingActions() {
    return this._pendingActions.map((p) => ({ clientSeq: p.clientSeq, action: p.action, channel: this._sessionUri }));
  }
  /**
   * Drop the pending entry whose `clientSeq` matches the supplied value.
   * Used during reconnect to evict actions the server already echoed back
   * in the replay buffer so they're not resent.
   */
  dropPendingByClientSeq(clientSeq) {
    const idx = this._pendingActions.findIndex((p) => p.clientSeq === clientSeq);
    if (idx === -1) {
      return false;
    }
    this._pendingActions.splice(idx, 1);
    return true;
  }
}
class ChatStateSubscription extends BaseAgentSubscription {
  constructor(chatUri, clientId, seqAllocator, log) {
    super(clientId, log);
    this._pendingActions = [];
    this._chatUri = chatUri;
    this._seqAllocator = seqAllocator;
  }
  /**
   * Optimistically apply a chat action. Returns the clientSeq to send to
   * the server so it can echo back for reconciliation.
   */
  applyOptimistic(action) {
    const clientSeq = this._seqAllocator();
    this._pendingActions.push({ clientSeq, action });
    const base = this._optimisticState ?? this.verifiedValue;
    if (base) {
      this._optimisticState = chatReducer(base, action, this._log);
      this._onDidChange.fire(this._optimisticState);
    }
    return clientSeq;
  }
  _getOptimisticState() {
    return this._optimisticState;
  }
  _applyReducer(state, action) {
    return chatReducer(state, action, this._log);
  }
  _isRelevantEnvelope(envelope) {
    return isChatAction(envelope.action) && envelope.channel === this._chatUri;
  }
  _onSnapshotApplied(fromSeq) {
    super._onSnapshotApplied(fromSeq);
    this._recomputeOptimistic();
  }
  _reconcile(envelope, isOwnAction) {
    if (isOwnAction && envelope.origin) {
      const idx = this._pendingActions.findIndex((p) => p.clientSeq === envelope.origin.clientSeq);
      if (idx !== -1) {
        if (!envelope.rejectionReason) {
          this._confirmedApply(envelope.action);
        }
        this._pendingActions.splice(idx, 1);
      } else if (!envelope.rejectionReason) {
        this._confirmedApply(envelope.action);
      }
    } else if (!envelope.rejectionReason) {
      this._promotePendingTurnStartIfTerminal(envelope.action);
      this._confirmedApply(envelope.action);
    }
    this._recomputeOptimistic();
  }
  _promotePendingTurnStartIfTerminal(action) {
    if (!isChatAction(action)) {
      return;
    }
    if (action.type !== ActionType.ChatTurnComplete && action.type !== ActionType.ChatTurnCancelled && action.type !== ActionType.ChatError) {
      return;
    }
    const index = this._pendingActions.findIndex((p) => p.action.type === ActionType.ChatTurnStarted && p.action.turnId === action.turnId);
    if (index === -1) {
      return;
    }
    const [{ action: pendingAction }] = this._pendingActions.splice(index, 1);
    if (this._confirmedState && (!this._confirmedState.activeTurn || this._confirmedState.activeTurn.id !== action.turnId)) {
      this._confirmedState = this._applyReducer(this._confirmedState, pendingAction);
    }
  }
  _confirmedApply(action) {
    if (this._confirmedState) {
      this._confirmedState = this._applyReducer(this._confirmedState, action);
    }
  }
  _recomputeOptimistic() {
    const confirmed = this._confirmedState;
    if (!confirmed) {
      this._optimisticState = void 0;
      return;
    }
    if (this._pendingActions.length === 0) {
      this._optimisticState = void 0;
      this._onDidChange.fire(confirmed);
      return;
    }
    let state = confirmed;
    for (const pending of this._pendingActions) {
      state = chatReducer(state, pending.action, this._log);
    }
    this._optimisticState = state;
    this._onDidChange.fire(state);
  }
  clearPending() {
    this._pendingActions.length = 0;
    this._optimisticState = void 0;
  }
  getPendingActions() {
    return this._pendingActions.map((p) => ({ clientSeq: p.clientSeq, action: p.action, channel: this._chatUri }));
  }
  dropPendingByClientSeq(clientSeq) {
    const idx = this._pendingActions.findIndex((p) => p.clientSeq === clientSeq);
    if (idx === -1) {
      return false;
    }
    this._pendingActions.splice(idx, 1);
    return true;
  }
}
class TerminalStateSubscription extends BaseAgentSubscription {
  constructor(terminalUri, clientId, log) {
    super(clientId, log);
    this._terminalUri = terminalUri;
  }
  _applyReducer(state, action) {
    return terminalReducer(state, action, this._log);
  }
  _isRelevantEnvelope(envelope) {
    return envelope.action.type.startsWith("terminal/") && envelope.channel === this._terminalUri;
  }
}
class ChangesetStateSubscription extends BaseAgentSubscription {
  constructor(changesetUri, clientId, seqAllocator, log) {
    super(clientId, log);
    this._pendingActions = [];
    this._changesetUri = changesetUri;
    this._seqAllocator = seqAllocator;
  }
  /**
   * Optimistically apply a changeset action and return its client sequence.
   */
  applyOptimistic(action) {
    const clientSeq = this._seqAllocator();
    this._pendingActions.push({ clientSeq, action });
    const base = this._optimisticState ?? this.verifiedValue;
    if (base) {
      this._optimisticState = changesetReducer(base, action, this._log);
      this._onDidChange.fire(this._optimisticState);
    }
    return clientSeq;
  }
  _getOptimisticState() {
    return this._optimisticState;
  }
  _applyReducer(state, action) {
    return changesetReducer(state, action, this._log);
  }
  _isRelevantEnvelope(envelope) {
    return isChangesetAction(envelope.action) && envelope.channel === this._changesetUri;
  }
  _onSnapshotApplied(fromSeq) {
    super._onSnapshotApplied(fromSeq);
    this._recomputeOptimistic();
  }
  _reconcile(envelope, isOwnAction) {
    if (isOwnAction && envelope.origin) {
      const index = this._pendingActions.findIndex((pending) => pending.clientSeq === envelope.origin.clientSeq);
      if (index !== -1) {
        if (!envelope.rejectionReason) {
          this._confirmedApply(envelope.action);
        }
        this._pendingActions.splice(index, 1);
      } else {
        this._confirmedApply(envelope.action);
      }
    } else {
      this._confirmedApply(envelope.action);
    }
    this._recomputeOptimistic();
  }
  _confirmedApply(action) {
    if (this._confirmedState) {
      this._confirmedState = this._applyReducer(this._confirmedState, action);
    }
  }
  _recomputeOptimistic() {
    const confirmed = this._confirmedState;
    if (!confirmed) {
      this._optimisticState = void 0;
      return;
    }
    if (this._pendingActions.length === 0) {
      this._optimisticState = void 0;
      this._onDidChange.fire(confirmed);
      return;
    }
    let state = confirmed;
    for (const pending of this._pendingActions) {
      state = changesetReducer(state, pending.action, this._log);
    }
    this._optimisticState = state;
    this._onDidChange.fire(state);
  }
}
class AnnotationsStateSubscription extends BaseAgentSubscription {
  constructor(annotationsUri, clientId, seqAllocator, log) {
    super(clientId, log);
    this._pendingActions = [];
    this._annotationsUri = annotationsUri;
    this._seqAllocator = seqAllocator;
  }
  /**
   * Optimistically apply an annotations action. Returns the clientSeq to
   * send to the server so it can echo back for reconciliation.
   */
  applyOptimistic(action) {
    const clientSeq = this._seqAllocator();
    this._pendingActions.push({ clientSeq, action });
    const base = this._optimisticState ?? this.verifiedValue;
    if (base) {
      this._optimisticState = annotationsReducer(base, action, this._log);
      this._onDidChange.fire(this._optimisticState);
    }
    return clientSeq;
  }
  _getOptimisticState() {
    return this._optimisticState;
  }
  _applyReducer(state, action) {
    return annotationsReducer(state, action, this._log);
  }
  _isRelevantEnvelope(envelope) {
    return isAnnotationsAction(envelope.action) && envelope.channel === this._annotationsUri;
  }
  _onSnapshotApplied(fromSeq) {
    super._onSnapshotApplied(fromSeq);
    this._recomputeOptimistic();
  }
  _reconcile(envelope, isOwnAction) {
    if (isOwnAction && envelope.origin) {
      const idx = this._pendingActions.findIndex((p) => p.clientSeq === envelope.origin.clientSeq);
      if (idx !== -1) {
        if (!envelope.rejectionReason) {
          this._confirmedApply(envelope.action);
        }
        this._pendingActions.splice(idx, 1);
      } else {
        this._confirmedApply(envelope.action);
      }
    } else {
      this._confirmedApply(envelope.action);
    }
    this._recomputeOptimistic();
  }
  _confirmedApply(action) {
    if (this._confirmedState) {
      this._confirmedState = this._applyReducer(this._confirmedState, action);
    }
  }
  _recomputeOptimistic() {
    const confirmed = this._confirmedState;
    if (!confirmed) {
      this._optimisticState = void 0;
      return;
    }
    if (this._pendingActions.length === 0) {
      this._optimisticState = void 0;
      this._onDidChange.fire(confirmed);
      return;
    }
    let state = confirmed;
    for (const pending of this._pendingActions) {
      state = annotationsReducer(state, pending.action, this._log);
    }
    this._optimisticState = state;
    this._onDidChange.fire(state);
  }
}
class AgentSubscriptionManager extends Disposable {
  constructor(clientId, seqAllocator, log, subscribe, unsubscribe) {
    super();
    this._subscriptions = new ResourceMap();
    this._inflightCreates = new ResourceMap();
    this._referenceOwnerIds = 0;
    this._clientId = clientId;
    this._seqAllocator = seqAllocator;
    this._log = log;
    this._subscribe = subscribe;
    this._unsubscribe = unsubscribe;
    this._rootState = this._register(new RootStateSubscription(clientId, log));
  }
  /** The always-live root state subscription. */
  get rootState() {
    return this._rootState;
  }
  /**
   * Initialize the root state from a snapshot received during the
   * connection handshake.
   */
  handleRootSnapshot(state, fromSeq) {
    this._rootState.handleSnapshot(state, fromSeq);
  }
  /**
   * Returns an existing subscription without affecting its refcount.
   * Returns `undefined` if no subscription is active for the given resource.
   */
  getSubscriptionUnmanaged(resource) {
    const entry = this._subscriptions.get(resource);
    return entry?.sub;
  }
  /**
   * Returns the in-flight `createSession` Promise for this URI, or `undefined` if no create is pending. Used by
   * callers that need to gate their own work on a still-running eager `createSession` (e.g. the chat handler awaits
   * this before deciding whether the sessions provider's eager-create raced first send).
   */
  getInflightSessionCreate(resource) {
    return this._inflightCreates.get(resource);
  }
  /**
   * Register an in-flight `createSession` Promise for a session URI. Any
   * subscribe issued for this resource while the create is pending waits
   * for the Promise before issuing the wire-level subscribe.
   */
  trackSessionCreate(resource, promise) {
    this._inflightCreates.set(resource, promise);
    void promise.finally(() => {
      if (this._inflightCreates.get(resource) === promise) {
        this._inflightCreates.delete(resource);
      }
    }).catch(() => {
    });
  }
  /**
   * Get or create a refcounted subscription to any resource. Disposing
   * the returned reference decrements the refcount; when it reaches zero
   * the subscription is torn down and the server is notified.
   *
   * `owner` names the caller holding the reference so inspection surfaces
   * (see {@link getActiveSubscriptions}) can attribute who is retaining a
   * subscription. Use a stable, human-readable identifier such as the
   * acquiring class name.
   */
  getSubscription(kind, resource, owner) {
    const existing = this._subscriptions.get(resource);
    if (existing) {
      if (existing.sub.value instanceof Error) {
        this._subscriptions.delete(resource);
        this._disposeSubscriptionEntry(resource, existing);
      } else {
        existing.refCount++;
        return this._acquireReference(resource, existing, owner);
      }
    }
    const key = resource.toString();
    const sub = this._createSubscription(kind, key);
    const entry = { sub, kind, refCount: 1, holders: /* @__PURE__ */ new Map() };
    this._subscriptions.set(resource, entry);
    void (async () => {
      const inflight = this._inflightCreates.get(resource);
      if (inflight) {
        try {
          await inflight;
        } catch {
        }
      }
      try {
        const snapshot = await this._subscribe(resource);
        if (this._subscriptions.get(resource) === entry) {
          sub.handleSnapshot(snapshot.state, snapshot.fromSeq);
        }
      } catch (err) {
        if (this._subscriptions.get(resource) === entry) {
          sub.setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();
    return this._acquireReference(resource, entry, owner);
  }
  /**
   * Register `owner` as a holder of `entry` and return a reference whose
   * disposal removes that holder and releases the subscription. The
   * caller is responsible for the matching refcount increment (a fresh
   * entry starts at 1; an existing entry is bumped before calling this).
   */
  _acquireReference(resource, entry, owner) {
    const ownerId = ++this._referenceOwnerIds;
    entry.holders.set(ownerId, owner);
    let isDisposed = false;
    return {
      object: entry.sub,
      dispose: () => {
        if (isDisposed) {
          return;
        }
        isDisposed = true;
        entry.holders.delete(ownerId);
        this._releaseSubscription(resource, entry);
      }
    };
  }
  _disposeSubscriptionEntry(resource, entry) {
    this._tryUnsubscribe(resource);
    if (entry.sub instanceof SessionStateSubscription || entry.sub instanceof ChatStateSubscription) {
      entry.sub.clearPending();
    }
    entry.sub.dispose();
  }
  _tryUnsubscribe(resource) {
    try {
      this._unsubscribe(resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._log(`Failed to unsubscribe ${resource.toString()}: ${message}`);
    }
  }
  /**
   * Route an incoming action envelope to all active subscriptions.
   */
  receiveEnvelope(envelope) {
    this._rootState.receiveEnvelope(envelope);
    for (const { sub } of this._subscriptions.values()) {
      sub.receiveEnvelope(envelope);
    }
  }
  /**
   * Dispatch a client action. Applies optimistically to the relevant
   * subscription if applicable, then returns the clientSeq.
   *
   * `channel` is the protocol URI string identifying the channel the
   * action targets (a session URI for session actions, etc.).
   */
  dispatchOptimistic(channel, action) {
    if (isSessionAction(action)) {
      const entry = this._subscriptions.get(URI.parse(channel));
      if (entry?.sub instanceof SessionStateSubscription) {
        return entry.sub.applyOptimistic(action);
      }
    } else if (isChatAction(action)) {
      const entry = this._subscriptions.get(URI.parse(channel));
      if (entry?.sub instanceof ChatStateSubscription) {
        return entry.sub.applyOptimistic(action);
      }
    } else if (isChangesetAction(action)) {
      const entry = this._subscriptions.get(URI.parse(channel));
      if (entry?.sub instanceof ChangesetStateSubscription) {
        return entry.sub.applyOptimistic(action);
      }
    } else if (isAnnotationsAction(action)) {
      const entry = this._subscriptions.get(URI.parse(channel));
      if (entry?.sub instanceof AnnotationsStateSubscription) {
        return entry.sub.applyOptimistic(action);
      }
    }
    return this._seqAllocator();
  }
  /**
   * URIs currently subscribed to via {@link getSubscription}. Used to
   * build the `subscriptions` payload for a `reconnect` RPC so the
   * server can restore them in one round-trip.
   *
   * Does NOT include the always-live root state, which the protocol
   * client manages separately.
   */
  currentSubscriptionUris() {
    return [...this._subscriptions.keys()];
  }
  /**
   * Read-only descriptors of every active resource subscription, for
   * inspection/debug surfaces. Does NOT include the always-live root
   * state, which the connection exposes separately via {@link rootState}.
   */
  getActiveSubscriptions() {
    const out = [];
    for (const [resource, entry] of this._subscriptions) {
      const value = entry.sub.value;
      const status = value === void 0 ? "pending" : value instanceof Error ? "error" : "snapshot";
      out.push({ resource, kind: entry.kind, refCount: entry.refCount, holders: this._summarizeHolders(entry), status });
    }
    return out;
  }
  /** Group an entry's holders by owner name, sorted by descending count. */
  _summarizeHolders(entry) {
    const counts = /* @__PURE__ */ new Map();
    for (const owner of entry.holders.values()) {
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    return [...counts.entries()].map(([owner, count]) => ({ owner, count })).sort((a, b) => b.count - a.count);
  }
  /**
   * Snapshot of every pending optimistic action across all session
   * subscriptions. Callers use this to replay actions after a transport
   * reconnect; entries are kept on their subscriptions until they're
   * either echoed back by the server or explicitly dropped via
   * {@link dropPendingSessionAction}.
   */
  getPendingSessionActions() {
    const out = [];
    for (const { sub } of this._subscriptions.values()) {
      if (sub instanceof SessionStateSubscription || sub instanceof ChatStateSubscription) {
        out.push(...sub.getPendingActions());
      }
    }
    return out;
  }
  /**
   * Remove a single pending optimistic action for a session by its
   * `clientSeq`. Used during reconnect to evict actions the server
   * already processed (and replayed back to us) so they're not resent.
   */
  dropPendingSessionAction(sessionUri, clientSeq) {
    const entry = this._subscriptions.get(URI.parse(sessionUri));
    if (entry?.sub instanceof SessionStateSubscription || entry?.sub instanceof ChatStateSubscription) {
      entry.sub.dropPendingByClientSeq(clientSeq);
    }
  }
  /**
   * Apply a fresh snapshot to a subscribed resource — used when the server
   * responds to a `reconnect` request with `type: 'snapshot'` because the
   * replay buffer no longer covers the client's gap. Routes to the root
   * subscription when {@link ROOT_STATE_URI} matches, otherwise reseats the
   * matching entry in {@link _subscriptions}. Unknown resources are ignored.
   */
  applyReconnectSnapshot(resource, state, fromSeq) {
    if (isAhpRootChannel(resource)) {
      this._rootState.handleSnapshot(state, fromSeq);
      return;
    }
    const entry = this._subscriptions.get(URI.parse(resource));
    if (!entry) {
      return;
    }
    if (entry.sub instanceof SessionStateSubscription || entry.sub instanceof ChatStateSubscription) {
      entry.sub.clearPending();
    }
    entry.sub.handleSnapshot(state, fromSeq);
  }
  /**
   * Mark a set of subscriptions as no longer resumable on the server
   * (reported via `ReconnectReplayResult.missing`). The subscriptions
   * themselves stay alive so consumers continue to hold valid references,
   * but their value transitions to an `Error` until they're recreated.
   */
  markSubscriptionsMissing(missing) {
    for (const resource of missing) {
      const entry = this._subscriptions.get(resource);
      if (entry) {
        if (entry.sub instanceof SessionStateSubscription || entry.sub instanceof ChatStateSubscription) {
          entry.sub.clearPending();
        }
        entry.sub.setError(new Error(`Subscription no longer available after reconnect: ${resource.toString()}`));
      }
    }
  }
  _createSubscription(kind, key) {
    switch (kind) {
      case StateComponents.Session:
        return new SessionStateSubscription(key, this._clientId, this._seqAllocator, this._log);
      case StateComponents.Chat:
        return new ChatStateSubscription(key, this._clientId, this._seqAllocator, this._log);
      case StateComponents.Terminal:
        return new TerminalStateSubscription(key, this._clientId, this._log);
      case StateComponents.Changeset:
        return new ChangesetStateSubscription(key, this._clientId, this._seqAllocator, this._log);
      case StateComponents.Annotations:
        return new AnnotationsStateSubscription(key, this._clientId, this._seqAllocator, this._log);
      case StateComponents.Root:
        throw new Error("_createSubscription: root subscription is managed separately");
      default:
        assertNever(kind, `_createSubscription: unsupported StateComponents kind: ${kind}`);
    }
  }
  _releaseSubscription(resource, expected) {
    const entry = this._subscriptions.get(resource);
    if (!entry || expected && entry !== expected) {
      return;
    }
    entry.refCount--;
    if (entry.refCount <= 0) {
      this._subscriptions.delete(resource);
      this._disposeSubscriptionEntry(resource, entry);
    }
  }
  dispose() {
    for (const [resource, entry] of this._subscriptions) {
      this._tryUnsubscribe(resource);
      entry.sub.dispose();
    }
    this._subscriptions.clear();
    super.dispose();
  }
}
function isActionEnvelopeRelevantToSubscriptionUris(envelope, subscribedUris) {
  if (isAhpRootChannel(envelope.channel)) {
    for (const uri of subscribedUris) {
      if (isAhpRootChannel(uri)) {
        return true;
      }
    }
    return false;
  }
  for (const uri of subscribedUris) {
    if (uri === envelope.channel) {
      return true;
    }
  }
  return false;
}
function observableFromSubscription(owner, sub) {
  return observableFromEvent(owner, sub.onDidChange, () => {
    const v = sub.value;
    return v instanceof Error ? void 0 : v;
  });
}
export {
  AgentSubscriptionManager,
  AnnotationsStateSubscription,
  ChangesetStateSubscription,
  ChatStateSubscription,
  RootStateSubscription,
  SessionStateSubscription,
  TerminalStateSubscription,
  isActionEnvelopeRelevantToSubscriptionUris,
  observableFromSubscription
};
