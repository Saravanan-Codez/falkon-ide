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
import { extHostCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext } from "../common/extHost.protocol.js";
import { IRemoteAuthorityResolverService } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
let MainThreadRemoteConnectionData = class extends Disposable {
  constructor(extHostContext, _environmentService, remoteAuthorityResolverService) {
    super();
    this._environmentService = _environmentService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostExtensionService);
    const remoteAuthority = this._environmentService.remoteAuthority;
    if (remoteAuthority) {
      this._register(remoteAuthorityResolverService.onDidChangeConnectionData(() => {
        const connectionData = remoteAuthorityResolverService.getConnectionData(remoteAuthority);
        if (connectionData) {
          this._proxy.$updateRemoteConnectionData(connectionData);
        }
      }));
    }
  }
};
MainThreadRemoteConnectionData = __decorateClass([
  extHostCustomer,
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IRemoteAuthorityResolverService)
], MainThreadRemoteConnectionData);
export {
  MainThreadRemoteConnectionData
};
