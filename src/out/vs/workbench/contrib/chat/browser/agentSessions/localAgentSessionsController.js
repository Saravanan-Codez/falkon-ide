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
import { coalesce } from "../../../../../base/common/arrays.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableResourceMap } from "../../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { equals } from "../../../../../base/common/objects.js";
import { autorun, observableSignalFromEvent } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { convertLegacyChatSessionTiming, IChatService } from "../../common/chatService/chatService.js";
import { chatModelToChatDetail } from "../../common/chatService/chatServiceImpl.js";
import { IChatSessionsService, localChatSessionType } from "../../common/chatSessionsService.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { getInProgressSessionDescription } from "../chatSessions/chatSessionDescription.js";
import { chatResponseStateToSessionStatus, getSessionStatusForModel } from "../chatSessions/chatSessions.contribution.js";
import { Schemas } from "../../../../../base/common/network.js";
let LocalAgentsSessionsController = class extends Disposable {
  constructor(chatService, chatSessionsService) {
    super();
    this.chatService = chatService;
    this.chatSessionsService = chatSessionsService;
    this.chatSessionType = localChatSessionType;
    this._onDidChangeChatSessionItems = this._register(new Emitter());
    this.onDidChangeChatSessionItems = this._onDidChangeChatSessionItems.event;
    this._modelListeners = this._register(new DisposableResourceMap());
    this._isDisposed = false;
    this._items = new ResourceMap();
    this._register(this.chatSessionsService.registerChatSessionItemController(this.chatSessionType, this));
    this.registerListeners();
  }
  static {
    this.ID = "workbench.contrib.localAgentsSessionsController";
  }
  dispose() {
    this._isDisposed = true;
    super.dispose();
  }
  get items() {
    return Array.from(this._items.values());
  }
  async refresh(token) {
    const newItems = await this.provideChatSessionItems(token);
    const newResources = new ResourceSet(newItems.map((i) => i.resource));
    const addedOrUpdated = [];
    const removed = [];
    for (const item of newItems) {
      if (!this._items.has(item.resource)) {
        addedOrUpdated.push(item);
      }
    }
    for (const resource of this._items.keys()) {
      if (!newResources.has(resource)) {
        removed.push(resource);
      }
    }
    this._items.clear();
    for (const item of newItems) {
      this._items.set(item.resource, item);
    }
    if (addedOrUpdated.length > 0 || removed.length > 0) {
      this._onDidChangeChatSessionItems.fire({
        ...addedOrUpdated.length > 0 ? { addedOrUpdated } : void 0,
        ...removed.length > 0 ? { removed } : void 0
      });
    }
  }
  registerListeners() {
    const addModelListeners = async (model) => {
      if (getChatSessionType(model.sessionResource) !== this.chatSessionType) {
        return;
      }
      await this.refresh(CancellationToken.None);
      if (this._isDisposed) {
        return;
      }
      this.tryUpdateLiveSessionItem(model);
      const requestChangeListener = model.lastRequestObs.map((last) => last?.response && observableSignalFromEvent("chatSessions.modelRequestChangeListener", last.response.onDidChange));
      const modelChangeListener = observableSignalFromEvent("chatSessions.modelChangeListener", model.onDidChange);
      this._modelListeners.set(model.sessionResource, autorun((reader) => {
        requestChangeListener.read(reader)?.read(reader);
        modelChangeListener.read(reader);
        this.tryUpdateLiveSessionItem(model);
      }));
    };
    this._register(this.chatService.onDidCreateModel((model) => addModelListeners(model)));
    for (const model of this.chatService.chatModels.get()) {
      addModelListeners(model);
    }
    this._register(this.chatService.onDidDisposeSession((e) => {
      for (const sessionResource of e.sessionResources) {
        this._modelListeners.deleteAndDispose(sessionResource);
      }
      const removedSessionResources = e.sessionResources.filter((resource) => getChatSessionType(resource) === this.chatSessionType);
      if (removedSessionResources.length) {
        for (const resource of removedSessionResources) {
          this._items.delete(resource);
        }
        this._onDidChangeChatSessionItems.fire({ removed: removedSessionResources });
      }
    }));
  }
  async tryUpdateLiveSessionItem(model) {
    const updated = this.toChatSessionItem(await chatModelToChatDetail(model));
    if (!updated) {
      if (this._items.has(model.sessionResource)) {
        this._items.delete(model.sessionResource);
        this._onDidChangeChatSessionItems.fire({ removed: [model.sessionResource] });
      }
      return;
    }
    const existing = this._items.get(updated.resource);
    if (existing?.isEqual(updated)) {
      return;
    }
    this._items.set(updated.resource, updated);
    this._onDidChangeChatSessionItems.fire({ addedOrUpdated: [updated] });
  }
  async provideChatSessionItems(token) {
    const sessions = [];
    const sessionsByResource = new ResourceSet();
    for (const sessionDetail of await this.chatService.getLiveSessionItems()) {
      const editorSession = this.toChatSessionItem(sessionDetail);
      if (!editorSession) {
        continue;
      }
      sessionsByResource.add(sessionDetail.sessionResource);
      sessions.push(editorSession);
    }
    if (!token.isCancellationRequested) {
      const history = await this.getHistoryItems();
      sessions.push(...history.filter((historyItem) => !sessionsByResource.has(historyItem.resource)));
    }
    return sessions;
  }
  async getHistoryItems() {
    try {
      const historyItems = await this.chatService.getHistorySessionItems();
      return coalesce(historyItems.map((history) => this.toChatSessionItem(history)));
    } catch (error) {
      return [];
    }
  }
  toChatSessionItem(chat) {
    const model = this.chatService.getSession(chat.sessionResource);
    if (model) {
      if (!model.hasRequests) {
        return void 0;
      }
    } else if (chat.isActive) {
      return void 0;
    }
    return new LocalChatSessionItem(chat, model);
  }
};
LocalAgentsSessionsController = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, IChatSessionsService)
], LocalAgentsSessionsController);
class LocalChatSessionItem {
  constructor(chatDetail, model) {
    this.iconPath = Codicon.chatSparkle;
    this.resource = chatDetail.sessionResource;
    this.label = chatDetail.title;
    this.description = model ? getInProgressSessionDescription(model) : void 0;
    this.status = (model && getSessionStatusForModel(model)) ?? chatResponseStateToSessionStatus(chatDetail.lastResponseState);
    this.timing = convertLegacyChatSessionTiming(chatDetail.timing);
    this.changes = chatDetail.stats ? {
      insertions: chatDetail.stats.added,
      deletions: chatDetail.stats.removed,
      files: chatDetail.stats.fileCount
    } : void 0;
    const workingDirectoryPath = chatDetail.workingDirectory?.scheme === Schemas.file ? chatDetail.workingDirectory.fsPath : void 0;
    this.metadata = workingDirectoryPath ? { workingDirectoryPath } : void 0;
  }
  isEqual(other) {
    return isEqual(this.resource, other.resource) && this.label === other.label && this.description === other.description && this.status === other.status && this.timing.created === other.timing.created && this.timing.lastRequestStarted === other.timing.lastRequestStarted && this.timing.lastRequestEnded === other.timing.lastRequestEnded && equals(this.changes, other.changes);
  }
}
export {
  LocalAgentsSessionsController
};
