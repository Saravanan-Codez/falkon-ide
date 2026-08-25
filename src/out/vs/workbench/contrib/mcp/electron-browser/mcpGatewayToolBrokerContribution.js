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
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { McpGatewayToolBrokerChannelName } from "../../../../platform/mcp/common/mcpGateway.js";
import { IMcpService } from "../common/mcpTypes.js";
import { McpGatewayToolBrokerChannel } from "../common/mcpGatewayToolBrokerChannel.js";
let McpGatewayToolBrokerContribution = class {
  constructor(mainProcessService, mcpService, logService) {
    mainProcessService.registerChannel(McpGatewayToolBrokerChannelName, new McpGatewayToolBrokerChannel(mcpService, logService));
  }
};
McpGatewayToolBrokerContribution = __decorateClass([
  __decorateParam(0, IMainProcessService),
  __decorateParam(1, IMcpService),
  __decorateParam(2, ILogService)
], McpGatewayToolBrokerContribution);
export {
  McpGatewayToolBrokerContribution
};
