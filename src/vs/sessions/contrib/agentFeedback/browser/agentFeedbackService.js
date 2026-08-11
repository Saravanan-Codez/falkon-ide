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
import { Emitter, Event } from "../../../../base/common/event.js";
import { DeferredPromise, raceTimeout } from "../../../../base/common/async.js";
import { createSingleCallFunction } from "../../../../base/common/functional.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { derived, runOnChange } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { isEqual, isEqualOrParent } from "../../../../base/common/resources.js";
import { Schemas } from "../../../../base/common/network.js";
import { IChatEditingService } from "../../../../workbench/contrib/chat/common/editing/chatEditingService.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { editingEntriesContainResource } from "../../../../workbench/contrib/chat/browser/sessionResourceMatching.js";
import { changeMatchesResource, getActiveResourceCandidates } from "./agentFeedbackEditorUtils.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { AnnotationsAgentFeedbackItemsBackend, InMemoryAgentFeedbackItemsBackend } from "./agentFeedbackItemsBackend.js";
import { ATTACHMENT_ID_PREFIX, createAgentFeedbackVariableEntry } from "./agentFeedbackAttachmentEntry.js";
import { AgentFeedbackKind, AgentFeedbackState } from "./agentFeedbackModel.js";
import { SessionEditorCommentSource, toSessionEditorCommentId } from "./sessionEditorComments.js";
const AGENT_FEEDBACK_NEW_SESSION_RESOURCE = URI.from({ scheme: "agent-feedback", path: "/new-session" });
const WIDGET_LOAD_TIMEOUT_MS = 1e4;
async function whenWidgetForSession(chatWidgetService, sessionResource, timeoutMs = WIDGET_LOAD_TIMEOUT_MS) {
  const existing = chatWidgetService.getWidgetBySessionResource(sessionResource);
  if (existing) {
    return existing;
  }
  const store = new DisposableStore();
  try {
    const loaded = new Promise((resolve) => {
      const check = () => {
        const widget = chatWidgetService.getWidgetBySessionResource(sessionResource);
        if (widget) {
          resolve(widget);
        }
      };
      const observe = (candidate) => store.add(candidate.onDidChangeViewModel(check));
      chatWidgetService.getAllWidgets().forEach(observe);
      store.add(chatWidgetService.onDidAddWidget((added) => {
        observe(added);
        check();
      }));
      check();
    });
    return await raceTimeout(loaded, timeoutMs);
  } finally {
    store.dispose();
  }
}
const IAgentFeedbackService = createDecorator("agentFeedbackService");
function workspaceFoldersKey(workspace) {
  return workspace?.folders.map((folder) => folder.root.toString()).join(",");
}
let AgentFeedbackService = class extends Disposable {
  constructor(_chatEditingService, _sessionsManagementService, _sessionsService, _editorService, _chatWidgetService, _logService, _instantiationService) {
    super();
    this._chatEditingService = _chatEditingService;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._editorService = _editorService;
    this._chatWidgetService = _chatWidgetService;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._onDidChangeFeedback = this._store.add(new Emitter());
    this.onDidChangeFeedback = this._onDidChangeFeedback.event;
    this._onDidChangeNavigation = this._store.add(new Emitter());
    this.onDidChangeNavigation = this._onDidChangeNavigation.event;
    this._onDidRevealSessionComment = this._store.add(new Emitter());
    this.onDidRevealSessionComment = this._onDidRevealSessionComment.event;
    this._onDidChangeFeedbackScope = this._store.add(new Emitter());
    this.onDidChangeFeedbackScope = this._onDidChangeFeedbackScope.event;
    this._onDidAddFeedback = this._store.add(new Emitter());
    this.onDidAddFeedback = this._onDidAddFeedback.event;
    this._onDidConvertFeedback = this._store.add(new Emitter());
    this.onDidConvertFeedback = this._onDidConvertFeedback.event;
    this._onDidAddReply = this._store.add(new Emitter());
    this.onDidAddReply = this._onDidAddReply.event;
    this._onDidSubmitFeedback = this._store.add(new Emitter());
    this.onDidSubmitFeedback = this._onDidSubmitFeedback.event;
    /** sessionResource → recency sequence (set on every feedback change) */
    this._sessionUpdatedOrder = /* @__PURE__ */ new Map();
    this._sessionUpdatedSequence = 0;
    this._navigationAnchorBySession = /* @__PURE__ */ new Map();
    /** fileResource → sessionResource active when the editor for that file was first seen */
    this._fileToSession = new ResourceMap();
    this._explicitResourceScopes = new ResourceMap();
    /** In-memory store used for every non-agent-host provider. */
    this._inMemoryBackend = this._register(new InMemoryAgentFeedbackItemsBackend());
    this._register(this._inMemoryBackend.onDidChangeItems((resource) => this._handleBackendChange(resource)));
    this._register(this._editorService.onDidVisibleEditorsChange(() => this._trackVisibleEditorResources()));
    this._trackVisibleEditorResources();
    this.activeFeedbackSessionResource = derived(this, (reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      return !activeSession || !activeSession.isCreated.read(reader) ? AGENT_FEEDBACK_NEW_SESSION_RESOURCE : activeSession.resource;
    });
    const feedbackScopeKey = derived(this, (reader) => {
      const scope = this.activeFeedbackSessionResource.read(reader).toString();
      const workspace = this._sessionsService.activeSession.read(reader)?.workspace.read(reader);
      return `${scope}|${workspaceFoldersKey(workspace) ?? ""}`;
    });
    this._register(runOnChange(feedbackScopeKey, () => this._onDidChangeFeedbackScope.fire()));
    this._newSessionWorkspaceKey = derived(this, (reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      if (!activeSession || activeSession.isCreated.read(reader)) {
        return void 0;
      }
      return workspaceFoldersKey(activeSession.workspace.read(reader));
    });
    this._register(runOnChange(this._newSessionWorkspaceKey, (key) => {
      if (key === void 0) {
        return;
      }
      if (this._boundNewSessionWorkspaceKey !== void 0 && this._boundNewSessionWorkspaceKey !== key) {
        this.clearFeedback(AGENT_FEEDBACK_NEW_SESSION_RESOURCE);
      }
      this._rebindNewSessionWorkspace();
    }));
  }
  /**
   * The shared new-session comments belong to the workspace of the draft they
   * were written for. An empty set releases the binding so the next draft can
   * adopt its own workspace instead of being measured against a stale one.
   */
  _rebindNewSessionWorkspace() {
    if (!this.getFeedback(AGENT_FEEDBACK_NEW_SESSION_RESOURCE).length) {
      this._boundNewSessionWorkspaceKey = void 0;
      return;
    }
    const key = this._newSessionWorkspaceKey.get();
    if (key !== void 0) {
      this._boundNewSessionWorkspaceKey = key;
    }
  }
  /** Resolves the storage backend that owns feedback for the given session. */
  _backendForSession(sessionResource) {
    if (this._isAgentHostSession(sessionResource)) {
      return this._getAnnotationsBackend();
    }
    return this._inMemoryBackend;
  }
  _getAnnotationsBackend() {
    if (!this._annotationsBackend) {
      this._annotationsBackend = this._register(this._instantiationService.createInstance(AnnotationsAgentFeedbackItemsBackend));
      this._register(this._annotationsBackend.onDidChangeItems((resource) => this._handleBackendChange(resource)));
    }
    return this._annotationsBackend;
  }
  _backends() {
    return this._annotationsBackend ? [this._inMemoryBackend, this._annotationsBackend] : [this._inMemoryBackend];
  }
  /**
   * Centralized handler for backend item changes (local mutations and
   * server-driven updates). Maintains recency ordering and re-broadcasts the
   * generic feedback / navigation change events.
   */
  _handleBackendChange(sessionResource) {
    const key = sessionResource.toString();
    const feedbackItems = this._backendForSession(sessionResource).getItems(sessionResource);
    if (feedbackItems.length) {
      this._sessionUpdatedOrder.set(key, ++this._sessionUpdatedSequence);
    } else {
      this._sessionUpdatedOrder.delete(key);
    }
    this._onDidChangeFeedback.fire({ sessionResource, feedbackItems });
    this._onDidChangeNavigation.fire(sessionResource);
    if (isEqual(sessionResource, AGENT_FEEDBACK_NEW_SESSION_RESOURCE)) {
      this._rebindNewSessionWorkspace();
    }
  }
  _trackVisibleEditorResources() {
    const activeSession = this._sessionsService.activeSession.get();
    if (!activeSession) {
      return;
    }
    for (const pane of this._editorService.visibleEditorPanes) {
      for (const candidate of getActiveResourceCandidates(pane.input)) {
        this._fileToSession.set(candidate, activeSession.resource);
      }
    }
  }
  getSessionForFile(resourceUri) {
    const sessionResource = this._fileToSession.get(resourceUri) ?? this._sessionsService.activeSession.get()?.resource;
    if (!sessionResource) {
      return void 0;
    }
    const session = this._sessionsManagementService.getSession(sessionResource);
    if (!session || session.status.get() === SessionStatus.Untitled) {
      return void 0;
    }
    if (!this._isFileInSessionScope(session, resourceUri)) {
      return void 0;
    }
    return session;
  }
  getFeedbackSessionResource(resourceUri) {
    const explicitScope = this._explicitResourceScopes.get(resourceUri);
    if (explicitScope) {
      return explicitScope;
    }
    if (resourceUri.scheme === Schemas.outputChannel) {
      return void 0;
    }
    const activeSession = this._sessionsService.activeSession.get();
    if (!activeSession || !activeSession.isCreated.get()) {
      if (activeSession && !this._isFileInSessionScope(activeSession, resourceUri)) {
        return void 0;
      }
      return AGENT_FEEDBACK_NEW_SESSION_RESOURCE;
    }
    return this.getSessionForFile(resourceUri)?.resource;
  }
  registerFeedbackResourceScope(resourceUri, sessionResource) {
    this._explicitResourceScopes.set(resourceUri, sessionResource);
    this._onDidChangeFeedbackScope.fire();
    return {
      dispose: () => {
        if (isEqual(this._explicitResourceScopes.get(resourceUri), sessionResource)) {
          this._explicitResourceScopes.delete(resourceUri);
          this._onDidChangeFeedbackScope.fire();
        }
      }
    };
  }
  /**
   * Whether the given file belongs to the session and is therefore eligible
   * for agent feedback. This keeps the feedback affordances scoped to the
   * session's own files and excludes editors that merely happen to be open
   * while the session is active (e.g. user settings opened from the user
   * data directory, or the Output view which is not backed by a real file).
   */
  _isFileInSessionScope(session, resourceUri) {
    if (resourceUri.scheme === Schemas.outputChannel) {
      return false;
    }
    if (session.changes.get().some((change) => changeMatchesResource(change, resourceUri))) {
      return true;
    }
    const workspace = session.workspace.get();
    if (!workspace) {
      return true;
    }
    return workspace.folders.some((folder) => isEqualOrParent(resourceUri, folder.root) || isEqualOrParent(resourceUri, folder.workingDirectory));
  }
  addFeedback(sessionResource, resourceUri, range, text, suggestion, context, sourcePRReviewCommentId, kind = AgentFeedbackKind.UserReview, state = AgentFeedbackState.Accepted) {
    const backend = this._backendForSession(sessionResource);
    const effectiveKind = sourcePRReviewCommentId ? AgentFeedbackKind.PRReview : kind;
    const feedback = {
      id: generateUuid(),
      text,
      resourceUri,
      range,
      sessionResource,
      suggestion,
      codeSelection: context?.codeSelection,
      diffHunks: context?.diffHunks,
      kind: effectiveKind,
      sourcePRReviewCommentId,
      state
    };
    const resourceStr = resourceUri.toString();
    const hasExistingForFile = backend.getItems(sessionResource).some((f) => f.resourceUri.toString() === resourceStr);
    backend.upsert(feedback);
    if (state === AgentFeedbackState.Accepted) {
      if (effectiveKind === AgentFeedbackKind.UserReview) {
        this._onDidAddFeedback.fire({ sessionResource, feedback, hasExistingFeedbackForFile: hasExistingForFile });
      } else {
        this._onDidConvertFeedback.fire({ sessionResource, feedback, kind: effectiveKind, hasExistingFeedbackForFile: hasExistingForFile });
      }
    }
    return feedback;
  }
  acceptFeedback(sessionResource, feedbackId, options) {
    const backend = this._backendForSession(sessionResource);
    const feedbackItems = backend.getItems(sessionResource);
    const existing = feedbackItems.find((f) => f.id === feedbackId);
    if (!existing || existing.state !== AgentFeedbackState.Created) {
      return;
    }
    const accepted = {
      ...existing,
      state: AgentFeedbackState.Accepted,
      ...options?.revealToAgent ? { pendingAgentReveal: true } : {}
    };
    backend.upsert(accepted);
    if (accepted.kind !== AgentFeedbackKind.UserReview) {
      const resourceStr = accepted.resourceUri.toString();
      const hasExistingFeedbackForFile = feedbackItems.some((f) => f.id !== accepted.id && f.resourceUri.toString() === resourceStr);
      this._onDidConvertFeedback.fire({ sessionResource, feedback: accepted, kind: accepted.kind, hasExistingFeedbackForFile });
    }
  }
  removeFeedback(sessionResource, feedbackId) {
    const key = sessionResource.toString();
    if (this._navigationAnchorBySession.get(key) === feedbackId) {
      this._navigationAnchorBySession.delete(key);
    }
    this._backendForSession(sessionResource).remove(sessionResource, feedbackId);
  }
  updateFeedback(sessionResource, feedbackId, newText) {
    const backend = this._backendForSession(sessionResource);
    const existing = backend.getItems(sessionResource).find((f) => f.id === feedbackId);
    if (!existing) {
      return;
    }
    backend.upsert({ ...existing, text: newText });
  }
  setFeedbackResolved(sessionResource, feedbackId, resolved) {
    const backend = this._backendForSession(sessionResource);
    const nextState = resolved ? AgentFeedbackState.Resolved : AgentFeedbackState.Submitted;
    const existing = backend.getItems(sessionResource).find((f) => f.id === feedbackId);
    if (existing && existing.state !== nextState) {
      backend.upsert({ ...existing, state: nextState });
    }
  }
  addReply(sessionResource, feedbackId, replyText) {
    const backend = this._backendForSession(sessionResource);
    const existing = backend.getItems(sessionResource).find((f) => f.id === feedbackId);
    if (!existing) {
      return;
    }
    const newReplies = [...existing.replies ?? [], replyText];
    const updated = { ...existing, replies: newReplies };
    backend.upsert(updated);
    this._onDidAddReply.fire({ sessionResource, feedback: updated, replyCount: newReplies.length });
  }
  getFeedback(sessionResource) {
    return this._backendForSession(sessionResource).getItems(sessionResource);
  }
  hasLoadedFeedback(sessionResource) {
    return this._backendForSession(sessionResource).hasLoaded(sessionResource);
  }
  getMostRecentSessionForResource(resourceUri) {
    let bestSession;
    let bestSequence = -1;
    for (const backend of this._backends()) {
      for (const candidate of backend.getSessionsWithItems()) {
        const feedbackItems = backend.getItems(candidate);
        if (!feedbackItems.length) {
          continue;
        }
        if (!this._sessionContainsResource(candidate, resourceUri, feedbackItems)) {
          continue;
        }
        const sequence = this._sessionUpdatedOrder.get(candidate.toString()) ?? 0;
        if (sequence > bestSequence) {
          bestSession = candidate;
          bestSequence = sequence;
        }
      }
    }
    return bestSession;
  }
  _sessionContainsResource(sessionResource, resourceUri, feedbackItems) {
    if (feedbackItems.some((item) => isEqual(item.resourceUri, resourceUri))) {
      return true;
    }
    for (const editingSession of this._chatEditingService.editingSessionsObs.get()) {
      if (!isEqual(editingSession.chatSessionResource, sessionResource)) {
        continue;
      }
      if (editingEntriesContainResource(editingSession.entries.get(), resourceUri)) {
        return true;
      }
    }
    const session = this._sessionsManagementService.getSession(sessionResource);
    if (!session) {
      return false;
    }
    const changes = session.changes.get();
    if (changes.some((change) => changeMatchesResource(change, resourceUri))) {
      return true;
    }
    return false;
  }
  async revealFeedback(sessionResource, feedbackId) {
    const feedback = this.getFeedback(sessionResource).find((f) => f.id === feedbackId);
    if (!feedback) {
      return;
    }
    await this.revealSessionComment(sessionResource, toSessionEditorCommentId(SessionEditorCommentSource.AgentFeedback, feedbackId), feedback.resourceUri, feedback.range);
  }
  async revealSessionComment(sessionResource, commentId, resourceUri, range) {
    const selection = { startLineNumber: range.startLineNumber, startColumn: range.startColumn };
    const sessionData = this._sessionsManagementService.getSession(sessionResource);
    const sessionChange = this._getSessionChange(resourceUri, sessionData?.changes.get());
    if (sessionChange?.isDeletion && sessionChange.originalUri) {
      await this._editorService.openEditor({
        resource: sessionChange.originalUri,
        options: {
          modal: {},
          preserveFocus: false,
          revealIfVisible: true,
          selection
        }
      });
    } else if (sessionChange?.originalUri) {
      await this._editorService.openEditor({
        original: { resource: sessionChange.originalUri },
        modified: { resource: sessionChange.modifiedUri },
        options: {
          modal: {},
          preserveFocus: false,
          revealIfVisible: true,
          selection
        }
      });
    } else {
      await this._editorService.openEditor({
        resource: sessionChange?.modifiedUri ?? resourceUri,
        options: {
          modal: {},
          preserveFocus: false,
          revealIfVisible: true,
          selection
        }
      });
    }
    this.setNavigationAnchor(sessionResource, commentId);
    this._onDidRevealSessionComment.fire({ sessionResource, commentId, resourceUri });
  }
  _getSessionChange(resourceUri, changes) {
    if (!(changes instanceof Array)) {
      return void 0;
    }
    const matchingChange = changes.find((change) => changeMatchesResource(change, resourceUri));
    if (!matchingChange) {
      return void 0;
    }
    if (isIChatSessionFileChange2(matchingChange)) {
      return {
        originalUri: matchingChange.originalUri,
        modifiedUri: matchingChange.modifiedUri ?? matchingChange.uri,
        isDeletion: matchingChange.modifiedUri === void 0
      };
    }
    return {
      originalUri: matchingChange.originalUri,
      modifiedUri: matchingChange.modifiedUri,
      isDeletion: false
    };
  }
  getNextFeedback(sessionResource, next) {
    return this.getNextNavigableItem(sessionResource, this.getFeedback(sessionResource), next);
  }
  getNextNavigableItem(sessionResource, items, next) {
    const key = sessionResource.toString();
    if (!items.length) {
      this._navigationAnchorBySession.delete(key);
      return void 0;
    }
    const anchorId = this._navigationAnchorBySession.get(key);
    let anchorIndex = anchorId ? items.findIndex((item2) => item2.id === anchorId) : -1;
    if (anchorIndex < 0 && !next) {
      anchorIndex = 0;
    }
    const nextIndex = next ? (anchorIndex + 1) % items.length : (anchorIndex - 1 + items.length) % items.length;
    const item = items[nextIndex];
    this.setNavigationAnchor(sessionResource, item.id);
    return item;
  }
  setNavigationAnchor(sessionResource, itemId) {
    const key = sessionResource.toString();
    if (itemId) {
      this._navigationAnchorBySession.set(key, itemId);
    } else {
      this._navigationAnchorBySession.delete(key);
    }
    this._onDidChangeNavigation.fire(sessionResource);
  }
  getNavigationBearing(sessionResource, items = this.getFeedback(sessionResource)) {
    const key = sessionResource.toString();
    const anchorId = this._navigationAnchorBySession.get(key);
    const activeIdx = anchorId ? items.findIndex((item) => item.id === anchorId) : -1;
    return { activeIdx, totalCount: items.length };
  }
  clearFeedback(sessionResource) {
    const key = sessionResource.toString();
    this._sessionUpdatedOrder.delete(key);
    this._navigationAnchorBySession.delete(key);
    this._backendForSession(sessionResource).clear(sessionResource);
  }
  async addFeedbackAndSubmit(sessionResource, resourceUri, range, text, suggestion, context, sourcePRReviewCommentId, kind) {
    this.addFeedback(sessionResource, resourceUri, range, text, suggestion, context, sourcePRReviewCommentId, kind);
    if (isEqual(sessionResource, AGENT_FEEDBACK_NEW_SESSION_RESOURCE)) {
      await this.submitFeedback(sessionResource);
      return;
    }
    if (!this._isAgentHostSession(sessionResource)) {
      const widget = await whenWidgetForSession(this._chatWidgetService, sessionResource);
      if (widget) {
        const attachmentId = ATTACHMENT_ID_PREFIX + sessionResource.toString();
        const hasAttachment = () => widget.attachmentModel.attachments.some((a) => a.id === attachmentId);
        if (!hasAttachment()) {
          await Event.toPromise(
            Event.filter(widget.attachmentModel.onDidChange, () => hasAttachment())
          );
        }
      } else {
        this._logService.error("[AgentFeedback] addFeedbackAndSubmit: no chat widget found for session, feedback may not be submitted correctly", sessionResource.toString());
      }
    }
    await this.submitFeedback(sessionResource);
  }
  _isAgentHostSession(sessionResource) {
    const session = this._sessionsManagementService.getSession(sessionResource);
    return session ? isAgentHostProviderId(session.providerId) : false;
  }
  async submitFeedback(sessionResource) {
    if (isEqual(sessionResource, AGENT_FEEDBACK_NEW_SESSION_RESOURCE)) {
      if (!this.getFeedback(sessionResource).some((item) => item.state === AgentFeedbackState.Accepted)) {
        return false;
      }
      return this._sessionsService.submitNewSessionInput();
    }
    const widget = await whenWidgetForSession(this._chatWidgetService, sessionResource);
    if (!widget) {
      this._logService.error("[AgentFeedback] submitFeedback: no chat widget found for session", sessionResource.toString());
      return false;
    }
    if (this._isAgentHostSession(sessionResource)) {
      const acceptedItems = this.getFeedback(sessionResource).filter((item) => item.state === AgentFeedbackState.Accepted);
      const attachmentId = ATTACHMENT_ID_PREFIX + sessionResource.toString();
      if (acceptedItems.length) {
        const annotationsResource = this._getAnnotationsBackend().getAnnotationsChannelResource(sessionResource);
        widget.attachmentModel.delete(attachmentId);
        widget.attachmentModel.addContext(createAgentFeedbackVariableEntry(sessionResource, acceptedItems, annotationsResource));
      }
      return this._sendActOnFeedbackRequest(widget, sessionResource, () => widget.attachmentModel.delete(attachmentId));
    }
    return this._sendActOnFeedbackRequest(widget, sessionResource);
  }
  /**
   * Sends the `/act-on-feedback` request and marks the accepted feedback as
   * submitted as soon as the request has been accepted by the chat widget.
   * The request is queued when the agent is still working on another request,
   * in which case awaiting {@link IChatWidget.acceptInput} would only resolve
   * once that queued request eventually runs — the feedback items must move to
   * the submitted state right away.
   */
  _sendActOnFeedbackRequest(widget, sessionResource, cleanup) {
    const submitted = new DeferredPromise();
    const cleanupOnce = cleanup && createSingleCallFunction(cleanup);
    widget.acceptInput("/act-on-feedback", {
      onRequestAccepted: () => {
        cleanupOnce?.();
        this.markFeedbackSubmitted(sessionResource);
        submitted.complete(true);
      }
    }).then(() => {
      cleanupOnce?.();
      submitted.complete(false);
    }, (err) => {
      this._logService.error("[AgentFeedback] Failed to submit feedback", err);
      cleanupOnce?.();
      submitted.complete(false);
    });
    return submitted.p;
  }
  markFeedbackSubmitted(sessionResource) {
    const backend = this._backendForSession(sessionResource);
    const feedbackItems = backend.getItems(sessionResource);
    const submittedState = this._isAgentHostSession(sessionResource) ? AgentFeedbackState.Submitted : AgentFeedbackState.Resolved;
    let userCount = 0;
    let codeReviewCount = 0;
    let prReviewCount = 0;
    let replyCount = 0;
    const submitted = [];
    for (const item of feedbackItems) {
      if (item.state !== AgentFeedbackState.Accepted) {
        continue;
      }
      switch (item.kind) {
        case AgentFeedbackKind.UserReview:
          userCount++;
          break;
        case AgentFeedbackKind.AgentReview:
          codeReviewCount++;
          break;
        case AgentFeedbackKind.PRReview:
          prReviewCount++;
          break;
      }
      replyCount += item.replies?.length ?? 0;
      submitted.push({ ...item, state: submittedState });
    }
    if (!submitted.length) {
      return;
    }
    for (const item of submitted) {
      backend.upsert(item);
    }
    this._onDidSubmitFeedback.fire({
      sessionResource,
      totalCount: userCount + codeReviewCount + prReviewCount,
      userCount,
      codeReviewCount,
      prReviewCount,
      replyCount
    });
  }
};
AgentFeedbackService = __decorateClass([
  __decorateParam(0, IChatEditingService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IChatWidgetService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IInstantiationService)
], AgentFeedbackService);
export {
  AGENT_FEEDBACK_NEW_SESSION_RESOURCE,
  AgentFeedbackKind,
  AgentFeedbackService,
  AgentFeedbackState,
  IAgentFeedbackService,
  whenWidgetForSession
};
