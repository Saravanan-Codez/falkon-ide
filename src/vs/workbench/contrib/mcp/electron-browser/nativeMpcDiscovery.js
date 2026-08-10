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
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { NativeMcpDiscoveryHelperChannelName } from "../../../../platform/mcp/common/nativeMcpDiscoveryHelper.js";
import { NativeFilesystemMcpDiscovery } from "../common/discovery/nativeMcpDiscoveryAbstract.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
let NativeMcpDiscovery = class extends NativeFilesystemMcpDiscovery {
  constructor(mainProcess, logService, labelService, fileService, instantiationService, mcpRegistry, configurationService) {
    super(null, labelService, fileService, instantiationService, mcpRegistry, configurationService);
    this.mainProcess = mainProcess;
    this.logService = logService;
  }
  start() {
    const service = ProxyChannel.toService(
      this.mainProcess.getChannel(NativeMcpDiscoveryHelperChannelName)
    );
    service.load().then(
      (data) => this.setDetails(data),
      (err) => {
        this.logService.warn("Error getting main process MCP environment", err);
        this.setDetails(void 0);
      }
    );
  }
};
NativeMcpDiscovery = __decorateClass([
  __decorateParam(0, IMainProcessService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IMcpRegistry),
  __decorateParam(6, IConfigurationService)
], NativeMcpDiscovery);
export {
  NativeMcpDiscovery
};
