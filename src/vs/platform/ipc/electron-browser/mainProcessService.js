import { Disposable } from "../../../base/common/lifecycle.js";
import { Client as IPCElectronClient } from "../../../base/parts/ipc/electron-browser/ipc.electron.js";
class ElectronIPCMainProcessService extends Disposable {
  constructor(windowId) {
    super();
    this.mainProcessConnection = this._register(new IPCElectronClient(`window:${windowId}`));
  }
  getChannel(channelName) {
    return this.mainProcessConnection.getChannel(channelName);
  }
  registerChannel(channelName, channel) {
    this.mainProcessConnection.registerChannel(channelName, channel);
  }
}
export {
  ElectronIPCMainProcessService
};
