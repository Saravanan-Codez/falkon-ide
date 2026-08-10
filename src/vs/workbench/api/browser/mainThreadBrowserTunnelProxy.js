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
import { Disposable } from "../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IBrowserViewWorkbenchService } from "../../contrib/browserView/common/browserView.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
const browserRemoteProxyEnabledSettingId = "workbench.browser.enableRemoteProxy";
let MainThreadBrowserTunnelProxy = class extends Disposable {
  constructor(extHostContext, _configurationService, _environmentService, _browserViewWorkbenchService) {
    super();
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
    this._browserViewWorkbenchService = _browserViewWorkbenchService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostBrowserTunnelProxy);
    this._updateEnabled();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(browserRemoteProxyEnabledSettingId)) {
        this._updateEnabled();
      }
    }));
  }
  _isEnabled() {
    return !!this._environmentService.remoteAuthority && this._configurationService.getValue(browserRemoteProxyEnabledSettingId) === true;
  }
  _updateEnabled() {
    this._proxy.$setEnabled(this._isEnabled());
  }
  $updateProxyInfo(info) {
    this._browserViewWorkbenchService.setRemoteProxyInfo(info);
  }
};
MainThreadBrowserTunnelProxy = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadBrowserTunnelProxy),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IBrowserViewWorkbenchService)
], MainThreadBrowserTunnelProxy);
export {
  MainThreadBrowserTunnelProxy
};
