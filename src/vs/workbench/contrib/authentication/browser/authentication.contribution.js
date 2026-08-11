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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { SignOutOfAccountAction } from "./actions/signOutOfAccountAction.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { Extensions } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { ManageTrustedExtensionsForAccountAction } from "./actions/manageTrustedExtensionsForAccountAction.js";
import { ManageAccountPreferencesForExtensionAction } from "./actions/manageAccountPreferencesForExtensionAction.js";
import { IAuthenticationUsageService } from "../../../services/authentication/browser/authenticationUsageService.js";
import { ManageAccountPreferencesForMcpServerAction } from "./actions/manageAccountPreferencesForMcpServerAction.js";
import { ManageTrustedMcpServersForAccountAction } from "./actions/manageTrustedMcpServersForAccountAction.js";
import { RemoveDynamicAuthenticationProvidersAction } from "./actions/manageDynamicAuthenticationProvidersAction.js";
import { ManageAccountsAction } from "./actions/manageAccountsAction.js";
const codeExchangeProxyCommand = CommandsRegistry.registerCommand("workbench.getCodeExchangeProxyEndpoints", function(accessor, _) {
  const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
  return environmentService.options?.codeExchangeProxyEndpoints;
});
class AuthenticationDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.authentication;
  }
  render(manifest) {
    const authentication = manifest.contributes?.authentication || [];
    if (!authentication.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("authenticationlabel", "Label"),
      localize("authenticationid", "ID"),
      localize("authenticationMcpAuthorizationServers", "MCP Authorization Servers")
    ];
    const rows = authentication.sort((a, b) => a.label.localeCompare(b.label)).map((auth) => {
      return [
        auth.label,
        auth.id,
        (auth.authorizationServerGlobs ?? []).join(",\n")
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
const extensionFeature = Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "authentication",
  label: localize("authentication", "Authentication"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(AuthenticationDataRenderer)
});
class AuthenticationContribution extends Disposable {
  static {
    this.ID = "workbench.contrib.authentication";
  }
  constructor() {
    super();
    this._register(codeExchangeProxyCommand);
    this._register(extensionFeature);
    this._registerActions();
  }
  _registerActions() {
    this._register(registerAction2(ManageAccountsAction));
    this._register(registerAction2(SignOutOfAccountAction));
    this._register(registerAction2(ManageTrustedExtensionsForAccountAction));
    this._register(registerAction2(ManageAccountPreferencesForExtensionAction));
    this._register(registerAction2(ManageTrustedMcpServersForAccountAction));
    this._register(registerAction2(ManageAccountPreferencesForMcpServerAction));
    this._register(registerAction2(RemoveDynamicAuthenticationProvidersAction));
  }
}
let AuthenticationUsageContribution = class {
  constructor(_authenticationUsageService) {
    this._authenticationUsageService = _authenticationUsageService;
    this._initializeExtensionUsageCache();
  }
  static {
    this.ID = "workbench.contrib.authenticationUsage";
  }
  async _initializeExtensionUsageCache() {
    await this._authenticationUsageService.initializeExtensionUsageCache();
  }
};
AuthenticationUsageContribution = __decorateClass([
  __decorateParam(0, IAuthenticationUsageService)
], AuthenticationUsageContribution);
registerWorkbenchContribution2(AuthenticationContribution.ID, AuthenticationContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AuthenticationUsageContribution.ID, AuthenticationUsageContribution, WorkbenchPhase.Eventually);
