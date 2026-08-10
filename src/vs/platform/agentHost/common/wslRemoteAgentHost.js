import { createDecorator } from "../../instantiation/common/instantiation.js";
const WSL_REMOTE_AGENT_HOST_CHANNEL = "wslRemoteAgentHost";
const WSL_INSTALL_DOCS_URL = "https://aka.ms/vscode-remote/wsl/install-wsl";
const WSL_ADDRESS_PREFIX = "wsl:";
const IWSLRemoteAgentHostService = createDecorator("wslRemoteAgentHostService");
const IWSLRemoteAgentHostMainService = createDecorator("wslRemoteAgentHostMainService");
export {
  IWSLRemoteAgentHostMainService,
  IWSLRemoteAgentHostService,
  WSL_ADDRESS_PREFIX,
  WSL_INSTALL_DOCS_URL,
  WSL_REMOTE_AGENT_HOST_CHANNEL
};
