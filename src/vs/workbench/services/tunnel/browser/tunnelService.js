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
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractTunnelService, ITunnelService, isTunnelProvider } from "../../../../platform/tunnel/common/tunnel.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
let TunnelService = class extends AbstractTunnelService {
  constructor(logService, environmentService, configurationService) {
    super(logService, configurationService);
    this.environmentService = environmentService;
  }
  isPortPrivileged(_port) {
    return false;
  }
  retainOrCreateTunnel(tunnelProvider, remoteHost, remotePort, _localHost, localPort, elevateIfNeeded, privacy, protocol) {
    const existing = this.getTunnelFromMap(remoteHost, remotePort);
    if (existing) {
      ++existing.refcount;
      return existing.value;
    }
    if (isTunnelProvider(tunnelProvider)) {
      return this.createWithProvider(tunnelProvider, remoteHost, remotePort, localPort, elevateIfNeeded, privacy, protocol);
    }
    return void 0;
  }
  canTunnel(uri) {
    return super.canTunnel(uri) && !!this.environmentService.remoteAuthority;
  }
};
TunnelService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IConfigurationService)
], TunnelService);
registerSingleton(ITunnelService, TunnelService, InstantiationType.Delayed);
export {
  TunnelService
};
