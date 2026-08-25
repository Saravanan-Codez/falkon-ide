import { localize } from "../../../../../nls.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { EditorPartModalVisibleContext } from "../../../../../workbench/common/contextkeys.js";
import { ChatContextKeys } from "../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { ChatEntitlementContextKeys } from "../../../../../workbench/services/chat/common/chatEntitlementService.js";
import { AgentHostSessionTypesAvailableContext, IsNewChatSessionContext, SessionHasWorkspaceContext, SessionWorkspacePickerVisibleContext } from "../../../../common/contextkeys.js";
function createNewSessionViewRecentTourWhen() {
  return ContextKeyExpr.and(
    ChatContextKeys.enabled,
    IsNewChatSessionContext,
    AgentHostSessionTypesAvailableContext,
    ChatEntitlementContextKeys.Entitlement.signedOut.toNegated(),
    EditorPartModalVisibleContext.toNegated()
  );
}
function createNewSessionViewWorkspaceStep() {
  return {
    id: "workspacePicker",
    targetId: "sessions.newSession.workspacePicker",
    title: localize("sessions.onboarding.newSessionViewV2.workspace.title", "Choose a workspace"),
    description: localize("sessions.onboarding.newSessionViewV2.workspace.description", "A workspace is the folder or repository where your agent reads context and makes changes. Choose one so it can understand your project and work on the right files."),
    placement: "above",
    when: ContextKeyExpr.and(SessionWorkspacePickerVisibleContext, SessionHasWorkspaceContext.toNegated()),
    missingTarget: { kind: "skip" },
    openTarget: true,
    allowTargetInteraction: true,
    advanceWhen: SessionHasWorkspaceContext
  };
}
export {
  createNewSessionViewRecentTourWhen,
  createNewSessionViewWorkspaceStep
};
