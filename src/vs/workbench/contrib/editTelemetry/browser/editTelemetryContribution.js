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
import { autorun, derived } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { ITelemetryService, TelemetryLevel, telemetryLevelEnabled } from "../../../../platform/telemetry/common/telemetry.js";
import { AnnotatedDocuments } from "./helpers/annotatedDocuments.js";
import { EditTrackingFeature } from "./telemetry/editSourceTrackingFeature.js";
import { VSCodeWorkspace } from "./helpers/vscodeObservableWorkspace.js";
import { AiStatsFeature } from "./editStats/aiStatsFeature.js";
import { AI_STATS_SETTING_ID, EDIT_TELEMETRY_SETTING_ID } from "./settingIds.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
import { AiContributionFeature } from "./aiContributionFeature.js";
let EditTelemetryContribution = class extends Disposable {
  constructor(instantiationService, configurationService, telemetryService, chatEntitlementService) {
    super();
    const workspace = derived((reader) => reader.store.add(instantiationService.createInstance(VSCodeWorkspace)));
    const annotatedDocuments = derived((reader) => reader.store.add(instantiationService.createInstance(AnnotatedDocuments, workspace.read(reader))));
    const editSourceTrackingEnabled = observableConfigValue(EDIT_TELEMETRY_SETTING_ID, true, configurationService);
    this._register(autorun((r) => {
      const enabled = editSourceTrackingEnabled.read(r);
      if (!enabled || !telemetryLevelEnabled(telemetryService, TelemetryLevel.USAGE)) {
        return;
      }
      r.store.add(instantiationService.createInstance(EditTrackingFeature, workspace.read(r), annotatedDocuments.read(r)));
    }));
    const aiStatsEnabled = observableConfigValue(AI_STATS_SETTING_ID, true, configurationService);
    this._register(autorun((r) => {
      const enabled = aiStatsEnabled.read(r);
      const aiDisabled = chatEntitlementService.sentimentObs.read(r).hidden;
      if (!enabled || aiDisabled) {
        return;
      }
      r.store.add(instantiationService.createInstance(AiStatsFeature, annotatedDocuments.read(r)));
    }));
    this._register(CommandsRegistry.registerCommand("_aiEdits.hasAiContributions", () => false));
    this._register(CommandsRegistry.registerCommand("_aiEdits.clearAiContributions", () => {
    }));
    this._register(CommandsRegistry.registerCommand("_aiEdits.clearAllAiContributions", () => {
    }));
    const addAICoAuthor = observableConfigValue("git.addAICoAuthor", "off", configurationService);
    this._register(autorun((r) => {
      if (addAICoAuthor.read(r) === "off") {
        return;
      }
      const aiDisabled = chatEntitlementService.sentimentObs.read(r).hidden;
      if (aiDisabled) {
        return;
      }
      r.store.add(instantiationService.createInstance(AiContributionFeature, annotatedDocuments.read(r)));
    }));
  }
};
EditTelemetryContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IChatEntitlementService)
], EditTelemetryContribution);
export {
  EditTelemetryContribution
};
