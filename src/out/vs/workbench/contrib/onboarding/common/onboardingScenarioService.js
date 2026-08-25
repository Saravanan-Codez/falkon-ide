import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IOnboardingScenarioService = createDecorator("onboardingScenarioService");
const ONBOARDING_ENABLED_CONFIG = "onboarding.enabled";
const ONBOARDING_DEVELOPER_MODE_CONFIG = "onboarding.developerMode";
const ONBOARDING_DEVELOPER_MODE_VARIATIONS_CONFIG = "onboarding.developerModeVariations";
function isOnboardingDeveloperModeEnabled(configurationService, scenarioId) {
  const value = configurationService.getValue(ONBOARDING_DEVELOPER_MODE_CONFIG);
  return typeof value === "object" && value !== null && value[scenarioId] === true;
}
function getOnboardingDeveloperModeVariation(configurationService, scenarioId) {
  if (!isOnboardingDeveloperModeEnabled(configurationService, scenarioId)) {
    return void 0;
  }
  const value = configurationService.getValue(ONBOARDING_DEVELOPER_MODE_VARIATIONS_CONFIG);
  const variation = typeof value === "object" && value !== null ? value[scenarioId] : void 0;
  return typeof variation === "string" && variation.length > 0 ? variation : void 0;
}
export {
  IOnboardingScenarioService,
  ONBOARDING_DEVELOPER_MODE_CONFIG,
  ONBOARDING_DEVELOPER_MODE_VARIATIONS_CONFIG,
  ONBOARDING_ENABLED_CONFIG,
  getOnboardingDeveloperModeVariation,
  isOnboardingDeveloperModeEnabled
};
