import { ShutdownReason } from "../../../services/lifecycle/common/lifecycle.js";
import { AgentSessionProviders } from "../browser/agentSessions/agentSessions.js";
import { isSessionInProgressStatus } from "../browser/agentSessions/agentSessionsModel.js";
import { isLocalAgentHostTarget, isRemoteAgentHostTarget } from "../common/chatSessionsService.js";
function shouldWarnForSessionShutdown(session, reason) {
  if (!isSessionInProgressStatus(session.status) || session.providerType === AgentSessionProviders.Cloud || session.isArchived()) {
    return false;
  }
  if (isRemoteAgentHostTarget(session.providerType)) {
    return false;
  }
  if (isLocalAgentHostTarget(session.providerType)) {
    return reason === ShutdownReason.QUIT;
  }
  return true;
}
export {
  shouldWarnForSessionShutdown
};
