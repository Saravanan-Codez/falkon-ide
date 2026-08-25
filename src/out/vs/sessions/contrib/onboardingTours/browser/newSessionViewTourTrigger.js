import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableSignalFromEvent, observableValue } from "../../../../base/common/observable.js";
import { StorageScope } from "../../../../platform/storage/common/storage.js";
import { isOnboardingDeveloperModeEnabled } from "../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js";
import { ChatEntitlement } from "../../../../workbench/services/chat/common/chatEntitlementService.js";
import { SessionWorkspacePickerVisibleContext } from "../../../common/contextkeys.js";
import { TOTAL_SESSIONS_KEY } from "../../sessions/browser/sessionsLifecycleTracker.js";
const MAX_REQUESTS_FOR_TOUR = 1;
class NewSessionViewTourTrigger extends Disposable {
  constructor(_tourId, _onboardingScenarioService, _sessionsService, _storageService, _configurationService, _contextKeyService, _chatEntitlementService) {
    super();
    this._tourId = _tourId;
    this._onboardingScenarioService = _onboardingScenarioService;
    this._sessionsService = _sessionsService;
    this._storageService = _storageService;
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._chatEntitlementService = _chatEntitlementService;
    this._trigger = observableValue(this, false);
    this.signal = this._trigger;
    if (!this._isEligibleUser()) {
      return;
    }
    const contextChanged = observableSignalFromEvent(this, this._contextKeyService.onDidChangeContext);
    this._register(autorun((reader) => {
      contextChanged.read(reader);
      this._sessionsService.initialRestoreComplete.read(reader);
      if (this._isTriggeredOrShown()) {
        return;
      }
      const activeSession = this._sessionsService.activeSession.read(reader);
      const newSessionViewOpen = !activeSession || !activeSession.isCreated.read(reader);
      const loggedIn = this._chatEntitlementService.entitlementObs.read(reader) !== ChatEntitlement.Unknown;
      if (!newSessionViewOpen || !loggedIn) {
        return;
      }
      if (this._isReady()) {
        this._trigger.set(true, void 0);
      }
    }));
  }
  _isEligibleUser() {
    if (isOnboardingDeveloperModeEnabled(this._configurationService, this._tourId)) {
      return true;
    }
    const requestsSent = this._storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0);
    return requestsSent <= MAX_REQUESTS_FOR_TOUR;
  }
  _isTriggeredOrShown() {
    return this._trigger.get() || this._onboardingScenarioService.hasBeenShown(this._tourId);
  }
  _isReady() {
    const activeSession = this._sessionsService.activeSession.get();
    const newSessionViewOpen = !activeSession || !activeSession.isCreated.get();
    return this._sessionsService.initialRestoreComplete.get() && newSessionViewOpen && this._chatEntitlementService.entitlement !== ChatEntitlement.Unknown && this._contextKeyService.getContextKeyValue(SessionWorkspacePickerVisibleContext.key) === true;
  }
}
export {
  NewSessionViewTourTrigger
};
