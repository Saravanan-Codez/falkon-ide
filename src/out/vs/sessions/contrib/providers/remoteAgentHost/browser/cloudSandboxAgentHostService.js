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
import { CancellationError } from "../../../../../base/common/errors.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { timeout } from "../../../../../base/common/async.js";
import { RemoteAgentHostProtocolClient } from "../../../../../platform/agentHost/browser/remoteAgentHostProtocolClient.js";
import { editorWindowAgentHostClientInfo } from "../../../../../platform/agentHost/common/agentHostClientInfo.js";
import { WebPubSubRelayTransport } from "../../../../../platform/agentHost/browser/webPubSubRelayTransport.js";
import { GITHUB_COPILOT_PROTECTED_RESOURCE } from "../../../../../platform/agentHost/common/agentService.js";
import {
  buildWpsUrl,
  cloudSandboxAddress,
  CloudSandboxEnabledSettingId,
  ICloudSandboxApiService,
  isCloudSandboxSealedToken
} from "../../../../../platform/agentHost/common/cloudSandboxAgentHost.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus, RemoteAgentHostEntryType, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { PROTOCOL_VERSION } from "../../../../../platform/agentHost/common/state/protocol/version/registry.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { CloudSandboxCredentialRefresher, MAX_WAKING_DELAY_MS } from "./cloudSandboxCredentialRefresh.js";
const LOG_PREFIX = "[CloudSandboxAgentHost]";
const MAX_WAKING_RETRIES = 20;
let CloudSandboxAgentHostService = class extends Disposable {
  constructor(_remoteAgentHostService, _apiService, _configurationService, _instantiationService, _logService) {
    super();
    this._remoteAgentHostService = _remoteAgentHostService;
    this._apiService = _apiService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    /** Credential-refresh scheduler per connection address, disposed when the connection is gone. */
    this._managed = this._register(new DisposableMap());
    /** Current Web PubSub credentials per connection address, including the sealed GitHub token. */
    this._creds = /* @__PURE__ */ new Map();
    this._register(this._remoteAgentHostService.onDidChangeConnections(() => {
      for (const address of [...this._managed.keys()]) {
        if (!this._remoteAgentHostService.connections.some((c) => c.address === address)) {
          this._managed.deleteAndDispose(address);
          this._creds.delete(address);
        }
      }
    }));
  }
  getSealedGitHubToken(environmentId) {
    return this._creds.get(cloudSandboxAddress(environmentId))?.token.encrypted_github_token;
  }
  async connect(options, token) {
    if (!this._configurationService.getValue(CloudSandboxEnabledSettingId)) {
      throw new Error("Copilot cloud sandbox connections are not enabled.");
    }
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const address = cloudSandboxAddress(options.environmentId);
    const existing = this._remoteAgentHostService.getConnection(address);
    if (existing) {
      this._logService.trace(`${LOG_PREFIX} Reusing existing connection for ${address}`);
      return address;
    }
    this._logService.info(`${LOG_PREFIX} Connecting to sandbox environment ${options.environmentId}`);
    const clientToken = await this._mintWithWaking(options, token);
    return await this._establish(options, address, clientToken, token);
  }
  /**
   * Open the relay with an already-minted token, drive the AHP handshake, and register the
   * connection.
   */
  async _establish(options, address, clientToken, token) {
    const creds = { token: clientToken };
    const transportFactory = () => new WebPubSubRelayTransport({
      url: buildWpsUrl(creds.token),
      toHostGroup: creds.token.groups.to_host,
      joinGroups: [creds.token.groups.broadcast, creds.token.groups.to_client],
      groupValidation: { expected: { cid: creds.token.client_id } }
    });
    const protocolClient = this._instantiationService.createInstance(
      RemoteAgentHostProtocolClient,
      address,
      transportFactory,
      void 0,
      clientToken.client_id,
      editorWindowAgentHostClientInfo
    );
    let status = RemoteAgentHostConnectionStatus.connected;
    let connectError;
    try {
      await protocolClient.connect();
      this._logService.info(`${LOG_PREFIX} Protocol handshake completed with ${address}`);
    } catch (err) {
      const incompatible = RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION]);
      if (!RemoteAgentHostConnectionStatus.isIncompatible(incompatible)) {
        protocolClient.dispose();
        throw err;
      }
      this._logService.warn(`${LOG_PREFIX} Incompatible with ${address}: ${incompatible.message}`);
      status = incompatible;
      connectError = err;
    }
    if (!connectError && clientToken.encrypted_github_token) {
      if (!isCloudSandboxSealedToken(clientToken.encrypted_github_token)) {
        this._logService.error(`${LOG_PREFIX} Refusing to forward a non-sealed token to ${address}; Mission Control did not return a copilot-sealed envelope.`);
      } else {
        try {
          await protocolClient.authenticate({
            resource: GITHUB_COPILOT_PROTECTED_RESOURCE.resource,
            token: clientToken.encrypted_github_token
          });
        } catch (err) {
          this._logService.warn(`${LOG_PREFIX} Sealed-token authenticate failed for ${address}`, err);
        }
      }
    }
    try {
      await this._remoteAgentHostService.addManagedConnection({
        name: options.name,
        connection: {
          type: RemoteAgentHostEntryType.CloudSandbox,
          address,
          environmentId: options.environmentId,
          sessionId: options.sessionId
        }
      }, protocolClient, void 0, status);
    } catch (err) {
      protocolClient.dispose();
      this._logService.error(`${LOG_PREFIX} addManagedConnection failed`, err);
      throw err;
    }
    const store = new DisposableStore();
    store.add(this._instantiationService.createInstance(
      CloudSandboxCredentialRefresher,
      address,
      { environmentId: options.environmentId, sessionId: options.sessionId },
      clientToken.client_id,
      creds
    ));
    this._managed.set(address, store);
    this._creds.set(address, creds);
    if (connectError) {
      throw connectError;
    }
    return address;
  }
  /** Mint client creds, retrying (bounded) while the environment is waking. */
  async _mintWithWaking(options, token) {
    for (let attempt = 0; attempt < MAX_WAKING_RETRIES; attempt++) {
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      const result = await this._apiService.connect({ environmentId: options.environmentId, sessionId: options.sessionId }, token);
      if (result.kind === "token") {
        return result.token;
      }
      const delayMs = Math.min(result.waking.retryAfterSeconds * 1e3, MAX_WAKING_DELAY_MS);
      this._logService.info(`${LOG_PREFIX} Environment ${options.environmentId} waking; retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_WAKING_RETRIES})`);
      await timeout(delayMs, token);
    }
    throw new Error(`Timed out waiting for sandbox environment ${options.environmentId} to wake.`);
  }
};
CloudSandboxAgentHostService = __decorateClass([
  __decorateParam(0, IRemoteAgentHostService),
  __decorateParam(1, ICloudSandboxApiService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService)
], CloudSandboxAgentHostService);
export {
  CloudSandboxAgentHostService
};
