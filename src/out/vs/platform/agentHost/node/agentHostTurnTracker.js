import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
class AgentHostTurnTracker extends Disposable {
  constructor(_reporter) {
    super();
    this._reporter = _reporter;
    this._turnTimings = /* @__PURE__ */ new Map();
    /**
     * Fires with the provider id whenever a turn starts, i.e. whenever the host
     * is about to make an LLM request on that provider's behalf.
     *
     * Consumed by {@link AgentModelRefreshScheduler} to gate its periodic model
     * refresh on real usage, so an idle host issues no `models` network
     * requests at all. Local host commands (`/rename`, `!command`) are
     * intercepted before `turnStarted` is reached and so correctly do not count
     * as activity.
     */
    this._onDidStartTurn = this._register(new Emitter());
    this.onDidStartTurn = this._onDidStartTurn.event;
  }
  turnStarted(provider, session, turnId, model, modelTelemetryKind, permissionLevel) {
    const key = this._key(session, turnId);
    this._turnTimings.set(key, {
      stopWatch: StopWatch.create(false),
      provider,
      session,
      model,
      modelTelemetryKind,
      modelSelectionKind: model === void 0 ? "default" : model === "auto" ? "auto" : "explicit",
      permissionLevel,
      firstProgressMs: void 0
    });
    this._onDidStartTurn.fire(provider);
  }
  markFirstProgress(session, turnId) {
    const timing = this._turnTimings.get(this._key(session, turnId));
    if (timing && timing.firstProgressMs === void 0) {
      timing.firstProgressMs = timing.stopWatch.elapsed();
    }
  }
  updateModel(session, turnId, model, modelTelemetryKind) {
    const timing = this._turnTimings.get(this._key(session, turnId));
    if (timing) {
      timing.model = model;
      timing.modelTelemetryKind = modelTelemetryKind;
    }
  }
  getModelTelemetryContext(session, turnId) {
    const timing = this._turnTimings.get(this._key(session, turnId));
    return timing ? { model: timing.model, modelTelemetryKind: timing.modelTelemetryKind } : void 0;
  }
  turnCompleted(session, turnId, result, failure) {
    const key = this._key(session, turnId);
    const timing = this._turnTimings.get(key);
    if (!timing) {
      return;
    }
    this._turnTimings.delete(key);
    this._reporter.turnCompleted({
      provider: timing.provider,
      session: timing.session,
      turnId,
      timeToFirstProgress: timing.firstProgressMs,
      totalTime: timing.stopWatch.elapsed(),
      result,
      model: timing.model,
      modelTelemetryKind: timing.modelTelemetryKind,
      modelSelectionKind: timing.modelSelectionKind,
      permissionLevel: timing.permissionLevel,
      failure
    });
  }
  _key(session, turnId) {
    return `${session}\0${turnId}`;
  }
}
export {
  AgentHostTurnTracker
};
