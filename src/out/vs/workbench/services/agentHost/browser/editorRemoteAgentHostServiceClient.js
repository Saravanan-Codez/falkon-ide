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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue, constObservable } from "../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AgentHostIpcChannels } from "../../../../platform/agentHost/common/agentService.js";
import { IAgentHostEnablementService } from "../../../../platform/agentHost/common/agentHostEnablementService.js";
import { AgentHostIpcChannelTransport } from "../../../../platform/agentHost/browser/agentHostIpcChannelTransport.js";
import { AgentHostClientConnectionKind } from "../../../../platform/agentHost/common/agentHostTelemetry.js";
import { RemoteAgentHostProtocolClient } from "../../../../platform/agentHost/browser/remoteAgentHostProtocolClient.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { agentsWindowAgentHostClientInfo, editorWindowAgentHostClientInfo } from "../../../../platform/agentHost/common/agentHostClientInfo.js";
const REMOTE_NOT_SUPPORTED = (op) => new Error(`${op} is not supported when the agent host runs on a remote.`);
const LOG_PREFIX = "[AgentHost:remote]";
let EditorRemoteAgentHostServiceClient = class extends Disposable {
  constructor(_remoteAgentService, agentHostEnablementService, instantiationService, _logService, environmentService) {
    super();
    this._remoteAgentService = _remoteAgentService;
    this._logService = _logService;
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
    this._connectStarted = false;
    const enabled = agentHostEnablementService.enabled.get();
    const connection = this._remoteAgentService.getConnection();
    this._logService.info(`${LOG_PREFIX} Initializing (enabled=${enabled}, remoteAuthority=${connection?.remoteAuthority ?? "none"})`);
    if (!enabled) {
      this._logService.info(`${LOG_PREFIX} Disabled via configuration, policy, or runtime availability. Not connecting.`);
      this.setAuthenticationPending(false);
      return;
    }
    if (!connection) {
      this._logService.warn(`${LOG_PREFIX} No remote agent connection available. Not connecting.`);
      this.setAuthenticationPending(false);
      return;
    }
    const createTransport = () => new AgentHostIpcChannelTransport(connection.getChannel(AgentHostIpcChannels.RemoteProxy), void 0, AgentHostClientConnectionKind.RemoteExtensionHost);
    const address = `vscode-remote://${connection.remoteAuthority}`;
    const clientInfo = environmentService.isSessionsWindow ? agentsWindowAgentHostClientInfo : editorWindowAgentHostClientInfo;
    this._protocolClient = this._register(instantiationService.createInstance(RemoteAgentHostProtocolClient, address, createTransport, void 0, void 0, clientInfo));
    this._register(this._protocolClient.onDidClose(() => {
      this._logService.info(`${LOG_PREFIX} Protocol client closed`);
      this._onAgentHostExit.fire(0);
    }));
    this._connect().catch((err) => this._logService.warn(`${LOG_PREFIX} Connect failed`, err));
  }
  async _connect() {
    if (this._connectStarted || !this._protocolClient) {
      return;
    }
    this._connectStarted = true;
    this._logService.info(`${LOG_PREFIX} Connecting to remote agent host...`);
    await this._remoteAgentService.getRawEnvironment();
    await this._protocolClient.connect();
    this._logService.info(`${LOG_PREFIX} Connected; clientId=${this._protocolClient.clientId}`);
    this._onAgentHostStart.fire();
  }
  _requireClient() {
    if (!this._protocolClient) {
      throw new Error("Remote agent host is not enabled or no remote connection is available.");
    }
    return this._protocolClient;
  }
  // ---- IAgentHostService local-only surface (stubs) -----------------------
  setAuthenticationPending(pending) {
    if (this._authenticationSettled) {
      return;
    }
    if (!pending) {
      this._authenticationSettled = true;
    }
    this._authenticationPending.set(pending, void 0);
  }
  startAgentHost() {
    this._connect().catch((err) => this._logService.warn(`${LOG_PREFIX} Connect failed`, err));
  }
  async restartAgentHost() {
  }
  async startWebSocketServer() {
    throw REMOTE_NOT_SUPPORTED("startWebSocketServer");
  }
  async getInspectInfo(_tryEnable) {
    return void 0;
  }
  // ---- IAgentConnection delegation ---------------------------------------
  // All getters delegate directly to the eagerly-created protocol client so
  // `AgentHostContribution` can subscribe synchronously in its constructor.
  get clientId() {
    return this._protocolClient?.clientId ?? "";
  }
  get initializeResult() {
    return this._protocolClient?.initializeResult ?? constObservable(void 0);
  }
  get rootState() {
    return this._protocolClient?.rootState ?? this._noopRootState;
  }
  get onDidNotification() {
    return this._protocolClient?.onDidNotification ?? Event.None;
  }
  get onDidAction() {
    return this._protocolClient?.onDidAction ?? Event.None;
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
    this._protocolClient?.dispatch(channel, action);
  }
  authenticate(params) {
    return this._requireClient().authenticate(params);
  }
  getNetworkDiagnosticsInfo() {
    return this._requireClient().getNetworkDiagnosticsInfo();
  }
  getManagedSettingsDiagnostics() {
    return this._requireClient().getManagedSettingsDiagnostics();
  }
  diagnosticsFetch(url) {
    return this._requireClient().diagnosticsFetch(url);
  }
  listSessions() {
    return this._requireClient().listSessions();
  }
  createSession(config) {
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
};
EditorRemoteAgentHostServiceClient = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IAgentHostEnablementService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IWorkbenchEnvironmentService)
], EditorRemoteAgentHostServiceClient);
export {
  EditorRemoteAgentHostServiceClient
};
