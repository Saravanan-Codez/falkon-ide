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
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ILoggerService, ILogService, isLogLevel, log, LogLevelToString, parseLogLevel } from "../../../platform/log/common/log.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { URI } from "../../../base/common/uri.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
let MainThreadLoggerService = class {
  constructor(extHostContext, loggerService) {
    this.loggerService = loggerService;
    this.disposables = new DisposableStore();
    const proxy = extHostContext.getProxy(ExtHostContext.ExtHostLogLevelServiceShape);
    this.disposables.add(loggerService.onDidChangeLogLevel((arg) => {
      if (isLogLevel(arg)) {
        proxy.$setLogLevel(arg);
      } else {
        proxy.$setLogLevel(arg[1], arg[0]);
      }
    }));
  }
  $log(file, messages) {
    const logger = this.loggerService.getLogger(URI.revive(file));
    if (!logger) {
      throw new Error("Create the logger before logging");
    }
    for (const [level, message] of messages) {
      log(logger, level, message);
    }
  }
  async $createLogger(file, options) {
    this.loggerService.createLogger(URI.revive(file), options);
  }
  async $registerLogger(logResource) {
    this.loggerService.registerLogger({
      ...logResource,
      resource: URI.revive(logResource.resource)
    });
  }
  async $deregisterLogger(resource) {
    this.loggerService.deregisterLogger(URI.revive(resource));
  }
  async $setVisibility(resource, visible) {
    this.loggerService.setVisibility(URI.revive(resource), visible);
  }
  $flush(file) {
    const logger = this.loggerService.getLogger(URI.revive(file));
    if (!logger) {
      throw new Error("Create the logger before flushing");
    }
    logger.flush();
  }
  dispose() {
    this.disposables.dispose();
  }
};
MainThreadLoggerService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadLogger),
  __decorateParam(1, ILoggerService)
], MainThreadLoggerService);
CommandsRegistry.registerCommand("_extensionTests.setLogLevel", function(accessor, level) {
  const loggerService = accessor.get(ILoggerService);
  const environmentService = accessor.get(IEnvironmentService);
  if (environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI) {
    const logLevel = parseLogLevel(level);
    if (logLevel !== void 0) {
      loggerService.setLogLevel(logLevel);
    }
  }
});
CommandsRegistry.registerCommand("_extensionTests.getLogLevel", function(accessor) {
  const logService = accessor.get(ILogService);
  return LogLevelToString(logService.getLevel());
});
export {
  MainThreadLoggerService
};
