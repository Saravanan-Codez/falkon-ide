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
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
const ILanguageModelStatsService = createDecorator("ILanguageModelStatsService");
let LanguageModelStatsService = class extends Disposable {
  constructor(extensionFeaturesManagementService, storageService) {
    super();
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    for (const key in storageService.keys(StorageScope.APPLICATION, StorageTarget.USER)) {
      if (key.startsWith("languageModelStats.") || key.startsWith("languageModelAccess.")) {
        storageService.remove(key, StorageScope.APPLICATION);
      }
    }
  }
  async update(model, extensionId, agent, tokenCount) {
    await this.extensionFeaturesManagementService.getAccess(extensionId, CopilotUsageExtensionFeatureId);
  }
};
LanguageModelStatsService = __decorateClass([
  __decorateParam(0, IExtensionFeaturesManagementService),
  __decorateParam(1, IStorageService)
], LanguageModelStatsService);
const CopilotUsageExtensionFeatureId = "copilot";
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: CopilotUsageExtensionFeatureId,
  label: localize("Language Models", "Copilot"),
  description: localize("languageModels", "Language models usage statistics of this extension."),
  icon: Codicon.copilot,
  access: {
    canToggle: false
  },
  accessDataLabel: localize("chat", "chat")
});
export {
  CopilotUsageExtensionFeatureId,
  ILanguageModelStatsService,
  LanguageModelStatsService
};
