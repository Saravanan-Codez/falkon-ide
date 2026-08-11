import "./media/variationA.css";
import { localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IOnboardingService } from "../common/onboardingService.js";
import { OnboardingVariationA } from "./onboardingVariationA.js";
registerSingleton(IOnboardingService, OnboardingVariationA, InstantiationType.Delayed);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.welcomeOnboarding2026",
      title: localize2("welcomeOnboarding2026", "Welcome Onboarding 2026"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const onboardingService = accessor.get(IOnboardingService);
    onboardingService.show();
  }
});
