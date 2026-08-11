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
import { ProxyChannel } from "../../../../../base/parts/ipc/common/ipc.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { NativeMcpDiscoveryHelperChannelName } from "../../../../../platform/mcp/common/nativeMcpDiscoveryHelper.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { NativeFilesystemMcpDiscovery } from "./nativeMcpDiscoveryAbstract.js";
let RemoteNativeMpcDiscovery = class extends NativeFilesystemMcpDiscovery {
  constructor(remoteAgent, logService, labelService, fileService, instantiationService, mcpRegistry, configurationService) {
    super(remoteAgent.getConnection()?.remoteAuthority || null, labelService, fileService, instantiationService, mcpRegistry, configurationService);
    this.remoteAgent = remoteAgent;
    this.logService = logService;
  }
  async start() {
    const connection = this.remoteAgent.getConnection();
    if (!connection) {
      return this.setDetails(void 0);
    }
    await connection.withChannel(NativeMcpDiscoveryHelperChannelName, async (channel) => {
      const service = ProxyChannel.toService(channel);
      service.load().then(
        (data) => this.setDetails(data),
        (err) => {
          this.logService.warn("Error getting remote process MCP environment", err);
          this.setDetails(void 0);
        }
      );
    });
  }
};
RemoteNativeMpcDiscovery = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IMcpRegistry),
  __decorateParam(6, IConfigurationService)
], RemoteNativeMpcDiscovery);
export {
  RemoteNativeMpcDiscovery
};
