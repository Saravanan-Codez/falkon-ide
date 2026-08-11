import { localize, localize2 } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IProgressService } from "../../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import {
  getEntryAddress,
  IRemoteAgentHostService,
  RemoteAgentHostEntryType,
  RemoteAgentHostsEnabledSettingId
} from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { computeSSHConnectionKey } from "../../../../../platform/agentHost/common/sshRemoteAgentHost.js";
import { ITunnelAgentHostService, TUNNEL_ADDRESS_PREFIX } from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { IRemoteAgentHostLocationPreferenceService } from "../../../../../platform/agentHost/common/remoteAgentHostLocationPreference.js";
import { ChangeRemoteAgentHostLocationPreferenceCommandId } from "../../../../../platform/agentHost/common/remoteAgentHostLocationPreferenceDialog.js";
import { CHAT_CATEGORY } from "../../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { ChatContextKeys } from "../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { isAgentHostProvider } from "../../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { changeRemoteAgentHostLocationPreference } from "../browser/remoteHostOptions.js";
function collectRemoteAgentHostLocationTargets(sshEntries, cachedTunnels) {
  const targets = /* @__PURE__ */ new Map();
  for (const entry of sshEntries) {
    if (entry.connection.type !== RemoteAgentHostEntryType.SSH) {
      continue;
    }
    const preferenceKey = computeSSHConnectionKey({
      sshConfigHost: entry.connection.sshConfigHost,
      username: entry.connection.user,
      host: entry.connection.hostName,
      port: entry.connection.port
    });
    if (!targets.has(preferenceKey)) {
      targets.set(preferenceKey, { preferenceKey, address: getEntryAddress(entry), label: entry.name });
    }
  }
  for (const tunnel of cachedTunnels) {
    const preferenceKey = `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`;
    if (!targets.has(preferenceKey)) {
      targets.set(preferenceKey, { preferenceKey, address: preferenceKey, label: tunnel.name });
    }
  }
  return [...targets.values()];
}
async function pickRemoteAgentHostLocationTarget(quickInputService, targets) {
  if (targets.length <= 1) {
    return targets[0];
  }
  const picked = await quickInputService.pick(
    targets.map((target) => ({ label: target.label, target })),
    { placeHolder: localize("remoteAgentHostLocation.pickHost", "Select a remote host to change its preferred agent run location") }
  );
  return picked?.target;
}
function findAgentHostProviderForTarget(providers, liveAddress) {
  return providers.filter(isAgentHostProvider).find((provider) => provider.remoteAddress === liveAddress);
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: ChangeRemoteAgentHostLocationPreferenceCommandId,
      title: localize2("changeRemoteAgentHostLocationPreference", "Change Preferred Remote Agent Location"),
      category: CHAT_CATEGORY,
      f1: true,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true)
      )
    });
  }
  async run(accessor) {
    const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
    const tunnelAgentHostService = accessor.get(ITunnelAgentHostService);
    const locationPreferenceService = accessor.get(IRemoteAgentHostLocationPreferenceService);
    const quickInputService = accessor.get(IQuickInputService);
    const dialogService = accessor.get(IDialogService);
    const notificationService = accessor.get(INotificationService);
    const productService = accessor.get(IProductService);
    const progressService = accessor.get(IProgressService);
    const sessionsProvidersService = accessor.get(ISessionsProvidersService);
    const targets = collectRemoteAgentHostLocationTargets(remoteAgentHostService.configuredEntries, tunnelAgentHostService.getCachedTunnels());
    if (targets.length === 0) {
      notificationService.info(localize("remoteAgentHostLocation.noHosts", "No remote agent hosts are configured yet. Connect to one first, then change its preferred agent run location."));
      return;
    }
    const target = await pickRemoteAgentHostLocationTarget(quickInputService, targets);
    if (!target) {
      return;
    }
    const provider = findAgentHostProviderForTarget(sessionsProvidersService.getProviders(), target.address);
    await changeRemoteAgentHostLocationPreference({
      preferenceKey: target.preferenceKey,
      hostLabel: target.label,
      productName: productService.nameShort,
      provider,
      dialogService,
      locationPreferenceService,
      notificationService,
      remoteAgentHostService,
      progressService
    });
  }
});
export {
  collectRemoteAgentHostLocationTargets,
  findAgentHostProviderForTarget,
  pickRemoteAgentHostLocationTarget
};
