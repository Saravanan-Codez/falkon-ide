var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IAuthenticationService } from "../../../../services/authentication/common/authentication.js";
import { IAuthenticationQueryService } from "../../../../services/authentication/common/authenticationQuery.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
class ManageAccountPreferencesForExtensionAction extends Action2 {
  constructor() {
    super({
      id: "_manageAccountPreferencesForExtension",
      title: localize2("manageAccountPreferenceForExtension", "Manage Extension Account Preferences..."),
      category: localize2("accounts", "Accounts"),
      f1: true,
      menu: [{
        id: MenuId.AccountsContext,
        order: 100
      }]
    });
  }
  run(accessor, extensionId, providerId) {
    return accessor.get(IInstantiationService).createInstance(ManageAccountPreferenceForExtensionActionImpl).run(extensionId, providerId);
  }
}
let ManageAccountPreferenceForExtensionActionImpl = class {
  constructor(_authenticationService, _quickInputService, _dialogService, _authenticationQueryService, _extensionService, _logService) {
    this._authenticationService = _authenticationService;
    this._quickInputService = _quickInputService;
    this._dialogService = _dialogService;
    this._authenticationQueryService = _authenticationQueryService;
    this._extensionService = _extensionService;
    this._logService = _logService;
  }
  async run(extensionId, providerId) {
    if (!extensionId) {
      const extensions = this._extensionService.extensions.filter((ext) => this._authenticationQueryService.extension(ext.identifier.value).getAllAccountPreferences().size > 0).sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
      const result = await this._quickInputService.pick(extensions.map((ext) => ({
        label: ext.displayName ?? ext.name,
        id: ext.identifier.value
      })), {
        placeHolder: localize("selectExtension", "Select an extension to manage account preferences for"),
        title: localize("pickAProviderTitle", "Manage Extension Account Preferences")
      });
      extensionId = result?.id;
    }
    if (!extensionId) {
      return;
    }
    const extension = await this._extensionService.getExtension(extensionId);
    if (!extension) {
      throw new Error(`No extension with id ${extensionId}`);
    }
    if (!providerId) {
      const extensionQuery = this._authenticationQueryService.extension(extensionId);
      const providersWithAccess = await extensionQuery.getProvidersWithAccess();
      if (!providersWithAccess.length) {
        await this._dialogService.info(localize("noAccountUsage", "This extension has not used any accounts yet."));
        return;
      }
      providerId = providersWithAccess[0];
      if (providersWithAccess.length > 1) {
        const result = await this._quickInputService.pick(
          providersWithAccess.map((providerId2) => ({
            label: this._authenticationService.getProvider(providerId2).label,
            id: providerId2
          })),
          {
            placeHolder: localize("selectProvider", "Select an authentication provider to manage account preferences for"),
            title: localize("pickAProviderTitle", "Manage Extension Account Preferences")
          }
        );
        if (!result) {
          return;
        }
        providerId = result.id;
      }
    }
    const accounts = await this._authenticationService.getAccounts(providerId);
    const currentAccountNamePreference = this._authenticationQueryService.provider(providerId).extension(extensionId).getPreferredAccount();
    const items = this._getItems(accounts, providerId, currentAccountNamePreference);
    const provider = this._authenticationService.getProvider(providerId);
    if (provider.supportsMultipleAccounts) {
      const lastUsedScopes = accounts.flatMap((account) => this._authenticationQueryService.provider(providerId).account(account.label).extension(extensionId).getUsage()).sort((a, b) => b.lastUsed - a.lastUsed)[0]?.scopes;
      if (lastUsedScopes) {
        items.push({ type: "separator" });
        items.push({
          providerId,
          scopes: lastUsedScopes,
          label: localize("use new account", "Use a new account...")
        });
      }
    }
    const disposables = new DisposableStore();
    const picker = this._createQuickPick(disposables, extensionId, extension.displayName ?? extension.name, provider.label);
    if (items.length === 0) {
      disposables.add(this._handleNoAccounts(picker));
      return;
    }
    picker.items = items;
    picker.show();
  }
  _createQuickPick(disposableStore, extensionId, extensionLabel, providerLabel) {
    const picker = disposableStore.add(this._quickInputService.createQuickPick({ useSeparators: true }));
    disposableStore.add(picker.onDidHide(() => {
      disposableStore.dispose();
    }));
    picker.placeholder = localize("placeholder v2", "Manage '{0}' account preferences for {1}...", extensionLabel, providerLabel);
    picker.title = localize("title", "'{0}' Account Preferences For This Workspace", extensionLabel);
    picker.sortByLabel = false;
    disposableStore.add(picker.onDidAccept(async () => {
      picker.hide();
      await this._accept(extensionId, picker.selectedItems);
    }));
    return picker;
  }
  _getItems(accounts, providerId, currentAccountNamePreference) {
    return accounts.map(
      (a) => currentAccountNamePreference === a.label ? {
        label: a.label,
        account: a,
        providerId,
        description: localize("currentAccount", "Current account"),
        picked: true
      } : {
        label: a.label,
        account: a,
        providerId
      }
    );
  }
  _handleNoAccounts(picker) {
    picker.validationMessage = localize("noAccounts", "No accounts are currently used by this extension.");
    picker.buttons = [this._quickInputService.backButton];
    picker.show();
    return Event.filter(picker.onDidTriggerButton, (e) => e === this._quickInputService.backButton)(() => this.run());
  }
  async _accept(extensionId, selectedItems) {
    for (const item of selectedItems) {
      let account;
      if (!item.account) {
        try {
          const session = await this._authenticationService.createSession(item.providerId, [...item.scopes]);
          account = session.account;
        } catch (e) {
          this._logService.error(e);
          continue;
        }
      } else {
        account = item.account;
      }
      const providerId = item.providerId;
      const extensionQuery = this._authenticationQueryService.provider(providerId).extension(extensionId);
      const currentAccountName = extensionQuery.getPreferredAccount();
      if (currentAccountName === account.label) {
        continue;
      }
      extensionQuery.setPreferredAccount(account);
    }
  }
};
ManageAccountPreferenceForExtensionActionImpl = __decorateClass([
  __decorateParam(0, IAuthenticationService),
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IAuthenticationQueryService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, ILogService)
], ManageAccountPreferenceForExtensionActionImpl);
export {
  ManageAccountPreferencesForExtensionAction
};
