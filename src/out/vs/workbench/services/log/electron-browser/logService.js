import { ConsoleLogger, isDevConsoleLogForwardingEnabled, registerDevConsoleLogForwarder } from "../../../../platform/log/common/log.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { windowLogGroup, windowLogId } from "../common/logConstants.js";
import { LogService } from "../../../../platform/log/common/logService.js";
class NativeLogService extends LogService {
  constructor(loggerService, environmentService) {
    const disposables = new DisposableStore();
    const fileLogger = disposables.add(loggerService.createLogger(environmentService.logFile, { id: windowLogId, name: windowLogGroup.name, group: windowLogGroup }));
    let consoleLogger;
    if (environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI) {
      consoleLogger = loggerService.createConsoleMainLogger();
    } else {
      consoleLogger = new ConsoleLogger(fileLogger.getLevel());
    }
    super(fileLogger, [consoleLogger]);
    if (!environmentService.isBuilt && isDevConsoleLogForwardingEnabled) {
      this._register(registerDevConsoleLogForwarder(this));
    }
    this._register(disposables);
  }
}
export {
  NativeLogService
};
