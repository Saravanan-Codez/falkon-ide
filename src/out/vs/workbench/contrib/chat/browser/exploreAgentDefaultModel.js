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
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { ChatConfiguration } from "../common/constants.js";
import { ILanguageModelsService } from "../common/languageModels.js";
import { createDefaultModelArrays, DefaultModelContribution } from "./defaultModelContribution.js";
const arrays = createDefaultModelArrays();
let ExploreAgentDefaultModel = class extends DefaultModelContribution {
  static {
    this.ID = "workbench.contrib.exploreAgentDefaultModel";
  }
  static {
    this.modelIds = arrays.modelIds;
  }
  static {
    this.modelLabels = arrays.modelLabels;
  }
  static {
    this.modelDescriptions = arrays.modelDescriptions;
  }
  constructor(languageModelsService, logService) {
    super(arrays, {
      configKey: ChatConfiguration.ExploreAgentDefaultModel,
      configSectionId: "chatSidebar",
      logPrefix: "[ExploreAgentDefaultModel]",
      filter: (metadata) => !!metadata.capabilities?.toolCalling
    }, languageModelsService, logService);
  }
};
ExploreAgentDefaultModel = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, ILogService)
], ExploreAgentDefaultModel);
registerWorkbenchContribution2(ExploreAgentDefaultModel.ID, ExploreAgentDefaultModel, WorkbenchPhase.BlockRestore);
export {
  ExploreAgentDefaultModel
};
