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
import { mainWindow } from "../../../../base/browser/window.js";
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { IPlaywrightService } from "../../../../platform/browserView/common/playwrightService.js";
import { registerSharedProcessRemoteService } from "../../../../platform/ipc/electron-browser/services.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let PlaywrightChannelClient = class {
  constructor(channel, logService) {
    void channel.call("__initialize", mainWindow.vscodeWindowId).catch((e) => {
      logService.error(`Failed to initialize Playwright service`, e);
    });
    return ProxyChannel.toService(channel);
  }
};
PlaywrightChannelClient = __decorateClass([
  __decorateParam(1, ILogService)
], PlaywrightChannelClient);
registerSharedProcessRemoteService(IPlaywrightService, "playwright", { channelClientCtor: PlaywrightChannelClient });
