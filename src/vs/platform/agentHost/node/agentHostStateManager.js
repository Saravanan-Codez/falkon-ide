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
import { RunOnceScheduler } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { equals } from "../../../base/common/objects.js";
import { ILogService } from "../../log/common/log.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { TelemetryLevel } from "../../telemetry/common/telemetry.js";
import { ActionType, isRootAction, isSessionAction, isChatAction, isChangesetAction, isAnnotationsAction } from "../common/state/sessionActions.js";
import { rootReducer, sessionReducer, chatReducer, changesetReducer, annotationsReducer } from "../common/state/sessionReducers.js";
import { createRootState, createSessionState, createChatState, createDefaultChatSummary, chatSummaryFromState, buildDefaultChatUri, parseDefaultChatUri, parseRequiredSessionUriFromChatUri, isAhpChatChannel, isDefaultChatUri, mergeSessionWithDefaultChat, isAhpRootChannel, SessionLifecycle, withHostBuildInfo, ROOT_STATE_URI, ChangesetStatus, SessionStatus } from "../common/state/sessionState.js";
import { AgentHostTelemetryLevelConfigKey, platformRootSchema, telemetryLevelToAgentHostConfigValue } from "../common/agentHostSchema.js";
import { SessionConfigKey } from "../common/sessionConfigKeys.js";
import { parseChangesetUri } from "../common/changesetUri.js";
import { buildAnnotationsUri, isAnnotationsUri } from "../common/annotationsUri.js";
import { AgentHostChangesetStateCache } from "./agentHostChangesetStateCache.js";
import { arrayEquals, structuralEquals } from "../../../base/common/equals.js";
import { preserveProviderBackedRootConfigValues } from "../common/agentCustomizationSettings.js";
var SessionUse = /* @__PURE__ */ ((SessionUse2) => {
  SessionUse2[SessionUse2["UnusedDraft"] = 0] = "UnusedDraft";
  SessionUse2[SessionUse2["Used"] = 1] = "Used";
  return SessionUse2;
})(SessionUse || {});
class SessionSummaryNotifier extends Disposable {
  constructor(_getSummary, _emit) {
    super();
    this._getSummary = _getSummary;
    this._emit = _emit;
    /** Last summary announced to clients (via sessionAdded or sessionSummaryChanged). */
    this._lastNotified = /* @__PURE__ */ new Map();
    /** Sessions whose summary changed since the last flush. */
    this._dirty = /* @__PURE__ */ new Set();
    this._scheduler = this._register(new RunOnceScheduler(() => this._flushAll(), 100));
  }
  /** Records `summary` as the last value announced to clients for `session`. */
  announce(session, summary) {
    this._lastNotified.set(session, summary);
  }
  /** Whether `session` has already been announced to clients. */
  isAnnounced(session) {
    return this._lastNotified.has(session);
  }
  /** Marks `session` dirty and schedules a debounced flush. */
  markDirty(session) {
    this._dirty.add(session);
    this._scheduler.schedule();
  }
  /** Whether `session` has a pending (unflushed) summary change. */
  isDirty(session) {
    return this._dirty.has(session);
  }
  /** Drops the pending dirty flag for `session` without flushing it. */
  clearDirty(session) {
    this._dirty.delete(session);
  }
  /** Drops all notification bookkeeping for `session`. */
  remove(session) {
    this._lastNotified.delete(session);
    this._dirty.delete(session);
  }
  _flushAll() {
    for (const session of this._dirty) {
      this.flush(session);
    }
    this._dirty.clear();
  }
  /**
   * Emits a `root/sessionSummaryChanged` notification for `session` if its
   * current summary differs from the last announced one, then advances the
   * snapshot. Does NOT clear the dirty flag — callers own that bookkeeping.
   */
  flush(session) {
    const current = this._getSummary(session);
    const lastNotified = this._lastNotified.get(session);
    if (!current || !lastNotified) {
      return;
    }
    const changes = {};
    if (current.title !== lastNotified.title) {
      changes.title = current.title;
    }
    if (current.status !== lastNotified.status) {
      changes.status = current.status;
    }
    if (current.activity !== lastNotified.activity) {
      changes.activity = current.activity;
    }
    if (current.modifiedAt !== lastNotified.modifiedAt) {
      changes.modifiedAt = current.modifiedAt;
    }
    if (current.project !== lastNotified.project) {
      changes.project = current.project;
    }
    if (current.changes !== lastNotified.changes) {
      changes.changes = current.changes;
    }
    if (current.workingDirectories !== lastNotified.workingDirectories) {
      changes.workingDirectories = current.workingDirectories;
    }
    if (current._meta !== lastNotified._meta) {
      changes._meta = current._meta;
    }
    this._lastNotified.set(session, current);
    if (Object.keys(changes).length > 0) {
      this._emit(session, changes);
    }
  }
}
const IAgentHostStateManager = createDecorator("agentHostStateManager");
let AgentHostStateManager = class extends Disposable {
  constructor(_logService, options = {}) {
    super();
    this._logService = _logService;
    this._serverSeq = 0;
    /**
     * Authoritative per-session state, keyed by session URI string. Each entry
     * bundles the flat {@link SessionState} with the catalog-only fields that
     * are not part of the state (`createdAt`, `modifiedAt`, `changes`). The
     * root-channel {@link SessionSummary} catalog view is derived on demand from
     * an entry via {@link getSessionSummary} (its `_meta` is the same object as
     * {@link SessionState._meta}); the host streams catalog deltas via
     * `root/sessionSummaryChanged`.
     */
    this._sessionStates = /* @__PURE__ */ new Map();
    /**
     * Authoritative chat catalog, keyed by chat channel URI. Every catalog
     * summary has an entry, while only resolved chats have a {@link ChatState}.
     */
    this._chatEntries = /* @__PURE__ */ new Map();
    /**
     * Per-channel annotation states for the `<session>/annotations` channel.
     * Unlike changesets (server-owned), annotation actions are
     * client-dispatchable and lazily create their state on first write.
     */
    this._annotations = /* @__PURE__ */ new Map();
    /**
     * Active turns per session, keyed by session URI string with the value
     * being the set of that session's chat channel URIs that currently have an
     * active turn. A session is "active" while at least one of its chats is
     * streaming — this stays correct for multi-chat sessions whose chats can run
     * concurrent turns (e.g. agent-team / sub-agent workers), where the previous
     * single-flag-per-session model would clear too early. Active state is
     * derived from `state.activeTurn` (the source of truth maintained by the
     * session reducer) — never from raw action turn-ids — so that mismatched or
     * out-of-order turn lifecycle actions can't desync it from reality. The
     * session count (`size`) drives `RootActiveSessionsChanged` and
     * `hasActiveSessions`, which together gate `--enable-remote-auto-shutdown`.
     */
    this._sessionsWithActiveTurn = /* @__PURE__ */ new Map();
    this._onDidEmitEnvelope = this._register(new Emitter());
    this.onDidEmitEnvelope = this._onDidEmitEnvelope.event;
    this._onDidEmitNotification = this._register(new Emitter());
    this.onDidEmitNotification = this._onDidEmitNotification.event;
    this._onDidChangeSessionActiveTurn = this._register(new Emitter());
    this.onDidChangeSessionActiveTurn = this._onDidChangeSessionActiveTurn.event;
    this._onDidChangeSessionTitle = this._register(new Emitter());
    this.onDidChangeSessionTitle = this._onDidChangeSessionTitle.event;
    this._onDidChangeSessionConfig = this._register(new Emitter());
    this.onDidChangeSessionConfig = this._onDidChangeSessionConfig.event;
    this._log = (msg) => this._logService.warn(`[AgentHostStateManager] ${msg}`);
    this._changesets = new AgentHostChangesetStateCache(options.changesetStateRetention);
    this._rootState = createRootState();
    this._rootState = {
      ...this._rootState,
      config: {
        schema: platformRootSchema.toProtocol(),
        values: platformRootSchema.validateOrDefault({}, {
          [SessionConfigKey.Permissions]: { allow: [], deny: [] },
          [AgentHostTelemetryLevelConfigKey]: telemetryLevelToAgentHostConfigValue(TelemetryLevel.USAGE)
        })
      },
      _meta: withHostBuildInfo(this._rootState._meta, options.hostBuildInfo)
    };
    this._summaryNotifier = this._register(new SessionSummaryNotifier(
      (session) => {
        const entry = this._sessionStates.get(session);
        return entry ? this._toSummary(session, entry) : void 0;
      },
      (session, changes) => this._onDidEmitNotification.fire({
        type: "root/sessionSummaryChanged",
        channel: ROOT_STATE_URI,
        session,
        changes
      })
    ));
  }
  get hasActiveSessions() {
    return this._sessionsWithActiveTurn.size > 0;
  }
  /**
   * Whether the given session currently has an active turn — i.e. a request is
   * in progress on any of its chats. Stays `true` while at least one chat is
   * streaming, so it remains correct for multi-chat sessions running
   * concurrent turns.
   */
  hasActiveTurn(sessionKey) {
    return this._sessionsWithActiveTurn.has(sessionKey);
  }
  // ---- State accessors ----------------------------------------------------
  get rootState() {
    return this._rootState;
  }
  getSessionState(sessionOrChat) {
    const isChat = isAhpChatChannel(sessionOrChat);
    const session = this._resolveOwningSession(sessionOrChat);
    if (session === void 0) {
      return void 0;
    }
    const entry = this._sessionStates.get(session);
    if (!entry) {
      return void 0;
    }
    const chatUri = isChat ? sessionOrChat : buildDefaultChatUri(session);
    return mergeSessionWithDefaultChat(entry.state, this._chatEntries.get(chatUri)?.state);
  }
  /**
   * Whether a session is still an unused draft minted by this process, or
   * `undefined` when the session is not currently in state. Accepts either a
   * session URI or one of its chat channel URIs.
   *
   * Callers about to destroy durable data must use this rather than checking
   * whether the session currently looks empty.
   */
  isUnusedDraft(sessionOrChat) {
    const session = this._resolveOwningSession(sessionOrChat);
    if (session === void 0) {
      return void 0;
    }
    const entry = this._sessionStates.get(session);
    return entry && entry.use === 0 /* UnusedDraft */;
  }
  /** Permanently marks a session as used, so it is never auto-collected. */
  _markSessionUsed(session) {
    const entry = this._sessionStates.get(session);
    if (entry) {
      entry.use = 1 /* Used */;
    }
  }
  _resolveOwningSession(sessionOrChat) {
    return isAhpChatChannel(sessionOrChat) ? parseDefaultChatUri(sessionOrChat) : sessionOrChat;
  }
  /**
   * Returns the root-channel {@link SessionSummary} catalog entry for a
   * session, or `undefined` when the session is unknown. The summary is
   * derived on demand from the session's {@link ISessionEntry}: its metadata
   * fields and `_meta` come straight off the live {@link SessionState}, while
   * the catalog-only `resource` / `createdAt` / `modifiedAt` / `changes` come
   * from the entry.
   */
  getSessionSummary(session) {
    const entry = this._sessionStates.get(session);
    return entry ? this._toSummary(session, entry) : void 0;
  }
  /**
   * Projects an {@link ISessionEntry} into its root-channel
   * {@link SessionSummary}. The summary's `_meta` is the same object as
   * {@link SessionState._meta} — the host treats the two as identical.
   */
  _toSummary(session, entry) {
    const { state } = entry;
    const summary = {
      resource: session,
      provider: state.provider,
      title: state.title,
      status: state.status,
      createdAt: entry.createdAt,
      modifiedAt: entry.modifiedAt
    };
    if (state.activity !== void 0) {
      summary.activity = state.activity;
    }
    if (state.project !== void 0) {
      summary.project = state.project;
    }
    if (state.workingDirectories !== void 0) {
      summary.workingDirectories = state.workingDirectories;
    }
    if (state.annotations !== void 0) {
      summary.annotations = state.annotations;
    }
    if (entry.changes !== void 0) {
      summary.changes = entry.changes;
    }
    if (state._meta !== void 0) {
      summary._meta = state._meta;
    }
    return summary;
  }
  /**
   * Whether the {@link SessionSummary}-relevant fields of two session states
   * are field-equal. Used to decide whether a session action mutated anything
   * the root-channel catalog cares about.
   */
  _summaryFieldsEqual(a, b) {
    return a.title === b.title && a.status === b.status && a.activity === b.activity && a.project === b.project && a.workingDirectories === b.workingDirectories && a.annotations === b.annotations && a._meta === b._meta;
  }
  /**
   * Returns the authoritative {@link ChatState} for a session's default
   * chat, or `undefined` when the session is unknown. Use this when the
   * caller specifically needs conversation contents (turns, activeTurn,
   * pending/input state) rather than the session summary.
   */
  getDefaultChatState(session) {
    return this._chatEntries.get(buildDefaultChatUri(session))?.state;
  }
  /** Returns already-hydrated state without triggering resolution or I/O. */
  getChatState(chat) {
    return this._chatEntries.get(chat)?.state;
  }
  /**
   * Resolves a restored chat's provider backing and history when necessary.
   * Concurrent calls for one entry share its resolver; a failed attempt can
   * be retried unless the entry was removed or replaced.
   */
  resolveChatState(chat) {
    const entry = this._chatEntries.get(chat);
    if (!entry || !entry.valid) {
      return Promise.resolve(void 0);
    }
    if (entry.state) {
      return Promise.resolve(entry.state);
    }
    if (!entry.resolver) {
      return Promise.resolve(void 0);
    }
    if (entry.inFlight) {
      return entry.inFlight;
    }
    const inFlight = (async () => {
      const restored = await entry.resolver(entry.providerData);
      if (!entry.valid || this._chatEntries.get(chat) !== entry) {
        throw new Error(`Restored chat was invalidated while resolving: ${chat}`);
      }
      if (!entry.state) {
        entry.state = { ...createChatState(entry.summary), turns: restored.turns, draft: restored.draft ?? entry.draft };
        entry.resolver = void 0;
        if (restored.turns.length > 0) {
          this._markSessionUsed(entry.session);
        }
      }
      return entry.state;
    })();
    entry.inFlight = inFlight;
    void inFlight.then(
      () => {
        if (entry.inFlight === inFlight) {
          entry.inFlight = void 0;
        }
      },
      () => {
        if (entry.inFlight === inFlight) {
          entry.inFlight = void 0;
        }
      }
    );
    return inFlight;
  }
  /** Replaces a chat's opaque, agent-owned provider data without interpreting it. */
  updateChatProviderData(chat, providerData) {
    const entry = this._chatEntries.get(chat);
    if (entry) {
      entry.providerData = providerData;
    }
  }
  /**
   * Seeds the conversation contents (turns) of a session's default chat.
   * Used by the fork flow, which materializes a new session pre-populated
   * with a slice of the source session's turns.
   */
  seedDefaultChatTurns(session, turns) {
    const chatState = this._chatEntries.get(buildDefaultChatUri(session))?.state;
    if (chatState) {
      chatState.turns = turns;
    }
    if (turns.length > 0) {
      this._markSessionUsed(session);
    }
  }
  get serverSeq() {
    return this._serverSeq;
  }
  getSessionUris() {
    return [...this._sessionStates.keys()];
  }
  /**
   * Summaries eligible to be overlaid onto a provider's `listSessions`
   * snapshot when that snapshot is missing them. A session qualifies if it
   * has materialized (lifecycle !== {@link SessionLifecycle.Creating}) — this
   * covers the transient-drop case where a provider briefly omits a
   * just-materialized session — or if it is still provisional but has had any
   * turn activity (an in-flight turn, or a completed turn whose materialize
   * event has not landed yet; the first turn can start before materialization
   * completes). Idle provisional sessions (created but not yet materialized
   * and with no turn activity, e.g. the new-session composer's eagerly-created
   * session before its first message) are excluded so they don't leak into
   * the session list (#321269).
   */
  getOverlaySessionSummaries() {
    const summaries = [];
    for (const [key, entry] of this._sessionStates) {
      const chat = this._chatEntries.get(buildDefaultChatUri(key))?.state;
      if (entry.state.lifecycle === SessionLifecycle.Creating && !chat?.activeTurn && (chat?.turns.length ?? 0) === 0) {
        continue;
      }
      summaries.push(this._toSummary(key, entry));
    }
    return summaries;
  }
  /**
   * Returns all session URIs whose keys start with the given prefix.
   * Used to discover subagent sessions for a given parent.
   */
  getSessionUrisWithPrefix(prefix) {
    const result = [];
    for (const key of this._sessionStates.keys()) {
      if (key.startsWith(prefix)) {
        result.push(key);
      }
    }
    return result;
  }
  // ---- Snapshots ----------------------------------------------------------
  /**
   * Returns a state snapshot for a given resource URI.
   * The `fromSeq` in the snapshot is the current serverSeq at snapshot time;
   * the client should process subsequent envelopes with serverSeq > fromSeq.
   */
  getSnapshot(resource) {
    if (isAhpRootChannel(resource)) {
      return {
        resource: ROOT_STATE_URI,
        state: this._rootState,
        fromSeq: this._serverSeq
      };
    }
    const changesetState = this._changesets.get(resource);
    if (changesetState) {
      return {
        resource,
        state: changesetState,
        fromSeq: this._serverSeq
      };
    }
    if (isAhpChatChannel(resource)) {
      const chatState = this._chatEntries.get(resource)?.state;
      if (!chatState) {
        return void 0;
      }
      return {
        resource,
        state: chatState,
        fromSeq: this._serverSeq
      };
    }
    if (isAnnotationsUri(resource)) {
      return {
        resource,
        state: this._annotations.get(resource) ?? { annotations: [] },
        fromSeq: this._serverSeq
      };
    }
    const entry = this._sessionStates.get(resource);
    if (!entry) {
      return void 0;
    }
    return {
      resource,
      state: entry.state,
      fromSeq: this._serverSeq
    };
  }
  /** Read-only accessor for callers that only need to inspect a changeset (not subscribe). */
  getChangesetState(changeset) {
    return this._changesets.get(changeset);
  }
  /** Reconsiders changeset state retention after subscribers or computes release their pins. */
  onChangesetLivenessChanged() {
    this._changesets.trimEvictableEntries();
  }
  // ---- Session lifecycle --------------------------------------------------
  /**
   * Creates a new session in state with `lifecycle: 'creating'`.
   * Returns the initial session state.
   *
   * By default a {@link NotificationType.SessionAdded} notification is
   * emitted so clients see the new session immediately. Pass
   * `options.emitNotification: false` to defer the notification — a typical
   * use is for **provisional** sessions that exist on the server but should
   * not appear in client session lists until they have been persisted by
   * the agent (e.g. on the first message that materializes an SDK session
   * and writes its on-disk metadata). Call {@link markSessionPersisted}
   * afterwards to fire the deferred notification.
   */
  createSession(summary, options) {
    const key = summary.resource;
    const existing = this._sessionStates.get(key);
    if (existing) {
      this._logService.warn(`[AgentHostStateManager] Session already exists: ${key}`);
      return existing.state;
    }
    const state = createSessionState(summary);
    this._sessionStates.set(key, this._newEntry(state, summary, 0 /* UnusedDraft */));
    this._ensureDefaultChat(key, summary);
    this._logService.trace(`[AgentHostStateManager] Created session: ${key}`);
    if (options?.emitNotification !== false) {
      this._summaryNotifier.announce(key, summary);
      this._onDidEmitNotification.fire({
        type: "root/sessionAdded",
        channel: ROOT_STATE_URI,
        summary
      });
    }
    return state;
  }
  /** Builds the authoritative {@link ISessionEntry} for a freshly seeded state. */
  _newEntry(state, summary, use) {
    return { state, createdAt: summary.createdAt, modifiedAt: summary.modifiedAt, changes: summary.changes, use };
  }
  /**
   * Fire a {@link NotificationType.SessionAdded} notification for a session
   * whose creation was deferred via `createSession({ emitNotification: false })`.
   *
   * Propagates the materialization-resolved catalog fields (`project`,
   * `workingDirectory`, `modifiedAt`, `changes`) from the supplied summary
   * onto the session entry so subscribers see them. The reducer-owned metadata
   * (`title`, `status`, `activity`) is intentionally NOT copied back — the live
   * state is authoritative for those. No-ops for sessions that were already
   * announced (idempotent).
   */
  markSessionPersisted(session, summary, force = false) {
    const key = session.toString();
    const entry = this._sessionStates.get(key);
    if (!entry) {
      this._logService.warn(`[AgentHostStateManager] markSessionPersisted: unknown session ${key}`);
      return;
    }
    if (!force && this._summaryNotifier.isAnnounced(key)) {
      return;
    }
    entry.state = { ...entry.state, project: summary.project, workingDirectories: summary.workingDirectories };
    entry.modifiedAt = summary.modifiedAt;
    entry.changes = summary.changes;
    const full = this._toSummary(key, entry);
    this._summaryNotifier.announce(key, full);
    this._onDidEmitNotification.fire({
      type: "root/sessionAdded",
      channel: ROOT_STATE_URI,
      summary: full
    });
  }
  /**
   * Announce a legacy Copilot CLI session that the provider discovered on disk
   * (surfaced as adoptable) after startup, so clients add it to their list
   * without a manual reload. Does NOT create persistent state — the session is
   * materialized on demand when the user opens it (restore/adopt). No-ops if
   * the session is already in state or was already announced.
   */
  announceSurfacedSession(summary) {
    const key = summary.resource;
    if (this._sessionStates.has(key)) {
      this._logService.trace(`[AgentHostStateManager] announceSurfacedSession: already in state ${key}`);
      return;
    }
    if (this._summaryNotifier.isAnnounced(key)) {
      this._logService.trace(`[AgentHostStateManager] announceSurfacedSession: already announced ${key}`);
      return;
    }
    this._summaryNotifier.announce(key, summary);
    this._onDidEmitNotification.fire({
      type: "root/sessionAdded",
      channel: ROOT_STATE_URI,
      summary
    });
  }
  /**
   * Restores a session from a previous server lifetime into the state manager
   * with pre-populated turns. The session is created in `ready` lifecycle
   * state since it already exists on the backend.
   *
   * Unlike {@link createSession}, this does NOT emit a `sessionAdded`
   * notification because the session is already known to clients via
   * `listSessions`. When the session was previously surfaced with a different
   * summary (e.g. adoptable-legacy), a `sessionSummaryChanged` delta is emitted
   * so clients update the entry in place instead of dropping it.
   */
  restoreSession(summary, turns, options) {
    const key = summary.resource;
    const existing = this._sessionStates.get(key);
    if (existing) {
      this._logService.warn(`[AgentHostStateManager] Session already exists (restore): ${key}`);
      return existing.state;
    }
    const state = {
      ...createSessionState(summary),
      lifecycle: SessionLifecycle.Ready
    };
    this._sessionStates.set(key, this._newEntry(state, summary, 1 /* Used */));
    this._ensureDefaultChat(key, summary, turns, options?.draft, options?.defaultChatTitle);
    if (this._summaryNotifier.isAnnounced(key)) {
      this._summaryNotifier.flush(key);
    } else {
      this._summaryNotifier.announce(key, summary);
    }
    this._logService.trace(`[AgentHostStateManager] Restored session: ${key} (${turns.length} turns)`);
    return state;
  }
  /**
   * Creates the default {@link ChatState} for a session and records it as
   * the session's single chat. VS Code models every session as having
   * exactly one chat — its default chat — whose URI is derived
   * deterministically from the session URI. The chat is seeded with any
   * pre-populated `turns` (used by {@link restoreSession}).
   *
   * The session's `chats` catalog and `defaultChat` pointer are updated
   * in place rather than via dispatched actions: there are no subscribers
   * at creation/restore time, so the snapshot a client later receives on
   * subscribe already reflects the default chat.
   */
  _ensureDefaultChat(sessionKey, summary, turns, draft, defaultChatTitle) {
    const chatUri = buildDefaultChatUri(sessionKey);
    const chatSummary = { ...createDefaultChatSummary(summary, chatUri), title: defaultChatTitle ?? "" };
    this._chatEntries.set(chatUri, {
      session: sessionKey,
      summary: chatSummary,
      state: { ...createChatState(chatSummary), turns: turns ?? [], draft },
      valid: true
    });
    const entry = this._sessionStates.get(sessionKey);
    if (entry) {
      entry.state.chats = [chatSummary];
      entry.state.defaultChat = chatUri;
    }
  }
  /**
   * Adds an additional (non-default) chat to an existing session. Creates
   * the chat's authoritative {@link ChatState}, registers it in the session's
   * catalog via a dispatched {@link ActionType.SessionChatAdded} action (so
   * live subscribers refresh), and returns the new chat's summary.
   *
   * The chat inherits the session's model/agent/working-directory scope. It
   * is a no-op (returning the existing summary) when a chat with the same URI
   * already exists.
   *
   * When `options.providerData` is supplied it is recorded verbatim as the
   * peer chat's opaque, agent-owned restore blob. The StateManager never
   * parses it. The default chat never carries `providerData`.
   */
  addChat(session, chatUri, options) {
    const entry = this._sessionStates.get(session);
    if (!entry) {
      this._logService.warn(`[AgentHostStateManager] addChat for unknown session: ${session}`);
      return void 0;
    }
    const sessionState = entry.state;
    const existing = sessionState.chats.find((c) => c.resource === chatUri);
    if (existing) {
      return existing;
    }
    const defaultChatUri = sessionState.defaultChat ?? buildDefaultChatUri(session);
    const defaultEntry = sessionState.chats.find((c) => c.resource === defaultChatUri);
    if (defaultEntry && !defaultEntry.title && sessionState.title) {
      this.updateChatTitle(session, defaultChatUri, sessionState.title);
    }
    const chatSummary = {
      ...createDefaultChatSummary(this._toSummary(session, entry), chatUri),
      title: options?.title ?? "",
      status: SessionStatus.Idle,
      origin: options?.origin,
      interactivity: options?.interactivity
    };
    this._chatEntries.set(chatUri, {
      session,
      summary: chatSummary,
      state: { ...createChatState(chatSummary), turns: options?.turns ?? [] },
      providerData: options?.providerData,
      valid: true
    });
    this.dispatchServerAction(session, { type: ActionType.SessionChatAdded, summary: chatSummary });
    return chatSummary;
  }
  /**
   * Registers a restored peer chat in the parent session's catalog without
   * creating conversation state. The state-manager-owned resolver installs a
   * complete state only through {@link resolveChatState}.
   */
  registerRestoredChatSummary(session, chatUri, options) {
    const entry = this._sessionStates.get(session);
    if (!entry) {
      this._logService.warn(`[AgentHostStateManager] registerRestoredChatSummary for unknown session: ${session}`);
      return void 0;
    }
    const sessionState = entry.state;
    const existing = sessionState.chats.find((c) => c.resource === chatUri);
    if (existing) {
      const existingEntry = this._chatEntries.get(chatUri);
      if (existingEntry && !existingEntry.state && options.resolver) {
        existingEntry.providerData = options.providerData;
        existingEntry.draft = options.draft;
        existingEntry.resolver = options.resolver;
      }
      return existing;
    }
    const chatSummary = {
      ...createDefaultChatSummary(this._toSummary(session, entry), chatUri),
      title: options.title ?? "",
      status: SessionStatus.Idle,
      origin: options.origin
    };
    sessionState.chats = [...sessionState.chats, chatSummary];
    this._chatEntries.set(chatUri, {
      session,
      summary: chatSummary,
      providerData: options.providerData,
      draft: options.draft,
      resolver: options.resolver,
      valid: true
    });
    return chatSummary;
  }
  /**
   * Removes an additional chat from a session. Deletes its
   * {@link ChatState}, dispatches {@link ActionType.SessionChatRemoved}, and
   * — if the removed chat was the default — repoints `defaultChat` to the
   * first remaining chat. The default chat itself cannot be removed in
   * isolation; it lives and dies with its session.
   */
  removeChat(session, chatUri) {
    const entry = this._sessionStates.get(session);
    if (!entry || !entry.state.chats.some((c) => c.resource === chatUri)) {
      return;
    }
    const sessionState = entry.state;
    if (chatUri === sessionState.defaultChat || isDefaultChatUri(chatUri)) {
      this._logService.warn(`[AgentHostStateManager] refusing to remove default chat: ${chatUri}`);
      return;
    }
    this._removeChatActiveTurn(session, chatUri);
    this._invalidateChatEntry(chatUri);
    this.dispatchServerAction(session, { type: ActionType.SessionChatRemoved, chat: chatUri });
  }
  /**
   * Invalidates restored chat resolution before a session's asynchronous
   * teardown starts. Session removal subsequently drops the entries entirely.
   */
  invalidateSessionChatResolutions(session) {
    for (const entry of this._chatEntries.values()) {
      if (entry.session === session) {
        entry.valid = false;
      }
    }
  }
  /**
   * Renames a single chat within a session independently of the session
   * title. Updates the chat's authoritative {@link ChatState} title (so
   * later `chatSummaryFromState` projections stay consistent) and dispatches
   * a {@link ActionType.SessionChatUpdated} so the session's catalog entry and
   * live subscribers reflect the new title. Works for the default chat too —
   * giving it a non-empty title that no longer inherits the session title.
   */
  updateChatTitle(session, chatUri, title) {
    const chatState = this._chatEntries.get(chatUri)?.state;
    if (chatState) {
      const entry = this._chatEntries.get(chatUri);
      entry.state = { ...chatState, title };
    }
    this.dispatchServerAction(session, { type: ActionType.SessionChatUpdated, chat: chatUri, changes: { title } });
  }
  /**
   * Removes a session from in-memory state without emitting a
   * {@link NotificationType.SessionRemoved} notification.
   * Use {@link deleteSession} when the session is being permanently deleted
   * and clients need to be notified of its removal.
   *
   * Any pending summary change is flushed synchronously before the session is
   * torn down, so clients receive the final status (e.g. Idle after a turn
   * completes) even when the session is evicted before the scheduler fires.
   * A {@link NotificationType.SessionSummaryChanged} notification may therefore
   * be emitted as a side-effect of this call.
   *
   * Per-session changesets are intentionally NOT torn down here: this method
   * is also used as an idle-eviction (LRU) hook (see
   * `AgentService._maybeEvictIdleSession`) and the session list view keeps a
   * changeset subscription open per visible row to render the diff chip.
   * Tearing down on eviction would clear the chip on the list while the row
   * is still on screen. Permanent-delete paths (`deleteSession`,
   * `removeSubagentSessions`) call `disposeSessionChangesets` explicitly
   * before invoking `removeSession`.
   */
  removeSession(session) {
    const entry = this._sessionStates.get(session);
    if (!entry) {
      return;
    }
    this.invalidateSessionChatResolutions(session);
    if (this._summaryNotifier.isDirty(session)) {
      this._summaryNotifier.flush(session);
    }
    if (this._sessionsWithActiveTurn.delete(session)) {
      this._onDidChangeSessionActiveTurn.fire({ session, active: false });
      this.dispatchServerAction(ROOT_STATE_URI, { type: ActionType.RootActiveSessionsChanged, activeSessions: this._sessionsWithActiveTurn.size });
    }
    for (const chat of entry.state.chats) {
      this._invalidateChatEntry(chat.resource);
    }
    this._invalidateChatEntry(buildDefaultChatUri(session));
    this._sessionStates.delete(session);
    this._summaryNotifier.remove(session);
    this._logService.trace(`[AgentHostStateManager] Removed session: ${session}`);
  }
  /**
   * Permanently deletes a session from state and emits a
   * {@link NotificationType.SessionRemoved} notification so that clients
   * know the session is no longer accessible.
   *
   * Sessions whose creation was deferred via
   * `createSession({ emitNotification: false })` and never persisted via
   * {@link markSessionPersisted} are removed silently — no client knows
   * about them, so a `SessionRemoved` would be noise (or worse, would
   * cause clients to drop a session URI they had eagerly subscribed to).
   */
  deleteSession(session) {
    const wasAnnounced = this._summaryNotifier.isAnnounced(session);
    this._summaryNotifier.clearDirty(session);
    this.disposeSessionChangesets(session);
    this.disposeSessionAnnotations(session);
    this.removeSession(session);
    if (wasAnnounced) {
      this._onDidEmitNotification.fire({
        type: "root/sessionRemoved",
        channel: ROOT_STATE_URI,
        session
      });
    }
  }
  // ---- Session meta -------------------------------------------------------
  /**
   * Replaces `state._meta` on a session by dispatching a
   * {@link ActionType.SessionMetaChanged} action so the change flows
   * through the action envelope (and thus to all live subscribers).
   *
   * The full `_meta` object is replaced (not merged) so callers stay in
   * control of the convention for their own keys; use the `withSessionXxx`
   * helpers in `sessionState.ts` to combine slots.
   */
  setSessionMeta(session, meta) {
    this.dispatchServerAction(session, { type: ActionType.SessionMetaChanged, _meta: meta });
  }
  /**
   * Seeds or replaces a session's resolved {@link SessionConfigState} on the
   * live session state. Unlike mid-session {@link ActionType.SessionConfigChanged}
   * updates (which merge values onto an existing config), this establishes
   * the initial config and is therefore an in-place mutation of the
   * authoritative state object so the value is present in the first snapshot
   * a subscriber receives. Use this from create/restore flows where the
   * config is resolved asynchronously after the session state already exists
   * in the map — reading back through {@link getSessionState} would return a
   * detached composite copy and stranding the mutation there.
   */
  setSessionConfig(session, config) {
    const entry = this._sessionStates.get(session);
    if (!entry) {
      this._logService.warn(`[AgentHostStateManager] setSessionConfig: unknown session ${session}`);
      return;
    }
    entry.state.config = config;
  }
  /**
   * Seeds or replaces the session's effective customizations directly on the
   * authoritative in-memory state. Used by create/restore flows to ensure the
   * first snapshot already contains customizations.
   */
  setSessionCustomizations(session, customizations) {
    const entry = this._sessionStates.get(session);
    if (!entry) {
      this._logService.warn(`[AgentHostStateManager] setSessionCustomizations: unknown session ${session}`);
      return;
    }
    entry.state.customizations = customizations ? [...customizations] : void 0;
  }
  // ---- Changeset registry -------------------------------------------------
  /**
   * Registers a server-side changeset so that subscribers can attach to its
   * URI. The changeset is created with the supplied initial status (default
   * {@link ChangesetStatus.Computing}); subsequent file/operation/status
   * mutations flow through {@link dispatchChangesetAction} on the
   * canonical `<sessionUri>/changeset/<changesetId>` URI.
   *
   * Idempotent: a second call with the same URI is a no-op so producers
   * can safely re-register on session resume without double-creating
   * state.
   *
   * Callers construct `changesetUri` via {@link buildSessionChangesetUri}
   * for the session-wide entry, or {@link buildChangesetUri} for any
   * other catalogue entry.
   *
   * Returns the supplied changeset URI for caller convenience.
   */
  registerChangeset(changesetUri, initialStatus = ChangesetStatus.Computing) {
    this._changesets.register(changesetUri, initialStatus);
    return changesetUri;
  }
  /**
   * Updates the aggregate `changes` for a session.
   *
   * There is no dedicated action for this field: the value is purely
   * informational (chip rendering on the session list), so the write
   * piggybacks on the existing `sessionSummaryChanged` notification
   * path. We update the session entry, mark the session dirty, and let
   * the summary notifier's flush pick the new value up via its
   * `current.changes !== lastNotified.changes` diff.
   */
  setSessionSummaryChanges(session, changes) {
    const entry = this._sessionStates.get(session);
    if (!entry) {
      this._logService.warn(`[AgentHostStateManager] setSessionSummaryChanges: unknown session ${session}`);
      return;
    }
    if (structuralEquals(entry.changes, changes)) {
      return;
    }
    entry.changes = changes;
    this._summaryNotifier.markDirty(session);
  }
  /**
   * Replaces the catalogue entries on `state.changesets` for `session` by
   * dispatching a {@link ActionType.SessionChangesetsChanged} action.
   * Subscribers see the mutation in the standard session action stream —
   * the catalogue lives on session state and is not its own subscribable
   * resource. Aggregate `changes` counts (additions / deletions /
   * files) are propagated separately via {@link setSessionSummaryChanges}.
   *
   * Producers call this after each compute pass to keep the list of
   * available changesets (with their `changeKind`) in sync so observers
   * can render the correct entries without subscribing to each one.
   */
  setSessionChangesets(session, changesets) {
    const entry = this._sessionStates.get(session);
    if (!entry) {
      this._logService.warn(`[AgentHostStateManager] setSessionChangesets: unknown session ${session}`);
      return;
    }
    const state = entry.state;
    if (arrayEquals(state.changesets ?? [], changesets ?? [], structuralEquals)) {
      return;
    }
    const next = changesets ? changesets.slice() : void 0;
    this.dispatchServerAction(session, {
      type: ActionType.SessionChangesetsChanged,
      changesets: next
    });
  }
  /**
   * Tear down a changeset. Dispatches {@link ActionType.ChangesetCleared}
   * so subscribers see an empty file list, then deletes the local state
   * so a fresh `getChangesetState` returns `undefined` and forces the
   * producer to re-create the changeset on next subscribe.
   *
   * Per the spec, the server SHOULD also unsubscribe its clients after
   * dispatching this action; for VS Code-internal clients that happens
   * via the `notify/sessionRemoved` notification, which the workbench-side
   * provider correlates to release any held subscriptions.
   *
   * Safe to call for a URI that was never registered: producers typically
   * iterate over a candidate set on session disposal and emit dispose
   * actions defensively.
   */
  disposeChangeset(changeset) {
    if (!this._changesets.has(changeset)) {
      return;
    }
    this.dispatchServerAction(changeset, {
      type: ActionType.ChangesetCleared
    });
    this._changesets.delete(changeset);
  }
  /**
   * Disposes every changeset whose URI is nested under `session` (i.e.
   * matches `<session>/changeset/...`). Used to cascade cleanup when a
   * session itself is removed.
   */
  disposeSessionChangesets(session) {
    const toDispose = [];
    for (const uri of this._changesets.keys()) {
      const parsed = parseChangesetUri(uri);
      if (parsed && parsed.sessionUri === session) {
        toDispose.push(uri);
      }
    }
    for (const uri of toDispose) {
      this.disposeChangeset(uri);
    }
  }
  /**
   * Drops the annotation state nested under `session` (i.e. the
   * `<session>/annotations` channel). Used to cascade cleanup when a
   * session itself is removed. Subscriptions are released via the
   * forthcoming `sessionRemoved` notification.
   */
  disposeSessionAnnotations(session) {
    this._annotations.delete(buildAnnotationsUri(session));
  }
  // ---- Turn tracking ------------------------------------------------------
  /**
   * Registers a mapping from turnId to session URI so that incoming
   * provider events (which carry only session URI) can be associated
   * with the correct active turn.
   */
  getActiveTurnId(sessionOrChat) {
    const chatUri = isAhpChatChannel(sessionOrChat) ? sessionOrChat : buildDefaultChatUri(sessionOrChat);
    return this._chatEntries.get(chatUri)?.state?.activeTurn?.id;
  }
  // ---- Action dispatch ----------------------------------------------------
  /**
   * Dispatch a server-originated action (from the agent backend).
   * The action is applied to state via the reducer and emitted as an
   * envelope with no origin (server-produced).
   *
   * `channel` identifies the channel the action targets — `ROOT_STATE_URI`
   * for root actions, a session URI for session actions, a terminal URI
   * for terminal actions, an expanded changeset URI for changeset actions.
   */
  dispatchServerAction(channel, action) {
    this._applyAndEmit(channel, action, void 0);
  }
  /**
   * Dispatch a client-originated action (write-ahead from a renderer).
   * The action is applied to state and emitted with the client's origin
   * so the originating client can reconcile.
   */
  dispatchClientAction(channel, action, origin) {
    return this._applyAndEmit(channel, action, origin);
  }
  /**
   * Reject a client-originated action without applying it to state. Emits an
   * {@link ActionEnvelope} that carries the original {@link ActionOrigin} and a
   * {@link ActionEnvelope.rejectionReason | rejectionReason} so the originating
   * client can reconcile (roll back) its optimistic write-ahead action through
   * the normal path instead of leaving it pending until reconnect. The reducer
   * is deliberately NOT run, so no synchronized state changes.
   */
  rejectClientAction(channel, action, origin, reason) {
    const envelope = {
      channel,
      action,
      serverSeq: ++this._serverSeq,
      origin,
      rejectionReason: reason
    };
    this._logService.trace(`[AgentHostStateManager] Emitting rejection envelope: seq=${envelope.serverSeq}, channel=${envelope.channel}, type=${action.type}, origin=${origin.clientId}:${origin.clientSeq}, reason=${reason}`);
    this._onDidEmitEnvelope.fire(envelope);
  }
  // ---- Internal -----------------------------------------------------------
  _invalidateChatEntry(chat) {
    const entry = this._chatEntries.get(chat);
    if (entry) {
      entry.valid = false;
      this._chatEntries.delete(chat);
    }
  }
  _synchronizeChatEntries(session, summaries) {
    const expected = new Set(summaries.map((summary) => summary.resource));
    for (const summary of summaries) {
      const existing = this._chatEntries.get(summary.resource);
      if (existing) {
        existing.summary = summary;
        if (existing.state) {
          existing.state = { ...existing.state, ...summary };
        }
      } else {
        this._chatEntries.set(summary.resource, {
          session,
          summary,
          valid: true
        });
      }
    }
    for (const [chat, entry] of this._chatEntries) {
      if (entry.session === session && !expected.has(chat)) {
        this._invalidateChatEntry(chat);
      }
    }
  }
  _applyAndEmit(channel, action, origin) {
    let resultingState = void 0;
    if (action.type === ActionType.RootConfigChanged && action.replace) {
      action = {
        ...action,
        config: preserveProviderBackedRootConfigValues(this._rootState, action.config)
      };
    }
    if (isRootAction(action)) {
      if (action.type === ActionType.RootConfigChanged && this._rootState.config) {
        const current = this._rootState.config.values;
        const patch = action.config;
        const isNoOp = action.replace ? equals(current, patch) : equals({ ...current, ...patch }, current);
        if (isNoOp) {
          return this._rootState;
        }
      }
      this._rootState = rootReducer(this._rootState, action, this._log);
      resultingState = this._rootState;
    }
    if (isSessionAction(action)) {
      const sessionAction = action;
      const key = channel;
      const entry = this._sessionStates.get(key);
      if (entry) {
        const previousState = entry.state;
        const newState = sessionReducer(previousState, sessionAction, this._log);
        const summaryChanged = !this._summaryFieldsEqual(previousState, newState);
        entry.state = newState;
        this._synchronizeChatEntries(key, newState.chats);
        if (previousState.title !== newState.title) {
          this._onDidChangeSessionTitle.fire({ session: key, title: newState.title });
        }
        if (sessionAction.type === ActionType.SessionConfigChanged) {
          this._onDidChangeSessionConfig.fire({ session: key, previous: previousState.config, current: newState.config });
        }
        if (summaryChanged) {
          this._summaryNotifier.markDirty(key);
        }
        resultingState = newState;
      } else if (!isAhpChatChannel(key)) {
        this._logService.warn(`[AgentHostStateManager] Action for unknown session: ${key}, type=${action.type}`);
      }
    }
    if (isChatAction(action)) {
      if (!isAhpChatChannel(channel)) {
        throw new Error(`[AgentHostStateManager] Chat action dispatched to non-chat channel: ${channel}, type=${action.type}`);
      }
      const chatAction = action;
      const sessionKey = parseRequiredSessionUriFromChatUri(channel);
      const chatEntry = this._chatEntries.get(channel);
      const chat = chatEntry?.state;
      if (chat && chatEntry && sessionKey !== void 0) {
        const newChat = chatReducer(chat, chatAction, this._log);
        chatEntry.state = newChat;
        this._onChatStateChanged(sessionKey, channel, chat, newChat);
        resultingState = newChat;
      } else {
        this._logService.warn(`[AgentHostStateManager] Action for unknown chat: ${channel}, type=${action.type}`);
      }
    }
    if (isChangesetAction(action)) {
      const changesetAction = action;
      const key = channel;
      const state = this._changesets.get(key);
      if (!state) {
        this._logService.warn(`[AgentHostStateManager] Action for unknown changeset: ${key}, type=${action.type}`);
        return void 0;
      }
      const newState = changesetReducer(state, changesetAction, this._log);
      if (newState !== state) {
        this._changesets.set(key, newState);
      }
      resultingState = newState;
    }
    if (isAnnotationsAction(action)) {
      const annotationsAction = action;
      const key = channel;
      const state = this._annotations.get(key) ?? { annotations: [] };
      const newState = annotationsReducer(state, annotationsAction, this._log);
      if (newState !== state) {
        this._annotations.set(key, newState);
      }
      resultingState = newState;
    }
    const envelope = {
      channel,
      action,
      serverSeq: ++this._serverSeq,
      origin
    };
    this._logService.trace(`[AgentHostStateManager] Emitting envelope: seq=${envelope.serverSeq}, channel=${envelope.channel}, type=${action.type}${origin ? `, origin=${origin.clientId}:${origin.clientSeq}` : ""}`);
    this._onDidEmitEnvelope.fire(envelope);
    return resultingState;
  }
  /**
   * Removes a single chat from its session's active-turn set, firing the
   * session-level active flip ({@link onDidChangeSessionActiveTurn} +
   * {@link ActionType.RootActiveSessionsChanged}) when this clears the
   * session's last active chat. Safe to call for chats that aren't currently
   * tracked as active — it is a no-op in that case. Used both when a turn
   * ends and when a chat is removed mid-turn, so the session can't be
   * stranded as permanently "active".
   */
  _removeChatActiveTurn(sessionKey, chatUri) {
    const activeChats = this._sessionsWithActiveTurn.get(sessionKey);
    if (!activeChats || !activeChats.delete(chatUri)) {
      return;
    }
    if (activeChats.size === 0) {
      this._sessionsWithActiveTurn.delete(sessionKey);
      this._onDidChangeSessionActiveTurn.fire({ session: sessionKey, active: false });
      this.dispatchServerAction(ROOT_STATE_URI, { type: ActionType.RootActiveSessionsChanged, activeSessions: this._sessionsWithActiveTurn.size });
    }
  }
  /**
   * Bridges a default-chat state transition back onto its owning session.
   *
   * The protocol moved turn lifecycle (and therefore the derived
   * activity status) onto the chat channel. To preserve VS Code's
   * single-chat behaviour we:
   *  - track active-turn transitions (driving `RootActiveSessionsChanged`
   *    and `hasActiveSessions`, which gate `--enable-remote-auto-shutdown`),
   *    keyed by the owning session URI;
   *  - mirror the chat's denormalized `status`/`activity`/`modifiedAt`
   *    onto the session summary so the session list reflects progress;
   *  - forward the chat's own `status` to the session `chats` catalog (via a
   *    {@link ActionType.SessionChatUpdated}) so per-chat tabs reflect that
   *    chat's progress, not just the aggregated session summary; and
   *  - keep the session's `chats` catalog entry in sync.
   */
  _onChatStateChanged(sessionKey, chatUri, prev, next) {
    if (next.turns.length > 0 || next.activeTurn) {
      this._markSessionUsed(sessionKey);
    }
    const hadActive = !!prev.activeTurn;
    const hasActive = !!next.activeTurn;
    if (hadActive !== hasActive) {
      if (hasActive) {
        let activeChats = this._sessionsWithActiveTurn.get(sessionKey);
        const wasSessionActive = !!activeChats?.size;
        if (!activeChats) {
          activeChats = /* @__PURE__ */ new Set();
          this._sessionsWithActiveTurn.set(sessionKey, activeChats);
        }
        activeChats.add(chatUri);
        if (!wasSessionActive) {
          this._onDidChangeSessionActiveTurn.fire({ session: sessionKey, active: true });
          this.dispatchServerAction(ROOT_STATE_URI, { type: ActionType.RootActiveSessionsChanged, activeSessions: this._sessionsWithActiveTurn.size });
        }
      } else {
        this._removeChatActiveTurn(sessionKey, chatUri);
      }
    }
    const entry = this._sessionStates.get(sessionKey);
    if (!entry) {
      return;
    }
    const sessionState = entry.state;
    const nextEntry = chatSummaryFromState(next);
    const prevEntry = sessionState.chats.find((c) => c.resource === chatUri);
    const chats = sessionState.chats.map((c) => c.resource === chatUri ? nextEntry : c);
    if (prevEntry?.status !== nextEntry.status) {
      this.dispatchServerAction(sessionKey, {
        type: ActionType.SessionChatUpdated,
        chat: chatUri,
        changes: { status: nextEntry.status, activity: nextEntry.activity }
      });
    }
    const aggregate = this._aggregateChatSummaries(chats, sessionState.defaultChat);
    const newStatus = aggregate.status !== void 0 ? this._mergeSessionStatus(sessionState.status, aggregate.status) : sessionState.status;
    const statusChanged = newStatus !== sessionState.status;
    const activityChanged = aggregate.activity !== sessionState.activity;
    entry.state = {
      ...sessionState,
      chats,
      ...statusChanged ? { status: newStatus } : void 0,
      ...activityChanged ? { activity: aggregate.activity } : void 0
    };
    const newModifiedAt = aggregate.modifiedAt !== void 0 ? new Date(aggregate.modifiedAt).toISOString() : void 0;
    const modifiedAtChanged = newModifiedAt !== void 0 && newModifiedAt !== entry.modifiedAt;
    if (modifiedAtChanged) {
      entry.modifiedAt = newModifiedAt;
    }
    if (statusChanged || activityChanged || modifiedAtChanged) {
      this._summaryNotifier.markDirty(sessionKey);
    }
  }
  /**
   * Aggregates a session's chat catalog into the derived session-summary
   * fields per the protocol rules: activity bits come from the default chat
   * (else the most recently modified chat) with `InputNeeded`/`Error`/
   * `InProgress` promoted whenever any chat raises them; the `activity` string
   * follows the chat driving the resulting status; `modifiedAt` is the max
   * across chats. Promotion precedence is `InputNeeded` > `Error` >
   * `InProgress`, so a running peer (sub) chat surfaces as `InProgress` on the
   * session even when the default chat is idle.
   */
  _aggregateChatSummaries(chats, defaultChat) {
    if (chats.length === 0) {
      return {};
    }
    const activityMask = ~(SessionStatus.IsRead | SessionStatus.IsArchived);
    const base = (defaultChat !== void 0 ? chats.find((c) => c.resource === defaultChat) : void 0) ?? chats.reduce((a, b) => Date.parse(b.modifiedAt) > Date.parse(a.modifiedAt) ? b : a);
    let status = base.status & activityMask;
    let driver = base;
    const errorChat = chats.find((c) => (c.status & SessionStatus.Error) === SessionStatus.Error);
    const inputChat = chats.find((c) => (c.status & SessionStatus.InputNeeded) === SessionStatus.InputNeeded);
    const inProgressChat = chats.find((c) => (c.status & SessionStatus.InputNeeded) === SessionStatus.InProgress);
    if (inputChat) {
      status = SessionStatus.InputNeeded;
      driver = inputChat;
    } else if (errorChat) {
      status = SessionStatus.Error;
      driver = errorChat;
    } else if (inProgressChat) {
      status = SessionStatus.InProgress;
      driver = inProgressChat;
    }
    const modifiedAt = chats.reduce((max, c) => Math.max(max, Date.parse(c.modifiedAt)), 0);
    return { status, activity: driver.activity, modifiedAt };
  }
  /**
   * Combines the chat's activity status bits with the session summary's
   * own metadata flags (IsRead / IsArchived) which live in the high bits
   * of {@link SessionStatus} and are owned by the session, not the chat.
   */
  _mergeSessionStatus(sessionStatus, chatStatus) {
    const metaFlags = sessionStatus & (SessionStatus.IsRead | SessionStatus.IsArchived);
    const activityBits = chatStatus & ~(SessionStatus.IsRead | SessionStatus.IsArchived);
    return activityBits | metaFlags;
  }
  /**
   * Emit a generic progress notification on the root channel, correlated to
   * the originating request by {@link ProgressParams.progressToken}. Routed to
   * clients through the same {@link onDidEmitNotification} path as session
   * notifications, so both the local (IPC proxy) and remote (WebSocket
   * {@link ProtocolServerHandler}) renderers receive it without any
   * transport-specific special casing. Progress for host-level work (e.g. a
   * shared SDK download) rides the root channel rather than a per-session one.
   */
  emitProgress(progress) {
    this._onDidEmitNotification.fire({
      type: "root/progress",
      channel: ROOT_STATE_URI,
      ...progress
    });
  }
  /**
   * Emit an `auth/required` notification on the root channel, asking the
   * client to obtain a fresh token and push it via `authenticate`. Rides the
   * same {@link onDidEmitNotification} path as {@link emitProgress}, so both
   * local (IPC proxy) and remote (WebSocket) renderers receive it. Used for
   * host-level auth requirements (e.g. an agent whose transport flip makes a
   * credential newly required) rather than a per-session one.
   */
  emitAuthRequired(params) {
    this._onDidEmitNotification.fire({
      type: "auth/required",
      channel: ROOT_STATE_URI,
      ...params
    });
  }
  dispose() {
    for (const entry of this._chatEntries.values()) {
      entry.valid = false;
    }
    this._chatEntries.clear();
    super.dispose();
  }
};
AgentHostStateManager = __decorateClass([
  __decorateParam(0, ILogService)
], AgentHostStateManager);
function resolveChatStateForUri(stateManager, chatUri) {
  const peerState = stateManager.getChatState(chatUri);
  if (peerState) {
    return peerState;
  }
  if (!isAhpChatChannel(chatUri)) {
    return stateManager.getDefaultChatState(chatUri);
  }
  if (isDefaultChatUri(chatUri)) {
    return stateManager.getDefaultChatState(parseRequiredSessionUriFromChatUri(chatUri));
  }
  return void 0;
}
export {
  AgentHostStateManager,
  IAgentHostStateManager,
  resolveChatStateForUri
};
