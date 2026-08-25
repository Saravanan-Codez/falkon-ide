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
import { Codicon } from "../../../../../base/common/codicons.js";
import { fromNow } from "../../../../../base/common/date.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IAuthenticationService } from "../../../../services/authentication/common/authentication.js";
import { IAuthenticationQueryService } from "../../../../services/authentication/common/authenticationQuery.js";
import { ChatContextKeys } from "../../../chat/common/actions/chatContextKeys.js";
import { IMcpService } from "../../../mcp/common/mcpTypes.js";
class ManageTrustedMcpServersForAccountAction extends Action2 {
  constructor() {
    super({
      id: "_manageTrustedMCPServersForAccount",
      title: localize2("manageTrustedMcpServersForAccount", "Manage Trusted MCP Servers For Account"),
      category: localize2("accounts", "Accounts"),
      f1: true,
      precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate())
    });
  }
  run(accessor, options) {
    const instantiationService = accessor.get(IInstantiationService);
    return instantiationService.createInstance(ManageTrustedMcpServersForAccountActionImpl).run(options);
  }
}
let ManageTrustedMcpServersForAccountActionImpl = class {
  constructor(_mcpServerService, _dialogService, _quickInputService, _mcpServerAuthenticationService, _authenticationQueryService, _commandService) {
    this._mcpServerService = _mcpServerService;
    this._dialogService = _dialogService;
    this._quickInputService = _quickInputService;
    this._mcpServerAuthenticationService = _mcpServerAuthenticationService;
    this._authenticationQueryService = _authenticationQueryService;
    this._commandService = _commandService;
  }
  async run(options) {
    const accountQuery = await this._resolveAccountQuery(options?.providerId, options?.accountLabel);
    if (!accountQuery) {
      return;
    }
    const items = await this._getItems(accountQuery);
    if (!items.length) {
      return;
    }
    const picker = this._createQuickPick(accountQuery);
    picker.items = items;
    picker.selectedItems = items.filter((i) => i.type !== "separator" && !!i.picked);
    picker.show();
  }
  //#region Account Query Resolution
  async _resolveAccountQuery(providerId, accountLabel) {
    if (providerId && accountLabel) {
      return this._authenticationQueryService.provider(providerId).account(accountLabel);
    }
    const accounts = await this._getAllAvailableAccounts();
    const pick = await this._quickInputService.pick(accounts, {
      placeHolder: localize("pickAccount", "Pick an account to manage trusted MCP servers for"),
      matchOnDescription: true
    });
    return pick ? this._authenticationQueryService.provider(pick.providerId).account(pick.label) : void 0;
  }
  async _getAllAvailableAccounts() {
    const accounts = [];
    for (const providerId of this._mcpServerAuthenticationService.getProviderIds()) {
      const provider = this._mcpServerAuthenticationService.getProvider(providerId);
      const sessions = await this._mcpServerAuthenticationService.getSessions(providerId);
      const uniqueLabels = /* @__PURE__ */ new Set();
      for (const session of sessions) {
        if (!uniqueLabels.has(session.account.label)) {
          uniqueLabels.add(session.account.label);
          accounts.push({
            providerId,
            label: session.account.label,
            description: provider.label
          });
        }
      }
    }
    return accounts;
  }
  //#endregion
  //#region Item Retrieval and Quick Pick Creation
  async _getItems(accountQuery) {
    const allowedMcpServers = accountQuery.mcpServers().getAllowedMcpServers();
    const serverIdToLabel = new Map(this._mcpServerService.servers.get().map((s) => [s.definition.id, s.definition.label]));
    const withLastUsed = (server) => {
      const usage = accountQuery.mcpServer(server.id).getUsage();
      return { ...server, lastUsed: usage.length > 0 ? Math.max(...usage.map((u) => u.lastUsed)) : server.lastUsed };
    };
    const agentHostServers = allowedMcpServers.filter((server) => !!server.agentHost).map(withLastUsed);
    const workbenchServers = allowedMcpServers.filter((server) => !server.agentHost && serverIdToLabel.has(server.id)).map((server) => withLastUsed({ ...server, name: serverIdToLabel.get(server.id) }));
    if (!agentHostServers.length && !workbenchServers.length) {
      this._dialogService.info(localize("noTrustedMcpServers", "This account has not been used by any MCP servers."));
      return [];
    }
    const trustedServers = workbenchServers.filter((s) => s.trusted);
    const otherServers = workbenchServers.filter((s) => !s.trusted);
    const sortByLastUsed = (a, b) => (b.lastUsed || 0) - (a.lastUsed || 0);
    const items = [
      ...otherServers.sort(sortByLastUsed).map(this._toQuickPickItem)
    ];
    const byAuthority = /* @__PURE__ */ new Map();
    for (const server of agentHostServers) {
      const group = byAuthority.get(server.agentHost.authority) ?? { label: server.agentHost.label, servers: [] };
      group.servers.push(server);
      byAuthority.set(server.agentHost.authority, group);
    }
    const sortedGroups = [...byAuthority.values()].sort((a, b) => a.label.localeCompare(b.label));
    for (const { label, servers } of sortedGroups) {
      items.push({ type: "separator", label: localize({ key: "agentHostMcpServers", comment: ["The placeholder {0} is the name of an agent host, e.g. a remote machine or the local machine"] }, "MCP Servers in {0}", label) });
      items.push(...servers.sort(sortByLastUsed).map(this._toQuickPickItem));
    }
    items.push({ type: "separator", label: localize("trustedMcpServers", "Trusted by Microsoft") });
    items.push(...trustedServers.sort(sortByLastUsed).map(this._toQuickPickItem));
    return items;
  }
  _toQuickPickItem(mcpServer) {
    const lastUsed = mcpServer.lastUsed;
    const description = lastUsed ? localize({ key: "accountLastUsedDate", comment: ['The placeholder {0} is a string with time information, such as "3 days ago"'] }, "Last used this account {0}", fromNow(lastUsed, true)) : localize("notUsed", "Has not used this account");
    let tooltip;
    let disabled;
    if (mcpServer.trusted) {
      tooltip = localize("trustedMcpServerTooltip", "This MCP server is trusted by Microsoft and\nalways has access to this account");
      disabled = true;
    }
    return {
      label: mcpServer.name,
      mcpServer,
      description,
      tooltip,
      disabled,
      buttons: [{
        tooltip: localize("accountPreferences", "Manage account preferences for this MCP server"),
        iconClass: ThemeIcon.asClassName(Codicon.settingsGear)
      }],
      picked: mcpServer.allowed === void 0 || mcpServer.allowed
    };
  }
  _createQuickPick(accountQuery) {
    const disposableStore = new DisposableStore();
    const quickPick = disposableStore.add(this._quickInputService.createQuickPick({ useSeparators: true }));
    quickPick.canSelectMany = true;
    quickPick.customButton = true;
    quickPick.customLabel = localize("manageTrustedMcpServers.cancel", "Cancel");
    quickPick.customButtonSecondary = true;
    quickPick.title = localize("manageTrustedMcpServers", "Manage Trusted MCP Servers");
    quickPick.placeholder = localize("manageMcpServers", "Choose which MCP servers can access this account");
    disposableStore.add(quickPick.onDidAccept(() => {
      quickPick.hide();
      const allServers = quickPick.items.filter((item) => item.type !== "separator").map((i) => i.mcpServer);
      const selectedServers = new Set(quickPick.selectedItems.map((i) => i.mcpServer));
      for (const mcpServer of allServers) {
        const isAllowed = selectedServers.has(mcpServer);
        accountQuery.mcpServer(mcpServer.id).setAccessAllowed(isAllowed, mcpServer.name);
      }
    }));
    disposableStore.add(quickPick.onDidHide(() => disposableStore.dispose()));
    disposableStore.add(quickPick.onDidCustom(() => quickPick.hide()));
    disposableStore.add(quickPick.onDidTriggerItemButton(
      (e) => this._commandService.executeCommand("_manageAccountPreferencesForMcpServer", e.item.mcpServer.id, accountQuery.providerId)
    ));
    return quickPick;
  }
  //#endregion
};
ManageTrustedMcpServersForAccountActionImpl = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IDialogService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IAuthenticationService),
  __decorateParam(4, IAuthenticationQueryService),
  __decorateParam(5, ICommandService)
], ManageTrustedMcpServersForAccountActionImpl);
export {
  ManageTrustedMcpServersForAccountAction
};
