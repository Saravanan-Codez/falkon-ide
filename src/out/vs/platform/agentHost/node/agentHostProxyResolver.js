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
import { LogLevel as ProxyLogLevel, createFetchPatch, createProxyAuthorizationLookup, createProxyResolver, loadSystemCertificates } from "@vscode/proxy-agent";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService, LogLevel } from "../../log/common/log.js";
import { systemCertificatesNodeDefault } from "../../request/common/request.js";
const IAgentHostProxyResolver = createDecorator("agentHostProxyResolver");
let AgentHostProxyResolver = class {
  constructor(_configurationService, _logService) {
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._connections = /* @__PURE__ */ new Map();
  }
  register(clientId, connection) {
    this._connections.set(clientId, connection);
    return toDisposable(() => {
      if (this._connections.get(clientId) === connection) {
        this._connections.delete(clientId);
      }
    });
  }
  resolveProxy(url) {
    return this._getProxyResolver().resolveProxyURL(url);
  }
  fetch(input, init) {
    if (!this._fetch) {
      const proxyResolver = this._getProxyResolver();
      this._fetch = createFetchPatch(this._proxyAgentParams, globalThis.fetch, proxyResolver.resolveProxyURL);
    }
    return this._fetch(input, init);
  }
  _getProxyResolver() {
    if (!this._proxyResolver) {
      const config = (key) => this._configurationService.getValue(key);
      const systemCertificatesV2 = () => config("http.experimental.systemCertificatesV2") ?? false;
      const systemCertificates = () => !!config("http.systemCertificates");
      const params = {
        // The host proxy resolution runs in VS Code: reverse-call a connected
        // renderer, whose IRequestService.resolveProxy hits the Electron
        // session (system settings / PAC scripts).
        resolveProxy: (url) => this._hostResolveProxy(url),
        lookupProxyAuthorization: createProxyAuthorizationLookup({
          log: this._logService,
          lookupAuthorization: (authInfo) => this._hostLookupAuthorization(authInfo),
          lookupKerberosAuthorization: (url) => this._hostLookupKerberosAuthorization(url)
        }),
        getProxyURL: () => config("http.proxy"),
        getProxySupport: () => config("http.proxySupport") || "off",
        getNoProxyConfig: () => config("http.noProxy") || [],
        isAdditionalFetchSupportEnabled: () => config("http.fetchAdditionalSupport") ?? true,
        isWebSocketPatchEnabled: () => config("http.webSocketAdditionalSupport") ?? true,
        addCertificatesV1: () => !systemCertificatesV2() && systemCertificates(),
        addCertificatesV2: () => systemCertificatesV2() && systemCertificates(),
        loadSystemCertificatesFromNode: () => config("http.systemCertificatesNode") ?? systemCertificatesNodeDefault,
        loadAdditionalCertificates: async () => loadSystemCertificates({
          loadSystemCertificatesFromNode: () => config("http.systemCertificatesNode") ?? systemCertificatesNodeDefault,
          log: this._logService
        }),
        log: this._logService,
        getLogLevel: () => {
          switch (this._logService.getLevel()) {
            case LogLevel.Trace:
              return ProxyLogLevel.Trace;
            case LogLevel.Debug:
              return ProxyLogLevel.Debug;
            case LogLevel.Info:
              return ProxyLogLevel.Info;
            case LogLevel.Warning:
              return ProxyLogLevel.Warning;
            case LogLevel.Error:
              return ProxyLogLevel.Error;
            case LogLevel.Off:
              return ProxyLogLevel.Off;
            default:
              return ProxyLogLevel.Info;
          }
        },
        proxyResolveTelemetry: () => {
        },
        // Only the local agent host wires the reverse proxy channel
        // and we want to look up the client's proxy settings only
        // when the agent host is local (i.e., on the same machine as
        // the client).
        isUseHostProxyEnabled: () => this._connections.size > 0,
        getNetworkInterfaceCheckInterval: () => (config("http.experimental.networkInterfaceCheckInterval") ?? 300) * 1e3,
        env: process.env
      };
      this._proxyAgentParams = params;
      this._proxyResolver = createProxyResolver(params);
    }
    return this._proxyResolver;
  }
  async _hostResolveProxy(url) {
    for (const connection of this._connections.values()) {
      try {
        return await connection.resolveProxy(url);
      } catch {
      }
    }
    return void 0;
  }
  async _hostLookupAuthorization(authInfo) {
    for (const connection of this._connections.values()) {
      try {
        return await connection.lookupAuthorization(authInfo);
      } catch {
      }
    }
    return void 0;
  }
  async _hostLookupKerberosAuthorization(url) {
    for (const connection of this._connections.values()) {
      try {
        return await connection.lookupKerberosAuthorization(url);
      } catch {
      }
    }
    return void 0;
  }
};
AgentHostProxyResolver = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ILogService)
], AgentHostProxyResolver);
export {
  AgentHostProxyResolver,
  IAgentHostProxyResolver
};
