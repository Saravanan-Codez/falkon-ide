import { createDecorator } from "../../instantiation/common/instantiation.js";
const IMcpGatewayService = createDecorator("IMcpGatewayService");
const McpGatewayChannelName = "mcpGateway";
const McpGatewayToolBrokerChannelName = "mcpGatewayToolBroker";
export {
  IMcpGatewayService,
  McpGatewayChannelName,
  McpGatewayToolBrokerChannelName
};
