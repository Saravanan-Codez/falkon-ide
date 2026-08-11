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
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ITunnelService, AbstractTunnelService, TunnelPrivacyId, isPortPrivileged, isTunnelProvider } from "../../../../platform/tunnel/common/tunnel.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ISharedProcessTunnelService } from "../../../../platform/remote/common/sharedProcessTunnelService.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { OS } from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
let SharedProcessTunnel = class extends Disposable {
  constructor(_id, _addressProvider, tunnelRemoteHost, tunnelRemotePort, tunnelLocalPort, localAddress, _onBeforeDispose, _sharedProcessTunnelService, _remoteAuthorityResolverService) {
    super();
    this._id = _id;
    this._addressProvider = _addressProvider;
    this.tunnelRemoteHost = tunnelRemoteHost;
    this.tunnelRemotePort = tunnelRemotePort;
    this.tunnelLocalPort = tunnelLocalPort;
    this.localAddress = localAddress;
    this._onBeforeDispose = _onBeforeDispose;
    this._sharedProcessTunnelService = _sharedProcessTunnelService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this.privacy = TunnelPrivacyId.Private;
    this.protocol = void 0;
    this._updateAddress();
    this._register(this._remoteAuthorityResolverService.onDidChangeConnectionData(() => this._updateAddress()));
  }
  _updateAddress() {
    this._addressProvider.getAddress().then((address) => {
      this._sharedProcessTunnelService.setAddress(this._id, address);
    });
  }
  async dispose() {
    this._onBeforeDispose();
    super.dispose();
    await this._sharedProcessTunnelService.destroyTunnel(this._id);
  }
};
SharedProcessTunnel = __decorateClass([
  __decorateParam(7, ISharedProcessTunnelService),
  __decorateParam(8, IRemoteAuthorityResolverService)
], SharedProcessTunnel);
let TunnelService = class extends AbstractTunnelService {
  constructor(logService, _environmentService, _sharedProcessTunnelService, _instantiationService, lifecycleService, _nativeWorkbenchEnvironmentService, configurationService) {
    super(logService, configurationService);
    this._environmentService = _environmentService;
    this._sharedProcessTunnelService = _sharedProcessTunnelService;
    this._instantiationService = _instantiationService;
    this._nativeWorkbenchEnvironmentService = _nativeWorkbenchEnvironmentService;
    this._activeSharedProcessTunnels = /* @__PURE__ */ new Set();
    this._register(lifecycleService.onDidShutdown(() => {
      this._activeSharedProcessTunnels.forEach((id) => {
        this._sharedProcessTunnelService.destroyTunnel(id);
      });
    }));
  }
  isPortPrivileged(port) {
    return isPortPrivileged(port, this.defaultTunnelHost, OS, this._nativeWorkbenchEnvironmentService.os.release);
  }
  retainOrCreateTunnel(addressOrTunnelProvider, remoteHost, remotePort, localHost, localPort, elevateIfNeeded, privacy, protocol) {
    const existing = this.getTunnelFromMap(remoteHost, remotePort);
    if (existing) {
      ++existing.refcount;
      return existing.value;
    }
    if (isTunnelProvider(addressOrTunnelProvider)) {
      return this.createWithProvider(addressOrTunnelProvider, remoteHost, remotePort, localPort, elevateIfNeeded, privacy, protocol);
    } else {
      this.logService.trace(`ForwardedPorts: (TunnelService) Creating tunnel without provider ${remoteHost}:${remotePort} on local port ${localPort}.`);
      const tunnel = this._createSharedProcessTunnel(addressOrTunnelProvider, remoteHost, remotePort, localHost, localPort, elevateIfNeeded);
      this.logService.trace("ForwardedPorts: (TunnelService) Tunnel created without provider.");
      this.addTunnelToMap(remoteHost, remotePort, tunnel);
      return tunnel;
    }
  }
  async _createSharedProcessTunnel(addressProvider, tunnelRemoteHost, tunnelRemotePort, tunnelLocalHost, tunnelLocalPort, elevateIfNeeded) {
    const { id } = await this._sharedProcessTunnelService.createTunnel();
    this._activeSharedProcessTunnels.add(id);
    const authority = this._environmentService.remoteAuthority;
    const result = await this._sharedProcessTunnelService.startTunnel(authority, id, tunnelRemoteHost, tunnelRemotePort, tunnelLocalHost, tunnelLocalPort, elevateIfNeeded);
    const tunnel = this._instantiationService.createInstance(SharedProcessTunnel, id, addressProvider, tunnelRemoteHost, tunnelRemotePort, result.tunnelLocalPort, result.localAddress, () => {
      this._activeSharedProcessTunnels.delete(id);
    });
    return tunnel;
  }
  canTunnel(uri) {
    return super.canTunnel(uri) && !!this._environmentService.remoteAuthority;
  }
};
TunnelService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, ISharedProcessTunnelService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILifecycleService),
  __decorateParam(5, INativeWorkbenchEnvironmentService),
  __decorateParam(6, IConfigurationService)
], TunnelService);
registerSingleton(ITunnelService, TunnelService, InstantiationType.Delayed);
export {
  TunnelService
};
