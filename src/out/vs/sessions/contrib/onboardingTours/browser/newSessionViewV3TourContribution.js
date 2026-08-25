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
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IGitService } from "../../../../workbench/contrib/git/common/gitService.js";
import { onboardingScenarioRegistry } from "../../../../workbench/contrib/onboarding/common/onboardingRegistry.js";
import { IOnboardingScenarioService } from "../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js";
import { IWorkbenchAssignmentService } from "../../../../workbench/services/assignment/common/assignmentService.js";
import { IChatEntitlementService } from "../../../../workbench/services/chat/common/chatEntitlementService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { INewSessionComposerService } from "../../chat/browser/newSessionComposerService.js";
import { IGitHubService } from "../../github/browser/githubService.js";
import { NewSessionViewV3PromptRunner } from "./newSessionViewV3Prompt.js";
import { NewSessionViewTourTrigger } from "./newSessionViewTourTrigger.js";
import { createNewSessionViewV3Tour, NEW_SESSION_VIEW_V3_TOUR_ID } from "./tours/newSessionViewV3Tour.js";
let NewSessionViewV3TourContribution = class extends Disposable {
  constructor(onboardingScenarioService, _sessionsService, storageService, configurationService, contextKeyService, chatEntitlementService, _newSessionComposerService, assignmentService, gitService, fileService, gitHubService, telemetryService, logService) {
    super();
    this._sessionsService = _sessionsService;
    this._newSessionComposerService = _newSessionComposerService;
    const trigger = this._register(new NewSessionViewTourTrigger(
      NEW_SESSION_VIEW_V3_TOUR_ID,
      onboardingScenarioService,
      this._sessionsService,
      storageService,
      configurationService,
      contextKeyService,
      chatEntitlementService
    ));
    const promptRunner = new NewSessionViewV3PromptRunner(
      assignmentService,
      configurationService,
      this._sessionsService,
      this._newSessionComposerService,
      gitService,
      fileService,
      gitHubService,
      telemetryService,
      logService
    );
    this._register(onboardingScenarioRegistry.register(createNewSessionViewV3Tour(
      trigger.signal,
      (token) => promptRunner.run(token)
    )));
  }
  static {
    this.ID = "sessions.contrib.onboardingTours.newSessionViewV3Tour";
  }
};
NewSessionViewV3TourContribution = __decorateClass([
  __decorateParam(0, IOnboardingScenarioService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IChatEntitlementService),
  __decorateParam(6, INewSessionComposerService),
  __decorateParam(7, IWorkbenchAssignmentService),
  __decorateParam(8, IGitService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IGitHubService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, ILogService)
], NewSessionViewV3TourContribution);
registerWorkbenchContribution2(NewSessionViewV3TourContribution.ID, NewSessionViewV3TourContribution, WorkbenchPhase.AfterRestored);
