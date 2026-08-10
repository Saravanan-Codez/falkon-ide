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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { OperatingSystem } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
const ITunnelService = createDecorator("tunnelService");
const ISharedTunnelsService = createDecorator("sharedTunnelsService");
function isRemoteTunnel(something) {
  const asTunnel = something;
  return !!(asTunnel.tunnelRemotePort && asTunnel.tunnelRemoteHost && asTunnel.localAddress && asTunnel.privacy && asTunnel.dispose);
}
var TunnelProtocol = /* @__PURE__ */ ((TunnelProtocol2) => {
  TunnelProtocol2["Http"] = "http";
  TunnelProtocol2["Https"] = "https";
  return TunnelProtocol2;
})(TunnelProtocol || {});
var TunnelPrivacyId = /* @__PURE__ */ ((TunnelPrivacyId2) => {
  TunnelPrivacyId2["ConstantPrivate"] = "constantPrivate";
  TunnelPrivacyId2["Private"] = "private";
  TunnelPrivacyId2["Public"] = "public";
  return TunnelPrivacyId2;
})(TunnelPrivacyId || {});
function isTunnelProvider(addressOrTunnelProvider) {
  return !!addressOrTunnelProvider.forwardPort;
}
var ProvidedOnAutoForward = /* @__PURE__ */ ((ProvidedOnAutoForward2) => {
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["Notify"] = 1] = "Notify";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["OpenBrowser"] = 2] = "OpenBrowser";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["OpenPreview"] = 3] = "OpenPreview";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["Silent"] = 4] = "Silent";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["Ignore"] = 5] = "Ignore";
  ProvidedOnAutoForward2[ProvidedOnAutoForward2["OpenBrowserOnce"] = 6] = "OpenBrowserOnce";
  return ProvidedOnAutoForward2;
})(ProvidedOnAutoForward || {});
function extractLocalHostUriMetaDataForPortMapping(uri) {
  if (uri.scheme !== "http" && uri.scheme !== "https") {
    return void 0;
  }
  const localhostMatch = /^(localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)$/.exec(uri.authority);
  if (!localhostMatch) {
    return void 0;
  }
  return {
    address: localhostMatch[1],
    port: +localhostMatch[2]
  };
}
function extractQueryLocalHostUriMetaDataForPortMapping(uri) {
  if (uri.scheme !== "http" && uri.scheme !== "https" || !uri.query) {
    return void 0;
  }
  const keyvalues = uri.query.split("&");
  for (const keyvalue of keyvalues) {
    const value = keyvalue.split("=")[1];
    if (/^https?:/.exec(value)) {
      const result = extractLocalHostUriMetaDataForPortMapping(URI.parse(value));
      if (result) {
        return result;
      }
    }
  }
  return void 0;
}
const LOCALHOST_ADDRESSES = ["localhost", "127.0.0.1", "0:0:0:0:0:0:0:1", "::1"];
function isLocalhost(host) {
  return LOCALHOST_ADDRESSES.indexOf(host) >= 0;
}
const ALL_INTERFACES_ADDRESSES = ["0.0.0.0", "0:0:0:0:0:0:0:0", "::"];
function isAllInterfaces(host) {
  return ALL_INTERFACES_ADDRESSES.indexOf(host) >= 0;
}
function isPortPrivileged(port, host, os, osRelease) {
  if (os === OperatingSystem.Windows) {
    return false;
  }
  if (os === OperatingSystem.Macintosh) {
    if (isAllInterfaces(host)) {
      const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(osRelease);
      if (osVersion?.length === 4) {
        const major = parseInt(osVersion[1]);
        if (major >= 18) {
          return false;
        }
      }
    }
  }
  return port < 1024;
}
class DisposableTunnel {
  constructor(remoteAddress, localAddress, _dispose) {
    this.remoteAddress = remoteAddress;
    this.localAddress = localAddress;
    this._dispose = _dispose;
    this._onDispose = new Emitter();
    this.onDidDispose = this._onDispose.event;
  }
  dispose() {
    this._onDispose.fire();
    this._onDispose.dispose();
    return this._dispose();
  }
}
let AbstractTunnelService = class extends Disposable {
  constructor(logService, configurationService) {
    super();
    this.logService = logService;
    this.configurationService = configurationService;
    this._onTunnelOpened = this._register(new Emitter());
    this.onTunnelOpened = this._onTunnelOpened.event;
    this._onTunnelClosed = this._register(new Emitter());
    this.onTunnelClosed = this._onTunnelClosed.event;
    this._onAddedTunnelProvider = this._register(new Emitter());
    this.onAddedTunnelProvider = this._onAddedTunnelProvider.event;
    this._tunnels = /* @__PURE__ */ new Map();
    this._canElevate = false;
    this._canChangeProtocol = true;
    this._privacyOptions = [];
    this._factoryInProgress = /* @__PURE__ */ new Set();
  }
  get hasTunnelProvider() {
    return !!this._tunnelProvider;
  }
  get defaultTunnelHost() {
    const settingValue = this.configurationService.getValue("remote.localPortHost");
    return !settingValue || settingValue === "localhost" ? "127.0.0.1" : "0.0.0.0";
  }
  setTunnelProvider(provider) {
    this._tunnelProvider = provider;
    if (!provider) {
      this._canElevate = false;
      this._privacyOptions = [];
      this._onAddedTunnelProvider.fire();
      return {
        dispose: () => {
        }
      };
    }
    this._onAddedTunnelProvider.fire();
    return {
      dispose: () => {
        this._tunnelProvider = void 0;
        this._canElevate = false;
        this._privacyOptions = [];
      }
    };
  }
  setTunnelFeatures(features) {
    this._canElevate = features.elevation;
    this._privacyOptions = features.privacyOptions;
    this._canChangeProtocol = features.protocol;
  }
  get canChangeProtocol() {
    return this._canChangeProtocol;
  }
  get canElevate() {
    return this._canElevate;
  }
  get canChangePrivacy() {
    return this._privacyOptions.length > 0;
  }
  get privacyOptions() {
    return this._privacyOptions;
  }
  get tunnels() {
    return this.getTunnels();
  }
  async getTunnels() {
    const tunnels = [];
    const tunnelArray = Array.from(this._tunnels.values());
    for (const portMap of tunnelArray) {
      const portArray = Array.from(portMap.values());
      for (const x of portArray) {
        const tunnelValue = await x.value;
        if (tunnelValue && typeof tunnelValue !== "string") {
          tunnels.push(tunnelValue);
        }
      }
    }
    return tunnels;
  }
  async dispose() {
    super.dispose();
    for (const portMap of this._tunnels.values()) {
      for (const { value } of portMap.values()) {
        await value.then((tunnel) => typeof tunnel !== "string" ? tunnel?.dispose() : void 0);
      }
      portMap.clear();
    }
    this._tunnels.clear();
  }
  setEnvironmentTunnel(remoteHost, remotePort, localAddress, privacy, protocol) {
    this.addTunnelToMap(remoteHost, remotePort, Promise.resolve({
      tunnelRemoteHost: remoteHost,
      tunnelRemotePort: remotePort,
      localAddress,
      privacy,
      protocol,
      dispose: () => Promise.resolve()
    }));
  }
  async getExistingTunnel(remoteHost, remotePort) {
    if (isAllInterfaces(remoteHost) || isLocalhost(remoteHost)) {
      remoteHost = LOCALHOST_ADDRESSES[0];
    }
    const existing = this.getTunnelFromMap(remoteHost, remotePort);
    if (existing) {
      ++existing.refcount;
      return existing.value;
    }
    return void 0;
  }
  openTunnel(addressProvider, remoteHost, remotePort, localHost, localPort, elevateIfNeeded = false, privacy, protocol) {
    this.logService.trace(`ForwardedPorts: (TunnelService) openTunnel request for ${remoteHost}:${remotePort} on local port ${localPort}.`);
    const addressOrTunnelProvider = this._tunnelProvider ?? addressProvider;
    if (!addressOrTunnelProvider) {
      return void 0;
    }
    if (!remoteHost) {
      remoteHost = "localhost";
    }
    if (!localHost) {
      localHost = this.defaultTunnelHost;
    }
    if (this._tunnelProvider && this._factoryInProgress.has(remotePort)) {
      this.logService.debug(`ForwardedPorts: (TunnelService) Another call to create a tunnel with the same address has occurred before the last one completed. This call will be ignored.`);
      return;
    }
    const resolvedTunnel = this.retainOrCreateTunnel(addressOrTunnelProvider, remoteHost, remotePort, localHost, localPort, elevateIfNeeded, privacy, protocol);
    if (!resolvedTunnel) {
      this.logService.trace(`ForwardedPorts: (TunnelService) Tunnel was not created.`);
      return resolvedTunnel;
    }
    return resolvedTunnel.then((tunnel) => {
      if (!tunnel) {
        this.logService.trace("ForwardedPorts: (TunnelService) New tunnel is undefined.");
        this.removeEmptyOrErrorTunnelFromMap(remoteHost, remotePort);
        return void 0;
      } else if (typeof tunnel === "string") {
        this.logService.trace("ForwardedPorts: (TunnelService) The tunnel provider returned an error when creating the tunnel.");
        this.removeEmptyOrErrorTunnelFromMap(remoteHost, remotePort);
        return tunnel;
      }
      this.logService.trace("ForwardedPorts: (TunnelService) New tunnel established.");
      const newTunnel = this.makeTunnel(tunnel);
      if (tunnel.tunnelRemoteHost !== remoteHost || tunnel.tunnelRemotePort !== remotePort) {
        this.logService.warn("ForwardedPorts: (TunnelService) Created tunnel does not match requirements of requested tunnel. Host or port mismatch.");
      }
      if (privacy && tunnel.privacy !== privacy) {
        this.logService.warn("ForwardedPorts: (TunnelService) Created tunnel does not match requirements of requested tunnel. Privacy mismatch.");
      }
      this._onTunnelOpened.fire(newTunnel);
      return newTunnel;
    });
  }
  makeTunnel(tunnel) {
    return {
      tunnelRemotePort: tunnel.tunnelRemotePort,
      tunnelRemoteHost: tunnel.tunnelRemoteHost,
      tunnelLocalPort: tunnel.tunnelLocalPort,
      localAddress: tunnel.localAddress,
      privacy: tunnel.privacy,
      protocol: tunnel.protocol,
      dispose: async () => {
        this.logService.trace(`ForwardedPorts: (TunnelService) dispose request for ${tunnel.tunnelRemoteHost}:${tunnel.tunnelRemotePort} `);
        const existingHost = this._tunnels.get(tunnel.tunnelRemoteHost);
        if (existingHost) {
          const existing = existingHost.get(tunnel.tunnelRemotePort);
          if (existing) {
            existing.refcount--;
            await this.tryDisposeTunnel(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort, existing);
          }
        }
      }
    };
  }
  async tryDisposeTunnel(remoteHost, remotePort, tunnel) {
    if (tunnel.refcount <= 0) {
      this.logService.trace(`ForwardedPorts: (TunnelService) Tunnel is being disposed ${remoteHost}:${remotePort}.`);
      const disposePromise = tunnel.value.then(async (tunnel2) => {
        if (tunnel2 && typeof tunnel2 !== "string") {
          await tunnel2.dispose(true);
          this._onTunnelClosed.fire({ host: tunnel2.tunnelRemoteHost, port: tunnel2.tunnelRemotePort });
        }
      });
      if (this._tunnels.has(remoteHost)) {
        this._tunnels.get(remoteHost).delete(remotePort);
      }
      return disposePromise;
    }
  }
  async closeTunnel(remoteHost, remotePort) {
    this.logService.trace(`ForwardedPorts: (TunnelService) close request for ${remoteHost}:${remotePort} `);
    const portMap = this._tunnels.get(remoteHost);
    if (portMap && portMap.has(remotePort)) {
      const value = portMap.get(remotePort);
      value.refcount = 0;
      await this.tryDisposeTunnel(remoteHost, remotePort, value);
    }
  }
  addTunnelToMap(remoteHost, remotePort, tunnel) {
    if (!this._tunnels.has(remoteHost)) {
      this._tunnels.set(remoteHost, /* @__PURE__ */ new Map());
    }
    this._tunnels.get(remoteHost).set(remotePort, { refcount: 1, value: tunnel });
  }
  async removeEmptyOrErrorTunnelFromMap(remoteHost, remotePort) {
    const hostMap = this._tunnels.get(remoteHost);
    if (hostMap) {
      const tunnel = hostMap.get(remotePort);
      const tunnelResult = tunnel ? await tunnel.value : void 0;
      if (!tunnelResult || typeof tunnelResult === "string") {
        hostMap.delete(remotePort);
      }
      if (hostMap.size === 0) {
        this._tunnels.delete(remoteHost);
      }
    }
  }
  getTunnelFromMap(remoteHost, remotePort) {
    const hosts = [remoteHost];
    if (isLocalhost(remoteHost)) {
      hosts.push(...LOCALHOST_ADDRESSES);
      hosts.push(...ALL_INTERFACES_ADDRESSES);
    } else if (isAllInterfaces(remoteHost)) {
      hosts.push(...ALL_INTERFACES_ADDRESSES);
    }
    const existingPortMaps = hosts.map((host) => this._tunnels.get(host));
    for (const map of existingPortMaps) {
      const existingTunnel = map?.get(remotePort);
      if (existingTunnel) {
        return existingTunnel;
      }
    }
    return void 0;
  }
  canTunnel(uri) {
    return !!extractLocalHostUriMetaDataForPortMapping(uri);
  }
  createWithProvider(tunnelProvider, remoteHost, remotePort, localPort, elevateIfNeeded, privacy, protocol) {
    this.logService.trace(`ForwardedPorts: (TunnelService) Creating tunnel with provider ${remoteHost}:${remotePort} on local port ${localPort}.`);
    const key = remotePort;
    this._factoryInProgress.add(key);
    const preferredLocalPort = localPort === void 0 ? remotePort : localPort;
    const creationInfo = { elevationRequired: elevateIfNeeded ? this.isPortPrivileged(preferredLocalPort) : false };
    const tunnelOptions = { remoteAddress: { host: remoteHost, port: remotePort }, localAddressPort: localPort, privacy, public: privacy ? privacy !== "private" /* Private */ : void 0, protocol };
    const tunnel = tunnelProvider.forwardPort(tunnelOptions, creationInfo);
    if (tunnel) {
      this.addTunnelToMap(remoteHost, remotePort, tunnel);
      tunnel.finally(() => {
        this.logService.trace("ForwardedPorts: (TunnelService) Tunnel created by provider.");
        this._factoryInProgress.delete(key);
      });
    } else {
      this._factoryInProgress.delete(key);
    }
    return tunnel;
  }
};
AbstractTunnelService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IConfigurationService)
], AbstractTunnelService);
export {
  ALL_INTERFACES_ADDRESSES,
  AbstractTunnelService,
  DisposableTunnel,
  ISharedTunnelsService,
  ITunnelService,
  LOCALHOST_ADDRESSES,
  ProvidedOnAutoForward,
  TunnelPrivacyId,
  TunnelProtocol,
  extractLocalHostUriMetaDataForPortMapping,
  extractQueryLocalHostUriMetaDataForPortMapping,
  isAllInterfaces,
  isLocalhost,
  isPortPrivileged,
  isRemoteTunnel,
  isTunnelProvider
};
