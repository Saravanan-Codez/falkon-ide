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
import { raceCancellationError } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { MarkdownString, markdownStringEqual } from "../../../base/common/htmlContent.js";
import { Disposable, DisposableMap, DisposableResourceMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { revive } from "../../../base/common/marshalling.js";
import { equals } from "../../../base/common/objects.js";
import { autorun, observableSignalFromEvent, observableValue } from "../../../base/common/observable.js";
import { isEqual } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { hasValidDiff } from "../../contrib/chat/browser/agentSessions/agentSessionsModel.js";
import { IAgentSessionsService } from "../../contrib/chat/browser/agentSessions/agentSessionsService.js";
import { IChatWidgetService, isIChatViewViewContext } from "../../contrib/chat/browser/chat.js";
import { getInProgressSessionDescription } from "../../contrib/chat/browser/chatSessions/chatSessionDescription.js";
import { getSessionStatusForModel } from "../../contrib/chat/browser/chatSessions/chatSessions.contribution.js";
import { ChatEditorInput } from "../../contrib/chat/browser/widgetHosts/editor/chatEditorInput.js";
import { IChatDebugService } from "../../contrib/chat/common/chatDebugService.js";
import { IChatService } from "../../contrib/chat/common/chatService/chatService.js";
import { ChatSessionOptionsMap, IChatSessionsService } from "../../contrib/chat/common/chatSessionsService.js";
import { ChatAgentLocation } from "../../contrib/chat/common/constants.js";
import { getChatSessionType } from "../../contrib/chat/common/model/chatUri.js";
import { IChatArtifactsService } from "../../contrib/chat/common/tools/chatArtifactsService.js";
import { IChatTodoListService } from "../../contrib/chat/common/tools/chatTodoListService.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
function stringOrMarkdownEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (typeof a === "string" || typeof b === "string") {
    return false;
  }
  return markdownStringEqual(a, b);
}
class ObservableChatSession extends Disposable {
  constructor(resource, providerHandle, proxy, logService, dialogService) {
    super();
    this._progressObservable = observableValue(this, []);
    this._isCompleteObservable = observableValue(this, false);
    this._onWillDispose = new Emitter();
    this.onWillDispose = this._onWillDispose.event;
    this._pendingProgressChunks = /* @__PURE__ */ new Map();
    this._isInitialized = false;
    this._interruptionWasCanceled = false;
    this._disposalPending = false;
    /**
     * Number of currently in-flight `requestHandler` invocations. Used to
     * defer `$disposeChatSessionContent` when the workbench wants to release
     * this session while a request is mid-flight on a `requestHandler`-style
     * session (e.g. Copilot CLI). Without this guard, the proxy dispose
     * synchronously cancels the ext-host `disposeCts` and tears down the
     * underlying SDK session (which calls `sdkSession.abort()`), so the
     * in-flight request is lost. The `activeResponseCallback`-style sessions
     * have their own deferral via {@link interruptActiveResponseCallback};
     * this counter is the equivalent for `requestHandler`-style sessions.
     */
    this._inFlightRequestCount = 0;
    this.sessionResource = resource;
    this.providerHandle = providerHandle;
    this.history = [];
    this._proxy = proxy;
    this._providerHandle = providerHandle;
    this._logService = logService;
    this._dialogService = dialogService;
  }
  get options() {
    return this._options ? new Map(this._options) : void 0;
  }
  get progressObs() {
    return this._progressObservable;
  }
  get isCompleteObs() {
    return this._isCompleteObservable;
  }
  initialize(token, context) {
    if (!this._initializationPromise) {
      this._initializationPromise = this._doInitializeContent(token, context);
    }
    return this._initializationPromise;
  }
  async _doInitializeContent(token, context) {
    try {
      const sessionContent = await raceCancellationError(
        this._proxy.$provideChatSessionContent(this._providerHandle, this.sessionResource, context, token),
        token
      );
      this._options = sessionContent.options ? ChatSessionOptionsMap.fromRecord(sessionContent.options) : void 0;
      this.title = sessionContent.title;
      this.history.length = 0;
      this.history.push(...sessionContent.history.map((turn) => {
        if (turn.type === "request") {
          const variables = turn.variableData?.variables.map((v) => {
            const entry = {
              ...v,
              value: revive(v.value)
            };
            return entry;
          });
          return {
            type: "request",
            prompt: turn.prompt,
            participant: turn.participant,
            command: turn.command,
            variableData: variables ? { variables } : void 0,
            id: turn.id,
            modelId: turn.modelId,
            modeInstructions: turn.modeInstructions ? revive(turn.modeInstructions) : void 0
          };
        }
        return {
          type: "response",
          parts: turn.parts.map((part) => revive(part)),
          participant: turn.participant,
          details: turn.details
        };
      }));
      if (sessionContent.hasActiveResponseCallback && !this.interruptActiveResponseCallback) {
        this.interruptActiveResponseCallback = async () => {
          const confirmInterrupt = () => {
            if (this._disposalPending) {
              this._proxy.$disposeChatSessionContent(this._providerHandle, this.sessionResource);
              this._disposalPending = false;
            }
            this._proxy.$interruptChatSessionActiveResponse(this._providerHandle, this.sessionResource, "ongoing");
            return true;
          };
          if (sessionContent.supportsInterruption) {
            return confirmInterrupt();
          }
          return this._dialogService.confirm({
            message: localize("interruptActiveResponse", "Are you sure you want to interrupt the active session?")
          }).then((confirmed) => {
            if (confirmed.confirmed) {
              return confirmInterrupt();
            } else {
              this._addProgress([{
                kind: "progressMessage",
                content: { value: "", isTrusted: false }
              }]);
              this._interruptionWasCanceled = true;
              if (this._disposalPending) {
                this._logService.info(`Canceling deferred disposal for session ${this.sessionResource} (user canceled interruption)`);
                this._disposalPending = false;
              }
              return false;
            }
          });
        };
      }
      if (sessionContent.hasRequestHandler && !this.requestHandler) {
        this.requestHandler = async (request, progress, history, token2) => {
          this._inFlightRequestCount++;
          this._progressObservable.set([], void 0);
          this._isCompleteObservable.set(false, void 0);
          let lastProgressLength = 0;
          const progressDisposable = autorun((reader) => {
            const progressArray = this._progressObservable.read(reader);
            const isComplete = this._isCompleteObservable.read(reader);
            if (progressArray.length > lastProgressLength) {
              const newProgress = progressArray.slice(lastProgressLength);
              progress(newProgress);
              lastProgressLength = progressArray.length;
            }
            if (isComplete) {
              progressDisposable.dispose();
            }
          });
          try {
            await this._proxy.$invokeChatSessionRequestHandler(this._providerHandle, this.sessionResource, request, history, token2);
            if (!this._isCompleteObservable.get() && !this.interruptActiveResponseCallback) {
              this._markComplete();
            }
          } catch (error) {
            const errorProgress = {
              kind: "progressMessage",
              content: { value: `Error: ${error instanceof Error ? error.message : String(error)}`, isTrusted: false }
            };
            this._addProgress([errorProgress]);
            this._markComplete();
            throw error;
          } finally {
            progressDisposable.dispose();
            this._inFlightRequestCount--;
            if (this._disposalPending && this._inFlightRequestCount === 0 && !this.interruptActiveResponseCallback) {
              this._disposalPending = false;
              this._proxy.$disposeChatSessionContent(this._providerHandle, this.sessionResource);
            }
          }
        };
      }
      if (sessionContent.hasForkHandler && !this.forkSession) {
        this.forkSession = async (request, token2) => {
          const result = await this._proxy.$forkChatSession(this._providerHandle, this.sessionResource, request ? this.toRequestDto(request) : void 0, token2);
          return revive(result);
        };
      }
      this._isInitialized = true;
      const hasActiveResponse = sessionContent.hasActiveResponseCallback;
      const hasRequestHandler = sessionContent.hasRequestHandler;
      const hasAnyCapability = hasActiveResponse || hasRequestHandler;
      for (const [requestId, chunks] of this._pendingProgressChunks) {
        this._logService.debug(`Processing ${chunks.length} pending progress chunks for session ${this.sessionResource}, requestId ${requestId}`);
        this._addProgress(chunks);
      }
      this._pendingProgressChunks.clear();
      if (!hasAnyCapability) {
        this._isCompleteObservable.set(true, void 0);
      }
    } catch (error) {
      this._logService.error(`Failed to initialize chat session ${this.sessionResource}:`, error);
      throw error;
    }
  }
  /**
   * Handle progress chunks coming from the extension host.
   * If the session is not initialized yet, the chunks will be queued.
   */
  handleProgressChunk(requestId, progress) {
    if (!this._isInitialized) {
      const existing = this._pendingProgressChunks.get(requestId) || [];
      this._pendingProgressChunks.set(requestId, [...existing, ...progress]);
      this._logService.debug(`Queuing ${progress.length} progress chunks for session ${this.sessionResource}, requestId ${requestId} (session not initialized)`);
      return;
    }
    this._addProgress(progress);
  }
  /**
   * Handle progress completion from the extension host.
   */
  handleProgressComplete(requestId) {
    this._pendingProgressChunks.delete(requestId);
    if (this._isInitialized) {
      if (!this._interruptionWasCanceled) {
        this._markComplete();
      } else {
        this._interruptionWasCanceled = false;
      }
    }
  }
  _addProgress(progress) {
    const currentProgress = this._progressObservable.get();
    this._progressObservable.set([...currentProgress, ...progress], void 0);
  }
  _markComplete() {
    if (!this._isCompleteObservable.get()) {
      this._isCompleteObservable.set(true, void 0);
    }
  }
  toRequestDto(request) {
    return {
      type: "request",
      id: request.id,
      prompt: request.prompt,
      participant: request.participant,
      command: request.command,
      variableData: void 0,
      modelId: request.modelId,
      modeInstructions: request.modeInstructions
    };
  }
  dispose() {
    this._onWillDispose.fire();
    this._onWillDispose.dispose();
    this._pendingProgressChunks.clear();
    if (this.interruptActiveResponseCallback && !this._interruptionWasCanceled) {
      this._disposalPending = true;
    } else if (this._inFlightRequestCount > 0) {
      this._disposalPending = true;
    } else {
      this._proxy.$disposeChatSessionContent(this._providerHandle, this.sessionResource);
    }
    super.dispose();
  }
}
let MainThreadChatSessionItemController = class extends Disposable {
  constructor(proxy, chatSessionType, handle, supportsResolve, _chatService) {
    super();
    this._chatService = _chatService;
    this._onDidChangeChatSessionItems = this._register(new Emitter());
    this.onDidChangeChatSessionItems = this._onDidChangeChatSessionItems.event;
    this._modelListeners = this._register(new DisposableResourceMap());
    this._resolveCache = new ResourceMap();
    this._resolving = new ResourceMap();
    this._isDisposed = false;
    this._items = new ResourceMap();
    this._proxy = proxy;
    this._handle = handle;
    this._supportsResolve = supportsResolve;
    const addModelListeners = async (model) => {
      if (getChatSessionType(model.sessionResource) !== chatSessionType) {
        return;
      }
      await this.refresh(CancellationToken.None);
      if (this._isDisposed) {
        return;
      }
      this.tryUpdateItemForModel(model);
      const requestChangeListener = model.lastRequestObs.map((last) => last?.response && observableSignalFromEvent("chatSessions.modelRequestChangeListener", last.response.onDidChange));
      const modelChangeListener = observableSignalFromEvent("chatSessions.modelChangeListener", model.onDidChange);
      this._modelListeners.set(model.sessionResource, autorun((reader) => {
        requestChangeListener.read(reader)?.read(reader);
        modelChangeListener.read(reader);
        this.tryUpdateItemForModel(model);
      }));
    };
    this._register(_chatService.onDidCreateModel((model) => addModelListeners(model)));
    for (const model of _chatService.chatModels.get()) {
      addModelListeners(model);
    }
    this._register(_chatService.onDidDisposeSession((e) => {
      for (const sessionResource of e.sessionResources) {
        this._modelListeners.deleteAndDispose(sessionResource);
      }
    }));
  }
  dispose() {
    this._isDisposed = true;
    this._resolveCache.clear();
    super.dispose();
  }
  get items() {
    return Array.from(this._items.values());
  }
  refresh(token) {
    return this._proxy.$refreshChatSessionItems(this._handle, token);
  }
  async newChatSessionItem(request, token) {
    const dto = await raceCancellationError(this._proxy.$newChatSessionItem(this._handle, {
      prompt: request.prompt,
      command: request.command,
      initialSessionOptions: request.initialSessionOptions ? ChatSessionOptionsMap.toStrValueArray(request.initialSessionOptions) : void 0
    }, token), token);
    if (!dto) {
      return void 0;
    }
    const item = this.addOrUpdateItem(dto);
    return item;
  }
  async acceptChange(change) {
    const addedOrUpdatedItems = [];
    for (const item of change.addedOrUpdated) {
      const resource = URI.revive(item.resource);
      if (!this._resolving.has(resource)) {
        this._resolveCache.delete(resource);
      }
      addedOrUpdatedItems.push(await this.addOrUpdateItem(item));
    }
    for (const uri of change.removed) {
      this._resolveCache.delete(uri);
      this._items.delete(uri);
    }
    this._onDidChangeChatSessionItems.fire({
      addedOrUpdated: addedOrUpdatedItems,
      removed: change.removed
    });
  }
  async addOrUpdateItem(dto) {
    const resource = URI.revive(dto.resource);
    const existing = this._items.get(resource);
    const updated = new MainThreadChatSessionItem(dto, this._chatService.getSession(resource), await this._chatService.getMetadataForSession(resource));
    if (existing?.isEqual(updated)) {
      return existing;
    }
    if (existing && existing.label !== updated.label && this._chatService.getSession(resource)) {
      this._chatService.setSessionTitle(resource, updated.label);
    }
    this._items.set(resource, updated);
    this._onDidChangeChatSessionItems.fire({
      addedOrUpdated: [updated]
    });
    return updated;
  }
  async tryUpdateItemForModel(model) {
    const resource = model.sessionResource;
    const existing = this._items.get(resource);
    if (existing) {
      this.addOrUpdateItem(existing);
    }
  }
  async getNewChatSessionInputState(sessionResource, token) {
    const optionGroups = await this._proxy.$provideChatSessionInputState(this._handle, sessionResource, token);
    if (!optionGroups?.length) {
      return void 0;
    }
    return optionGroups;
  }
  async resolveChatSessionItem(resource, token) {
    if (!this._supportsResolve) {
      return void 0;
    }
    const cached = this._resolveCache.get(resource);
    if (cached) {
      return cached;
    }
    const promise = this._doResolveItem(resource, token).catch(
      (err) => {
        this._resolveCache.delete(resource);
        throw err;
      }
    );
    this._resolveCache.set(resource, promise);
    return promise;
  }
  async _doResolveItem(resource, token) {
    const expectedItem = this._items.get(resource);
    this._resolving.set(resource, true);
    let dto;
    try {
      dto = await raceCancellationError(this._proxy.$resolveChatSessionItem(this._handle, resource, token), token);
    } finally {
      this._resolving.delete(resource);
    }
    if (!dto) {
      return void 0;
    }
    if (this._items.get(resource) !== expectedItem) {
      return this._items.get(resource);
    }
    const updated = new MainThreadChatSessionItem(
      dto,
      this._chatService.getSession(resource),
      await this._chatService.getMetadataForSession(resource)
    );
    if (this._items.get(resource) !== expectedItem) {
      return this._items.get(resource);
    }
    if (expectedItem?.isEqual(updated)) {
      return expectedItem;
    }
    this._items.set(resource, updated);
    this._onDidChangeChatSessionItems.fire({
      addedOrUpdated: [updated]
    });
    return updated;
  }
  setSupportsResolve(supportsResolve) {
    if (this._supportsResolve === supportsResolve) {
      return;
    }
    this._supportsResolve = supportsResolve;
    if (supportsResolve) {
      this._resolveCache.clear();
    }
  }
};
MainThreadChatSessionItemController = __decorateClass([
  __decorateParam(4, IChatService)
], MainThreadChatSessionItemController);
class MainThreadChatSessionItem {
  constructor(dto, model, detailOverrides) {
    this.resource = URI.revive(dto.resource);
    this.label = dto.label;
    this.timing = dto.timing;
    this.iconPath = dto.iconPath;
    this.badge = reviveMarkdownString(dto.badge);
    this.tooltip = reviveMarkdownString(dto.tooltip);
    this.archived = dto.archived;
    this.metadata = dto.metadata;
    this.legacyResource = dto.legacyResource ? URI.revive(dto.legacyResource) : void 0;
    this.description = (model && getInProgressSessionDescription(model)) ?? reviveMarkdownString(dto.description);
    this.status = (model && getSessionStatusForModel(model)) ?? dto.status;
    this.changes = revive(dto.changes);
    if (detailOverrides && !this.changes) {
      const diffs = {
        files: detailOverrides.stats?.fileCount || 0,
        insertions: detailOverrides.stats?.added || 0,
        deletions: detailOverrides.stats?.removed || 0
      };
      if (hasValidDiff(diffs)) {
        this.changes = diffs;
      }
    }
  }
  isEqual(other) {
    return isEqual(this.resource, other.resource) && this.label === other.label && this.description === other.description && this.status === other.status && this.timing.created === other.timing.created && this.timing.lastRequestStarted === other.timing.lastRequestStarted && this.timing.lastRequestEnded === other.timing.lastRequestEnded && equals(this.changes, other.changes) && equals(this.iconPath, other.iconPath) && stringOrMarkdownEqual(this.badge, other.badge) && stringOrMarkdownEqual(this.tooltip, other.tooltip) && this.archived === other.archived && equals(this.metadata, other.metadata) && isEqual(this.legacyResource, other.legacyResource);
  }
}
let MainThreadChatSessions = class extends Disposable {
  constructor(_extHostContext, _agentSessionsService, _chatSessionsService, _chatService, _chatWidgetService, _chatTodoListService, _chatArtifactsService, _chatDebugService, _dialogService, _editorService, editorGroupService, _logService, _instantiationService) {
    super();
    this._extHostContext = _extHostContext;
    this._agentSessionsService = _agentSessionsService;
    this._chatSessionsService = _chatSessionsService;
    this._chatService = _chatService;
    this._chatWidgetService = _chatWidgetService;
    this._chatTodoListService = _chatTodoListService;
    this._chatArtifactsService = _chatArtifactsService;
    this._chatDebugService = _chatDebugService;
    this._dialogService = _dialogService;
    this._editorService = _editorService;
    this.editorGroupService = editorGroupService;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._itemControllerRegistrations = this._register(new DisposableMap());
    this._contentProvidersRegistrations = this._register(new DisposableMap());
    this._sessionTypeToHandle = /* @__PURE__ */ new Map();
    this._activeSessions = new ResourceMap();
    this._sessionDisposables = new ResourceMap();
    this._proxy = this._extHostContext.getProxy(ExtHostContext.ExtHostChatSessions);
    this._register(this._chatSessionsService.onDidChangeSessionOptions(({ sessionResource, updates }) => {
      const sessionType = getChatSessionType(sessionResource);
      const handle = this._getHandleForSessionType(sessionType);
      this._logService.trace(`[MainThreadChatSessions] onRequestNotifyExtension received: sessionType '${sessionType}', handle ${handle}, ${updates.size} update(s)`);
      if (handle !== void 0) {
        this.notifyOptionsChange(handle, sessionResource, updates);
      } else {
        this._logService.warn(`[MainThreadChatSessions] Cannot notify option change for sessionType '${sessionType}': no provider registered. Registered types: [${Array.from(this._sessionTypeToHandle.keys()).join(", ")}]`);
      }
    }));
    this._register(this._agentSessionsService.model.onDidChangeSessionArchivedState((session) => {
      for (const [handle, { chatSessionType }] of this._itemControllerRegistrations) {
        if (chatSessionType === session.providerType) {
          this._proxy.$onDidChangeChatSessionItemState(handle, session.resource, session.isArchived());
        }
      }
    }));
  }
  _getHandleForSessionType(chatSessionType) {
    return this._sessionTypeToHandle.get(chatSessionType);
  }
  $registerChatSessionItemController(handle, chatSessionType, supportsResolve) {
    const disposables = new DisposableStore();
    const controller = disposables.add(this._instantiationService.createInstance(MainThreadChatSessionItemController, this._proxy, chatSessionType, handle, supportsResolve));
    disposables.add(this._chatSessionsService.registerChatSessionItemController(chatSessionType, controller));
    this._itemControllerRegistrations.set(handle, {
      chatSessionType,
      controller,
      dispose: () => disposables.dispose()
    });
    this._refreshControllerInputState(handle, chatSessionType);
  }
  $updateChatSessionItemControllerCapabilities(handle, supportsResolve) {
    const registration = this._itemControllerRegistrations.get(handle);
    if (!registration) {
      this._logService.warn(`No chat session item controller found for handle ${handle}`);
      return;
    }
    registration.controller.setSupportsResolve(supportsResolve);
  }
  _refreshControllerInputState(handle, chatSessionType) {
    this._proxy.$provideChatSessionInputState(handle, void 0, CancellationToken.None).then((optionGroups) => {
      if (optionGroups?.length) {
        this._applyOptionGroups(handle, chatSessionType, void 0, optionGroups);
      }
    }).catch((err) => this._logService.error("Error fetching chat session input state", err));
  }
  _applyOptionGroups(handle, chatSessionType, sessionResourceComponents, optionGroups) {
    this._chatSessionsService.setOptionGroupsForSessionType(chatSessionType, handle, optionGroups);
    if (sessionResourceComponents) {
      const sessionResource = URI.revive(sessionResourceComponents);
      optionGroups.forEach((group) => {
        if (group.selected) {
          this._chatSessionsService.setSessionOption(sessionResource, group.id, group.selected);
        }
      });
    }
  }
  getController(handle) {
    const registration = this._itemControllerRegistrations.get(handle);
    if (!registration) {
      throw new Error(`No chat session controller registered for handle ${handle}`);
    }
    return registration.controller;
  }
  async $updateChatSessionItems(controllerHandle, change) {
    const controller = this.getController(controllerHandle);
    controller.acceptChange({
      addedOrUpdated: change.addedOrUpdated,
      removed: change.removed.map((uri) => URI.revive(uri))
    });
  }
  async $addOrUpdateChatSessionItem(controllerHandle, item) {
    const controller = this.getController(controllerHandle);
    controller.acceptChange({
      addedOrUpdated: [item],
      removed: []
    });
  }
  $onDidChangeChatSessionOptions(handle, sessionResourceComponents, updates) {
    const sessionResource = URI.revive(sessionResourceComponents);
    this._chatSessionsService.updateSessionOptions(sessionResource, ChatSessionOptionsMap.fromRecord(updates));
  }
  async $onDidCommitChatSessionItem(handle, originalComponents, modifiedCompoennts) {
    const originalResource = URI.revive(originalComponents);
    const modifiedResource = URI.revive(modifiedCompoennts);
    this._logService.trace(`$onDidCommitChatSessionItem: handle(${handle}), original(${originalResource}), modified(${modifiedResource})`);
    const chatSessionType = this._itemControllerRegistrations.get(handle)?.chatSessionType;
    if (!chatSessionType) {
      this._logService.error(`No chat session type found for provider handle ${handle}`);
      return;
    }
    const originalEditor = this._editorService.editors.find((editor) => editor.resource?.toString() === originalResource.toString());
    const originalModel = this._chatService.acquireExistingSession(originalResource);
    const contribution = this._chatSessionsService.getAllChatSessionContributions().find((c) => c.type === chatSessionType);
    try {
      this._chatTodoListService.migrateTodos(originalResource, modifiedResource);
      this._chatArtifactsService.getArtifacts(originalResource).migrate(this._chatArtifactsService.getArtifacts(modifiedResource));
      if (chatSessionType === "copilotcli") {
        this._chatDebugService.invokeProviders(modifiedResource).catch(() => {
        });
      }
      const originalGroup = this.editorGroupService.groups.find((group) => group.editors.some((editor) => isEqual(editor.resource, originalResource))) ?? this.editorGroupService.activeGroup;
      const options = {
        title: {
          preferred: originalEditor?.getName() || void 0,
          fallback: localize("chatEditorContributionName", "{0}", contribution?.displayName)
        }
      };
      const newSession = await this._chatSessionsService.getOrCreateChatSession(
        URI.revive(modifiedResource),
        CancellationToken.None
      );
      if (originalEditor) {
        newSession.transferredState = originalEditor instanceof ChatEditorInput ? { editingSession: originalEditor.transferOutEditingSession(), inputState: originalModel?.object?.inputModel.toJSON() } : void 0;
        await this._editorService.replaceEditors([{
          editor: originalEditor,
          replacement: {
            resource: modifiedResource,
            options
          }
        }], originalGroup);
        this._resendPendingRequests(originalResource, modifiedResource);
        return;
      }
      if (originalModel) {
        newSession.transferredState = {
          editingSession: originalModel.object.editingSession,
          inputState: originalModel.object.inputModel.toJSON()
        };
      }
      const chatViewWidget = this._chatWidgetService.getWidgetBySessionResource(originalResource);
      if (chatViewWidget && isIChatViewViewContext(chatViewWidget.viewContext)) {
        await this._chatWidgetService.openSession(modifiedResource, void 0, { preserveFocus: true });
      } else if (!chatViewWidget) {
        const ref = await this._chatService.acquireOrLoadSession(modifiedResource, ChatAgentLocation.Chat, CancellationToken.None);
        ref?.dispose();
      }
      this._resendPendingRequests(originalResource, modifiedResource);
      this._chatSessionsService.fireSessionCommitted(originalResource, modifiedResource);
    } finally {
      originalModel?.dispose();
    }
  }
  /**
   * Re-sends pending and in-flight requests from the original session on the committed session.
   */
  _resendPendingRequests(originalResource, modifiedResource) {
    this._chatService.migrateRequests(originalResource, modifiedResource);
  }
  async _provideChatSessionContent(providerHandle, sessionResource, token) {
    const t0 = Date.now();
    this._logService.trace(`[MainThreadChatSessions] _provideChatSessionContent start handle=${providerHandle} uri=${sessionResource.toString()}`);
    let session = this._activeSessions.get(sessionResource);
    if (!session) {
      session = new ObservableChatSession(
        sessionResource,
        providerHandle,
        this._proxy,
        this._logService,
        this._dialogService
      );
      this._activeSessions.set(sessionResource, session);
      const disposable = session.onWillDispose(() => {
        this._activeSessions.delete(sessionResource);
        this._sessionDisposables.get(sessionResource)?.dispose();
        this._sessionDisposables.delete(sessionResource);
      });
      this._sessionDisposables.set(sessionResource, disposable);
    }
    try {
      const initialSessionOptions = this._chatSessionsService.getSessionOptions(sessionResource);
      await session.initialize(token, {
        initialSessionOptions: initialSessionOptions ? [...initialSessionOptions].map(([optionId, value]) => ({ optionId, value: typeof value === "string" ? value : value?.id })) : void 0
      });
      if (session.options) {
        for (const [_, handle] of this._sessionTypeToHandle) {
          if (handle === providerHandle) {
            for (const [optionId, value] of session.options) {
              this._chatSessionsService.setSessionOption(sessionResource, optionId, value);
            }
            break;
          }
        }
      }
      this._logService.trace(`[MainThreadChatSessions] _provideChatSessionContent done total=${Date.now() - t0}ms handle=${providerHandle} uri=${sessionResource.toString()}`);
      return session;
    } catch (error) {
      session.dispose();
      this._logService.error(`Error providing chat session content for handle ${providerHandle} and resource ${sessionResource.toString()}:`, error);
      throw error;
    }
  }
  $unregisterChatSessionItemController(handle) {
    this._itemControllerRegistrations.deleteAndDispose(handle);
  }
  $registerChatSessionContentProvider(handle, chatSessionScheme) {
    const provider = {
      provideChatSessionContent: (resource, token) => this._provideChatSessionContent(handle, resource, token)
    };
    this._sessionTypeToHandle.set(chatSessionScheme, handle);
    this._contentProvidersRegistrations.set(handle, this._chatSessionsService.registerChatSessionContentProvider(chatSessionScheme, provider));
    this._refreshProviderOptions(handle, chatSessionScheme);
  }
  $unregisterChatSessionContentProvider(handle) {
    this._contentProvidersRegistrations.deleteAndDispose(handle);
    for (const [sessionType, h] of this._sessionTypeToHandle) {
      if (h === handle) {
        this._sessionTypeToHandle.delete(sessionType);
        break;
      }
    }
    for (const [key, session] of this._activeSessions) {
      if (session.providerHandle === handle) {
        session.dispose();
        this._activeSessions.delete(key);
      }
    }
  }
  async $handleProgressChunk(handle, sessionResource, requestId, chunks) {
    const resource = URI.revive(sessionResource);
    const observableSession = this._activeSessions.get(resource);
    if (!observableSession) {
      this._logService.warn(`No session found for progress chunks: handle ${handle}, sessionResource ${resource}, requestId ${requestId}`);
      return;
    }
    const chatProgressParts = chunks.map((chunk) => {
      const [progress] = Array.isArray(chunk) ? chunk : [chunk];
      return revive(progress);
    });
    observableSession.handleProgressChunk(requestId, chatProgressParts);
  }
  $handleProgressComplete(handle, sessionResource, requestId) {
    const resource = URI.revive(sessionResource);
    const observableSession = this._activeSessions.get(resource);
    if (!observableSession) {
      this._logService.warn(`No session found for progress completion: handle ${handle}, sessionResource ${resource}, requestId ${requestId}`);
      return;
    }
    observableSession.handleProgressComplete(requestId);
  }
  $handleAnchorResolve(handle, sesssionResource, requestId, requestHandle, anchor) {
  }
  $onDidChangeChatSessionProviderOptions(handle) {
    let sessionType;
    for (const [type, h] of this._sessionTypeToHandle) {
      if (h === handle) {
        sessionType = type;
        break;
      }
    }
    if (!sessionType) {
      this._logService.warn(`No session type found for chat session content provider handle ${handle} when refreshing provider options`);
      return;
    }
    this._refreshProviderOptions(handle, sessionType);
  }
  $updateChatSessionInputState(controllerHandle, sessionResource, optionGroups) {
    const registration = this._itemControllerRegistrations.get(controllerHandle);
    if (!registration) {
      this._logService.warn(`No controller found for handle ${controllerHandle} when updating input state`);
      return;
    }
    this._applyOptionGroups(controllerHandle, registration.chatSessionType, sessionResource, optionGroups);
  }
  _refreshProviderOptions(handle, chatSessionScheme) {
    this._proxy.$provideChatSessionProviderOptions(handle, CancellationToken.None).then((options) => {
      if (options?.optionGroups && options.optionGroups.length) {
        this._chatSessionsService.setOptionGroupsForSessionType(chatSessionScheme, handle, [...options.optionGroups]);
      }
    }).catch((err) => this._logService.error("Error fetching chat session options", err));
  }
  dispose() {
    for (const session of this._activeSessions.values()) {
      session.dispose();
    }
    this._activeSessions.clear();
    for (const disposable of this._sessionDisposables.values()) {
      disposable.dispose();
    }
    this._sessionDisposables.clear();
    super.dispose();
  }
  /**
   * Notify the extension about option changes for a session
   */
  async notifyOptionsChange(handle, sessionResource, updates) {
    this._logService.trace(`[MainThreadChatSessions] notifyOptionsChange: starting proxy call for handle ${handle}, sessionResource ${sessionResource}`);
    try {
      await this._proxy.$provideHandleOptionsChange(handle, sessionResource, Object.fromEntries(updates), CancellationToken.None);
      this._logService.trace(`[MainThreadChatSessions] notifyOptionsChange: proxy call completed for handle ${handle}, sessionResource ${sessionResource}`);
    } catch (error) {
      this._logService.error(`[MainThreadChatSessions] notifyOptionsChange: error for handle ${handle}, sessionResource ${sessionResource}:`, error);
    }
  }
};
MainThreadChatSessions = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatSessions),
  __decorateParam(1, IAgentSessionsService),
  __decorateParam(2, IChatSessionsService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatWidgetService),
  __decorateParam(5, IChatTodoListService),
  __decorateParam(6, IChatArtifactsService),
  __decorateParam(7, IChatDebugService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IEditorGroupsService),
  __decorateParam(11, ILogService),
  __decorateParam(12, IInstantiationService)
], MainThreadChatSessions);
function reviveMarkdownString(value) {
  if (!value) {
    return void 0;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && "value" in value) {
    return MarkdownString.lift(value);
  }
  return void 0;
}
export {
  MainThreadChatSessions,
  ObservableChatSession
};
