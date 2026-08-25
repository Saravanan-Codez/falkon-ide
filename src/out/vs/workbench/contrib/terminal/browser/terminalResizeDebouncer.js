import { getWindow, runWhenWindowIdle } from "../../../../base/browser/dom.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["StartDebouncingThreshold"] = 200] = "StartDebouncingThreshold";
  Constants2[Constants2["DebounceResizeXDelay"] = 100] = "DebounceResizeXDelay";
  return Constants2;
})(Constants || {});
class TerminalResizeDebouncer extends Disposable {
  constructor(_isVisible, _getXterm, _resizeBothCallback, _resizeXCallback, _resizeYCallback) {
    super();
    this._isVisible = _isVisible;
    this._getXterm = _getXterm;
    this._resizeBothCallback = _resizeBothCallback;
    this._resizeXCallback = _resizeXCallback;
    this._resizeYCallback = _resizeYCallback;
    this._latestX = 0;
    this._latestY = 0;
    this._resizeXJob = this._register(new MutableDisposable());
    this._resizeYJob = this._register(new MutableDisposable());
    // Owned by the disposable store so the pending timer is cancelled on dispose,
    // avoiding callbacks that fire against a torn-down xterm renderer.
    this._debounceResizeXScheduler = this._register(new RunOnceScheduler(
      () => this._resizeXCallback(this._latestX),
      100 /* DebounceResizeXDelay */
    ));
  }
  async resize(cols, rows, immediate) {
    if (this._store.isDisposed) {
      return;
    }
    this._latestX = cols;
    this._latestY = rows;
    if (immediate || this._getXterm().raw.buffer.normal.length < 200 /* StartDebouncingThreshold */) {
      this._resizeXJob.clear();
      this._resizeYJob.clear();
      this._debounceResizeXScheduler.cancel();
      this._resizeBothCallback(cols, rows);
      return;
    }
    const win = getWindow(this._getXterm().raw.element);
    if (win && !this._isVisible()) {
      if (!this._resizeXJob.value) {
        this._resizeXJob.value = runWhenWindowIdle(win, async () => {
          if (this._store.isDisposed) {
            return;
          }
          this._resizeXCallback(this._latestX);
          this._resizeXJob.clear();
        });
      }
      if (!this._resizeYJob.value) {
        this._resizeYJob.value = runWhenWindowIdle(win, async () => {
          if (this._store.isDisposed) {
            return;
          }
          this._resizeYCallback(this._latestY);
          this._resizeYJob.clear();
        });
      }
      return;
    }
    this._resizeYCallback(rows);
    this._latestX = cols;
    this._debounceResizeXScheduler.schedule();
  }
  flush() {
    if (this._store.isDisposed) {
      return;
    }
    if (this._resizeXJob.value || this._resizeYJob.value || this._debounceResizeXScheduler.isScheduled()) {
      this._resizeXJob.clear();
      this._resizeYJob.clear();
      this._debounceResizeXScheduler.cancel();
      this._resizeBothCallback(this._latestX, this._latestY);
    }
  }
}
export {
  TerminalResizeDebouncer
};
