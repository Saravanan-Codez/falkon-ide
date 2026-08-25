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
import { Event } from "../../../base/common/event.js";
import { IMeteredConnectionService } from "../../meteredConnection/common/meteredConnection.js";
import { INativeHostService } from "../../native/common/native.js";
import { IProductService } from "../../product/common/productService.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { UserDataAutoSyncService as BaseUserDataAutoSyncService } from "../common/userDataAutoSyncService.js";
import { IUserDataSyncEnablementService, IUserDataSyncLogService, IUserDataSyncService, IUserDataSyncStoreManagementService, IUserDataSyncStoreService } from "../common/userDataSync.js";
import { IUserDataSyncAccountService } from "../common/userDataSyncAccount.js";
import { IUserDataSyncMachinesService } from "../common/userDataSyncMachines.js";
let UserDataAutoSyncService = class extends BaseUserDataAutoSyncService {
  constructor(productService, userDataSyncStoreManagementService, userDataSyncStoreService, userDataSyncEnablementService, userDataSyncService, nativeHostService, logService, authTokenService, telemetryService, userDataSyncMachinesService, storageService, meteredConnectionService) {
    super(productService, userDataSyncStoreManagementService, userDataSyncStoreService, userDataSyncEnablementService, userDataSyncService, logService, authTokenService, telemetryService, userDataSyncMachinesService, storageService, meteredConnectionService);
    this._register(Event.debounce(Event.any(
      Event.map(nativeHostService.onDidFocusMainWindow, () => "windowFocus"),
      Event.map(nativeHostService.onDidOpenMainWindow, () => "windowOpen")
    ), (last, source) => last ? [...last, source] : [source], 1e3)((sources) => this.triggerSync(sources, { skipIfSyncedRecently: true })));
  }
};
UserDataAutoSyncService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IUserDataSyncStoreManagementService),
  __decorateParam(2, IUserDataSyncStoreService),
  __decorateParam(3, IUserDataSyncEnablementService),
  __decorateParam(4, IUserDataSyncService),
  __decorateParam(5, INativeHostService),
  __decorateParam(6, IUserDataSyncLogService),
  __decorateParam(7, IUserDataSyncAccountService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IUserDataSyncMachinesService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IMeteredConnectionService)
], UserDataAutoSyncService);
export {
  UserDataAutoSyncService
};
