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
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue, transaction } from "../../../../base/common/observable.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ChatInteractivity, ChatOriginKind, SessionStatus } from "../common/session.js";
class VisibleSession extends Disposable {
  constructor(_session, initialChat, initialClosedChatUris) {
    super();
    this._session = _session;
    this._sticky = observableValue("activeSessionSticky", false);
    this.sticky = this._sticky;
    /** Append-only list tracking close order; last element is the most recently closed. */
    this._closedChatOrder = [];
    this._activeChat = observableValue(`activeChat-${_session.sessionId}`, initialChat);
    this.activeChat = this._activeChat;
    this._activeChatModelId = derived(this, (reader) => this._activeChat.read(reader).modelId.read(reader));
    this._activeChatMode = derived(this, (reader) => this._activeChat.read(reader).mode.read(reader));
    const seed = new Set(initialClosedChatUris);
    seed.delete(_session.mainChat.get().resource.toString());
    const activeUri = initialChat?.resource.toString();
    if (activeUri) {
      seed.delete(activeUri);
    }
    this._closedChatUris = observableValue("closedChatUris", seed);
    const shownSubagents = /* @__PURE__ */ new Set();
    if (initialChat?.origin?.kind === ChatOriginKind.Tool) {
      shownSubagents.add(initialChat.resource.toString());
    }
    this._shownSubagentUris = observableValue("shownSubagentUris", shownSubagents);
    this._isCreated = _session.status.map((status) => status !== SessionStatus.Untitled);
    this.isCreated = this._isCreated;
    this.openChats = derived(this, (reader) => {
      const closed = this._closedChatUris.read(reader);
      const chats = this._session.chats.read(reader);
      return chats.filter((c) => c.interactivity.read(reader) !== ChatInteractivity.Hidden && !closed.has(c.resource.toString()));
    });
    this.closedChats = derived(this, (reader) => {
      const closed = this._closedChatUris.read(reader);
      if (closed.size === 0) {
        return [];
      }
      return this._session.chats.read(reader).filter((c) => closed.has(c.resource.toString()));
    });
    this.visibleChatTabs = derived(this, (reader) => {
      const shownSubagents2 = this._shownSubagentUris.read(reader);
      return this.openChats.read(reader).filter((c) => c.origin?.kind !== ChatOriginKind.Tool || shownSubagents2.has(c.resource.toString()));
    });
    this.shouldShowChatTabs = derived(this, (reader) => {
      return this.visibleChatTabs.read(reader).length > 1;
    });
  }
  setActiveChat(chat) {
    this._activeChat.set(chat, void 0);
  }
  closeChat(chat) {
    const chatUri = chat.resource.toString();
    if (chatUri === this._session.mainChat.get().resource.toString()) {
      return;
    }
    if (chat.origin?.kind === ChatOriginKind.Tool) {
      const shown = this._shownSubagentUris.get();
      if (!shown.has(chatUri)) {
        return;
      }
      const nextShown = new Set(shown);
      nextShown.delete(chatUri);
      transaction((tx) => {
        this._shownSubagentUris.set(nextShown, tx);
        if (this._activeChat.get().resource.toString() === chatUri) {
          this._activeChat.set(this._defaultActiveChat(this._closedChatUris.get(), nextShown), tx);
        }
      });
      return;
    }
    const closed = this._closedChatUris.get();
    if (closed.has(chatUri)) {
      return;
    }
    const next = new Set(closed);
    next.add(chatUri);
    this._closedChatOrder.push(chat);
    transaction((tx) => {
      this._closedChatUris.set(next, tx);
      if (this._activeChat.get().resource.toString() === chatUri) {
        this._activeChat.set(this._defaultActiveChat(next, this._shownSubagentUris.get()), tx);
      }
    });
  }
  openChat(chat) {
    if (chat.origin?.kind === ChatOriginKind.Tool) {
      const shown = this._shownSubagentUris.get();
      if (shown.has(chat.resource.toString())) {
        return;
      }
      const next2 = new Set(shown);
      next2.add(chat.resource.toString());
      this._shownSubagentUris.set(next2, void 0);
      return;
    }
    const closed = this._closedChatUris.get();
    if (!closed.has(chat.resource.toString())) {
      return;
    }
    const next = new Set(closed);
    next.delete(chat.resource.toString());
    this._closedChatUris.set(next, void 0);
    const idx = this._closedChatOrder.findLastIndex((c) => c.resource.toString() === chat.resource.toString());
    if (idx !== -1) {
      this._closedChatOrder.splice(idx, 1);
    }
  }
  /**
   * Pick the active chat to fall back to when the current one is closed: the
   * last chat that would appear as a visible tab given the closed and shown-
   * subagent sets, or the main chat.
   */
  _defaultActiveChat(closed, shownSubagents) {
    const candidates = this._session.chats.get().filter((c) => c.interactivity.get() !== ChatInteractivity.Hidden && !closed.has(c.resource.toString()) && (c.origin?.kind !== ChatOriginKind.Tool || shownSubagents.has(c.resource.toString())));
    return candidates[candidates.length - 1] ?? this._session.mainChat.get();
  }
  get lastClosedChat() {
    const currentChats = this._session.chats.get();
    const closed = this._closedChatUris.get();
    for (let i = this._closedChatOrder.length - 1; i >= 0; i--) {
      const chat = this._closedChatOrder[i];
      const uri = chat.resource.toString();
      if (closed.has(uri) && currentChats.some((c) => c.resource.toString() === uri)) {
        return chat;
      }
    }
    return void 0;
  }
  setSticky(value) {
    this._sticky.set(value, void 0);
  }
  /** Register a disposable that lives as long as this wrapper. */
  addDisposable(disposable) {
    return this._register(disposable);
  }
  get sessionId() {
    return this._session.sessionId;
  }
  get resource() {
    return this._session.resource;
  }
  get providerId() {
    return this._session.providerId;
  }
  get sessionType() {
    return this._session.sessionType;
  }
  get icon() {
    return this._session.icon;
  }
  get createdAt() {
    return this._session.createdAt;
  }
  get workspace() {
    return this._session.workspace;
  }
  get hasGitRepository() {
    return this._session.hasGitRepository;
  }
  get worktreePending() {
    return this._session.worktreePending;
  }
  get isQuickChat() {
    return this._session.isQuickChat;
  }
  get title() {
    return this._session.title;
  }
  get updatedAt() {
    return this._session.updatedAt;
  }
  get status() {
    return this._session.status;
  }
  get changesSummary() {
    return this._session.changesSummary;
  }
  get changesets() {
    return this._session.changesets;
  }
  get changes() {
    return this._session.changes;
  }
  get externalChanges() {
    return this._session.externalChanges;
  }
  get modelId() {
    return this._activeChatModelId;
  }
  get mode() {
    return this._activeChatMode;
  }
  get loading() {
    return this._session.loading;
  }
  get isArchived() {
    return this._session.isArchived;
  }
  get isRead() {
    return this._session.isRead;
  }
  get description() {
    return this._session.description;
  }
  get lastTurnEnd() {
    return this._session.lastTurnEnd;
  }
  get chats() {
    return this._session.chats;
  }
  get mainChat() {
    return this._session.mainChat;
  }
  get capabilities() {
    return this._session.capabilities;
  }
}
class ResourceOverrideSession {
  constructor(_session, resource) {
    this._session = _session;
    this.resource = resource;
  }
  get sessionId() {
    return this._session.sessionId;
  }
  get providerId() {
    return this._session.providerId;
  }
  get sessionType() {
    return this._session.sessionType;
  }
  get icon() {
    return this._session.icon;
  }
  get createdAt() {
    return this._session.createdAt;
  }
  get workspace() {
    return this._session.workspace;
  }
  get hasGitRepository() {
    return this._session.hasGitRepository;
  }
  get worktreePending() {
    return this._session.worktreePending;
  }
  get isQuickChat() {
    return this._session.isQuickChat;
  }
  get title() {
    return this._session.title;
  }
  get updatedAt() {
    return this._session.updatedAt;
  }
  get status() {
    return this._session.status;
  }
  get changesSummary() {
    return this._session.changesSummary;
  }
  get changes() {
    return this._session.changes;
  }
  get changesets() {
    return this._session.changesets;
  }
  get externalChanges() {
    return this._session.externalChanges;
  }
  get modelId() {
    return this._session.modelId;
  }
  get mode() {
    return this._session.mode;
  }
  get loading() {
    return this._session.loading;
  }
  get isArchived() {
    return this._session.isArchived;
  }
  get isRead() {
    return this._session.isRead;
  }
  get description() {
    return this._session.description;
  }
  get lastTurnEnd() {
    return this._session.lastTurnEnd;
  }
  get chats() {
    return this._session.chats;
  }
  get mainChat() {
    return this._session.mainChat;
  }
  get capabilities() {
    return this._session.capabilities;
  }
}
const NO_RECENT = /* @__PURE__ */ Symbol("no-recent");
let VisibleSessions = class extends Disposable {
  constructor(_resolveInitialChat, _resolveInitialClosedChats, _uriIdentityService) {
    super();
    this._resolveInitialChat = _resolveInitialChat;
    this._resolveInitialClosedChats = _resolveInitialClosedChats;
    this._uriIdentityService = _uriIdentityService;
    this._activeSession = observableValue(this, void 0);
    this.activeSession = this._activeSession;
    /**
     * Whether the most recent active-session change asked to preserve keyboard
     * focus (i.e. show the session without moving focus into it). Always set in
     * the **same transaction** as {@link _activeSession} via
     * {@link _setActiveSession} so the pair can never go stale, and read
     * reactively by the consumer that drives focus.
     */
    this._activePreserveFocus = observableValue(this, false);
    this.activePreserveFocus = this._activePreserveFocus;
    this._visibleSessions = observableValue(this, [void 0]);
    this.visibleSessions = this._visibleSessions;
    this._wrappers = this._register(new DisposableMap());
    /**
     * Ordered slot ids in the grid (left-to-right). Each entry is either a
     * session id or `undefined` (the empty slot). The invariant is that at
     * most one entry is `undefined` at any time.
     */
    this._visibleList = [];
    /** Subset of {@link _visibleList} the user has marked sticky. */
    this._stickyIds = /* @__PURE__ */ new Set();
    /**
     * Slot id of the most recently opened (or toggled-to-non-sticky) entry in
     * the grid. Used to choose which non-sticky slot to replace when opening a
     * new session while the active one is sticky.
     * - `NO_RECENT` means none is tracked.
     * - `undefined` refers to the empty slot.
     * - A string refers to that session id.
     */
    this._mostRecentNonStickySlot = NO_RECENT;
  }
  /**
   * Set the active session together with its preserve-focus intent in a
   * single transaction. Routing every active-session change through here
   * guarantees the two observables are always consistent and that the intent
   * never goes stale (callers that do not preserve focus pass `false`).
   */
  _setActiveSession(session, preserveFocus, tsx) {
    this._activeSession.set(session, tsx);
    this._activePreserveFocus.set(preserveFocus, tsx);
  }
  /**
   * Set the active session, updating the visibility model accordingly.
   *
   * - Passing `undefined` places (or keeps) the single empty slot in the
   *   grid and makes it active. The empty slot is always non-sticky.
   * - If the session is already in the grid, its slot is preserved and only
   *   the active observable is updated.
   * - Otherwise the session is placed as non-sticky:
   *   - If the active slot is non-sticky, the new one replaces it in
   *     place.
   *   - Else if a non-sticky slot exists, the most-recently opened
   *     non-sticky is replaced.
   *   - Else the session is appended at the end of the grid.
   *
   * Returns the wrapper for the active session, or `undefined` when the
   * active slot is the empty slot.
   */
  setActive(session, preserveFocus = false) {
    const targetId = session?.sessionId;
    const targetHasVisibleSlot = this._visibleList.includes(targetId);
    if (!targetHasVisibleSlot) {
      const activeSlot = this._currentActiveSlot();
      const activeIsNonSticky = activeSlot !== NO_RECENT && !this._isStickySlot(activeSlot);
      let replaceSlot;
      if (activeIsNonSticky) {
        replaceSlot = activeSlot;
      } else if (this._mostRecentNonStickySlot !== NO_RECENT && this._visibleList.includes(this._mostRecentNonStickySlot) && !this._isStickySlot(this._mostRecentNonStickySlot)) {
        replaceSlot = this._mostRecentNonStickySlot;
      } else {
        replaceSlot = this._findLastNonSticky();
      }
      if (replaceSlot !== NO_RECENT) {
        const idx = this._visibleList.indexOf(replaceSlot);
        this._visibleList.splice(idx, 1, targetId);
        if (replaceSlot !== void 0) {
          this._wrappers.deleteAndDispose(replaceSlot);
        }
      } else {
        this._visibleList.push(targetId);
      }
      this._mostRecentNonStickySlot = targetId;
    }
    const visibleSession = session ? this._getOrCreateVisibleSession(session) : void 0;
    transaction((tsx) => {
      this._setActiveSession(visibleSession, preserveFocus, tsx);
      if (!targetHasVisibleSlot) {
        this._refresh(tsx);
      }
    });
    return visibleSession;
  }
  /**
   * Insert (or move) a slot into the grid positioned next to a target
   * session that is already visible. Used by drag-and-drop and by
   * "open at position" entry points.
   *
   * - If the slot is not yet visible, a new non-sticky entry is created
   *   at the computed position. For an `undefined` session (empty slot),
   *   this is a no-op when an empty slot already exists in the grid.
   * - If the slot is already visible, it is moved to the computed
   *   position; its sticky / non-sticky state is preserved.
   *
   * When `activate` is `true` (default), the inserted slot also becomes
   * the active session. When `false`, the active session is left
   * unchanged.
   *
   * `targetSessionId` may be `undefined` to position relative to the empty
   * (new-session) slot. No-op if the target slot is not currently visible.
   */
  insertAt(session, targetSessionId, side, activate = true) {
    const id = session?.sessionId;
    const targetIdx = this._visibleList.indexOf(targetSessionId);
    if (targetIdx < 0) {
      return;
    }
    if (id === void 0 && this._visibleList.includes(void 0)) {
      return;
    }
    let destIdx = side === "left" ? targetIdx : targetIdx + 1;
    const currentIdx = this._visibleList.indexOf(id);
    if (currentIdx >= 0) {
      if (currentIdx !== destIdx && currentIdx + 1 !== destIdx) {
        this._visibleList.splice(currentIdx, 1);
        if (currentIdx < destIdx) {
          destIdx--;
        }
        this._visibleList.splice(destIdx, 0, id);
      }
      if (!this._isStickySlot(id)) {
        this._mostRecentNonStickySlot = id;
      }
    } else {
      if (session) {
        this._getOrCreateVisibleSession(session);
      }
      this._visibleList.splice(destIdx, 0, id);
      this._mostRecentNonStickySlot = id;
    }
    transaction((tsx) => {
      if (activate) {
        const wrapper = id !== void 0 ? this._wrappers.get(id) : void 0;
        this._setActiveSession(wrapper, false, tsx);
      }
      this._refresh(tsx);
    });
  }
  /**
   * Atomically (re)build the entire grid from a persisted snapshot.
   *
   * Slots are given left-to-right; a `session` of `undefined` denotes the
   * empty new-session slot. The whole model — slot order, stickiness and the
   * active slot — is published in a single transaction so restoring multiple
   * sessions does not produce intermediate layouts (which would otherwise
   * cause the grid to visibly flicker as sessions are restored one by one).
   *
   * Any wrappers for sessions no longer present in the snapshot are disposed.
   *
   * @param slots Ordered grid slots to restore.
   * @param activeIndex Index into `slots` of the slot that should be active,
   * or `-1` for none.
   */
  restoreGrid(slots, activeIndex) {
    this._visibleList = [];
    this._stickyIds.clear();
    let activeWrapper;
    let lastNonStickySlot = NO_RECENT;
    for (let i = 0; i < slots.length; i++) {
      const { session, sticky } = slots[i];
      const id = session?.sessionId;
      this._visibleList.push(id);
      if (session) {
        const wrapper = this._getOrCreateVisibleSession(session);
        if (sticky) {
          this._stickyIds.add(session.sessionId);
        }
        if (i === activeIndex) {
          activeWrapper = wrapper;
        }
      }
      if (!this._isStickySlot(id)) {
        lastNonStickySlot = id;
      }
    }
    for (const existingId of [...this._wrappers.keys()]) {
      if (!this._visibleList.includes(existingId)) {
        this._wrappers.deleteAndDispose(existingId);
      }
    }
    const activeId = activeWrapper?.sessionId;
    this._mostRecentNonStickySlot = activeId !== void 0 && !this._isStickySlot(activeId) ? activeId : lastNonStickySlot;
    transaction((tsx) => {
      this._setActiveSession(activeWrapper, false, tsx);
      this._refresh(tsx);
    });
  }
  /**
   * Toggle a session's stickiness in the grid. The session keeps its grid
   * slot when toggled.
   * - If the session is not currently visible, it is appended at the end as
   *   sticky.
   *
   * Returns the session's stickiness state after the toggle.
   */
  toggleStickiness(session) {
    const id = session.sessionId;
    if (!this._visibleList.includes(id)) {
      this._stickyIds.add(id);
      this._getOrCreateVisibleSession(session);
      this._visibleList.push(id);
    } else if (this._stickyIds.has(id)) {
      this._stickyIds.delete(id);
      this._mostRecentNonStickySlot = id;
    } else {
      this._stickyIds.add(id);
      if (this._mostRecentNonStickySlot === id) {
        this._mostRecentNonStickySlot = this._findLastNonSticky();
      }
    }
    this._refresh(void 0);
    return this._stickyIds.has(id);
  }
  /**
   * Remove the given session ids from the visibility model and dispose their
   * wrappers. Passing `undefined` removes the empty (new-session) slot if
   * present. If the active slot is among the removed entries, the active
   * observable falls back to the slot at the active's original position
   * (or the slot to its left if it was at the end of the grid); when no
   * visible slot remains, the active observable is cleared. Observables
   * are refreshed once if anything changed.
   */
  removeMany(sessionIds) {
    transaction((tsx) => {
      let changed = false;
      const activeId = this._activeSession.get()?.sessionId;
      const emptySlotIsActive = activeId === void 0 && this._visibleList.includes(void 0);
      const activeSlotId = emptySlotIsActive ? void 0 : activeId;
      const activeIdx = activeId !== void 0 || emptySlotIsActive ? this._visibleList.indexOf(activeSlotId) : -1;
      let activeRemoved = false;
      for (const id of sessionIds) {
        if (this._removeFromModel(id)) {
          changed = true;
          if (id === void 0 ? emptySlotIsActive : id === activeId) {
            activeRemoved = true;
          }
        }
      }
      if (activeRemoved) {
        if (this._visibleList.length === 0) {
          this._setActiveSession(void 0, false, tsx);
        } else {
          const fallbackIdx = Math.max(0, Math.min(activeIdx - 1, this._visibleList.length - 1));
          const fallbackId = this._visibleList[fallbackIdx];
          const fallbackWrapper = fallbackId !== void 0 ? this._wrappers.get(fallbackId) : void 0;
          this._setActiveSession(fallbackWrapper, false, tsx);
        }
      }
      if (changed) {
        this._refresh(tsx);
      }
    });
  }
  /**
   * Set the active chat for the given session's wrapper. No-op if the
   * session is not currently tracked in the visibility model.
   */
  setActiveChat(session, chat) {
    this._wrappers.get(session.sessionId)?.setActiveChat(chat);
  }
  /**
   * Close (hide from the tab strip) the given chat in the session's wrapper.
   * No-op if the session is not currently tracked in the visibility model.
   */
  closeChat(session, chat) {
    this._wrappers.get(session.sessionId)?.closeChat(chat);
  }
  /**
   * Open (un-hide from the tab strip) a previously closed chat in the session's
   * wrapper. No-op if the session is not currently tracked in the visibility model.
   */
  openChat(session, chat) {
    this._wrappers.get(session.sessionId)?.openChat(chat);
  }
  /**
   * Replace the given session in the visibility model with `updatedSession`,
   * preserving the grid slot, sticky state, and active state. The wrapper
   * for the old session is disposed; a fresh wrapper is created for the
   * updated session. No-op if `session` is not currently in the grid.
   */
  updateSession(session, updatedSession) {
    const fromId = session.sessionId;
    if (!this._visibleList.includes(fromId)) {
      return;
    }
    const wasActive = this._activeSession.get()?.sessionId === fromId;
    this.replaceId(fromId, updatedSession.sessionId);
    if (fromId === updatedSession.sessionId && this._wrappers.has(fromId)) {
      this._wrappers.deleteAndDispose(fromId);
    }
    transaction((tsx) => {
      const visibleSession = this._getOrCreateVisibleSession(updatedSession);
      if (wasActive) {
        this._setActiveSession(visibleSession, false, tsx);
      }
      this._refresh(tsx);
    });
  }
  /**
   * Create a transient {@link ISession} that mirrors the given session but
   * exposes a different {@link ISession.resource}. The visibility model's
   * wrapper for the same session id is rebuilt against this transient
   * session so consumers observe the new resource. Returns the transient
   * session so callers can pass it to a subsequent {@link updateSession}
   * once the provider produces the final session.
   *
   * No-op (but still returns the transient session) if the session is not
   * currently in the grid.
   */
  updateResourceOfSession(session, resource) {
    const tmpSession = new ResourceOverrideSession(session, resource);
    this.updateSession(session, tmpSession);
    return tmpSession;
  }
  /**
   * Rename a session id in the visibility model so the same grid slot is
   * reused for the replacement. The old wrapper is disposed; a fresh one is
   * created lazily on next access. Does not auto-refresh — callers should
   * call {@link refresh} or {@link setActive} as appropriate.
   */
  replaceId(fromId, toId) {
    if (fromId === toId) {
      return;
    }
    const idx = this._visibleList.indexOf(fromId);
    if (idx >= 0) {
      this._visibleList.splice(idx, 1, toId);
    }
    if (this._stickyIds.delete(fromId)) {
      this._stickyIds.add(toId);
    }
    if (this._mostRecentNonStickySlot === fromId) {
      this._mostRecentNonStickySlot = toId;
    }
    if (this._wrappers.has(fromId)) {
      this._wrappers.deleteAndDispose(fromId);
    }
  }
  /** Re-publish the visible sessions and sticky ids observables. */
  refresh() {
    this._refresh(void 0);
  }
  _findLastNonSticky() {
    for (let i = this._visibleList.length - 1; i >= 0; i--) {
      const sid = this._visibleList[i];
      if (!this._isStickySlot(sid)) {
        return sid;
      }
    }
    return NO_RECENT;
  }
  /** True if the given slot id refers to a sticky session. The empty slot is never sticky. */
  _isStickySlot(id) {
    return id !== void 0 && this._stickyIds.has(id);
  }
  /**
   * Returns the slot id of the currently active entry in the grid, or
   * {@link NO_RECENT} if no entry in the grid is active.
   */
  _currentActiveSlot() {
    const activeId = this._activeSession.get()?.sessionId;
    if (activeId !== void 0) {
      return this._visibleList.includes(activeId) ? activeId : NO_RECENT;
    }
    return this._visibleList.includes(void 0) ? void 0 : NO_RECENT;
  }
  _removeFromModel(sessionId) {
    let changed = false;
    const idx = this._visibleList.indexOf(sessionId);
    if (idx >= 0) {
      this._visibleList.splice(idx, 1);
      changed = true;
    }
    if (sessionId !== void 0 && this._stickyIds.delete(sessionId)) {
      changed = true;
    }
    if (this._mostRecentNonStickySlot === sessionId) {
      this._mostRecentNonStickySlot = this._findLastNonSticky();
      changed = true;
    }
    if (sessionId !== void 0 && this._wrappers.has(sessionId)) {
      this._wrappers.deleteAndDispose(sessionId);
      changed = true;
    }
    return changed;
  }
  _refresh(tsx) {
    const wrappers = [];
    for (const id of this._visibleList) {
      if (id === void 0) {
        wrappers.push(void 0);
        continue;
      }
      const visibleSession = this._wrappers.get(id);
      if (visibleSession) {
        visibleSession.setSticky(this._stickyIds.has(id));
        wrappers.push(visibleSession);
      }
    }
    this._visibleSessions.set(wrappers, tsx);
  }
  _getOrCreateVisibleSession(session) {
    let visibleSession = this._wrappers.get(session.sessionId);
    if (visibleSession) {
      return visibleSession;
    }
    const initialChat = this._resolveInitialChat(session);
    visibleSession = new VisibleSession(session, initialChat, this._resolveInitialClosedChats(session));
    const visibleSessionRef = visibleSession;
    visibleSession.addDisposable(autorun((reader) => {
      const chats = session.chats.read(reader);
      const activeChat = visibleSessionRef.activeChat.read(reader);
      if (activeChat && !chats.some((c) => this._uriIdentityService.extUri.isEqual(c.resource, activeChat.resource))) {
        const visibleChatTabs = visibleSessionRef.visibleChatTabs.read(reader);
        const fallback = visibleChatTabs[visibleChatTabs.length - 1] ?? session.mainChat.read(reader);
        if (fallback) {
          visibleSessionRef.setActiveChat(fallback);
        }
      }
    }));
    this._wrappers.set(session.sessionId, visibleSession);
    return visibleSession;
  }
};
VisibleSessions = __decorateClass([
  __decorateParam(2, IUriIdentityService)
], VisibleSessions);
export {
  VisibleSession,
  VisibleSessions
};
