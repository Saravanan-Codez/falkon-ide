import { createDecorator } from "../../instantiation/common/instantiation.js";
const LOCAL_AGENT_HOST_SCHEME_PREFIX = "agent-host-";
const AMBIENT_AGENT_HOST_AUTHORITY = "local";
const IAgentHostConnectionsService = createDecorator("agentHostConnectionsService");
export {
  AMBIENT_AGENT_HOST_AUTHORITY,
  IAgentHostConnectionsService,
  LOCAL_AGENT_HOST_SCHEME_PREFIX
};
