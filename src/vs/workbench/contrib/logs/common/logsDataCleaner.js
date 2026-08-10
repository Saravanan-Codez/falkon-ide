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
import { IFileService } from "../../../../platform/files/common/files.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { Promises } from "../../../../base/common/async.js";
let LogsDataCleaner = class extends Disposable {
  constructor(environmentService, fileService, lifecycleService) {
    super();
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.lifecycleService = lifecycleService;
    this.cleanUpOldLogsSoon();
  }
  cleanUpOldLogsSoon() {
    let handle = setTimeout(async () => {
      handle = void 0;
      const stat = await this.fileService.resolve(dirname(this.environmentService.logsHome));
      if (stat.children) {
        const currentLog = basename(this.environmentService.logsHome);
        const allSessions = stat.children.filter((stat2) => stat2.isDirectory && /^\d{8}T\d{6}$/.test(stat2.name));
        const oldSessions = allSessions.sort().filter((d, i) => d.name !== currentLog);
        const toDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 49));
        Promises.settled(toDelete.map((stat2) => this.fileService.del(stat2.resource, { recursive: true })));
      }
    }, 10 * 1e3);
    this._register(this.lifecycleService.onWillShutdown(() => {
      if (handle) {
        clearTimeout(handle);
        handle = void 0;
      }
    }));
  }
};
LogsDataCleaner = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILifecycleService)
], LogsDataCleaner);
export {
  LogsDataCleaner
};
