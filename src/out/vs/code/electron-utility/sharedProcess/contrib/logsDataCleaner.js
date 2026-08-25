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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { join } from "../../../../base/common/path.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { Promises } from "../../../../base/node/pfs.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let LogsDataCleaner = class extends Disposable {
  constructor(environmentService, logService) {
    super();
    this.environmentService = environmentService;
    this.logService = logService;
    const scheduler = this._register(new RunOnceScheduler(
      () => {
        this.cleanUpOldLogs();
      },
      10 * 1e3
      /* after 10s */
    ));
    scheduler.schedule();
  }
  async cleanUpOldLogs() {
    this.logService.trace("[logs cleanup]: Starting to clean up old logs.");
    try {
      const currentLog = basename(this.environmentService.logsHome);
      const logsRoot = dirname(this.environmentService.logsHome.with({ scheme: Schemas.file })).fsPath;
      const logFiles = await Promises.readdir(logsRoot);
      const allSessions = logFiles.filter((logFile) => /^\d{8}T\d{6}$/.test(logFile));
      const oldSessions = allSessions.sort().filter((session) => session !== currentLog);
      const sessionsToDelete = oldSessions.slice(0, Math.max(0, oldSessions.length - 9));
      if (sessionsToDelete.length > 0) {
        this.logService.trace(`[logs cleanup]: Removing log folders '${sessionsToDelete.join(", ")}'`);
        await Promise.all(sessionsToDelete.map((sessionToDelete) => Promises.rm(join(logsRoot, sessionToDelete))));
      }
    } catch (error) {
      onUnexpectedError(error);
    }
  }
};
LogsDataCleaner = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, ILogService)
], LogsDataCleaner);
export {
  LogsDataCleaner
};
