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
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { McpGatewayChannelName } from "../../../../platform/mcp/common/mcpGateway.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
let WorkbenchMcpGatewayService = class {
  constructor(mainProcessService, _remoteAgentService, _logService) {
    this._remoteAgentService = _remoteAgentService;
    this._logService = _logService;
    this._localChannel = mainProcessService.getChannel(McpGatewayChannelName);
    this._localPlatformService = ProxyChannel.toService(this._localChannel);
  }
  async createGateway(inRemote, chatSessionResource) {
    this._logService.debug(`[McpGateway][Workbench] createGateway requested (inRemote=${inRemote})`);
    if (inRemote) {
      return this._createRemoteGateway(chatSessionResource);
    } else {
      return this._createLocalGateway(chatSessionResource);
    }
  }
  async _createLocalGateway(chatSessionResource) {
    this._logService.info("[McpGateway][Workbench] Creating local gateway via main process");
    const info = await this._localChannel.call(
      "createGateway",
      chatSessionResource ? { chatSessionResource: chatSessionResource.toString() } : void 0
    );
    const servers = reviveServers(info.servers);
    this._logService.info(`[McpGateway][Workbench] Local gateway created with ${servers.length} server(s)`);
    const onDidChangeServers = Event.map(
      Event.filter(
        this._localChannel.listen("onDidChangeGatewayServers"),
        (e) => e.gatewayId === info.gatewayId
      ),
      (e) => reviveServers(e.servers)
    );
    return {
      servers,
      onDidChangeServers,
      dispose: () => {
        this._logService.info(`[McpGateway][Workbench] Disposing local gateway: ${info.gatewayId}`);
        this._localPlatformService.disposeGateway(info.gatewayId);
      }
    };
  }
  async _createRemoteGateway(chatSessionResource) {
    const connection = this._remoteAgentService.getConnection();
    if (!connection) {
      this._logService.info("[McpGateway][Workbench] No remote connection available for remote gateway");
      return void 0;
    }
    this._logService.info("[McpGateway][Workbench] Creating remote gateway via remote server");
    return connection.withChannel(McpGatewayChannelName, async (channel) => {
      const info = await channel.call(
        "createGateway",
        chatSessionResource ? { chatSessionResource: chatSessionResource.toString() } : void 0
      );
      const servers = reviveServers(info.servers);
      this._logService.info(`[McpGateway][Workbench] Remote gateway created with ${servers.length} server(s)`);
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
          this._logService.info(`[McpGateway][Workbench] Disposing remote gateway: ${info.gatewayId}`);
          void channel.call("disposeGateway", info.gatewayId).catch((error) => {
            this._logService.warn(`[McpGateway][Workbench] Failed to dispose remote gateway: ${info.gatewayId}`, error);
          });
        }
      };
    });
  }
};
WorkbenchMcpGatewayService = __decorateClass([
  __decorateParam(0, IMainProcessService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, ILogService)
], WorkbenchMcpGatewayService);
function reviveServers(servers) {
  return servers.map((s) => ({ label: s.label, address: URI.revive(s.address) }));
}
export {
  WorkbenchMcpGatewayService
};
