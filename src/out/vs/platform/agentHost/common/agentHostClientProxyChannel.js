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
import { IRequestService } from "../../request/common/request.js";
const AGENT_HOST_CLIENT_PROXY_CHANNEL = "agentHostClientProxy";
function createAgentHostClientProxyConnection(channel) {
  return {
    resolveProxy: (url) => channel.call("resolveProxy", { url }),
    lookupAuthorization: (authInfo) => channel.call("lookupAuthorization", { authInfo }),
    lookupKerberosAuthorization: (url) => channel.call("lookupKerberosAuthorization", { url })
  };
}
let AgentHostClientProxyChannel = class {
  constructor(_requestService) {
    this._requestService = _requestService;
  }
  listen(_ctx, event) {
    throw new Error(`No event '${event}' on AgentHostClientProxyChannel`);
  }
  async call(_ctx, command, arg) {
    switch (command) {
      case "resolveProxy": {
        const { url } = arg;
        const proxy = await this._requestService.resolveProxy(url);
        return proxy;
      }
      case "lookupAuthorization": {
        const { authInfo } = arg;
        const credentials = await this._requestService.lookupAuthorization(authInfo);
        return credentials;
      }
      case "lookupKerberosAuthorization": {
        const { url } = arg;
        const authorization = await this._requestService.lookupKerberosAuthorization(url);
        return authorization;
      }
    }
    throw new Error(`Unknown command '${command}' on AgentHostClientProxyChannel`);
  }
};
AgentHostClientProxyChannel = __decorateClass([
  __decorateParam(0, IRequestService)
], AgentHostClientProxyChannel);
export {
  AGENT_HOST_CLIENT_PROXY_CHANNEL,
  AgentHostClientProxyChannel,
  createAgentHostClientProxyConnection
};
