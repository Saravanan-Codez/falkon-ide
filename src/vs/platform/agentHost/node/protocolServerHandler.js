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
import { disposableTimeout } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { isJsonRpcResponse } from "../../../base/common/jsonRpcProtocol.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { hasKey } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../log/common/log.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { getAgentHostClientType } from "../common/agentHostClientInfo.js";
import { AgentHostClientConnectionKind, AgentHostLaunchKind, AgentHostTransportKind, readClientConnectionKind } from "../common/agentHostTelemetry.js";
import { AgentSession } from "../common/agentService.js";
import { isActionEnvelopeRelevantToSubscriptionUris } from "../common/state/agentSubscription.js";
import { ChatSourceKind } from "../common/state/protocol/channels-chat/commands.js";
import { ActionType, isAnnotationsAction, isChangesetAction, isChatAction, isSessionAction, isTerminalAction } from "../common/state/sessionActions.js";
import { PROTOCOL_VERSION } from "../common/state/protocol/version/registry.js";
import { negotiateProtocolVersion } from "../common/state/protocol/version/negotiation.js";
import { VSCODE_UPGRADE_METHOD } from "../common/state/protocolUpgrade.js";
import { getAgentHostManagementSocketPath, requestAgentHostUpgrade } from "./agentHostUpgradeChannel.js";
import {
  AHP_AUTH_REQUIRED,
  AhpErrorCodes,
  AHP_PROVIDER_NOT_FOUND,
  AHP_SESSION_NOT_FOUND,
  AHP_UNSUPPORTED_PROTOCOL_VERSION,
  isJsonRpcNotification,
  isJsonRpcRequest,
  JSON_RPC_INTERNAL_ERROR,
  JsonRpcErrorCodes,
  ProtocolError
} from "../common/state/sessionProtocol.js";
import { isAhpResourceWatchChannel, isAhpRootChannel, ResponsePartKind, SessionStatus, ToolCallConfirmationReason, ToolCallContributorKind, ToolCallStatus, ToolResultContentType, buildDefaultChatUri, isAhpChatChannel, parseChatUri, parseRequiredSessionUriFromChatUri } from "../common/state/sessionState.js";
import {
  buildOtlpLogsChannelUri,
  extractLevelFromOtlpLogsUri,
  levelToSeverityNumber,
  OTLP_CHANNEL_SCHEME,
  OTLP_LOGS_CHANNEL_TEMPLATE,
  toResourceLogsPayload
} from "../common/otlp/otlpLogEmitter.js";
import { isFileResourceRead } from "../common/resourceReadLogging.js";
import { AGENT_HOST_CLIENT_CONNECTION_HISTORY_RETENTION, AgentHostClientConnectionTelemetryTracker } from "./agentHostClientConnectionTelemetry.js";
import { AgentHostTelemetryReporter } from "./agentHostTelemetryReporter.js";
const REPLAY_BUFFER_CAPACITY = 1e3;
const CLIENT_TOOL_CALL_DISCONNECT_TIMEOUT = 3e4;
const UNSUPPORTED_CLIENT_ACTION_TYPES = /* @__PURE__ */ new Set([
  ActionType.ChatWorkingDirectorySet,
  ActionType.ChatWorkingDirectoryRemoved
]);
function isPendingToolCallStatus(status) {
  return status === ToolCallStatus.Streaming || status === ToolCallStatus.Running || status === ToolCallStatus.PendingConfirmation;
}
function jsonRpcSuccess(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function jsonRpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id, error: { code, message, ...data !== void 0 ? { data } : {} } };
}
function jsonRpcErrorFrom(id, err) {
  if (err instanceof ProtocolError) {
    return jsonRpcError(id, err.code, err.message, err.data);
  }
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  return jsonRpcError(id, JSON_RPC_INTERNAL_ERROR, message);
}
function shouldLogFailedRequest(method, params, err) {
  if (!(err instanceof ProtocolError) || err.code !== AhpErrorCodes.NotFound || !isFileResourceRead(method, params)) {
    return true;
  }
  return false;
}
function isParamsObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readMcpChannel(params) {
  if (!isParamsObject(params)) {
    return void 0;
  }
  const channel = params["channel"];
  if (typeof channel !== "string" || !channel.startsWith("mcp://")) {
    return void 0;
  }
  return channel;
}
var ChannelKind = /* @__PURE__ */ ((ChannelKind2) => {
  ChannelKind2["State"] = "state";
  ChannelKind2["ResourceWatch"] = "resource-watch";
  ChannelKind2["OtlpLogs"] = "otlp-logs";
  return ChannelKind2;
})(ChannelKind || {});
function classifyChannel(channel) {
  if (channel.toLowerCase().startsWith(`${OTLP_CHANNEL_SCHEME}:`)) {
    const level = extractLevelFromOtlpLogsUri(channel);
    if (!level) {
      return void 0;
    }
    return { kind: "otlp-logs" /* OtlpLogs */, uri: buildOtlpLogsChannelUri(level), level };
  }
  if (isAhpResourceWatchChannel(channel)) {
    return { kind: "resource-watch" /* ResourceWatch */, uri: channel };
  }
  return { kind: "state" /* State */, uri: channel };
}
let ProtocolServerHandler = class extends Disposable {
  constructor(_agentService, _stateManager, _server, _config, _clientFileSystemProvider, _logService, telemetryService) {
    super();
    this._agentService = _agentService;
    this._stateManager = _stateManager;
    this._server = _server;
    this._config = _config;
    this._clientFileSystemProvider = _clientFileSystemProvider;
    this._logService = _logService;
    /**
     * Per-client records keyed by clientId. Holds both connected clients
     * (`connections` non-empty) and recently-disconnected ones retained for the
     * tool-call disconnect-grace window (`connections.length === 0`). See
     * {@link IClientRecord}.
     */
    this._clients = /* @__PURE__ */ new Map();
    this._replayBuffer = [];
    this._onDidChangeConnectionCount = this._register(new Emitter());
    /** Fires with the current client count whenever a client connects or disconnects. */
    this.onDidChangeConnectionCount = this._onDidChangeConnectionCount.event;
    // ---- Requests (expect a response) ---------------------------------------
    /**
     * Methods handled by the request dispatcher (excludes initialize/reconnect
     * which are handled during the handshake phase).
     */
    this._requestHandlers = {
      subscribe: async (client, params) => {
        const classified = classifyChannel(params.channel);
        if (!classified) {
          return {};
        }
        if (classified.kind === "otlp-logs" /* OtlpLogs */) {
          if (!this._config.otlpLogEmitter) {
            this._logService.warn(`[ProtocolServer] Ignoring OTLP subscribe for ${params.channel}: no OTLP emitter configured.`);
            return {};
          }
          client.subscriptions.set(classified.uri, classified);
          return {};
        }
        if (classified.kind === "resource-watch" /* ResourceWatch */) {
          const descriptor = this._agentService.onResourceWatchSubscribed(classified.uri);
          if (!descriptor) {
            throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Resource watch not found: ${params.channel}`);
          }
          client.subscriptions.set(classified.uri, classified);
          return {
            snapshot: {
              resource: classified.uri,
              state: descriptor,
              fromSeq: this._stateManager.serverSeq
            }
          };
        }
        try {
          const snapshot = await this._agentService.subscribe(URI.parse(params.channel), client.clientId);
          client.subscriptions.set(classified.uri, classified);
          this._clearClientToolCallDisconnectTimeout(client.clientId, classified.uri);
          return { snapshot };
        } catch (err) {
          if (err instanceof ProtocolError) {
            throw err;
          }
          throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Resource not found: ${params.channel}`);
        }
      },
      createSession: async (_client, params) => {
        let createdSession;
        let fork;
        if (params.fork) {
          if (URI.parse(params.fork.session).toString() === URI.parse(params.channel).toString()) {
            throw new ProtocolError(AhpErrorCodes.SessionAlreadyExists, `Fork target session must differ from source session: ${params.channel}`);
          }
          const sourceState = this._stateManager.getSessionState(params.fork.session);
          if (!sourceState) {
            throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Fork source session not found: ${params.fork.session}`);
          }
          const turnIndex = sourceState.turns.findIndex((t) => t.id === params.fork.turnId);
          if (turnIndex < 0) {
            throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Fork turn ID ${params.fork.turnId} not found in session ${params.fork.session}`);
          }
          fork = { session: URI.parse(params.fork.session), turnIndex, turnId: params.fork.turnId };
        }
        if (params.activeClient && params.activeClient.clientId !== _client.clientId) {
          throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `createSession.activeClient.clientId must match the connection's clientId`);
        }
        try {
          createdSession = await this._agentService.createSession({
            provider: params.provider,
            _meta: params._meta,
            workingDirectories: params.workingDirectories?.map((d) => URI.parse(d)),
            session: URI.parse(params.channel),
            fork,
            config: params.config,
            activeClient: params.activeClient,
            progressToken: params.progressToken
          });
        } catch (err) {
          if (err instanceof ProtocolError) {
            throw err;
          }
          throw new ProtocolError(AHP_PROVIDER_NOT_FOUND, err instanceof Error ? err.message : String(err));
        }
        if (createdSession.toString() !== URI.parse(params.channel).toString()) {
          this._logService.warn(`[ProtocolServer] createSession: provider returned URI ${createdSession.toString()} but client requested ${params.channel}`);
        }
        return null;
      },
      disposeSession: async (_client, params) => {
        await this._agentService.disposeSession(URI.parse(params.channel));
        return null;
      },
      createChat: async (_client, params) => {
        const state = this._stateManager.getSessionState(params.channel);
        if (!state) {
          throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Session not found: ${params.channel}`);
        }
        const defaultChat = state.defaultChat ?? buildDefaultChatUri(params.channel);
        if (URI.parse(params.chat).toString() === URI.parse(defaultChat).toString()) {
          return null;
        }
        const source = params.source;
        let options;
        if (source) {
          switch (source.kind) {
            case ChatSourceKind.Fork:
              options = { fork: { source: URI.parse(source.chat), turnId: source.turnId } };
              break;
            case ChatSourceKind.SideChat:
              options = {
                sideChat: {
                  source: URI.parse(source.chat),
                  turnId: source.turnId,
                  ...source.selection ? { selection: source.selection } : {}
                }
              };
              break;
            default:
              throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Unsupported createChat source kind: ${String(source.kind)}`);
          }
        }
        await this._agentService.createChat(
          URI.parse(params.channel),
          URI.parse(params.chat),
          options
        );
        return null;
      },
      disposeChat: async (_client, params) => {
        const chat = URI.parse(params.channel);
        const parsed = parseChatUri(chat);
        if (!parsed) {
          return null;
        }
        await this._agentService.disposeChat(URI.parse(parsed.session), chat);
        return null;
      },
      resourceWrite: async (_client, params) => {
        return this._agentService.resourceWrite(params);
      },
      listSessions: async () => {
        const sessions = await this._agentService.listSessions();
        const items = sessions.map((s) => {
          const provider = AgentSession.provider(s.session);
          if (!provider) {
            throw new Error(`Agent session URI has no provider scheme: ${s.session.toString()}`);
          }
          return {
            resource: s.session.toString(),
            provider,
            title: s.summary ?? "Session",
            status: s.status ?? SessionStatus.Idle,
            activity: s.activity,
            createdAt: new Date(s.startTime).toISOString(),
            modifiedAt: new Date(s.modifiedTime).toISOString(),
            ...s.project ? { project: { uri: s.project.uri.toString(), displayName: s.project.displayName } } : {},
            workingDirectories: s.workingDirectories?.map((d) => d.toString()),
            changes: s.changes,
            // `_meta` carries the workspace-less marker, which seeds or
            // promotes the client's session kind and cannot be
            // re-derived from the (scratch) working directory.
            ...s._meta !== void 0 ? { _meta: s._meta } : {}
          };
        });
        return { items };
      },
      resolveSessionConfig: async (_client, params) => {
        return this._agentService.resolveSessionConfig({
          provider: params.provider,
          workingDirectory: params.workingDirectory ? URI.parse(params.workingDirectory) : void 0,
          config: params.config
        });
      },
      sessionConfigCompletions: async (_client, params) => {
        return this._agentService.sessionConfigCompletions({
          provider: params.provider,
          workingDirectory: params.workingDirectory ? URI.parse(params.workingDirectory) : void 0,
          config: params.config,
          property: params.property,
          query: params.query
        });
      },
      completions: async (_client, params) => {
        return this._agentService.completions(params);
      },
      fetchTurns: async (_client, params) => {
        const state = this._stateManager.getChatState(params.channel);
        if (!state) {
          throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Session not found: ${params.channel}`);
        }
        if (params.cursor && params.cursor !== state.turnsNextCursor) {
          throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Unrecognized fetchTurns cursor`);
        }
        this._stateManager.dispatchServerAction(params.channel, {
          type: ActionType.ChatTurnsLoaded,
          turns: []
        });
        return {};
      },
      resourceList: async (_client, params) => {
        return this._agentService.resourceList(URI.parse(params.uri));
      },
      resourceRead: async (_client, params) => {
        return this._agentService.resourceRead(URI.parse(params.uri));
      },
      resourceCopy: async (_client, params) => {
        return this._agentService.resourceCopy(params);
      },
      resourceDelete: async (_client, params) => {
        return this._agentService.resourceDelete(params);
      },
      resourceMove: async (_client, params) => {
        return this._agentService.resourceMove(params);
      },
      resourceResolve: async (_client, params) => {
        return this._agentService.resourceResolve(params);
      },
      resourceMkdir: async (_client, params) => {
        return this._agentService.resourceMkdir(params);
      },
      createResourceWatch: async (_client, params) => {
        return this._agentService.createResourceWatch(params);
      },
      resourceRequest: async (_client, _params) => {
        return {};
      },
      authenticate: async (_client, params) => {
        const result = await this._agentService.authenticate(params);
        if (!result.authenticated) {
          throw new ProtocolError(AHP_AUTH_REQUIRED, `Authentication failed for resource: ${params.resource}`);
        }
        return {};
      },
      createTerminal: async (_client, params) => {
        await this._agentService.createTerminal(params);
        return null;
      },
      disposeTerminal: async (_client, params) => {
        await this._agentService.disposeTerminal(URI.parse(params.channel));
        return null;
      },
      invokeChangesetOperation: async (_client, params) => {
        return this._agentService.invokeChangesetOperation(params);
      }
    };
    // ---- Reverse RPC (server → client requests) ----------------------------
    this._reverseRequestId = 0;
    this._pendingReverseRequests = /* @__PURE__ */ new Map();
    this._telemetryReporter = new AgentHostTelemetryReporter(telemetryService);
    this._connectionTelemetryTracker = this._config.connectionTelemetryTracker ?? this._register(new AgentHostClientConnectionTelemetryTracker());
    this._register(this._server.onConnection((transport) => {
      this._handleNewConnection(transport);
    }));
    this._register(this._stateManager.onDidEmitEnvelope((envelope) => {
      this._replayBuffer.push(envelope);
      if (this._replayBuffer.length > REPLAY_BUFFER_CAPACITY) {
        this._replayBuffer.shift();
      }
      this._broadcastAction(envelope);
      if (envelope.action.type === ActionType.ChatToolCallStart || envelope.action.type === ActionType.ChatToolCallReady) {
        if (!isAhpChatChannel(envelope.channel)) {
          throw new Error(`[ProtocolServer] Chat tool-call action emitted on non-chat channel: ${envelope.channel}`);
        }
        this._checkOrphanedClientToolCalls(parseRequiredSessionUriFromChatUri(envelope.channel), envelope.channel);
      }
    }));
    this._register(this._stateManager.onDidEmitNotification((notification) => {
      this._broadcastNotification(notification);
    }));
    this._register(this._agentService.onMcpNotification((notification) => {
      this._broadcastMcpNotification(notification);
    }));
    if (this._config.otlpLogEmitter) {
      this._register(this._config.otlpLogEmitter.onDidLog((record) => this._broadcastOtlpLog(record)));
    }
  }
  // ---- Connection handling -------------------------------------------------
  _handleNewConnection(transport) {
    const disposables = new DisposableStore();
    let client;
    disposables.add(transport.onMessage((msg) => {
      if (isJsonRpcRequest(msg)) {
        this._logService.trace(`[ProtocolServer] request: method=${msg.method} id=${msg.id}`);
        if (msg.method === "ping") {
          transport.send(jsonRpcSuccess(msg.id, null));
          return;
        }
        if (!client && msg.method === "initialize") {
          try {
            const result = this._handleInitialize(msg.params, transport, disposables);
            client = result.client;
            transport.send(jsonRpcSuccess(msg.id, result.response));
          } catch (err) {
            transport.send(jsonRpcErrorFrom(msg.id, err));
          }
          return;
        }
        if (!client && msg.method === "reconnect") {
          let responsePromise;
          try {
            const result = this._handleReconnect(msg.params, transport, disposables);
            client = result.client;
            responsePromise = result.responsePromise;
          } catch (err) {
            transport.send(jsonRpcErrorFrom(msg.id, err));
            return;
          }
          responsePromise.then(
            (response) => transport.send(jsonRpcSuccess(msg.id, response)),
            (err) => transport.send(jsonRpcErrorFrom(msg.id, err))
          );
          return;
        }
        if (msg.method === VSCODE_UPGRADE_METHOD) {
          this._handleVscodeUpgrade(msg.id, transport);
          return;
        }
        if (!client) {
          transport.send(jsonRpcError(msg.id, JsonRpcErrorCodes.MethodNotFound, `Method not found: ${msg.method}`));
          return;
        }
        this._handleRequest(client, msg.method, msg.params, msg.id);
      } else if (isJsonRpcNotification(msg)) {
        this._logService.trace(`[ProtocolServer] notification: method=${msg.method}`);
        switch (msg.method) {
          case "unsubscribe":
            if (client) {
              this._removeSubscription(client, msg.params.channel);
            }
            break;
          case "dispatchAction":
            if (client) {
              this._logService.trace(`[ProtocolServer] dispatchAction: ${JSON.stringify(msg.params.action.type)}`);
              const action = msg.params.action;
              const channel = msg.params.channel;
              if (UNSUPPORTED_CLIENT_ACTION_TYPES.has(action.type)) {
                this._logService.warn(`[ProtocolServer] rejecting unsupported client action: ${action.type}`);
                this._stateManager.rejectClientAction(
                  channel,
                  action,
                  { clientId: client.clientId, clientSeq: msg.params.clientSeq },
                  `Unsupported action: ${action.type}`
                );
              } else if (isSessionAction(action) || isChatAction(action) || isTerminalAction(action) || isChangesetAction(action) || isAnnotationsAction(action) || action.type === ActionType.RootConfigChanged) {
                this._agentService.dispatchAction(channel, action, client.clientId, msg.params.clientSeq, client.telemetryContext);
              }
            }
            break;
        }
      } else if (isJsonRpcResponse(msg)) {
        const pending = this._pendingReverseRequests.get(msg.id);
        if (pending && pending.client === client) {
          this._pendingReverseRequests.delete(msg.id);
          if (hasKey(msg, { error: true })) {
            pending.reject(new ProtocolError(
              msg.error?.code ?? -32e3,
              msg.error?.message ?? "Reverse RPC error",
              msg.error?.data
            ));
          } else {
            pending.resolve(msg.result);
          }
        }
      }
    }));
    disposables.add(transport.onClose(() => {
      const record = client ? this._clients.get(client.clientId) : void 0;
      if (client && record?.state === "active") {
        const connectionIndex = record.connections.indexOf(client);
        if (connectionIndex !== -1) {
          const subscriptionCount = client.subscriptions.size;
          record.connections.splice(connectionIndex, 1);
          this._releaseClientSubscriptions(client, record);
          this._rejectPendingReverseRequestsForConnection(client);
          if (record.connections.length === 0) {
            this._logService.info(`[ProtocolServer] Client disconnected: ${client.clientId}, subscriptions=${subscriptionCount}`);
            this._clients.set(client.clientId, {
              state: "grace",
              clientInfo: record.clientInfo,
              telemetryContext: client.telemetryContext,
              protocolVersion: client.protocolVersion,
              lastSeenAt: Date.now(),
              disconnectTimeouts: new DisposableMap()
            });
            this._handleClientDisconnected(client.clientId);
            this._onDidChangeConnectionCount.fire(this._connectedClientCount);
          }
          this._reportClientDisconnected(client, subscriptionCount);
        }
      }
      disposables.dispose();
    }));
    disposables.add(transport);
  }
  // ---- Handshake handlers ----------------------------------------------------
  _handleInitialize(params, transport, disposables) {
    const offered = Array.isArray(params.protocolVersions) ? params.protocolVersions : [];
    this._logService.info(`[ProtocolServer] Initialize: clientId=${params.clientId}, protocolVersions=[${offered.join(", ")}]`);
    const negotiated = negotiateProtocolVersion(offered, PROTOCOL_VERSION);
    if (!negotiated) {
      const data = {
        supportedVersions: [`^${PROTOCOL_VERSION}`],
        // Only advertise the in-band upgrade method when the agent
        // host was spawned by a VS Code CLI that is listening for
        // management requests (presence of the env var). Otherwise
        // there is no supervisor to actually act on it, so don't
        // lie to the client.
        _meta: getAgentHostManagementSocketPath() ? { vscodeUpgradeMethod: VSCODE_UPGRADE_METHOD } : void 0
      };
      throw new ProtocolError(
        AHP_UNSUPPORTED_PROTOCOL_VERSION,
        `Client offered protocol versions [${offered.join(", ")}], none of which are compatible with this server's version ${PROTOCOL_VERSION} (server accepts ^${PROTOCOL_VERSION}).`,
        data
      );
    }
    const previousRecord = this._clients.get(params.clientId);
    const telemetryTransportToken = {};
    const initializationDisposables = disposables.add(new DisposableStore());
    const telemetryContext = this._createClientTelemetryContext(params.clientInfo, params._meta, transport);
    const client = {
      clientId: params.clientId,
      clientInfo: params.clientInfo,
      telemetryContext,
      protocolVersion: negotiated,
      transport,
      connectionStopWatch: StopWatch.create(true),
      telemetryTransportToken,
      isReconnect: this._connectionTelemetryTracker.hasSeenClient(params.clientId),
      telemetryConnectionActive: false,
      subscriptions: /* @__PURE__ */ new Map(),
      disposables,
      initializationDisposables
    };
    this._attachConnection(params.clientId, client);
    try {
      this._registerClientFileSystemAuthority(params.clientId, initializationDisposables);
      const snapshots = [];
      if (params.initialSubscriptions) {
        for (const uri of params.initialSubscriptions) {
          const snapshot = this._addInitialSubscription(client, uri.toString());
          if (snapshot) {
            snapshots.push(snapshot);
          }
        }
      }
      const counts = this._connectionTelemetryTracker.connect(params.clientId, telemetryTransportToken);
      client.telemetryConnectionActive = true;
      if (previousRecord?.state === "grace") {
        previousRecord.disconnectTimeouts.dispose();
      }
      this._onDidChangeConnectionCount.fire(this._connectedClientCount);
      this._telemetryReporter.clientConnection({
        action: "connected",
        context: telemetryContext,
        clientId: client.clientId,
        clientImplementationName: client.clientInfo?.name,
        clientImplementationVersion: client.clientInfo?.version,
        protocolVersion: client.protocolVersion,
        ...counts
      });
      return {
        client,
        response: {
          protocolVersion: negotiated,
          serverSeq: this._stateManager.serverSeq,
          snapshots,
          defaultDirectory: this._config.defaultDirectory,
          completionTriggerCharacters: this._config.completionTriggerCharacters,
          terminalCommandPrefix: this._config.terminalCommandPrefix,
          telemetry: this._config.otlpLogEmitter ? { logs: OTLP_LOGS_CHANNEL_TEMPLATE } : void 0
        }
      };
    } catch (error) {
      this._rollbackFailedInitialization(client, previousRecord);
      throw error;
    }
  }
  /**
   * Helper for `initialize` and `reconnect` initial-subscription
   * processing: classify `channel`, install the matching subscription
   * on the client, and return the snapshot to include in the handshake
   * response (or `undefined` for stateless channels and missing state).
   *
   * Side effects:
   * - State channels: register with the agent service and clear any
   *   pending tool-call disconnect timeout.
   * - OTLP channels: install the canonical entry on the client's
   *   {@link IConnectedClient.subscriptions} map.
   *
   * Channels with unsupported shapes (e.g. `ahp-otlp://logs/verbose`
   * with no recognised level) are silently dropped. Valid state channels
   * remain subscribed even when their snapshot has not materialized yet.
   */
  _addInitialSubscription(client, channel) {
    const sub = classifyChannel(channel);
    if (!sub) {
      return void 0;
    }
    if (sub.kind === "otlp-logs" /* OtlpLogs */) {
      if (!this._config.otlpLogEmitter) {
        this._logService.warn(`[ProtocolServer] Ignoring OTLP initialSubscription ${channel}: no OTLP emitter configured.`);
        return void 0;
      }
      client.subscriptions.set(sub.uri, sub);
      return void 0;
    }
    const snapshot = this._stateManager.getSnapshot(channel);
    client.subscriptions.set(sub.uri, sub);
    this._agentService.addSubscriber(URI.parse(sub.uri), client.clientId);
    this._clearClientToolCallDisconnectTimeout(client.clientId, sub.uri);
    return snapshot;
  }
  /**
   * Forwards a client's upgrade request to the hosting VS Code CLI's
   * HTTP management API (advertised via the {@link VSCODE_AGENT_HOST_MANAGEMENT_SOCKET_ENV}).
   * Returns the CLI's parsed response verbatim so the client can render
   * a meaningful status (already up-to-date, restart scheduled, etc.).
   *
   * When the server was not spawned by a managing CLI, responds with
   * `MethodNotFound` — the upgrade method is only meaningfully callable
   * on CLI-hosted servers.
   */
  _handleVscodeUpgrade(id, transport) {
    const socketPath = getAgentHostManagementSocketPath();
    if (!socketPath) {
      transport.send(jsonRpcError(
        id,
        JsonRpcErrorCodes.MethodNotFound,
        `No upgrade supervisor is available for this agent host.`
      ));
      return;
    }
    requestAgentHostUpgrade(socketPath).then(
      (result) => transport.send(jsonRpcSuccess(id, result)),
      (err) => {
        this._logService.warn(`[ProtocolServer] vscodeUpgrade signal failed: ${err instanceof Error ? err.message : String(err)}`);
        transport.send(jsonRpcErrorFrom(id, err));
      }
    );
  }
  _handleReconnect(params, transport, disposables) {
    this._logService.info(`[ProtocolServer] Reconnect: clientId=${params.clientId}, lastSeenSeq=${params.lastSeenServerSeq}`);
    const existingRecord = this._clients.get(params.clientId);
    if (!existingRecord) {
      throw new ProtocolError(AhpErrorCodes.NotFound, `Reconnect client not found: ${params.clientId}`);
    }
    const priorTelemetryContext = existingRecord.state === "active" ? existingRecord.connections.at(-1)?.telemetryContext : existingRecord.telemetryContext;
    const priorProtocolVersion = existingRecord.state === "active" ? existingRecord.connections.at(-1)?.protocolVersion : existingRecord.protocolVersion;
    const telemetryTransportToken = {};
    const initializationDisposables = disposables.add(new DisposableStore());
    const client = {
      clientId: params.clientId,
      clientInfo: existingRecord.clientInfo,
      telemetryContext: this._createClientTelemetryContext(existingRecord.clientInfo, params._meta, transport, priorTelemetryContext?.connectionKind),
      protocolVersion: priorProtocolVersion ?? PROTOCOL_VERSION,
      transport,
      connectionStopWatch: StopWatch.create(true),
      telemetryTransportToken,
      isReconnect: true,
      telemetryConnectionActive: false,
      subscriptions: /* @__PURE__ */ new Map(),
      disposables,
      initializationDisposables
    };
    this._attachConnection(params.clientId, client);
    try {
      this._registerClientFileSystemAuthority(params.clientId, initializationDisposables);
      const oldestBuffered = this._replayBuffer.length > 0 ? this._replayBuffer[0].serverSeq : this._stateManager.serverSeq;
      const canReplay = params.lastSeenServerSeq >= oldestBuffered;
      const responsePromise = this._restoreReconnectSubscriptions(client, params, canReplay);
      const counts = this._connectionTelemetryTracker.connect(params.clientId, telemetryTransportToken);
      client.telemetryConnectionActive = true;
      if (existingRecord.state === "grace") {
        existingRecord.disconnectTimeouts.dispose();
      }
      this._onDidChangeConnectionCount.fire(this._connectedClientCount);
      this._telemetryReporter.clientConnection({
        action: "connected",
        context: client.telemetryContext,
        clientId: client.clientId,
        clientImplementationName: client.clientInfo?.name,
        clientImplementationVersion: client.clientInfo?.version,
        protocolVersion: client.protocolVersion,
        ...counts
      });
      return { client, responsePromise };
    } catch (error) {
      this._rollbackFailedInitialization(client, existingRecord);
      throw error;
    }
  }
  /**
   * Wires the reverse-RPC filesystem callbacks for `clientId` and binds
   * the unregister to `disposables` (the transport's per-connection
   * store). The callbacks dispatch through {@link _sendReverseRequest},
   * which looks up the *current* connected client by id — so re-binding
   * after a reconnect picks up the new transport without rebuilding the
   * closures.
   */
  _registerClientFileSystemAuthority(clientId, disposables) {
    disposables.add(this._clientFileSystemProvider.registerAuthority(clientId, {
      resourceList: (uri) => this._sendReverseRequest(clientId, "resourceList", { uri: uri.toString() }),
      resourceRead: (uri) => this._sendReverseRequest(clientId, "resourceRead", { uri: uri.toString() }),
      resourceWrite: (params_) => this._sendReverseRequest(clientId, "resourceWrite", params_),
      resourceCopy: (params_) => this._sendReverseRequest(clientId, "resourceCopy", params_),
      resourceDelete: (params_) => this._sendReverseRequest(clientId, "resourceDelete", params_),
      resourceMove: (params_) => this._sendReverseRequest(clientId, "resourceMove", params_),
      resourceRequest: (params_) => this._sendReverseRequest(clientId, "resourceRequest", params_),
      resourceResolve: (params_) => this._sendReverseRequest(clientId, "resourceResolve", params_),
      resourceMkdir: (params_) => this._sendReverseRequest(clientId, "resourceMkdir", params_)
    }));
  }
  /**
   * Re-establish each of the client's prior subscriptions on the server side.
   * Uses {@link IAgentService.subscribe} (rather than a bare `addSubscriber`
   * + `getSnapshot`) so any session state that was evicted while the client
   * was disconnected is restored. Returns the appropriate reconnect response
   * payload — `replay` actions when the client's last-seen seq is still in
   * the buffer, otherwise fresh `snapshot`s.
   */
  async _restoreReconnectSubscriptions(client, params, canReplay) {
    const missing = [];
    const snapshots = await Promise.all(params.subscriptions.map(async (sub) => {
      const key = sub.toString();
      const classified = classifyChannel(key);
      if (!classified) {
        return void 0;
      }
      if (classified.kind === "otlp-logs" /* OtlpLogs */) {
        if (!this._config.otlpLogEmitter) {
          this._logService.warn(`[ProtocolServer] Reconnect: dropping OTLP subscription ${key}: no OTLP emitter configured.`);
          return void 0;
        }
        client.subscriptions.set(classified.uri, classified);
        return void 0;
      }
      if (classified.kind === "resource-watch" /* ResourceWatch */) {
        const descriptor = this._agentService.onResourceWatchSubscribed(classified.uri);
        if (!descriptor) {
          this._logService.info(`[ProtocolServer] Reconnect: resource watch ${key} no longer parses`);
          missing.push(sub);
          return void 0;
        }
        client.subscriptions.set(classified.uri, classified);
        return {
          resource: classified.uri,
          state: descriptor,
          fromSeq: this._stateManager.serverSeq
        };
      }
      try {
        const snapshot = await this._agentService.subscribe(URI.parse(key), client.clientId);
        client.subscriptions.set(classified.uri, classified);
        this._clearClientToolCallDisconnectTimeout(client.clientId, classified.uri);
        return snapshot;
      } catch (err) {
        this._logService.info(`[ProtocolServer] Reconnect: failed to restore subscription ${key}: ${err instanceof Error ? err.message : String(err)}`);
        missing.push(sub);
        return void 0;
      }
    }));
    this._reconcileActiveClientsAfterReconnect(client);
    if (canReplay) {
      const actions = [];
      for (const envelope of this._replayBuffer) {
        if (envelope.serverSeq > params.lastSeenServerSeq) {
          if (this._isRelevantToClient(client, envelope)) {
            actions.push(envelope);
          }
        }
      }
      return { type: "replay", actions, missing };
    }
    return { type: "snapshot", snapshots: snapshots.filter((s) => s !== void 0) };
  }
  /**
   * Release a client from every session where it is still an active client
   * but did not resubscribe during a reconnect. The set of resubscribed
   * sessions is gathered from every live connection the client currently
   * holds (not just the reconnecting one) so an overlapping connection that
   * still subscribes to a session keeps the client active there.
   */
  _reconcileActiveClientsAfterReconnect(client) {
    const record = this._clients.get(client.clientId);
    const resubscribed = /* @__PURE__ */ new Set();
    for (const connection of record?.state === "active" ? record.connections : [client]) {
      for (const sub of connection.subscriptions.values()) {
        if (sub.kind === "state" /* State */) {
          resubscribed.add(sub.uri);
        }
      }
    }
    for (const session of this._stateManager.getSessionUris()) {
      const state = this._stateManager.getSessionState(session);
      if (state && this._isActiveClient(state, client.clientId)) {
        for (const chat of state.chats) {
          if (!resubscribed.has(session) && !resubscribed.has(chat.resource)) {
            this._releaseActiveClientForSession(session, client.clientId, chat.resource);
          }
        }
      }
    }
  }
  _handleClientDisconnected(clientId) {
    for (const session of this._stateManager.getSessionUris()) {
      const state = this._stateManager.getSessionState(session);
      const isActive = state ? this._isActiveClient(state, clientId) : false;
      const ownsPendingToolCall = state ? this._hasPendingClientToolCall(state, clientId) : false;
      if (isActive || ownsPendingToolCall) {
        for (const chat of state?.chats ?? []) {
          this._startClientToolCallDisconnectTimeout(clientId, session, chat.resource);
        }
      }
    }
  }
  /** Whether `clientId` is one of the session's active clients. */
  _isActiveClient(state, clientId) {
    return state.activeClients.some((c) => c.clientId === clientId);
  }
  /**
   * Remove `clientId` from a session's active clients, if present. Dispatched
   * as a server action so the removal is reflected in state and broadcast to
   * the remaining subscribers.
   */
  _removeActiveClient(session, clientId) {
    const state = this._stateManager.getSessionState(session);
    if (state && this._isActiveClient(state, clientId)) {
      this._stateManager.dispatchServerAction(session, {
        type: ActionType.SessionActiveClientRemoved,
        clientId
      });
    }
  }
  /**
   * Release a client from a session: clear its pending disconnect timeout,
   * fail any client tool calls it still owns, and remove it from the active
   * clients. Used by the explicit-unsubscribe and reconnect-reconciliation
   * paths to drop a client that has left a session.
   */
  _releaseActiveClientForSession(session, clientId, chatChannel) {
    this._clearClientToolCallDisconnectTimeout(clientId, chatChannel);
    this._completeDisconnectedClientToolCalls(clientId, session, chatChannel);
    this._removeActiveClient(session, clientId);
  }
  /**
   * Yields every still-pending client-contributed tool call in `state`'s
   * active turn, paired with its owning `clientId`. Single source of truth
   * for the disconnect-grace machinery: detect ownership
   * ({@link _hasPendingClientToolCall}), arm timeouts
   * ({@link _checkOrphanedClientToolCalls}), and fail orphaned calls
   * ({@link _completeDisconnectedClientToolCalls}).
   */
  *_pendingClientToolCalls(state) {
    const activeTurn = state?.activeTurn;
    if (!activeTurn) {
      return;
    }
    for (const part of activeTurn.responseParts) {
      if (part.kind !== ResponsePartKind.ToolCall) {
        continue;
      }
      const toolCall = part.toolCall;
      const contributor = toolCall.contributor;
      if (contributor?.kind === ToolCallContributorKind.Client && isPendingToolCallStatus(toolCall.status)) {
        yield { toolCall, clientId: contributor.clientId };
      }
    }
  }
  _hasPendingClientToolCall(state, clientId) {
    for (const pending of this._pendingClientToolCalls(state)) {
      if (pending.clientId === clientId) {
        return true;
      }
    }
    return false;
  }
  _hasReplacementActiveClientTool(state, clientId, toolName) {
    return state.activeClients.some((client) => client.clientId !== clientId && client.tools.some((tool) => tool.name === toolName));
  }
  /**
   * Arm (or re-arm) the per-(clientId, session) timeout that fails pending
   * client tool calls owned by `clientId` if it does not reconnect before the
   * grace window elapses. Only meaningful for a client with no live transport:
   * a connected client is handled by {@link _attachConnection}, which disposes
   * any armed timers, so this is a no-op when the client is active. The delay
   * is the remaining grace measured from when the client disconnected — so a
   * client that disconnected a while before the call was issued gets the
   * residual window rather than a fresh one, and a stamp from a long-disconnected
   * client fails promptly. Re-arms triggered by later orphaned tool calls in the
   * same session shrink the remaining window instead of resetting it.
   */
  _startClientToolCallDisconnectTimeout(clientId, session, chatChannel) {
    const record = this._ensureGraceRecord(clientId);
    if (!record) {
      return;
    }
    record.disconnectTimeouts.deleteAndDispose(chatChannel);
    const elapsed = Date.now() - record.lastSeenAt;
    const delay = Math.max(0, CLIENT_TOOL_CALL_DISCONNECT_TIMEOUT - elapsed);
    record.disconnectTimeouts.set(chatChannel, disposableTimeout(() => {
      this._releaseActiveClientForSession(session, clientId, chatChannel);
    }, delay));
  }
  /**
   * Scan a chat for pending client tool calls owned by a disconnected client
   * of this protocol server, and arm the disconnect timeout for each owner.
   * Called when a `ChatToolCallStart` / `ChatToolCallReady` envelope is
   * observed — covering calls issued for an already-gone client, which the
   * live disconnect path never sees. Ownerless client tool calls (no client
   * connected at stamp time) are failed immediately by the provider, so they
   * never reach a pending state here. Unknown client ids are ignored because
   * they may belong to another transport such as local IPC.
   */
  _checkOrphanedClientToolCalls(session, chatChannel) {
    const state = this._stateManager.getSessionState(chatChannel);
    const orphanOwners = /* @__PURE__ */ new Set();
    for (const { clientId } of this._pendingClientToolCalls(state)) {
      const ownerRecord = this._clients.get(clientId);
      if (ownerRecord?.state === "grace") {
        orphanOwners.add(clientId);
      }
    }
    for (const ownerId of orphanOwners) {
      this._startClientToolCallDisconnectTimeout(ownerId, session, chatChannel);
    }
  }
  /**
   * Register a freshly connected (or reconnected) transport for `clientId`,
   * promoting the record to {@link IActiveClientRecord}. Promoting a grace
   * record back to active disposes its pending disconnect timers: the
   * disconnect-grace window only applies while the client has no live
   * transport. This is the single place that maintains the "active records
   * hold no grace timers" invariant.
   */
  _attachConnection(clientId, client) {
    const existing = this._clients.get(clientId);
    if (existing?.state === "active") {
      existing.connections.push(client);
      existing.clientInfo = client.clientInfo ?? existing.clientInfo;
    } else {
      this._clients.set(clientId, { state: "active", clientInfo: client.clientInfo ?? existing?.clientInfo, connections: [client] });
    }
    this._pruneClientRecords();
  }
  _rollbackFailedInitialization(client, previousRecord) {
    const record = this._clients.get(client.clientId);
    if (record?.state === "active") {
      const connectionIndex = record.connections.indexOf(client);
      if (connectionIndex !== -1) {
        record.connections.splice(connectionIndex, 1);
        this._releaseClientSubscriptions(client, record);
        this._rejectPendingReverseRequestsForConnection(client);
      }
      if (record.connections.length === 0) {
        if (previousRecord?.state === "grace") {
          this._clients.set(client.clientId, previousRecord);
        } else {
          this._clients.delete(client.clientId);
        }
      }
    }
    client.initializationDisposables.dispose();
  }
  /**
   * Return the existing grace record for `clientId`, creating one for a
   * never-connected client (an orphan tool-call stamp). Returns `undefined`
   * when the client is currently active — the grace machinery does not apply
   * to a connected client. A newly created record pins its grace clock to now.
   */
  _ensureGraceRecord(clientId) {
    const record = this._clients.get(clientId);
    if (record?.state === "active") {
      return void 0;
    }
    if (record) {
      return record;
    }
    const created = {
      state: "grace",
      clientInfo: void 0,
      telemetryContext: void 0,
      protocolVersion: void 0,
      lastSeenAt: Date.now(),
      disconnectTimeouts: new DisposableMap()
    };
    this._clients.set(clientId, created);
    return created;
  }
  _getActiveClient(clientId) {
    return this._getActiveClientFromRecord(this._clients.get(clientId));
  }
  _getActiveClientFromRecord(record) {
    if (record?.state !== "active") {
      return void 0;
    }
    return record.connections[record.connections.length - 1];
  }
  _releaseClientSubscriptions(client, record) {
    for (const sub of client.subscriptions.values()) {
      if (sub.kind === "state" /* State */) {
        if (this._hasSubscriptionInOtherConnection(record, client, sub.uri)) {
          continue;
        }
        this._agentService.unsubscribe(URI.parse(sub.uri), client.clientId);
      } else if (sub.kind === "resource-watch" /* ResourceWatch */) {
        this._agentService.onResourceWatchUnsubscribed(sub.uri);
      }
    }
    client.subscriptions.clear();
  }
  _hasSubscriptionInOtherConnection(record, client, uri) {
    if (record.state !== "active") {
      return false;
    }
    for (const other of record.connections) {
      if (other !== client && other.subscriptions.has(uri)) {
        return true;
      }
    }
    return false;
  }
  /** Number of clients that currently have a live connection. */
  get _connectedClientCount() {
    let count = 0;
    for (const record of this._clients.values()) {
      if (record.state === "active") {
        count++;
      }
    }
    return count;
  }
  _createClientTelemetryContext(clientInfo, meta, transport, fallbackConnectionKind = AgentHostClientConnectionKind.Unknown) {
    const connectionKind = readClientConnectionKind(meta);
    return {
      clientType: getAgentHostClientType(clientInfo),
      connectionKind: connectionKind === AgentHostClientConnectionKind.Unknown ? fallbackConnectionKind : connectionKind,
      transportKind: transport.transportKind ?? AgentHostTransportKind.Unknown,
      hostLaunchKind: this._config.hostLaunchKind ?? AgentHostLaunchKind.Unknown
    };
  }
  _reportClientDisconnected(client, subscriptionCount) {
    if (!client.telemetryConnectionActive) {
      return;
    }
    client.telemetryConnectionActive = false;
    const counts = this._connectionTelemetryTracker.disconnect(client.clientId, client.telemetryTransportToken);
    this._telemetryReporter.clientConnection({
      action: "disconnected",
      context: client.telemetryContext,
      clientId: client.clientId,
      clientImplementationName: client.clientInfo?.name,
      clientImplementationVersion: client.clientInfo?.version,
      protocolVersion: client.protocolVersion,
      isReconnect: client.isReconnect,
      ...counts,
      connectionDurationMs: client.connectionStopWatch.elapsed(),
      subscriptionCount
    });
  }
  /**
   * Drop grace records whose timers have all fired and whose last-seen time is
   * stale beyond the retention window (10× the disconnect timeout). This
   * covers both genuinely-disconnected clients and never-connected orphan
   * stamps. Bounds {@link _clients} without tracking liveness precisely — a
   * pruned-then-resurfacing stamp simply falls back to the full grace window.
   * Active records are never pruned; they persist until their last transport
   * closes.
   */
  _pruneClientRecords() {
    const cutoff = Date.now() - AGENT_HOST_CLIENT_CONNECTION_HISTORY_RETENTION;
    for (const [clientId, record] of this._clients) {
      if (record.state === "grace" && record.disconnectTimeouts.size === 0 && record.lastSeenAt < cutoff) {
        this._clients.delete(clientId);
      }
    }
  }
  _clearClientToolCallDisconnectTimeout(clientId, channel) {
    const record = this._clients.get(clientId);
    if (record?.state === "grace") {
      record.disconnectTimeouts.deleteAndDispose(channel);
    }
  }
  _completeDisconnectedClientToolCalls(clientId, session, chatChannel) {
    const state = this._stateManager.getSessionState(chatChannel);
    const activeTurn = state?.activeTurn;
    if (!state || !activeTurn) {
      return;
    }
    for (const { toolCall, clientId: ownerId } of this._pendingClientToolCalls(state)) {
      if (ownerId !== clientId) {
        continue;
      }
      const mayRetryWithReplacementClient = this._hasReplacementActiveClientTool(state, clientId, toolCall.toolName);
      if (toolCall.status === ToolCallStatus.Streaming) {
        this._stateManager.dispatchServerAction(chatChannel, {
          type: ActionType.ChatToolCallReady,
          turnId: activeTurn.id,
          toolCallId: toolCall.toolCallId,
          invocationMessage: toolCall.invocationMessage ?? toolCall.displayName,
          confirmed: ToolCallConfirmationReason.NotNeeded
        });
      }
      this._stateManager.dispatchServerAction(chatChannel, {
        type: ActionType.ChatToolCallComplete,
        turnId: activeTurn.id,
        toolCallId: toolCall.toolCallId,
        result: {
          success: false,
          pastTenseMessage: `${toolCall.displayName} failed`,
          ...mayRetryWithReplacementClient ? { content: [{ type: ToolResultContentType.Text, text: `The client that was running ${toolCall.displayName} disconnected, but another active client now provides ${toolCall.displayName}. You may try calling the tool again.` }] } : {},
          error: { message: `Client ${clientId} disconnected before completing ${toolCall.displayName}` }
        }
      });
    }
  }
  /**
   * Sends a JSON-RPC request to a connected client and waits for the response.
   * Used for reverse-RPC operations like reading client-side files.
   * Rejects if the client disconnects or the server is disposed.
   */
  _sendReverseRequest(clientId, method, params) {
    const client = this._getActiveClient(clientId);
    if (!client) {
      return Promise.reject(new Error(`Client ${clientId} is not connected`));
    }
    const id = ++this._reverseRequestId;
    return new Promise((resolve, reject) => {
      this._pendingReverseRequests.set(id, { client, resolve, reject });
      const request = { jsonrpc: "2.0", id, method, params };
      client.transport.send(request);
    });
  }
  /**
   * Rejects and clears all pending reverse-RPC requests sent over a given
   * connection.
   */
  _rejectPendingReverseRequestsForConnection(client) {
    for (const [id, pending] of this._pendingReverseRequests) {
      if (pending.client === client) {
        this._pendingReverseRequests.delete(id);
        pending.reject(new Error(`Client ${client.clientId} disconnected`));
      }
    }
  }
  _handleRequest(client, method, params, id) {
    const handler = this._requestHandlers.hasOwnProperty(method) ? this._requestHandlers[method] : void 0;
    if (handler) {
      handler(client, params).then((result) => {
        this._logService.trace(`[ProtocolServer] Request '${method}' id=${id} succeeded`);
        client.transport.send(jsonRpcSuccess(id, result ?? null));
      }).catch((err) => {
        if (shouldLogFailedRequest(method, params, err)) {
          this._logService.error(`[ProtocolServer] Request '${method}' failed`, err);
        }
        client.transport.send(jsonRpcErrorFrom(id, err));
      });
      return;
    }
    const extensionResult = this._handleExtensionRequest(method, params);
    if (extensionResult) {
      extensionResult.then((result) => {
        client.transport.send(jsonRpcSuccess(id, result ?? null));
      }).catch((err) => {
        this._logService.error(`[ProtocolServer] Extension request '${method}' failed`, err);
        client.transport.send(jsonRpcErrorFrom(id, err));
      });
      return;
    }
    const mcpChannel = readMcpChannel(params);
    if (mcpChannel !== void 0) {
      const paramsObj = isParamsObject(params) ? params : void 0;
      this._agentService.handleMcpRequest(mcpChannel, method, paramsObj).then((result) => {
        client.transport.send(jsonRpcSuccess(id, result ?? null));
      }).catch((err) => {
        if (err instanceof Error && err.message.startsWith("Method not found")) {
          client.transport.send(jsonRpcError(id, JsonRpcErrorCodes.MethodNotFound, err.message));
          return;
        }
        this._logService.error(`[ProtocolServer] mcp:// request '${method}' on ${mcpChannel} failed`, err);
        client.transport.send(jsonRpcErrorFrom(id, err));
      });
      return;
    }
    client.transport.send(jsonRpcError(id, JsonRpcErrorCodes.MethodNotFound, `Method not found: ${method}`));
  }
  /**
   * Handle VS Code extension methods that are not yet part of the typed
   * protocol. Returns a Promise if the method was recognized, undefined
   * otherwise.
   */
  _handleExtensionRequest(method, params) {
    if (this._config.allowExtensionMethods === false) {
      return void 0;
    }
    switch (method) {
      case "shutdown":
        return this._agentService.shutdown();
      case "getNetworkDiagnosticsInfo":
        return this._agentService.getNetworkDiagnosticsInfo();
      case "getManagedSettingsDiagnostics":
        return this._agentService.getManagedSettingsDiagnostics();
      case "diagnosticsFetch":
        return this._agentService.diagnosticsFetch(params.url);
      default:
        return void 0;
    }
  }
  // ---- Broadcasting -------------------------------------------------------
  _broadcastAction(envelope) {
    this._logService.trace(`[ProtocolServer] Broadcasting action: ${envelope.action.type}`);
    const msg = { jsonrpc: "2.0", method: "action", params: envelope };
    for (const record of this._clients.values()) {
      const client = this._getActiveClientFromRecord(record);
      if (client && this._isRelevantToClient(client, envelope)) {
        client.transport.send(msg);
      }
    }
  }
  _broadcastNotification(notification) {
    const { type, ...params } = notification;
    const msg = { jsonrpc: "2.0", method: type, params };
    for (const record of this._clients.values()) {
      this._getActiveClientFromRecord(record)?.transport.send(msg);
    }
  }
  /**
   * Forward an MCP server-originated notification (e.g.
   * `notifications/tools/list_changed`) over the AHP transport. The
   * `channel` field on `params` is the AHP routing envelope; the
   * receiving client demultiplexes by it. Notifications are broadcast
   * to every connected client — per-channel subscription filtering is
   * left to the client, since MCP notifications are cheap and the
   * client already knows which channels it cares about.
   */
  _broadcastMcpNotification(notification) {
    const params = { ...notification.params ?? {}, channel: notification.channel };
    const msg = { jsonrpc: "2.0", method: notification.method, params };
    for (const record of this._clients.values()) {
      this._getActiveClientFromRecord(record)?.transport.send(msg);
    }
  }
  /**
   * Drop a subscription identified by `channel` from `client`. Handles
   * canonicalisation for OTLP URIs (so an `unsubscribe` with a URI
   * variant collapses to the same entry as the original `subscribe`)
   * and tears down the agent-service refcount for state channels.
   */
  _removeSubscription(client, channel) {
    const classified = classifyChannel(channel);
    if (!classified) {
      return;
    }
    const sub = client.subscriptions.get(classified.uri);
    if (!sub) {
      return;
    }
    client.subscriptions.delete(classified.uri);
    if (sub.kind === "state" /* State */) {
      const record = this._clients.get(client.clientId);
      if (record && this._hasSubscriptionInOtherConnection(record, client, sub.uri)) {
        return;
      }
      this._agentService.unsubscribe(URI.parse(sub.uri), client.clientId);
      if (isAhpChatChannel(sub.uri)) {
        this._releaseActiveClientForSession(parseRequiredSessionUriFromChatUri(sub.uri), client.clientId, sub.uri);
      } else {
        const state = this._stateManager.getSessionState(sub.uri);
        for (const chat of state?.chats ?? []) {
          this._releaseActiveClientForSession(sub.uri, client.clientId, chat.resource);
        }
      }
    } else if (sub.kind === "resource-watch" /* ResourceWatch */) {
      this._agentService.onResourceWatchUnsubscribed(sub.uri);
    }
  }
  /**
   * Fan out an OTLP log record to every connected client that has
   * subscribed to a logs channel whose `{level}` band includes the
   * record's `severityNumber`. The notification's `channel` field is
   * the canonical URI the client subscribed against — clients can
   * route by URI without re-deriving the level.
   */
  _broadcastOtlpLog(record) {
    const payload = toResourceLogsPayload(record);
    for (const clientRecord of this._clients.values()) {
      const client = this._getActiveClientFromRecord(clientRecord);
      if (!client) {
        continue;
      }
      for (const sub of client.subscriptions.values()) {
        if (sub.kind !== "otlp-logs" /* OtlpLogs */) {
          continue;
        }
        if (record.severityNumber < levelToSeverityNumber(sub.level)) {
          continue;
        }
        const msg = {
          jsonrpc: "2.0",
          method: "otlp/exportLogs",
          params: { channel: sub.uri, payload }
        };
        client.transport.send(msg);
      }
    }
  }
  _isRelevantToClient(client, envelope) {
    const sub = client.subscriptions.get(envelope.channel);
    if (sub?.kind === "state" /* State */ || sub?.kind === "resource-watch" /* ResourceWatch */) {
      return true;
    }
    if (!isAhpRootChannel(envelope.channel)) {
      return false;
    }
    return isActionEnvelopeRelevantToSubscriptionUris(envelope, this._stateAndResourceWatchUris(client));
  }
  *_stateAndResourceWatchUris(client) {
    for (const sub of client.subscriptions.values()) {
      if (sub.kind === "state" /* State */ || sub.kind === "resource-watch" /* ResourceWatch */) {
        yield sub.uri;
      }
    }
  }
  dispose() {
    for (const record of this._clients.values()) {
      if (record.state === "active") {
        for (const connection of [...record.connections]) {
          const subscriptionCount = connection.subscriptions.size;
          const connectionIndex = record.connections.indexOf(connection);
          if (connectionIndex !== -1) {
            record.connections.splice(connectionIndex, 1);
          }
          this._releaseClientSubscriptions(connection, record);
          this._rejectPendingReverseRequestsForConnection(connection);
          this._reportClientDisconnected(connection, subscriptionCount);
          connection.disposables.dispose();
        }
      } else {
        record.disconnectTimeouts.dispose();
      }
    }
    this._clients.clear();
    for (const [, pending] of this._pendingReverseRequests) {
      pending.reject(new Error("ProtocolServerHandler disposed"));
    }
    this._pendingReverseRequests.clear();
    this._replayBuffer.length = 0;
    super.dispose();
  }
};
ProtocolServerHandler = __decorateClass([
  __decorateParam(5, ILogService),
  __decorateParam(6, ITelemetryService)
], ProtocolServerHandler);
export {
  ProtocolServerHandler
};
