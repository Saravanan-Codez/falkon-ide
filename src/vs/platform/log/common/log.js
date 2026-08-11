import * as nls from "../../../nls.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Emitter } from "../../../base/common/event.js";
import { hash } from "../../../base/common/hash.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { isWindows } from "../../../base/common/platform.js";
import { joinPath } from "../../../base/common/resources.js";
import { isNumber, isString } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { RawContextKey } from "../../contextkey/common/contextkey.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const ILogService = createDecorator("logService");
const ILoggerService = createDecorator("loggerService");
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function isLogLevel(thing) {
  return isNumber(thing);
}
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["Off"] = 0] = "Off";
  LogLevel2[LogLevel2["Trace"] = 1] = "Trace";
  LogLevel2[LogLevel2["Debug"] = 2] = "Debug";
  LogLevel2[LogLevel2["Info"] = 3] = "Info";
  LogLevel2[LogLevel2["Warning"] = 4] = "Warning";
  LogLevel2[LogLevel2["Error"] = 5] = "Error";
  return LogLevel2;
})(LogLevel || {});
const DEFAULT_LOG_LEVEL = 3 /* Info */;
function canLog(loggerLevel, messageLevel) {
  return loggerLevel !== 0 /* Off */ && loggerLevel <= messageLevel;
}
function log(logger, level, message) {
  switch (level) {
    case 1 /* Trace */:
      logger.trace(message);
      break;
    case 2 /* Debug */:
      logger.debug(message);
      break;
    case 3 /* Info */:
      logger.info(message);
      break;
    case 4 /* Warning */:
      logger.warn(message);
      break;
    case 5 /* Error */:
      logger.error(message);
      break;
    case 0 /* Off */:
      break;
    default:
      throw new Error(`Invalid log level ${level}`);
  }
}
const isDevConsoleLogForwardingEnabled = false;
let isConsoleForwarding = false;
let isLogServiceConsoleEcho = false;
function getConsoleMethod(method) {
  switch (method) {
    case "debug":
      return console.debug;
    case "error":
      return console.error;
    case "info":
      return console.info;
    case "log":
      return console.log;
    case "warn":
      return console.warn;
  }
}
function setConsoleMethod(method, fn) {
  switch (method) {
    case "debug":
      console.debug = fn;
      break;
    case "error":
      console.error = fn;
      break;
    case "info":
      console.info = fn;
      break;
    case "log":
      console.log = fn;
      break;
    case "warn":
      console.warn = fn;
      break;
  }
}
function logToConsole(method, ...args) {
  if (isConsoleForwarding) {
    return;
  }
  isLogServiceConsoleEcho = true;
  try {
    getConsoleMethod(method).apply(console, args);
  } finally {
    isLogServiceConsoleEcho = false;
  }
}
function registerDevConsoleLogForwarder(logService) {
  const originalConsoleMethods = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn
  };
  const forward = (method, level, args) => {
    if (!isLogServiceConsoleEcho) {
      isConsoleForwarding = true;
      try {
        log(logService, level, format(args));
      } catch {
      } finally {
        isConsoleForwarding = false;
      }
    }
    originalConsoleMethods[method].apply(console, args);
  };
  const wrappers = {
    debug: (...args) => forward("debug", 2 /* Debug */, args),
    error: (...args) => forward("error", 5 /* Error */, args),
    info: (...args) => forward("info", 3 /* Info */, args),
    log: (...args) => forward("log", 3 /* Info */, args),
    warn: (...args) => forward("warn", 4 /* Warning */, args)
  };
  setConsoleMethod("debug", wrappers.debug);
  setConsoleMethod("error", wrappers.error);
  setConsoleMethod("info", wrappers.info);
  setConsoleMethod("log", wrappers.log);
  setConsoleMethod("warn", wrappers.warn);
  return toDisposable(() => {
    if (console.debug === wrappers.debug) {
      console.debug = originalConsoleMethods.debug;
    }
    if (console.error === wrappers.error) {
      console.error = originalConsoleMethods.error;
    }
    if (console.info === wrappers.info) {
      console.info = originalConsoleMethods.info;
    }
    if (console.log === wrappers.log) {
      console.log = originalConsoleMethods.log;
    }
    if (console.warn === wrappers.warn) {
      console.warn = originalConsoleMethods.warn;
    }
  });
}
function format(args, verbose = false) {
  let result = "";
  for (let i = 0; i < args.length; i++) {
    let a = args[i];
    if (a instanceof Error) {
      a = toErrorMessage(a, verbose);
    }
    if (typeof a === "object") {
      try {
        a = JSON.stringify(a);
      } catch (e) {
      }
    }
    result += (i > 0 ? " " : "") + a;
  }
  return result;
}
class AbstractLogger extends Disposable {
  constructor() {
    super(...arguments);
    this.level = DEFAULT_LOG_LEVEL;
    this._onDidChangeLogLevel = this._register(new Emitter());
  }
  get onDidChangeLogLevel() {
    return this._onDidChangeLogLevel.event;
  }
  setLevel(level) {
    if (this.level !== level) {
      this.level = level;
      this._onDidChangeLogLevel.fire(this.level);
    }
  }
  getLevel() {
    return this.level;
  }
  checkLogLevel(level) {
    return canLog(this.level, level);
  }
  canLog(level) {
    if (this._store.isDisposed) {
      return false;
    }
    return this.checkLogLevel(level);
  }
}
class AbstractMessageLogger extends AbstractLogger {
  constructor(logAlways) {
    super();
    this.logAlways = logAlways;
  }
  checkLogLevel(level) {
    return this.logAlways || super.checkLogLevel(level);
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      this.log(1 /* Trace */, format([message, ...args], true));
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      this.log(2 /* Debug */, format([message, ...args]));
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      this.log(3 /* Info */, format([message, ...args]));
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      this.log(4 /* Warning */, format([message, ...args]));
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      if (message instanceof Error) {
        const array = Array.prototype.slice.call(arguments);
        array[0] = message.stack;
        this.log(5 /* Error */, format(array));
      } else {
        this.log(5 /* Error */, format([message, ...args]));
      }
    }
  }
  flush() {
  }
}
class ConsoleMainLogger extends AbstractLogger {
  constructor(logLevel = DEFAULT_LOG_LEVEL) {
    super();
    this.setLevel(logLevel);
    this.useColors = !isWindows;
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      if (this.useColors) {
        logToConsole("log", `\x1B[90m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        logToConsole("log", `[main ${now()}]`, message, ...args);
      }
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      if (this.useColors) {
        logToConsole("log", `\x1B[90m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        logToConsole("log", `[main ${now()}]`, message, ...args);
      }
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      if (this.useColors) {
        logToConsole("log", `\x1B[90m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        logToConsole("log", `[main ${now()}]`, message, ...args);
      }
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      if (this.useColors) {
        logToConsole("warn", `\x1B[93m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        logToConsole("warn", `[main ${now()}]`, message, ...args);
      }
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      if (this.useColors) {
        logToConsole("error", `\x1B[91m[main ${now()}]\x1B[0m`, message, ...args);
      } else {
        logToConsole("error", `[main ${now()}]`, message, ...args);
      }
    }
  }
  flush() {
  }
}
class ConsoleLogger extends AbstractLogger {
  constructor(logLevel = DEFAULT_LOG_LEVEL, useColors = true) {
    super();
    this.useColors = useColors;
    this.setLevel(logLevel);
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      if (this.useColors) {
        logToConsole("log", "%cTRACE", "color: #888", message, ...args);
      } else {
        logToConsole("log", message, ...args);
      }
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      if (this.useColors) {
        logToConsole("log", "%cDEBUG", "background: #eee; color: #888", message, ...args);
      } else {
        logToConsole("log", message, ...args);
      }
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      if (this.useColors) {
        logToConsole("log", "%c INFO", "color: #33f", message, ...args);
      } else {
        logToConsole("log", message, ...args);
      }
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      if (this.useColors) {
        logToConsole("warn", "%c WARN", "color: #993", message, ...args);
      } else {
        logToConsole("log", message, ...args);
      }
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      if (this.useColors) {
        logToConsole("error", "%c  ERR", "color: #f33", message, ...args);
      } else {
        logToConsole("error", message, ...args);
      }
    }
  }
  flush() {
  }
}
class AdapterLogger extends AbstractLogger {
  constructor(adapter, logLevel = DEFAULT_LOG_LEVEL) {
    super();
    this.adapter = adapter;
    this.setLevel(logLevel);
  }
  trace(message, ...args) {
    if (this.canLog(1 /* Trace */)) {
      this.adapter.log(1 /* Trace */, [this.extractMessage(message), ...args]);
    }
  }
  debug(message, ...args) {
    if (this.canLog(2 /* Debug */)) {
      this.adapter.log(2 /* Debug */, [this.extractMessage(message), ...args]);
    }
  }
  info(message, ...args) {
    if (this.canLog(3 /* Info */)) {
      this.adapter.log(3 /* Info */, [this.extractMessage(message), ...args]);
    }
  }
  warn(message, ...args) {
    if (this.canLog(4 /* Warning */)) {
      this.adapter.log(4 /* Warning */, [this.extractMessage(message), ...args]);
    }
  }
  error(message, ...args) {
    if (this.canLog(5 /* Error */)) {
      this.adapter.log(5 /* Error */, [this.extractMessage(message), ...args]);
    }
  }
  extractMessage(msg) {
    if (typeof msg === "string") {
      return msg;
    }
    return toErrorMessage(msg, this.canLog(1 /* Trace */));
  }
  flush() {
  }
}
class MultiplexLogger extends AbstractLogger {
  constructor(loggers) {
    super();
    this.loggers = loggers;
    if (loggers.length) {
      this.setLevel(loggers[0].getLevel());
    }
  }
  setLevel(level) {
    for (const logger of this.loggers) {
      logger.setLevel(level);
    }
    super.setLevel(level);
  }
  trace(message, ...args) {
    for (const logger of this.loggers) {
      logger.trace(message, ...args);
    }
  }
  debug(message, ...args) {
    for (const logger of this.loggers) {
      logger.debug(message, ...args);
    }
  }
  info(message, ...args) {
    for (const logger of this.loggers) {
      logger.info(message, ...args);
    }
  }
  warn(message, ...args) {
    for (const logger of this.loggers) {
      logger.warn(message, ...args);
    }
  }
  error(message, ...args) {
    for (const logger of this.loggers) {
      logger.error(message, ...args);
    }
  }
  flush() {
    for (const logger of this.loggers) {
      logger.flush();
    }
  }
  dispose() {
    for (const logger of this.loggers) {
      logger.dispose();
    }
    super.dispose();
  }
}
class AbstractLoggerService extends Disposable {
  constructor(logLevel, logsHome, loggerResources) {
    super();
    this.logLevel = logLevel;
    this.logsHome = logsHome;
    this._loggers = new ResourceMap();
    this._onDidChangeLoggers = this._register(new Emitter());
    this.onDidChangeLoggers = this._onDidChangeLoggers.event;
    this._onDidChangeLogLevel = this._register(new Emitter());
    this.onDidChangeLogLevel = this._onDidChangeLogLevel.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    if (loggerResources) {
      for (const loggerResource of loggerResources) {
        this._loggers.set(loggerResource.resource, { logger: void 0, info: loggerResource });
      }
    }
  }
  getLoggerEntry(resourceOrId) {
    if (isString(resourceOrId)) {
      return [...this._loggers.values()].find((logger) => logger.info.id === resourceOrId);
    }
    return this._loggers.get(resourceOrId);
  }
  getLogger(resourceOrId) {
    return this.getLoggerEntry(resourceOrId)?.logger;
  }
  createLogger(idOrResource, options) {
    const resource = this.toResource(idOrResource);
    const id = isString(idOrResource) ? idOrResource : options?.id ?? hash(resource.toString()).toString(16);
    let logger = this._loggers.get(resource)?.logger;
    const logLevel = options?.logLevel === "always" ? 1 /* Trace */ : options?.logLevel;
    if (!logger) {
      logger = this.doCreateLogger(resource, logLevel ?? this.getLogLevel(resource) ?? this.logLevel, { ...options, id });
    }
    const loggerEntry = {
      logger,
      info: {
        resource,
        id,
        logLevel,
        name: options?.name,
        hidden: options?.hidden,
        group: options?.group,
        extensionId: options?.extensionId,
        when: options?.when
      }
    };
    this.registerLogger(loggerEntry.info);
    this._loggers.set(resource, loggerEntry);
    return logger;
  }
  toResource(idOrResource) {
    return isString(idOrResource) ? joinPath(this.logsHome, `${idOrResource.replace(/[\\/:\*\?"<>\|]/g, "")}.log`) : idOrResource;
  }
  setLogLevel(arg1, arg2) {
    if (URI.isUri(arg1)) {
      const resource = arg1;
      const logLevel = arg2;
      const logger = this._loggers.get(resource);
      if (logger && logLevel !== logger.info.logLevel) {
        logger.info.logLevel = logLevel === this.logLevel ? void 0 : logLevel;
        logger.logger?.setLevel(logLevel);
        this._loggers.set(logger.info.resource, logger);
        this._onDidChangeLogLevel.fire([resource, logLevel]);
      }
    } else {
      this.logLevel = arg1;
      for (const [resource, logger] of this._loggers.entries()) {
        if (this._loggers.get(resource)?.info.logLevel === void 0) {
          logger.logger?.setLevel(this.logLevel);
        }
      }
      this._onDidChangeLogLevel.fire(this.logLevel);
    }
  }
  setVisibility(resourceOrId, visibility) {
    const logger = this.getLoggerEntry(resourceOrId);
    if (logger && visibility !== !logger.info.hidden) {
      logger.info.hidden = !visibility;
      this._loggers.set(logger.info.resource, logger);
      this._onDidChangeVisibility.fire([logger.info.resource, visibility]);
    }
  }
  getLogLevel(resource) {
    let logLevel;
    if (resource) {
      logLevel = this._loggers.get(resource)?.info.logLevel;
    }
    return logLevel ?? this.logLevel;
  }
  registerLogger(resource) {
    const existing = this._loggers.get(resource.resource);
    if (existing) {
      if (existing.info.hidden !== resource.hidden) {
        this.setVisibility(resource.resource, !resource.hidden);
      }
    } else {
      this._loggers.set(resource.resource, { info: resource, logger: void 0 });
      this._onDidChangeLoggers.fire({ added: [resource], removed: [] });
    }
  }
  deregisterLogger(idOrResource) {
    const resource = this.toResource(idOrResource);
    const existing = this._loggers.get(resource);
    if (existing) {
      if (existing.logger) {
        existing.logger.dispose();
      }
      this._loggers.delete(resource);
      this._onDidChangeLoggers.fire({ added: [], removed: [existing.info] });
    }
  }
  *getRegisteredLoggers() {
    for (const entry of this._loggers.values()) {
      yield entry.info;
    }
  }
  getRegisteredLogger(resource) {
    return this._loggers.get(resource)?.info;
  }
  dispose() {
    this._loggers.forEach((logger) => logger.logger?.dispose());
    this._loggers.clear();
    super.dispose();
  }
}
class NullLogger {
  constructor() {
    this.onDidChangeLogLevel = new Emitter().event;
  }
  setLevel(level) {
  }
  getLevel() {
    return 3 /* Info */;
  }
  trace(message, ...args) {
  }
  debug(message, ...args) {
  }
  info(message, ...args) {
  }
  warn(message, ...args) {
  }
  error(message, ...args) {
  }
  critical(message, ...args) {
  }
  dispose() {
  }
  flush() {
  }
}
class NullLogService extends NullLogger {
}
class NullLoggerService extends AbstractLoggerService {
  constructor() {
    super(0 /* Off */, URI.parse("log:///log"));
  }
  doCreateLogger(resource, logLevel, options) {
    return new NullLogger();
  }
}
function getLogLevel(environmentService) {
  if (environmentService.verbose) {
    return 1 /* Trace */;
  }
  if (typeof environmentService.logLevel === "string") {
    const logLevel = parseLogLevel(environmentService.logLevel.toLowerCase());
    if (logLevel !== void 0) {
      return logLevel;
    }
  }
  return DEFAULT_LOG_LEVEL;
}
function LogLevelToString(logLevel) {
  switch (logLevel) {
    case 1 /* Trace */:
      return "trace";
    case 2 /* Debug */:
      return "debug";
    case 3 /* Info */:
      return "info";
    case 4 /* Warning */:
      return "warn";
    case 5 /* Error */:
      return "error";
    case 0 /* Off */:
      return "off";
  }
}
function LogLevelToLocalizedString(logLevel) {
  switch (logLevel) {
    case 1 /* Trace */:
      return { original: "Trace", value: nls.localize("trace", "Trace") };
    case 2 /* Debug */:
      return { original: "Debug", value: nls.localize("debug", "Debug") };
    case 3 /* Info */:
      return { original: "Info", value: nls.localize("info", "Info") };
    case 4 /* Warning */:
      return { original: "Warning", value: nls.localize("warn", "Warning") };
    case 5 /* Error */:
      return { original: "Error", value: nls.localize("error", "Error") };
    case 0 /* Off */:
      return { original: "Off", value: nls.localize("off", "Off") };
  }
}
function parseLogLevel(logLevel) {
  switch (logLevel) {
    case "trace":
      return 1 /* Trace */;
    case "debug":
      return 2 /* Debug */;
    case "info":
      return 3 /* Info */;
    case "warn":
      return 4 /* Warning */;
    case "error":
      return 5 /* Error */;
    case "critical":
      return 5 /* Error */;
    case "off":
      return 0 /* Off */;
  }
  return void 0;
}
const CONTEXT_LOG_LEVEL = new RawContextKey("logLevel", LogLevelToString(3 /* Info */));
export {
  AbstractLogger,
  AbstractLoggerService,
  AbstractMessageLogger,
  AdapterLogger,
  CONTEXT_LOG_LEVEL,
  ConsoleLogger,
  ConsoleMainLogger,
  DEFAULT_LOG_LEVEL,
  ILogService,
  ILoggerService,
  LogLevel,
  LogLevelToLocalizedString,
  LogLevelToString,
  MultiplexLogger,
  NullLogService,
  NullLogger,
  NullLoggerService,
  canLog,
  format,
  getLogLevel,
  isDevConsoleLogForwardingEnabled,
  isLogLevel,
  log,
  parseLogLevel,
  registerDevConsoleLogForwarder
};
