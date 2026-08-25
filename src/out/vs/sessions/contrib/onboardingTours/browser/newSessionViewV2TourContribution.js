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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { onboardingScenarioRegistry } from "../../../../workbench/contrib/onboarding/common/onboardingRegistry.js";
import { IOnboardingScenarioService } from "../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js";
import { IChatEntitlementService } from "../../../../workbench/services/chat/common/chatEntitlementService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { NewSessionViewTourTrigger } from "./newSessionViewTourTrigger.js";
import { createNewSessionViewV2Tour, NEW_SESSION_VIEW_V2_TOUR_ID } from "./tours/newSessionViewV2Tour.js";
let NewSessionViewV2TourContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.onboardingTours.newSessionViewV2Tour";
  }
  constructor(onboardingScenarioService, sessionsService, storageService, configurationService, contextKeyService, chatEntitlementService) {
    super();
    const trigger = this._register(new NewSessionViewTourTrigger(
      NEW_SESSION_VIEW_V2_TOUR_ID,
      onboardingScenarioService,
      sessionsService,
      storageService,
      configurationService,
      contextKeyService,
      chatEntitlementService
    ));
    this._register(onboardingScenarioRegistry.register(createNewSessionViewV2Tour(trigger.signal)));
  }
};
NewSessionViewV2TourContribution = __decorateClass([
  __decorateParam(0, IOnboardingScenarioService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IChatEntitlementService)
], NewSessionViewV2TourContribution);
registerWorkbenchContribution2(NewSessionViewV2TourContribution.ID, NewSessionViewV2TourContribution, WorkbenchPhase.AfterRestored);
