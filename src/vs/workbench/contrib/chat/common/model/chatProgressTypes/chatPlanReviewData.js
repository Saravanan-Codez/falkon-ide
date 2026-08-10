import { DeferredPromise } from "../../../../../../base/common/async.js";
import { Emitter } from "../../../../../../base/common/event.js";
class ChatPlanReviewData {
  constructor(title, content, actions, canProvideFeedback, planUri, resolveId, data, isUsed, source, isOutdated) {
    this.title = title;
    this.content = content;
    this.actions = actions;
    this.canProvideFeedback = canProvideFeedback;
    this.planUri = planUri;
    this.resolveId = resolveId;
    this.data = data;
    this.isUsed = isUsed;
    this.source = source;
    this.isOutdated = isOutdated;
    this.kind = "planReview";
    this.completion = new DeferredPromise();
    this._onDidDismiss = new Emitter();
    this.onDidDismiss = this._onDidDismiss.event;
  }
  /** Dismiss without a user choice (e.g. the response was cancelled). */
  dismiss() {
    if (this.isUsed) {
      return;
    }
    this.isUsed = true;
    this.draftFeedback = void 0;
    this.draftCollapsed = void 0;
    void this.completion.complete(void 0);
    this._onDidDismiss.fire();
  }
  toJSON() {
    return {
      kind: this.kind,
      title: this.title,
      content: this.content,
      actions: this.actions,
      canProvideFeedback: this.canProvideFeedback,
      planUri: this.planUri,
      resolveId: this.resolveId,
      data: this.data,
      isUsed: this.isUsed,
      isOutdated: this.isOutdated,
      source: this.source
    };
  }
}
export {
  ChatPlanReviewData
};
