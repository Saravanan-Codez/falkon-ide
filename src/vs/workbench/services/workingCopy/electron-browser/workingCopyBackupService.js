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
import { localize } from "../../../../nls.js";
import { WorkingCopyBackupService } from "../common/workingCopyBackupService.js";
import { URI } from "../../../../base/common/uri.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkingCopyBackupService } from "../common/workingCopyBackup.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { NativeWorkingCopyBackupTracker } from "./workingCopyBackupTracker.js";
let NativeWorkingCopyBackupService = class extends WorkingCopyBackupService {
  constructor(environmentService, fileService, logService, lifecycleService) {
    super(environmentService.backupPath ? URI.file(environmentService.backupPath).with({ scheme: environmentService.userRoamingDataHome.scheme }) : void 0, fileService, logService);
    this.lifecycleService = lifecycleService;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.lifecycleService.onWillShutdown((event) => event.join(this.joinBackups(), { id: "join.workingCopyBackups", label: localize("join.workingCopyBackups", "Backup working copies") })));
  }
};
NativeWorkingCopyBackupService = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ILifecycleService)
], NativeWorkingCopyBackupService);
registerSingleton(IWorkingCopyBackupService, NativeWorkingCopyBackupService, InstantiationType.Eager);
registerWorkbenchContribution2(NativeWorkingCopyBackupTracker.ID, NativeWorkingCopyBackupTracker, WorkbenchPhase.BlockStartup);
export {
  NativeWorkingCopyBackupService
};
