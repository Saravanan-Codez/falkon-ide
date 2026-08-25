import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
class SessionActionFeedback extends Disposable {
  constructor() {
    super(...arguments);
    this._approvedCount = observableValue("approvedCount", 0);
    /** Number of sessions approved within the current window; `0` when idle. */
    this.approvedCount = this._approvedCount;
    this._resetScheduler = this._register(new RunOnceScheduler(
      () => this._approvedCount.set(0, void 0),
      SessionActionFeedback.WINDOW_MS
    ));
  }
  static {
    /** How long the "Approved N sessions" message stays visible, in milliseconds. */
    this.WINDOW_MS = 3e3;
  }
  /** Report that a session's pending action was approved. Restarts the window. */
  notifyApproved() {
    this._approvedCount.set(this._approvedCount.get() + 1, void 0);
    this._resetScheduler.schedule();
  }
}
export {
  SessionActionFeedback
};
