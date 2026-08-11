import { SessionConfigKey } from "../../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { ActionType } from "../../../../../../platform/agentHost/common/state/protocol/actions.js";
import { StateComponents } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { ChatConfiguration, ChatPermissionLevel } from "../../../common/constants.js";
import { isUntitledChatSession } from "../../../common/model/chatUri.js";
import { toAgentHostBackendSessionUri } from "./agentHostSessionUri.js";
async function applyAgentHostSessionConfigChange(sessionResource, config, services) {
  const backendSession = toAgentHostBackendSessionUri(sessionResource);
  if (!backendSession) {
    return false;
  }
  const { agentHostService, provisionalService, workingDirectoryResolver, workspaceContextService, configurationService } = services;
  const policyRestricted = configurationService.inspect(ChatConfiguration.GlobalAutoApprove).policyValue === false;
  const partial = { ...config };
  const autoApprove = partial[SessionConfigKey.AutoApprove];
  if (policyRestricted && autoApprove !== void 0 && autoApprove !== ChatPermissionLevel.Default) {
    partial[SessionConfigKey.AutoApprove] = ChatPermissionLevel.Default;
  }
  const workingDirectory = workingDirectoryResolver.resolve(sessionResource) ?? workspaceContextService.getWorkspace().folders[0]?.uri;
  if (isUntitledChatSession(sessionResource)) {
    await provisionalService.applyConfigChange(sessionResource, backendSession.scheme, workingDirectory, partial);
    return true;
  }
  agentHostService.dispatch(backendSession.toString(), {
    type: ActionType.SessionConfigChanged,
    config: partial
  });
  const state = agentHostService.getSubscriptionUnmanaged(StateComponents.Session, backendSession)?.value;
  const currentValues = state && !(state instanceof Error) ? state.config?.values : void 0;
  const nextConfig = { ...currentValues ?? {}, ...partial };
  void provisionalService.refreshResolvedConfig(sessionResource, backendSession.scheme, workingDirectory, nextConfig);
  return true;
}
export {
  applyAgentHostSessionConfigChange
};
