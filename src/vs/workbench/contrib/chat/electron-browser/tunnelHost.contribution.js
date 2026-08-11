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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ConfigurationScope, Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { CONFIGURATION_KEY_HOST_NAME, MAX_TUNNEL_NAME_LENGTH } from "../../../../platform/remoteTunnel/common/remoteTunnel.js";
import { IsSessionsWindowContext, RemoteNameContext } from "../../../common/contextkeys.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../common/actions/chatContextKeys.js";
import { ITunnelHostService } from "../common/tunnelHost.js";
import { CONFIGURATION_KEY_MICROSOFT_AUTH, RENAME_TUNNEL_ID, SHOW_TUNNEL_HOST_OUTPUT_ID, TunnelHostService } from "./tunnelHostService.js";
import { TUNNEL_HOST_LOG_ID } from "../../../../platform/agentHost/common/tunnelAgentHost.js";
import { ToggleRemoteConnectionsActionViewItem } from "./toggleRemoteConnectionsActionViewItem.js";
const TUNNEL_HOST_SHARING_KEY = "tunnelHostSharing";
const TUNNEL_HOST_SHARING_CONTEXT = new RawContextKey(TUNNEL_HOST_SHARING_KEY, false);
const TOGGLE_SHARING_ID = "sessions.tunnelHost.toggleSharing";
const CATEGORY = localize2("tunnelHost.category", "Remote Connections");
const TUNNEL_NAME_REGEX = /^[\w-]+$/;
registerSingleton(ITunnelHostService, TunnelHostService, InstantiationType.Delayed);
let TunnelHostContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.tunnelHost";
  }
  constructor(contextKeyService, tunnelHostService, actionViewItemService) {
    super();
    this._sharingContext = TUNNEL_HOST_SHARING_CONTEXT.bindTo(contextKeyService);
    this._sharingContext.set(tunnelHostService.isSharing);
    this._register(tunnelHostService.onDidChangeStatus(() => {
      this._sharingContext.set(tunnelHostService.isSharing);
    }));
    const viewItemFactory = (action, _options, instantiationService) => {
      return instantiationService.createInstance(ToggleRemoteConnectionsActionViewItem, action);
    };
    this._register(actionViewItemService.register(MenuId.ChatInputSecondary, TOGGLE_SHARING_ID, viewItemFactory, tunnelHostService.onDidChangeStatus));
  }
};
TunnelHostContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ITunnelHostService),
  __decorateParam(2, IActionViewItemService)
], TunnelHostContribution);
registerAction2(class ToggleRemoteConnectionsAction extends Action2 {
  constructor() {
    super({
      id: TOGGLE_SHARING_ID,
      title: localize2("toggleSharing", "Allow Remote Connections"),
      category: CATEGORY,
      icon: Codicon.radioTower,
      toggled: ContextKeyExpr.equals(TUNNEL_HOST_SHARING_KEY, true),
      menu: {
        id: MenuId.ChatInputSecondary,
        order: 10,
        group: "navigation",
        when: ContextKeyExpr.and(
          ChatContextKeys.enabled,
          IsSessionsWindowContext.toNegated(),
          RemoteNameContext.isEqualTo(""),
          ChatContextKeyExprs.isAgentHostSession
        )
      }
    });
  }
  async run(accessor) {
    const tunnelHostService = accessor.get(ITunnelHostService);
    const notificationService = accessor.get(INotificationService);
    try {
      if (tunnelHostService.isSharing) {
        await tunnelHostService.stopSharing();
      } else {
        await tunnelHostService.startSharing();
      }
    } catch (err) {
      notificationService.notify({
        severity: Severity.Error,
        message: localize("tunnelHost.error", "Failed to toggle remote connections: {0}", String(err))
      });
    }
  }
});
registerAction2(class ShowTunnelHostOutputAction extends Action2 {
  constructor() {
    super({
      id: SHOW_TUNNEL_HOST_OUTPUT_ID,
      title: localize2("showTunnelHostOutput", "Show Remote Connections Output"),
      category: CATEGORY
    });
  }
  async run(accessor) {
    const outputService = accessor.get(IOutputService);
    await outputService.showChannel(TUNNEL_HOST_LOG_ID);
  }
});
registerAction2(class RenameTunnelAction extends Action2 {
  constructor() {
    super({
      id: RENAME_TUNNEL_ID,
      title: localize2("renameTunnel", "Rename Tunnel"),
      category: CATEGORY
    });
  }
  async run(accessor) {
    const tunnelHostService = accessor.get(ITunnelHostService);
    const configurationService = accessor.get(IConfigurationService);
    const quickInputService = accessor.get(IQuickInputService);
    const notificationService = accessor.get(INotificationService);
    const currentName = tunnelHostService.sharingInfo?.tunnelName ?? configurationService.getValue(CONFIGURATION_KEY_HOST_NAME);
    const name = await quickInputService.input({
      title: localize("renameTunnel.title", "Rename Tunnel"),
      prompt: localize("renameTunnel.prompt", "Enter a name for this tunnel."),
      value: currentName,
      placeHolder: localize("renameTunnel.placeholder", "Leave blank to use this machine's host name."),
      validateInput: async (input) => {
        if (input.length === 0) {
          return void 0;
        }
        if (input.length > MAX_TUNNEL_NAME_LENGTH) {
          return localize("renameTunnel.maxLength", "The name must not be longer than {0} characters.", MAX_TUNNEL_NAME_LENGTH);
        }
        if (!TUNNEL_NAME_REGEX.test(input) || input.startsWith("-")) {
          return localize("renameTunnel.invalidName", "The name must only consist of letters, numbers, underscore and dash. It must not start with a dash.");
        }
        return void 0;
      }
    });
    if (name === void 0) {
      return;
    }
    await configurationService.updateValue(CONFIGURATION_KEY_HOST_NAME, name || void 0, ConfigurationTarget.USER);
    if (!tunnelHostService.isSharing) {
      return;
    }
    try {
      await tunnelHostService.stopSharing();
      await tunnelHostService.startSharing();
    } catch (err) {
      notificationService.error(localize("renameTunnel.error", "Failed to rename tunnel: {0}", String(err)));
    }
  }
});
registerWorkbenchContribution2(TunnelHostContribution.ID, TunnelHostContribution, WorkbenchPhase.AfterRestored);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  type: "object",
  properties: {
    [CONFIGURATION_KEY_MICROSOFT_AUTH]: {
      description: localize("tunnelHost.enableMicrosoftAuth", "Enable Microsoft account authentication for agent host tunnels. When disabled, only GitHub authentication is used."),
      type: "boolean",
      scope: ConfigurationScope.APPLICATION,
      default: false,
      tags: ["usesOnlineServices"]
    }
  }
});
export {
  TOGGLE_SHARING_ID,
  TUNNEL_HOST_SHARING_CONTEXT,
  TUNNEL_HOST_SHARING_KEY
};
