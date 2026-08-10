import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
const IExtHostBrowserTunnelProxy = createDecorator("IExtHostBrowserTunnelProxy");
class ExtHostBrowserTunnelProxy {
  $setEnabled(_enabled) {
  }
}
export {
  ExtHostBrowserTunnelProxy,
  IExtHostBrowserTunnelProxy
};
