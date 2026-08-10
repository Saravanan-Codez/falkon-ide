import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { ISSHRemoteAgentHostService } from "../common/sshRemoteAgentHost.js";
import { ISSHRelayClientFactory, SSHRelayClientFactory, SSHRemoteAgentHostService } from "./sshRemoteAgentHostServiceImpl.js";
registerSingleton(ISSHRelayClientFactory, SSHRelayClientFactory, InstantiationType.Delayed);
registerSingleton(ISSHRemoteAgentHostService, SSHRemoteAgentHostService, InstantiationType.Delayed);
