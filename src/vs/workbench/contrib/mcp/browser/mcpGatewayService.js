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
import { Event } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { McpGatewayChannelName } from "../../../../platform/mcp/common/mcpGateway.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
let BrowserMcpGatewayService = class {
  constructor(_remoteAgentService, _logService) {
    this._remoteAgentService = _remoteAgentService;
    this._logService = _logService;
  }
  async createGateway(inRemote, chatSessionResource) {
    this._logService.debug(`[McpGateway][BrowserWorkbench] createGateway requested (inRemote=${inRemote})`);
    if (!inRemote) {
      this._logService.info("[McpGateway][BrowserWorkbench] Cannot create local gateway in browser environment");
      return void 0;
    }
    const connection = this._remoteAgentService.getConnection();
    if (!connection) {
      this._logService.info("[McpGateway][BrowserWorkbench] No remote connection available (serverless web)");
      return void 0;
    }
    this._logService.info("[McpGateway][BrowserWorkbench] Creating remote gateway via remote server");
    return connection.withChannel(McpGatewayChannelName, async (channel) => {
      const info = await channel.call(
        "createGateway",
        chatSessionResource ? { chatSessionResource: chatSessionResource.toString() } : void 0
      );
      const servers = reviveServers(info.servers);
      this._logService.info(`[McpGateway][BrowserWorkbench] Remote gateway created with ${servers.length} server(s)`);
      const onDidChangeServers = Event.map(
        Event.filter(
          channel.listen("onDidChangeGatewayServers"),
          (e) => e.gatewayId === info.gatewayId
        ),
        (e) => reviveServers(e.servers)
      );
      return {
        servers,
        onDidChangeServers,
        dispose: () => {
          this._logService.info(`[McpGateway][BrowserWorkbench] Disposing remote gateway: ${info.gatewayId}`);
          void channel.call("disposeGateway", info.gatewayId).then(void 0, (error) => {
            this._logService.warn(`[McpGateway][BrowserWorkbench] Failed to dispose remote gateway: ${info.gatewayId}`, error);
          });
        }
      };
    });
  }
};
BrowserMcpGatewayService = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, ILogService)
], BrowserMcpGatewayService);
function reviveServers(servers) {
  return servers.map((s) => ({ label: s.label, address: URI.revive(s.address) }));
}
export {
  BrowserMcpGatewayService
};
