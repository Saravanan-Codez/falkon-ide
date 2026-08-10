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
import { ProxyChannel } from "../../../base/parts/ipc/common/ipc.js";
import { SyncDescriptor } from "../../instantiation/common/descriptors.js";
import { registerSingleton } from "../../instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IMainProcessService } from "../common/mainProcessService.js";
class RemoteServiceStub {
  constructor(channelName, options, remote, instantiationService) {
    const channel = remote.getChannel(channelName);
    if (isRemoteServiceWithChannelClientOptions(options)) {
      return instantiationService.createInstance(new SyncDescriptor(options.channelClientCtor, [channel]));
    }
    return ProxyChannel.toService(channel, options?.proxyOptions);
  }
}
function isRemoteServiceWithChannelClientOptions(obj) {
  const candidate = obj;
  return !!candidate?.channelClientCtor;
}
let MainProcessRemoteServiceStub = class extends RemoteServiceStub {
  constructor(channelName, options, ipcService, instantiationService) {
    super(channelName, options, ipcService, instantiationService);
  }
};
MainProcessRemoteServiceStub = __decorateClass([
  __decorateParam(2, IMainProcessService),
  __decorateParam(3, IInstantiationService)
], MainProcessRemoteServiceStub);
function registerMainProcessRemoteService(id, channelName, options) {
  registerSingleton(id, new SyncDescriptor(MainProcessRemoteServiceStub, [channelName, options], true));
}
const ISharedProcessService = createDecorator("sharedProcessService");
let SharedProcessRemoteServiceStub = class extends RemoteServiceStub {
  constructor(channelName, options, ipcService, instantiationService) {
    super(channelName, options, ipcService, instantiationService);
  }
};
SharedProcessRemoteServiceStub = __decorateClass([
  __decorateParam(2, ISharedProcessService),
  __decorateParam(3, IInstantiationService)
], SharedProcessRemoteServiceStub);
function registerSharedProcessRemoteService(id, channelName, options) {
  registerSingleton(id, new SyncDescriptor(SharedProcessRemoteServiceStub, [channelName, options], true));
}
export {
  ISharedProcessService,
  registerMainProcessRemoteService,
  registerSharedProcessRemoteService
};
