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
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { RequestChannelClient } from "../../../../platform/request/common/requestIpc.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { AbstractRequestService } from "../../../../platform/request/common/request.js";
import { request } from "../../../../base/parts/request/common/requestImpl.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { localize } from "../../../../nls.js";
import { LogService } from "../../../../platform/log/common/logService.js";
import { windowLogGroup } from "../../log/common/logConstants.js";
let BrowserRequestService = class extends AbstractRequestService {
  constructor(remoteAgentService, configurationService, loggerService) {
    const logger = loggerService.createLogger(`network`, { name: localize("network", "Network"), group: windowLogGroup });
    const logService = new LogService(logger);
    super(logService);
    this.remoteAgentService = remoteAgentService;
    this.configurationService = configurationService;
    this._register(logger);
    this._register(logService);
  }
  async request(options, token) {
    try {
      if (!options.proxyAuthorization) {
        options.proxyAuthorization = this.configurationService.inspect("http.proxyAuthorization").userLocalValue;
      }
      const context = await this.logAndRequest(options, () => request(options, token, () => navigator.onLine));
      const connection = this.remoteAgentService.getConnection();
      if (connection && context.res.statusCode === 405) {
        return this._makeRemoteRequest(connection, options, token);
      }
      return context;
    } catch (error) {
      const connection = this.remoteAgentService.getConnection();
      if (connection) {
        return this._makeRemoteRequest(connection, options, token);
      }
      throw error;
    }
  }
  async resolveProxy(url) {
    return void 0;
  }
  async lookupAuthorization(authInfo) {
    return void 0;
  }
  async lookupKerberosAuthorization(url) {
    return void 0;
  }
  async loadCertificates() {
    return [];
  }
  _makeRemoteRequest(connection, options, token) {
    return connection.withChannel("request", (channel) => new RequestChannelClient(channel).request(options, token));
  }
};
BrowserRequestService = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ILoggerService)
], BrowserRequestService);
CommandsRegistry.registerCommand("_workbench.fetchJSON", async function(accessor, url, method) {
  const result = await fetch(url, { method, headers: { Accept: "application/json" } });
  if (result.ok) {
    return result.json();
  } else {
    throw new Error(result.statusText);
  }
});
export {
  BrowserRequestService
};
