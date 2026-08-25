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
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { localize } from "../../../../nls.js";
import { ChatInteractivity, ChatOriginKind, SessionStatus } from "../common/session.js";
import { inheritableSessionTarget, ISessionsManagementService } from "../common/sessionsManagement.js";
import { ISessionsProvidersService } from "./sessionsProvidersService.js";
import { SessionsNavigation } from "./sessionNavigation.js";
import { SessionsRecencyHistory } from "./sessionsRecencyHistory.js";
import { VisibleSessions } from "./visibleSessions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ISessionsPartService } from "./sessionsPartService.js";
import { ICustomViewService } from "../../customView/browser/customViewService.js";
import { IsNewChatSessionContext } from "../../../common/contextkeys.js";
import { setActiveSessionContextKeys } from "../common/sessionContextKeys.js";
const ACTIVE_SESSION_STATES_KEY = "agentSessions.activeSessionStates";
const RESTORE_SESSION_WAIT_TIMEOUT = 3e4;
const MAX_RECENTLY_OPENED_SESSIONS = 10;
const ISessionsService = createDecorator("sessionsService");
let SessionsService = class extends Disposable {
  constructor(storageService, logService, uriIdentityService, contextKeyService, sessionsManagementService, sessionsProvidersService, sessionsPartService, customViewService, instantiationService, workspaceTrustRequestService) {
    super();
    this.storageService = storageService;
    this.logService = logService;
    this.uriIdentityService = uriIdentityService;
    this.contextKeyService = contextKeyService;
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.sessionsPartService = sessionsPartService;
    this.customViewService = customViewService;
    this.instantiationService = instantiationService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this._onDidToggleSessionStickiness = this._register(new Emitter());
    this.onDidToggleSessionStickiness = this._onDidToggleSessionStickiness.event;
    this._initialRestoreComplete = observableValue(this, false);
    this.initialRestoreComplete = this._initialRestoreComplete;
    /** Cancelled on every navigation action so in-flight async opens bail out. */
    this._openSessionCts = this._register(new MutableDisposable());
    /**
     * Cancellation for the in-flight {@link restoreVisibleSessions}. Kept
     * separate from {@link _openSessionCts} so that additive new-session
     * operations (the new-chat composer eagerly creating a draft on startup)
     * do not abort restoring the previously visible grid. Only an explicit
     * navigation to a specific session cancels a restore.
     */
    this._restoreCts = this._register(new MutableDisposable());
    /** The in-flight foreground send's "keep newest chat active" follow. */
    this._sendFollow = this._register(new MutableDisposable());
    this._sessionStates = this._loadSessionStates();
    this._visibility = this._register(this.instantiationService.createInstance(
      VisibleSessions,
      (session) => this._restoreInitialChat(session),
      (session) => this._restoreClosedChats(session)
    ));
    this.visibleSessions = this._visibility.visibleSessions;
    this.activeSession = this._visibility.activeSession;
    this._isNewChatSessionContext = IsNewChatSessionContext.bindTo(this.contextKeyService);
    this._register(this.storageService.onWillSaveState(() => this._saveSessionStates()));
    this._recencyHistory = this._register(new SessionsRecencyHistory(
      this.storageService,
      this.logService
    ));
    this._navigation = this._register(new SessionsNavigation(
      this,
      this.activeSession,
      this.sessionsManagementService,
      this._recencyHistory,
      this.contextKeyService,
      this.logService
    ));
    this._register(this.sessionsManagementService.onDidChangeSessions((e) => this._navigation.onDidRemoveSessions(e)));
    this._register(this.sessionsManagementService.onDidDeleteSession((session) => this._recencyHistory.remove((entry) => entry.sessionResource.toString() === session.resource.toString())));
    this._register(autorun((reader) => {
      const activeSession = this.activeSession.read(reader);
      const newSession = this.sessionsManagementService.newSession.read(reader);
      this._isNewChatSessionContext.set(activeSession === void 0 || activeSession.sessionId === newSession?.sessionId);
      setActiveSessionContextKeys(activeSession, this.contextKeyService, reader);
    }));
    this._register(autorun((reader) => {
      const activeSession = this.activeSession.read(reader);
      if (activeSession) {
        reader.store.add(this._activeSessionViewListeners(activeSession));
      }
    }));
    this._register(autorun((reader) => {
      const activeSession = this.activeSession.read(reader);
      if (activeSession && !activeSession.isRead.read(reader)) {
        this.sessionsManagementService.markRead(activeSession);
      }
    }));
    this._register(this.sessionsManagementService.onDidChangeSessions((e) => this._onDidChangeSessions(e)));
    this._register(this.sessionsManagementService.onDidReplaceSession(({ from, to }) => this._onDidReplaceSession(from, to)));
    this._register(this.sessionsManagementService.onWillSendRequest((session) => this._startSendFollow(session)));
    this._register(this.sessionsManagementService.onDidSendRequest(() => this._sendFollow.clear()));
    this._register(autorun((reader) => {
      const visible = this.visibleSessions.read(reader);
      const active = this._visibility.activeSession.read(reader);
      const preserveFocus = this._visibility.activePreserveFocus.read(reader);
      this.sessionsPartService.updateVisibleSessions(visible, active);
      const activeId = active?.sessionId;
      if (activeId !== this._focusedActiveSessionId) {
        this._focusedActiveSessionId = activeId;
        if (!preserveFocus) {
          this.sessionsPartService.focusSession(active);
        }
      }
    }));
    this._register(this.sessionsPartService.onDidFocusSession((sessionId) => {
      const session = this.visibleSessions.get().find((s) => s?.sessionId === sessionId);
      if (session) {
        this.setActive(session);
      }
    }));
  }
  _onDidReplaceSession(from, to) {
    this._visibility.updateSession(from, to);
  }
  _activeSessionViewListeners(activeSession) {
    const disposables = new DisposableStore();
    let wasArchived = activeSession.isArchived.get();
    disposables.add(autorun((reader) => {
      const isArchived = activeSession.isArchived.read(reader);
      if (isArchived && !wasArchived) {
        if (activeSession.isQuickChat?.read(void 0)) {
          this.openQuickChat();
        } else {
          const folderUri = activeSession.workspace.read(void 0)?.folders[0]?.root;
          this.openNewSession(folderUri ? { folderUri, ...inheritableSessionTarget(this.sessionsManagementService, activeSession, folderUri) } : void 0);
        }
      }
      wasArchived = isArchived;
    }));
    if (activeSession.status.get() !== SessionStatus.Untitled) {
      disposables.add(autorun((reader) => {
        const chats = activeSession.chats.read(reader);
        const activeChat = activeSession.activeChat.read(reader);
        if (activeChat && !chats.some((c) => this.uriIdentityService.extUri.isEqual(c.resource, activeChat.resource))) {
          const visible = chats.filter((c) => c.interactivity.read(reader) !== ChatInteractivity.Hidden);
          const fallback = visible[visible.length - 1] ?? activeSession.mainChat.read(reader);
          if (fallback) {
            this.openChat(activeSession, fallback.resource);
          }
        }
      }));
    }
    disposables.add(autorun((reader) => {
      const chat = activeSession.activeChat.read(reader);
      if (chat && chat.status.read(void 0) !== SessionStatus.Untitled) {
        const existing = this._sessionStates.get(activeSession.resource);
        this._sessionStates.set(activeSession.resource, {
          ...existing,
          sessionResource: activeSession.resource.toString(),
          activeChatResource: chat.resource.toString()
        });
      }
    }));
    return disposables;
  }
  _onDidChangeSessions(e) {
    const currentActive = this._visibility.activeSession.get();
    if (e.removed.length) {
      for (const session of e.removed) {
        this._sessionStates.delete(session.resource);
      }
      this._visibility.removeMany(e.removed.map((r) => r.sessionId));
    }
    if (!currentActive) {
      return;
    }
    if (e.removed.length && e.removed.some((r) => r.sessionId === currentActive.sessionId)) {
      const fallback = this._visibility.activeSession.get();
      if (fallback && this.sessionsManagementService.getSession(fallback.resource)) {
        this.openSession(fallback.resource);
      } else {
        this.openNewSession();
      }
    }
  }
  _startSendFollow(session) {
    const store = new DisposableStore();
    let followId = session.sessionId;
    store.add(this.sessionsManagementService.onDidReplaceSession(({ from, to }) => {
      if (from.sessionId === followId) {
        followId = to.sessionId;
      }
    }));
    store.add(autorun((reader) => {
      const active = this._visibility.activeSession.read(reader);
      if (active && active.sessionId === followId) {
        const chats = active.visibleChatTabs.read(reader);
        const lastChat = chats[chats.length - 1];
        if (lastChat) {
          this._visibility.setActiveChat(active, lastChat);
        }
      }
    }));
    this._sendFollow.value = store;
  }
  getRecentlyOpenedSessions() {
    const seen = /* @__PURE__ */ new Set();
    const recent = [];
    for (const entry of this._recencyHistory.entries) {
      if (recent.length >= MAX_RECENTLY_OPENED_SESSIONS) {
        break;
      }
      const key = entry.sessionResource.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const session = this.sessionsManagementService.getSession(entry.sessionResource);
      if (session) {
        recent.push(session);
      }
    }
    const other = this.sessionsManagementService.getSessions().filter((s) => !seen.has(s.resource.toString())).sort((a, b) => b.updatedAt.get().getTime() - a.updatedAt.get().getTime());
    return { recent, other };
  }
  /**
   * Cancel any in-flight open-session/restore and return a fresh cancellation token.
   */
  _startOpenSession() {
    this.customViewService.hideCustomView();
    this._openSessionCts.value?.cancel();
    const cts = new CancellationTokenSource();
    this._openSessionCts.value = cts;
    return cts.token;
  }
  /**
   * Cancel an in-flight {@link restoreVisibleSessions}. Called when the user
   * explicitly navigates to a specific session, so restore stops fighting
   * the user's choice. Additive new-session operations do NOT call this.
   */
  _cancelRestore() {
    this._restoreCts.value?.cancel();
    this._restoreCts.clear();
  }
  /**
   * Make the given session active in the visibility model, optionally without
   * moving focus into it. The preserve-focus intent is published atomically
   * with the active session by the visibility model, and the model's
   * canonical active session is updated reactively by the mirror autorun.
   */
  _activate(session, preserveFocus) {
    return this._visibility.setActive(session, preserveFocus);
  }
  async openChat(session, chatUri) {
    const t0 = Date.now();
    this._cancelRestore();
    const token = this._startOpenSession();
    this.logService.trace(`[SessionsView] openChat start uri=${chatUri.toString()} provider=${session.providerId}`);
    this._activate(session);
    if (!await this._waitForSessionToLoad(session, token)) {
      this.logService.trace(`[SessionsView] openChat cancelled while waiting for session to load uri=${chatUri.toString()}`);
      return;
    }
    let chat;
    const activeSession = this._visibility.activeSession.get();
    if (activeSession) {
      chat = activeSession.chats.get().find((c) => this.uriIdentityService.extUri.isEqual(c.resource, chatUri));
      if (chat) {
        this._visibility.openChat(session, chat);
        this._visibility.setActiveChat(session, chat);
        this._setChatClosedState(session, chat, false);
      }
    }
    if (chat && chat.status.get() === SessionStatus.Untitled) {
      this.logService.trace(`[SessionsView] openChat done total=${Date.now() - t0}ms uri=${chatUri.toString()} path=untitled`);
      return;
    }
    this.logService.trace(`[SessionsView] openChat done total=${Date.now() - t0}ms uri=${chatUri.toString()}`);
  }
  async closeChat(session, chat) {
    this._visibility.closeChat(session, chat);
    this._setChatClosedState(session, chat, true);
  }
  /**
   * Persist a chat's closed/open state into the session's stored view state so
   * it survives switching the session out of the grid (which disposes its
   * wrapper) and reloads. Done synchronously on the close/open action rather
   * than reactively from `closedChats`, which would depend on the session's
   * chats being loaded. The main chat can never be closed and is ignored.
   */
  _setChatClosedState(session, chat, closed) {
    if (this.uriIdentityService.extUri.isEqual(chat.resource, session.mainChat.get().resource)) {
      return;
    }
    if (chat.origin?.kind === ChatOriginKind.Tool) {
      return;
    }
    const existing = this._sessionStates.get(session.resource);
    const closedSet = new Set(existing?.closedChatResources ?? []);
    const chatResource = chat.resource.toString();
    if (closed) {
      closedSet.add(chatResource);
    } else if (!closedSet.delete(chatResource)) {
      return;
    }
    this._sessionStates.set(session.resource, {
      ...existing,
      sessionResource: session.resource.toString(),
      closedChatResources: [...closedSet]
    });
  }
  async openSession(sessionResource, options) {
    this._cancelRestore();
    const token = this._startOpenSession();
    await this._doOpenSession(sessionResource, token, options);
  }
  async _doOpenSession(sessionResource, token, options) {
    const t0 = Date.now();
    const sessionData = this.sessionsManagementService.getSession(sessionResource);
    if (!sessionData) {
      this.logService.warn(`[SessionsView] openSession: session not found uri=${sessionResource.toString()}`);
      throw new Error(`Session with resource ${sessionResource.toString()} not found`);
    }
    this.logService.trace(`[SessionsView] openSession start uri=${sessionResource.toString()} provider=${sessionData.providerId}`);
    this._activate(sessionData, options?.preserveFocus);
    if (!await this._waitForSessionToLoad(sessionData, token)) {
      this.logService.trace(`[SessionsView] openSession cancelled while waiting for session to load uri=${sessionResource.toString()}`);
      return;
    }
    this.logService.trace(`[SessionsView] openSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()}`);
  }
  unsetNewSession() {
    this.sessionsManagementService.discardNewSession();
    this._activate(void 0);
  }
  async openNewSession(options, token = CancellationToken.None) {
    const folderUri = options?.folderUri;
    if (folderUri) {
      const resolved = this.sessionsManagementService.resolveWorkspace(folderUri, options?.providerId);
      if (resolved?.workspace.requiresWorkspaceTrust) {
        const trusted = await this.workspaceTrustRequestService.requestResourcesTrust({
          uri: folderUri,
          message: localize("sessionsService.trustFolderMessage", "An agent session will be able to read files, run commands, and make changes in this folder.")
        });
        if (token.isCancellationRequested) {
          return { session: void 0, trustDeclined: false };
        }
        if (!trusted) {
          return { session: void 0, trustDeclined: true };
        }
      }
      if (token.isCancellationRequested) {
        return { session: void 0, trustDeclined: false };
      }
      this._startOpenSession();
      try {
        const session = this.sessionsManagementService.createNewSession(folderUri, options);
        this._activate(session);
        return { session, trustDeclined: false };
      } catch (e) {
        this.logService.trace(`[SessionsView] openNewSession: createNewSession failed for folder ${folderUri.toString()}, falling back to composer view`);
      }
    }
    if (this._visibility.activeSession.get() === void 0) {
      return { session: void 0, trustDeclined: false };
    }
    if (!folderUri) {
      this._startOpenSession();
    }
    const newSession = this.sessionsManagementService.newSession.get();
    if (newSession?.isQuickChat?.get()) {
      this.sessionsManagementService.discardNewSession(newSession);
      this._activate(void 0);
      return { session: void 0, trustDeclined: false };
    }
    this._activate(newSession ?? void 0);
    return { session: newSession ?? void 0, trustDeclined: false };
  }
  openQuickChat(options) {
    this._startOpenSession();
    try {
      const session = this.sessionsManagementService.createQuickChat(options);
      return this._activate(session);
    } catch (e) {
      this.logService.trace(`[SessionsView] openQuickChat: createQuickChat failed: ${e}`);
      return void 0;
    }
  }
  async openNewChatInSession(session, options) {
    this._cancelRestore();
    this._startOpenSession();
    const chat = await this.sessionsManagementService.createNewChatInSession(session, options);
    if (!chat) {
      return;
    }
    this._activate(session);
    this._visibility.setActiveChat(session, chat);
  }
  setActive(session) {
    this._activate(session);
  }
  async submitNewSessionInput() {
    let activeSession = this.activeSession.get();
    if (activeSession?.isCreated.get()) {
      return false;
    }
    if (!this.sessionsPartService.getSessionView(activeSession?.sessionId)) {
      await this.openNewSession();
      activeSession = this.activeSession.get();
      if (activeSession?.isCreated.get()) {
        return false;
      }
    }
    return this.sessionsPartService.getSessionView(activeSession?.sessionId)?.submitInput() ?? false;
  }
  toggleSessionStickiness(session) {
    const sticky = this._visibility.toggleStickiness(session);
    this._onDidToggleSessionStickiness.fire({ session, sticky });
  }
  insertAt(session, targetSessionId, side, activate = true) {
    this._visibility.insertAt(session, targetSessionId, side, activate);
  }
  closeSession(session) {
    const sessionId = session?.sessionId;
    const visible = this._visibility.visibleSessions.get();
    if (!visible.some((s) => s?.sessionId === sessionId)) {
      return;
    }
    const activeSessionId = this._visibility.activeSession.get()?.sessionId;
    const wasActive = activeSessionId === sessionId;
    this.sessionsManagementService.discardNewSession(session);
    this._visibility.removeMany([sessionId]);
    if (!wasActive) {
      return;
    }
    const fallback = this._visibility.activeSession.get();
    if (fallback === void 0) {
      this.openNewSession();
    }
  }
  closeAllSessions() {
    const ids = this._visibility.visibleSessions.get().filter((s) => !!s).map((s) => s.sessionId);
    if (ids.length === 0) {
      return;
    }
    this.sessionsManagementService.discardNewSession();
    this._visibility.removeMany(ids);
  }
  _restoreInitialChat(session) {
    const chats = session.chats.get();
    let initialChat = chats[0];
    const sessionState = this._sessionStates.get(session.resource);
    if (sessionState?.activeChatResource) {
      try {
        const lastChatResource = URI.parse(sessionState.activeChatResource);
        const found = chats.find((c) => this.uriIdentityService.extUri.isEqual(c.resource, lastChatResource));
        if (found) {
          initialChat = found;
        }
      } catch (error) {
        this.logService.warn("[SessionsView] Failed to restore active chat from stored session state", error);
      }
    }
    return initialChat;
  }
  /**
   * The resource strings of chats that were closed (hidden from the tab strip)
   * when the session was last saved, so they stay hidden across reloads. Stale
   * URIs that no longer match a chat are harmless: the visible session
   * intersects them with the live chat list.
   */
  _restoreClosedChats(session) {
    return this._sessionStates.get(session.resource)?.closedChatResources ?? [];
  }
  async _waitForSessionToLoad(session, token) {
    if (!session.loading.get()) {
      return true;
    }
    if (token.isCancellationRequested) {
      return false;
    }
    await new Promise((resolve) => {
      const disposables = new DisposableStore();
      let resolved = false;
      const finish = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        disposables.dispose();
        resolve();
      };
      disposables.add(token.onCancellationRequested(finish));
      disposables.add(autorun((reader) => {
        if (!session.loading.read(reader)) {
          finish();
        }
      }));
    });
    return !token.isCancellationRequested;
  }
  _loadSessionStates() {
    const map = new ResourceMap();
    const raw = this.storageService.get(ACTIVE_SESSION_STATES_KEY, StorageScope.WORKSPACE);
    if (!raw) {
      return map;
    }
    try {
      const entries = JSON.parse(raw);
      for (const entry of entries) {
        const uri = URI.parse(entry.sessionResource);
        map.set(uri, entry);
      }
    } catch {
    }
    return map;
  }
  _saveSessionStates() {
    const entries = this._snapshotVisibleSessionStates();
    const visible = new ResourceMap();
    for (const entry of entries) {
      visible.set(URI.parse(entry.sessionResource), true);
    }
    for (const [resource, state] of this._sessionStates) {
      if (visible.has(resource)) {
        continue;
      }
      entries.push({
        sessionResource: state.sessionResource,
        activeChatResource: state.activeChatResource,
        closedChatResources: state.closedChatResources
      });
    }
    this.storageService.store(ACTIVE_SESSION_STATES_KEY, JSON.stringify(entries), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  _snapshotVisibleSessionStates() {
    const activeId = this._visibility.activeSession.get()?.sessionId;
    const visible = this._visibility.visibleSessions.get();
    const entries = [];
    visible.forEach((session, index) => {
      if (!session) {
        return;
      }
      if (session.status.get() === SessionStatus.Untitled) {
        this._sessionStates.delete(session.resource);
        return;
      }
      const existing = this._sessionStates.get(session.resource);
      const state = {
        sessionResource: session.resource.toString(),
        activeChatResource: session.activeChat.get()?.resource.toString() ?? existing?.activeChatResource,
        closedChatResources: existing?.closedChatResources ?? session.closedChats.get().map((c) => c.resource.toString()),
        visibleOrder: index,
        isSticky: session.sticky.get(),
        isActive: session.sessionId === activeId
      };
      this._sessionStates.set(session.resource, state);
      entries.push(state);
    });
    return entries;
  }
  /**
   * The persisted visible sessions, ordered left-to-right by their stored
   * grid position.
   */
  _getVisibleSessionStates() {
    const states = [];
    for (const [, state] of this._sessionStates) {
      if (state.visibleOrder !== void 0) {
        states.push(state);
      }
    }
    return states.sort((a, b) => a.visibleOrder - b.visibleOrder);
  }
  /**
   * Wait for the session with the given resource to become available via its
   * provider, resolving with the session or `undefined` if the token is
   * cancelled before it appears. When `timeout` is given, resolves with
   * `undefined` after that many milliseconds so a persisted session that never
   * resurfaces (e.g. deleted while the window was closed) cannot keep restore
   * pending — and its provider listeners alive — indefinitely.
   */
  _waitForSession(sessionResource, token, timeout) {
    const existing = this.sessionsManagementService.getSession(sessionResource);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise((resolve) => {
      const disposables = new DisposableStore();
      let resolved = false;
      const finish = (session) => {
        if (resolved) {
          return;
        }
        resolved = true;
        disposables.dispose();
        resolve(session);
      };
      disposables.add(token.onCancellationRequested(() => finish(void 0)));
      const tryFind = () => {
        if (token.isCancellationRequested) {
          finish(void 0);
          return;
        }
        const session = this.sessionsManagementService.getSession(sessionResource);
        if (session) {
          finish(session);
        }
      };
      disposables.add(this.sessionsProvidersService.onDidChangeProviders(() => tryFind()));
      disposables.add(this.sessionsManagementService.onDidChangeSessions(() => tryFind()));
      if (timeout !== void 0) {
        disposables.add(disposableTimeout(() => finish(void 0), timeout));
      }
      tryFind();
    });
  }
  async restoreVisibleSessions() {
    try {
      await this._restoreVisibleSessions();
    } finally {
      this._initialRestoreComplete.set(true, void 0);
    }
  }
  async _restoreVisibleSessions() {
    const targets = this._getVisibleSessionStates().map((state) => ({
      resource: URI.parse(state.sessionResource),
      isSticky: !!state.isSticky,
      isActive: !!state.isActive,
      order: state.visibleOrder
    }));
    if (targets.length === 0) {
      targets.push({ resource: void 0, isSticky: false, isActive: true, order: 1 });
    }
    targets.sort((a, b) => a.order - b.order);
    let activeIdx = targets.findIndex((t) => t.isActive);
    if (activeIdx < 0) {
      activeIdx = 0;
    }
    const cts = new CancellationTokenSource();
    this._restoreCts.value = cts;
    const token = cts.token;
    const resolved = new Array(targets.length).fill(void 0);
    const place = (idx, session) => {
      let anchor;
      for (let j = idx - 1; j >= 0 && !anchor; j--) {
        const neighbour = resolved[j];
        if (neighbour !== void 0) {
          anchor = { id: neighbour?.sessionId, side: "right" };
        }
      }
      for (let j = idx + 1; j < targets.length && !anchor; j++) {
        const neighbour = resolved[j];
        if (neighbour !== void 0) {
          anchor = { id: neighbour?.sessionId, side: "left" };
        }
      }
      resolved[idx] = session;
      if (anchor) {
        this._visibility.insertAt(session, anchor.id, anchor.side, false);
      } else {
        this._activate(session);
      }
      if (targets[idx].isSticky) {
        this._visibility.toggleStickiness(session);
      }
    };
    const activeTarget = targets[activeIdx];
    const activeSessionPromise = activeTarget.resource ? this._waitForSession(activeTarget.resource, token, RESTORE_SESSION_WAIT_TIMEOUT).then((session) => session ?? void 0) : Promise.resolve(void 0);
    const activeSession = await activeSessionPromise;
    if (token.isCancellationRequested) {
      return;
    }
    const slots = [];
    let activeSlotIndex = -1;
    for (let idx = 0; idx < targets.length; idx++) {
      const target = targets[idx];
      let session;
      if (!target.resource) {
        session = null;
      } else if (idx === activeIdx) {
        session = activeSession;
      } else {
        session = this.sessionsManagementService.getSession(target.resource);
      }
      if (session === void 0) {
        continue;
      }
      resolved[idx] = session;
      if (idx === activeIdx) {
        activeSlotIndex = slots.length;
      }
      slots.push({ session: session ?? void 0, sticky: target.isSticky });
    }
    this._visibility.restoreGrid(slots, activeSlotIndex);
    if (token.isCancellationRequested) {
      return;
    }
    await Promise.all(targets.map(async (target, idx) => {
      if (idx === activeIdx || !target.resource || token.isCancellationRequested || resolved[idx] !== void 0) {
        return;
      }
      const session = await this._waitForSession(target.resource, token, RESTORE_SESSION_WAIT_TIMEOUT);
      if (!session || token.isCancellationRequested || resolved[idx] !== void 0) {
        return;
      }
      place(idx, session);
    }));
  }
  // -- Session Navigation --
  async openPreviousSession() {
    await this._navigation.goBack();
  }
  async openNextSession() {
    await this._navigation.goForward();
  }
};
SessionsService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ISessionsManagementService),
  __decorateParam(5, ISessionsProvidersService),
  __decorateParam(6, ISessionsPartService),
  __decorateParam(7, ICustomViewService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IWorkspaceTrustRequestService)
], SessionsService);
registerSingleton(ISessionsService, SessionsService, InstantiationType.Eager);
export {
  ISessionsService,
  SessionsService
};
