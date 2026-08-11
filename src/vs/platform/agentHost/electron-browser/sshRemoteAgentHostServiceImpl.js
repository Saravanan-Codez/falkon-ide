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
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Codicon } from "../../../base/common/codicons.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { localize } from "../../../nls.js";
import { ILogService } from "../../log/common/log.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IDialogService } from "../../dialogs/common/dialogs.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { INotificationService, Severity } from "../../notification/common/notification.js";
import { toAction } from "../../../base/common/actions.js";
import { IProductService } from "../../product/common/productService.js";
import { ISharedProcessService } from "../../ipc/electron-browser/services.js";
import { ProxyChannel } from "../../../base/parts/ipc/common/ipc.js";
import { IRemoteAgentHostService, RemoteAgentHostConnectionStatus, RemoteAgentHostEntryType, RemoteAgentHostsEnabledSettingId } from "../common/remoteAgentHostService.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IQuickInputService } from "../../quickinput/common/quickInput.js";
import { AhpJsonlLogger } from "../common/ahpJsonlLogger.js";
import { AgentHostAhpJsonlLoggingSettingId } from "../common/agentService.js";
import { IRemoteAgentHostLocationPreferenceService } from "../common/remoteAgentHostLocationPreference.js";
import { promptRemoteAgentHostLocationPreference } from "../common/remoteAgentHostLocationPreferenceDialog.js";
import { SSHRelayTransport } from "./sshRelayTransport.js";
import { RemoteAgentHostProtocolClient } from "../browser/remoteAgentHostProtocolClient.js";
import { agentsWindowAgentHostClientInfo } from "../common/agentHostClientInfo.js";
import { PROTOCOL_VERSION } from "../common/state/protocol/version/registry.js";
import {
  SSH_REMOTE_AGENT_HOST_CHANNEL,
  computeSSHConnectionKey
} from "../common/sshRemoteAgentHost.js";
import { ISSHHostKeyTrustService } from "../common/sshHostKeyTrust.js";
import { decideHostKeyTrust } from "../common/sshHostKeyPolicy.js";
function describeHostKeyType(keyType) {
  switch (keyType) {
    case "ssh-ed25519":
      return "ED25519";
    case "ssh-rsa":
    case "rsa-sha2-256":
    case "rsa-sha2-512":
      return "RSA";
    case "ssh-dss":
      return "DSA";
    case "ecdsa-sha2-nistp256":
    case "ecdsa-sha2-nistp384":
    case "ecdsa-sha2-nistp521":
      return "ECDSA";
    default:
      return keyType;
  }
}
const ISSHRelayClientFactory = createDecorator("sshRelayClientFactory");
let SSHRelayClientFactory = class {
  constructor(_instantiationService, _configurationService, _environmentService) {
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
  }
  createClient(mainService, connectionId, address) {
    const ahpLoggingEnabled = !!this._configurationService.getValue(AgentHostAhpJsonlLoggingSettingId);
    const logger = ahpLoggingEnabled ? this._instantiationService.createInstance(
      AhpJsonlLogger,
      { logsHome: this._environmentService.logsHome, connectionId, transport: "ssh" }
    ) : void 0;
    const transport = this._instantiationService.createInstance(SSHRelayTransport, connectionId, mainService, logger);
    return this._instantiationService.createInstance(RemoteAgentHostProtocolClient, address, transport, void 0, void 0, agentsWindowAgentHostClientInfo);
  }
};
SSHRelayClientFactory = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEnvironmentService)
], SSHRelayClientFactory);
let SSHRemoteAgentHostService = class extends Disposable {
  constructor(sharedProcessService, _remoteAgentHostService, _logService, _configurationService, _relayClientFactory, _quickInputService, _notificationService, _locationPreferenceService, _dialogService, _productService, _hostKeyTrustService) {
    super();
    this._remoteAgentHostService = _remoteAgentHostService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._relayClientFactory = _relayClientFactory;
    this._quickInputService = _quickInputService;
    this._notificationService = _notificationService;
    this._locationPreferenceService = _locationPreferenceService;
    this._dialogService = _dialogService;
    this._productService = _productService;
    this._hostKeyTrustService = _hostKeyTrustService;
    this._onDidChangeConnections = this._register(new Emitter());
    this.onDidChangeConnections = this._onDidChangeConnections.event;
    this._connections = /* @__PURE__ */ new Map();
    /**
     * The server type ('editor' or 'standalone') of the last successfully
     * established connection for a given (stable) connection address.
     * Deliberately NOT cleared when a connection closes (see
     * `onDidCloseConnection` below) — it needs to survive disconnect cleanup
     * so a later automatic reconnect can detect an editor→standalone
     * failover and surface a one-time notification. Only ever updated after
     * a connection has fully and successfully registered.
     */
    this._lastConnectedServerTypeByAddress = /* @__PURE__ */ new Map();
    /**
     * The host key that authenticated the most recent session for a given
     * connection key. Used to decide whether an `UpdateHostKeys` announcement
     * may be trusted (see {@link _handleAnnouncedHostKeys}). Bounded by the
     * number of distinct SSH hosts, and each entry is overwritten on reconnect.
     */
    this._sessionHostKeys = /* @__PURE__ */ new Map();
    this._mainService = ProxyChannel.toService(
      sharedProcessService.getChannel(SSH_REMOTE_AGENT_HOST_CHANNEL)
    );
    this.onDidReportConnectProgress = this._mainService.onDidReportConnectProgress;
    this._register(this._mainService.onDidCloseConnection((connectionId) => {
      this._logService.info(`[SSHRemoteAgentHost] onDidCloseConnection: connectionId=${connectionId}`);
      const handle = this._connections.get(connectionId);
      if (handle) {
        this._logService.info(`[SSHRemoteAgentHost] onDidCloseConnection: found handle for ${connectionId}, cleaning up`);
        this._connections.delete(connectionId);
        handle.fireClose();
        handle.dispose();
        this._onDidChangeConnections.fire();
        this._logService.info(`[SSHRemoteAgentHost] onDidCloseConnection: notifying protocol client for ${handle.localAddress}`);
        this._remoteAgentHostService.notifyConnectionClosed(handle.localAddress);
      } else {
        this._logService.info(`[SSHRemoteAgentHost] onDidCloseConnection: no renderer-side handle for ${connectionId} (already cleaned up?)`);
      }
    }));
    this._register(this._mainService.onDidRequestKeyboardInteractive((request) => {
      this._handleKeyboardInteractiveRequest(request);
    }));
    this._register(this._mainService.onDidRequestEndpointSelection((request) => {
      this._handleEndpointSelectionRequest(request);
    }));
    this._register(this._mainService.onDidRequestHostKeyVerification((request) => {
      this._trackHostKeyVerification(this._handleHostKeyVerificationRequest(request));
    }));
    this._register(this._mainService.onDidAnnounceHostKeys((announcement) => {
      this._handleAnnouncedHostKeys(announcement);
    }));
  }
  get connections() {
    return [...this._connections.values()];
  }
  async connect(config) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const augmentedConfig = this._augmentConfig(config);
    this._logService.info(`[SSHRemoteAgentHost] Connecting to ${config.host}`);
    const result = await this._mainService.connect(augmentedConfig);
    this._logService.trace(`[SSHRemoteAgentHost] SSH tunnel established, connectionId=${result.connectionId}`);
    return this._setupConnection(result, config.userInitiated ?? true);
  }
  async disconnect(host) {
    await this._mainService.disconnect(host);
  }
  async listSSHConfigHosts() {
    return this._mainService.listSSHConfigHosts();
  }
  async ensureUserSSHConfig() {
    return this._mainService.ensureUserSSHConfig();
  }
  async listSSHConfigFiles() {
    return this._mainService.listSSHConfigFiles();
  }
  async resolveSSHConfig(host) {
    return this._mainService.resolveSSHConfig(host);
  }
  async reconnect(sshConfigHost, name, userInitiated) {
    if (!this._configurationService.getValue(RemoteAgentHostsEnabledSettingId)) {
      throw new Error("Remote agent host connections are not enabled.");
    }
    const commandOverride = this._getRemoteAgentHostCommand();
    const agentForward = this._isSSHAgentForwardingEnabled();
    const preferredAgentLocation = this._locationPreferenceService.getPreference(computeSSHConnectionKey({ sshConfigHost }));
    this._logService.info(`[SSHRemoteAgentHost] Reconnecting to ${sshConfigHost} (userInitiated=${userInitiated ?? true})`);
    const result = await this._mainService.reconnect(sshConfigHost, name, commandOverride, agentForward, userInitiated, preferredAgentLocation);
    return this._setupConnection(result, userInitiated ?? true);
  }
  /**
   * Build the renderer-side handle, do the protocol handshake, and register
   * with IRemoteAgentHostService. Any failure after the shared-process tunnel
   * was established tears it back down so we don't leak it.
   */
  async _setupConnection(result, userInitiated) {
    const existing = this._connections.get(result.connectionId);
    if (existing) {
      if (this._remoteAgentHostService.getConnection(result.address)) {
        this._logService.trace("[SSHRemoteAgentHost] Returning existing connection handle");
        return existing;
      }
      this._logService.info(`[SSHRemoteAgentHost] Replacing stale connection handle for ${result.address}`);
      this._connections.delete(result.connectionId);
      existing.fireClose();
      existing.dispose();
      this._onDidChangeConnections.fire();
    }
    let registeredHandle = false;
    const protocolClient = this._createRelayClient(result);
    let status = RemoteAgentHostConnectionStatus.connected;
    let connectError;
    try {
      await protocolClient.connect();
      this._logService.trace("[SSHRemoteAgentHost] Protocol handshake completed");
    } catch (err) {
      const incompatible = RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION]);
      if (!RemoteAgentHostConnectionStatus.isIncompatible(incompatible)) {
        this._logService.error("[SSHRemoteAgentHost] Connection setup failed", err);
        protocolClient.dispose();
        this._mainService.disconnect(result.connectionId).catch(() => {
        });
        throw err;
      }
      this._logService.warn(`[SSHRemoteAgentHost] Incompatible with ${result.address}: ${incompatible.message}`);
      status = incompatible;
      connectError = err;
    }
    const handle = new SSHAgentHostConnectionHandle(
      result.config,
      result.address,
      result.name,
      result.serverType,
      result.instanceId,
      result.primary,
      result.lifecycle,
      () => this._mainService.disconnect(result.connectionId)
    );
    try {
      this._connections.set(result.connectionId, handle);
      registeredHandle = true;
      this._onDidChangeConnections.fire();
      await this._remoteAgentHostService.addManagedConnection({
        name: result.name,
        connectionToken: result.connectionToken,
        connection: {
          type: RemoteAgentHostEntryType.SSH,
          address: result.address,
          sshConfigHost: result.sshConfigHost,
          hostName: result.config.host,
          user: result.config.username || void 0,
          port: result.config.port
        }
      }, protocolClient, this._createTransportDisposable(result.connectionId, handle), status);
    } catch (err) {
      this._logService.error("[SSHRemoteAgentHost] Connection setup failed", err);
      if (registeredHandle && this._connections.get(result.connectionId) === handle) {
        this._connections.delete(result.connectionId);
        this._onDidChangeConnections.fire();
      }
      handle.dispose();
      protocolClient.dispose();
      this._mainService.disconnect(result.connectionId).catch(() => {
      });
      throw err;
    }
    if (connectError) {
      throw connectError;
    }
    this._recordEndpointSelection(result, userInitiated);
    return handle;
  }
  /**
   * Update the last-known server type for {@link result.address}, and — if
   * this was an automatic/background reconnect (`userInitiated === false`)
   * that moved this stable remote address from a previously connected
   * `editor`-owned endpoint to a newly selected `standalone` endpoint —
   * surface a single informational notification. Never fires for the
   * initial connect to a remote (no prior recorded server type), a
   * user-initiated reconnect, or a same-kind transition
   * (editor→editor/standalone→standalone).
   */
  _recordEndpointSelection(result, userInitiated) {
    if (!result.serverType) {
      return;
    }
    const previousServerType = this._lastConnectedServerTypeByAddress.get(result.address);
    const isUnattendedFailoverFromEditor = userInitiated === false && previousServerType === "editor" && result.serverType === "standalone";
    this._lastConnectedServerTypeByAddress.set(result.address, result.serverType);
    if (isUnattendedFailoverFromEditor) {
      this._notificationService.info(localize(
        "sshEditorAgentHostReplacedByStandalone",
        "The editor agent host exited. Reconnected to a dedicated agent host. In-progress work may have been interrupted."
      ));
    }
  }
  /**
   * Build a disposable that the {@link IRemoteAgentHostService} will own
   * for the lifetime of this entry. When the entry is removed (either by
   * the user via "Remove Remote" or by config reconciliation), this runs
   * and tears down the renderer-side handle and the shared-process SSH
   * tunnel together. Without this hookup, the SSH tunnel would leak and
   * the next `connect()` would silently reuse it.
   */
  _createTransportDisposable(connectionId, handle) {
    return toDisposable(() => {
      if (this._connections.get(connectionId) === handle) {
        this._connections.delete(connectionId);
        this._onDidChangeConnections.fire();
      }
      handle.fireClose();
      handle.dispose();
      this._mainService.disconnect(connectionId).catch(() => {
      });
    });
  }
  _createRelayClient(result) {
    return this._relayClientFactory.createClient(this._mainService, result.connectionId, result.address);
  }
  _augmentConfig(config) {
    const result = { ...config };
    const commandOverride = this._getRemoteAgentHostCommand();
    if (commandOverride) {
      result.remoteAgentHostCommand = commandOverride;
    }
    if (this._isSSHAgentForwardingEnabled() && config.agentForward) {
      result.agentForward = true;
    }
    const preferredAgentLocation = this._locationPreferenceService.getPreference(computeSSHConnectionKey(config));
    if (preferredAgentLocation) {
      result.preferredAgentLocation = preferredAgentLocation;
    }
    return result;
  }
  _getRemoteAgentHostCommand() {
    return this._configurationService.getValue("chat.sshRemoteAgentHostCommand") || void 0;
  }
  _isSSHAgentForwardingEnabled() {
    return this._configurationService.getValue("chat.agentHost.forwardSSHAgent") || void 0;
  }
  /**
   * Show a quick-input prompt for each entry in a keyboard-interactive
   * challenge and forward the responses (or cancel) back to the main service.
   *
   * The renderer collects all prompts up front before responding so the
   * server gets a single batched answer set, matching how OpenSSH presents
   * keyboard-interactive challenges.
   */
  async _handleKeyboardInteractiveRequest(request) {
    this._logService.info(`[SSHRemoteAgentHost] Keyboard-interactive prompt for ${request.displayHost} (${request.prompts.length} prompt(s))`);
    const cts = new CancellationTokenSource();
    const cancelListener = this._mainService.onDidCancelKeyboardInteractive((requestId) => {
      if (requestId === request.requestId) {
        cts.cancel();
      }
    });
    try {
      if (request.prompts.length === 0) {
        await this._mainService.respondKeyboardInteractive(request.requestId, []);
        return;
      }
      const responses = [];
      for (let i = 0; i < request.prompts.length; i++) {
        if (cts.token.isCancellationRequested) {
          return;
        }
        const prompt = request.prompts[i];
        const cleanedPrompt = prompt.prompt.replace(/[\s:]+$/, "");
        const title = request.prompts.length > 1 ? `${request.displayHost} (${i + 1}/${request.prompts.length})` : request.displayHost;
        const value = await this._quickInputService.input({
          title,
          prompt: cleanedPrompt || localize("sshKbiDefaultPrompt", "Authentication required for {0}@{1}", request.username, request.displayHost),
          password: !prompt.echo,
          ignoreFocusLost: true
        }, cts.token);
        if (cts.token.isCancellationRequested) {
          return;
        }
        if (value === void 0) {
          await this._mainService.respondKeyboardInteractive(request.requestId, void 0);
          return;
        }
        responses.push(value);
      }
      if (cts.token.isCancellationRequested) {
        return;
      }
      await this._mainService.respondKeyboardInteractive(request.requestId, responses);
    } catch (err) {
      this._logService.error("[SSHRemoteAgentHost] Failed handling keyboard-interactive prompt", err);
      try {
        await this._mainService.respondKeyboardInteractive(request.requestId, void 0);
      } catch {
      }
    } finally {
      cancelListener.dispose();
      cts.dispose();
    }
  }
  /**
   * Decide whether to trust a server's host key, and tell the shared process.
   *
   * Policy lives in {@link decideHostKeyTrust}; this method owns the UI and
   * the storage writes. Every path must respond exactly once — the SSH
   * handshake is suspended until it hears back.
   */
  /**
   * Hook for observing when a host key verification has fully settled.
   * Overridden by tests so they can await the real operation instead of
   * sleeping for a fixed interval, which is load-dependent and flaky —
   * particularly for the cases that assert *nothing* happened.
   */
  _trackHostKeyVerification(handled) {
    void handled;
  }
  async _handleHostKeyVerificationRequest(request) {
    this._logService.info(`[SSHRemoteAgentHost] Host key verification for ${request.displayHost}: ${request.keyType} ${request.fingerprint} (known_hosts: ${request.knownHostsMatch})`);
    const cts = new CancellationTokenSource();
    const cancelListener = this._mainService.onDidCancelHostKeyVerification((requestId) => {
      if (requestId === request.requestId) {
        cts.cancel();
      }
    });
    try {
      const decision = decideHostKeyTrust(request, this._hostKeyTrustService.getTrustedKeys(request.host, request.port));
      this._logService.info(`[SSHRemoteAgentHost] Host key decision for ${request.displayHost}: ${decision.kind} (${decision.reason})`);
      let trusted;
      switch (decision.kind) {
        case "trust":
          if (decision.persist) {
            this._trustHostKey(request);
          }
          trusted = true;
          break;
        case "deny":
          this._reportHostKeyDenied(request, decision);
          trusted = false;
          break;
        case "prompt": {
          trusted = await this._promptForHostKey(request, decision.reason, cts.token);
          if (cts.token.isCancellationRequested) {
            return;
          }
          if (trusted) {
            this._trustHostKey(request);
          }
          break;
        }
      }
      if (cts.token.isCancellationRequested) {
        return;
      }
      this._sessionHostKeys.set(request.connectionKey, { keyType: request.keyType, fingerprint: request.fingerprint });
      await this._mainService.respondHostKeyVerification(request.requestId, trusted);
    } catch (err) {
      this._logService.error("[SSHRemoteAgentHost] Failed handling host key verification", err);
      try {
        await this._mainService.respondHostKeyVerification(request.requestId, false);
      } catch {
      }
    } finally {
      cancelListener.dispose();
      cts.dispose();
    }
  }
  _trustHostKey(request) {
    this._hostKeyTrustService.trustHostKey(request.host, request.port, {
      keyType: request.keyType,
      fingerprint: request.fingerprint,
      addedAt: Date.now(),
      ...request.displayHost !== request.host ? { alias: request.displayHost } : void 0
    });
  }
  /**
   * Ask the user whether to trust an unrecognized host key, echoing OpenSSH's
   * wording so it is recognizable to anyone who has used `ssh` directly.
   * Cancel is the default so the safe answer is the one you get by dismissing.
   *
   * Uses a custom dialog so the prompt can be dismissed programmatically when
   * the connection dies underneath it — a native dialog cannot be, and would
   * strand the user with a question about a connection that no longer exists.
   * Answering a stale prompt was always safe (the caller re-checks
   * cancellation before acting), but leaving it on screen is confusing.
   */
  async _promptForHostKey(request, reason, token) {
    if (token.isCancellationRequested) {
      return false;
    }
    const detail = reason === "ca-only" ? localize(
      "sshHostKeyCaOnlyDetail",
      "{0} key fingerprint is {1}.\n\nThis host is configured to use a certificate authority, but certificate-based host keys cannot be verified here, so this key cannot be checked against it.",
      describeHostKeyType(request.keyType),
      request.fingerprint
    ) : localize(
      "sshHostKeyUnknownDetail",
      "{0} key fingerprint is {1}.\n\nVerify this fingerprint matches the host before continuing.",
      describeHostKeyType(request.keyType),
      request.fingerprint
    );
    const { confirmed } = await this._dialogService.confirm({
      type: "warning",
      message: localize("sshHostKeyUnknownMessage", "The authenticity of host '{0}' can't be established.", request.displayHost),
      detail,
      primaryButton: localize("sshHostKeyConnect", "&&Connect"),
      cancelButton: localize("sshHostKeyCancel", "Cancel"),
      custom: { icon: Codicon.shield },
      // Cancellation resolves the dialog as if Cancel was pressed, which
      // is also the answer we want for a connection that is already gone.
      token
    });
    return confirmed;
  }
  /**
   * Explain a refusal. A changed or revoked key gets an error notification
   * with no "trust anyway" affordance — recovering requires explicitly
   * forgetting the host, so a possible impersonation cannot be dismissed
   * with a single reflexive click.
   */
  _reportHostKeyDenied(request, denial) {
    if (denial.reason === "not-user-initiated") {
      this._logService.warn(`[SSHRemoteAgentHost] Declining unknown host key for ${request.displayHost} during a background reconnect; connect manually to review it.`);
      return;
    }
    if (denial.reason === "strict-yes") {
      this._notificationService.error(localize(
        "sshHostKeyStrictUnknown",
        `Can't connect to '{0}': its host key is not known, and StrictHostKeyChecking is set to "yes" in your SSH configuration.`,
        request.displayHost
      ));
      return;
    }
    if (denial.reason !== "mismatch") {
      this._notificationService.error(localize(
        "sshHostKeyRevoked",
        "Host key verification failed for '{0}'. This host's {1} key has been marked as revoked in your known_hosts file. Remove the @revoked line from known_hosts if this key should be trusted again.",
        request.displayHost,
        describeHostKeyType(request.keyType)
      ));
      return;
    }
    if (denial.source === "known-hosts") {
      this._notificationService.error(localize(
        "sshHostKeyChangedKnownHosts",
        "Host key verification failed for '{0}'. Its {1} host key does not match the entry in your known_hosts file, which could mean someone is impersonating the host \u2014 or that the host was legitimately rebuilt. Received {2}. Update or remove the known_hosts entry if this change was expected.",
        request.displayHost,
        describeHostKeyType(request.keyType),
        request.fingerprint
      ));
      return;
    }
    this._notificationService.notify({
      severity: Severity.Error,
      message: localize(
        "sshHostKeyChanged",
        "Host key verification failed for '{0}'. Its {1} host key has changed, which could mean someone is impersonating the host \u2014 or that the host was legitimately rebuilt. Received {2}.",
        request.displayHost,
        describeHostKeyType(request.keyType),
        request.fingerprint
      ),
      actions: {
        primary: [toAction({
          id: "sshHostKey.forget",
          label: localize("sshHostKeyForgetAction", "Forget Saved Host Key"),
          run: () => this._hostKeyTrustService.forgetHost(request.host, request.port)
        })]
      }
    });
  }
  /**
   * Persist host keys the server proved it owns, so a legitimate key
   * rotation is invisible to the user instead of a hard failure on the next
   * connect.
   *
   * ssh2 verifies the `hostkeys-prove` signatures before surfacing these,
   * but that only proves the keys belong to *whoever we are currently
   * talking to* — it says nothing about whether that party is the real host.
   * So we additionally require that the host key which authenticated this
   * very session is itself currently trusted. This mirrors OpenSSH, whose
   * `UpdateHostKeys` documentation states additional host keys are accepted
   * only "if the key used to authenticate the host was already trusted or
   * explicitly accepted by the user".
   *
   * Without that check, a session accepted through
   * `StrictHostKeyChecking=no` — where we deliberately did not verify
   * anything — could announce keys that overwrite the user's genuine stored
   * key, leaving an impostor's key trusted once strict checking is restored.
   */
  _handleAnnouncedHostKeys(announcement) {
    const existing = this._hostKeyTrustService.getTrustedKeys(announcement.host, announcement.port);
    if (!existing.length) {
      return;
    }
    const sessionKey = this._sessionHostKeys.get(announcement.connectionKey);
    if (!sessionKey || !existing.some((e) => e.keyType === sessionKey.keyType && e.fingerprint === sessionKey.fingerprint)) {
      this._logService.warn(`[SSHRemoteAgentHost] Ignoring announced host keys for ${announcement.host}: the key that authenticated this session is not itself trusted`);
      return;
    }
    for (const key of announcement.keys) {
      if (!existing.some((e) => e.keyType === key.keyType && e.fingerprint === key.fingerprint)) {
        this._logService.info(`[SSHRemoteAgentHost] Learned rotated ${key.keyType} host key for ${announcement.host}: ${key.fingerprint}`);
        this._hostKeyTrustService.trustHostKey(announcement.host, announcement.port, {
          keyType: key.keyType,
          fingerprint: key.fingerprint,
          addedAt: Date.now()
        });
      }
    }
  }
  /**
   * Resolve which live remote agent host endpoint (or "start a new one")
   * to connect to and forward the choice (or cancellation) back to the
   * main service. Consults the stored per-host {@link IRemoteAgentHostLocationPreferenceService}
   * preference for `request.connectionKey` first; only opens the shared
   * preference modal ({@link promptRemoteAgentHostLocationPreference})
   * when no preference is stored and an `editor`-owned endpoint is live,
   * since otherwise there's no ambiguity worth interrupting the user for.
   */
  async _handleEndpointSelectionRequest(request) {
    this._logService.info(`[SSHRemoteAgentHost] Endpoint selection requested for ${request.displayHost} (${request.candidates.length} candidate(s))`);
    const cts = new CancellationTokenSource();
    const cancelListener = this._mainService.onDidCancelEndpointSelection((requestId) => {
      if (requestId === request.requestId) {
        cts.cancel();
      }
    });
    try {
      const selection = await this._resolveEndpointSelection(request, cts.token);
      await this._mainService.respondEndpointSelection(request.requestId, selection);
    } catch (err) {
      this._logService.error("[SSHRemoteAgentHost] Failed handling endpoint selection prompt", err);
      try {
        await this._mainService.respondEndpointSelection(request.requestId, void 0);
      } catch {
      }
    } finally {
      cancelListener.dispose();
      cts.dispose();
    }
  }
  /**
   * Apply the preference-resolution rules described on
   * {@link _handleEndpointSelectionRequest}. Returns `undefined` only when
   * the shared preference modal was shown and the user cancelled it.
   */
  async _resolveEndpointSelection(request, token) {
    const hasLiveEditor = request.candidates.some((candidate) => candidate.type === "editor");
    const preference = this._locationPreferenceService.getPreference(request.connectionKey);
    if (preference === "editor") {
      return hasLiveEditor ? this._deterministicSelection(request.candidates, "editor") : this._dedicatedSelection(request.candidates);
    }
    if (preference === "dedicated") {
      return this._dedicatedSelection(request.candidates);
    }
    if (!hasLiveEditor) {
      return this._dedicatedSelection(request.candidates);
    }
    const chosen = await promptRemoteAgentHostLocationPreference(this._dialogService, request.displayHost, this._productService.nameShort, void 0, token);
    if (token.isCancellationRequested || !chosen) {
      return void 0;
    }
    this._locationPreferenceService.setPreference(request.connectionKey, chosen);
    return chosen === "editor" ? this._deterministicSelection(request.candidates, "editor") : this._dedicatedSelection(request.candidates);
  }
  /** Reuse a live standalone endpoint if one exists, or spawn a new dedicated one. */
  _dedicatedSelection(candidates) {
    return this._deterministicSelection(candidates, "standalone") ?? { kind: "spawn" };
  }
  /**
   * Pick the candidate of `type` deterministically when several are live,
   * by sorting on `instanceId` so every renderer resolving the same
   * request (e.g. multiple open editor windows) converges on the same
   * choice without needing to coordinate.
   */
  _deterministicSelection(candidates, type) {
    const matching = candidates.filter((candidate) => candidate.type === type);
    if (matching.length === 0) {
      return void 0;
    }
    const [chosen] = matching.slice().sort((a, b) => a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0);
    return { kind: "candidate", type: chosen.type, pid: chosen.pid, instanceId: chosen.instanceId };
  }
};
SSHRemoteAgentHostService = __decorateClass([
  __decorateParam(0, ISharedProcessService),
  __decorateParam(1, IRemoteAgentHostService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ISSHRelayClientFactory),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IRemoteAgentHostLocationPreferenceService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IProductService),
  __decorateParam(10, ISSHHostKeyTrustService)
], SSHRemoteAgentHostService);
class SSHAgentHostConnectionHandle extends Disposable {
  constructor(config, localAddress, name, serverType, instanceId, primary, lifecycle, disconnectFn) {
    super();
    this.config = config;
    this.localAddress = localAddress;
    this.name = name;
    this.serverType = serverType;
    this.instanceId = instanceId;
    this.primary = primary;
    this.lifecycle = lifecycle;
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
  ISSHRelayClientFactory,
  SSHRelayClientFactory,
  SSHRemoteAgentHostService,
  describeHostKeyType
};
