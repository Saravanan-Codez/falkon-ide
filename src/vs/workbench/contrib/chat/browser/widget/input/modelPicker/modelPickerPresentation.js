import { localize } from "../../../../../../../nls.js";
import { isAutoLanguageModel } from "../../../../common/languageModels.js";
import { ChatEntitlement } from "../../../../../../services/chat/common/chatEntitlementService.js";
function isAutoModel(model) {
  return isAutoLanguageModel(model);
}
function isMultiplierPricing(model) {
  return model.metadata.multiplierNumeric !== void 0;
}
function getPriceCategoryLabel(priceCategory) {
  if (typeof priceCategory !== "string" || priceCategory.length === 0) {
    return void 0;
  }
  switch (priceCategory) {
    case "low":
      return localize("chat.priceCategory.low", "Low cost");
    case "medium":
      return localize("chat.priceCategory.medium", "Medium cost");
    case "high":
      return localize("chat.priceCategory.high", "High cost");
    case "very_high":
      return localize("chat.priceCategory.veryHigh", "Very high cost");
    default:
      return localize("chat.priceCategory.unknown", "{0} cost", priceCategory.charAt(0).toUpperCase() + priceCategory.slice(1));
  }
}
var ModelPickerUnavailableReason = /* @__PURE__ */ ((ModelPickerUnavailableReason2) => {
  ModelPickerUnavailableReason2["Restricted"] = "restricted";
  ModelPickerUnavailableReason2["SetupRequired"] = "setupRequired";
  return ModelPickerUnavailableReason2;
})(ModelPickerUnavailableReason || {});
function modelPickerRequiresSetup(context) {
  return context.entitlement === ChatEntitlement.Available || context.entitlement === ChatEntitlement.Unknown && !context.anonymous && !context.hasByokModels;
}
function getModelPickerUnavailableReason(context) {
  if (!context.trustInitialized) {
    return void 0;
  }
  if (!context.trusted) {
    return "restricted" /* Restricted */;
  }
  const live = context.liveModelIds instanceof Set ? context.liveModelIds : new Set(context.liveModelIds);
  if (context.pickerModels.some((model) => live.has(model.identifier))) {
    return void 0;
  }
  return context.requiresSetup ? "setupRequired" /* SetupRequired */ : void 0;
}
function shouldShowCacheBreakHint(context) {
  if (context.dismissed || !context.cacheWarm || context.noModelsAvailable) {
    return false;
  }
  return !(context.excludeAutoModel && context.selectedModelIsAuto);
}
export {
  ModelPickerUnavailableReason,
  getModelPickerUnavailableReason,
  getPriceCategoryLabel,
  isAutoModel,
  isMultiplierPricing,
  modelPickerRequiresSetup,
  shouldShowCacheBreakHint
};
