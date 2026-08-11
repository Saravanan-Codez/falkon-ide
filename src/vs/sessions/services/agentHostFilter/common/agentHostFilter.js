import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var AgentHostFilterConnectionStatus = /* @__PURE__ */ ((AgentHostFilterConnectionStatus2) => {
  AgentHostFilterConnectionStatus2["Disconnected"] = "disconnected";
  AgentHostFilterConnectionStatus2["Connecting"] = "connecting";
  AgentHostFilterConnectionStatus2["Connected"] = "connected";
  return AgentHostFilterConnectionStatus2;
})(AgentHostFilterConnectionStatus || {});
const IAgentHostFilterService = createDecorator("agentHostFilterService");
export {
  AgentHostFilterConnectionStatus,
  IAgentHostFilterService
};
