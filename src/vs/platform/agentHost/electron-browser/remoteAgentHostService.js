import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { IRemoteAgentHostService } from "../common/remoteAgentHostService.js";
import { RemoteAgentHostService } from "../browser/remoteAgentHostServiceImpl.js";
registerSingleton(IRemoteAgentHostService, RemoteAgentHostService, InstantiationType.Delayed);
