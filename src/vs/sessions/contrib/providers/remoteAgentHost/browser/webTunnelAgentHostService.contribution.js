import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { ITunnelAgentHostService } from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { WebTunnelAgentHostService } from "./webTunnelAgentHostService.js";
registerSingleton(ITunnelAgentHostService, WebTunnelAgentHostService, InstantiationType.Delayed);
