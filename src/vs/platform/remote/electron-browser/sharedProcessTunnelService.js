import { registerSharedProcessRemoteService } from "../../ipc/electron-browser/services.js";
import { ISharedProcessTunnelService, ipcSharedProcessTunnelChannelName } from "../common/sharedProcessTunnelService.js";
registerSharedProcessRemoteService(ISharedProcessTunnelService, ipcSharedProcessTunnelChannelName);
