import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { constObservable } from "../../../../base/common/observable.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { AGENT_FEEDBACK_NEW_SESSION_RESOURCE, AgentFeedbackKind, AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
class NullAgentFeedbackService extends Disposable {
  constructor() {
    super(...arguments);
    this.onDidChangeFeedback = this._register(new Emitter()).event;
    this.onDidChangeNavigation = this._register(new Emitter()).event;
    this.onDidRevealSessionComment = this._register(new Emitter()).event;
    this.onDidChangeFeedbackScope = this._register(new Emitter()).event;
    this.activeFeedbackSessionResource = constObservable(AGENT_FEEDBACK_NEW_SESSION_RESOURCE);
    this.onDidAddFeedback = this._register(new Emitter()).event;
    this.onDidConvertFeedback = this._register(new Emitter()).event;
    this.onDidAddReply = this._register(new Emitter()).event;
    this.onDidSubmitFeedback = this._register(new Emitter()).event;
  }
  addFeedback(sessionResource, resourceUri, range, text, _suggestion, _context, _sourcePRReviewCommentId, _kind, state = AgentFeedbackState.Accepted) {
    return {
      id: "",
      text,
      resourceUri,
      range,
      sessionResource,
      kind: AgentFeedbackKind.UserReview,
      state
    };
  }
  acceptFeedback(_sessionResource, _feedbackId) {
  }
  removeFeedback(_sessionResource, _feedbackId) {
  }
  updateFeedback(_sessionResource, _feedbackId, _text) {
  }
  setFeedbackResolved(_sessionResource, _feedbackId, _resolved) {
  }
  addReply(_sessionResource, _feedbackId, _replyText) {
  }
  getFeedback(_sessionResource) {
    return [];
  }
  hasLoadedFeedback(_sessionResource) {
    return true;
  }
  getSessionForFile(_resourceUri) {
    return void 0;
  }
  getFeedbackSessionResource(_resourceUri) {
    return void 0;
  }
  registerFeedbackResourceScope(_resourceUri, _sessionResource) {
    return Disposable.None;
  }
  getMostRecentSessionForResource(_resourceUri) {
    return void 0;
  }
  async revealFeedback(_sessionResource, _feedbackId) {
  }
  async revealSessionComment() {
  }
  getNextFeedback() {
    return void 0;
  }
  getNextNavigableItem() {
    return void 0;
  }
  setNavigationAnchor() {
  }
  getNavigationBearing(_sessionResource) {
    return { activeIdx: -1, totalCount: 0 };
  }
  clearFeedback() {
  }
  markFeedbackSubmitted() {
  }
  async submitFeedback() {
    return false;
  }
  async addFeedbackAndSubmit() {
  }
}
registerSingleton(IAgentFeedbackService, NullAgentFeedbackService, InstantiationType.Delayed);
