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
import { DeferredPromise, TimeoutTimer } from "../../../base/common/async.js";
import { CancellationError } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { hasKey } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { ILogService } from "../../log/common/log.js";
import { FileSystemProviderErrorCode, toFileSystemProviderErrorCode } from "../../files/common/files.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { AgentSession } from "../common/agentService.js";
import { AMBIENT_AGENT_HOST_AUTHORITY } from "../common/agentHostConnectionsService.js";
import { createRemoteWatchHandle } from "../common/agentHostFileSystemProvider.js";
import { AgentSubscriptionManager } from "../common/state/agentSubscription.js";
import { agentHostAuthority, fromAgentHostUri, toAgentHostUri } from "../common/agentHostUri.js";
import { AgentHostResourcePermissionError, IAgentHostResourceService, LOCAL_AGENT_HOST_RESOURCE_IDENTITY } from "../common/agentHostResourceService.js";
import { ActionType } from "../common/state/sessionActions.js";
import { MessageAttachmentKind, ROOT_STATE_URI, isAhpRootChannel } from "../common/state/sessionState.js";
import { SUPPORTED_PROTOCOL_VERSIONS } from "../common/state/protocol/version/registry.js";
import { isJsonRpcNotification, isJsonRpcRequest, isJsonRpcResponse, ProtocolError, ReconnectResultType } from "../common/state/sessionProtocol.js";
import { isClientTransport } from "../common/state/sessionTransport.js";
import { AhpErrorCodes } from "../common/state/protocol/errors.js";
import { ChatSourceKind, ContentEncoding } from "../common/state/protocol/commands.js";
import { encodeBase64 } from "../../../base/common/buffer.js";
import { LoadEstimator } from "../../../base/parts/ipc/common/ipc.net.js";
import { TELEMETRY_CRASH_REPORTER_SETTING_ID, TELEMETRY_OLD_SETTING_ID, TELEMETRY_SETTING_ID } from "../../telemetry/common/telemetry.js";
import { getTelemetryLevel } from "../../telemetry/common/telemetryUtils.js";
import { AgentHostTelemetryLevelConfigKey, AgentHostPreferLongContextEnabledConfigKey, AgentHostTerminalAutoApproveEnabledConfigKey, AgentHostTerminalAutoApproveRulesConfigKey, AgentHostDisableRepoInfoTelemetryConfigKey, getAgentHostTerminalAutoApproveRulesConfig, PREFER_LONG_CONTEXT_SETTING_ID, TERMINAL_AUTO_APPROVE_ENABLED_SETTING_ID, TERMINAL_AUTO_APPROVE_SETTING_ID, TERMINAL_IGNORE_DEFAULT_AUTO_APPROVE_RULES_SETTING_ID, DISABLE_REPO_INFO_TELEMETRY_SETTING_ID, telemetryLevelToAgentHostConfigValue } from "../common/agentHostSchema.js";
import { getAgentHostConfigurationSyncEntries, resolveAgentHostConfigurationSyncPatch, resolveAgentHostConfigurationSyncValue } from "../common/agentHostConfigurationSync.js";
import { toClientConnectionTelemetryMeta } from "../common/agentHostTelemetry.js";
import { dirname } from "../../../base/common/resources.js";
import { observableValue } from "../../../base/common/observable.js";
import { isFileResourceRead } from "../common/resourceReadLogging.js";
import { ResourceSet } from "../../../base/common/map.js";
const AHP_CLIENT_CONNECTION_CLOSED = -32e3;
const RECONNECT_INITIAL_DELAY_MS = 1e3;
const RECONNECT_MAX_DELAY_MS = 3e4;
const PING_INTERVAL_MS = 5e3;
const LIVENESS_TIMEOUT_MS = 2e4;
function connectionTimeoutError(address, silenceMs) {
  return new ProtocolError(
    AHP_CLIENT_CONNECTION_CLOSED,
    `Connection appears dead: ${address}; no message received for ${silenceMs}ms.`
  );
}
function connectionClosedError(address) {
  return new ProtocolError(AHP_CLIENT_CONNECTION_CLOSED, `Connection closed: ${address}`);
}
function connectionDisposedError(address) {
  return new ProtocolError(AHP_CLIENT_CONNECTION_CLOSED, `Connection disposed: ${address}`);
}
function transportLostError(address) {
  return new ProtocolError(AHP_CLIENT_CONNECTION_CLOSED, `Transport lost (reconnecting): ${address}`);
}
var AgentHostClientState = /* @__PURE__ */ ((AgentHostClientState2) => {
  AgentHostClientState2["Connecting"] = "connecting";
  AgentHostClientState2["Incompatible"] = "incompatible";
  AgentHostClientState2["Connected"] = "connected";
  AgentHostClientState2["Reconnecting"] = "reconnecting";
  AgentHostClientState2["Closed"] = "closed";
  return AgentHostClientState2;
})(AgentHostClientState || {});
let RemoteAgentHostProtocolClient = class extends Disposable {
  constructor(identity, transportOrFactory, loadEstimator, clientId = void 0, _clientInfo, _logService, _resourceService, _configurationService) {
    super();
    this._clientInfo = _clientInfo;
    this._logService = _logService;
    this._resourceService = _resourceService;
    this._configurationService = _configurationService;
    /** Disposable holding the listeners attached to the current transport. */
    this._transportListeners = this._register(new MutableDisposable());
    this._serverSeq = 0;
    this._nextClientSeq = 1;
    /**
     * Latest `initialize` response from the host. Captured at the end of
     * {@link connect} and re-captured after a soft-reconnect that pulled
     * a fresh snapshot. `undefined` before the handshake completes.
     */
    this._initializeResult = observableValue("agentHostInitializeResult", void 0);
    this._onDidAction = this._register(new Emitter());
    this.onDidAction = this._onDidAction.event;
    this._onDidNotification = this._register(new Emitter());
    this.onDidNotification = this._onDidNotification.event;
    this._onMcpNotification = this._register(new Emitter());
    this.onMcpNotification = this._onMcpNotification.event;
    /**
     * Fires for every `otlp/exportLogs` notification the host sends on a
     * channel this client has subscribed to. Each payload is an
     * OTLP/JSON `ExportLogsServiceRequest` value verbatim; consumers
     * decode it (see `iterateOtlpLogRecords`) and route the records to a
     * registered logger or sink.
     *
     * Channel URIs are kept opaque on the wire so the same event covers
     * every {@link TelemetryCapabilities.logs} URI the host advertises —
     * subscribers should filter by `channel` if they care.
     */
    this._onDidReceiveOtlpLogs = this._register(new Emitter());
    this.onDidReceiveOtlpLogs = this._onDidReceiveOtlpLogs.event;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeConnectionState = this._register(new Emitter());
    this.onDidChangeConnectionState = this._onDidChangeConnectionState.event;
    /**
     * Discriminated state union. Read via narrowing (`_state.kind === ...`);
     * reconnect-only fields like the gate/outbox/attempt counter are only
     * accessible while {@link _state.kind} is {@link AgentHostClientState.Reconnecting},
     * and protocol errors are only accessible while the state is
     * {@link AgentHostClientState.Incompatible} or {@link AgentHostClientState.Closed}.
     */
    this._state = { kind: "connecting" /* Connecting */, outbox: [] };
    /** Pending JSON-RPC requests keyed by request id. */
    this._pendingRequests = /* @__PURE__ */ new Map();
    this._nextRequestId = 1;
    /**
     * Timestamp of the most recent message of any kind received from the
     * server. Used only for diagnostic logging when the close timer fires.
     */
    this._lastReadTime = Date.now();
    /**
     * Liveness watchdog — see {@link _resetLivenessTimers}.
     *
     * {@link _pingTimer} fires after {@link PING_INTERVAL_MS} of inbound
     * silence and sends an application-level `ping` so we have something
     * to time out on. {@link _closeTimer} fires after another
     * {@link LIVENESS_TIMEOUT_MS} of continued silence and force-closes
     * the transport so the renderer's reconnect logic kicks in. Both are
     * reset on every received message, so busy connections generate no
     * ping traffic at all.
     *
     * Detects silently-dead transports (e.g. SSH/tunnel after laptop
     * sleep + network change) that don't produce a socket close event of
     * their own.
     */
    this._pingTimer = this._register(new TimeoutTimer());
    this._closeTimer = this._register(new TimeoutTimer());
    /**
     * URIs we have already granted implicit read access for on this connection.
     * Uses URI-aware comparison to dedupe repeat sends and is cleared with the connection.
     */
    this._grantedImplicitReadUris = new ResourceSet();
    this._implicitReadGrants = this._register(new DisposableStore());
    this._resourceIdentity = identity;
    this._address = identity === LOCAL_AGENT_HOST_RESOURCE_IDENTITY ? AMBIENT_AGENT_HOST_AUTHORITY : identity;
    this._clientId = clientId ?? generateUuid();
    this._connectionAuthority = identity === LOCAL_AGENT_HOST_RESOURCE_IDENTITY ? AMBIENT_AGENT_HOST_AUTHORITY : agentHostAuthority(identity);
    this._loadEstimator = loadEstimator ?? LoadEstimator.getInstance();
    if (typeof transportOrFactory === "function") {
      this._transportFactory = transportOrFactory;
      this._installTransport(transportOrFactory());
    } else {
      this._transportFactory = void 0;
      this._installTransport(transportOrFactory);
    }
    this._subscriptionManager = this._register(new AgentSubscriptionManager(
      this._clientId,
      () => this.nextClientSeq(),
      (msg) => this._logService.warn(`[RemoteAgentHostProtocolClient] ${msg}`),
      (resource) => this.subscribe(resource),
      (resource) => this.unsubscribe(resource)
    ));
    this._register(this.onDidAction((envelope) => {
      this._subscriptionManager.receiveEnvelope(envelope);
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (this._state.kind !== "connected" /* Connected */) {
        return;
      }
      const patch = {};
      for (const entry of getAgentHostConfigurationSyncEntries(this._resourceIdentity === LOCAL_AGENT_HOST_RESOURCE_IDENTITY)) {
        if (!e.affectsConfiguration(entry.settingId)) {
          continue;
        }
        const value = resolveAgentHostConfigurationSyncValue(this._configurationService, entry);
        if (value !== void 0) {
          patch[entry.sync.key] = value;
        }
      }
      if (Object.keys(patch).length) {
        this._dispatchRootConfig(patch);
      }
      if (e.affectsConfiguration(TELEMETRY_SETTING_ID) || e.affectsConfiguration(TELEMETRY_OLD_SETTING_ID) || e.affectsConfiguration(TELEMETRY_CRASH_REPORTER_SETTING_ID)) {
        this._updateTelemetryLevel();
      }
      if (e.affectsConfiguration(PREFER_LONG_CONTEXT_SETTING_ID)) {
        this._updatePreferLongContextEnabled();
      }
      if (e.affectsConfiguration(TERMINAL_AUTO_APPROVE_ENABLED_SETTING_ID)) {
        this._updateTerminalAutoApproveEnabled();
      }
      if (e.affectsConfiguration(TERMINAL_AUTO_APPROVE_SETTING_ID) || e.affectsConfiguration(TERMINAL_IGNORE_DEFAULT_AUTO_APPROVE_RULES_SETTING_ID)) {
        this._updateTerminalAutoApproveRules();
      }
      if (e.affectsConfiguration(DISABLE_REPO_INFO_TELEMETRY_SETTING_ID)) {
        this._updateDisableRepoInfoTelemetry();
      }
    }));
    if (!isClientTransport(this._transport)) {
      this._resetLivenessTimers();
    }
  }
  get clientId() {
    return this._clientId;
  }
  get address() {
    return this._address;
  }
  get defaultDirectory() {
    return this._defaultDirectory;
  }
  get connectionState() {
    return this._state.kind;
  }
  /**
   * The latest `initialize` response from the host, or `undefined` if
   * the handshake has not completed yet. Exposed observably so callers can
   * react as advertised capabilities (telemetry, `completionTriggerCharacters`,
   * `terminalCommandPrefix`, ...) arrive.
   */
  get initializeResult() {
    return this._initializeResult;
  }
  /**
   * Install a transport and wire listeners. Used both for the initial
   * transport and for replacements created by the factory during a
   * transport-level reconnect.
   */
  _installTransport(transport) {
    const listeners = new DisposableStore();
    listeners.add(transport);
    listeners.add(transport.onMessage((msg) => this._handleMessage(msg)));
    listeners.add(transport.onClose(() => this._handleTransportClose()));
    this._transport = transport;
    this._transportListeners.value = listeners;
  }
  /**
   * Transition to a new {@link ClientState}. Fires {@link onDidChangeConnectionState}
   * only when the variant kind actually changes; in-place mutation of
   * reconnect-state fields (e.g. swapping the gate on a failed retry) does
   * NOT count as a transition and produces no event.
   */
  _transitionTo(next) {
    if (this._state.kind === next.kind) {
      return;
    }
    this._state = next;
    this._onDidChangeConnectionState.fire(next.kind);
  }
  _newReconnectGate() {
    const deferred = new DeferredPromise();
    deferred.p.then(void 0, () => {
    });
    return deferred;
  }
  _newReconnectState() {
    return { gate: this._newReconnectGate(), outbox: [], attempt: 0, timeoutHandle: void 0 };
  }
  dispose() {
    this._handleClose(connectionDisposedError(this._address));
    super.dispose();
  }
  /**
   * Connect to the remote agent host and perform the protocol handshake.
   */
  async connect() {
    try {
      if (isClientTransport(this._transport)) {
        await this._raceClose(this._transport.connect());
      }
      if (this._state.kind !== "connecting" /* Connecting */) {
        throw transportLostError(this._address);
      }
      const result = await this._dispatchRequest("initialize", {
        channel: ROOT_STATE_URI,
        // Advertise every version this client can negotiate, most-preferred first, so an
        // older host (a cloud sandbox running a 0.5.x `copilotd`) can negotiate down
        // instead of rejecting the connection. A current host still picks the newest.
        protocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
        clientId: this._clientId,
        clientInfo: this._clientInfo,
        ...this._clientConnectionTelemetryMeta(),
        initialSubscriptions: [ROOT_STATE_URI]
      }, { bypassInitializeQueue: true });
      this._applyInitializeResult(result);
      for (const snapshot of result.snapshots ?? []) {
        if (isAhpRootChannel(snapshot.resource)) {
          this._subscriptionManager.handleRootSnapshot(snapshot.state, snapshot.fromSeq);
        }
      }
      if (isClientTransport(this._transport) && this._state.kind === "connecting" /* Connecting */) {
        for (const message of this._state.outbox) {
          this._transport.send(message);
        }
        this._state.outbox.length = 0;
      }
      this._transitionTo({ kind: "connected" /* Connected */ });
      this._resetLivenessTimers();
    } catch (error) {
      const protocolError = error instanceof ProtocolError ? error : new ProtocolError(AHP_CLIENT_CONNECTION_CLOSED, error instanceof Error ? error.message : String(error));
      if (protocolError.code === AhpErrorCodes.UnsupportedProtocolVersion) {
        this._cancelLivenessTimers();
        if (this._state.kind === "connecting" /* Connecting */) {
          this._state.outbox.length = 0;
        }
        this._rejectPendingRequests(protocolError);
        this._transitionTo({ kind: "incompatible" /* Incompatible */, error: protocolError });
        throw error;
      }
      if (this._state.kind === "reconnecting" /* Reconnecting */ && this._transportFactory) {
        throw error;
      }
      this._handleClose(protocolError);
      throw error;
    }
  }
  /**
   * Externally signal that the transport has closed. Used by services
   * managing a passive transport (SSH / dev-tunnels) when they observe
   * a connection-loss IPC event independent of the transport's own
   * onClose — without this, a single dropped IPC delivery on the
   * transport's close channel leaves the client stranded in
   * `Connected` until its watchdog fires (which can take hours when
   * the renderer is backgrounded and `setTimeout` is throttled).
   *
   * Idempotent — no-op if already closed or mid-reconnect.
   */
  notifyTransportClosed() {
    this._handleTransportClose();
  }
  /**
   * Called from the transport's `onClose` event. When a {@link _transportFactory}
   * is configured we attempt to soft-reconnect rather than fire `onDidClose` —
   * the protocol-level `reconnect` request lets the server replay missed
   * actions and preserves the `clientId` so pending tool calls etc. are not
   * cancelled by the host-side disconnect timeout. Without a factory
   * (passive-transport SSH/relay path) we fall back to "close means closed"
   * and let the service decide whether to spin up a fresh client.
   */
  _handleTransportClose() {
    switch (this._state.kind) {
      case "closed" /* Closed */:
        return;
      case "connecting" /* Connecting */:
        if (!this._transportFactory) {
          this._handleClose(connectionClosedError(this._address));
          return;
        }
        this._logService.info(`[RemoteAgentHostProtocol] Transport lost while connecting to ${this._address}; scheduling a fresh initialize.`);
        this._transitionTo({
          kind: "reconnecting" /* Reconnecting */,
          reconnect: { ...this._newReconnectState(), outbox: this._state.outbox }
        });
        this._cancelLivenessTimers();
        this._rejectPendingRequests(transportLostError(this._address));
        this._scheduleReconnect();
        return;
      case "incompatible" /* Incompatible */:
        this._handleClose(connectionClosedError(this._address));
        return;
      case "connected" /* Connected */: {
        if (!this._transportFactory) {
          this._handleClose(connectionClosedError(this._address));
          return;
        }
        this._logService.info(`[RemoteAgentHostProtocol] Transport lost for ${this._address}; scheduling reconnect.`);
        this._transitionTo({ kind: "reconnecting" /* Reconnecting */, reconnect: this._newReconnectState() });
        this._cancelLivenessTimers();
        this._rejectPendingRequests(transportLostError(this._address));
        this._scheduleReconnect();
        return;
      }
      case "reconnecting" /* Reconnecting */:
        this._logService.info(`[RemoteAgentHostProtocol] Transport lost for ${this._address} mid-reconnect; aborting the current attempt.`);
        this._cancelLivenessTimers();
        this._rejectPendingRequests(transportLostError(this._address));
        return;
    }
  }
  _scheduleReconnect() {
    if (this._state.kind !== "reconnecting" /* Reconnecting */ || !this._transportFactory) {
      return;
    }
    const reconnect = this._state.reconnect;
    if (reconnect.timeoutHandle !== void 0) {
      return;
    }
    const attempt = reconnect.attempt + 1;
    const delay = Math.min(RECONNECT_INITIAL_DELAY_MS * Math.pow(2, attempt - 1), RECONNECT_MAX_DELAY_MS);
    this._logService.info(`[RemoteAgentHostProtocol] Reconnecting to ${this._address} in ${delay}ms (attempt ${attempt}).`);
    reconnect.timeoutHandle = setTimeout(() => {
      if (this._state.kind === "reconnecting" /* Reconnecting */) {
        this._state.reconnect.timeoutHandle = void 0;
      }
      void this._attemptReconnect();
    }, delay);
  }
  async _attemptReconnect() {
    if (this._state.kind !== "reconnecting" /* Reconnecting */ || !this._transportFactory) {
      return;
    }
    const reconnect = this._state.reconnect;
    reconnect.attempt++;
    let transport;
    try {
      transport = this._transportFactory();
      this._installTransport(transport);
      if (isClientTransport(transport)) {
        await transport.connect();
      }
      if (this._state.kind !== "reconnecting" /* Reconnecting */) {
        return;
      }
      const subscriptions = this._subscriptionManager.currentSubscriptionUris().map((u) => u.toString());
      if (!subscriptions.includes(ROOT_STATE_URI)) {
        subscriptions.unshift(ROOT_STATE_URI);
      }
      const lastSeenServerSeq = this._serverSeq;
      const result = await this._reconnectOrInitialize(lastSeenServerSeq, subscriptions);
      if (this._state.kind !== "reconnecting" /* Reconnecting */) {
        return;
      }
      this._applyReconnectResult(result);
      this._forwardClientConfig();
      const { gate } = reconnect;
      this._drainAfterReconnect(reconnect.outbox);
      this._lastReadTime = Date.now();
      this._resetLivenessTimers();
      this._transitionTo({ kind: "connected" /* Connected */ });
      gate.complete();
      this._logService.info(`[RemoteAgentHostProtocol] Reconnected to ${this._address}.`);
    } catch (err) {
      this._logService.warn(`[RemoteAgentHostProtocol] Reconnect attempt failed for ${this._address}: ${err instanceof Error ? err.message : String(err)}`);
      transport?.dispose();
      if (this._state.kind !== "reconnecting" /* Reconnecting */) {
        return;
      }
      const oldGate = this._state.reconnect.gate;
      this._state.reconnect.gate = this._newReconnectGate();
      oldGate.error(err);
      this._scheduleReconnect();
    }
  }
  async _reconnectOrInitialize(lastSeenServerSeq, subscriptions) {
    try {
      return await this._dispatchRequest("reconnect", {
        clientId: this._clientId,
        lastSeenServerSeq,
        subscriptions,
        ...this._clientConnectionTelemetryMeta()
      }, { bypassReconnectGate: true });
    } catch (error) {
      if (!(error instanceof ProtocolError) || error.code !== AhpErrorCodes.NotFound) {
        throw error;
      }
    }
    this._logService.info(`[RemoteAgentHostProtocol] Server forgot client ${this._clientId}; initializing a fresh connection.`);
    const initializeResult = await this._dispatchRequest("initialize", {
      channel: ROOT_STATE_URI,
      protocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      clientId: this._clientId,
      clientInfo: this._clientInfo,
      ...this._clientConnectionTelemetryMeta(),
      initialSubscriptions: subscriptions
    }, { bypassReconnectGate: true });
    this._applyInitializeResult(initializeResult);
    return { type: ReconnectResultType.Snapshot, snapshots: initializeResult.snapshots ?? [] };
  }
  _clientConnectionTelemetryMeta() {
    const meta = toClientConnectionTelemetryMeta(this._transport.clientConnectionKind);
    return meta ? { _meta: meta } : {};
  }
  _applyInitializeResult(result) {
    this._initializeResult.set(result, void 0);
    this._serverSeq = result.serverSeq;
    if (result.defaultDirectory) {
      const directory = result.defaultDirectory;
      this._defaultDirectory = typeof directory === "string" ? URI.parse(directory).path : URI.revive(directory).path;
    }
    this._forwardClientConfig();
  }
  /**
   * Push the renderer-owned config values the host mirrors (telemetry level,
   * proxy discovery, migrate flag, …) as `RootConfigChanged` actions. Called on
   * initial connect AND on reconnect: a reconnected host may be a freshly
   * restarted process (or one that lost these values), and re-pushing is a cheap
   * no-op when nothing changed. Without this, a value read early — like the
   * migrate flag in `listSessions` — can be missing after a window reload.
   *
   * Most settings arrive here declaratively, via `agentHost` on their
   * configuration schema. The explicit calls below cover the cases a single
   * key-plus-transform can't express: values derived from several settings, and
   * settings contributed by an extension rather than by core.
   */
  _forwardClientConfig() {
    this._dispatchRootConfig(resolveAgentHostConfigurationSyncPatch(this._configurationService, this._resourceIdentity === LOCAL_AGENT_HOST_RESOURCE_IDENTITY));
    this._updateTelemetryLevel();
    this._updatePreferLongContextEnabled();
    this._updateTerminalAutoApproveEnabled();
    this._updateTerminalAutoApproveRules();
    this._updateDisableRepoInfoTelemetry();
  }
  /**
   * Apply a `reconnect` RPC result to the subscription manager. On `replay`
   * we feed each missed envelope through the normal action path; on
   * `snapshot` we reseat each named subscription with the fresh state and
   * advance the server seq cursor accordingly.
   */
  _applyReconnectResult(result) {
    if (result.type === ReconnectResultType.Replay) {
      let maxSeq = this._serverSeq;
      for (const envelope of result.actions) {
        if (envelope.origin?.clientId === this._clientId && envelope.origin.clientSeq !== void 0 && !envelope.rejectionReason) {
          this._subscriptionManager.dropPendingSessionAction(envelope.channel, envelope.origin.clientSeq);
        }
        if (envelope.serverSeq > maxSeq) {
          maxSeq = envelope.serverSeq;
        }
        this._onDidAction.fire(envelope);
      }
      this._serverSeq = maxSeq;
      if (result.missing.length > 0) {
        this._logService.info(`[RemoteAgentHostProtocol] Server cannot resume ${result.missing.length} subscription(s) after reconnect.`);
        this._subscriptionManager.markSubscriptionsMissing(result.missing.map((u) => URI.parse(u)));
      }
    } else {
      let maxSeq = this._serverSeq;
      for (const snapshot of result.snapshots) {
        this._subscriptionManager.applyReconnectSnapshot(snapshot.resource, snapshot.state, snapshot.fromSeq);
        if (snapshot.fromSeq > maxSeq) {
          maxSeq = snapshot.fromSeq;
        }
      }
      this._serverSeq = maxSeq;
    }
  }
  /**
   * Drain queued outgoing wire traffic after a successful soft reconnect:
   *
   * 1. Resend pending optimistic session actions that the server did NOT
   *    echo back in the replay buffer (i.e. anything still on
   *    {@link AgentSubscriptionManager.getPendingSessionActions}).
   * 2. Flush every message that {@link _sendNotification} queued onto the
   *    outbox while the gate was engaged.
   *
   * Replays are deduped against the outbox by `clientSeq` so a session
   * action that was both optimistic-tracked AND queued during the
   * reconnect window only goes out once.
   */
  _drainAfterReconnect(outbox) {
    const queuedSeqs = /* @__PURE__ */ new Set();
    for (const msg of outbox) {
      if (hasKey(msg, { method: true }) && msg.method === "dispatchAction") {
        queuedSeqs.add(msg.params.clientSeq);
      }
    }
    const replays = [];
    for (const entry of this._subscriptionManager.getPendingSessionActions()) {
      if (queuedSeqs.has(entry.clientSeq)) {
        continue;
      }
      this._grantImplicitReadsForOutgoingAction(entry.action);
      replays.push({
        jsonrpc: "2.0",
        method: "dispatchAction",
        params: { channel: entry.channel, clientSeq: entry.clientSeq, action: entry.action }
      });
    }
    if (replays.length > 0) {
      this._logService.info(`[RemoteAgentHostProtocol] Replaying ${replays.length} pending action(s) after reconnect to ${this._address}.`);
    }
    for (const msg of replays) {
      this._transport.send(msg);
    }
    for (const msg of outbox) {
      this._transport.send(msg);
    }
  }
  // ---- IAgentConnection subscription API ----------------------------------
  get rootState() {
    return this._subscriptionManager.rootState;
  }
  getSubscription(kind, resource, owner) {
    return this._subscriptionManager.getSubscription(kind, resource, owner);
  }
  getSubscriptionUnmanaged(_kind, resource) {
    return this._subscriptionManager.getSubscriptionUnmanaged(resource);
  }
  getInflightSessionCreate(resource) {
    return this._subscriptionManager.getInflightSessionCreate(resource);
  }
  trackSessionCreate(resource, promise) {
    this._subscriptionManager.trackSessionCreate(resource, promise);
  }
  getActiveSubscriptions() {
    return this._subscriptionManager.getActiveSubscriptions();
  }
  dispatch(channel, action) {
    const seq = this._subscriptionManager.dispatchOptimistic(channel, action);
    this.dispatchAction(channel, action, this._clientId, seq);
  }
  /**
   * Subscribe to state at a URI. Returns the current state snapshot.
   *
   * For stateless channels (e.g. `ahp-otlp:` telemetry channels) use
   * {@link subscribeStateless} — calling this method on a stateless
   * channel rejects because the server omits `snapshot` on the
   * response.
   */
  async subscribe(resource) {
    const result = await this._sendRequest("subscribe", { channel: resource.toString() });
    if (!result.snapshot) {
      throw new Error(`subscribe to ${resource.toString()} returned no snapshot`);
    }
    return result.snapshot;
  }
  /**
   * Subscribe to a stateless channel — one for which the server does
   * not maintain replayable state and therefore omits `snapshot` from
   * the `subscribe` response. Used today for the host's OTLP telemetry
   * channels (`ahp-otlp:`).
   *
   * Returns once the subscription is confirmed by the server.
   * Subsequent notifications on the channel arrive via the relevant
   * dispatch event (e.g. {@link onDidReceiveOtlpLogs} for log records).
   */
  async subscribeStateless(resource) {
    await this._sendRequest("subscribe", { channel: resource.toString() });
  }
  /**
   * Unsubscribe from state at a URI.
   */
  unsubscribe(resource) {
    this._sendNotification("unsubscribe", { channel: resource.toString() });
  }
  /**
   * Dispatch a client action to the server. Returns the clientSeq used.
   */
  dispatchAction(channel, action, _clientId, clientSeq) {
    this._grantImplicitReadsForOutgoingAction(action);
    this._sendNotification("dispatchAction", { channel, clientSeq, action });
  }
  /**
   * Create a new session on the remote agent host.
   */
  createSession(config) {
    const provider = config?.provider;
    if (!provider) {
      throw new Error("Cannot create remote agent host session without a provider.");
    }
    const session = config?.session ?? AgentSession.uri(provider, generateUuid());
    if (config?.activeClient?.customizations) {
      this._grantImplicitReadsForCustomizations(config.activeClient.customizations);
    }
    const promise = this._sendRequest("createSession", {
      channel: session.toString(),
      _meta: config?._meta,
      provider,
      workingDirectories: config?.workingDirectories?.map((d) => fromAgentHostUri(d).toString()),
      fork: config?.fork ? { session: fromAgentHostUri(config.fork.session).toString(), turnId: config.fork.turnId } : void 0,
      config: config?.config,
      activeClient: config?.activeClient,
      progressToken: config?.progressToken
    }).then(() => session);
    this._subscriptionManager.trackSessionCreate(session, promise);
    return promise;
  }
  async resolveSessionConfig(params) {
    return this._sendRequest("resolveSessionConfig", {
      channel: ROOT_STATE_URI,
      provider: params.provider,
      workingDirectory: params.workingDirectory ? fromAgentHostUri(params.workingDirectory).toString() : void 0,
      config: params.config
    });
  }
  async sessionConfigCompletions(params) {
    return this._sendRequest("sessionConfigCompletions", {
      channel: ROOT_STATE_URI,
      provider: params.provider,
      workingDirectory: params.workingDirectory ? fromAgentHostUri(params.workingDirectory).toString() : void 0,
      config: params.config,
      property: params.property,
      query: params.query
    });
  }
  async completions(params) {
    return this._sendRequest("completions", params);
  }
  /**
   * Send an application-level ping and wait for the server's response.
   * Used by {@link _watchdogTick} to keep idle connections under
   * watchdog supervision; safe to call from external code as well.
   *
   * The returned promise rejects with a {@link ProtocolError} if the
   * connection closes before a response arrives.
   */
  async ping() {
    await this._sendRequest("ping", { channel: ROOT_STATE_URI });
  }
  /**
   * Returns the trigger characters captured from the `initialize` handshake.
   * Empty when the remote host did not announce any.
   */
  async getCompletionTriggerCharacters() {
    while (this._state.kind === "connecting" /* Connecting */) {
      await Event.toPromise(this.onDidChangeConnectionState);
    }
    switch (this._state.kind) {
      case "incompatible" /* Incompatible */:
      case "closed" /* Closed */:
        throw this._state.error;
      case "connected" /* Connected */:
      case "reconnecting" /* Reconnecting */:
        return this._initializeResult.get()?.completionTriggerCharacters ?? [];
    }
  }
  /**
   * Authenticate with the remote agent host using a specific scheme.
   */
  async authenticate(params) {
    await this._sendRequest("authenticate", { channel: ROOT_STATE_URI, ...params, scopes: params.scopes ? [...params.scopes] : void 0 });
    return { authenticated: true };
  }
  /**
   * Gracefully shut down all sessions on the remote host.
   */
  async shutdown() {
    await this._sendExtensionRequest("shutdown");
  }
  /**
   * List the endpoints the remote agent host suggests probing for connectivity.
   */
  async getNetworkDiagnosticsInfo() {
    return this._sendExtensionRequest("getNetworkDiagnosticsInfo");
  }
  async getManagedSettingsDiagnostics() {
    return this._sendExtensionRequest("getManagedSettingsDiagnostics");
  }
  /**
   * Probe connectivity from the remote agent host to a single `url`.
   */
  async diagnosticsFetch(url) {
    return this._sendExtensionRequest("diagnosticsFetch", { url });
  }
  /**
   * Dispose a session on the remote agent host.
   */
  async disposeSession(session) {
    await this._sendRequest("disposeSession", { channel: session.toString() });
  }
  async createChat(session, chat, options) {
    await this._sendRequest("createChat", {
      channel: session.toString(),
      chat: chat.toString(),
      ...options?.fork ? {
        source: { kind: ChatSourceKind.Fork, chat: options.fork.source.toString(), turnId: options.fork.turnId }
      } : {},
      ...options?.sideChat ? {
        source: {
          kind: ChatSourceKind.SideChat,
          chat: options.sideChat.source.toString(),
          turnId: options.sideChat.turnId,
          ...options.sideChat.selection ? { selection: options.sideChat.selection } : {}
        }
      } : {}
    });
  }
  async disposeChat(chat) {
    await this._sendRequest("disposeChat", { channel: chat.toString() });
  }
  /**
   * Create a new terminal on the remote agent host.
   */
  async createTerminal(params) {
    await this._sendRequest("createTerminal", params);
  }
  /**
   * Dispose a terminal on the remote agent host.
   */
  async disposeTerminal(terminal) {
    await this._sendRequest("disposeTerminal", { channel: terminal.toString() });
  }
  async invokeChangesetOperation(params) {
    return await this._sendRequest("invokeChangesetOperation", params);
  }
  /**
   * Send a request on an `mcp://` AHP side channel. The agent-host
   * routes by `params.channel` so we inject it automatically.
   */
  async handleMcpRequest(channel, method, params) {
    return await this._dispatchRequest(method, { ...params ?? {}, channel });
  }
  /**
   * List all sessions from the remote agent host.
   */
  async listSessions() {
    const result = await this._sendRequest("listSessions", { channel: ROOT_STATE_URI });
    return result.items.map((s) => ({
      session: URI.parse(s.resource),
      startTime: Date.parse(s.createdAt),
      modifiedTime: Date.parse(s.modifiedAt),
      ...s.project ? {
        project: {
          uri: this._toLocalProjectUri(URI.parse(s.project.uri)),
          displayName: s.project.displayName
        }
      } : {},
      summary: s.title,
      status: s.status,
      activity: s.activity,
      workingDirectory: typeof s.workingDirectories?.[0] === "string" ? toAgentHostUri(URI.parse(s.workingDirectories?.[0]), this._connectionAuthority) : void 0,
      workingDirectories: s.workingDirectories?.map((d) => toAgentHostUri(URI.parse(d), this._connectionAuthority)),
      changes: s.changes,
      // Carry `_meta` so a session first materialized from a listing (window
      // reload, list refresh) resolves its kind correctly.
      ...s._meta !== void 0 ? { _meta: s._meta } : {}
    }));
  }
  _toLocalProjectUri(uri) {
    return uri.scheme === Schemas.file ? toAgentHostUri(uri, this._connectionAuthority) : uri;
  }
  /**
   * Inspect an outgoing client-dispatched action and grant implicit reads for
   * resources that the host will need to read after receiving the action.
   */
  _grantImplicitReadsForOutgoingAction(action) {
    switch (action.type) {
      case ActionType.SessionActiveClientSet:
        if (action.activeClient.customizations) {
          this._grantImplicitReadsForCustomizations(action.activeClient.customizations);
        }
        break;
      case ActionType.ChatTurnStarted:
      case ActionType.ChatPendingMessageSet:
        this._grantImplicitReadsForMessage(action.message);
        break;
    }
  }
  _grantImplicitReadsForMessage(message) {
    for (const attachment of message.attachments ?? []) {
      if (attachment.type !== MessageAttachmentKind.Resource) {
        continue;
      }
      try {
        this._grantImplicitRead(URI.parse(attachment.uri));
      } catch {
        continue;
      }
    }
  }
  /**
   * Register implicit read grants for each customization URI that we are
   * about to send to the host. The host needs to read these to materialize
   * the customization, but should not need to write them. Grants are
   * deduped per connection and revoked when the connection closes.
   */
  _grantImplicitReadsForCustomizations(refs) {
    for (const ref of refs) {
      let uri;
      try {
        uri = URI.parse(ref.uri);
      } catch {
        continue;
      }
      this._grantImplicitRead(dirname(uri));
    }
  }
  _grantImplicitRead(uri) {
    if (this._grantedImplicitReadUris.has(uri)) {
      return;
    }
    this._grantedImplicitReadUris.add(uri);
    this._implicitReadGrants.add(this._resourceService.grantImplicitRead(this._resourceIdentity, uri));
  }
  /**
   * List the contents of a directory on the remote host's filesystem.
   */
  async resourceList(uri) {
    return await this._sendRequest("resourceList", { channel: ROOT_STATE_URI, uri: uri.toString() });
  }
  /**
   * Read the content of a resource on the remote host.
   */
  async resourceRead(uri) {
    return this._sendRequest("resourceRead", { channel: ROOT_STATE_URI, uri: uri.toString() });
  }
  async resourceWrite(params) {
    return this._sendRequest("resourceWrite", params);
  }
  async resourceCopy(params) {
    return this._sendRequest("resourceCopy", params);
  }
  async resourceDelete(params) {
    return this._sendRequest("resourceDelete", params);
  }
  async resourceMove(params) {
    return this._sendRequest("resourceMove", params);
  }
  async resourceResolve(params) {
    return this._sendRequest("resourceResolve", params);
  }
  async resourceMkdir(params) {
    return this._sendRequest("resourceMkdir", params);
  }
  async createResourceWatch(params) {
    return this._sendRequest("createResourceWatch", params);
  }
  /**
   * Convenience wrapper used by {@link AHPFileSystemProvider.watch}:
   * runs `createResourceWatch` + `subscribe` and returns a handle that
   * surfaces `resourceWatch/changed` envelopes as
   * {@link IFileChange}[] events. Disposing the handle unsubscribes
   * the watch channel.
   */
  watchResource(params) {
    return createRemoteWatchHandle({
      createResourceWatch: (p) => this.createResourceWatch(p),
      subscribe: (uri) => this.subscribe(uri),
      unsubscribe: (uri) => this.unsubscribe(uri),
      onDidAction: this.onDidAction
    }, params);
  }
  /**
   * Trigger the CLI-managed upgrade flow for this agent host using the
   * method name advertised by the server (typically
   * {@link VSCODE_UPGRADE_METHOD}). Callable before {@link connect} has
   * completed — typically used when the host has just rejected our
   * `initialize` with an `UnsupportedProtocolVersion` error. The
   * transport stays open after the rejection, so the extension request
   * rides over it without a special out-of-band path.
   *
   * The result mirrors the CLI's HTTP response: ok flag, whether the
   * upgrade is needed / started, running/latest commits.
   */
  triggerVscodeUpgrade(method) {
    return this._dispatchRequest(method, {}, { allowIncompatibleUpgrade: true });
  }
  _handleMessage(msg) {
    if (this._state.kind === "closed" /* Closed */) {
      return;
    }
    this._lastReadTime = Date.now();
    this._resetLivenessTimers();
    if (isJsonRpcRequest(msg)) {
      this._handleReverseRequest(msg.id, msg.method, msg.params);
    } else if (isJsonRpcResponse(msg)) {
      const pending = this._pendingRequests.get(msg.id);
      if (pending) {
        this._pendingRequests.delete(msg.id);
        if (hasKey(msg, { error: true })) {
          if (this._shouldLogFailedRequest(pending, msg.error)) {
            this._logService.warn(`[RemoteAgentHostProtocol] Request ${msg.id} failed:`, msg.error);
          }
          pending.deferred.error(this._toProtocolError(msg.error));
        } else {
          pending.deferred.complete(msg.result);
        }
      } else {
        this._logService.warn(`[RemoteAgentHostProtocol] Received response for unknown request id ${msg.id}`);
      }
    } else if (isJsonRpcNotification(msg)) {
      switch (msg.method) {
        case "action": {
          const envelope = msg.params;
          this._serverSeq = Math.max(this._serverSeq, envelope.serverSeq);
          this._onDidAction.fire(envelope);
          break;
        }
        case "root/sessionAdded":
        case "root/sessionRemoved":
        case "root/sessionSummaryChanged":
        case "root/progress":
        case "auth/required": {
          this._logService.trace(`[RemoteAgentHostProtocol] Notification: ${msg.method}`);
          this._onDidNotification.fire({ type: msg.method, ...msg.params });
          break;
        }
        case "otlp/exportLogs":
          this._onDidReceiveOtlpLogs.fire(msg.params);
          break;
        case "otlp/exportTraces":
        case "otlp/exportMetrics":
          break;
        default: {
          const rawChannel = msg.params && typeof msg.params === "object" ? msg.params.channel : void 0;
          if (typeof rawChannel === "string" && rawChannel.toLowerCase().startsWith("mcp:/")) {
            const { channel: _channel, ...rest } = msg.params;
            this._onMcpNotification.fire({ channel: rawChannel, method: msg.method, params: rest });
            break;
          }
          this._logService.trace(`[RemoteAgentHostProtocol] Unhandled method: ${msg.method}`);
          break;
        }
      }
    } else {
      this._logService.warn(`[RemoteAgentHostProtocol] Unrecognized message:`, JSON.stringify(msg));
    }
  }
  _handleClose(error) {
    if (this._state.kind === "closed" /* Closed */) {
      return;
    }
    this._cancelLivenessTimers();
    if (this._state.kind === "reconnecting" /* Reconnecting */) {
      const reconnect = this._state.reconnect;
      if (reconnect.timeoutHandle !== void 0) {
        clearTimeout(reconnect.timeoutHandle);
      }
      if (!reconnect.gate.isSettled) {
        reconnect.gate.error(error);
      }
    }
    if (this._state.kind === "connecting" /* Connecting */) {
      this._state.outbox.length = 0;
    }
    this._rejectPendingRequests(error);
    this._grantedImplicitReadUris.clear();
    this._implicitReadGrants.clear();
    this._resourceService.connectionClosed(this._resourceIdentity);
    this._transitionTo({ kind: "closed" /* Closed */, error });
    this._onDidClose.fire();
  }
  async _raceClose(promise) {
    if (this._state.kind === "closed" /* Closed */) {
      return Promise.reject(this._state.error);
    }
    let closeListener = Disposable.None;
    const closePromise = new Promise((_resolve, reject) => {
      closeListener = this.onDidClose(() => reject(this._state.kind === "closed" /* Closed */ ? this._state.error : connectionClosedError(this._address)));
    });
    try {
      return await Promise.race([promise, closePromise]);
    } finally {
      closeListener.dispose();
    }
  }
  /**
   * Handles reverse RPC requests from the server (e.g. resourceList,
   * resourceRead). Thin wire adapter — dispatches each frame to
   * {@link IAgentHostResourceService} (which owns gating, virtual reads,
   * and the user-prompt flow) and translates results / errors back into
   * JSON-RPC frames.
   */
  _handleReverseRequest(id, method, params) {
    const transport = this._transport;
    const sendResult = (result) => {
      transport.send({ jsonrpc: "2.0", id, result });
    };
    const sendError = (err) => {
      if (err instanceof AgentHostResourcePermissionError) {
        transport.send({
          jsonrpc: "2.0",
          id,
          error: {
            code: AhpErrorCodes.PermissionDenied,
            message: err.message,
            data: err.request ? { request: err.request } : void 0
          }
        });
        return;
      }
      const fsCode = toFileSystemProviderErrorCode(err instanceof Error ? err : void 0);
      let code = -32e3;
      switch (fsCode) {
        case FileSystemProviderErrorCode.FileNotFound:
          code = AhpErrorCodes.NotFound;
          break;
        case FileSystemProviderErrorCode.NoPermissions:
          code = AhpErrorCodes.PermissionDenied;
          break;
        case FileSystemProviderErrorCode.FileExists:
          code = AhpErrorCodes.AlreadyExists;
          break;
      }
      transport.send({ jsonrpc: "2.0", id, error: { code, message: err instanceof Error ? err.message : String(err) } });
    };
    const p = params ?? {};
    const identity = this._resourceIdentity;
    void (async () => {
      try {
        switch (method) {
          case "resourceList": {
            if (!p.uri) {
              throw new Error("Missing uri");
            }
            const result = await this._resourceService.list(identity, URI.parse(p.uri));
            sendResult({ entries: result.entries });
            return;
          }
          case "resourceRead": {
            if (!p.uri) {
              throw new Error("Missing uri");
            }
            const result = await this._resourceService.read(identity, URI.parse(p.uri));
            sendResult({ data: encodeBase64(result.bytes), encoding: ContentEncoding.Base64 });
            return;
          }
          case "resourceWrite": {
            if (!p.uri || p.data === void 0) {
              throw new Error("Missing uri or data");
            }
            await this._resourceService.write(identity, p);
            sendResult({});
            return;
          }
          case "resourceDelete": {
            if (!p.uri) {
              throw new Error("Missing uri");
            }
            await this._resourceService.del(identity, p);
            sendResult({});
            return;
          }
          case "resourceMove": {
            if (!p.source || !p.destination) {
              throw new Error("Missing source or destination");
            }
            await this._resourceService.move(identity, p);
            sendResult({});
            return;
          }
          case "resourceCopy": {
            if (!p.source || !p.destination) {
              throw new Error("Missing source or destination");
            }
            await this._resourceService.copy(identity, p);
            sendResult({});
            return;
          }
          case "resourceResolve": {
            if (!p.uri) {
              throw new Error("Missing uri");
            }
            const result = await this._resourceService.resolve(identity, p);
            sendResult(result);
            return;
          }
          case "resourceMkdir": {
            if (!p.uri) {
              throw new Error("Missing uri");
            }
            await this._resourceService.mkdir(identity, p);
            sendResult({});
            return;
          }
          case "resourceRequest": {
            try {
              await this._resourceService.request(identity, p);
              sendResult({});
            } catch (err) {
              if (err instanceof CancellationError) {
                throw new AgentHostResourcePermissionError(void 0);
              }
              throw err;
            }
            return;
          }
          default:
            this._logService.warn(`[RemoteAgentHostProtocol] Unhandled reverse request: ${method}`);
            throw new Error(`Unknown method: ${method}`);
        }
      } catch (err) {
        sendError(err);
      }
    })();
  }
  /** Send a typed JSON-RPC notification for a protocol-defined method. */
  _sendNotification(method, params) {
    if (this._state.kind === "closed" /* Closed */ || this._state.kind === "incompatible" /* Incompatible */) {
      return;
    }
    const message = { jsonrpc: "2.0", method, params };
    if (isClientTransport(this._transport) && this._state.kind === "connecting" /* Connecting */) {
      this._state.outbox.push(message);
      return;
    }
    if (this._state.kind === "reconnecting" /* Reconnecting */) {
      this._state.reconnect.outbox.push(message);
      return;
    }
    this._transport.send(message);
  }
  /** Send a typed JSON-RPC request for a protocol-defined method. */
  _sendRequest(method, params) {
    return this._dispatchRequest(method, params);
  }
  /** Send a JSON-RPC request for a VS Code extension method (not in the protocol spec). */
  _sendExtensionRequest(method, params) {
    return this._dispatchRequest(method, params);
  }
  _updateTelemetryLevel() {
    this._dispatchRootConfig({ [AgentHostTelemetryLevelConfigKey]: telemetryLevelToAgentHostConfigValue(getTelemetryLevel(this._configurationService)) });
  }
  /** Merge a patch into the agent host's root configuration. */
  _dispatchRootConfig(config) {
    this.dispatchAction(ROOT_STATE_URI, {
      type: ActionType.RootConfigChanged,
      config
    }, this._clientId, 0);
  }
  _updateDisableRepoInfoTelemetry() {
    const disabled = this._configurationService.getValue(DISABLE_REPO_INFO_TELEMETRY_SETTING_ID) === true;
    this._dispatchRootConfig({ [AgentHostDisableRepoInfoTelemetryConfigKey]: disabled });
  }
  _updatePreferLongContextEnabled() {
    const enabled = this._configurationService.getValue(PREFER_LONG_CONTEXT_SETTING_ID) === true;
    this._dispatchRootConfig({ [AgentHostPreferLongContextEnabledConfigKey]: enabled });
  }
  _updateTerminalAutoApproveEnabled() {
    const enabled = this._configurationService.getValue(TERMINAL_AUTO_APPROVE_ENABLED_SETTING_ID) !== false;
    this._dispatchRootConfig({ [AgentHostTerminalAutoApproveEnabledConfigKey]: enabled });
  }
  _updateTerminalAutoApproveRules() {
    this._dispatchRootConfig({ [AgentHostTerminalAutoApproveRulesConfigKey]: getAgentHostTerminalAutoApproveRulesConfig(this._configurationService) });
  }
  /**
   * Common path for outgoing JSON-RPC requests: queue pre-initialize traffic,
   * gate on any in-flight reconnect (unless explicitly bypassed for the
   * `reconnect` RPC itself), assign an id, register the pending deferred, and
   * write to the wire.
   *
   * The reconnect-gate bypass exists because the `reconnect` request is sent
   * from inside `_attemptReconnect` while the gate is engaged, so it can't
   * wait on its own resolution.
   */
  async _dispatchRequest(method, params, options = {}) {
    if (this._state.kind === "closed" /* Closed */) {
      throw this._state.error;
    }
    if (this._state.kind === "incompatible" /* Incompatible */) {
      if (!options.allowIncompatibleUpgrade) {
        throw this._state.error;
      }
      const { request: request2, result: result2 } = this._createRequest(method, params);
      this._transport.send(request2);
      return result2;
    }
    if (!options.bypassInitializeQueue && isClientTransport(this._transport) && this._state.kind === "connecting" /* Connecting */) {
      const { request: request2, result: result2 } = this._createRequest(method, params);
      this._state.outbox.push(request2);
      return result2;
    }
    while (!options.bypassReconnectGate && this._state.kind === "reconnecting" /* Reconnecting */) {
      const current2 = this._state;
      if (current2.kind !== "reconnecting" /* Reconnecting */) {
        break;
      }
      try {
        await current2.reconnect.gate.p;
      } catch {
      }
    }
    const current = this._state;
    if (current.kind === "closed" /* Closed */ || current.kind === "incompatible" /* Incompatible */) {
      throw current.error;
    }
    const { request, result } = this._createRequest(method, params);
    this._transport.send(request);
    return result;
  }
  _createRequest(method, params) {
    const id = this._nextRequestId++;
    const deferred = new DeferredPromise();
    this._pendingRequests.set(id, { deferred, suppressNotFoundWarning: isFileResourceRead(method, params), sentAt: Date.now() });
    return {
      request: { jsonrpc: "2.0", id, method, params },
      result: deferred.p
    };
  }
  _shouldLogFailedRequest(request, error) {
    if (error.code === AhpErrorCodes.NotFound && request.suppressNotFoundWarning) {
      return false;
    }
    return true;
  }
  _toProtocolError(error) {
    return new ProtocolError(error.code, error.message, error.data);
  }
  _rejectPendingRequests(error) {
    for (const pending of this._pendingRequests.values()) {
      pending.deferred.error(error);
    }
    this._pendingRequests.clear();
  }
  /**
   * Reset the liveness timers. Called at construction for an already-open
   * passive transport, after a successful client-transport initialization,
   * once on every received message (which is itself proof the remote is
   * alive), and once after a successful soft reconnect.
   *
   * Two timers cooperate:
   *
   * 1. {@link _pingTimer} fires after {@link PING_INTERVAL_MS} of silence
   *    and sends an application-level `ping` so the close timer has
   *    something to time out on. Tolerates servers that don't implement
   *    `ping` — the error response still resets both timers.
   *
   * 2. {@link _closeTimer} fires after {@link PING_INTERVAL_MS}+
   *    {@link LIVENESS_TIMEOUT_MS} of continued silence and force-closes
   *    the transport so the renderer's reconnect logic kicks in. Catches
   *    silently-dead transports (e.g. SSH/tunnel after laptop sleep +
   *    network change) that don't emit a socket close event of their own.
   *
   * After laptop sleep + wake the JS event loop is paused, so a timer
   * armed before sleep fires immediately after wake. That's fine —
   * any inbound message processed during the wake catch-up resets it
   * before the close handler runs.
   *
   * No-op while {@link _state.kind} is {@link AgentHostClientState.Incompatible},
   * {@link AgentHostClientState.Reconnecting}, or {@link AgentHostClientState.Closed}:
   * the transport is not available for normal liveness traffic in those states.
   */
  _resetLivenessTimers() {
    if (this._state.kind === "incompatible" /* Incompatible */ || this._state.kind === "reconnecting" /* Reconnecting */ || this._state.kind === "closed" /* Closed */) {
      return;
    }
    this._pingTimer.cancelAndSet(() => this._onPingTimer(), PING_INTERVAL_MS);
    this._closeTimer.cancelAndSet(() => this._onCloseTimer(), PING_INTERVAL_MS + LIVENESS_TIMEOUT_MS);
  }
  _cancelLivenessTimers() {
    this._pingTimer.cancel();
    this._closeTimer.cancel();
  }
  _onPingTimer() {
    if (this._state.kind === "incompatible" /* Incompatible */ || this._state.kind === "closed" /* Closed */ || this._state.kind === "reconnecting" /* Reconnecting */) {
      return;
    }
    void this.ping().catch(() => void 0);
  }
  _onCloseTimer() {
    if (this._state.kind === "incompatible" /* Incompatible */ || this._state.kind === "closed" /* Closed */ || this._state.kind === "reconnecting" /* Reconnecting */) {
      return;
    }
    if (this._loadEstimator.hasHighLoad()) {
      this._closeTimer.cancelAndSet(() => this._onCloseTimer(), PING_INTERVAL_MS);
      return;
    }
    const silence = Date.now() - this._lastReadTime;
    this._logService.info(
      `[RemoteAgentHostProtocol] Liveness: no message from ${this._address} for ${silence}ms; forcing close to trigger reconnect.`
    );
    this._transportListeners.clear();
    if (this._transportFactory) {
      this._rejectPendingRequests(connectionTimeoutError(this._address, silence));
      this._handleTransportClose();
      return;
    }
    this._handleClose(connectionTimeoutError(this._address, silence));
  }
  /**
   * Get the next client sequence number for optimistic dispatch.
   */
  nextClientSeq() {
    return this._nextClientSeq++;
  }
};
RemoteAgentHostProtocolClient = __decorateClass([
  __decorateParam(5, ILogService),
  __decorateParam(6, IAgentHostResourceService),
  __decorateParam(7, IConfigurationService)
], RemoteAgentHostProtocolClient);
export {
  AgentHostClientState,
  RemoteAgentHostProtocolClient
};
