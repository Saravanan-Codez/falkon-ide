import { localize } from "../../../../../nls.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { timeout } from "../../../../../base/common/async.js";
import { autorun } from "../../../../../base/common/observable.js";
import { toAction } from "../../../../../base/common/actions.js";
import Severity from "../../../../../base/common/severity.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { TUNNEL_ADDRESS_PREFIX } from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { IRemoteAgentHostLocationPreferenceService } from "../../../../../platform/agentHost/common/remoteAgentHostLocationPreference.js";
import { promptRemoteAgentHostLocationPreference } from "../../../../../platform/agentHost/common/remoteAgentHostLocationPreferenceDialog.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IPreferencesService } from "../../../../../workbench/services/preferences/common/preferences.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { INotificationService, Severity as NotificationSeverity } from "../../../../../platform/notification/common/notification.js";
import { IProgressService, ProgressLocation } from "../../../../../platform/progress/common/progress.js";
async function reconnectRemoteHost(provider, remoteAgentHostService) {
  if (provider.connect) {
    await provider.connect();
  } else if (provider.remoteAddress) {
    remoteAgentHostService.reconnect(provider.remoteAddress);
  }
}
async function removeRemoteHost(provider, remoteAgentHostService) {
  if (provider.disconnect) {
    await provider.disconnect();
  } else if (provider.remoteAddress) {
    await remoteAgentHostService.removeRemoteAgentHost(provider.remoteAddress);
  }
}
function hasUpgradeReconnectStarted(status) {
  return RemoteAgentHostConnectionStatus.isConnecting(status) || RemoteAgentHostConnectionStatus.isConnected(status);
}
async function runServerUpgrade(accessor, provider, upgradeMethod) {
  const address = provider.remoteAddress;
  if (!address) {
    return;
  }
  const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
  const notificationService = accessor.get(INotificationService);
  const progressService = accessor.get(IProgressService);
  await progressService.withProgress(
    {
      location: ProgressLocation.Notification,
      title: localize("workspacePicker.upgradingServer", "Updating {0}...", provider.label)
    },
    async (progress) => {
      try {
        const upgradeResult = await remoteAgentHostService.triggerServerUpgrade(address, upgradeMethod);
        if (upgradeResult.upgradeStarted) {
          const waitMs = (upgradeResult.restartDelayMs ?? 3e3) + 2e3;
          const totalSeconds = Math.max(1, Math.ceil(waitMs / 1e3));
          const watchStore = new DisposableStore();
          let reconnectAlreadyInFlight = false;
          if (provider.connectionStatus) {
            watchStore.add(autorun((reader) => {
              const next = provider.connectionStatus.read(reader);
              if (hasUpgradeReconnectStarted(next)) {
                reconnectAlreadyInFlight = true;
              }
            }));
          }
          try {
            for (let secondsLeft = totalSeconds; secondsLeft > 0; secondsLeft--) {
              if (reconnectAlreadyInFlight) {
                break;
              }
              progress.report({
                message: localize(
                  "workspacePicker.upgradeCountdown",
                  "Restarting in {0}s...",
                  secondsLeft
                )
              });
              await timeout(1e3);
            }
          } finally {
            watchStore.dispose();
          }
          if (!reconnectAlreadyInFlight) {
            progress.report({
              message: localize("workspacePicker.upgradeReconnecting", "Reconnecting...")
            });
            await reconnectRemoteHost(provider, remoteAgentHostService);
          }
        } else if (upgradeResult.upgradeNeeded === false) {
          notificationService.notify({
            severity: NotificationSeverity.Info,
            message: localize("workspacePicker.upgradeNotNeeded", "{0} is already on the latest version.", provider.label)
          });
        } else {
          notificationService.notify({
            severity: NotificationSeverity.Warning,
            message: upgradeResult.error ? localize("workspacePicker.upgradeFailedWithReason", "Failed to update {0}: {1}", provider.label, upgradeResult.error) : localize("workspacePicker.upgradeNotStarted", "{0} did not start an update.", provider.label)
          });
        }
      } catch (err) {
        notificationService.notify({
          severity: NotificationSeverity.Error,
          message: localize("workspacePicker.upgradeFailed", "Failed to update {0}: {1}", provider.label, err instanceof Error ? err.message : String(err))
        });
      }
    }
  );
}
function watchForIncompatibleNotifications(provider, instantiationService, notificationService) {
  if (!provider.connectionStatus) {
    return Disposable.None;
  }
  let lastWasIncompatible = RemoteAgentHostConnectionStatus.isIncompatible(provider.connectionStatus.get());
  return autorun((reader) => {
    const status = provider.connectionStatus.read(reader);
    const isIncompatible = RemoteAgentHostConnectionStatus.isIncompatible(status);
    if (isIncompatible && !lastWasIncompatible) {
      const upgradeMethod = status.vscodeUpgradeMethod;
      const primaryActions = [];
      if (upgradeMethod) {
        primaryActions.push(toAction({
          id: "agentHost.upgradeFromIncompatible",
          label: localize("agentHostIncompatibleUpdate", "Update Server"),
          run: () => instantiationService.invokeFunction((accessor) => runServerUpgrade(accessor, provider, upgradeMethod))
        }));
      }
      primaryActions.push(toAction({
        id: "agentHost.showRemoteHostOptions",
        label: localize("agentHostIncompatibleShowOptions", "Show Options"),
        run: () => instantiationService.invokeFunction((accessor) => showRemoteHostOptions(accessor, provider))
      }));
      notificationService.notify({
        severity: NotificationSeverity.Warning,
        message: localize(
          "agentHostIncompatibleNotification",
          "Cannot connect to {0}: {1}",
          provider.label,
          status.message
        ),
        actions: { primary: primaryActions }
      });
    }
    lastWasIncompatible = isIncompatible;
  });
}
function getStatusLabel(status) {
  switch (status.kind) {
    case "connected":
      return localize("workspacePicker.statusOnline", "Online");
    case "connecting":
      return localize("workspacePicker.statusConnecting", "Connecting");
    case "disconnected":
      return localize("workspacePicker.statusOffline", "Offline");
    case "incompatible":
      return localize("workspacePicker.statusIncompatible", "Incompatible");
  }
}
function getStatusHover(status, address) {
  switch (status.kind) {
    case "connected":
      return address ? localize("workspacePicker.hoverConnectedAddr", "Remote agent host is connected and ready.\n\nAddress: {0}", address) : localize("workspacePicker.hoverConnected", "Remote agent host is connected and ready.");
    case "connecting":
      return address ? localize("workspacePicker.hoverConnectingAddr", "Attempting to connect to remote agent host...\n\nAddress: {0}", address) : localize("workspacePicker.hoverConnecting", "Attempting to connect to remote agent host...");
    case "disconnected":
      return address ? localize("workspacePicker.hoverDisconnectedAddr", "Remote agent host is disconnected.\n\nAddress: {0}", address) : localize("workspacePicker.hoverDisconnected", "Remote agent host is disconnected.");
    case "incompatible": {
      const offered = status.supportedByClient.join(", ");
      return address ? localize("workspacePicker.hoverIncompatibleAddr", "Cannot connect to remote agent host: {0}\n\nThis client speaks protocol version {1}.\n\nAddress: {2}", status.message, offered, address) : localize("workspacePicker.hoverIncompatible", "Cannot connect to remote agent host: {0}\n\nThis client speaks protocol version {1}.", status.message, offered);
    }
  }
}
const SSH_ADDRESS_PREFIX = "ssh:";
function supportsRemoteAgentHostLocationPreference(preferenceKey, isWebPlatform = isWeb) {
  if (isWebPlatform) {
    return false;
  }
  return preferenceKey.startsWith(SSH_ADDRESS_PREFIX) || preferenceKey.startsWith(TUNNEL_ADDRESS_PREFIX);
}
function buildRemoteHostOptionItems(options) {
  const items = [];
  if (options.upgradeMethod) {
    items.push({ label: "$(cloud-download) " + localize("workspacePicker.updateServer", "Update Server"), id: "upgrade" });
  }
  if (!options.isConnected) {
    items.push({ label: "$(debug-restart) " + localize("workspacePicker.reconnect", "Reconnect"), id: "reconnect" });
  }
  items.push(
    { label: "$(trash) " + localize("workspacePicker.removeRemote", "Remove Remote"), id: "remove" },
    { label: "$(copy) " + localize("workspacePicker.copyAddress", "Copy Address"), id: "copy" },
    { label: "$(settings-gear) " + localize("workspacePicker.openSettings", "Open Settings"), id: "settings" }
  );
  if (supportsRemoteAgentHostLocationPreference(options.preferenceKey ?? options.address, options.isWebPlatform ?? isWeb)) {
    items.push({ label: "$(server-process) " + localize("workspacePicker.changeLocationPreference", "Change Preferred Agent Location"), id: "locationPreference" });
  }
  return items;
}
async function changeRemoteAgentHostLocationPreference(options) {
  const currentPreference = options.locationPreferenceService.getPreference(options.preferenceKey);
  const preference = await promptRemoteAgentHostLocationPreference(options.dialogService, options.hostLabel, options.productName, currentPreference);
  if (!preference) {
    return;
  }
  options.locationPreferenceService.setPreference(options.preferenceKey, preference);
  const provider = options.provider;
  if (!provider) {
    options.notificationService.warn(localize("workspacePicker.locationPreferenceSavedNoProvider", "Preference saved for {0}, but no active connection was found. This takes effect the next time it connects.", options.hostLabel));
    return;
  }
  await options.progressService.withProgress(
    {
      location: ProgressLocation.Notification,
      title: localize("workspacePicker.locationPreferenceReconnecting", "Reconnecting to {0}...", options.hostLabel)
    },
    async () => {
      try {
        await reconnectRemoteHost(provider, options.remoteAgentHostService);
        options.notificationService.info(localize("workspacePicker.locationPreferenceUpdated", "Preference updated for {0}.", options.hostLabel));
      } catch (err) {
        options.notificationService.error(localize("workspacePicker.locationPreferenceReconnectFailed", "Preference saved for {0}, but reconnection failed: {1}", options.hostLabel, err instanceof Error ? err.message : String(err)));
      }
    }
  );
}
async function showRemoteHostOptions(accessor, provider, options = {}) {
  const address = provider.remoteAddress;
  if (!address) {
    return void 0;
  }
  const quickInputService = accessor.get(IQuickInputService);
  const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
  const clipboardService = accessor.get(IClipboardService);
  const preferencesService = accessor.get(IPreferencesService);
  const productService = accessor.get(IProductService);
  const instantiationService = accessor.get(IInstantiationService);
  const dialogService = accessor.get(IDialogService);
  const notificationService = accessor.get(INotificationService);
  const progressService = accessor.get(IProgressService);
  const locationPreferenceService = isWeb ? void 0 : accessor.get(IRemoteAgentHostLocationPreferenceService);
  const status = provider.connectionStatus?.get();
  const isConnected = RemoteAgentHostConnectionStatus.isConnected(status);
  const upgradeMethod = RemoteAgentHostConnectionStatus.isIncompatible(status) ? status.vscodeUpgradeMethod : void 0;
  const preferenceKey = provider.remoteLocationPreferenceKey ?? address;
  const items = buildRemoteHostOptionItems({ address, preferenceKey, isConnected, upgradeMethod });
  const result = await new Promise((resolve) => {
    const store = new DisposableStore();
    const picker = store.add(quickInputService.createQuickPick());
    picker.placeholder = localize("workspacePicker.remoteOptionsTitle", "Options for {0}", provider.label);
    picker.items = items;
    if (RemoteAgentHostConnectionStatus.isIncompatible(status)) {
      const offered = status.supportedByClient.join(", ");
      const served = status.offeredByServer?.length ? status.offeredByServer.join(", ") : void 0;
      picker.severity = Severity.Warning;
      picker.validationMessage = served ? localize("workspacePicker.incompatibleValidationServer", "Incompatible protocol version. We speak {0}, but {1} speaks {2}. Ensure {3} and {1} are both up to date.", offered, provider.label, served, productService.nameShort) : localize("workspacePicker.incompatibleValidationClient", "Incompatible protocol version. We speak {0}. Error from {1}: {2}\n\n Ensure {3} and {1} are both up to date.", offered, provider.label, status.message, productService.nameShort);
    }
    if (options.showBackButton) {
      picker.buttons = [quickInputService.backButton];
    }
    store.add(picker.onDidTriggerButton((button) => {
      if (button === quickInputService.backButton) {
        resolve("back");
        picker.hide();
      }
    }));
    store.add(picker.onDidAccept(() => {
      resolve(picker.selectedItems[0]);
      picker.hide();
    }));
    store.add(picker.onDidHide(() => {
      resolve(void 0);
      store.dispose();
    }));
    picker.show();
  });
  if (result === "back") {
    return "back";
  }
  if (!result) {
    return void 0;
  }
  switch (result.id) {
    case "upgrade":
      if (upgradeMethod) {
        await instantiationService.invokeFunction(runServerUpgrade, provider, upgradeMethod);
      }
      break;
    case "reconnect":
      await reconnectRemoteHost(provider, remoteAgentHostService);
      break;
    case "remove":
      await removeRemoteHost(provider, remoteAgentHostService);
      break;
    case "copy":
      await clipboardService.writeText(address);
      break;
    case "settings":
      await preferencesService.openSettings({ query: "chat.remoteAgentHosts" });
      break;
    case "locationPreference":
      if (locationPreferenceService) {
        await changeRemoteAgentHostLocationPreference({
          preferenceKey,
          hostLabel: provider.label,
          productName: productService.nameShort,
          provider,
          dialogService,
          locationPreferenceService,
          notificationService,
          remoteAgentHostService,
          progressService
        });
      }
      break;
  }
  return void 0;
}
export {
  buildRemoteHostOptionItems,
  changeRemoteAgentHostLocationPreference,
  getStatusHover,
  getStatusLabel,
  hasUpgradeReconnectStarted,
  reconnectRemoteHost,
  removeRemoteHost,
  runServerUpgrade,
  showRemoteHostOptions,
  supportsRemoteAgentHostLocationPreference,
  watchForIncompatibleNotifications
};
