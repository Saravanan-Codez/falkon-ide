import { localize } from "../../../../nls.js";
import { isMacintosh } from "../../../../base/common/platform.js";
var OnboardingStepId = /* @__PURE__ */ ((OnboardingStepId2) => {
  OnboardingStepId2["SignIn"] = "onboarding.signIn";
  OnboardingStepId2["Personalize"] = "onboarding.personalize";
  OnboardingStepId2["AiPreference"] = "onboarding.aiPreference";
  OnboardingStepId2["AgentSessions"] = "onboarding.agentSessions";
  return OnboardingStepId2;
})(OnboardingStepId || {});
function getOnboardingStepTitle(stepId) {
  switch (stepId) {
    case "onboarding.signIn" /* SignIn */:
      return localize("onboarding.step.signIn", "Sign In");
    case "onboarding.personalize" /* Personalize */:
      return localize("onboarding.step.personalize", "Make It Yours");
    case "onboarding.aiPreference" /* AiPreference */:
      return localize("onboarding.step.aiPreference", "Your AI Style");
    case "onboarding.agentSessions" /* AgentSessions */:
      return localize("onboarding.step.agentSessions", "Build with AI Agents");
  }
}
function getOnboardingStepSubtitle(stepId) {
  switch (stepId) {
    case "onboarding.signIn" /* SignIn */:
      return localize("onboarding.step.signIn.subtitle", "Sync settings, unlock AI features, and connect to GitHub");
    case "onboarding.personalize" /* Personalize */:
      return localize("onboarding.step.personalize.subtitle", "Choose your theme and keyboard mapping");
    case "onboarding.aiPreference" /* AiPreference */:
      return localize("onboarding.step.aiPreference.subtitle", "Choose how much AI collaboration fits your workflow");
    case "onboarding.agentSessions" /* AgentSessions */:
      return localize("onboarding.step.agentSessions.subtitle", "Open Chat anytime with {0}", isMacintosh ? "\u2318\u2303I" : "Ctrl+Alt+I");
  }
}
const ONBOARDING_STEPS = [
  "onboarding.signIn" /* SignIn */,
  "onboarding.personalize" /* Personalize */,
  "onboarding.agentSessions" /* AgentSessions */
];
var AiCollaborationMode = /* @__PURE__ */ ((AiCollaborationMode2) => {
  AiCollaborationMode2["CodeFirst"] = "code-first";
  AiCollaborationMode2["Balanced"] = "balanced";
  AiCollaborationMode2["AgentForward"] = "agent-forward";
  return AiCollaborationMode2;
})(AiCollaborationMode || {});
const ONBOARDING_AI_PREFERENCE_OPTIONS = [
  {
    id: "code-first" /* CodeFirst */,
    label: localize("onboarding.aiPref.codeFirst", "I Write the Code"),
    description: localize("onboarding.aiPref.codeFirst.desc", "AI assists with suggestions and answers questions when you ask. You stay in control of every edit."),
    icon: "edit"
  },
  {
    id: "balanced" /* Balanced */,
    label: localize("onboarding.aiPref.balanced", "Side by Side"),
    description: localize("onboarding.aiPref.balanced.desc", "Inline suggestions plus a chat panel for deeper collaboration. A balance of writing and delegating."),
    icon: "layoutSidebarRight"
  },
  {
    id: "agent-forward" /* AgentForward */,
    label: localize("onboarding.aiPref.agentForward", "AI Takes the Lead"),
    description: localize("onboarding.aiPref.agentForward.desc", "Let the agent drive \u2014 describe what you want and review the result. Great for scaffolding and exploration."),
    icon: "copilot"
  }
];
const ONBOARDING_STORAGE_KEY = "welcomeOnboarding.state";
const GHE_DOMAIN_REGEX = /^[a-zA-Z0-9-]+$/;
const GHE_FULL_URI_REGEX = /^(https:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.ghe\.com\/?$/;
var GheParseResultKind = /* @__PURE__ */ ((GheParseResultKind2) => {
  GheParseResultKind2["Empty"] = "empty";
  GheParseResultKind2["SingleWord"] = "singleWord";
  GheParseResultKind2["FullUri"] = "fullUri";
  GheParseResultKind2["Invalid"] = "invalid";
  return GheParseResultKind2;
})(GheParseResultKind || {});
function parseGheInstanceInput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: "empty" /* Empty */ };
  }
  if (GHE_DOMAIN_REGEX.test(trimmed)) {
    return { kind: "singleWord" /* SingleWord */, resolvedUri: `https://${trimmed}.ghe.com` };
  }
  if (GHE_FULL_URI_REGEX.test(trimmed)) {
    const resolvedUri = trimmed.toLowerCase().startsWith("https://") ? trimmed : `https://${trimmed}`;
    return { kind: "fullUri" /* FullUri */, resolvedUri };
  }
  return { kind: "invalid" /* Invalid */ };
}
export {
  AiCollaborationMode,
  GHE_DOMAIN_REGEX,
  GHE_FULL_URI_REGEX,
  GheParseResultKind,
  ONBOARDING_AI_PREFERENCE_OPTIONS,
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_KEY,
  OnboardingStepId,
  getOnboardingStepSubtitle,
  getOnboardingStepTitle,
  parseGheInstanceInput
};
