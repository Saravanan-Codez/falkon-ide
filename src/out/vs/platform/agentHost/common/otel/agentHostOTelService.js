import { createDecorator } from "../../../instantiation/common/instantiation.js";
const AgentHostOTelServiceNamespace = "vscode.agent-host";
const AgentHostOTelServiceName = "vscode-agent-host";
const AgentHostSessionSpanName = "vscode.agent_host.session";
const AgentHostSessionTitleSpanName = "vscode.agent_host.session.title_changed";
const AgentHostSessionTitleAttribute = "vscode.agent_host.session.title";
const AgentHostSessionUriAttribute = "vscode.agent_host.session.uri";
const IAgentHostOTelService = createDecorator("agentHostOTelService");
export {
  AgentHostOTelServiceName,
  AgentHostOTelServiceNamespace,
  AgentHostSessionSpanName,
  AgentHostSessionTitleAttribute,
  AgentHostSessionTitleSpanName,
  AgentHostSessionUriAttribute,
  IAgentHostOTelService
};
