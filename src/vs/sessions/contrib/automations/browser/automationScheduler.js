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
import { IntervalTimer, raceTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { stringHash } from "../../../../base/common/hash.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IAutomationRunner } from "../../../../workbench/contrib/chat/common/automations/automationRunner.js";
import { IAutomationService } from "../../../../workbench/contrib/chat/common/automations/automationService.js";
import { CHAT_AUTOMATIONS_ENABLED_SETTING, CHAT_AUTOMATIONS_RUN_TIMEOUT_MINUTES_SETTING, DEFAULT_AUTOMATIONS_RUN_TIMEOUT_MINUTES } from "../../../../workbench/contrib/chat/common/automations/automationsEnabled.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { AutomationLeaderElection } from "./automationLeaderElection.js";
const DEFAULT_SCHEDULER_TICK_MS = 6e4;
const CRASH_RECOVERY_REASON = localize("automations.crashRecoveryReason", "Interrupted by app shutdown");
const RUN_TIMEOUT_REASON_PREFIX = "Timed out after";
class AutomationSchedulerCore extends Disposable {
  constructor(automationService, runner, storageService, logService, options = {}) {
    super();
    this.automationService = automationService;
    this.runner = runner;
    this.logService = logService;
    this._timer = this._register(new IntervalTimer());
    this._runCts = this._register(new CancellationTokenSource());
    // Reset on leadership loss so a future take-over re-runs crash recovery.
    this._didStartupForCurrentLeadership = false;
    this._pendingRuns = Promise.resolve();
    this._tickIntervalMs = options.tickIntervalMs ?? DEFAULT_SCHEDULER_TICK_MS;
    this._now = options.now ?? (() => /* @__PURE__ */ new Date());
    this._isFeatureEnabled = options.isFeatureEnabled ?? (() => true);
    this._getRunTimeoutMs = options.getRunTimeoutMs ?? (() => DEFAULT_AUTOMATIONS_RUN_TIMEOUT_MINUTES * 6e4);
    this._leader = options.leaderElection ?? this._register(new AutomationLeaderElection(storageService, logService));
    this._register(autorun((reader) => {
      const isLeader = this._leader.isLeader.read(reader);
      if (!isLeader) {
        this._didStartupForCurrentLeadership = false;
        return;
      }
      this.kickoffPendingRuns(() => this.tickOnce(true));
    }));
    if (!options.disableAutoTick) {
      this._timer.cancelAndSet(() => {
        this.kickoffPendingRuns(() => this.tickOnce(false));
      }, this._tickIntervalMs);
    }
    if (options.onDidChangeTargetAvailability) {
      this._register(options.onDidChangeTargetAvailability(() => {
        this.kickoffPendingRuns(() => this.tickOnce(false));
      }));
    }
  }
  /** Test-only: run a single tick and await it. */
  async tickForTesting() {
    this.kickoffPendingRuns(() => this.tickOnce(false));
    await this._pendingRuns;
  }
  /** Test-only: await in-flight runs. */
  async waitForPendingRuns() {
    await this._pendingRuns;
  }
  kickoffPendingRuns(task) {
    if (this._store.isDisposed) {
      return;
    }
    this._pendingRuns = this._pendingRuns.then(task).catch((err) => {
      this.logService.error("[AutomationScheduler] tick failed", err);
    });
  }
  async tickOnce(isLeadershipTransition) {
    if (!this._leader.isLeader.get()) {
      return;
    }
    if (!this._isFeatureEnabled()) {
      return;
    }
    if (!this._didStartupForCurrentLeadership) {
      this._didStartupForCurrentLeadership = true;
      await this.automationService.markStaleRunsFailed(CRASH_RECOVERY_REASON);
      await this.dispatchDue("catch_up");
      if (isLeadershipTransition) {
        return;
      }
    }
    await this.dispatchDue("schedule");
  }
  async dispatchDue(trigger) {
    const now = this._now();
    const due = this.automationService.automations.get().filter((a) => isDue(a, now));
    if (due.length === 0) {
      return;
    }
    const leaderWindowId = stringHash(this._leader.instanceId, 0);
    for (const automation of due) {
      try {
        await this.runOneWithTimeout(automation, trigger, leaderWindowId);
      } catch (err) {
        this.logService.error("[AutomationScheduler] dispatch failed for automation", automation.id, err);
      }
    }
  }
  async runOneWithTimeout(automation, trigger, leaderWindowId) {
    const timeoutMs = this._getRunTimeoutMs();
    const perRunCts = new CancellationTokenSource(this._runCts.token);
    try {
      if (timeoutMs <= 0) {
        await this.runner.runOnce(automation, trigger, leaderWindowId, perRunCts.token).whenCompleted;
        return;
      }
      let timedOut = false;
      await raceTimeout(
        this.runner.runOnce(automation, trigger, leaderWindowId, perRunCts.token).whenCompleted,
        timeoutMs,
        () => {
          timedOut = true;
          this.logService.warn(`[AutomationScheduler] runOnce for automation ${automation.id} timed out after ${timeoutMs}ms.`);
        }
      );
      if (!timedOut) {
        return;
      }
      try {
        const active = this.automationService.getActiveRunFor(automation.id);
        if (active) {
          await this.automationService.updateRun(active.id, {
            status: "failed",
            errorMessage: localize("automation.timedOut", "Timed out after {0} minute(s).", Math.round(timeoutMs / 6e4)),
            completedAt: this._now().toISOString()
          });
        }
      } catch (err) {
        this.logService.warn("[AutomationScheduler] failed to mark timed-out run as failed", err);
      }
      perRunCts.cancel();
    } finally {
      perRunCts.dispose();
    }
  }
  dispose() {
    this._runCts.cancel();
    super.dispose();
  }
}
let AutomationScheduler = class extends Disposable {
  constructor(_automationService, _runner, _storageService, _logService, _configurationService, _sessionsManagementService) {
    super();
    this._automationService = _automationService;
    this._runner = _runner;
    this._storageService = _storageService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._sessionsManagementService = _sessionsManagementService;
    this._core = this._register(new MutableDisposable());
    if (this._isEnabled()) {
      this._createCore();
    }
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CHAT_AUTOMATIONS_ENABLED_SETTING)) {
        if (this._isEnabled()) {
          this._createCore();
        } else {
          this._core.clear();
        }
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.automationScheduler";
  }
  _isEnabled() {
    return this._configurationService.getValue(CHAT_AUTOMATIONS_ENABLED_SETTING) === true;
  }
  _createCore() {
    if (this._core.value) {
      return;
    }
    this._core.value = new AutomationSchedulerCore(this._automationService, this._runner, this._storageService, this._logService, {
      isFeatureEnabled: () => this._isEnabled(),
      getRunTimeoutMs: () => {
        const minutes = this._configurationService.getValue(CHAT_AUTOMATIONS_RUN_TIMEOUT_MINUTES_SETTING);
        const sane = typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 1 ? minutes : DEFAULT_AUTOMATIONS_RUN_TIMEOUT_MINUTES;
        return sane * 6e4;
      },
      onDidChangeTargetAvailability: this._sessionsManagementService.onDidChangeSessionTypes
    });
  }
};
AutomationScheduler = __decorateClass([
  __decorateParam(0, IAutomationService),
  __decorateParam(1, IAutomationRunner),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ISessionsManagementService)
], AutomationScheduler);
function isDue(automation, now) {
  if (!automation.enabled || !automation.nextRunAt) {
    return false;
  }
  const next = Date.parse(automation.nextRunAt);
  if (Number.isNaN(next)) {
    return false;
  }
  return next <= now.getTime();
}
export {
  AutomationScheduler,
  AutomationSchedulerCore,
  CRASH_RECOVERY_REASON,
  DEFAULT_SCHEDULER_TICK_MS,
  RUN_TIMEOUT_REASON_PREFIX
};
