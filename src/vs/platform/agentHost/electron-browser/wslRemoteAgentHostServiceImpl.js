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
import { Emitter, Event } from "../../../base/common/event.js";
import { localize } from "../../../nls.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { ISharedProcessService } from "../../ipc/electron-browser/services.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { ProxyChannel } from "../../../base/parts/ipc/common/ipc.js";
import { IRemoteAgentHostService, RemoteAgentHostEntryType, RemoteAgentHostsEnabledSettingId } from "../common/remoteAgentHostService.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { AhpJsonlLogger } from "../common/ahpJsonlLogger.js";
import { AgentHostAhpJsonlLoggingSettingId } from "../common/agentService.js";
import { WSLRelayTransport } from "./wslRelayTransport.js";
import { RemoteAgentHostProtocolClient } from "../browser/remoteAgentHostProtocolClient.js";
import { agentsWindowAgentHostClientInfo } from "../common/agentHostClientInfo.js";
import {
  WSL_REMOTE_AGENT_HOST_CHANNEL
} from "../common/wslRemoteAgentHost.js";
const IWSLRelayClientFactory = createDecorator("wslRelayClientFactory");
let WSLRelayClientFactory = class {
  constructor(_instantiationService, _configurationService, _environmentService) {
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
  }
  createClient(mainService, connectionId, address) {
    const ahpLoggingEnabled = !!this._configurationService.getValue(AgentHostAhpJsonlLoggingSettingId);
    const logger = ahpLoggingEnabled ? this._instantiationService.createInstance(
      AhpJsonlLogger,
      { logsHome: this._environmentService.logsHome, connectionId, transport: "wsl" }
    ) : void 0;
    const transport = this._instantiationService.createInstance(WSLRelayTransport, connectionId, mainService, logger);
    return this._instantiationService.createInstance(RemoteAgentHostProtocolClient, address, transport, void 0, void 0, agentsWindowAgentHostClientInfo);
  }
};
WSLRelayClientFactory = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEnvironmentService)
], WSLRelayClientFactory);
const CACHED_WSL_DISTROS_KEY = "agentHost.wsl.cachedDistros";
let WSLRemoteAgentHostService = class extends Disposable {
  constructor(sharedProcessService, _remoteAgentHostService, _logService, _configurationService, _relayClientFactory, _storageService) {
    super();
    this._remoteAgentHostService = _remoteAgentHostService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._relayClientFactory = _relayClientFactory;
    this._storageService = _storageService;
    this._onDidChangeConnections = this._register(new Emitter());
    this.onDidChangeConnections = this._onDidChangeConnections.event;
    this._onDidReportLocalConnectProgress = this._register(new Emitter());
    this._connections = /* @__PURE__ */ new Map();
    this._mainService = ProxyChannel.toService(
      sharedProcessService.getChannel(WSL_REMOTE_AGENT_HOST_CHANNEL)
    );
    this.onDidReportConnectProgress = Event.any(this._mainService.onDidReportConnectProgress, this._onDidReportLocalConnectProgress.event);
    this._register(this._mainService.onDidCloseConnection((connectionId) => {
      this._logService.info(`[WSLRemoteAgentHost] onDidCloseConnection: connectionId=${connectionId}`);
      const handle = this._connections.get(connectionId);
      if (handle) {
        this._connections.delete(connectionId);
        handle.fireClose();
        handle.dispose();
        this._onDidChangeConnections.fire();
        this._remoteAgentHostService.notifyConnectionClosed(handle.localAddress);
      }
    }));
  }
  get connections() {
    return [...this._connections.values()];
  }
  async isWSLAvailable() {
    return this._mainService.isWSLAvailable();
  }
  async listDistros() {
    const distros = await this._mainService.listDistros();
    this._evictMissingCachedDistros(distros);
    return distros;
  }
  async listRunningDistros() {
    return this._mainService.listRunningDistros();
  }
  async connect(config) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const augmentedConfig = this._augmentConfig(config);
    this._logService.info(`[WSLRemoteAgentHost] Connecting to distro ${config.distro}`);
    const result = await this._mainService.connect(augmentedConfig);
    this._logService.trace(`[WSLRemoteAgentHost] WSL relay established, connectionId=${result.connectionId}`);
    return this._setupConnection(result);
  }
  async disconnect(distro) {
    this._removeCachedDistro(distro);
    await this._mainService.disconnect(distro);
  }
  async reconnect(distro, name) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const commandOverride = this._getRemoteAgentHostCommand();
    this._logService.info(`[WSLRemoteAgentHost] Reconnecting to distro ${distro}`);
    const result = await this._mainService.reconnect(distro, name, commandOverride);
    return this._setupConnection(result);
  }
  /**
   * Build the renderer-side handle, do the protocol handshake, and register
   * with IRemoteAgentHostService. Any failure after the shared-process tunnel
   * was established tears it back down so we don't leak it.
   */
  async _setupConnection(result) {
    const existing = this._connections.get(result.connectionId);
    if (existing) {
      if (this._remoteAgentHostService.getConnection(result.address)) {
        this._logService.trace(`[WSLRemoteAgentHost] Returning existing connection handle for ${result.address}, connectionId=${result.connectionId}`);
        return existing;
      }
      this._logService.info(`[WSLRemoteAgentHost] Replacing stale connection handle for ${result.address}, connectionId=${result.connectionId}`);
      this._connections.delete(result.connectionId);
      existing.fireClose();
      existing.dispose();
      this._onDidChangeConnections.fire();
    }
    let protocolClient;
    let handle;
    let registeredHandle = false;
    try {
      this._onDidReportLocalConnectProgress.fire({
        connectionKey: result.address,
        message: localize("wslProgressHandshake", "Establishing connection to {0}...", result.name)
      });
      protocolClient = this._relayClientFactory.createClient(this._mainService, result.connectionId, result.address);
      await protocolClient.connect();
      this._logService.trace("[WSLRemoteAgentHost] Protocol handshake completed");
      this._onDidReportLocalConnectProgress.fire({
        connectionKey: result.address,
        message: localize("wslProgressFinalizing", "Provisioning agent host in {0}...", result.name)
      });
      handle = new WSLAgentHostConnectionHandle(
        result.distro,
        result.address,
        result.name,
        () => this._mainService.disconnect(result.distro)
      );
      this._connections.set(result.connectionId, handle);
      registeredHandle = true;
      this._onDidChangeConnections.fire();
      const entry = {
        name: result.name,
        connectionToken: result.connectionToken,
        connection: {
          type: RemoteAgentHostEntryType.WSL,
          address: result.address,
          distro: result.distro
        }
      };
      this._cacheDistro(result.distro, result.name);
      await this._remoteAgentHostService.addManagedConnection(entry, protocolClient, this._createTransportDisposable(result.connectionId, result.distro, handle));
      return handle;
    } catch (err) {
      this._logService.error("[WSLRemoteAgentHost] Connection setup failed", err);
      if (registeredHandle && this._connections.get(result.connectionId) === handle) {
        this._connections.delete(result.connectionId);
        this._onDidChangeConnections.fire();
      }
      handle?.dispose();
      protocolClient?.dispose();
      this._mainService.disconnect(result.distro).catch(() => {
      });
      throw err;
    }
  }
  getCachedDistros() {
    const raw = this._storageService.get(CACHED_WSL_DISTROS_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item) => !!item && typeof item.distro === "string" && typeof item.name === "string");
    } catch {
      return [];
    }
  }
  _cacheDistro(distro, name) {
    const cached = this.getCachedDistros().filter((d) => d.distro !== distro);
    this._storeCachedDistros([{ distro, name }, ...cached]);
  }
  _removeCachedDistro(distro) {
    const cached = this.getCachedDistros();
    const filtered = cached.filter((d) => d.distro !== distro);
    if (filtered.length !== cached.length) {
      this._storeCachedDistros(filtered);
    }
  }
  /**
   * Drop cached distros that no longer exist (e.g. uninstalled). We only
   * prune when we actually observed some distros, so a transient probe
   * failure (which surfaces as an empty list) never wipes the cache.
   */
  _evictMissingCachedDistros(distros) {
    if (distros.length === 0) {
      return;
    }
    const existing = new Set(distros.map((d) => d.name));
    const cached = this.getCachedDistros();
    const filtered = cached.filter((d) => existing.has(d.distro));
    if (filtered.length !== cached.length) {
      this._storeCachedDistros(filtered);
    }
  }
  _storeCachedDistros(distros) {
    if (distros.length === 0) {
      this._storageService.remove(CACHED_WSL_DISTROS_KEY, StorageScope.APPLICATION);
    } else {
      this._storageService.store(CACHED_WSL_DISTROS_KEY, JSON.stringify(distros), StorageScope.APPLICATION, StorageTarget.USER);
    }
  }
  /**
   * Disposable owned by {@link IRemoteAgentHostService} for the lifetime of
   * the entry. When the entry is removed (either by the user or by config
   * reconciliation), this tears down the renderer-side handle and the
   * shared-process WSL relay together so neither is leaked.
   */
  _createTransportDisposable(connectionId, distro, handle) {
    return toDisposable(() => {
      if (this._connections.get(connectionId) === handle) {
        this._connections.delete(connectionId);
        this._onDidChangeConnections.fire();
      }
      handle.fireClose();
      handle.dispose();
      this._mainService.disconnect(distro).catch(() => {
      });
    });
  }
  _augmentConfig(config) {
    const commandOverride = this._getRemoteAgentHostCommand();
    if (commandOverride) {
      return { ...config, remoteAgentHostCommand: commandOverride };
    }
    return config;
  }
  _getRemoteAgentHostCommand() {
    return this._configurationService.getValue("chat.wslRemoteAgentHostCommand") || void 0;
  }
};
WSLRemoteAgentHostService = __decorateClass([
  __decorateParam(0, ISharedProcessService),
  __decorateParam(1, IRemoteAgentHostService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IWSLRelayClientFactory),
  __decorateParam(5, IStorageService)
], WSLRemoteAgentHostService);
class WSLAgentHostConnectionHandle extends Disposable {
  constructor(distro, localAddress, name, disconnectFn) {
    super();
    this.distro = distro;
    this.localAddress = localAddress;
    this.name = name;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._closedByMain = false;
    this._register(toDisposable(() => {
      if (!this._closedByMain) {
        disconnectFn().catch(() => {
        });
      }
    }));
  }
  /** Called by the service when the main process signals connection closure. */
  fireClose() {
    this._closedByMain = true;
    this._onDidClose.fire();
  }
}
export {
  IWSLRelayClientFactory,
  WSLRelayClientFactory,
  WSLRemoteAgentHostService
};
