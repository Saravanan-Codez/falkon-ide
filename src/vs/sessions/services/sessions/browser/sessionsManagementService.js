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
import { Emitter } from "../../../../base/common/event.js";
import { raceCancellationError } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { agentHostAuthority } from "../../../../platform/agentHost/common/agentHostUri.js";
import { IRemoteAgentHostService } from "../../../../platform/agentHost/common/remoteAgentHostService.js";
import { IChatService } from "../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { ChatAgentLocation } from "../../../../workbench/contrib/chat/common/constants.js";
import { IChatWidgetHistoryService } from "../../../../workbench/contrib/chat/common/widget/chatWidgetHistoryService.js";
import { buildHostLocalEventsPath, COPILOT_CLI_EH_SCHEME, COPILOT_CLI_LOCAL_AH_SCHEME, getCopilotCliSessionRawId } from "../../../../workbench/contrib/chat/browser/copilotCliEventsUri.js";
import { IPathService } from "../../../../workbench/services/path/common/pathService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { getSessionReferenceResource } from "./sessionReference.js";
import { ISessionsManagementService, WorkspaceNotTrustedError } from "../common/sessionsManagement.js";
import { ISessionsProvidersService } from "./sessionsProvidersService.js";
import { SessionStatus } from "../common/session.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
const LAST_USED_QUICK_CHAT_SESSION_TYPE_STORAGE_KEY = "sessions.quickChat.lastUsedSessionType";
let SessionsManagementService = class extends Disposable {
  constructor(logService, sessionsProvidersService, uriIdentityService, chatService, chatWidgetHistoryService, storageService, pathService, remoteAgentHostService, workspaceTrustManagementService) {
    super();
    this.logService = logService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.uriIdentityService = uriIdentityService;
    this.chatService = chatService;
    this.chatWidgetHistoryService = chatWidgetHistoryService;
    this.storageService = storageService;
    this.pathService = pathService;
    this.remoteAgentHostService = remoteAgentHostService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this._onDidChangeSessions = this._register(new Emitter());
    this.onDidChangeSessions = this._onDidChangeSessions.event;
    this._onDidStartSession = this._register(new Emitter());
    this.onDidStartSession = this._onDidStartSession.event;
    this._onWillSendRequest = this._register(new Emitter());
    this.onWillSendRequest = this._onWillSendRequest.event;
    this._onDidSendRequest = this._register(new Emitter());
    this.onDidSendRequest = this._onDidSendRequest.event;
    this._onDidArchiveSession = this._register(new Emitter());
    this.onDidArchiveSession = this._onDidArchiveSession.event;
    this._onDidUnarchiveSession = this._register(new Emitter());
    this.onDidUnarchiveSession = this._onDidUnarchiveSession.event;
    this._onDidDeleteSession = this._register(new Emitter());
    this.onDidDeleteSession = this._onDidDeleteSession.event;
    this._onDidDeleteChat = this._register(new Emitter());
    this.onDidDeleteChat = this._onDidDeleteChat.event;
    this._onDidRenameChat = this._register(new Emitter());
    this.onDidRenameChat = this._onDidRenameChat.event;
    this._onDidRenameSession = this._register(new Emitter());
    this.onDidRenameSession = this._onDidRenameSession.event;
    this._onDidChangeSessionTypes = this._register(new Emitter());
    this.onDidChangeSessionTypes = this._onDidChangeSessionTypes.event;
    this._onDidReplaceSession = this._register(new Emitter());
    this.onDidReplaceSession = this._onDidReplaceSession.event;
    this._onDidDiscardNewSession = this._register(new Emitter());
    this.onDidDiscardNewSession = this._onDidDiscardNewSession.event;
    this._onDidReplaceNewDraftSession = this._register(new Emitter());
    this.onDidReplaceNewDraftSession = this._onDidReplaceNewDraftSession.event;
    this._sessionTypes = [];
    /** Tracks the in-progress new session (composed but not yet sent). */
    this._newSession = observableValue(this, void 0);
    this.newSession = this._newSession;
    /** Tracks the Automation dialog's in-progress session draft. */
    this._automationSession = observableValue(this, void 0);
    this.automationSession = this._automationSession;
    this._providerListeners = this._register(new DisposableMap());
    this._disposeCts = this._register(new CancellationTokenSource());
    /**
     * Chat resources for which this service has just kicked off a
     * `provider.sendRequest` and will emit `_onDidSendRequest` manually after
     * the provider call resolves. Used to suppress the duplicate event that
     * would otherwise arrive via {@link IChatService.onDidSubmitRequest},
     * which fires synchronously inside the same provider call.
     */
    this._pendingSendChatResources = /* @__PURE__ */ new Set();
    this._register(this.sessionsProvidersService.onDidChangeProviders((e) => {
      this._onProvidersChanged(e);
      this._updateSessionTypes();
    }));
    this._subscribeToProviders(this.sessionsProvidersService.getProviders());
    this._sessionTypes = this._collectSessionTypes();
    this._register(this.chatService.onDidSubmitRequest(({ chatSessionResource, message }) => {
      if (this._pendingSendChatResources.has(chatSessionResource.toString())) {
        return;
      }
      const ownedChat = this.getSessionForChatResource(chatSessionResource);
      if (ownedChat) {
        this._onDidSendRequest.fire({
          session: ownedChat.session,
          chat: ownedChat.chat,
          isNewSession: false,
          isNewChat: false,
          options: { query: message?.text ?? "" }
        });
      }
    }));
  }
  _onProvidersChanged(e) {
    for (const provider of e.removed) {
      this._providerListeners.deleteAndDispose(provider.id);
    }
    if (e.added.length) {
      this._subscribeToProviders(e.added);
    }
  }
  _subscribeToProviders(providers) {
    for (const provider of providers) {
      const disposables = new DisposableStore();
      disposables.add(provider.onDidChangeSessions((e) => this.onDidChangeSessionsFromSessionsProviders(e)));
      if (provider.onDidReplaceSession) {
        disposables.add(provider.onDidReplaceSession((e) => this._handleDidReplaceSession(e.from, e.to)));
      }
      if (provider.onDidChangeSessionTypes) {
        disposables.add(provider.onDidChangeSessionTypes(() => this._updateSessionTypes()));
      }
      this._providerListeners.set(provider.id, disposables);
    }
  }
  _handleDidReplaceSession(from, to) {
    this.chatWidgetHistoryService.moveHistory(ChatAgentLocation.Chat, from.sessionId, to.sessionId);
    this._onDidReplaceSession.fire({ from, to });
    this._onDidChangeSessions.fire({
      added: [],
      removed: from.sessionId === to.sessionId ? [] : [from],
      changed: [to]
    });
  }
  onDidChangeSessionsFromSessionsProviders(e) {
    if (e.removed.length) {
      const current = this._newSession.get();
      if (current && e.removed.some((r) => r.sessionId === current.sessionId)) {
        this._newSession.set(void 0, void 0);
      }
      const automationSession = this._automationSession.get();
      if (automationSession && e.removed.some((r) => r.sessionId === automationSession.sessionId)) {
        this._automationSession.set(void 0, void 0);
      }
    }
    this._onDidChangeSessions.fire(e);
  }
  getSessions() {
    return this._dedupeMigratedCopilotCliSessions(this._getMergedSessions());
  }
  _getMergedSessions() {
    const sessions = [];
    for (const provider of this.sessionsProvidersService.getProviders()) {
      sessions.push(...provider.getSessions());
    }
    return sessions;
  }
  /**
   * A legacy Copilot CLI session migrated in place to the agent host is briefly
   * listed by BOTH the extension-host provider (`copilotcli:/<id>`) and the
   * agent-host provider (`agent-host-copilotcli:/<id>`) for the same underlying
   * SDK session id — the workbench agent-session model caches the stale legacy
   * entry even after the extension stops reporting it. Drop the legacy entry so
   * exactly one row shows per session.
   */
  _dedupeMigratedCopilotCliSessions(sessions) {
    let migratedRawIds;
    for (const session of sessions) {
      if (session.resource.scheme === COPILOT_CLI_LOCAL_AH_SCHEME) {
        const rawId = getCopilotCliSessionRawId(session.resource);
        if (rawId) {
          (migratedRawIds ??= /* @__PURE__ */ new Set()).add(rawId);
        }
      }
    }
    if (!migratedRawIds) {
      return sessions;
    }
    const result = sessions.filter((session) => {
      if (session.resource.scheme === COPILOT_CLI_EH_SCHEME) {
        const rawId = getCopilotCliSessionRawId(session.resource);
        if (rawId && migratedRawIds.has(rawId)) {
          return false;
        }
      }
      return true;
    });
    return result;
  }
  getSession(resource) {
    return this._getMergedSessions().find(
      (s) => this.uriIdentityService.extUri.isEqual(s.resource, resource)
    );
  }
  getSessionForChatResource(resource) {
    for (const session of this._getMergedSessions()) {
      const chat = session.chats.get().find((c) => this.uriIdentityService.extUri.isEqual(c.resource, resource));
      if (chat) {
        return { session, chat };
      }
      const mainChat = session.mainChat.get();
      if (this.uriIdentityService.extUri.isEqual(mainChat.resource, resource)) {
        return { session, chat: mainChat };
      }
    }
    return void 0;
  }
  getAllSessionTypes() {
    return [...this._sessionTypes];
  }
  getAllProviderSessionTypes() {
    const result = [];
    for (const provider of this.sessionsProvidersService.getProviders()) {
      for (const sessionType of provider.sessionTypes) {
        result.push({ providerId: provider.id, sessionType });
      }
    }
    return result;
  }
  getSessionTypesForFolder(folderUri) {
    const result = [];
    for (const provider of this.sessionsProvidersService.getProviders()) {
      if (!provider.resolveWorkspace(folderUri)) {
        continue;
      }
      for (const sessionType of provider.getSessionTypes(folderUri)) {
        result.push({ providerId: provider.id, sessionType });
      }
    }
    return result;
  }
  getQuickChatSessionTypes() {
    const result = [];
    for (const provider of this.sessionsProvidersService.getProviders()) {
      if (!provider.supportsQuickChats) {
        continue;
      }
      for (const sessionType of provider.sessionTypes) {
        result.push({ providerId: provider.id, sessionType });
      }
    }
    return result;
  }
  isNewSessionTargetAvailable(folderUri, options) {
    return this._isTargetAvailable(this.getSessionTypesForFolder(folderUri), options);
  }
  isQuickChatTargetAvailable(options) {
    return this._isTargetAvailable(this.getQuickChatSessionTypes(), options);
  }
  _isTargetAvailable(sessionTypes, options) {
    return sessionTypes.some(
      (candidate) => (!options?.providerId || candidate.providerId === options.providerId) && (!options?.sessionTypeId || candidate.sessionType.id === options.sessionTypeId)
    );
  }
  resolveWorkspace(folderUri, preferredProviderId) {
    if (preferredProviderId) {
      const preferred = this.sessionsProvidersService.getProvider(preferredProviderId);
      const workspace = preferred?.resolveWorkspace(folderUri);
      if (workspace) {
        return { providerId: preferredProviderId, workspace };
      }
    }
    for (const provider of this.sessionsProvidersService.getProviders()) {
      const workspace = provider.resolveWorkspace(folderUri);
      if (workspace) {
        return { providerId: provider.id, workspace };
      }
    }
    return void 0;
  }
  _collectSessionTypes() {
    const types = [];
    const seen = /* @__PURE__ */ new Set();
    for (const provider of this.sessionsProvidersService.getProviders()) {
      for (const type of provider.sessionTypes) {
        if (!seen.has(type.id)) {
          seen.add(type.id);
          types.push(type);
        }
      }
    }
    return types;
  }
  _updateSessionTypes() {
    this._sessionTypes = this._collectSessionTypes();
    this._onDidChangeSessionTypes.fire();
  }
  discardNewSession(session) {
    const current = this._newSession.get();
    if (!current) {
      return;
    }
    if (session && session.sessionId !== current.sessionId) {
      return;
    }
    this._newSession.set(void 0, void 0);
    this._getProvider(current)?.deleteNewSession(current.sessionId);
    this._onDidDiscardNewSession.fire(current);
  }
  discardAutomationSession(session) {
    const current = this._automationSession.get();
    if (!current || session && session.sessionId !== current.sessionId) {
      return;
    }
    this._automationSession.set(void 0, void 0);
    this._getProvider(current)?.deleteNewSession(current.sessionId);
  }
  /**
   * Resolve the provider and session type to use for a new session in the
   * given folder. Includes that provider's resolved workspace so headless
   * callers can enforce provider-specific trust without resolving it again.
   */
  _resolveProviderForNewSession(folderUri, options) {
    const providers = this.sessionsProvidersService.getProviders();
    let provider;
    let workspace;
    if (options?.providerId) {
      provider = providers.find((p) => p.id === options.providerId);
      if (!provider) {
        throw new Error(`Sessions provider '${options.providerId}' not found`);
      }
      workspace = provider.resolveWorkspace(folderUri);
      if (!workspace) {
        throw new Error(`Sessions provider '${options.providerId}' cannot resolve folder '${folderUri.toString()}'`);
      }
      if (options.sessionTypeId && !provider.getSessionTypes(folderUri).some((type) => type.id === options.sessionTypeId)) {
        throw new Error(`Sessions provider '${options.providerId}' does not advertise session type '${options.sessionTypeId}'`);
      }
    } else {
      for (const candidate of providers) {
        const candidateWorkspace = candidate.resolveWorkspace(folderUri);
        if (!candidateWorkspace) {
          continue;
        }
        if (options?.sessionTypeId && !candidate.getSessionTypes(folderUri).some((t) => t.id === options.sessionTypeId)) {
          continue;
        }
        provider = candidate;
        workspace = candidateWorkspace;
        break;
      }
      if (!provider || !workspace) {
        throw new Error(`No sessions provider can resolve folder '${folderUri.toString()}'`);
      }
    }
    let sessionTypeId = options?.sessionTypeId;
    if (!sessionTypeId) {
      sessionTypeId = provider.getSessionTypes(folderUri)[0]?.id;
      if (!sessionTypeId) {
        throw new Error(`No session types available for provider '${provider.id}'`);
      }
    }
    return { provider, sessionTypeId, workspace };
  }
  createNewSession(folderUri, options) {
    const { provider, sessionTypeId } = this._resolveProviderForNewSession(folderUri, options);
    const previousNewSession = this._newSession.get();
    const session = provider.createNewSession(folderUri, sessionTypeId);
    if (previousNewSession && previousNewSession.sessionId !== session.sessionId) {
      this._getProvider(previousNewSession)?.deleteNewSession(previousNewSession.sessionId);
      this._onDidReplaceNewDraftSession.fire({ from: previousNewSession, to: session });
    }
    this._newSession.set(session, void 0);
    return session;
  }
  createAutomationSession(folderUri, options) {
    const { provider, sessionTypeId } = this._resolveProviderForNewSession(folderUri, options);
    const previousAutomationSession = this._automationSession.get();
    const session = provider.createNewSession(folderUri, sessionTypeId);
    if (previousAutomationSession && previousAutomationSession.sessionId !== session.sessionId) {
      this._getProvider(previousAutomationSession)?.deleteNewSession(previousAutomationSession.sessionId);
    }
    this._automationSession.set(session, void 0);
    return session;
  }
  /**
   * Resolve the provider and session type to use for a quick chat, keyed on
   * {@link ISessionsProvider.supportsQuickChats} instead of `resolveWorkspace`.
   * Honors an explicit `options.sessionTypeId` (validated against the chosen
   * provider) and otherwise defaults to the last-used type, then the first
   * advertised one. Throws when no capable provider/type can be resolved.
   */
  _resolveProviderForQuickChat(options) {
    const providers = this.sessionsProvidersService.getProviders();
    let provider;
    if (options?.providerId) {
      provider = providers.find((p) => p.id === options.providerId);
      if (!provider) {
        throw new Error(`Sessions provider '${options.providerId}' not found`);
      }
      if (!provider.supportsQuickChats) {
        throw new Error(`Sessions provider '${options.providerId}' does not support quick chats`);
      }
      if (options.sessionTypeId && !provider.sessionTypes.some((t) => t.id === options.sessionTypeId)) {
        throw new Error(`Sessions provider '${options.providerId}' does not advertise session type '${options.sessionTypeId}'`);
      }
    } else {
      for (const candidate of providers) {
        if (!candidate.supportsQuickChats) {
          continue;
        }
        if (options?.sessionTypeId && !candidate.sessionTypes.some((t) => t.id === options.sessionTypeId)) {
          continue;
        }
        provider = candidate;
        break;
      }
      if (!provider) {
        throw new Error("No sessions provider supports quick chats");
      }
    }
    const sessionTypeId = options?.sessionTypeId ?? this._defaultQuickChatSessionType(provider);
    if (!sessionTypeId) {
      throw new Error(`No session types available for provider '${provider.id}'`);
    }
    return { provider, sessionTypeId };
  }
  /** Default quick-chat session type: the last-used one if still advertised, else the first. */
  _defaultQuickChatSessionType(provider) {
    const lastUsed = this.storageService.get(LAST_USED_QUICK_CHAT_SESSION_TYPE_STORAGE_KEY, StorageScope.PROFILE);
    if (lastUsed && provider.sessionTypes.some((t) => t.id === lastUsed)) {
      return lastUsed;
    }
    return provider.sessionTypes[0]?.id;
  }
  createQuickChat(options) {
    const { provider, sessionTypeId } = this._resolveProviderForQuickChat(options);
    const previousNewSession = this._newSession.get();
    const session = provider.createQuickChat(sessionTypeId);
    this._newSession.set(session, void 0);
    this.storageService.store(LAST_USED_QUICK_CHAT_SESSION_TYPE_STORAGE_KEY, sessionTypeId, StorageScope.PROFILE, StorageTarget.USER);
    if (previousNewSession && previousNewSession.sessionId !== session.sessionId) {
      this._getProvider(previousNewSession)?.deleteNewSession(previousNewSession.sessionId);
    }
    return session;
  }
  createAutomationQuickChat(options) {
    const { provider, sessionTypeId } = this._resolveProviderForQuickChat(options);
    const previousAutomationSession = this._automationSession.get();
    const session = provider.createQuickChat(sessionTypeId);
    if (previousAutomationSession && previousAutomationSession.sessionId !== session.sessionId) {
      this._getProvider(previousAutomationSession)?.deleteNewSession(previousAutomationSession.sessionId);
    }
    this._automationSession.set(session, void 0);
    return session;
  }
  async createNewChatInSession(session, options) {
    const provider = this._getProvider(session);
    if (!provider) {
      this.logService.warn(`[SessionsManagement] createNewChatInSession: provider '${session.providerId}' not found`);
      return void 0;
    }
    if (!options?.forceNew) {
      const existingUntitled = session.chats.get().find((c) => c.status.get() === SessionStatus.Untitled);
      if (existingUntitled) {
        return existingUntitled;
      }
    }
    const created = await provider.createNewChat(session.sessionId);
    return created;
  }
  async forkChatInSession(session, sourceChat, turnId) {
    const provider = this._getProvider(session);
    if (!provider) {
      throw new Error(`Provider '${session.providerId}' not found for session '${session.sessionId}'`);
    }
    if (!session.capabilities.get().supportsMultipleChats) {
      throw new Error(`Session '${session.sessionId}' does not support forking into a chat`);
    }
    return provider.forkChat(session.sessionId, sourceChat, turnId);
  }
  async createSideChatInSession(session, sourceChat, turnId, selection) {
    const provider = this._getProvider(session);
    if (!provider) {
      throw new Error(`Provider '${session.providerId}' not found for session '${session.sessionId}'`);
    }
    if (!session.capabilities.get().supportsSideChat) {
      throw new Error(`Session '${session.sessionId}' does not support side chats`);
    }
    return provider.createSideChat(session.sessionId, sourceChat, turnId, selection);
  }
  /**
   * For a `/troubleshoot` request, strip any `#session` marker attachments and
   * append a `Session log:` line with the resolved host-local `events.jsonl`
   * path(s) — the referenced sessions if present, otherwise the current one.
   * Returns `options` unchanged when there is nothing to do.
   */
  _augmentOptionsForTroubleshoot(session, options) {
    const referencedResources = [];
    let remainingAttachments;
    if (options.attachedContext?.length) {
      const remaining = [];
      for (const entry of options.attachedContext) {
        const referenced = getSessionReferenceResource(entry);
        if (referenced) {
          referencedResources.push(referenced);
        } else {
          remaining.push(entry);
        }
      }
      if (referencedResources.length) {
        remainingAttachments = remaining;
      }
    }
    const isTroubleshoot = /^\s*\/troubleshoot\b/.test(options.query);
    if (!isTroubleshoot && referencedResources.length === 0) {
      return options;
    }
    let result = options;
    if (remainingAttachments) {
      result = { ...result, attachedContext: remainingAttachments.length ? remainingAttachments : void 0 };
    }
    if (!isTroubleshoot) {
      return result;
    }
    const targets = referencedResources.length ? referencedResources : getCopilotCliSessionRawId(session.resource) ? [session.resource] : [];
    const userHome = this.pathService.userHome({ preferLocal: true });
    const getConnection = (authority) => this.remoteAgentHostService.connections.find((c) => agentHostAuthority(c.address) === authority);
    const eventPaths = Array.from(new Set(
      targets.map((resource) => buildHostLocalEventsPath(resource, userHome, getConnection)).filter((path) => !!path)
    ));
    if (eventPaths.length === 0) {
      return result;
    }
    return { ...result, query: `${result.query}

Session log: ${eventPaths.join(", ")}` };
  }
  async sendNewChatRequest(session, options) {
    this._newSession.set(void 0, void 0);
    const provider = this._getProvider(session);
    if (!provider) {
      throw new Error(`Sessions provider '${session.providerId}' not found`);
    }
    if (options.background) {
      this._sendNewChatRequestInBackground(provider, session, options).catch((e) => {
        provider.deleteNewSession(session.sessionId);
        this.logService.error("[SessionsManagement] Failed to send background request:", e);
      });
      return;
    }
    this._onWillSendRequest.fire(session);
    const chat = await provider.createNewChat(session.sessionId, options.query);
    const sendOptions = this._augmentOptionsForTroubleshoot(session, options);
    const chatResourceKey = chat.resource.toString();
    this._pendingSendChatResources.add(chatResourceKey);
    let updatedSession;
    try {
      updatedSession = await provider.sendRequest(session.sessionId, chat.resource, sendOptions);
    } finally {
      this._pendingSendChatResources.delete(chatResourceKey);
    }
    if (updatedSession.sessionId !== session.sessionId) {
      this.logService.info(`[SessionsManagement] sendRequest: active session replaced: ${session.sessionId} -> ${updatedSession.sessionId}`);
    }
    this._onDidStartSession.fire(updatedSession);
    this._onDidSendRequest.fire({ session: updatedSession, chat, isNewSession: true, isNewChat: true, options });
  }
  /**
   * Create a new session for the given folder and send a chat request to it,
   * without navigating into the started session. The started session appears
   * in the sessions list once the provider commits it, while the user's
   * current view is left untouched. Returns the committed session,
   * or `undefined` if the service was disposed during the send.
   *
   * Unlike {@link sendNewChatRequest} with `background`, this does not go
   * through the new-session composer: it creates a fresh session purely for
   * this request and never sets it as pending/active. Intended for callers
   * outside the composer that want to kick off a session programmatically.
   *
   * If the send or any configuration setter fails, the stranded draft is
   * disposed through its provider and the error is rethrown.
   */
  async createAndSendNewChatRequest(folderUri, options, createOptions, token = CancellationToken.None) {
    const { provider, sessionTypeId, workspace } = this._resolveProviderForNewSession(folderUri, createOptions);
    if (workspace.requiresWorkspaceTrust) {
      const trustInfo = await this.workspaceTrustManagementService.getUriTrustInfo(folderUri);
      if (!trustInfo.trusted) {
        throw new WorkspaceNotTrustedError();
      }
    }
    const session = provider.createNewSession(folderUri, sessionTypeId);
    const supportsWorktreeConfiguration = provider.getSessionTypes(folderUri).find((sessionType) => sessionType.id === sessionTypeId)?.supportsWorktreeConfiguration === true;
    return this._configureAndSendNewSession(provider, session, options, createOptions, supportsWorktreeConfiguration, token, folderUri);
  }
  async createAndSendQuickChatRequest(options, createOptions, token = CancellationToken.None) {
    const { provider, sessionTypeId } = this._resolveProviderForQuickChat(createOptions);
    const session = provider.createQuickChat(sessionTypeId);
    return this._configureAndSendNewSession(provider, session, options, createOptions, false, token);
  }
  async _configureAndSendNewSession(provider, session, options, createOptions, supportsWorktreeConfiguration, token, folderUri) {
    try {
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      if (createOptions?.modelId) {
        const resolvedModelId = await this._waitForRequestedModel(provider, session, createOptions.modelId, token, folderUri);
        provider.setModel(session.sessionId, resolvedModelId);
      }
      if (createOptions?.modeId) {
        provider.setMode?.(session.sessionId, createOptions.modeId);
      }
      if (createOptions?.permissionLevel) {
        provider.setPermissionLevel?.(session.sessionId, createOptions.permissionLevel);
      }
      if (supportsWorktreeConfiguration && (createOptions?.isolationMode || createOptions?.worktreeBranchTrack !== void 0 || createOptions?.branch)) {
        if (createOptions.isolationMode && provider.setIsolationMode) {
          await raceCancellationError(provider.setIsolationMode(session.sessionId, createOptions.isolationMode), token);
        }
        if (createOptions.worktreeBranchTrack !== void 0 && provider.setWorktreeBranchTrack) {
          await raceCancellationError(provider.setWorktreeBranchTrack(session.sessionId, createOptions.worktreeBranchTrack), token);
        }
        if (createOptions.branch && provider.setBranch) {
          await raceCancellationError(provider.setBranch(session.sessionId, createOptions.branch), token);
        }
      }
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      return await raceCancellationError(this._sendNewChatRequestInBackground(provider, session, options, token), token);
    } catch (e) {
      provider.deleteNewSession(session.sessionId);
      throw e;
    }
  }
  async _waitForRequestedModel(provider, session, modelId, token, folderUri) {
    const resolveCurrent = () => provider.getModelsSnapshot(session.sessionId, modelId).desiredModelResolution;
    const initial = resolveCurrent();
    if (initial.kind === "available") {
      return initial.model.identifier;
    }
    if (initial.kind === "notRequested") {
      return modelId;
    }
    if (initial.kind === "unavailable") {
      throw new Error(`Model '${modelId}' is unavailable for sessions provider '${provider.id}'`);
    }
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    return new Promise((resolve, reject) => {
      const disposables = new DisposableStore();
      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        disposables.dispose();
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      };
      const check = () => {
        const resolution = resolveCurrent();
        if (resolution.kind === "available") {
          finish(resolution.model.identifier);
        } else if (resolution.kind === "notRequested") {
          finish(modelId);
        } else if (resolution.kind === "unavailable") {
          finish(new Error(`Model '${modelId}' is unavailable for sessions provider '${provider.id}'`));
        }
      };
      disposables.add(provider.onDidChangeModels(check));
      disposables.add(provider.onDidChangeSessionTypes(() => {
        const sessionTypes = folderUri ? provider.getSessionTypes(folderUri) : provider.sessionTypes;
        if (!sessionTypes.some((type) => type.id === session.sessionType)) {
          finish(new Error(`Session type '${session.sessionType}' is no longer available for sessions provider '${provider.id}'`));
        }
      }));
      disposables.add(this.sessionsProvidersService.onDidChangeProviders((event) => {
        if (event.removed.includes(provider)) {
          finish(new Error(`Sessions provider '${provider.id}' is no longer available`));
        }
      }));
      disposables.add(token.onCancellationRequested(() => finish(new CancellationError())));
      disposables.add(this._disposeCts.token.onCancellationRequested(() => finish(new CancellationError())));
      check();
    });
  }
  dispose() {
    this._disposeCts.cancel();
    super.dispose();
  }
  /**
   * Commit a new-session request: fire {@link _onWillSendRequest}, create the
   * new chat via the provider, send the request, and—on success—fire
   * {@link _onDidStartSession} and {@link _onDidSendRequest}. The started
   * session is never swapped into the visible chat slot, so it simply appears
   * in the sessions list once the provider commits it.
   *
   * Owns the full will/did send lifecycle so callers do not fire the paired
   * events themselves. Errors are propagated to the caller; this method does
   * not clean up the stranded draft, so callers own any view handling and the
   * error handling (e.g. disposing the stranded draft via
   * {@link ISessionsProvider.deleteNewSession}).
   *
   * Providers are multi-new-session aware, so the graduating session and a
   * concurrently reseeded composer draft coexist without conflict.
   */
  async _sendNewChatRequestInBackground(provider, session, options, token = CancellationToken.None) {
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    this._onWillSendRequest.fire(session);
    const chatPromise = provider.createNewChat(session.sessionId, options.query);
    const chat = token === CancellationToken.None ? await chatPromise : await raceCancellationError(chatPromise, token);
    const sendOptions = this._augmentOptionsForTroubleshoot(session, options);
    const chatResourceKey = chat.resource.toString();
    this._pendingSendChatResources.add(chatResourceKey);
    const cancellationListener = token.onCancellationRequested(() => {
      void this.chatService.cancelCurrentRequestForSession(chat.resource, "sessionsManagement").catch((error) => {
        this.logService.warn("[SessionsManagement] Failed to cancel headless request:", error);
      });
    });
    let updatedSession;
    try {
      updatedSession = await provider.sendRequest(session.sessionId, chat.resource, sendOptions);
    } finally {
      cancellationListener.dispose();
      this._pendingSendChatResources.delete(chatResourceKey);
    }
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    if (this._store.isDisposed) {
      return void 0;
    }
    this._onDidStartSession.fire(updatedSession);
    this._onDidSendRequest.fire({ session: updatedSession, chat, isNewSession: true, isNewChat: true, options });
    return updatedSession;
  }
  async sendRequest(session, chat, options) {
    this.discardNewSession();
    const provider = this._getProvider(session);
    if (!provider) {
      throw new Error(`Sessions provider '${session.providerId}' not found`);
    }
    if (options.background) {
      this._sendRequestInBackground(provider, session, chat, options).catch((e) => {
        this.logService.error("[SessionsManagement] Failed to send background request:", e);
      });
      return;
    }
    this._onWillSendRequest.fire(session);
    const sendOptions = this._augmentOptionsForTroubleshoot(session, options);
    const chatResourceKey = chat.resource.toString();
    this._pendingSendChatResources.add(chatResourceKey);
    let updatedSession;
    try {
      updatedSession = await provider.sendRequest(session.sessionId, chat.resource, sendOptions);
    } finally {
      this._pendingSendChatResources.delete(chatResourceKey);
    }
    if (updatedSession.sessionId !== session.sessionId) {
      this.logService.info(`[SessionsManagement] sendRequest: active session replaced: ${session.sessionId} -> ${updatedSession.sessionId}`);
    }
    this._onDidSendRequest.fire({ session: updatedSession, chat, isNewSession: false, isNewChat: true, options });
  }
  /**
   * Send a request for an existing chat in the background: commit the send via
   * the provider and—on success—fire {@link _onDidSendRequest}. Unlike the
   * foreground {@link sendRequest} path this does not fire
   * {@link _onWillSendRequest}, so the view's send-follow never navigates the
   * visible slot into the sent chat. Errors are propagated to the caller.
   */
  async _sendRequestInBackground(provider, session, chat, options) {
    const sendOptions = this._augmentOptionsForTroubleshoot(session, options);
    const chatResourceKey = chat.resource.toString();
    this._pendingSendChatResources.add(chatResourceKey);
    let updatedSession;
    try {
      updatedSession = await provider.sendRequest(session.sessionId, chat.resource, sendOptions);
    } finally {
      this._pendingSendChatResources.delete(chatResourceKey);
    }
    if (this._store.isDisposed) {
      return;
    }
    this._onDidSendRequest.fire({ session: updatedSession, chat, isNewSession: false, isNewChat: true, options });
  }
  // -- Session Actions --
  _getProvider(session) {
    return this.sessionsProvidersService.getProviders().find((p) => p.id === session.providerId);
  }
  async archiveSession(session) {
    await this._getProvider(session)?.archiveSession(session.sessionId);
    this._onDidArchiveSession.fire(session);
  }
  async unarchiveSession(session) {
    await this._getProvider(session)?.unarchiveSession(session.sessionId);
    this._onDidUnarchiveSession.fire(session);
  }
  async setSessionReadState(session, isRead) {
    await this._getProvider(session)?.setSessionReadState(session.sessionId, isRead);
  }
  markRead(session) {
    return this.setSessionReadState(session, true);
  }
  markUnread(session) {
    return this.setSessionReadState(session, false);
  }
  async markAllRead(sessions) {
    await Promise.all(sessions.map((session) => this.setSessionReadState(session, true)));
  }
  async deleteSession(session) {
    await this._getProvider(session)?.deleteSession(session.sessionId);
    this._onDidDeleteSession.fire(session);
  }
  async deleteSessions(sessions) {
    const byProvider = /* @__PURE__ */ new Map();
    for (const session of sessions) {
      const provider = this._getProvider(session);
      if (!provider) {
        continue;
      }
      const group = byProvider.get(provider);
      if (group) {
        group.push(session);
      } else {
        byProvider.set(provider, [session]);
      }
    }
    let firstError;
    for (const [provider, providerSessions] of byProvider) {
      try {
        await provider.deleteSessions(providerSessions.map((session) => session.sessionId));
        for (const session of providerSessions) {
          this._onDidDeleteSession.fire(session);
        }
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError !== void 0) {
      throw firstError;
    }
  }
  async deleteChat(session, chatUri, options) {
    const deleted = await this._getProvider(session)?.deleteChat(session.sessionId, chatUri, options);
    if (deleted) {
      this._onDidDeleteChat.fire(session);
    }
  }
  async renameChat(session, chatUri, title) {
    await this._getProvider(session)?.renameChat(session.sessionId, chatUri, title);
    this._onDidRenameChat.fire(session);
  }
  async renameSession(session, title) {
    await this._getProvider(session)?.renameSession(session.sessionId, title);
    this._onDidRenameSession.fire(session);
  }
};
SessionsManagementService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatWidgetHistoryService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IPathService),
  __decorateParam(7, IRemoteAgentHostService),
  __decorateParam(8, IWorkspaceTrustManagementService)
], SessionsManagementService);
registerSingleton(ISessionsManagementService, SessionsManagementService, InstantiationType.Eager);
export {
  SessionsManagementService
};
