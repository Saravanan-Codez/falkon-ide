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
import { localize } from "../../../nls.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { AgentSession, IAgentHostService } from "../common/agentService.js";
import { AMBIENT_AGENT_HOST_AUTHORITY, IAgentHostConnectionsService, LOCAL_AGENT_HOST_SCHEME_PREFIX } from "../common/agentHostConnectionsService.js";
import { findRemoteAgentHostSessionTypeAuthority, isRemoteAgentHostSessionType, remoteAgentHostSessionTypeAuthorityPrefix } from "../common/agentHostSessionType.js";
import { agentHostAuthority } from "../common/agentHostUri.js";
import { IRemoteAgentHostService } from "../common/remoteAgentHostService.js";
let AgentHostConnectionsService = class extends Disposable {
  constructor(_agentHostService, _remoteAgentHostService) {
    super();
    this._agentHostService = _agentHostService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this._onDidChangeConnections = this._register(new Emitter());
    this.onDidChangeConnections = this._onDidChangeConnections.event;
    this._register(this._remoteAgentHostService.onDidChangeConnections(() => this._onDidChangeConnections.fire()));
    this._register(this._agentHostService.onAgentHostStart(() => this._onDidChangeConnections.fire()));
    this._register(this._agentHostService.onAgentHostExit(() => this._onDidChangeConnections.fire()));
  }
  get ambientConnection() {
    return this._agentHostService;
  }
  get connections() {
    const result = [{
      authority: AMBIENT_AGENT_HOST_AUTHORITY,
      address: void 0,
      name: localize("agentHost.connection.ambient", "Local"),
      isAmbient: true,
      connection: this._agentHostService
    }];
    for (const info of this._remoteAgentHostService.connections) {
      result.push({
        authority: agentHostAuthority(info.address),
        address: info.address,
        name: info.name,
        isAmbient: false,
        connection: this._remoteAgentHostService.getConnection(info.address)
      });
    }
    return result;
  }
  getConnectionByAuthority(authority) {
    if (authority === AMBIENT_AGENT_HOST_AUTHORITY) {
      return this._agentHostService;
    }
    return this._remoteAgentHostService.getConnectionByAuthority(authority);
  }
  getConnectionByAddress(address) {
    return this._remoteAgentHostService.getConnection(address);
  }
  resolveSessionResource(sessionResource) {
    const scheme = sessionResource.scheme;
    const rawSessionId = sessionResource.path.substring(1);
    if (scheme.startsWith(LOCAL_AGENT_HOST_SCHEME_PREFIX)) {
      const provider = scheme.substring(LOCAL_AGENT_HOST_SCHEME_PREFIX.length);
      return provider ? { connection: this._agentHostService, backendSession: AgentSession.uri(provider, rawSessionId) } : void 0;
    }
    if (isRemoteAgentHostSessionType(scheme)) {
      const authority = findRemoteAgentHostSessionTypeAuthority(scheme, this.connections.filter((c) => !c.isAmbient).map((c) => c.authority));
      if (authority) {
        const provider = scheme.substring(remoteAgentHostSessionTypeAuthorityPrefix(authority).length);
        const connection = this.getConnectionByAuthority(authority);
        if (provider && connection) {
          return { connection, backendSession: AgentSession.uri(provider, rawSessionId) };
        }
      }
    }
    return void 0;
  }
};
AgentHostConnectionsService = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IRemoteAgentHostService)
], AgentHostConnectionsService);
registerSingleton(IAgentHostConnectionsService, AgentHostConnectionsService, InstantiationType.Delayed);
export {
  AgentHostConnectionsService
};
