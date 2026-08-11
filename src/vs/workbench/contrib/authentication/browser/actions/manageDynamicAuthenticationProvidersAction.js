import { localize, localize2 } from "../../../../../nls.js";
import { Action2 } from "../../../../../platform/actions/common/actions.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IDynamicAuthenticationProviderStorageService } from "../../../../services/authentication/common/dynamicAuthenticationProviderStorage.js";
import { IAuthenticationService } from "../../../../services/authentication/common/authentication.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
class RemoveDynamicAuthenticationProvidersAction extends Action2 {
  static {
    this.ID = "workbench.action.removeDynamicAuthenticationProviders";
  }
  constructor() {
    super({
      id: RemoveDynamicAuthenticationProvidersAction.ID,
      title: localize2("removeDynamicAuthProviders", "Remove Dynamic Authentication Providers"),
      category: localize2("authenticationCategory", "Authentication"),
      f1: true
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const dynamicAuthStorageService = accessor.get(IDynamicAuthenticationProviderStorageService);
    const authenticationService = accessor.get(IAuthenticationService);
    const dialogService = accessor.get(IDialogService);
    const interactedProviders = dynamicAuthStorageService.getInteractedProviders();
    if (interactedProviders.length === 0) {
      await dialogService.info(
        localize("noDynamicProviders", "No dynamic authentication providers"),
        localize("noDynamicProvidersDetail", "No dynamic authentication providers have been used yet.")
      );
      return;
    }
    const items = interactedProviders.map((provider) => ({
      label: provider.label,
      description: localize("clientId", "Client ID: {0}", provider.clientId),
      provider
    }));
    const selected = await quickInputService.pick(items, {
      placeHolder: localize("selectProviderToRemove", "Select a dynamic authentication provider to remove"),
      canPickMany: true
    });
    if (!selected || selected.length === 0) {
      return;
    }
    const providerNames = selected.map((item) => item.provider.label).join(", ");
    const message = selected.length === 1 ? localize("confirmDeleteSingleProvider", 'Are you sure you want to remove the dynamic authentication provider "{0}"?', providerNames) : localize("confirmDeleteMultipleProviders", "Are you sure you want to remove {0} dynamic authentication providers: {1}?", selected.length, providerNames);
    const result = await dialogService.confirm({
      message,
      detail: localize("confirmDeleteDetail", "This will remove all stored authentication data for the selected provider(s). You will need to re-authenticate if you use these providers again."),
      primaryButton: localize("remove", "Remove"),
      type: "warning"
    });
    if (!result.confirmed) {
      return;
    }
    for (const item of selected) {
      const providerId = item.provider.providerId;
      if (authenticationService.isAuthenticationProviderRegistered(providerId)) {
        authenticationService.unregisterAuthenticationProvider(providerId);
      }
      await dynamicAuthStorageService.removeDynamicProvider(providerId);
    }
  }
}
export {
  RemoveDynamicAuthenticationProvidersAction
};
