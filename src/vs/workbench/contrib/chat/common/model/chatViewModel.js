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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, dispose } from "../../../../../base/common/lifecycle.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ChatRequestQueueKind } from "../chatService/chatService.js";
import { getFullyQualifiedId, IChatAgentNameService } from "../participants/chatAgents.js";
import { ChatStreamStatsTracker } from "./chatStreamStats.js";
import { countWords } from "./chatWordCounter.js";
function isRequestVM(item) {
  return !!item && typeof item === "object" && "message" in item;
}
function isResponseVM(item) {
  return !!item && typeof item.setVote !== "undefined";
}
function isPendingDividerVM(item) {
  return !!item && typeof item === "object" && item.kind === "pendingDivider";
}
function isPendingChatViewModelItem(item) {
  return item.kind === "pendingDivider" || item.pendingKind !== void 0;
}
function getStickyScrollTargetItem(items) {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!isPendingChatViewModelItem(item)) {
      return item;
    }
  }
  return items.at(-1);
}
function isChatTreeItem(item) {
  return isRequestVM(item) || isResponseVM(item);
}
function assertIsResponseVM(item) {
  if (!isResponseVM(item)) {
    throw new Error("Expected item to be IChatResponseViewModel");
  }
}
let ChatViewModel = class extends Disposable {
  constructor(_model, _options, instantiationService) {
    super();
    this._model = _model;
    this._options = _options;
    this.instantiationService = instantiationService;
    this._onDidDisposeModel = this._register(new Emitter());
    this.onDidDisposeModel = this._onDidDisposeModel.event;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._items = [];
    this._inputPlaceholder = void 0;
    this._editing = void 0;
    _model.getRequests().forEach((request, i) => {
      const requestModel = this.instantiationService.createInstance(ChatRequestViewModel, request);
      this._items.push(requestModel);
      if (request.response) {
        this.onAddResponse(request.response);
      }
    });
    this._register(_model.onDidDispose(() => this._onDidDisposeModel.fire()));
    this._register(_model.onDidChangePendingRequests(() => this._onDidChange.fire(null)));
    this._register(_model.onDidChange((e) => {
      if (e.kind === "addRequest") {
        const requestModel = this.instantiationService.createInstance(ChatRequestViewModel, e.request);
        this._items.push(requestModel);
        if (e.request.response) {
          this.onAddResponse(e.request.response);
        }
      } else if (e.kind === "addResponse") {
        this.onAddResponse(e.response);
      } else if (e.kind === "removeRequest") {
        const requestIdx = this._items.findIndex((item) => isRequestVM(item) && item.id === e.requestId);
        if (requestIdx >= 0) {
          this._items.splice(requestIdx, 1);
        }
        const responseIdx = e.responseId && this._items.findIndex((item) => isResponseVM(item) && item.id === e.responseId);
        if (typeof responseIdx === "number" && responseIdx >= 0) {
          const items = this._items.splice(responseIdx, 1);
          const item = items[0];
          if (item instanceof ChatResponseViewModel) {
            item.dispose();
          }
        }
      }
      const modelEventToVmEvent = e.kind === "addRequest" ? { kind: "addRequest" } : e.kind === "initialize" ? { kind: "initialize" } : e.kind === "setHidden" ? { kind: "setHidden" } : null;
      this._onDidChange.fire(modelEventToVmEvent);
    }));
  }
  get inputPlaceholder() {
    return this._inputPlaceholder;
  }
  get model() {
    return this._model;
  }
  setInputPlaceholder(text) {
    this._inputPlaceholder = text;
    this._onDidChange.fire({ kind: "changePlaceholder" });
  }
  resetInputPlaceholder() {
    this._inputPlaceholder = void 0;
    this._onDidChange.fire({ kind: "changePlaceholder" });
  }
  get sessionResource() {
    return this._model.sessionResource;
  }
  onAddResponse(responseModel) {
    const response = this.instantiationService.createInstance(ChatResponseViewModel, responseModel, this);
    this._register(response.onDidChange(() => {
      return this._onDidChange.fire(null);
    }));
    this._items.push(response);
  }
  getItems() {
    let items = this._items.filter((item) => {
      if (item.shouldBeRemovedOnSend && !item.shouldBeRemovedOnSend.afterUndoStop) {
        return false;
      }
      return true;
    });
    if (this._options?.maxVisibleItems !== void 0 && items.length > this._options.maxVisibleItems) {
      items = items.slice(-this._options.maxVisibleItems);
    }
    const pendingRequests = this._model.getPendingRequests();
    if (pendingRequests.length > 0) {
      const steeringRequests = pendingRequests.filter((p) => p.kind === ChatRequestQueueKind.Steering);
      const queuedRequests = pendingRequests.filter((p) => p.kind === ChatRequestQueueKind.Queued);
      if (steeringRequests.length > 0) {
        const isSystemInitiated = steeringRequests.every((p) => p.request.isSystemInitiated);
        items.push({ kind: "pendingDivider", id: "pending-divider-steering", sessionResource: this._model.sessionResource, isComplete: true, dividerKind: ChatRequestQueueKind.Steering, isSystemInitiated, currentRenderedHeight: void 0 });
        for (const pending of steeringRequests) {
          const requestVM = this.instantiationService.createInstance(ChatRequestViewModel, pending.request, pending.kind);
          items.push(requestVM);
        }
      }
      if (queuedRequests.length > 0) {
        items.push({ kind: "pendingDivider", id: "pending-divider-queued", sessionResource: this._model.sessionResource, isComplete: true, dividerKind: ChatRequestQueueKind.Queued, currentRenderedHeight: void 0 });
        for (const pending of queuedRequests) {
          const requestVM = this.instantiationService.createInstance(ChatRequestViewModel, pending.request, pending.kind);
          items.push(requestVM);
        }
      }
    }
    return items;
  }
  get editing() {
    return this._editing;
  }
  setEditing(editing) {
    if (this.editing && editing && this.editing.id === editing.id) {
      return;
    }
    this._editing = editing;
  }
  dispose() {
    super.dispose();
    dispose(this._items.filter((item) => item instanceof ChatResponseViewModel));
    this._items.length = 0;
  }
};
ChatViewModel = __decorateClass([
  __decorateParam(2, IInstantiationService)
], ChatViewModel);
class ChatRequestViewModel {
  constructor(_model, _pendingKind) {
    this._model = _model;
    this._pendingKind = _pendingKind;
  }
  get id() {
    return this._model.id;
  }
  /**
   * An ID that changes when the request should be re-rendered.
   */
  get dataId() {
    return `${this.id}_${this._model.version + (this._model.response?.isComplete ? 1 : 0)}`;
  }
  get sessionResource() {
    return this._model.session.sessionResource;
  }
  get username() {
    return "User";
  }
  get avatarIcon() {
    return Codicon.account;
  }
  get message() {
    return this._model.message;
  }
  get messageText() {
    return this.message.text;
  }
  get attempt() {
    return this._model.attempt;
  }
  get variables() {
    return this._model.variableData.variables;
  }
  get contentReferences() {
    return this._model.response?.contentReferences;
  }
  get confirmation() {
    return this._model.confirmation;
  }
  get isComplete() {
    return this._model.response?.isComplete ?? false;
  }
  get isCompleteAddedRequest() {
    return this._model.isCompleteAddedRequest;
  }
  get isTerminalCommand() {
    return this._model.isTerminalCommand;
  }
  get shouldBeRemovedOnSend() {
    return this._model.shouldBeRemovedOnSend;
  }
  get shouldBeBlocked() {
    return this._model.shouldBeBlocked;
  }
  get slashCommand() {
    return this._model.response?.slashCommand;
  }
  get agentOrSlashCommandDetected() {
    return this._model.response?.agentOrSlashCommandDetected ?? false;
  }
  get attachedContext() {
    return this._model.attachedContext;
  }
  get modelId() {
    return this._model.modelId;
  }
  get resolvedModelId() {
    const resolvedModel = this._model.response?.result?.metadata?.resolvedModel;
    return typeof resolvedModel === "string" ? resolvedModel : void 0;
  }
  get timestamp() {
    return this._model.timestamp;
  }
  get requestTimestamp() {
    return this._model.requestTimestamp;
  }
  get pendingKind() {
    return this._pendingKind;
  }
  get isSystemInitiated() {
    return this._model.isSystemInitiated;
  }
  get systemInitiatedLabel() {
    return this._model.systemInitiatedLabel;
  }
}
let ChatResponseViewModel = class extends Disposable {
  constructor(_model, session, instantiationService, chatAgentNameService) {
    super();
    this._model = _model;
    this.session = session;
    this.instantiationService = instantiationService;
    this.chatAgentNameService = chatAgentNameService;
    this._modelChangeCount = 0;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.renderData = void 0;
    this._vulnerabilitiesListExpanded = false;
    if (!_model.isComplete) {
      this.liveUpdateTracker = this.instantiationService.createInstance(ChatStreamStatsTracker);
    }
    const wordCountScheduler = this.liveUpdateTracker ? this._register(new RunOnceScheduler(() => {
      const wordCount = countWords(_model.entireResponse.getMarkdown());
      this.liveUpdateTracker.update({ totalWordCount: wordCount });
    }, 0)) : void 0;
    this._register(_model.onDidChange(() => {
      wordCountScheduler?.schedule();
      this._modelChangeCount++;
      this._onDidChange.fire();
    }));
  }
  get model() {
    return this._model;
  }
  get id() {
    return this._model.id;
  }
  get dataId() {
    return this._model.id + `_${this._modelChangeCount}` + (this.isLast ? "_last" : "");
  }
  get sessionResource() {
    return this._model.session.sessionResource;
  }
  get username() {
    if (this.agent) {
      const isAllowed = this.chatAgentNameService.getAgentNameRestriction(this.agent);
      if (isAllowed) {
        return this.agent.fullName || this.agent.name;
      } else {
        return getFullyQualifiedId(this.agent);
      }
    }
    return this._model.username;
  }
  get agent() {
    return this._model.agent;
  }
  get slashCommand() {
    return this._model.slashCommand;
  }
  get agentOrSlashCommandDetected() {
    return this._model.agentOrSlashCommandDetected;
  }
  get response() {
    return this._model.response;
  }
  get usedContext() {
    return this._model.usedContext;
  }
  get contentReferences() {
    return this._model.contentReferences;
  }
  get codeCitations() {
    return this._model.codeCitations;
  }
  get progressMessages() {
    return this._model.progressMessages;
  }
  get isComplete() {
    return this._model.isComplete;
  }
  get isCanceled() {
    return this._model.isCanceled;
  }
  get shouldBeBlocked() {
    return this._model.shouldBeBlocked;
  }
  get shouldBeRemovedOnSend() {
    return this._model.shouldBeRemovedOnSend;
  }
  get isCompleteAddedRequest() {
    return this._model.isCompleteAddedRequest;
  }
  get isTerminalCommand() {
    return this._model.request?.isTerminalCommand ?? false;
  }
  get replyFollowups() {
    return this._model.followups?.filter((f) => f.kind === "reply");
  }
  get result() {
    return this._model.result;
  }
  get errorDetails() {
    return this.result?.errorDetails;
  }
  get vote() {
    return this._model.vote;
  }
  get requestId() {
    return this._model.requestId;
  }
  get isStale() {
    return this._model.isStale;
  }
  get isLast() {
    return this.session.getItems().at(-1) === this;
  }
  get usedReferencesExpanded() {
    if (typeof this._usedReferencesExpanded === "boolean") {
      return this._usedReferencesExpanded;
    }
    return void 0;
  }
  set usedReferencesExpanded(v) {
    this._usedReferencesExpanded = v;
  }
  get vulnerabilitiesListExpanded() {
    return this._vulnerabilitiesListExpanded;
  }
  set vulnerabilitiesListExpanded(v) {
    this._vulnerabilitiesListExpanded = v;
  }
  get contentUpdateTimings() {
    return this.liveUpdateTracker?.data;
  }
  get confirmationAdjustedTimestamp() {
    return this._model.confirmationAdjustedTimestamp;
  }
  get usageObs() {
    return this._model.usageObs;
  }
  get completionTokenCountObs() {
    return this._model.completionTokenCountObs;
  }
  setVote(vote) {
    this._modelChangeCount++;
    this._model.setVote(vote);
  }
  setEditApplied(edit, editCount) {
    this._modelChangeCount++;
    this._model.setEditApplied(edit, editCount);
  }
};
ChatResponseViewModel = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IChatAgentNameService)
], ChatResponseViewModel);
export {
  ChatRequestViewModel,
  ChatResponseViewModel,
  ChatViewModel,
  assertIsResponseVM,
  getStickyScrollTargetItem,
  isChatTreeItem,
  isPendingDividerVM,
  isRequestVM,
  isResponseVM
};
