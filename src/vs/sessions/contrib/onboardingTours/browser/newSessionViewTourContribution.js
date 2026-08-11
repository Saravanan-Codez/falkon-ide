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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { onboardingScenarioRegistry } from "../../../../workbench/contrib/onboarding/common/onboardingRegistry.js";
import { isOnboardingDeveloperModeEnabled, IOnboardingScenarioService } from "../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionHarnessPickerVisibleContext, SessionIsolationPickerVisibleContext, SessionWorkspacePickerVisibleContext } from "../../../common/contextkeys.js";
import { TOTAL_SESSIONS_KEY } from "../../sessions/browser/sessionsLifecycleTracker.js";
import { createNewSessionViewTour, NEW_SESSION_VIEW_TOUR_ID } from "./tours/newSessionViewTour.js";
const NEW_SESSION_PICKER_VISIBLE_KEYS = [
  SessionWorkspacePickerVisibleContext.key,
  SessionHarnessPickerVisibleContext.key,
  SessionIsolationPickerVisibleContext.key
];
let NewSessionViewTourContribution = class extends Disposable {
  constructor(onboardingScenarioService, sessionsService, storageService, configurationService, contextKeyService) {
    super();
    this.onboardingScenarioService = onboardingScenarioService;
    this.sessionsService = sessionsService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.contextKeyService = contextKeyService;
    /** Drives the tour's `observable` trigger. Flipped to `true` exactly once. */
    this._trigger = observableValue(this, false);
    this._pendingCheck = this._register(new MutableDisposable());
    this._register(onboardingScenarioRegistry.register(createNewSessionViewTour(this._trigger)));
    if (!this._isEligibleUser()) {
      return;
    }
    this._register(autorun((reader) => {
      if (this._isTriggeredOrShown()) {
        this._pendingCheck.clear();
        return;
      }
      const activeSession = this.sessionsService.activeSession.read(reader);
      const newSessionViewOpen = !activeSession || !activeSession.isCreated.read(reader);
      if (!newSessionViewOpen) {
        this._pendingCheck.clear();
        return;
      }
      if (!this._pendingCheck.value) {
        this._armReadyCheck();
      }
    }));
  }
  static {
    this.ID = "sessions.contrib.onboardingTours.newSessionViewTour";
  }
  static {
    /** Only nudge users who have sent at most this many requests. */
    this.MAX_REQUESTS_FOR_TOUR = 3;
  }
  static {
    /**
     * Delay before the first readiness check after the new-session view opens.
     * Gives startup restore time to settle, so a session that is about to be
     * restored as the active view is not mistaken for the new-session view, and
     * lets the composer render its pickers before the first check.
     */
    this.SETTLE_DELAY_MS = 1e3;
  }
  _isEligibleUser() {
    if (isOnboardingDeveloperModeEnabled(this.configurationService, NEW_SESSION_VIEW_TOUR_ID)) {
      return true;
    }
    const requestsSent = this.storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0);
    return requestsSent <= NewSessionViewTourContribution.MAX_REQUESTS_FOR_TOUR;
  }
  _isTriggeredOrShown() {
    return this._trigger.get() || this.onboardingScenarioService.hasBeenShown(NEW_SESSION_VIEW_TOUR_ID);
  }
  /**
   * Arms a watch that flips the trigger once all three pickers report visible.
   * Checks once after a settle delay and again whenever a picker-visibility
   * context key changes, so late-rendering pickers (e.g. the isolation picker
   * resolving its git repository) are picked up without polling forever.
   */
  _armReadyCheck() {
    const store = new DisposableStore();
    const check = () => {
      if (this._isTriggeredOrShown()) {
        this._pendingCheck.clear();
        return;
      }
      const activeSession = this.sessionsService.activeSession.get();
      const newSessionViewOpen = !activeSession || !activeSession.isCreated.get();
      if (!newSessionViewOpen) {
        this._pendingCheck.clear();
        return;
      }
      if (this._allPickersVisible()) {
        this._trigger.set(true, void 0);
        this._pendingCheck.clear();
      }
    };
    const watchedKeys = new Set(NEW_SESSION_PICKER_VISIBLE_KEYS);
    store.add(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(watchedKeys)) {
        check();
      }
    }));
    store.add(disposableTimeout(check, NewSessionViewTourContribution.SETTLE_DELAY_MS));
    this._pendingCheck.value = store;
  }
  _allPickersVisible() {
    return NEW_SESSION_PICKER_VISIBLE_KEYS.every((key) => this.contextKeyService.getContextKeyValue(key) === true);
  }
};
NewSessionViewTourContribution = __decorateClass([
  __decorateParam(0, IOnboardingScenarioService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService)
], NewSessionViewTourContribution);
registerWorkbenchContribution2(NewSessionViewTourContribution.ID, NewSessionViewTourContribution, WorkbenchPhase.AfterRestored);
