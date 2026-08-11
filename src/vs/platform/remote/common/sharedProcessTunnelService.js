import { createDecorator } from "../../instantiation/common/instantiation.js";
const ISharedProcessTunnelService = createDecorator("sharedProcessTunnelService");
const ipcSharedProcessTunnelChannelName = "sharedProcessTunnel";
export {
  ISharedProcessTunnelService,
  ipcSharedProcessTunnelChannelName
};
