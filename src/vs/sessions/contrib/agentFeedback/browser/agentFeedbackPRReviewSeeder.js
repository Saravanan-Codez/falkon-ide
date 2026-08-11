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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableSignalFromEvent } from "../../../../base/common/observable.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ICodeReviewService, PRReviewStateKind } from "../../codeReview/browser/codeReviewService.js";
import { AgentFeedbackKind, AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
let AgentFeedbackPRReviewSeederContribution = class extends Disposable {
  constructor(_agentFeedbackService, _codeReviewService, _sessionsService) {
    super();
    this._agentFeedbackService = _agentFeedbackService;
    this._codeReviewService = _codeReviewService;
    this._sessionsService = _sessionsService;
    const feedbackChanged = observableSignalFromEvent(this, this._agentFeedbackService.onDidChangeFeedback);
    this._register(autorun((reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      if (!activeSession || !isAgentHostProviderId(activeSession.providerId)) {
        return;
      }
      const sessionResource = activeSession.resource;
      const prReviewState = this._codeReviewService.getPRReviewState(sessionResource).read(reader);
      feedbackChanged.read(reader);
      if (prReviewState.kind !== PRReviewStateKind.Loaded) {
        return;
      }
      this._sync(sessionResource, prReviewState.comments);
    }));
  }
  static {
    this.ID = "workbench.contrib.agentFeedbackPRReviewSeeder";
  }
  _sync(sessionResource, comments) {
    if (!this._agentFeedbackService.hasLoadedFeedback(sessionResource)) {
      return;
    }
    const feedback = this._agentFeedbackService.getFeedback(sessionResource);
    const mirroredSourceIds = /* @__PURE__ */ new Set();
    const createdMirrorBySource = /* @__PURE__ */ new Map();
    const duplicateCreatedMirrors = [];
    for (const item of feedback) {
      if (item.kind === AgentFeedbackKind.PRReview && item.sourcePRReviewCommentId) {
        mirroredSourceIds.add(item.sourcePRReviewCommentId);
        if (item.state === AgentFeedbackState.Created) {
          if (createdMirrorBySource.has(item.sourcePRReviewCommentId)) {
            duplicateCreatedMirrors.push(item);
          } else {
            createdMirrorBySource.set(item.sourcePRReviewCommentId, item);
          }
        }
      }
    }
    for (const duplicate of duplicateCreatedMirrors) {
      this._agentFeedbackService.removeFeedback(sessionResource, duplicate.id);
    }
    for (const comment of comments) {
      const createdMirror = createdMirrorBySource.get(comment.id);
      if (createdMirror) {
        if (createdMirror.text !== comment.body) {
          this._agentFeedbackService.updateFeedback(sessionResource, createdMirror.id, comment.body);
        }
        continue;
      }
      if (!mirroredSourceIds.has(comment.id)) {
        this._agentFeedbackService.addFeedback(
          sessionResource,
          comment.uri,
          comment.range,
          comment.body,
          void 0,
          void 0,
          comment.id,
          AgentFeedbackKind.PRReview,
          AgentFeedbackState.Created
        );
      }
    }
    const liveSourceIds = new Set(comments.map((comment) => comment.id));
    for (const item of feedback) {
      if (item.kind === AgentFeedbackKind.PRReview && item.state === AgentFeedbackState.Created && item.sourcePRReviewCommentId && !liveSourceIds.has(item.sourcePRReviewCommentId)) {
        this._agentFeedbackService.removeFeedback(sessionResource, item.id);
      }
    }
  }
};
AgentFeedbackPRReviewSeederContribution = __decorateClass([
  __decorateParam(0, IAgentFeedbackService),
  __decorateParam(1, ICodeReviewService),
  __decorateParam(2, ISessionsService)
], AgentFeedbackPRReviewSeederContribution);
export {
  AgentFeedbackPRReviewSeederContribution
};
