import { raceCancellation } from "../../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
const RUN_ONBOARDING_STEP_KIND = "run";
class RunOnboardingStepPresentation {
  constructor() {
    this.kind = RUN_ONBOARDING_STEP_KIND;
    this.countsAsVisualStep = false;
    this.runOnce = true;
  }
  async runStep(step, context) {
    if (context.cancellationToken.isCancellationRequested) {
      return { action: "abort", shown: false };
    }
    let result = void 0;
    try {
      const payload = step.payload;
      result = await raceCancellation(Promise.resolve(payload.run(context.cancellationToken)), context.cancellationToken);
    } catch (error) {
      if (!context.cancellationToken.isCancellationRequested) {
        onUnexpectedError(error);
      }
    }
    return context.cancellationToken.isCancellationRequested ? { action: "abort", shown: false } : { action: "next", shown: result?.shown === true };
  }
}
export {
  RUN_ONBOARDING_STEP_KIND,
  RunOnboardingStepPresentation
};
