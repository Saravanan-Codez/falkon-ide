import { createDecorator } from "../../instantiation/common/instantiation.js";
const LOCAL_AGENT_HOST_RESOURCE_IDENTITY = /* @__PURE__ */ Symbol("localAgentHostResourceIdentity");
const AgentHostLocalFilePermissionsSettingId = "chat.agentHost.localFilePermissions";
var AgentHostAccessMode = /* @__PURE__ */ ((AgentHostAccessMode2) => {
  AgentHostAccessMode2["Read"] = "r";
  AgentHostAccessMode2["ReadWrite"] = "rw";
  return AgentHostAccessMode2;
})(AgentHostAccessMode || {});
var AgentHostPermissionMode = /* @__PURE__ */ ((AgentHostPermissionMode2) => {
  AgentHostPermissionMode2["Read"] = "read";
  AgentHostPermissionMode2["Write"] = "write";
  return AgentHostPermissionMode2;
})(AgentHostPermissionMode || {});
class AgentHostResourcePermissionError extends Error {
  constructor(request) {
    super(request ? `Access to ${request.uri} is not granted.` : "Access to the requested resource is not granted.");
    this.request = request;
    this.name = "AgentHostResourcePermissionError";
  }
}
const IAgentHostResourceService = createDecorator("agentHostResourceService");
export {
  AgentHostAccessMode,
  AgentHostLocalFilePermissionsSettingId,
  AgentHostPermissionMode,
  AgentHostResourcePermissionError,
  IAgentHostResourceService,
  LOCAL_AGENT_HOST_RESOURCE_IDENTITY
};
