var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { ipcBrowserViewGroupChannelName } from "../../../../platform/browserView/common/browserViewGroup.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { mainWindow } from "../../../../base/browser/window.js";
let BrowserViewCDPService = class extends Disposable {
  constructor(mainProcessService) {
    super();
    const channel = mainProcessService.getChannel(ipcBrowserViewGroupChannelName);
    this._groupService = ProxyChannel.toService(channel);
  }
  async createSessionGroup(browserId) {
    const groupId = await this._groupService.createGroup({ mainWindowId: mainWindow.vscodeWindowId });
    await this._groupService.addViewToGroup(groupId, browserId);
    return groupId;
  }
  async destroySessionGroup(groupId) {
    await this._groupService.destroyGroup(groupId);
  }
  async sendCDPMessage(groupId, message) {
    await this._groupService.sendCDPMessage(groupId, message);
  }
  onCDPMessage(groupId) {
    return this._groupService.onDynamicCDPMessage(groupId);
  }
  onDidDestroy(groupId) {
    return this._groupService.onDynamicDidDestroy(groupId);
  }
};
BrowserViewCDPService = __decorateClass([
  __decorateParam(0, IMainProcessService)
], BrowserViewCDPService);
export {
  BrowserViewCDPService
};
