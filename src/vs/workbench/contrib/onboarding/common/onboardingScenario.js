const ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX = "onb-";
var OnboardingOutcome = /* @__PURE__ */ ((OnboardingOutcome2) => {
  OnboardingOutcome2["Completed"] = "completed";
  OnboardingOutcome2["Skipped"] = "skipped";
  OnboardingOutcome2["Dismissed"] = "dismissed";
  OnboardingOutcome2["Aborted"] = "aborted";
  return OnboardingOutcome2;
})(OnboardingOutcome || {});
var OnboardingDismissReason = /* @__PURE__ */ ((OnboardingDismissReason2) => {
  OnboardingDismissReason2["Completed"] = "completed";
  OnboardingDismissReason2["SkipButton"] = "skipButton";
  OnboardingDismissReason2["EscapeKey"] = "escapeKey";
  OnboardingDismissReason2["TargetClick"] = "targetClick";
  OnboardingDismissReason2["Aborted"] = "aborted";
  return OnboardingDismissReason2;
})(OnboardingDismissReason || {});
export {
  ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX,
  OnboardingDismissReason,
  OnboardingOutcome
};
