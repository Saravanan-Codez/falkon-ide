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
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ILanguageModelsService } from "../../chat/common/languageModels.js";
import { InlineChatConfigKeys } from "../common/inlineChat.js";
import { createDefaultModelArrays, DefaultModelContribution } from "../../chat/browser/defaultModelContribution.js";
const arrays = createDefaultModelArrays();
let InlineChatDefaultModel = class extends DefaultModelContribution {
  static {
    this.ID = "workbench.contrib.inlineChatDefaultModel";
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
      configKey: InlineChatConfigKeys.DefaultModel,
      configSectionId: "inlineChat",
      logPrefix: "[InlineChatDefaultModel]",
      filter: (metadata) => !!metadata.capabilities?.toolCalling
    }, languageModelsService, logService);
  }
};
InlineChatDefaultModel = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, ILogService)
], InlineChatDefaultModel);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...{ id: "inlineChat", title: localize("inlineChatConfigurationTitle", "Inline Chat"), order: 30, type: "object" },
  properties: {
    [InlineChatConfigKeys.DefaultModel]: {
      description: localize("inlineChatDefaultModelDescription", "Select the default language model to use for inline chat from the available providers. Model names may include the provider in parentheses, for example 'Claude Haiku 4.5 (copilot)'."),
      type: "string",
      default: "",
      order: 1,
      enum: InlineChatDefaultModel.modelIds,
      enumItemLabels: InlineChatDefaultModel.modelLabels,
      markdownEnumDescriptions: InlineChatDefaultModel.modelDescriptions
    }
  }
});
export {
  InlineChatDefaultModel
};
