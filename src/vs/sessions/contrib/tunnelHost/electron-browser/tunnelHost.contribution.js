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
import { localize } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IsAuxiliaryWindowContext, IsSessionsWindowContext } from "../../../../workbench/common/contextkeys.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { ITunnelHostService } from "../../../../workbench/contrib/chat/common/tunnelHost.js";
import { ToggleRemoteConnectionsActionViewItem } from "../../../../workbench/contrib/chat/electron-browser/toggleRemoteConnectionsActionViewItem.js";
import { TOGGLE_SHARING_ID, TUNNEL_HOST_SHARING_KEY } from "../../../../workbench/contrib/chat/electron-browser/tunnelHost.contribution.js";
import { Menus } from "../../../browser/menus.js";
MenuRegistry.appendMenuItem(Menus.TitleBarRightLayout, {
  command: {
    id: TOGGLE_SHARING_ID,
    title: localize("toggleSharing", "Allow Remote Connections"),
    icon: Codicon.radioTower,
    toggled: ContextKeyExpr.equals(TUNNEL_HOST_SHARING_KEY, true)
  },
  group: "navigation",
  order: 90,
  when: ContextKeyExpr.and(ChatContextKeys.enabled, IsSessionsWindowContext, IsAuxiliaryWindowContext.toNegated())
});
let SessionsTunnelHostTitlebarContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessionsTunnelHostTitlebar";
  }
  constructor(tunnelHostService, actionViewItemService) {
    super();
    const viewItemFactory = (action, _options, instantiationService) => {
      return instantiationService.createInstance(ToggleRemoteConnectionsActionViewItem, action);
    };
    this._register(actionViewItemService.register(Menus.TitleBarRightLayout, TOGGLE_SHARING_ID, viewItemFactory, tunnelHostService.onDidChangeStatus));
  }
};
SessionsTunnelHostTitlebarContribution = __decorateClass([
  __decorateParam(0, ITunnelHostService),
  __decorateParam(1, IActionViewItemService)
], SessionsTunnelHostTitlebarContribution);
registerWorkbenchContribution2(SessionsTunnelHostTitlebarContribution.ID, SessionsTunnelHostTitlebarContribution, WorkbenchPhase.BlockRestore);
