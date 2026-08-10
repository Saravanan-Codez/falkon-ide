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
import { DeferredPromise } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { Memento } from "../../../common/memento.js";
import { onboardingPresentationRegistry } from "../common/onboardingPresentation.js";
import { onboardingScenarioRegistry } from "../common/onboardingRegistry.js";
import { ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX, OnboardingOutcome } from "../common/onboardingScenario.js";
import { isOnboardingDeveloperModeEnabled, ONBOARDING_DEVELOPER_MODE_CONFIG, ONBOARDING_ENABLED_CONFIG } from "../common/onboardingScenarioService.js";
let OnboardingScenarioService = class extends Disposable {
  constructor(storageService, contextKeyService, configurationService, lifecycleService, assignmentService, telemetryService) {
    super();
    this.storageService = storageService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.lifecycleService = lifecycleService;
    this.assignmentService = assignmentService;
    this.telemetryService = telemetryService;
    /** Listeners for `observable` triggers, rebuilt whenever the registry changes. */
    this._triggerListeners = this._register(new DisposableStore());
    /** Scenario ids currently queued or running (prevents double-scheduling). */
    this._pending = /* @__PURE__ */ new Set();
    this._queue = [];
    /** Deferreds for scenarios that have been dequeued and are currently running, keyed by id. */
    this._inflight = /* @__PURE__ */ new Map();
    this._pumping = false;
    /** Resolved experiment treatment state, keyed by scenario id. */
    this._experimentStates = /* @__PURE__ */ new Map();
    this._onDidChangeOpenedIds = this._register(new Emitter());
    this._started = false;
    this._stopped = false;
    this._shownSinceStart = /* @__PURE__ */ new Set();
    this._memento = new Memento(OnboardingScenarioService.MEMENTO_ID, this.storageService);
    this._state = this._memento.getMemento(StorageScope.APPLICATION, StorageTarget.MACHINE);
    this._openedAssignmentContextIds = this._loadOpenedIds();
    this.assignmentService.addTelemetryAssignmentFilter({
      id: "onboarding",
      exclude: (assignment) => {
        const variant = getAssignmentContextVariant(assignment);
        return variant.startsWith(ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX) && !this._openedAssignmentContextIds.has(variant);
      },
      onDidChange: this._onDidChangeOpenedIds.event
    });
    this._register(this.lifecycleService.onWillShutdown(() => this._stop()));
  }
  static {
    this.MEMENTO_ID = "onboarding";
  }
  static {
    /**
     * Storage key for the set of assignment-context identifiers whose telemetry gate has been
     * opened (the user reached the onboarding moment). Persisted so the identifier keeps
     * flowing across reloads/relaunches until the experiment is stopped.
     */
    this.OPENED_IDS_STORAGE_KEY = "onboarding.openedAssignmentContextIds";
  }
  _stop() {
    this._stopped = true;
    this._activeAbort?.fire();
    let entry;
    while (entry = this._queue.shift()) {
      this._pending.delete(entry.scenario.id);
      entry.deferred.complete(OnboardingOutcome.Aborted);
    }
  }
  start() {
    if (this._started) {
      return;
    }
    this._started = true;
    this._register(onboardingScenarioRegistry.onDidChange(() => {
      this._registerTriggerListeners();
      this._resolveExperiments();
      this._evaluate();
    }));
    this._register(this.contextKeyService.onDidChangeContext(() => this._evaluate()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ONBOARDING_ENABLED_CONFIG) || e.affectsConfiguration(ONBOARDING_DEVELOPER_MODE_CONFIG)) {
        this._evaluate();
      }
    }));
    this._registerTriggerListeners();
    this._resolveExperiments();
    this._evaluate();
  }
  getScenarios() {
    return onboardingScenarioRegistry.getScenarios();
  }
  async runScenario(id) {
    const scenario = onboardingScenarioRegistry.getScenario(id);
    if (!scenario) {
      throw new Error(`Unknown onboarding scenario '${id}'.`);
    }
    return this._enqueue(scenario);
  }
  hasBeenShown(id) {
    const scenario = onboardingScenarioRegistry.getScenario(id);
    return this._hasBeenShownKey(scenario ? this._seenKey(scenario) : id, id);
  }
  reset(id) {
    const scenario = onboardingScenarioRegistry.getScenario(id);
    delete this._state[scenario ? this._seenKey(scenario) : id];
    this._memento.saveMemento();
  }
  resetAll() {
    for (const key of Object.keys(this._state)) {
      delete this._state[key];
    }
    this._memento.saveMemento();
  }
  //#region Eligibility & scheduling
  /**
   * The master switch for *automatic* onboarding. When `onboarding.enabled` is
   * explicitly `false`, no scenario ever runs automatically (developer mode does
   * NOT override this — see {@link _evaluate}). Any other value (including unset)
   * is treated as enabled. On-demand {@link runScenario} is intentionally exempt
   * from this switch.
   */
  get _enabled() {
    return this.configurationService.getValue(ONBOARDING_ENABLED_CONFIG) !== false;
  }
  _isDeveloperMode(scenarioId) {
    return isOnboardingDeveloperModeEnabled(this.configurationService, scenarioId);
  }
  /**
   * Re-evaluate every scenario and enqueue any that are eligible to run
   * automatically. Idempotent: already shown / queued scenarios are skipped.
   *
   * The automatic eligibility rules are:
   * 1. If `onboarding.enabled` is `false`, nothing runs automatically — this
   *    method returns immediately, and developer mode does NOT override it.
   * 2. If a scenario declares an `experiment`, it only runs when the experiment
   *    is active AND the user is in the treatment arm (see below) — OR when
   *    developer mode is enabled for that scenario, which bypasses the experiment
   *    gate so the tour can be previewed locally.
   * 3. If a scenario has no `experiment`, it runs for every user that meets its
   *    `when`/trigger criteria (the typical state once an experiment has graduated
   *    and the tour is rolled out to everyone).
   *
   * For an experiment-active scenario, reaching eligibility *is* the "would-show"
   * moment: the telemetry gate is opened for the experiment's assignment-context id
   * (in both arms), and then only the treatment arm is enqueued to actually show the
   * tour. Control opens the gate but renders nothing and is not marked as shown.
   *
   * Developer mode is the exception: it shows the tour unconditionally and never
   * opens the telemetry gate, so a local preview can never affect the experiment
   * scorecard regardless of which arm the developer happens to be assigned to.
   */
  _evaluate() {
    if (!this._enabled || this._stopped) {
      return;
    }
    const claimedSeenKeys = /* @__PURE__ */ new Set();
    for (const scenario of onboardingScenarioRegistry.getScenarios()) {
      if (!scenario.repeatable && this._pending.has(scenario.id)) {
        claimedSeenKeys.add(this._seenKey(scenario));
      }
    }
    const eligibleScenarios = onboardingScenarioRegistry.getScenarios().map((scenario, registrationIndex) => ({ scenario, registrationIndex })).filter(({ scenario }) => this._isAutoEligible(scenario)).sort((a, b) => (b.scenario.priority ?? 0) - (a.scenario.priority ?? 0) || a.registrationIndex - b.registrationIndex);
    for (const { scenario } of eligibleScenarios) {
      const seenKey = this._seenKey(scenario);
      if (!scenario.repeatable && claimedSeenKeys.has(seenKey)) {
        continue;
      }
      const experiment = scenario.experiment ? this._experimentStates.get(scenario.id) : void 0;
      if (experiment?.active && !this._isDeveloperMode(scenario.id)) {
        this._openGate(experiment.assignmentContextId);
        if (!experiment.behavior) {
          continue;
        }
      }
      this._enqueue(scenario);
      if (!scenario.repeatable) {
        claimedSeenKeys.add(seenKey);
      }
    }
  }
  _isAutoEligible(scenario) {
    if (scenario.trigger.kind === "command") {
      return false;
    }
    if (this._pending.has(scenario.id)) {
      return false;
    }
    if (!scenario.repeatable && this._hasBeenShownKey(this._seenKey(scenario), scenario.id)) {
      return false;
    }
    if (scenario.when && !this.contextKeyService.contextMatchesRules(scenario.when)) {
      return false;
    }
    if (scenario.experiment && this._experimentStates.get(scenario.id)?.active !== true && !this._isDeveloperMode(scenario.id)) {
      return false;
    }
    if (scenario.trigger.kind === "observable" && scenario.trigger.signal.get() !== true) {
      return false;
    }
    return true;
  }
  _enqueue(scenario) {
    if (this._stopped) {
      return Promise.resolve(OnboardingOutcome.Aborted);
    }
    const queued = this._queue.find((entry) => entry.scenario.id === scenario.id);
    if (queued) {
      return queued.deferred.p;
    }
    const inflight = this._inflight.get(scenario.id);
    if (inflight) {
      return inflight.p;
    }
    const deferred = new DeferredPromise();
    this._pending.add(scenario.id);
    this._queue.push({ scenario, deferred });
    this._queue.sort((a, b) => (b.scenario.priority ?? 0) - (a.scenario.priority ?? 0));
    this._pump();
    return deferred.p;
  }
  _pump() {
    if (this._pumping) {
      return;
    }
    this._pumping = true;
    this._doPump();
  }
  async _doPump() {
    await Promise.resolve();
    try {
      let entry;
      while (!this._stopped && (entry = this._queue.shift())) {
        const { scenario, deferred } = entry;
        this._inflight.set(scenario.id, deferred);
        let outcome;
        try {
          outcome = await this._runPresentation(scenario);
        } catch (error) {
          onUnexpectedError(error);
          outcome = OnboardingOutcome.Aborted;
        } finally {
          this._inflight.delete(scenario.id);
          this._pending.delete(scenario.id);
        }
        deferred.complete(outcome);
      }
    } finally {
      this._pumping = false;
    }
  }
  async _runPresentation(scenario) {
    const presentation = onboardingPresentationRegistry.get(scenario.presentation.kind);
    if (!presentation) {
      return OnboardingOutcome.Aborted;
    }
    this._markShown(this._seenKey(scenario));
    const abort = new Emitter();
    this._activeAbort = abort;
    const startTime = Date.now();
    try {
      const result = await presentation.run(scenario, { targetWindow: mainWindow, onAbort: abort.event });
      this._recordOutcome(this._seenKey(scenario), result.outcome);
      if (result.shown) {
        this._reportOutcome(scenario, result, Date.now() - startTime);
      }
      return result.outcome;
    } finally {
      this._activeAbort = void 0;
      abort.dispose();
    }
  }
  /** Emit per-tour telemetry. Only called when a tour was actually shown. */
  _reportOutcome(scenario, result, durationMs) {
    const experimentActive = !!scenario.experiment && this._experimentStates.get(scenario.id)?.active === true;
    this.telemetryService.publicLog2("onboarding.scenarioOutcome", {
      scenarioId: scenario.id,
      outcome: result.outcome,
      dismissReason: result.dismissReason,
      lastStepIndex: result.lastStepIndex,
      stepCount: result.stepCount,
      durationMs,
      experimentActive
    });
  }
  //#endregion
  //#region Triggers & experiments
  _registerTriggerListeners() {
    this._triggerListeners.clear();
    for (const scenario of onboardingScenarioRegistry.getScenarios()) {
      if (scenario.trigger.kind === "observable") {
        const signal = scenario.trigger.signal;
        this._triggerListeners.add(autorun((reader) => {
          signal.read(reader);
          this._evaluate();
        }));
      }
    }
  }
  /**
   * Resolve the two experiment treatment flags for each scenario that declares an experiment.
   * The experiment is only active when both resolve: the boolean to a boolean and the id to a
   * non-empty string that starts with {@link ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX}. Resolved
   * once per scenario; re-evaluation is triggered when an experiment becomes active.
   */
  _resolveExperiments() {
    for (const scenario of onboardingScenarioRegistry.getScenarios()) {
      const experiment = scenario.experiment;
      if (!experiment || this._experimentStates.has(scenario.id)) {
        continue;
      }
      this._experimentStates.set(scenario.id, { active: false, behavior: false, assignmentContextId: "" });
      Promise.all([
        this.assignmentService.getTreatment(experiment.behaviorFlag),
        this.assignmentService.getTreatment(experiment.assignmentContextIdFlag)
      ]).then(([behavior, assignmentContextId]) => {
        const hasBehavior = typeof behavior === "boolean";
        const hasId = typeof assignmentContextId === "string" && assignmentContextId.length > 0;
        const hasValidId = hasId && assignmentContextId.startsWith(ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX);
        if (hasId && !hasValidId) {
          onUnexpectedError(new Error(`Onboarding experiment for scenario '${scenario.id}' resolved an assignment-context id '${assignmentContextId}' that does not start with the required '${ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX}' prefix; treating the experiment as inactive.`));
        }
        const active = hasBehavior && hasValidId;
        this._experimentStates.set(scenario.id, {
          active,
          behavior: behavior === true,
          assignmentContextId: active ? assignmentContextId : ""
        });
        if (active) {
          this._evaluate();
        }
      }, (error) => onUnexpectedError(error));
    }
  }
  //#endregion
  //#region Telemetry gate
  _loadOpenedIds() {
    const raw = this.storageService.get(OnboardingScenarioService.OPENED_IDS_STORAGE_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return /* @__PURE__ */ new Set();
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === "string")) : /* @__PURE__ */ new Set();
    } catch (error) {
      onUnexpectedError(error);
      return /* @__PURE__ */ new Set();
    }
  }
  /**
   * Open the telemetry gate for an assignment-context id: from now on (and after reload) the
   * id is no longer filtered out, so every event carries it. Idempotent.
   */
  _openGate(assignmentContextId) {
    if (!assignmentContextId || this._openedAssignmentContextIds.has(assignmentContextId)) {
      return;
    }
    this._openedAssignmentContextIds.add(assignmentContextId);
    this.storageService.store(
      OnboardingScenarioService.OPENED_IDS_STORAGE_KEY,
      JSON.stringify(Array.from(this._openedAssignmentContextIds)),
      StorageScope.APPLICATION,
      StorageTarget.MACHINE
    );
    this._onDidChangeOpenedIds.fire();
  }
  //#endregion
  //#region Persistence
  /**
   * The key under which a scenario's once-per-user "shown" state is stored.
   * Scenarios may opt into a shared {@link IOnboardingScenario.seenKey} so that
   * variations of the same onboarding are gated together; otherwise the
   * scenario id is used.
   */
  _seenKey(scenario) {
    return scenario.seenKey ?? scenario.id;
  }
  _hasBeenShownKey(key, scenarioId) {
    if (this._isDeveloperMode(scenarioId)) {
      return this._shownSinceStart.has(key);
    }
    return !!this._state[key]?.shownAt;
  }
  _markShown(id) {
    this._shownSinceStart.add(id);
    const previous = this._state[id];
    const next = {
      shownAt: Date.now(),
      outcome: previous?.outcome,
      seenCount: (previous?.seenCount ?? 0) + 1
    };
    this._state[id] = next;
    this._memento.saveMemento();
  }
  _recordOutcome(id, outcome) {
    const state = this._state[id];
    if (state) {
      state.outcome = outcome;
      this._memento.saveMemento();
    }
  }
  //#endregion
};
OnboardingScenarioService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, IWorkbenchAssignmentService),
  __decorateParam(5, ITelemetryService)
], OnboardingScenarioService);
function getAssignmentContextVariant(assignment) {
  const separatorIndex = assignment.lastIndexOf(":");
  return separatorIndex === -1 ? assignment : assignment.slice(0, separatorIndex);
}
export {
  OnboardingScenarioService
};
