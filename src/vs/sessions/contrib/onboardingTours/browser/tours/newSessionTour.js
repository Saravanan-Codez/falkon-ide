import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { EditorPartModalContext } from "../../../../../workbench/common/contextkeys.js";
import { ChatContextKeys } from "../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { SPOTLIGHT_PRESENTATION_KIND } from "../../../../../workbench/contrib/onboarding/browser/spotlight/spotlightTypes.js";
import { localize } from "../../../../../nls.js";
const NEW_SESSION_TOUR_ID = "sessions.onboarding.newSession";
const NEW_SESSION_ONBOARDING_SEEN_KEY = NEW_SESSION_TOUR_ID;
const NEW_SESSION_EXPERIMENT = {
  behaviorFlag: "onb.newSession.show",
  assignmentContextIdFlag: "onb.newSession.id"
};
const newSessionPayload = {
  steps: [
    {
      id: "workspacePicker",
      targetId: "sessions.newSession.workspacePicker",
      title: localize("sessions.onboarding.workspace.title", "Work Across Workspaces"),
      description: localize("sessions.onboarding.workspace.description", "Choose between the folders and repositories you work in. Run multiple sessions at once in a single workspace, or across many."),
      placement: "above"
    },
    {
      id: "isolation",
      targetId: "sessions.newSession.isolation",
      title: localize("sessions.onboarding.isolation.title", "Isolate Your Work"),
      description: localize("sessions.onboarding.isolation.description", "Use a worktree to work on multiple tasks in the same project without conflicts. Each task stays isolated, so you can experiment freely and safely."),
      placement: "below"
    }
  ]
};
function createNewSessionTour(signal) {
  return {
    id: NEW_SESSION_TOUR_ID,
    seenKey: NEW_SESSION_ONBOARDING_SEEN_KEY,
    when: ContextKeyExpr.and(ChatContextKeys.enabled, EditorPartModalContext.toNegated()),
    trigger: { kind: "observable", signal },
    priority: 100,
    experiment: NEW_SESSION_EXPERIMENT,
    presentation: {
      kind: SPOTLIGHT_PRESENTATION_KIND,
      payload: newSessionPayload
    }
  };
}
export {
  NEW_SESSION_ONBOARDING_SEEN_KEY,
  NEW_SESSION_TOUR_ID,
  createNewSessionTour
};
