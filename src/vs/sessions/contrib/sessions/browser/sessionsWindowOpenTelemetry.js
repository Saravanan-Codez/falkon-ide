import { disposableTimeout } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ShutdownReason } from "../../../../workbench/services/lifecycle/common/lifecycle.js";
const FIRST_TIME_WINDOW_OPEN_DURATION_LIMIT_MS = 3 * 60 * 1e3;
class SessionsWindowOpenTelemetry extends Disposable {
  constructor(_source, _getSignInDialogShown, _getViewState, _telemetryService, lifecycleService) {
    super();
    this._source = _source;
    this._getSignInDialogShown = _getSignInDialogShown;
    this._getViewState = _getViewState;
    this._telemetryService = _telemetryService;
    this._didSend = false;
    this._openedAt = Date.now();
    const remainingDuration = Math.max(0, FIRST_TIME_WINDOW_OPEN_DURATION_LIMIT_MS - this._elapsed());
    this._register(disposableTimeout(() => this._send(void 0), remainingDuration));
    this._register(lifecycleService.onWillShutdown((event) => {
      const windowCloseDurationMs = event.reason === ShutdownReason.CLOSE || event.reason === ShutdownReason.QUIT ? this._getCloseDuration() : void 0;
      this._send(windowCloseDurationMs);
    }));
  }
  captureInitialViewState() {
    this._viewState ??= this._getViewState();
  }
  _elapsed() {
    return Math.max(0, Date.now() - this._openedAt);
  }
  _getCloseDuration() {
    const duration = this._elapsed();
    return duration <= FIRST_TIME_WINDOW_OPEN_DURATION_LIMIT_MS ? duration : void 0;
  }
  _send(windowCloseDurationMs) {
    if (this._didSend) {
      return;
    }
    this._didSend = true;
    this.captureInitialViewState();
    this._telemetryService.publicLog2("agents/firstTimeWindowOpen", {
      source: this._source,
      signInDialogShown: this._getSignInDialogShown(),
      workspacePreselected: this._viewState?.workspacePreselected,
      windowCloseDurationMs
    });
  }
}
export {
  FIRST_TIME_WINDOW_OPEN_DURATION_LIMIT_MS,
  SessionsWindowOpenTelemetry
};
