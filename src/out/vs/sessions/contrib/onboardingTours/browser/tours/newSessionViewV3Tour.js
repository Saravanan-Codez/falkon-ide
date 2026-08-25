import { RUN_ONBOARDING_STEP_KIND } from "../../../../../workbench/contrib/onboarding/browser/sequence/runOnboardingStep.js";
import { SPOTLIGHT_PRESENTATION_KIND } from "../../../../../workbench/contrib/onboarding/browser/spotlight/spotlightTypes.js";
import { ONBOARDING_SEQUENCE_PRESENTATION_KIND } from "../../../../../workbench/contrib/onboarding/common/onboardingSequence.js";
import { NEW_SESSION_ONBOARDING_SEEN_KEY } from "./newSessionTour.js";
import { createNewSessionViewRecentTourWhen, createNewSessionViewWorkspaceStep } from "./newSessionViewTourShared.js";
const NEW_SESSION_VIEW_V3_TOUR_ID = "sessions.onboarding.newSessionViewV3";
const NEW_SESSION_VIEW_V3_PROMPT_VARIATION = "prompt";
const NEW_SESSION_VIEW_V3_GITHUB_PROMPT_VARIATION = "githubPrompt";
const NEW_SESSION_VIEW_V3_OPTIONS_VARIATION = "options";
const NEW_SESSION_VIEW_V3_VARIATION_TREATMENT = "onb.newSessionViewV3.variation";
const NEW_SESSION_VIEW_V3_VARIATIONS = [NEW_SESSION_VIEW_V3_PROMPT_VARIATION, NEW_SESSION_VIEW_V3_GITHUB_PROMPT_VARIATION, NEW_SESSION_VIEW_V3_OPTIONS_VARIATION];
const NEW_SESSION_VIEW_V3_EXPERIMENT = {
  behaviorFlag: "onb.newSessionViewV3.show",
  assignmentContextIdFlag: "onb.newSessionViewV3.id"
};
function createNewSessionViewV3Tour(signal, runPromptStep) {
  return {
    id: NEW_SESSION_VIEW_V3_TOUR_ID,
    seenKey: NEW_SESSION_ONBOARDING_SEEN_KEY,
    developerModeVariations: NEW_SESSION_VIEW_V3_VARIATIONS,
    when: createNewSessionViewRecentTourWhen(),
    trigger: { kind: "observable", signal },
    priority: 120,
    experiment: NEW_SESSION_VIEW_V3_EXPERIMENT,
    presentation: {
      kind: ONBOARDING_SEQUENCE_PRESENTATION_KIND,
      payload: {
        steps: [
          {
            id: "workspacePicker",
            kind: SPOTLIGHT_PRESENTATION_KIND,
            payload: createNewSessionViewWorkspaceStep()
          },
          {
            id: "insertPrompt",
            kind: RUN_ONBOARDING_STEP_KIND,
            payload: {
              run: async (token) => ({ shown: await runPromptStep(token) })
            }
          }
        ]
      }
    }
  };
}
export {
  NEW_SESSION_VIEW_V3_GITHUB_PROMPT_VARIATION,
  NEW_SESSION_VIEW_V3_OPTIONS_VARIATION,
  NEW_SESSION_VIEW_V3_PROMPT_VARIATION,
  NEW_SESSION_VIEW_V3_TOUR_ID,
  NEW_SESSION_VIEW_V3_VARIATIONS,
  NEW_SESSION_VIEW_V3_VARIATION_TREATMENT,
  createNewSessionViewV3Tour
};
