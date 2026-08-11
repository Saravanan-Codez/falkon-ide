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
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { DeferredPromise, raceTimeout } from "../../../base/common/async.js";
import { ConfigurationTarget, IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILabelService } from "../../label/common/label.js";
import { ILogService } from "../../log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { hasKey } from "../../../base/common/types.js";
import { AgentHostAhpJsonlLoggingSettingId } from "../common/agentService.js";
import {
  RemoteAgentHostConnectionStatus,
  RemoteAgentHostsEnabledSettingId,
  RemoteAgentHostsSettingId,
  SSH_ENTRY_TYPE_CONFIG,
  WEBSOCKET_ENTRY_TYPE_CONFIG,
  getEntryTypeConfig,
  parseLegacyRawEntry
} from "../common/remoteAgentHostService.js";
import { RemoteAgentHostProtocolClient, AgentHostClientState } from "./remoteAgentHostProtocolClient.js";
import { WebSocketClientTransport } from "./webSocketClientTransport.js";
import { AGENT_HOST_LABEL_FORMATTER, AGENT_HOST_SCHEME, agentHostAuthority, normalizeRemoteAgentHostAddress } from "../common/agentHostUri.js";
import { PROTOCOL_VERSION } from "../common/state/protocol/version/registry.js";
import { agentsWindowAgentHostClientInfo, editorWindowAgentHostClientInfo } from "../common/agentHostClientInfo.js";
const SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY = "remoteAgentHost.sshConnections";
function disposeEntry(entry) {
  entry.store.dispose();
  entry.transportDisposable?.dispose();
}
function isRawRemoteAgentHostEntry(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value;
  return typeof candidate.address === "string" && typeof candidate.name === "string" && (candidate.connectionToken === void 0 || typeof candidate.connectionToken === "string") && (candidate.sshConfigHost === void 0 || typeof candidate.sshConfigHost === "string") && (candidate.sshHostName === void 0 || typeof candidate.sshHostName === "string") && (candidate.sshUser === void 0 || typeof candidate.sshUser === "string") && (candidate.sshPort === void 0 || typeof candidate.sshPort === "number");
}
function isLegacySshRawEntry(entry) {
  return entry.sshConfigHost !== void 0 || entry.sshHostName !== void 0 || entry.sshUser !== void 0 || entry.sshPort !== void 0;
}
let RemoteAgentHostService = class extends Disposable {
  constructor(_configurationService, _instantiationService, _logService, _labelService, _environmentService, _storageService) {
    super();
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._labelService = _labelService;
    this._environmentService = _environmentService;
    this._storageService = _storageService;
    this._onDidChangeConnections = this._register(new Emitter());
    this.onDidChangeConnections = this._onDidChangeConnections.event;
    this._entries = /* @__PURE__ */ new Map();
    this._names = /* @__PURE__ */ new Map();
    this._tokens = /* @__PURE__ */ new Map();
    /**
     * Stores the original {@link IRemoteAgentHostEntry} for connections
     * registered via {@link addManagedConnection}. This is needed because
     * tunnel entries are not persisted to settings and therefore don't
     * appear in {@link configuredEntries}.
     */
    this._registeredEntries = /* @__PURE__ */ new Map();
    this._pendingConnectionWaits = /* @__PURE__ */ new Map();
    /** Pending reconnect timeouts, keyed by normalized address. */
    this._reconnectTimeouts = /* @__PURE__ */ new Map();
    /** Current reconnect attempt count per address for exponential backoff. */
    this._reconnectAttempts = /* @__PURE__ */ new Map();
    /**
     * Per-address {@link ILabelService} formatter handles for the
     * {@link AGENT_HOST_SCHEME}. The formatter advertises the entry's
     * human-readable name as the host label so any UI looking up the host
     * label for an agent host URI gets the friendly name.
     */
    this._labelFormatters = /* @__PURE__ */ new Map();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(RemoteAgentHostsSettingId) || e.affectsConfiguration(RemoteAgentHostsEnabledSettingId)) {
        this._reconcileConnections();
      }
    }));
    this._register(this._storageService.onDidChangeValue(StorageScope.APPLICATION, SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY, this._store)(() => {
      this._reconcileConnections();
      this._onDidChangeConnections.fire();
    }));
    this._migrateSSHEntriesFromSetting();
    this._reconcileConnections();
  }
  static {
    this.ConnectionWaitTimeout = 1e4;
  }
  static {
    /** Initial reconnect delay in milliseconds. */
    this.ReconnectInitialDelay = 1e3;
  }
  static {
    /** Maximum reconnect delay in milliseconds. */
    this.ReconnectMaxDelay = 3e4;
  }
  static {
    /**
     * How long to wait for a server-upgrade trigger to be acknowledged.
     * The CLI awaits the binary download synchronously before responding,
     * so this needs to accommodate first-time downloads on slow networks.
     */
    this.UpgradeRequestTimeout = 5 * 60 * 1e3;
  }
  get clientInfo() {
    return editorWindowAgentHostClientInfo;
  }
  _entryAddress(entry) {
    const config = getEntryTypeConfig(entry.connection.type);
    const address = config.address(entry.connection);
    return config.normalizedAddress ? normalizeRemoteAgentHostAddress(address) : address;
  }
  _normalizeEntry(entry) {
    const config = getEntryTypeConfig(entry.connection.type);
    if (!config.normalizedAddress || !hasKey(entry.connection, { address: true })) {
      return entry;
    }
    return { ...entry, connection: { ...entry.connection, address: normalizeRemoteAgentHostAddress(entry.connection.address) } };
  }
  get connections() {
    const result = [];
    for (const [address, entry] of this._entries) {
      result.push({
        address,
        name: this._names.get(address) ?? address,
        clientId: entry.client.clientId,
        defaultDirectory: entry.client.defaultDirectory,
        status: entry.status
      });
    }
    return result;
  }
  get configuredEntries() {
    return this._getConfiguredEntries().map((entry) => this._normalizeEntry(entry));
  }
  getConnection(address) {
    const normalized = normalizeRemoteAgentHostAddress(address);
    const entry = this._entries.get(normalized);
    return entry?.connected ? entry.client : void 0;
  }
  getConnectionByAuthority(authority) {
    for (const [address, entry] of this._entries) {
      if (entry.connected && agentHostAuthority(address) === authority) {
        return entry.client;
      }
    }
    return void 0;
  }
  getEntryByAddress(address) {
    const normalized = normalizeRemoteAgentHostAddress(address);
    const registered = this._registeredEntries.get(normalized);
    if (registered) {
      return registered;
    }
    return this.configuredEntries.find(
      (entry) => this._entryAddress(entry) === normalized
    );
  }
  async triggerServerUpgrade(address, method) {
    const normalized = normalizeRemoteAgentHostAddress(address);
    const entry = this._entries.get(normalized);
    if (!entry) {
      throw new Error(`No remote agent host entry found for ${address}.`);
    }
    const result = await raceTimeout(
      entry.client.triggerVscodeUpgrade(method),
      RemoteAgentHostService.UpgradeRequestTimeout
    );
    if (result === void 0) {
      throw new Error(`Server upgrade request timed out after ${RemoteAgentHostService.UpgradeRequestTimeout}ms.`);
    }
    return result;
  }
  reconnect(address) {
    const normalized = normalizeRemoteAgentHostAddress(address);
    const configuredEntry = this._getConfiguredEntries().find(
      (entry2) => this._entryAddress(entry2) === normalized
    );
    if (configuredEntry && !getEntryTypeConfig(configuredEntry.connection.type).selfConnecting) {
      return;
    }
    const token = this._tokens.get(normalized);
    this._cancelReconnect(normalized);
    this._reconnectAttempts.delete(normalized);
    const entry = this._entries.get(normalized);
    if (entry) {
      this._entries.delete(normalized);
      entry.store.dispose();
    }
    this._connectTo(normalized, token);
  }
  async addRemoteAgentHost(input) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const entry = this._normalizeEntry(input);
    const address = this._entryAddress(entry);
    const existingConnection = this._getConnectionInfo(address);
    const config = getEntryTypeConfig(entry.connection.type);
    if (config.store !== "runtime") {
      await this._storeConfiguredEntries(this._upsertEntry(this._getConfiguredEntries(true), entry));
    }
    if (existingConnection) {
      return {
        ...existingConnection,
        name: entry.name
      };
    }
    if (!config.selfConnecting) {
      return {
        address,
        name: entry.name,
        clientId: "",
        status: RemoteAgentHostConnectionStatus.disconnected
      };
    }
    const connectedConnection = this._getConnectionInfo(address);
    if (connectedConnection) {
      return connectedConnection;
    }
    const wait = this._getOrCreateConnectionWait(address);
    const connection = await raceTimeout(wait.p, RemoteAgentHostService.ConnectionWaitTimeout, () => {
      this._pendingConnectionWaits.delete(address);
    });
    if (!connection) {
      throw new Error(`Timed out connecting to ${address}`);
    }
    return connection;
  }
  async addManagedConnection(entry, connection, transportDisposable, status = RemoteAgentHostConnectionStatus.connected) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const address = this._entryAddress(entry);
    const existingEntry = this._entries.get(address);
    if (existingEntry) {
      this._entries.delete(address);
      existingEntry.store.dispose();
    }
    const store = new DisposableStore();
    const protocolClient = connection;
    store.add(protocolClient);
    const connEntry = { store, client: protocolClient, transportDisposable, connected: RemoteAgentHostConnectionStatus.isConnected(status), status };
    this._entries.set(address, connEntry);
    this._names.set(address, entry.name);
    this._registeredEntries.set(address, entry);
    this._updateHostLabelFormatter(address, entry.name);
    if (entry.connectionToken) {
      this._tokens.set(address, entry.connectionToken);
    }
    store.add(protocolClient.onDidClose(() => {
      if (this._entries.get(address) === connEntry) {
        connEntry.connected = false;
        connEntry.status = RemoteAgentHostConnectionStatus.disconnected;
        this._onDidChangeConnections.fire();
      }
    }));
    const config = getEntryTypeConfig(entry.connection.type);
    if (config.store !== "runtime") {
      await this._storeConfiguredEntries(this._upsertEntry(this._getConfiguredEntries(true), entry));
    }
    this._onDidChangeConnections.fire();
    return {
      address,
      name: entry.name,
      clientId: protocolClient.clientId,
      defaultDirectory: protocolClient.defaultDirectory,
      status
    };
  }
  async removeRemoteAgentHost(address) {
    const normalized = normalizeRemoteAgentHostAddress(address);
    const entry = this._registeredEntries.get(normalized) ?? this._getConfiguredEntries().find((entry2) => this._entryAddress(entry2) === normalized);
    if (entry) {
      const config = getEntryTypeConfig(entry.connection.type);
      if (config.store !== "runtime") {
        const entries = this._getConfiguredEntries(true).filter((entry2) => this._entryAddress(entry2) !== normalized);
        await this._storeConfiguredEntries(entries);
      }
    }
    this._names.delete(normalized);
    this._tokens.delete(normalized);
    this._registeredEntries.delete(normalized);
    this._clearHostLabelFormatter(normalized);
    this._cancelReconnect(normalized);
    this._reconnectAttempts.delete(normalized);
    this._removeConnection(normalized);
  }
  _removeConnection(address) {
    const entry = this._entries.get(address);
    if (entry) {
      this._entries.delete(address);
      this._registeredEntries.delete(address);
      disposeEntry(entry);
      this._rejectPendingConnectionWait(address, new Error(`Connection closed: ${address}`));
      this._onDidChangeConnections.fire();
    }
  }
  notifyConnectionClosed(address) {
    const normalized = normalizeRemoteAgentHostAddress(address);
    const entry = this._entries.get(normalized);
    if (entry) {
      this._logService.info(`[RemoteAgentHost] notifyConnectionClosed: notifying protocol client for ${normalized}`);
      entry.client.notifyTransportClosed();
    } else {
      this._logService.info(`[RemoteAgentHost] notifyConnectionClosed: no entry found for ${normalized} (already removed?)`);
    }
  }
  _reconcileConnections() {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      for (const address of [...this._entries.keys()]) {
        this._cancelReconnect(address);
        this._removeConnection(address);
      }
      this._names.clear();
      this._tokens.clear();
      this._reconnectAttempts.clear();
      for (const address of [...this._labelFormatters.keys()]) {
        if (!this._registeredEntries.has(address)) {
          this._clearHostLabelFormatter(address);
        }
      }
      return;
    }
    const configuredEntries = this._getConfiguredEntries();
    const entriesWithAddress = configuredEntries.map((entry) => ({ entry, address: this._entryAddress(entry) }));
    const desired = new Set(entriesWithAddress.map((e) => e.address));
    this._logService.info(`[RemoteAgentHost] Reconciling: desired=[${[...desired].join(", ")}], current=[${[...this._entries.keys()].map((a) => `${a}(${this._entries.get(a).connected ? "connected" : "pending"})`).join(", ")}]`);
    let namesChanged = false;
    const oldNames = new Map(this._names);
    this._names.clear();
    this._tokens.clear();
    for (const [address, entry] of this._registeredEntries) {
      this._names.set(address, entry.name);
      this._tokens.set(address, entry.connectionToken);
    }
    for (const { entry, address } of entriesWithAddress) {
      this._names.set(address, entry.name);
      this._tokens.set(address, entry.connectionToken);
      this._updateHostLabelFormatter(address, entry.name);
      if (this._entries.has(address) && oldNames.get(address) !== entry.name) {
        namesChanged = true;
      }
    }
    for (const address of [...this._labelFormatters.keys()]) {
      if (!desired.has(address) && !this._registeredEntries.has(address)) {
        this._clearHostLabelFormatter(address);
      }
    }
    for (const address of [...this._entries.keys()]) {
      if (!desired.has(address) && !this._registeredEntries.has(address)) {
        this._logService.info(`[RemoteAgentHost] Disconnecting from ${address}`);
        this._cancelReconnect(address);
        this._reconnectAttempts.delete(address);
        this._removeConnection(address);
      }
    }
    for (const { entry, address } of entriesWithAddress) {
      if (!this._entries.has(address) && getEntryTypeConfig(entry.connection.type).selfConnecting) {
        this._connectTo(address, entry.connectionToken);
      }
    }
    if (namesChanged) {
      this._onDidChangeConnections.fire();
    }
  }
  _connectTo(address, connectionToken) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      return;
    }
    const existingEntry = this._entries.get(address);
    if (existingEntry) {
      this._entries.delete(address);
      existingEntry.store.dispose();
    }
    const store = new DisposableStore();
    const ahpLoggingEnabled = !!this._configurationService.getValue(AgentHostAhpJsonlLoggingSettingId);
    const transportFactory = () => this._instantiationService.createInstance(
      WebSocketClientTransport,
      address,
      connectionToken,
      ahpLoggingEnabled ? { logsHome: this._environmentService.logsHome, connectionId: address, transport: "websocket" } : void 0
    );
    const client = store.add(this._instantiationService.createInstance(RemoteAgentHostProtocolClient, address, transportFactory, void 0, void 0, this.clientInfo));
    const entry = { store, client, connected: false, status: RemoteAgentHostConnectionStatus.connecting };
    this._entries.set(address, entry);
    const isCurrentEntry = () => this._entries.get(address) === entry;
    store.add(client.onDidClose(() => {
      if (!isCurrentEntry()) {
        return;
      }
      this._logService.warn(`[RemoteAgentHost] Connection closed: ${address}`);
      entry.connected = false;
      entry.status = RemoteAgentHostConnectionStatus.disconnected;
      this._onDidChangeConnections.fire();
      this._scheduleReconnect(address, connectionToken);
    }));
    store.add(client.onDidChangeConnectionState((state) => {
      if (!isCurrentEntry()) {
        return;
      }
      switch (state) {
        case AgentHostClientState.Reconnecting:
          entry.connected = false;
          entry.status = RemoteAgentHostConnectionStatus.connecting;
          this._onDidChangeConnections.fire();
          break;
        case AgentHostClientState.Connected:
          entry.connected = true;
          entry.status = RemoteAgentHostConnectionStatus.connected;
          this._onDidChangeConnections.fire();
          break;
        case AgentHostClientState.Connecting:
        case AgentHostClientState.Incompatible:
        case AgentHostClientState.Closed:
          break;
      }
    }));
    this._logService.info(`[RemoteAgentHost] Connecting to ${address}`);
    this._onDidChangeConnections.fire();
    client.connect().then(() => {
      if (store.isDisposed) {
        return;
      }
      this._logService.info(`[RemoteAgentHost] Connected to ${address}`);
      entry.connected = true;
      entry.status = RemoteAgentHostConnectionStatus.connected;
      this._reconnectAttempts.delete(address);
      this._resolvePendingConnectionWait(address);
      this._onDidChangeConnections.fire();
    }).catch((err) => {
      if (!isCurrentEntry()) {
        return;
      }
      const incompatible = RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION]);
      if (incompatible) {
        this._logService.warn(`[RemoteAgentHost] Incompatible with ${address}: ${incompatible.kind === "incompatible" ? incompatible.message : ""}`);
        entry.status = incompatible;
        this._reconnectAttempts.delete(address);
        this._rejectPendingConnectionWait(address, err);
        this._onDidChangeConnections.fire();
        return;
      }
      this._logService.error(`[RemoteAgentHost] Failed to connect to ${address}. Verify address and connectionToken`, err);
      entry.status = RemoteAgentHostConnectionStatus.disconnected;
      this._entries.delete(address);
      entry.store.dispose();
      this._rejectPendingConnectionWait(address, err);
      this._onDidChangeConnections.fire();
      this._scheduleReconnect(address, connectionToken);
    });
  }
  /**
   * Schedule a reconnect attempt with exponential backoff.
   * Only reconnects if the address is still in the configured entries.
   */
  _scheduleReconnect(address, connectionToken) {
    if (!this._getConfiguredEntries().some((entry) => this._entryAddress(entry) === address)) {
      this._logService.info(`[RemoteAgentHost] Not reconnecting to ${address}: no longer configured`);
      return;
    }
    const attempt = (this._reconnectAttempts.get(address) ?? 0) + 1;
    this._reconnectAttempts.set(address, attempt);
    const delay = Math.min(
      RemoteAgentHostService.ReconnectInitialDelay * Math.pow(2, attempt - 1),
      RemoteAgentHostService.ReconnectMaxDelay
    );
    this._logService.info(`[RemoteAgentHost] Scheduling reconnect to ${address} in ${delay}ms (attempt ${attempt})`);
    this._cancelReconnect(address);
    const timeout = setTimeout(() => {
      this._reconnectTimeouts.delete(address);
      if (this._getConfiguredEntries().some((entry) => this._entryAddress(entry) === address)) {
        this._connectTo(address, connectionToken ?? this._tokens.get(address));
      }
    }, delay);
    this._reconnectTimeouts.set(address, timeout);
  }
  /** Cancel a pending reconnect timeout for the given address. */
  _cancelReconnect(address) {
    const timeout = this._reconnectTimeouts.get(address);
    if (timeout !== void 0) {
      clearTimeout(timeout);
      this._reconnectTimeouts.delete(address);
    }
  }
  _getConnectionInfo(address) {
    return this.connections.find((connection) => connection.address === address && RemoteAgentHostConnectionStatus.isConnected(connection.status));
  }
  _getConfiguredEntries(targetSettings = false) {
    let entries = this._getSettings(targetSettings).entries.filter(isRawRemoteAgentHostEntry).filter((entry) => !isLegacySshRawEntry(entry)).map((entry) => WEBSOCKET_ENTRY_TYPE_CONFIG.fromRaw(entry));
    for (const entry of this._getStoredSSHEntries()) {
      entries = this._upsertEntry(entries, entry);
    }
    return entries;
  }
  _upsertEntry(entries, entry) {
    const address = this._entryAddress(entry);
    const existingIndex = entries.findIndex((candidate) => this._entryAddress(candidate) === address);
    return existingIndex === -1 ? [...entries, entry] : entries.map((candidate, index) => index === existingIndex ? entry : candidate);
  }
  _getSettings(targetOnly = false) {
    const inspected = this._configurationService.inspect(RemoteAgentHostsSettingId);
    const target = inspected.userLocalValue !== void 0 ? ConfigurationTarget.USER_LOCAL : inspected.userRemoteValue !== void 0 ? ConfigurationTarget.USER_REMOTE : ConfigurationTarget.USER;
    return {
      target,
      entries: !targetOnly ? this._configurationService.getValue(RemoteAgentHostsSettingId) ?? [] : target === ConfigurationTarget.USER_LOCAL ? inspected.userLocalValue ?? [] : target === ConfigurationTarget.USER_REMOTE ? inspected.userRemoteValue ?? [] : inspected.userValue ?? []
    };
  }
  /**
   * Writes both durable projections of `entries`, which must be the full
   * merged set. Entries are keyed globally by normalized address, so a
   * replacement can move an address between stores; writing only the
   * destination would leave the source row behind for
   * {@link _getConfiguredEntries} to resurrect. Each store is left
   * untouched when its projection is unchanged.
   */
  async _storeConfiguredEntries(entries) {
    const settingsRaw = [];
    const storageRaw = [];
    for (const entry of entries) {
      const config = getEntryTypeConfig(entry.connection.type);
      if (config.store === "runtime") {
        continue;
      }
      (config.store === "storage" ? storageRaw : settingsRaw).push(config.toRaw(entry, entry.connection));
    }
    this._storeStoredSSHEntries(storageRaw);
    const settings = this._getSettings(true);
    if (JSON.stringify(settings.entries) !== JSON.stringify(settingsRaw)) {
      await this._configurationService.updateValue(RemoteAgentHostsSettingId, settingsRaw, settings.target);
    }
  }
  _getStoredSSHEntries() {
    const raw = this._storageService.get(SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isRawRemoteAgentHostEntry).filter(isLegacySshRawEntry).map((entry) => SSH_ENTRY_TYPE_CONFIG.fromRaw(entry)) : [];
    } catch {
      return [];
    }
  }
  _storeStoredSSHEntries(entries) {
    const raw = JSON.stringify(entries);
    const stored = this._storageService.get(SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY, StorageScope.APPLICATION);
    if (stored === raw) {
      return;
    }
    if (entries.length === 0) {
      if (stored !== void 0) {
        this._storageService.remove(SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY, StorageScope.APPLICATION);
      }
      return;
    }
    this._storageService.store(SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY, raw, StorageScope.APPLICATION, StorageTarget.USER);
  }
  _migrateSSHEntriesFromSetting() {
    const settings = this._getSettings(true);
    const legacyEntries = settings.entries.filter(isRawRemoteAgentHostEntry).map(parseLegacyRawEntry);
    const sshEntries = legacyEntries.filter((entry) => getEntryTypeConfig(entry.connection.type).store === "storage");
    if (sshEntries.length === 0) {
      return;
    }
    let migratedEntries = this._getStoredSSHEntries();
    for (const entry of sshEntries) {
      migratedEntries = this._upsertEntry(migratedEntries, entry);
    }
    const settingsEntries = legacyEntries.filter((entry) => getEntryTypeConfig(entry.connection.type).store === "settings");
    this._storeConfiguredEntries([...migratedEntries, ...settingsEntries]).catch((err) => {
      this._logService.error("[RemoteAgentHost] Failed to migrate SSH connection details from settings to storage", err);
    });
  }
  _getOrCreateConnectionWait(address) {
    let wait = this._pendingConnectionWaits.get(address);
    if (wait) {
      return wait;
    }
    const existingConnection = this._getConnectionInfo(address);
    if (existingConnection) {
      const immediateWait = new DeferredPromise();
      immediateWait.complete(existingConnection);
      return immediateWait;
    }
    wait = new DeferredPromise();
    this._pendingConnectionWaits.set(address, wait);
    return wait;
  }
  _resolvePendingConnectionWait(address) {
    const wait = this._pendingConnectionWaits.get(address);
    const connection = this._getConnectionInfo(address);
    if (!wait || !connection) {
      return;
    }
    this._pendingConnectionWaits.delete(address);
    void wait.complete(connection);
  }
  _rejectPendingConnectionWait(address, err) {
    const wait = this._pendingConnectionWaits.get(address);
    if (!wait) {
      return;
    }
    this._pendingConnectionWaits.delete(address);
    void wait.error(err);
  }
  /**
   * Register (or re-register) the {@link AGENT_HOST_SCHEME} label formatter
   * for the given address so that {@link ILabelService.getHostLabel} resolves
   * to the entry's human-readable name. Called when an entry is added or its
   * name changes.
   */
  _updateHostLabelFormatter(address, name) {
    this._clearHostLabelFormatter(address);
    const handle = this._labelService.registerFormatter({
      scheme: AGENT_HOST_SCHEME,
      authority: agentHostAuthority(address),
      priority: true,
      formatting: {
        ...AGENT_HOST_LABEL_FORMATTER.formatting,
        workspaceSuffix: name
      }
    });
    this._labelFormatters.set(address, handle);
  }
  _clearHostLabelFormatter(address) {
    const existing = this._labelFormatters.get(address);
    if (existing) {
      existing.dispose();
      this._labelFormatters.delete(address);
    }
  }
  dispose() {
    for (const timeout of this._reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this._reconnectTimeouts.clear();
    this._reconnectAttempts.clear();
    for (const [address, wait] of this._pendingConnectionWaits) {
      void wait.error(new Error(`Remote agent host service disposed before connecting to ${address}`));
    }
    this._pendingConnectionWaits.clear();
    for (const entry of this._entries.values()) {
      disposeEntry(entry);
    }
    this._entries.clear();
    for (const handle of this._labelFormatters.values()) {
      handle.dispose();
    }
    this._labelFormatters.clear();
    super.dispose();
  }
};
RemoteAgentHostService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IStorageService)
], RemoteAgentHostService);
let AgentsWindowRemoteAgentHostService = class extends RemoteAgentHostService {
  get clientInfo() {
    return agentsWindowAgentHostClientInfo;
  }
  constructor(configurationService, instantiationService, logService, labelService, environmentService, storageService) {
    super(configurationService, instantiationService, logService, labelService, environmentService, storageService);
  }
};
AgentsWindowRemoteAgentHostService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IStorageService)
], AgentsWindowRemoteAgentHostService);
export {
  AgentsWindowRemoteAgentHostService,
  RemoteAgentHostService
};
