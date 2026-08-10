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
import { IUserDataProfileStorageService, RemoteUserDataProfileStorageService } from "../common/userDataProfileStorageService.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ILogService } from "../../log/common/log.js";
import { IUserDataProfilesService } from "../common/userDataProfile.js";
import { IMainProcessService } from "../../ipc/common/mainProcessService.js";
let NativeUserDataProfileStorageService = class extends RemoteUserDataProfileStorageService {
  constructor(mainProcessService, userDataProfilesService, storageService, logService) {
    super(false, mainProcessService, userDataProfilesService, storageService, logService);
  }
};
NativeUserDataProfileStorageService = __decorateClass([
  __decorateParam(0, IMainProcessService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ILogService)
], NativeUserDataProfileStorageService);
registerSingleton(IUserDataProfileStorageService, NativeUserDataProfileStorageService, InstantiationType.Delayed);
export {
  NativeUserDataProfileStorageService
};
