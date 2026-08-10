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
import { DeferredPromise } from "../../../base/common/async.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { autorun, constObservable, observableValue } from "../../../base/common/observable.js";
import { mark } from "../../../base/common/performance.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { getDelayedChannel, ProxyChannel } from "../../../base/parts/ipc/common/ipc.js";
import { Client as MessagePortClient } from "../../../base/parts/ipc/common/ipc.mp.js";
import { acquirePort } from "../../../base/parts/ipc/electron-browser/ipc.mp.js";
import { ipcRenderer } from "../../../base/parts/sandbox/electron-browser/globals.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { AgentHostIpcChannelTransport } from "../browser/agentHostIpcChannelTransport.js";
import { AgentHostClientState, RemoteAgentHostProtocolClient } from "../browser/remoteAgentHostProtocolClient.js";
import { AhpJsonlLogger } from "../common/ahpJsonlLogger.js";
import { AGENT_HOST_CLIENT_BYOK_LM_CHANNEL, AgentHostClientByokLmChannel } from "../common/agentHostClientByokLmChannel.js";
import { AGENT_HOST_CLIENT_PROXY_CHANNEL, AgentHostClientProxyChannel } from "../common/agentHostClientProxyChannel.js";
import { IAgentHostEnablementService } from "../common/agentHostEnablementService.js";
import { LOCAL_AGENT_HOST_RESOURCE_IDENTITY } from "../common/agentHostResourceService.js";
import { AgentHostClientConnectionKind } from "../common/agentHostTelemetry.js";
import {
  AgentHostAhpJsonlLoggingSettingId,
  AgentHostByokModelsEnabledSettingId,
  AgentHostIpcChannels,
  AgentHostOTelPolicyIpcChannel,
  AgentHostRestartIpcChannel,
  AgentHostWillRestartIpcChannel,
  AgentSession,
  readAgentHostOTelPolicySettings
} from "../common/agentService.js";
const LOG_PREFIX = "[AgentHost:renderer]";
class LocalAgentHostIpcChannelTransport extends AgentHostIpcChannelTransport {
  constructor(channel, connectionStore, ahpLogger) {
    super(channel, ahpLogger, AgentHostClientConnectionKind.Local);
    this._register(connectionStore);
  }
}
let LocalAgentHostServiceClient = class extends Disposable {
  constructor(_clientInfo, _logService, _configurationService, environmentService, _instantiationService, agentHostEnablementService) {
    super();
    this._clientInfo = _clientInfo;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this.clientId = generateUuid();
    this._connectStarted = false;
    this._didAcquireInitialMessagePort = false;
    this._didStartInitialSessionList = false;
    this._didCompleteInitialSessionList = false;
    this._onAgentHostExit = this._register(new Emitter());
    this.onAgentHostExit = this._onAgentHostExit.event;
    this._onAgentHostStart = this._register(new Emitter());
    this.onAgentHostStart = this._onAgentHostStart.event;
    this._authenticationPending = observableValue("authenticationPending", true);
    this.authenticationPending = this._authenticationPending;
    this._authenticationSettled = false;
    this._noopRootState = {
      value: void 0,
      verifiedValue: void 0,
      onDidChange: Event.None,
      onWillApplyAction: Event.None,
      onDidApplyAction: Event.None
    };
    this._ahpLogger = this._configurationService.getValue(AgentHostAhpJsonlLoggingSettingId) ? this._register(this._instantiationService.createInstance(AhpJsonlLogger, {
      logsHome: environmentService.logsHome,
      connectionId: this.clientId,
      transport: "local"
    })) : void 0;
    this._register(autorun((reader) => {
      if (agentHostEnablementService.enabled.read(reader)) {
        this.startAgentHost();
      }
    }));
    const onWillRestart = () => this._protocolClient?.notifyTransportClosed();
    ipcRenderer.on(AgentHostWillRestartIpcChannel, onWillRestart);
    this._register(toDisposable(() => ipcRenderer.removeListener(AgentHostWillRestartIpcChannel, onWillRestart)));
  }
  startAgentHost() {
    if (!this._protocolClient) {
      mark("code/agentHost/willStart");
      this._forwardOTelPolicy();
      this._protocolClient = this._register(this._instantiationService.createInstance(
        RemoteAgentHostProtocolClient,
        LOCAL_AGENT_HOST_RESOURCE_IDENTITY,
        () => this._createTransport(),
        void 0,
        this.clientId,
        this._clientInfo
      ));
      this._register(this._protocolClient.onDidClose(() => this._onAgentHostExit.fire(0)));
      this._register(this._protocolClient.onDidChangeConnectionState((state) => {
        if (state === AgentHostClientState.Connected) {
          this._logService.info(`${LOG_PREFIX} Protocol connection established; clientId=${this.clientId}`);
          this._onAgentHostStart.fire();
        }
      }));
    }
    void this._connect().catch((error) => {
      this._protocolClient?.notifyTransportClosed();
      this._logService.error(`${LOG_PREFIX} Protocol connection failed`, error);
    });
  }
  async _connect() {
    if (this._connectStarted) {
      return;
    }
    this._connectStarted = true;
    const protocolClient = this._requireClient();
    await protocolClient.connect();
    mark("code/agentHost/didConnect");
  }
  _createTransport() {
    const clientEventually = new DeferredPromise();
    const connectionStore = new DisposableStore();
    void this._acquireMessagePort(clientEventually, connectionStore).catch((error) => clientEventually.error(error));
    return new LocalAgentHostIpcChannelTransport(
      getDelayedChannel(clientEventually.p.then((client) => client.getChannel(AgentHostIpcChannels.Protocol))),
      connectionStore,
      this._ahpLogger
    );
  }
  async _acquireMessagePort(clientEventually, connectionStore) {
    this._logService.info(`${LOG_PREFIX} Acquiring MessagePort to agent host...`);
    const port = await acquirePort("vscode:createAgentHostMessageChannel", "vscode:createAgentHostMessageChannelResult");
    if (!this._didAcquireInitialMessagePort) {
      this._didAcquireInitialMessagePort = true;
      mark("code/agentHost/didAcquireMessagePort");
    }
    this._logService.info(`${LOG_PREFIX} MessagePort acquired, creating client...`);
    const client = connectionStore.add(new MessagePortClient(port, this.clientId));
    registerAgentHostClientChannels(
      client,
      this._instantiationService,
      this._logService,
      this._configurationService.getValue(AgentHostByokModelsEnabledSettingId) === true
    );
    this._messagePortClient = client;
    connectionStore.add(toDisposable(() => {
      if (this._messagePortClient === client) {
        this._messagePortClient = void 0;
      }
    }));
    clientEventually.complete(client);
  }
  _forwardOTelPolicy() {
    ipcRenderer.send(AgentHostOTelPolicyIpcChannel, readAgentHostOTelPolicySettings(this._configurationService));
  }
  async _getManagementService() {
    const protocolClient = this._requireClient();
    const connectionState = protocolClient.connectionState;
    if (connectionState === AgentHostClientState.Closed || connectionState === AgentHostClientState.Incompatible) {
      throw new Error("Local agent host is not connected.");
    }
    if (connectionState !== AgentHostClientState.Connected) {
      const state = await Event.toPromise(Event.filter(
        protocolClient.onDidChangeConnectionState,
        (state2) => state2 === AgentHostClientState.Connected || state2 === AgentHostClientState.Closed || state2 === AgentHostClientState.Incompatible
      ));
      if (state !== AgentHostClientState.Connected) {
        throw new Error("Local agent host is not connected.");
      }
    }
    if (!this._messagePortClient) {
      throw new Error("Local agent host management connection is not available.");
    }
    return ProxyChannel.toService(this._messagePortClient.getChannel(AgentHostIpcChannels.Management));
  }
  async _callManagement(callback) {
    return callback(await this._getManagementService());
  }
  _requireClient() {
    if (!this._protocolClient) {
      throw new Error("Local agent host is not connected.");
    }
    return this._protocolClient;
  }
  setAuthenticationPending(pending) {
    if (this._authenticationSettled) {
      return;
    }
    if (!pending) {
      this._authenticationSettled = true;
    }
    this._authenticationPending.set(pending, void 0);
  }
  get initializeResult() {
    return this._protocolClient?.initializeResult ?? constObservable(void 0);
  }
  get rootState() {
    return this._protocolClient?.rootState ?? this._noopRootState;
  }
  get onDidAction() {
    return this._protocolClient?.onDidAction ?? Event.None;
  }
  get onDidNotification() {
    return this._protocolClient?.onDidNotification ?? Event.None;
  }
  get onMcpNotification() {
    return this._protocolClient?.onMcpNotification ?? Event.None;
  }
  getSubscription(kind, resource, owner) {
    return this._requireClient().getSubscription(kind, resource, owner);
  }
  getSubscriptionUnmanaged(kind, resource) {
    return this._protocolClient?.getSubscriptionUnmanaged(kind, resource);
  }
  getInflightSessionCreate(resource) {
    return this._protocolClient?.getInflightSessionCreate(resource);
  }
  getActiveSubscriptions() {
    return this._protocolClient?.getActiveSubscriptions() ?? [];
  }
  dispatch(channel, action) {
    this._requireClient().dispatch(channel, action);
  }
  authenticate(params) {
    return this._requireClient().authenticate(params);
  }
  listSessions() {
    if (!this._didStartInitialSessionList) {
      this._didStartInitialSessionList = true;
      mark("code/agentHost/willListSessions");
    }
    return this._requireClient().listSessions().then((sessions) => {
      if (!this._didCompleteInitialSessionList) {
        this._didCompleteInitialSessionList = true;
        mark("code/agentHost/didListSessions");
      }
      return sessions;
    });
  }
  createSession(config) {
    if (config && hasSessionExtensions(config)) {
      if (!config.provider) {
        throw new Error("Cannot create local agent host session without a provider.");
      }
      const session = config.session ?? AgentSession.uri(config.provider, generateUuid());
      const promise = this._callManagement((management) => management.createSessionWithExtensions({ ...config, session }));
      this._requireClient().trackSessionCreate(session, promise);
      return promise;
    }
    return this._requireClient().createSession(config);
  }
  resolveSessionConfig(params) {
    return this._requireClient().resolveSessionConfig(params);
  }
  sessionConfigCompletions(params) {
    return this._requireClient().sessionConfigCompletions(params);
  }
  completions(params) {
    return this._requireClient().completions(params);
  }
  getCompletionTriggerCharacters() {
    return this._requireClient().getCompletionTriggerCharacters();
  }
  disposeSession(session) {
    return this._requireClient().disposeSession(session);
  }
  createChat(session, chat, options) {
    if (options && hasChatExtensions(options)) {
      return this._callManagement((management) => management.createChatWithExtensions(session, chat, options));
    }
    return this._requireClient().createChat(session, chat, options);
  }
  disposeChat(chat) {
    return this._requireClient().disposeChat(chat);
  }
  createTerminal(params) {
    return this._requireClient().createTerminal(params);
  }
  disposeTerminal(terminal) {
    return this._requireClient().disposeTerminal(terminal);
  }
  invokeChangesetOperation(params) {
    return this._requireClient().invokeChangesetOperation(params);
  }
  handleMcpRequest(channel, method, params) {
    return this._requireClient().handleMcpRequest(channel, method, params);
  }
  resourceList(uri) {
    return this._requireClient().resourceList(uri);
  }
  resourceRead(uri) {
    return this._requireClient().resourceRead(uri);
  }
  resourceWrite(params) {
    return this._requireClient().resourceWrite(params);
  }
  resourceCopy(params) {
    return this._requireClient().resourceCopy(params);
  }
  resourceDelete(params) {
    return this._requireClient().resourceDelete(params);
  }
  resourceMove(params) {
    return this._requireClient().resourceMove(params);
  }
  resourceResolve(params) {
    return this._requireClient().resourceResolve(params);
  }
  resourceMkdir(params) {
    return this._requireClient().resourceMkdir(params);
  }
  createResourceWatch(params) {
    return this._requireClient().createResourceWatch(params);
  }
  watchResource(params) {
    return this._requireClient().watchResource(params);
  }
  shutdown() {
    return this._callManagement((management) => management.shutdown());
  }
  getNetworkDiagnosticsInfo() {
    return this._callManagement((management) => management.getNetworkDiagnosticsInfo());
  }
  getManagedSettingsDiagnostics() {
    return this._callManagement((management) => management.getManagedSettingsDiagnostics());
  }
  diagnosticsFetch(url) {
    return this._callManagement((management) => management.diagnosticsFetch(url));
  }
  async restartAgentHost() {
    this._forwardOTelPolicy();
    ipcRenderer.send(AgentHostRestartIpcChannel);
  }
  startWebSocketServer() {
    return this._callManagement((management) => management.startWebSocketServer());
  }
  getInspectInfo(tryEnable) {
    return this._callManagement((management) => management.getInspectInfo(tryEnable));
  }
};
LocalAgentHostServiceClient = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IAgentHostEnablementService)
], LocalAgentHostServiceClient);
function hasSessionExtensions(config) {
  return config.model !== void 0 || config.agent !== void 0 || config.importConversation !== void 0;
}
function hasChatExtensions(options) {
  return options.title !== void 0 || options.model !== void 0;
}
function registerAgentHostClientChannels(client, instantiationService, logService, byokEnabled) {
  client.registerChannel(AGENT_HOST_CLIENT_PROXY_CHANNEL, instantiationService.createInstance(AgentHostClientProxyChannel));
  if (byokEnabled) {
    try {
      client.registerChannel(AGENT_HOST_CLIENT_BYOK_LM_CHANNEL, instantiationService.createInstance(AgentHostClientByokLmChannel));
    } catch (error) {
      logService.warn(`${LOG_PREFIX} BYOK language-model bridge not registered for this window. ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
export {
  LocalAgentHostServiceClient,
  registerAgentHostClientChannels
};
