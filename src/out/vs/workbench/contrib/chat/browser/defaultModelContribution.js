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
import { localize } from "../../../../nls.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ILanguageModelChatMetadata, ILanguageModelsService } from "../common/languageModels.js";
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
function createDefaultModelArrays(defaultEntryLabel, defaultEntryDescription) {
  return {
    modelIds: [""],
    modelLabels: [defaultEntryLabel ?? localize("defaultModel", "Auto (Vendor Default)")],
    modelDescriptions: [defaultEntryDescription ?? localize("defaultModelDescription", "Use the vendor's default model")]
  };
}
let DefaultModelContribution = class extends Disposable {
  constructor(_arrays, _options, _languageModelsService, _logService) {
    super();
    this._arrays = _arrays;
    this._options = _options;
    this._languageModelsService = _languageModelsService;
    this._logService = _logService;
    this._register(_languageModelsService.onDidChangeLanguageModels(() => this._updateModelValues()));
    this._updateModelValues();
  }
  _updateModelValues() {
    const { modelIds, modelLabels, modelDescriptions } = this._arrays;
    const { configKey, configSectionId, logPrefix, filter, storageFormat, defaultEntryLabel, defaultEntryDescription } = this._options;
    try {
      modelIds.length = 0;
      modelLabels.length = 0;
      modelDescriptions.length = 0;
      modelIds.push("");
      modelLabels.push(defaultEntryLabel ?? localize("defaultModel", "Auto (Vendor Default)"));
      modelDescriptions.push(defaultEntryDescription ?? localize("defaultModelDescription", "Use the vendor's default model"));
      const models = [];
      const allModelIds = this._languageModelsService.getLanguageModelIds();
      for (const modelId of allModelIds) {
        try {
          const metadata = this._languageModelsService.lookupLanguageModel(modelId);
          if (metadata) {
            models.push({ identifier: modelId, metadata });
          } else {
            this._logService.warn(`${logPrefix} No metadata found for model ID: ${modelId}`);
          }
        } catch (e) {
          this._logService.error(`${logPrefix} Error looking up model ${modelId}:`, e);
        }
      }
      const vendors = this._languageModelsService.getVendors();
      const visibleVendors = new Set(vendors.map((vendor) => vendor.vendor));
      const supportedModels = models.filter((model) => {
        if (!visibleVendors.has(model.metadata.vendor)) {
          return false;
        }
        if (model.metadata?.isUserSelectable === false) {
          return false;
        }
        if (model.metadata?.targetChatSessionType !== void 0) {
          return false;
        }
        if (filter && !filter(model.metadata)) {
          return false;
        }
        return true;
      });
      supportedModels.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
      const vendorDisplayNames = /* @__PURE__ */ new Map();
      for (const vendor of vendors) {
        vendorDisplayNames.set(vendor.vendor, vendor.displayName);
      }
      const ambiguousVendorIds = /* @__PURE__ */ new Set();
      if (storageFormat === "vendorAndId") {
        const counts = /* @__PURE__ */ new Map();
        for (const model of models) {
          const key = `${model.metadata.vendor}/${model.metadata.id}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [key, count] of counts) {
          if (count > 1) {
            ambiguousVendorIds.add(key);
          }
        }
      }
      for (const model of supportedModels) {
        try {
          const storedId = storageFormat === "vendorAndId" ? `${model.metadata.vendor}/${model.metadata.id}` : ILanguageModelChatMetadata.asQualifiedName(model.metadata);
          if (ambiguousVendorIds.has(storedId)) {
            this._logService.trace(`${logPrefix} Skipping model '${model.metadata.name}' (${storedId}): key collides with another registered model.`);
            continue;
          }
          const vendorDisplayName = vendorDisplayNames.get(model.metadata.vendor);
          if (!vendorDisplayName) {
            this._logService.trace(`${logPrefix} No vendor descriptor for '${model.metadata.vendor}' (model '${model.metadata.id}'); falling back to vendor id in label.`);
          }
          modelIds.push(storedId);
          modelLabels.push(localize("modelLabelWithVendor", "{0} ({1})", model.metadata.name, vendorDisplayName ?? model.metadata.vendor));
          modelDescriptions.push(model.metadata.tooltip ?? model.metadata.detail ?? "");
        } catch (e) {
          this._logService.error(`${logPrefix} Error adding model ${model.metadata.name}:`, e);
        }
      }
      if (configSectionId) {
        configurationRegistry.notifyConfigurationSchemaUpdated({
          id: configSectionId,
          properties: {
            [configKey]: {}
          }
        });
      }
    } catch (e) {
      this._logService.error(`${logPrefix} Error updating model values:`, e);
    }
  }
};
DefaultModelContribution = __decorateClass([
  __decorateParam(2, ILanguageModelsService),
  __decorateParam(3, ILogService)
], DefaultModelContribution);
export {
  DefaultModelContribution,
  createDefaultModelArrays
};
