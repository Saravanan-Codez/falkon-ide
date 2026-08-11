import { Codicon } from "../../../../../base/common/codicons.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { autorun } from "../../../../../base/common/observable.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, IMenuService, MenuItemAction, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IRemoteAgentHostService, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { TUNNEL_ADDRESS_PREFIX } from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { Menus } from "../../../../browser/menus.js";
import { SessionsCategories } from "../../../../common/categories.js";
import { isAgentHostProvider } from "../../../../common/agentHostSessionsProvider.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { getStatusLabel, removeRemoteHost, showRemoteHostOptions } from "./remoteHostOptions.js";
import { RemoteAgentHostCommandIds } from "./remoteAgentHostActions.js";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.manageRemoteAgentHosts,
      title: localize2("manageRemoteAgentHosts", "Manage Remote Agent Hosts..."),
      category: SessionsCategories.Sessions,
      f1: true,
      precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true)
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const sessionsProvidersService = accessor.get(ISessionsProvidersService);
    const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
    const menuService = accessor.get(IMenuService);
    const contextKeyService = accessor.get(IContextKeyService);
    const commandService = accessor.get(ICommandService);
    const instantiationService = accessor.get(IInstantiationService);
    const removeButton = {
      iconClass: ThemeIcon.asClassName(Codicon.close),
      tooltip: localize("manageHosts.removeTooltip", "Remove")
    };
    const buildItems = () => {
      const remoteProviders = sessionsProvidersService.getProviders().filter(isAgentHostProvider).filter((p) => !!p.remoteAddress);
      const remoteItems = remoteProviders.map((p) => {
        const isTunnel = p.remoteAddress?.startsWith(TUNNEL_ADDRESS_PREFIX);
        const status = p.connectionStatus?.get();
        const item = {
          kind: "remote",
          provider: p,
          label: `$(${isTunnel ? "cloud" : "remote"}) ${p.label}`,
          description: status !== void 0 ? getStatusLabel(status) : void 0,
          detail: p.remoteAddress
        };
        item.buttons = [removeButton];
        return item;
      });
      const menuActionItems = [];
      const menuActions = menuService.getMenuActions(Menus.SessionWorkspaceManage, contextKeyService, { renderShortTitle: true });
      for (const [, actions] of menuActions) {
        for (const action of actions) {
          if (action instanceof MenuItemAction) {
            const icon = ThemeIcon.isThemeIcon(action.item.icon) ? action.item.icon : void 0;
            menuActionItems.push({
              kind: "menu-action",
              action,
              label: icon ? `$(${icon.id}) ${action.label}` : action.label,
              description: action.tooltip || void 0
            });
          }
        }
      }
      const items = [];
      if (remoteItems.length > 0) {
        items.push({ type: "separator", label: localize("manageHosts.remoteHostsHeader", "Remote Agent Hosts") });
        items.push(...remoteItems);
      }
      if (menuActionItems.length > 0) {
        items.push({ type: "separator", label: localize("manageHosts.actionsHeader", "Add or Manage") });
        items.push(...menuActionItems);
      }
      return items;
    };
    const showManagePicker = () => {
      const store = new DisposableStore();
      const picker = quickInputService.createQuickPick({ useSeparators: true });
      store.add(picker);
      picker.title = localize("manageHosts.title", "Manage Remote Agent Hosts");
      picker.placeholder = localize("manageHosts.placeholder", "Select a remote to manage or pick an action");
      picker.matchOnDescription = true;
      picker.matchOnDetail = true;
      let lastFilter = "";
      const refresh = () => {
        lastFilter = picker.value;
        picker.items = buildItems();
        picker.value = lastFilter;
      };
      refresh();
      store.add(sessionsProvidersService.onDidChangeProviders(() => refresh()));
      const observerStore = store.add(new DisposableStore());
      const subscribeToProviders = () => {
        observerStore.clear();
        for (const p of sessionsProvidersService.getProviders()) {
          if (isAgentHostProvider(p) && p.connectionStatus) {
            observerStore.add(autorun((reader) => {
              p.connectionStatus.read(reader);
              refresh();
            }));
          }
        }
      };
      subscribeToProviders();
      store.add(sessionsProvidersService.onDidChangeProviders(() => subscribeToProviders()));
      store.add(picker.onDidTriggerItemButton(async (e) => {
        if (e.item.kind === "remote" && e.button === removeButton) {
          await removeRemoteHost(e.item.provider, remoteAgentHostService);
        }
      }));
      store.add(picker.onDidAccept(() => {
        const selected = picker.selectedItems[0];
        picker.hide();
        if (!selected) {
          return;
        }
        if (selected.kind === "remote") {
          void instantiationService.invokeFunction((a) => showRemoteHostOptions(a, selected.provider, { showBackButton: true })).then((result) => {
            if (result === "back") {
              showManagePicker();
            }
          });
        } else if (selected.kind === "menu-action") {
          commandService.executeCommand(selected.action.id, () => showManagePicker());
        }
      }));
      store.add(picker.onDidHide(() => store.dispose()));
      picker.show();
    };
    showManagePicker();
  }
});
