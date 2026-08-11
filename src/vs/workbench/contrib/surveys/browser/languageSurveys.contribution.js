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
import { localize } from "../../../../nls.js";
import { language } from "../../../../base/common/platform.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Severity, INotificationService, NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { URI } from "../../../../base/common/uri.js";
import { platform } from "../../../../base/common/process.js";
import { RunOnceWorker } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
class LanguageSurvey extends Disposable {
  constructor(data, storageService, notificationService, telemetryService, languageService, textFileService, openerService, productService) {
    super();
    const SESSION_COUNT_KEY = `${data.surveyId}.sessionCount`;
    const LAST_SESSION_DATE_KEY = `${data.surveyId}.lastSessionDate`;
    const SKIP_VERSION_KEY = `${data.surveyId}.skipVersion`;
    const IS_CANDIDATE_KEY = `${data.surveyId}.isCandidate`;
    const EDITED_LANGUAGE_COUNT_KEY = `${data.surveyId}.editedCount`;
    const EDITED_LANGUAGE_DATE_KEY = `${data.surveyId}.editedDate`;
    const skipVersion = storageService.get(SKIP_VERSION_KEY, StorageScope.APPLICATION, "");
    if (skipVersion) {
      return;
    }
    const date = (/* @__PURE__ */ new Date()).toDateString();
    if (storageService.getNumber(EDITED_LANGUAGE_COUNT_KEY, StorageScope.APPLICATION, 0) < data.editCount) {
      const onModelsSavedWorker = this._register(new RunOnceWorker((models) => {
        models.forEach((m) => {
          if (m.getLanguageId() === data.languageId && date !== storageService.get(EDITED_LANGUAGE_DATE_KEY, StorageScope.APPLICATION)) {
            const editedCount = storageService.getNumber(EDITED_LANGUAGE_COUNT_KEY, StorageScope.APPLICATION, 0) + 1;
            storageService.store(EDITED_LANGUAGE_COUNT_KEY, editedCount, StorageScope.APPLICATION, StorageTarget.USER);
            storageService.store(EDITED_LANGUAGE_DATE_KEY, date, StorageScope.APPLICATION, StorageTarget.USER);
          }
        });
      }, 250));
      this._register(textFileService.files.onDidSave((e) => onModelsSavedWorker.work(e.model)));
    }
    const lastSessionDate = storageService.get(LAST_SESSION_DATE_KEY, StorageScope.APPLICATION, (/* @__PURE__ */ new Date(0)).toDateString());
    if (date === lastSessionDate) {
      return;
    }
    const sessionCount = storageService.getNumber(SESSION_COUNT_KEY, StorageScope.APPLICATION, 0) + 1;
    storageService.store(LAST_SESSION_DATE_KEY, date, StorageScope.APPLICATION, StorageTarget.USER);
    storageService.store(SESSION_COUNT_KEY, sessionCount, StorageScope.APPLICATION, StorageTarget.USER);
    if (sessionCount < 9) {
      return;
    }
    if (storageService.getNumber(EDITED_LANGUAGE_COUNT_KEY, StorageScope.APPLICATION, 0) < data.editCount) {
      return;
    }
    const isCandidate = storageService.getBoolean(IS_CANDIDATE_KEY, StorageScope.APPLICATION, false) || Math.random() < data.userProbability;
    storageService.store(IS_CANDIDATE_KEY, isCandidate, StorageScope.APPLICATION, StorageTarget.USER);
    if (!isCandidate) {
      storageService.store(SKIP_VERSION_KEY, productService.version, StorageScope.APPLICATION, StorageTarget.USER);
      return;
    }
    notificationService.prompt(
      Severity.Info,
      localize("helpUs", "Help us improve our support for {0}", languageService.getLanguageName(data.languageId) ?? data.languageId),
      [{
        label: localize("takeShortSurvey", "Take Short Survey"),
        run: () => {
          telemetryService.publicLog(`${data.surveyId}.survey/takeShortSurvey`);
          openerService.open(URI.parse(`${data.surveyUrl}?o=${encodeURIComponent(platform)}&v=${encodeURIComponent(productService.version)}&m=${encodeURIComponent(telemetryService.machineId)}`));
          storageService.store(IS_CANDIDATE_KEY, false, StorageScope.APPLICATION, StorageTarget.USER);
          storageService.store(SKIP_VERSION_KEY, productService.version, StorageScope.APPLICATION, StorageTarget.USER);
        }
      }, {
        label: localize("remindLater", "Remind Me Later"),
        run: () => {
          telemetryService.publicLog(`${data.surveyId}.survey/remindMeLater`);
          storageService.store(SESSION_COUNT_KEY, sessionCount - 3, StorageScope.APPLICATION, StorageTarget.USER);
        }
      }, {
        label: localize("neverAgain", "Don't Show Again"),
        isSecondary: true,
        run: () => {
          telemetryService.publicLog(`${data.surveyId}.survey/dontShowAgain`);
          storageService.store(IS_CANDIDATE_KEY, false, StorageScope.APPLICATION, StorageTarget.USER);
          storageService.store(SKIP_VERSION_KEY, productService.version, StorageScope.APPLICATION, StorageTarget.USER);
        }
      }],
      { priority: NotificationPriority.OPTIONAL }
    );
  }
}
let LanguageSurveysContribution = class {
  constructor(storageService, notificationService, telemetryService, textFileService, openerService, productService, languageService, extensionService) {
    this.storageService = storageService;
    this.notificationService = notificationService;
    this.telemetryService = telemetryService;
    this.textFileService = textFileService;
    this.openerService = openerService;
    this.productService = productService;
    this.languageService = languageService;
    this.extensionService = extensionService;
    this.handleSurveys();
  }
  async handleSurveys() {
    if (!this.productService.surveys) {
      return;
    }
    await this.extensionService.whenInstalledExtensionsRegistered();
    this.productService.surveys.filter((surveyData) => surveyData.surveyId && surveyData.editCount && surveyData.languageId && surveyData.surveyUrl && surveyData.userProbability).map((surveyData) => new LanguageSurvey(surveyData, this.storageService, this.notificationService, this.telemetryService, this.languageService, this.textFileService, this.openerService, this.productService));
  }
};
LanguageSurveysContribution = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IProductService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, IExtensionService)
], LanguageSurveysContribution);
if (language === "en") {
  const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
  workbenchRegistry.registerWorkbenchContribution(LanguageSurveysContribution, LifecyclePhase.Restored);
}
