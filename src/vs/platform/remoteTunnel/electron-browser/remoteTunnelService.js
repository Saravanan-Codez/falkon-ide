import { registerSharedProcessRemoteService } from "../../ipc/electron-browser/services.js";
import { IRemoteTunnelService } from "../common/remoteTunnel.js";
registerSharedProcessRemoteService(IRemoteTunnelService, "remoteTunnel");
