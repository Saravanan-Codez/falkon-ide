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
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IAgentEditorCommentsBridge } from "../../../../workbench/services/agentEditorComments/common/agentEditorComments.js";
import { IAgentFeedbackService } from "./agentFeedbackService.js";
import { getSessionEditorComments, fromSessionEditorCommentId, SessionEditorCommentSource } from "./sessionEditorComments.js";
import { IPlanReviewFeedbackService } from "../../../../workbench/contrib/chat/browser/planReviewFeedback/planReviewFeedbackService.js";
import { AgentFeedbackState } from "./agentFeedbackModel.js";
let AgentEditorCommentsProviderContribution = class extends Disposable {
  constructor(_agentFeedbackService, planReviewFeedbackService, bridge) {
    super();
    this._agentFeedbackService = _agentFeedbackService;
    this.priority = 100;
    this._planScopes = this._register(new DisposableMap());
    this.onDidChangeComments = Event.signal(Event.any(this._agentFeedbackService.onDidChangeFeedback, this._agentFeedbackService.onDidChangeFeedbackScope));
    this.onDidRevealComment = Event.map(this._agentFeedbackService.onDidRevealSessionComment, (event) => ({ resource: event.resourceUri, id: event.commentId }));
    this._register(bridge.registerProvider(this));
    this._register(planReviewFeedbackService.onDidChangePlanReviewScope(({ planUri, sessionResource, active }) => {
      if (active) {
        this._planScopes.set(planUri.toString(), this._agentFeedbackService.registerFeedbackResourceScope(planUri, sessionResource));
      } else {
        this._planScopes.deleteAndDispose(planUri.toString());
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentEditorCommentsProvider";
  }
  acceptsComments(resource) {
    return !!this._agentFeedbackService.getFeedbackSessionResource(resource);
  }
  getComments(resource, includeRelated = false) {
    const sessionResource = this._getSessionResource(resource);
    if (!sessionResource) {
      return [];
    }
    const comments = [];
    const sessionComments = getSessionEditorComments(sessionResource, this._agentFeedbackService.getFeedback(sessionResource));
    for (const comment of sessionComments) {
      if (includeRelated && comment.source === SessionEditorCommentSource.AgentFeedback && comment.state === AgentFeedbackState.Accepted || !includeRelated && isEqual(comment.resourceUri, resource)) {
        comments.push({ id: comment.id, resource: comment.resourceUri, range: comment.range, body: comment.text });
      }
    }
    return comments;
  }
  getCommentIds(resource, includeRelated = false) {
    const sessionResource = this._getSessionResource(resource);
    if (!sessionResource) {
      return [];
    }
    return getSessionEditorComments(sessionResource, this._agentFeedbackService.getFeedback(sessionResource)).filter((comment) => includeRelated || isEqual(comment.resourceUri, resource)).map((comment) => comment.id);
  }
  addComment(resource, range, body) {
    const sessionResource = this._getSessionResource(resource);
    if (!sessionResource) {
      return;
    }
    this._agentFeedbackService.addFeedback(sessionResource, resource, range, body);
  }
  deleteComment(resource, id) {
    const sessionResource = this._getSessionResource(resource);
    if (!sessionResource) {
      return;
    }
    const parsed = fromSessionEditorCommentId(id);
    if (parsed?.source !== SessionEditorCommentSource.AgentFeedback) {
      return;
    }
    this._agentFeedbackService.removeFeedback(sessionResource, parsed.sourceId);
  }
  _getSessionResource(resource) {
    return this._agentFeedbackService.getFeedbackSessionResource(resource);
  }
};
AgentEditorCommentsProviderContribution = __decorateClass([
  __decorateParam(0, IAgentFeedbackService),
  __decorateParam(1, IPlanReviewFeedbackService),
  __decorateParam(2, IAgentEditorCommentsBridge)
], AgentEditorCommentsProviderContribution);
export {
  AgentEditorCommentsProviderContribution
};
