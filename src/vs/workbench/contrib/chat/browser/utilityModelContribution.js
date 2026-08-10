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
import { ILogService } from "../../../../platform/log/common/log.js";
import { localize } from "../../../../nls.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { ChatConfiguration } from "../common/constants.js";
import { COPILOT_VENDOR_ID, ILanguageModelsService } from "../common/languageModels.js";
import { createDefaultModelArrays, DefaultModelContribution } from "./defaultModelContribution.js";
const defaultEntryLabel = localize("chat.utilityModel.defaultEntry.label", "Default");
const defaultEntryDescription = localize("chat.utilityModel.defaultEntry.description", "Use the default behavior for utility models");
const utilityArrays = createDefaultModelArrays(defaultEntryLabel, defaultEntryDescription);
const utilitySmallArrays = createDefaultModelArrays(defaultEntryLabel, defaultEntryDescription);
let UtilityModelContribution = class extends DefaultModelContribution {
  static {
    this.ID = "workbench.contrib.utilityModel";
  }
  static {
    this.modelIds = utilityArrays.modelIds;
  }
  static {
    this.modelLabels = utilityArrays.modelLabels;
  }
  static {
    this.modelDescriptions = utilityArrays.modelDescriptions;
  }
  constructor(languageModelsService, logService) {
    super(utilityArrays, {
      configKey: ChatConfiguration.UtilityModel,
      configSectionId: "chatSidebar",
      logPrefix: "[UtilityModel]",
      filter: (metadata) => metadata.vendor !== COPILOT_VENDOR_ID,
      storageFormat: "vendorAndId",
      defaultEntryLabel,
      defaultEntryDescription
    }, languageModelsService, logService);
  }
};
UtilityModelContribution = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, ILogService)
], UtilityModelContribution);
let UtilitySmallModelContribution = class extends DefaultModelContribution {
  static {
    this.ID = "workbench.contrib.utilitySmallModel";
  }
  static {
    this.modelIds = utilitySmallArrays.modelIds;
  }
  static {
    this.modelLabels = utilitySmallArrays.modelLabels;
  }
  static {
    this.modelDescriptions = utilitySmallArrays.modelDescriptions;
  }
  constructor(languageModelsService, logService) {
    super(utilitySmallArrays, {
      configKey: ChatConfiguration.UtilitySmallModel,
      configSectionId: "chatSidebar",
      logPrefix: "[UtilitySmallModel]",
      filter: (metadata) => metadata.vendor !== COPILOT_VENDOR_ID,
      storageFormat: "vendorAndId",
      defaultEntryLabel,
      defaultEntryDescription
    }, languageModelsService, logService);
  }
};
UtilitySmallModelContribution = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, ILogService)
], UtilitySmallModelContribution);
registerWorkbenchContribution2(UtilityModelContribution.ID, UtilityModelContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(UtilitySmallModelContribution.ID, UtilitySmallModelContribution, WorkbenchPhase.BlockRestore);
export {
  UtilityModelContribution,
  UtilitySmallModelContribution
};
