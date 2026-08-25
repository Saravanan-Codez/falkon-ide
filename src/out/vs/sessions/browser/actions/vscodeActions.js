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
import { Codicon } from "../../../base/common/codicons.js";
import { Schemas } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
import { localize2 } from "../../../nls.js";
import { Action2 } from "../../../platform/actions/common/actions.js";
import { AGENT_HOST_SCHEME, fromAgentHostUri } from "../../../platform/agentHost/common/agentHostUri.js";
import { IRemoteAgentHostService } from "../../../platform/agentHost/common/remoteAgentHostService.js";
import { ContextKeyExpr } from "../../../platform/contextkey/common/contextkey.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { IsAuxiliaryWindowContext } from "../../../workbench/common/contextkeys.js";
import { IsPhoneLayoutContext, SessionsWelcomeVisibleContext } from "../../common/contextkeys.js";
import { logSessionsInteraction } from "../../common/sessionsTelemetry.js";
import { Menus } from "../../browser/menus.js";
import { ISessionsService } from "../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../services/sessions/browser/sessionsProvidersService.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IActionViewItemService } from "../../../platform/actions/browser/actionViewItemService.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { resolveRemoteAuthority } from "../openInVSCodeUtils.js";
import { OpenInVSCodeTitleBarWidget } from "../widget/openInVSCodeWidget.js";
class OpenInVSCodeAction extends Action2 {
  static {
    this.ID = "sessions.openInVSCode";
  }
  constructor() {
    super({
      id: OpenInVSCodeAction.ID,
      title: localize2("openInVSCode", "Open in Editor"),
      icon: Codicon.vscodeInsiders,
      precondition: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated()),
      menu: [{
        id: Menus.TitleBarCenterRight,
        group: "navigation",
        order: 7,
        when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated(), IsPhoneLayoutContext.negate())
      }]
    });
  }
  async run(accessor) {
    const telemetryService = accessor.get(ITelemetryService);
    logSessionsInteraction(telemetryService, "openInVSCode");
    const openerService = accessor.get(IOpenerService);
    const productService = accessor.get(IProductService);
    const sessionsService = accessor.get(ISessionsService);
    const sessionsProvidersService = accessor.get(ISessionsProvidersService);
    const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
    const scheme = productService.quality === "stable" ? "vscode" : productService.quality === "exploration" ? "vscode-exploration" : productService.quality === "insider" ? "vscode-insiders" : productService.urlProtocol;
    const params = new URLSearchParams();
    params.set("windowId", "_blank");
    const activeSession = sessionsService.activeSession.get();
    if (!activeSession) {
      await openerService.open(URI.from({ scheme, query: params.toString() }), { openExternal: true });
      return;
    }
    const workspace = activeSession.workspace.get();
    const folder = workspace?.folders[0];
    const rawFolderUri = workspace?.isVirtualWorkspace ? void 0 : folder?.workingDirectory;
    if (!rawFolderUri) {
      await openerService.open(URI.from({ scheme, query: params.toString() }), { openExternal: true });
      return;
    }
    const folderUri = rawFolderUri.scheme === AGENT_HOST_SCHEME ? fromAgentHostUri(rawFolderUri) : rawFolderUri;
    const remoteAuthority = resolveRemoteAuthority(
      activeSession.providerId,
      sessionsProvidersService,
      remoteAgentHostService
    );
    params.set("session", activeSession.resource.toString());
    if (remoteAuthority) {
      await openerService.open(URI.from({
        scheme,
        authority: Schemas.vscodeRemote,
        path: `/${remoteAuthority}${folderUri.path}`,
        query: params.toString()
      }), { openExternal: true });
    } else {
      await openerService.open(URI.from({
        scheme,
        authority: Schemas.file,
        path: folderUri.path,
        query: params.toString()
      }), { openExternal: true });
    }
  }
}
let OpenInVSCodeWidgetContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.openInVSCode.widget";
  }
  constructor(actionViewItemService, instantiationService) {
    super();
    this._register(actionViewItemService.register(Menus.TitleBarCenterRight, OpenInVSCodeAction.ID, (action, options) => {
      return instantiationService.createInstance(OpenInVSCodeTitleBarWidget, action, options, OpenInVSCodeAction.ID);
    }, void 0));
  }
};
OpenInVSCodeWidgetContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService)
], OpenInVSCodeWidgetContribution);
export {
  OpenInVSCodeAction,
  OpenInVSCodeWidgetContribution
};
