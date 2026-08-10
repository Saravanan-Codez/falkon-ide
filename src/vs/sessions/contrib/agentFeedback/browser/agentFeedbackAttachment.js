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
import { AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
import { ATTACHMENT_ID_PREFIX, createAgentFeedbackVariableEntry } from "./agentFeedbackAttachmentEntry.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
let AgentFeedbackAttachmentContribution = class extends Disposable {
  constructor(_agentFeedbackService, _chatWidgetService, _sessionsManagementService) {
    super();
    this._agentFeedbackService = _agentFeedbackService;
    this._chatWidgetService = _chatWidgetService;
    this._sessionsManagementService = _sessionsManagementService;
    /** Track onDidAcceptInput subscriptions per widget session */
    this._widgetListeners = this._store.add(new DisposableMap());
    this._store.add(this._agentFeedbackService.onDidChangeFeedback((e) => {
      if (this._isAgentHostSession(e.sessionResource)) {
        return;
      }
      this._updateAttachment(e.sessionResource);
      this._ensureAcceptListener(e.sessionResource);
    }));
  }
  static {
    this.ID = "workbench.contrib.agentFeedbackAttachment";
  }
  _isAgentHostSession(sessionResource) {
    const session = this._sessionsManagementService.getSession(sessionResource);
    return session ? isAgentHostProviderId(session.providerId) : false;
  }
  async _updateAttachment(sessionResource) {
    const widget = this._chatWidgetService.getWidgetBySessionResource(sessionResource);
    if (!widget) {
      return;
    }
    const feedbackItems = this._agentFeedbackService.getFeedback(sessionResource).filter((item) => item.state === AgentFeedbackState.Accepted);
    const attachmentId = ATTACHMENT_ID_PREFIX + sessionResource.toString();
    if (feedbackItems.length === 0) {
      widget.attachmentModel.delete(attachmentId);
      return;
    }
    const entry = createAgentFeedbackVariableEntry(sessionResource, feedbackItems);
    widget.attachmentModel.delete(attachmentId);
    widget.attachmentModel.addContext(entry);
  }
  /**
   * Ensure we listen for the chat widget's submit event so we can clear feedback after send.
   */
  _ensureAcceptListener(sessionResource) {
    const key = sessionResource.toString();
    if (this._widgetListeners.has(key)) {
      return;
    }
    const widget = this._chatWidgetService.getWidgetBySessionResource(sessionResource);
    if (!widget) {
      return;
    }
    this._widgetListeners.set(key, widget.onDidSubmitAgent(() => {
      this._agentFeedbackService.markFeedbackSubmitted(sessionResource);
      this._widgetListeners.deleteAndDispose(key);
    }));
  }
};
AgentFeedbackAttachmentContribution = __decorateClass([
  __decorateParam(0, IAgentFeedbackService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, ISessionsManagementService)
], AgentFeedbackAttachmentContribution);
export {
  AgentFeedbackAttachmentContribution
};
