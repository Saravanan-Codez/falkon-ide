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
import { IntervalTimer } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { autorun } from "../../../base/common/observable.js";
import { ILogService } from "../../log/common/log.js";
const MODEL_REFRESH_INTERVAL_MS = 30 * 60 * 1e3;
let AgentModelRefreshScheduler = class extends Disposable {
  constructor(agents, onDidStartTurn, _intervalMs, _logService) {
    super();
    this._intervalMs = _intervalMs;
    this._logService = _logService;
    this._timer = this._register(new IntervalTimer());
    this._agents = [];
    this._isTimerRunning = false;
    /**
     * Providers that have started a turn since their last refresh. A provider is
     * removed as soon as a refresh is issued for it, so a provider that goes
     * quiet stops being refreshed after one final catch-up tick.
     */
    this._activeSinceLastRefresh = /* @__PURE__ */ new Set();
    /** Last refresh attempt per provider, used to decide whether a turn should refresh immediately. */
    this._lastRefreshAt = /* @__PURE__ */ new Map();
    this._register(autorun((reader) => {
      this._agents = agents.read(reader);
      if (this._agents.length === 0) {
        this._timer.cancel();
        this._isTimerRunning = false;
        return;
      }
      if (!this._isTimerRunning) {
        this._timer.cancelAndSet(() => this._refreshActive(this._agents), this._intervalMs);
        this._isTimerRunning = true;
      }
    }));
    this._register(onDidStartTurn((provider) => this._handleTurnStarted(provider)));
  }
  /**
   * Records usage so the next tick refreshes this provider, and refreshes
   * straight away when the catalog is already older than the interval. Without
   * the immediate path, the first turn after a long idle period would run
   * against an arbitrarily stale catalog until the next tick came around.
   */
  _handleTurnStarted(provider) {
    const lastRefreshAt = this._lastRefreshAt.get(provider);
    if (lastRefreshAt !== void 0 && Date.now() - lastRefreshAt < this._intervalMs) {
      this._activeSinceLastRefresh.add(provider);
      return;
    }
    const agent = this._agents.find((a) => a.getDescriptor().provider === provider);
    if (!agent) {
      return;
    }
    this._activeSinceLastRefresh.delete(provider);
    this._refresh(agent, "stale catalog on turn start");
  }
  _refreshActive(agents) {
    for (const agent of agents) {
      const provider = agent.getDescriptor().provider;
      if (!this._activeSinceLastRefresh.delete(provider)) {
        continue;
      }
      this._refresh(agent, "periodic");
    }
  }
  _refresh(agent, reason) {
    if (!agent.refreshModels) {
      return;
    }
    const provider = agent.getDescriptor().provider;
    this._lastRefreshAt.set(provider, Date.now());
    this._logService.trace(`[AgentHost] Model refresh for ${provider} (${reason})`);
    agent.refreshModels().catch((err) => this._logService.error(err, `[AgentHost] Model refresh failed for ${provider}`));
  }
};
AgentModelRefreshScheduler = __decorateClass([
  __decorateParam(3, ILogService)
], AgentModelRefreshScheduler);
export {
  AgentModelRefreshScheduler,
  MODEL_REFRESH_INTERVAL_MS
};
