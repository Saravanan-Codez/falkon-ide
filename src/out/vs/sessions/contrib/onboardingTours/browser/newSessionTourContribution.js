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
import { disposableTimeout } from "../../../../base/common/async.js";
import { addDisposableListener, EventType } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { onboardingScenarioRegistry } from "../../../../workbench/contrib/onboarding/common/onboardingRegistry.js";
import { isOnboardingDeveloperModeEnabled, IOnboardingScenarioService } from "../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js";
import { findOnboardingTarget, pulseOnboardingTarget } from "../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { TOTAL_SESSIONS_KEY } from "../../sessions/browser/sessionsLifecycleTracker.js";
import { createNewSessionTour, NEW_SESSION_TOUR_ID } from "./tours/newSessionTour.js";
const NEW_SESSION_BUTTON_TARGET = "sessions.newSession.button";
let NewSessionTourContribution = class extends Disposable {
  constructor(sessionsManagementService, onboardingScenarioService, sessionsService, storageService, configurationService) {
    super();
    this.onboardingScenarioService = onboardingScenarioService;
    this.sessionsService = sessionsService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    /** Drives the tour's `observable` trigger. Flipped to `true` exactly once. */
    this._trigger = observableValue(this, false);
    this._pendingCheck = this._register(new MutableDisposable());
    this._pulse = this._register(new MutableDisposable());
    this._register(onboardingScenarioRegistry.register(createNewSessionTour(this._trigger)));
    this._register(sessionsManagementService.onWillSendRequest((session) => this._onWillSendRequest(session)));
  }
  static {
    this.ID = "sessions.contrib.onboardingTours.newSessionTour";
  }
  static {
    /** Only nudge users who are still in their first few sessions. */
    this.MAX_SESSIONS_FOR_TOUR = 3;
  }
  static {
    /** Delay after a request before checking the session is still visible. */
    this.VISIBILITY_DELAY_MS = 5e3;
  }
  _onWillSendRequest(session) {
    if (this._trigger.get() || this.onboardingScenarioService.hasBeenShown(NEW_SESSION_TOUR_ID)) {
      this._pendingCheck.clear();
      this._pulse.clear();
      return;
    }
    const developerMode = isOnboardingDeveloperModeEnabled(this.configurationService, NEW_SESSION_TOUR_ID);
    if (!developerMode) {
      const sessionsStarted = this.storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0);
      if (sessionsStarted > NewSessionTourContribution.MAX_SESSIONS_FOR_TOUR) {
        return;
      }
    }
    this._pendingCheck.value = disposableTimeout(() => {
      const stillVisible = this.sessionsService.visibleSessions.get().some((s) => s?.sessionId === session.sessionId);
      if (stillVisible) {
        this._startNewSessionButtonPulse();
      }
    }, NewSessionTourContribution.VISIBILITY_DELAY_MS);
  }
  _startNewSessionButtonPulse() {
    if (this._pulse.value || this._trigger.get() || this.onboardingScenarioService.hasBeenShown(NEW_SESSION_TOUR_ID)) {
      return;
    }
    const target = findOnboardingTarget(mainWindow, NEW_SESSION_BUTTON_TARGET);
    if (!target) {
      return;
    }
    const pulse = new DisposableStore();
    pulse.add(pulseOnboardingTarget(target));
    pulse.add(addDisposableListener(target, EventType.CLICK, () => {
      if (this._trigger.get()) {
        return;
      }
      this._pulse.clear();
      this._trigger.set(true, void 0);
    }));
    pulse.add(addDisposableListener(target, "tap", () => {
      if (this._trigger.get()) {
        return;
      }
      this._pulse.clear();
      this._trigger.set(true, void 0);
    }));
    this._pulse.value = pulse;
  }
};
NewSessionTourContribution = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, IOnboardingScenarioService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService)
], NewSessionTourContribution);
registerWorkbenchContribution2(NewSessionTourContribution.ID, NewSessionTourContribution, WorkbenchPhase.AfterRestored);
