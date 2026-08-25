import { toDisposable } from "../../../../../base/common/lifecycle.js";
import "../media/onboardingTarget.css";
const ONBOARDING_TARGET_ATTR = "data-onboarding-id";
const ONBOARDING_TARGET_PULSE_CLASS = "onboarding-target-pulse";
const onboardingTargetRegistrations = /* @__PURE__ */ new WeakMap();
function markOnboardingTarget(element, id, options = {}) {
  const registration = { id, options };
  element.setAttribute(ONBOARDING_TARGET_ATTR, id);
  onboardingTargetRegistrations.set(element, registration);
  return toDisposable(() => {
    if (onboardingTargetRegistrations.get(element) === registration) {
      onboardingTargetRegistrations.delete(element);
      element.removeAttribute(ONBOARDING_TARGET_ATTR);
    }
  });
}
function openOnboardingTarget(element) {
  return onboardingTargetRegistrations.get(element)?.options.open?.();
}
function pulseOnboardingTarget(element) {
  element.classList.add(ONBOARDING_TARGET_PULSE_CLASS);
  return toDisposable(() => element.classList.remove(ONBOARDING_TARGET_PULSE_CLASS));
}
function findOnboardingTarget(targetWindow, id) {
  const selector = `[${ONBOARDING_TARGET_ATTR}="${CSS.escape(id)}"]`;
  const targets = Array.from(targetWindow.document.querySelectorAll(selector));
  return targets.find((target) => isVisibleOnboardingTarget(targetWindow, target));
}
function isVisibleOnboardingTarget(targetWindow, target) {
  if (!target.isConnected) {
    return false;
  }
  const style = targetWindow.getComputedStyle(target);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = target.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
export {
  ONBOARDING_TARGET_ATTR,
  ONBOARDING_TARGET_PULSE_CLASS,
  findOnboardingTarget,
  markOnboardingTarget,
  openOnboardingTarget,
  pulseOnboardingTarget
};
