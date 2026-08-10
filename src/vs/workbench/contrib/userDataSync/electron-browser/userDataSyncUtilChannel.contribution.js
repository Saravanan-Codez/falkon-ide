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
import { ISharedProcessService } from "../../../../platform/ipc/electron-browser/services.js";
import { IUserDataSyncUtilService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
let UserDataSyncUtilChannelContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.userDataSyncServices";
  }
  constructor(userDataSyncUtilService, sharedProcessService) {
    super();
    sharedProcessService.registerChannel("userDataSyncUtil", ProxyChannel.fromService(userDataSyncUtilService, this._store));
  }
};
UserDataSyncUtilChannelContribution = __decorateClass([
  __decorateParam(0, IUserDataSyncUtilService),
  __decorateParam(1, ISharedProcessService)
], UserDataSyncUtilChannelContribution);
registerWorkbenchContribution2(UserDataSyncUtilChannelContribution.ID, UserDataSyncUtilChannelContribution, WorkbenchPhase.BlockStartup);
export {
  UserDataSyncUtilChannelContribution
};
